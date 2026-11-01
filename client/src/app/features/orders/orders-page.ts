import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { ORDER_STATUSES } from '@shared';
import type { Cents, Order, OrderStatus } from '@shared';
import { formatCents } from '../../core/money';
import { OrdersActions } from '../../state/orders/orders.actions';
import { ordersFeature } from '../../state/orders/orders.reducer';

export const STATUS_LABELS: Record<OrderStatus, string> = {
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  completed: 'Completed',
};

const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

@Component({
  selector: 'app-orders-page',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './orders-page.html',
  styleUrl: './orders-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {
  private readonly store = inject(Store);
  protected readonly steps = ORDER_STATUSES;
  protected readonly labels = STATUS_LABELS;
  protected readonly skeletonCards = [0, 1, 2];

  /** `?show=all` in the URL; active orders otherwise. */
  readonly show = input<string>();
  protected readonly showAll = computed(() => this.show() === 'all');

  protected readonly status = this.store.selectSignal(ordersFeature.selectStatus);
  protected readonly error = this.store.selectSignal(ordersFeature.selectError);
  private readonly allOrders = this.store.selectSignal(ordersFeature.selectAllOrders);
  private readonly activeOrders = this.store.selectSignal(ordersFeature.selectActiveOrders);
  protected readonly activeCount = computed(() => this.activeOrders().length);
  protected readonly totalCount = computed(() => this.allOrders().length);
  protected readonly orders = computed(() => (this.showAll() ? this.allOrders() : this.activeOrders()));

  protected stepIndex(order: Order): number {
    return ORDER_STATUSES.indexOf(order.status);
  }

  protected time(order: Order): string {
    return time.format(new Date(order.createdAt));
  }

  protected money(cents: Cents): string {
    return formatCents(cents);
  }

  protected reload(): void {
    this.store.dispatch(OrdersActions.load());
  }
}
