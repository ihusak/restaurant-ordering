import { randomUUID } from 'node:crypto';
import { MAX_OPEN_PRICE, ORDER_STATUSES, computeTotals, findMenuIssue, isValidCents } from '@shared';
import type { CreateOrderRequest, MenuIssue, Order, OrderLine, OrderStatus, OrdersSnapshot } from '@shared';
import { ApiError, notFound } from './errors';
import type { EventLog } from './event-log';
import type { MenuStore } from './menu-store';

export interface PlaceOrderResult {
  order: Order;
  /** True when the idempotency key was already used: nothing new was created. */
  replayed: boolean;
}

export class OrderStore {
  private readonly orders = new Map<string, Order>();
  private readonly byIdempotencyKey = new Map<string, { fingerprint: string; orderId: string }>();
  private nextNumber = 1001;

  constructor(
    private readonly log: EventLog,
    private readonly menu: MenuStore,
    private readonly onCreated: (order: Order) => void = () => undefined,
  ) {}

  snapshot(): OrdersSnapshot {
    const orders = [...this.orders.values()].sort((a, b) => b.number - a.number);
    return { epoch: this.log.epoch, version: this.log.version, orders };
  }

  place(request: CreateOrderRequest): PlaceOrderResult {
    const fingerprint = JSON.stringify({ lines: request.lines, discount: request.discount });
    const previous = this.byIdempotencyKey.get(request.idempotencyKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) {
        throw new ApiError(422, 'IDEMPOTENCY_MISMATCH', 'This idempotency key was already used for a different order');
      }
      const order = this.orders.get(previous.orderId);
      if (!order) throw notFound('Order');
      return { order, replayed: true };
    }

    const issues: MenuIssue[] = [];
    const lines: OrderLine[] = [];
    for (const line of request.lines) {
      const item = this.menu.findItem(line.itemId);
      const issue = findMenuIssue(item, line);
      if (issue) {
        issues.push(issue);
      } else if (item?.openPrice && !isValidCents(line.unitPrice, MAX_OPEN_PRICE)) {
        throw new ApiError(400, 'VALIDATION', `Invalid price for "${item.name}"`);
      } else if (item) {
        lines.push({
          itemId: item.id,
          name: item.name,
          openPrice: item.openPrice,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.quantity * line.unitPrice,
        });
      }
    }
    // Nothing is stored on a conflict, so the client can retry with the same key once the user confirms.
    if (issues.length > 0) {
      throw new ApiError(409, 'MENU_CHANGED', 'Some items changed since they were added to the cart', issues);
    }

    const totals = computeTotals(lines, request.discount);
    if (totals.discount !== request.discount) {
      throw new ApiError(400, 'VALIDATION', 'The discount cannot exceed the order subtotal');
    }

    const order: Order = {
      id: randomUUID(),
      number: this.nextNumber++,
      createdAt: new Date().toISOString(),
      lines,
      ...totals,
      status: 'accepted',
      rev: this.log.next(),
    };
    this.orders.set(order.id, order);
    this.byIdempotencyKey.set(request.idempotencyKey, { fingerprint, orderId: order.id });
    this.log.publish(order.rev, { type: 'order.upserted', order });
    this.onCreated(order);
    return { order, replayed: false };
  }

  /** Moves the order to its next status; returns the new status or null when it is final. */
  advance(id: string): OrderStatus | null {
    const order = this.orders.get(id);
    if (!order) return null;
    const next = ORDER_STATUSES[ORDER_STATUSES.indexOf(order.status) + 1];
    if (!next) return null;
    const updated: Order = { ...order, status: next, rev: this.log.next() };
    this.orders.set(id, updated);
    this.log.publish(updated.rev, { type: 'order.upserted', order: updated });
    return next;
  }
}
