import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiErrorBody, MenuItem, MenuSnapshot, ServerEvent } from '@shared';
import type { App } from '../src/app';
import { generateMenu } from '../src/seed';
import { KitchenSimulator } from '../src/simulators';
import { testApp } from './helpers';

let app: App;
beforeEach(async () => {
  app = await testApp();
});
afterEach(async () => {
  await app.server.close();
});

const newItem = {
  categoryId: 'cat-food',
  name: 'Lasagna',
  description: 'Layers',
  openPrice: false,
  price: 1400,
  available: true,
};

describe('menu items API', () => {
  it('creates an item and announces it on the event stream', async () => {
    const events: ServerEvent[] = [];
    app.log.subscribe((event) => events.push(event));

    const response = await app.server.inject({ method: 'POST', url: '/api/items', payload: newItem });
    expect(response.statusCode).toBe(201);
    const item = response.json<MenuItem>();
    expect(item).toMatchObject({ ...newItem, rev: 1 });
    expect(events).toEqual([{ type: 'item.upserted', item, version: 1 }]);
  });

  it.each([
    ['an unknown category', { categoryId: 'nope' }, 'Category does not exist'],
    ['a fixed-price item without a price', { price: null }, 'needs a positive price'],
    ['a zero price', { price: 0 }, 'needs a positive price'],
    ['a fractional price', { price: 12.5 }, ''],
    ['a blank name', { name: '   ' }, ''],
    ['an unknown field', { calories: 300 }, ''],
  ])('rejects %s', async (_, overrides, message) => {
    const response = await app.server.inject({ method: 'POST', url: '/api/items', payload: { ...newItem, ...overrides } });
    expect(response.statusCode).toBe(400);
    expect(response.json<ApiErrorBody>()).toMatchObject({ code: 'VALIDATION' });
    expect(response.json<ApiErrorBody>().message).toContain(message);
  });

  it('ignores a price sent for an open-price item', async () => {
    const response = await app.server.inject({ method: 'POST', url: '/api/items', payload: { ...newItem, openPrice: true, price: 999 } });
    expect(response.json<MenuItem>()).toMatchObject({ openPrice: true, price: null });
  });

  it('moves an item to another category', async () => {
    const category = await app.server.inject({ method: 'POST', url: '/api/categories', payload: { name: 'Mains' } });
    const id = category.json<{ id: string }>().id;
    const response = await app.server.inject({ method: 'PATCH', url: '/api/items/pizza', payload: { categoryId: id } });
    expect(response.json<MenuItem>().categoryId).toBe(id);
  });

  it('includes every change in the next snapshot', async () => {
    await app.server.inject({ method: 'PATCH', url: '/api/items/pizza', payload: { available: false } });
    await app.server.inject({ method: 'DELETE', url: '/api/items/soup' });
    const snapshot = (await app.server.inject({ method: 'GET', url: '/api/menu' })).json<MenuSnapshot>();
    expect(snapshot.version).toBe(2);
    expect(snapshot.items.map((item) => [item.id, item.available])).toEqual([
      ['pizza', false],
      ['special', true],
    ]);
  });
});

describe('server shutdown', () => {
  it('closes open event streams instead of hanging', async () => {
    const baseUrl = await app.server.listen({ port: 0, host: '127.0.0.1' });
    const response = await fetch(`${baseUrl}/api/events`);
    const reader = response.body?.getReader();
    await reader?.read();

    await app.server.close();
    // The stream ends: the client sees the end and reconnects to the next server.
    let done = false;
    while (!done) done = (await reader?.read())?.done ?? true;
    expect(done).toBe(true);
  });
});

describe('kitchen simulator', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves an order through every status and stops at completed', async () => {
    vi.useFakeTimers();
    const kitchenApp = await testApp({ kitchenStepMs: { min: 1_000, max: 1_000 } });
    try {
      const { order } = kitchenApp.orders.place({
        idempotencyKey: 'kitchen-test',
        lines: [{ itemId: 'pizza', openPrice: false, quantity: 1, unitPrice: 1250 }],
        discount: 0,
      });
      const status = (): string | undefined => kitchenApp.orders.snapshot().orders.find((o) => o.id === order.id)?.status;
      expect(status()).toBe('accepted');
      vi.advanceTimersByTime(1_000);
      expect(status()).toBe('preparing');
      vi.advanceTimersByTime(2_000);
      expect(status()).toBe('completed');
      vi.advanceTimersByTime(10_000);
      expect(status()).toBe('completed');
    } finally {
      await kitchenApp.server.close();
    }
  });

  it('can be stopped with orders still in the kitchen', () => {
    vi.useFakeTimers();
    const kitchen = new KitchenSimulator({ min: 1_000, max: 1_000 });
    kitchen.onOrderCreated({ id: 'x' } as Parameters<KitchenSimulator['onOrderCreated']>[0]);
    kitchen.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('generated menu', () => {
  const menu = generateMenu();

  it('has 3000 items in 24 categories with unique ids and names per category', () => {
    expect(menu.categories).toHaveLength(24);
    expect(menu.items).toHaveLength(3_000);
    expect(new Set(menu.items.map((item) => item.id)).size).toBe(3_000);
    const keys = menu.items.map((item) => `${item.categoryId}/${item.name}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps the price rules: a positive price in whole cents unless the price is open', () => {
    for (const item of menu.items) {
      if (item.openPrice) expect(item.price).toBeNull();
      else expect(Number.isInteger(item.price) && (item.price ?? 0) > 0).toBe(true);
    }
  });

  it('is the same on every start', () => {
    expect(generateMenu()).toEqual(menu);
  });
});
