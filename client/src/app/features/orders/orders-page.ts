import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { OrdersActions } from '../../state/orders/orders.actions';
import { ordersFeature } from '../../state/orders/orders.reducer';

@Component({
  selector: 'app-orders-page',
  imports: [MatButtonModule, MatProgressBarModule],
  template: `
    <h1>Orders</h1>
    @switch (status()) {
      @case ('loaded') {
        <p>{{ orders().length }} orders, {{ activeCount() }} in progress.</p>
      }
      @case ('error') {
        <p role="alert">{{ error() }}</p>
        <button mat-stroked-button type="button" (click)="reload()">Try again</button>
      }
      @default {
        <mat-progress-bar mode="indeterminate" aria-label="Loading orders" />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {
  private readonly store = inject(Store);
  protected readonly status = this.store.selectSignal(ordersFeature.selectStatus);
  protected readonly error = this.store.selectSignal(ordersFeature.selectError);
  protected readonly orders = this.store.selectSignal(ordersFeature.selectAllOrders);
  protected readonly activeCount = this.store.selectSignal(ordersFeature.selectActiveCount);

  protected reload(): void {
    this.store.dispatch(OrdersActions.load());
  }
}
