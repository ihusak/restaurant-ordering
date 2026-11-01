import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { Action } from '@ngrx/store';
import { Subject, defer, of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import type { CreateOrderRequest, Order } from '@shared';
import { ApiService } from '../../core/api.service';
import { menuItem, order, ordersSnapshot } from '../../../testing/fixtures';
import { CartActions } from '../cart/cart.actions';
import { cartFeature, initialCartState } from '../cart/cart.reducer';
import type { CartState } from '../cart/cart.reducer';
import { OrdersActions } from '../orders/orders.actions';
import { initialOrdersState, ordersFeature } from '../orders/orders.reducer';
import { RealtimeActions } from '../realtime/realtime.actions';
import { CheckoutActions } from './checkout.actions';
import { selectCartReview } from './cart-review';
import { placeOrder } from './checkout.effects';

const request: CreateOrderRequest = {
  idempotencyKey: 'key-1',
  lines: [{ itemId: 'pizza', openPrice: false, quantity: 2, unitPrice: 1250 }],
  discount: 0,
};
const apiError = (status: number, body?: object): HttpErrorResponse => new HttpErrorResponse({ status, error: body });

describe('placeOrder effect', () => {
  let actions$: Subject<Action>;
  let results: Action[];
  let placeOrderApi: ReturnType<typeof vi.fn<(request: CreateOrderRequest) => Observable<Order>>>;

  beforeEach(() => {
    vi.useFakeTimers();
    actions$ = new Subject<Action>();
    results = [];
    placeOrderApi = vi.fn<(request: CreateOrderRequest) => Observable<Order>>();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({
          selectors: [
            { selector: cartFeature.selectOrderRequest, value: request },
            { selector: selectCartReview, value: [] },
          ],
        }),
        { provide: ApiService, useValue: { placeOrder: placeOrderApi } },
      ],
    });
    TestBed.runInInjectionContext(placeOrder).subscribe((action) => results.push(action));
  });

  afterEach(() => {
    TestBed.inject(MockStore).resetSelectors();
    vi.useRealTimers();
  });

  /** Like HttpClient: every subscription is a new attempt that gets the next response. */
  const attempts = (...responses: Observable<Order>[]): { count: () => number } => {
    let count = 0;
    placeOrderApi.mockReturnValue(
      defer(() => {
        const response = responses[Math.min(count, responses.length - 1)];
        count++;
        return response ?? throwError(() => new Error('No response'));
      }),
    );
    return { count: () => count };
  };

  const submit = (): void => {
    actions$.next(CheckoutActions.submitted({ newKey: 'ignored' }));
  };

  it('sends the cart with its idempotency key and reports the order', () => {
    const placed = order({ id: 'o1' });
    placeOrderApi.mockReturnValue(of(placed));
    submit();
    expect(placeOrderApi).toHaveBeenCalledWith(request);
    expect(results).toEqual([CheckoutActions.succeeded({ order: placed })]);
  });

  it('ignores clicks while an order is on its way', () => {
    const response = new Subject<Order>();
    placeOrderApi.mockReturnValue(response);
    submit();
    submit();
    submit();
    response.next(order());
    response.complete();
    expect(placeOrderApi).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(1);
  });

  it('retries a lost response with the same key, so the server returns the same order', () => {
    const placed = order({ id: 'o1' });
    const sent = attempts(
      throwError(() => apiError(0)),
      throwError(() => apiError(503, { code: 'UNAVAILABLE', message: 'down' })),
      of(placed),
    );
    submit();
    expect(sent.count()).toBe(1);
    vi.advanceTimersByTime(1_000);
    expect(sent.count()).toBe(2);
    vi.advanceTimersByTime(2_000);
    expect(sent.count()).toBe(3);
    expect(placeOrderApi).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'key-1' }));
    expect(results).toEqual([CheckoutActions.succeeded({ order: placed })]);
  });

  it('gives up after the retries and says the outcome is unknown', () => {
    const sent = attempts(throwError(() => apiError(0)));
    submit();
    vi.advanceTimersByTime(10_000);
    expect(sent.count()).toBe(3);
    expect(results).toEqual([CheckoutActions.failed({ failure: 'unknown', error: expect.stringContaining('will not be placed twice') as string })]);
  });

  it('passes the menu changes from a 409 on, without retrying', () => {
    const issues = [{ itemId: 'pizza', kind: 'price_changed' as const, expected: 1250, actual: 1300 }];
    const sent = attempts(throwError(() => apiError(409, { code: 'MENU_CHANGED', message: 'changed', issues })));
    submit();
    vi.advanceTimersByTime(10_000);
    expect(sent.count()).toBe(1);
    expect(results).toEqual([CheckoutActions.menuChanged({ issues })]);
  });

  it('warns when the key already belongs to an earlier order', () => {
    placeOrderApi.mockReturnValue(throwError(() => apiError(422, { code: 'IDEMPOTENCY_MISMATCH', message: 'used' })));
    submit();
    expect(results).toEqual([CheckoutActions.failed({ failure: 'key-used', error: expect.stringContaining('Check Orders') as string })]);
  });

  it('shows a validation error as it is', () => {
    placeOrderApi.mockReturnValue(throwError(() => apiError(400, { code: 'VALIDATION', message: 'Invalid price for "Special"' })));
    submit();
    expect(results).toEqual([CheckoutActions.failed({ failure: 'rejected', error: 'Invalid price for "Special"' })]);
  });

  it('does nothing without a request', () => {
    TestBed.inject(MockStore).overrideSelector(cartFeature.selectOrderRequest, null);
    TestBed.inject(MockStore).refreshState();
    submit();
    expect(placeOrderApi).not.toHaveBeenCalled();
  });
});

describe('idempotency key in the cart', () => {
  const pizza = menuItem({ id: 'pizza', price: 1250 });
  const reduce = (state: CartState, ...actions: Parameters<typeof cartFeature.reducer>[1][]): CartState =>
    actions.reduce(cartFeature.reducer, state);
  const withPizza = reduce(initialCartState, CartActions.itemAdded({ item: pizza, unitPrice: 1250 }));
  const submitted = reduce(withPizza, CheckoutActions.submitted({ newKey: 'key-1' }));

  it('gets a key on the first attempt and keeps it for the next ones', () => {
    expect(submitted.idempotencyKey).toBe('key-1');
    expect(reduce(submitted, CheckoutActions.submitted({ newKey: 'key-2' })).idempotencyKey).toBe('key-1');
  });

  it('gets a new key when the cart changes after a refused attempt', () => {
    const changed = reduce(
      submitted,
      CheckoutActions.menuChanged({ issues: [] }),
      CartActions.quantityChanged({ lineId: 'pizza', quantity: 3 }),
    );
    expect(changed.idempotencyKey).toBeNull();
  });

  it('keeps the key when the last attempt may have created the order, even if the cart changes', () => {
    const changed = reduce(
      submitted,
      CheckoutActions.failed({ failure: 'unknown', error: '' }),
      CartActions.quantityChanged({ lineId: 'pizza', quantity: 3 }),
    );
    expect(changed).toMatchObject({ idempotencyKey: 'key-1', outcomeUnknown: true });
  });

  it('drops a key that already belongs to another order', () => {
    const state = reduce(submitted, CheckoutActions.failed({ failure: 'key-used', error: '' }));
    expect(state).toMatchObject({ idempotencyKey: null, outcomeUnknown: false });
  });

  it('starts over after a placed order', () => {
    expect(reduce(submitted, CheckoutActions.succeeded({ order: order() }))).toEqual(initialCartState);
  });

  it('builds the request from the cart lines', () => {
    expect(cartFeature.selectOrderRequest({ cart: submitted })).toEqual({
      idempotencyKey: 'key-1',
      lines: [{ itemId: 'pizza', openPrice: false, quantity: 1, unitPrice: 1250 }],
      discount: 0,
    });
  });
});

describe('orders after checkout', () => {
  const loaded = ordersFeature.reducer(initialOrdersState, OrdersActions.loadSucceeded({ snapshot: ordersSnapshot({ version: 5 }) }));
  const placed = order({ id: 'o1', status: 'accepted', rev: 6 });

  it('shows the placed order at once without moving the stream version', () => {
    const state = ordersFeature.reducer(loaded, CheckoutActions.succeeded({ order: placed }));
    expect(state.entities['o1']?.status).toBe('accepted');
    expect(state.version).toBe(5);
  });

  it('keeps a newer status that arrived from the stream first', () => {
    const preparing = order({ id: 'o1', status: 'preparing', rev: 7 });
    const state = [
      RealtimeActions.eventReceived({ event: { type: 'order.upserted', order: preparing, version: 7 } }),
      CheckoutActions.succeeded({ order: placed }),
    ].reduce(ordersFeature.reducer, loaded);
    expect(state.entities['o1']?.status).toBe('preparing');
  });
});
