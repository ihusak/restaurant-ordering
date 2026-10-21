import type { ServerResponse } from 'node:http';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { SSE_EVENT, formatEventId, parseEventId } from '@shared';
import type { HelloEvent, ServerEvent } from '@shared';
import type { EventLog } from './event-log';

const HEARTBEAT_MS = 15_000;
const RETRY_MS = 3_000;

/**
 * Streams the event log to one client (protocol: shared/src/events.ts).
 * Returns a function that ends the stream, used on server shutdown.
 */
export function openEventStream(log: EventLog, request: FastifyRequest, reply: FastifyReply): () => void {
  // On an automatic reconnect EventSource reuses the original URL (stale `since`)
  // but sends the id of the last event it received, so the header wins.
  const query = request.query as { since?: unknown };
  const header = request.headers['last-event-id'];
  const since = parseEventId(typeof header === 'string' && header ? header : typeof query.since === 'string' ? query.since : null);

  // The stream outlives the handler, so Fastify must not try to send a reply of its own.
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`retry: ${RETRY_MS}\n\n`);

  const hello: HelloEvent = { epoch: log.epoch, version: log.version };
  write(res, SSE_EVENT.hello, hello);

  if (since) {
    const replay = log.since(since.epoch, since.version);
    if (replay.kind === 'resync') write(res, SSE_EVENT.resync, {});
    else for (const event of replay.events) writeChange(res, log.epoch, event);
  }

  // Replay and subscribe run in the same tick, so no event can fall between them.
  const unsubscribe = log.subscribe((event) => {
    writeChange(res, log.epoch, event);
  });
  const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  };
  request.raw.on('close', close);
  return close;
}

function writeChange(res: ServerResponse, epoch: string, event: ServerEvent): void {
  write(res, SSE_EVENT.change, event, formatEventId(epoch, event.version));
}

function write(res: ServerResponse, event: string, data: unknown, id?: string): void {
  res.write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
