import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ApiErrorBody, CreateOrderRequest, Order, OrdersSnapshot } from '@shared';
import type { App } from '../src/app';
import { testApp } from './helpers';

let app: App;
beforeEach(async () => {
  app = await testApp();
});
afterEach(async () => {
  await app.server.close();
});

const order = (overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest => ({
  idempotencyKey: 'key-00000001',
  lines: [
    { itemId: 'pizza', openPrice: false, quantity: 2, unitPrice: 1250 },
    { itemId: 'special', openPrice: true, quantity: 1, unitPrice: 900 },
  ],
  discount: 400,
  ...overrides,
});

const post = (body: unknown) => app.server.inject({ method: 'POST', url: '/api/orders', payload: body as object });

describe('POST /api/orders', () => {
  it('creates an order with totals computed by the server', async () => {
    const response = await post(order());
    expect(response.statusCode).toBe(201);
    const created = response.json<Order>();
    expect(created).toMatchObject({ number: 1001, status: 'accepted', subtotal: 3400, discount: 400, total: 3000 });
    expect(created.lines.map((line) => line.name)).toEqual(['Pizza', 'Special']);
  });

  it('returns the same order when a request is retried with the same key', async () => {
    const first = (await post(order())).json<Order>();
    const retry = await post(order());
    expect(retry.statusCode).toBe(200);
    expect(retry.json<Order>().id).toBe(first.id);

    const orders = (await app.server.inject({ method: 'GET', url: '/api/orders' })).json<OrdersSnapshot>().orders;
    expect(orders).toHaveLength(1);
  });

  it('rejects a reused key with a different order', async () => {
    await post(order());
    const response = await post(order({ discount: 0 }));
    expect(response.statusCode).toBe(422);
    expect(response.json<ApiErrorBody>().code).toBe('IDEMPOTENCY_MISMATCH');
  });

  it('reports every menu change and stores nothing, so the same key can be retried', async () => {
    app.menu.updateItem('pizza', { price: 1300 });
    app.menu.updateItem('special', { openPrice: false, price: 1000 });

    const conflict = await post(order());
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json<ApiErrorBody>()).toMatchObject({
      code: 'MENU_CHANGED',
      issues: [
        { itemId: 'pizza', kind: 'price_changed', expected: 1250, actual: 1300 },
        { itemId: 'special', kind: 'pricing_changed', openPrice: false },
      ],
    });

    const fixed = order({
      lines: [
        { itemId: 'pizza', openPrice: false, quantity: 2, unitPrice: 1300 },
        { itemId: 'special', openPrice: false, quantity: 1, unitPrice: 1000 },
      ],
    });
    expect((await post(fixed)).statusCode).toBe(201);
  });

  it('reports removed and unavailable items', async () => {
    app.menu.deleteItem('pizza');
    app.menu.updateItem('soup', { available: false });
    const response = await post(
      order({
        lines: [
          { itemId: 'pizza', openPrice: false, quantity: 1, unitPrice: 1250 },
          { itemId: 'soup', openPrice: false, quantity: 1, unitPrice: 600 },
        ],
        discount: 0,
      }),
    );
    expect(response.json<ApiErrorBody>().issues).toEqual([
      { itemId: 'pizza', kind: 'removed' },
      { itemId: 'soup', kind: 'unavailable' },
    ]);
  });

  it.each([
    ['an empty order', { lines: [] }],
    ['a zero quantity', { lines: [{ itemId: 'pizza', openPrice: false, quantity: 0, unitPrice: 1250 }] }],
    ['a fractional price', { lines: [{ itemId: 'special', openPrice: true, quantity: 1, unitPrice: 9.5 }] }],
    ['a zero open price', { lines: [{ itemId: 'special', openPrice: true, quantity: 1, unitPrice: 0 }] }],
    ['a discount above the subtotal', { discount: 100_000 }],
    ['an unknown field', { tip: 100 }],
  ])('rejects %s', async (_, overrides) => {
    const response = await post({ ...order(), ...overrides });
    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().code).toBe('VALIDATION');
  });

  it('rejects malformed JSON with the same error shape', async () => {
    const response = await app.server.inject({
      method: 'POST',
      url: '/api/orders',
      headers: { 'content-type': 'application/json' },
      payload: '{"lines": [',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>().code).toBe('VALIDATION');
  });
});

describe('menu API', () => {
  it('does not delete a category that still has items', async () => {
    const response = await app.server.inject({ method: 'DELETE', url: '/api/categories/cat-food' });
    expect(response.statusCode).toBe(409);
    expect(response.json<ApiErrorBody>().code).toBe('CATEGORY_NOT_EMPTY');
    expect((await app.server.inject({ method: 'DELETE', url: '/api/categories/cat-empty' })).statusCode).toBe(204);
  });

  it('clears the price when an item becomes open-price and requires one when it stops', async () => {
    const open = await app.server.inject({ method: 'PATCH', url: '/api/items/pizza', payload: { openPrice: true } });
    expect(open.json()).toMatchObject({ openPrice: true, price: null });

    const fixed = await app.server.inject({ method: 'PATCH', url: '/api/items/pizza', payload: { openPrice: false } });
    expect(fixed.statusCode).toBe(400);
  });

  it('stamps every change with the next global version', async () => {
    const before = app.log.version;
    const created = await app.server.inject({ method: 'POST', url: '/api/categories', payload: { name: 'Drinks' } });
    expect(created.json()).toMatchObject({ name: 'Drinks', sortOrder: 3, rev: before + 1 });
    expect(app.log.version).toBe(before + 1);
  });

  it('answers unknown routes and ids with NOT_FOUND', async () => {
    expect((await app.server.inject({ method: 'GET', url: '/api/nope' })).json<ApiErrorBody>().code).toBe('NOT_FOUND');
    expect((await app.server.inject({ method: 'DELETE', url: '/api/items/nope' })).statusCode).toBe(404);
  });
});

describe('chaos mode', () => {
  it('stores the order but loses the response, and a retry returns that order', async () => {
    const chaotic = await testApp({ chaos: { maxLatencyMs: 0, failureRate: 1 } });
    try {
      const first = await chaotic.server.inject({ method: 'POST', url: '/api/orders', payload: order() });
      expect(first.statusCode).toBe(503);
      expect(chaotic.orders.snapshot().orders).toHaveLength(1);
    } finally {
      await chaotic.server.close();
    }
  });
});
