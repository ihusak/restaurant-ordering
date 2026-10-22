import type { Category, MenuItem, MenuSnapshot, Order, OrdersSnapshot } from '@shared';

export function category(overrides: Partial<Category> = {}): Category {
  return { id: 'cat-1', name: 'Pizza', sortOrder: 1, rev: 0, ...overrides };
}

export function menuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'item-1',
    categoryId: 'cat-1',
    name: 'Margherita',
    description: '',
    openPrice: false,
    price: 1250,
    available: true,
    rev: 0,
    ...overrides,
  };
}

export function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    number: 1001,
    createdAt: '2026-10-22T12:00:00.000Z',
    lines: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    status: 'accepted',
    rev: 1,
    ...overrides,
  };
}

export function menuSnapshot(overrides: Partial<MenuSnapshot> = {}): MenuSnapshot {
  return { epoch: 'epoch-1', version: 0, categories: [category()], items: [menuItem()], ...overrides };
}

export function ordersSnapshot(overrides: Partial<OrdersSnapshot> = {}): OrdersSnapshot {
  return { epoch: 'epoch-1', version: 0, orders: [], ...overrides };
}
