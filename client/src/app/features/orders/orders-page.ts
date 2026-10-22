import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-orders-page',
  template: `
    <h1>Orders</h1>
    <p>Placed orders with their live status.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersPage {}
