import { constants as zlib } from 'node:zlib';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import compress from '@fastify/compress';
import { ApiError } from './errors';
import { EventLog } from './event-log';
import { MenuStore } from './menu-store';
import type { MenuSeed } from './menu-store';
import { OrderStore } from './order-store';
import { categoryInput, categoryPatch, createOrderRequest, idParams, menuItemInput, menuItemPatch, parse } from './schemas';
import { generateMenu } from './seed';
import { KitchenSimulator, MenuChurnSimulator } from './simulators';
import { openEventStream } from './sse';

export interface ChaosOptions {
  /** Random extra latency for every API request, from 0 to this value. */
  maxLatencyMs: number;
  /** Share of API requests (0..1) that fail with 503. */
  failureRate: number;
}

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
  seed?: MenuSeed;
  /** Delay between order status steps; `max: 0` turns the kitchen off. */
  kitchenStepMs?: { min: number; max: number };
  /** Random menu changes every N ms (demo mode); 0 turns it off. */
  menuChurnMs?: number;
  chaos?: ChaosOptions;
}

export interface App {
  server: FastifyInstance;
  log: EventLog;
  menu: MenuStore;
  orders: OrderStore;
}

export async function buildApp(options: AppOptions = {}): Promise<App> {
  const log = new EventLog();
  const menu = new MenuStore(log);
  menu.load(options.seed ?? generateMenu());
  const kitchen = new KitchenSimulator(options.kitchenStepMs ?? { min: 4_000, max: 10_000 });
  const orders = new OrderStore(log, menu, kitchen.onOrderCreated);
  kitchen.attach(orders);
  const churn = new MenuChurnSimulator(menu, options.menuChurnMs ?? 0);

  const server = Fastify({ logger: options.logger ?? false });
  // The full menu is a few hundred KB of JSON: compression matters, maximum brotli quality is too slow.
  await server.register(compress, { brotliOptions: { params: { [zlib.BROTLI_PARAM_QUALITY]: 4 } } });

  server.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) return reply.code(error.statusCode).send(error.toBody());
    // Fastify's own client errors, e.g. malformed JSON.
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.code(400).send({ code: 'VALIDATION', message: (error as Error).message });
    }
    request.log.error(error);
    return reply.code(500).send({ code: 'INTERNAL', message: 'Unexpected server error' });
  });
  server.setNotFoundHandler((request, reply) =>
    reply.code(404).send({ code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` }),
  );

  if (options.chaos) installChaos(server, options.chaos);

  const streams = new Set<() => void>();
  server.get('/api/events', (request, reply) => {
    const close = openEventStream(log, request, reply);
    streams.add(close);
    request.raw.on('close', () => streams.delete(close));
  });

  server.get('/api/health', () => ({ status: 'ok', epoch: log.epoch, version: log.version }));

  server.get('/api/menu', () => menu.snapshot());

  server.post('/api/categories', (request, reply) =>
    reply.code(201).send(menu.createCategory(parse(categoryInput, request.body))),
  );
  server.patch('/api/categories/:id', (request) =>
    menu.updateCategory(parse(idParams, request.params).id, parse(categoryPatch, request.body)),
  );
  server.delete('/api/categories/:id', (request, reply) => {
    menu.deleteCategory(parse(idParams, request.params).id);
    return reply.code(204).send();
  });

  server.post('/api/items', (request, reply) => reply.code(201).send(menu.createItem(parse(menuItemInput, request.body))));
  server.patch('/api/items/:id', (request) =>
    menu.updateItem(parse(idParams, request.params).id, parse(menuItemPatch, request.body)),
  );
  server.delete('/api/items/:id', (request, reply) => {
    menu.deleteItem(parse(idParams, request.params).id);
    return reply.code(204).send();
  });

  server.get('/api/orders', () => orders.snapshot());
  server.post('/api/orders', (request, reply) => {
    const result = orders.place(parse(createOrderRequest, request.body));
    // 201 for a new order, 200 when a retry hit an order that already exists.
    return reply.code(result.replayed ? 200 : 201).send(result.order);
  });

  server.addHook('onReady', () => {
    churn.start();
  });
  server.addHook('onClose', () => {
    churn.stop();
    kitchen.stop();
    // Open SSE streams would otherwise keep the server from shutting down.
    for (const close of streams) close();
    streams.clear();
  });

  return { server, log, menu, orders };
}

/**
 * Simulates a bad network so the client's retries and error messages can be seen.
 * POST /api/orders fails after the order is stored: the response is "lost",
 * which is exactly the case the idempotency key protects against.
 */
function installChaos(server: FastifyInstance, chaos: ChaosOptions): void {
  const failing = new WeakSet<object>();
  const unavailable = new ApiError(503, 'UNAVAILABLE', 'Simulated failure (chaos mode)');
  const isOrderPost = (method: string, url: string): boolean => method === 'POST' && url.startsWith('/api/orders');

  server.addHook('onRequest', async (request) => {
    if (!request.url.startsWith('/api/') || request.url.startsWith('/api/events') || request.url.startsWith('/api/health')) {
      return;
    }
    if (chaos.maxLatencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * chaos.maxLatencyMs));
    }
    if (Math.random() >= chaos.failureRate) return;
    if (isOrderPost(request.method, request.url)) failing.add(request);
    else throw unavailable;
  });

  server.addHook('onSend', async (request, reply, payload) => {
    if (!failing.has(request)) return payload;
    // The compression hook may already have run on the real payload.
    reply.removeHeader('content-encoding');
    reply.code(503).header('content-type', 'application/json; charset=utf-8');
    return JSON.stringify(unavailable.toBody());
  });
}
