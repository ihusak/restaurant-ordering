import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideState, provideStore } from '@ngrx/store';
import type { Order } from '@shared';
import { order, ordersSnapshot } from '../../../testing/fixtures';
import { OrdersActions } from '../../state/orders/orders.actions';
import { ordersFeature } from '../../state/orders/orders.reducer';
import { RealtimeActions } from '../../state/realtime/realtime.actions';
import { OrdersPage } from './orders-page';

describe('OrdersPage', () => {
  let fixture: ComponentFixture<OrdersPage>;
  let store: Store;

  const ready = order({
    id: 'a',
    number: 1001,
    status: 'ready',
    total: 2300,
    discount: 200,
    lines: [
      { itemId: 'pizza', name: 'Pizza', openPrice: false, quantity: 2, unitPrice: 1250, lineTotal: 2500 },
    ],
    rev: 3,
  });
  const preparing = order({ id: 'b', number: 1002, status: 'preparing', total: 600, rev: 4 });
  const completed = order({ id: 'c', number: 1000, status: 'completed', total: 900, rev: 2 });

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [OrdersPage],
      providers: [provideRouter([]), provideStore(), provideState(ordersFeature)],
    });
    store = TestBed.inject(Store) as Store;
    fixture = TestBed.createComponent(OrdersPage);
    await fixture.whenStable();
  });

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const titles = (): string[] => [...element().querySelectorAll('.order h2')].map((node) => node.textContent.trim());
  const load = async (orders: Order[]): Promise<void> => {
    store.dispatch(OrdersActions.loadSucceeded({ snapshot: ordersSnapshot({ version: 10, orders }) }));
    await fixture.whenStable();
  };
  const card = (number: number): HTMLElement => {
    const found = [...element().querySelectorAll<HTMLElement>('.order')].find((node) =>
      node.querySelector('h2')?.textContent.includes(`#${number}`),
    );
    if (!found) throw new Error(`No card for order ${number}`);
    return found;
  };

  it('shows placeholders while orders load', () => {
    expect(element().querySelectorAll('.skeleton')).toHaveLength(3);
  });

  it('lists orders in progress, newest first, and all orders on request', async () => {
    await load([ready, preparing, completed]);
    expect(titles()).toEqual(['Order #1002', 'Order #1001']);
    expect(element().querySelector('.filters')?.textContent).toMatch(/Active · 2[\s\S]*All · 3/);

    fixture.componentRef.setInput('show', 'all');
    await fixture.whenStable();
    expect(titles()).toEqual(['Order #1002', 'Order #1001', 'Order #1000']);
  });

  it('shows the status, the progress and the order lines', async () => {
    await load([ready]);
    const ready1001 = card(1001);
    expect(ready1001.querySelector('.status-label')?.textContent).toContain('Ready for pickup');
    expect(ready1001.querySelectorAll('.step.reached')).toHaveLength(3);
    expect(ready1001.querySelector('[aria-current="step"]')?.textContent).toContain('Ready for pickup');
    expect(ready1001.querySelector('.lines')?.textContent).toMatch(/2 × Pizza\s*\$25\.00[\s\S]*Discount\s*−\$2\.00/);
    expect(ready1001.querySelector('.order-total')?.textContent).toBe('$23.00');
  });

  it('moves an order forward when its status changes on the server', async () => {
    await load([preparing]);
    store.dispatch(
      RealtimeActions.eventReceived({ event: { type: 'order.upserted', order: { ...preparing, status: 'ready', rev: 11 }, version: 11 } }),
    );
    await fixture.whenStable();
    expect(card(1002).querySelector('.status-label')?.textContent).toContain('Ready for pickup');

    store.dispatch(
      RealtimeActions.eventReceived({ event: { type: 'order.upserted', order: { ...preparing, status: 'completed', rev: 12 }, version: 12 } }),
    );
    await fixture.whenStable();
    expect(titles()).toEqual([]);
    expect(element().textContent).toContain('No orders in progress.');
  });

  it('shows a new order as soon as it arrives', async () => {
    await load([]);
    store.dispatch(RealtimeActions.eventReceived({ event: { type: 'order.upserted', order: { ...preparing, status: 'accepted', rev: 11 }, version: 11 } }));
    await fixture.whenStable();
    expect(titles()).toEqual(['Order #1002']);
  });
});
