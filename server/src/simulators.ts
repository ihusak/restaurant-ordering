import type { Order } from '@shared';
import type { MenuStore } from './menu-store';
import type { OrderStore } from './order-store';

/** Stands in for the kitchen: moves each order through its statuses on a timer. */
export class KitchenSimulator {
  private readonly timers = new Set<NodeJS.Timeout>();
  private orders: OrderStore | undefined;

  constructor(private readonly stepMs: { min: number; max: number }) {}

  attach(orders: OrderStore): void {
    this.orders = orders;
  }

  readonly onOrderCreated = (order: Order): void => {
    if (this.stepMs.max > 0) this.schedule(order.id);
  };

  private schedule(orderId: string): void {
    const delay = this.stepMs.min + Math.random() * (this.stepMs.max - this.stepMs.min);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.orders?.advance(orderId)) this.schedule(orderId);
    }, delay);
    this.timers.add(timer);
  }

  stop(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}

/**
 * Demo mode only: randomly changes prices and availability so live updates
 * can be observed without clicking through the Setup page.
 */
export class MenuChurnSimulator {
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly menu: MenuStore,
    private readonly intervalMs: number,
  ) {}

  start(): void {
    if (this.intervalMs <= 0) return;
    this.timer = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  private tick(): void {
    const items = this.menu.allItems();
    const item = items[Math.floor(Math.random() * items.length)];
    if (!item) return;
    if (item.openPrice || Math.random() < 0.5) {
      this.menu.updateItem(item.id, { available: !item.available });
    } else if (item.price !== null) {
      const factor = Math.random() < 0.5 ? 0.9 : 1.1;
      this.menu.updateItem(item.id, { price: Math.max(50, Math.round((item.price * factor) / 5) * 5) });
    }
  }

  stop(): void {
    clearInterval(this.timer);
  }
}
