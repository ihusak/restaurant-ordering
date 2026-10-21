/**
 * Domain models shared by the server and the client.
 *
 * Money is always an integer amount of cents to avoid floating point errors.
 * Every entity carries `rev`: the global event version of its last change.
 * Clients use it to ignore stale updates (see events.ts).
 */
export type Cents = number;

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  rev: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  openPrice: boolean;
  price: Cents | null;
  available: boolean;
  rev: number;
}

export const ORDER_STATUSES = ['accepted', 'preparing', 'ready', 'completed'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderLine {
  itemId: string;
  name: string;
  openPrice: boolean;
  quantity: number;
  unitPrice: Cents;
  lineTotal: Cents;
}

export interface Order {
  id: string;
  number: number;
  createdAt: string;
  lines: OrderLine[];
  subtotal: Cents;
  discount: Cents;
  total: Cents;
  status: OrderStatus;
  rev: number;
}
