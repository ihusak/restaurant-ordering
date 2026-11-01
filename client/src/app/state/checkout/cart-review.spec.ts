import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import type { Action } from '@ngrx/store';
import { Subject } from 'rxjs';
import type { MenuIssue, MenuItem } from '@shared';
import { ApiService } from '../../core/api.service';
import { menuItem, menuSnapshot } from '../../../testing/fixtures';
import { CartActions } from '../cart/cart.actions';
import { cartFeature, initialCartState } from '../cart/cart.reducer';
import type { CartState } from '../cart/cart.reducer';
import { MenuActions } from '../menu/menu.actions';
import { initialMenuState, menuFeature } from '../menu/menu.reducer';
import type { MenuState } from '../menu/menu.reducer';
import { selectCartReview } from './cart-review';
import type { LineIssue } from './cart-review';
import { CheckoutActions } from './checkout.actions';
import { checkoutFeature, initialCheckoutState } from './checkout.reducer';
import type { CheckoutState } from './checkout.reducer';
import { placeOrder } from './checkout.effects';

const pizza = menuItem({ id: 'pizza', name: 'Pizza', price: 1250 });
const soup = menuItem({ id: 'soup', name: 'Soup', price: 600 });
const special = menuItem({ id: 'special', name: 'Special', openPrice: true, price: null });

function cartWith(...adds: [MenuItem, number][]): CartState {
  return adds.reduce(
    (state, [item, unitPrice]) => cartFeature.reducer(state, CartActions.itemAdded({ item, unitPrice })),
    initialCartState,
  );
}
const menuWith = (...items: MenuItem[]): MenuState =>
  menuFeature.reducer(initialMenuState, MenuActions.loadSucceeded({ snapshot: menuSnapshot({ items }) }));
const review = (cart: CartState, menu: MenuState, checkout: CheckoutState = initialCheckoutState): LineIssue[] =>
  selectCartReview.projector(cart.lines, menu.items.entities, menu.epoch, checkout.issues);

describe('selectCartReview', () => {
  const cart = cartWith([pizza, 1250], [soup, 600], [special, 900]);

  it('finds nothing while the cart matches the menu', () => {
    expect(review(cart, menuWith(pizza, soup, special))).toEqual([]);
  });

  it('reports price changes, unavailable and removed items, line by line', () => {
    const menu = menuWith({ ...pizza, price: 1400 }, { ...special, available: false });
    expect(review(cart, menu)).toEqual([
      { lineId: 'pizza', issue: { itemId: 'pizza', kind: 'price_changed', expected: 1250, actual: 1400 } },
      { lineId: 'soup', issue: { itemId: 'soup', kind: 'removed' } },
      { lineId: 'special@900', issue: { itemId: 'special', kind: 'unavailable' } },
    ]);
  });

  it('reports an item whose pricing kind changed', () => {
    const menu = menuWith(pizza, soup, { ...special, openPrice: false, price: 1000 });
    expect(review(cart, menu)).toEqual([
      { lineId: 'special@900', issue: { itemId: 'special', kind: 'pricing_changed', openPrice: false } },
    ]);
  });

  it('says nothing about removed items before the menu was ever loaded', () => {
    expect(review(cart, initialMenuState)).toEqual([]);
  });

  it('also shows what the server reported, until the live menu catches up', () => {
    const issues: MenuIssue[] = [
      { itemId: 'pizza', kind: 'price_changed', expected: 1250, actual: 1300 },
      { itemId: 'special', kind: 'price_changed', expected: 900, actual: 1000 },
    ];
    const checkout = checkoutFeature.reducer(initialCheckoutState, CheckoutActions.menuChanged({ issues }));
    // A price change cannot concern an open-price line, whatever the item id.
    expect(review(cart, menuWith(pizza, soup, special), checkout)).toEqual([{ lineId: 'pizza', issue: issues[0] }]);
  });
});

describe('accepting the changes', () => {
  it('takes the new prices and removes lines that cannot be ordered', () => {
    const cart = cartWith([pizza, 1250], [soup, 600], [special, 900]);
    const issues = review(cart, menuWith({ ...pizza, price: 1400 }, { ...special, available: false }));
    const accepted = cartFeature.reducer(cart, CartActions.changesAccepted({ issues }));
    expect(accepted.lines.map((line) => [line.lineId, line.unitPrice, line.quantity])).toEqual([['pizza', 1400, 1]]);
  });

  it('clears the answer to the previous attempt', () => {
    const refused = checkoutFeature.reducer(initialCheckoutState, CheckoutActions.menuChanged({ issues: [{ itemId: 'pizza', kind: 'removed' }] }));
    expect(checkoutFeature.reducer(refused, CartActions.changesAccepted({ issues: [] }))).toMatchObject({ status: 'idle', issues: [] });
  });
});

describe('placeOrder effect guards', () => {
  let actions$: Subject<Action>;
  let results: Action[];
  const placeOrderApi = vi.fn();

  function run(request: unknown, cartReview: LineIssue[]): void {
    actions$ = new Subject<Action>();
    results = [];
    placeOrderApi.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({
          selectors: [
            { selector: cartFeature.selectOrderRequest, value: request },
            { selector: selectCartReview, value: cartReview },
          ],
        }),
        { provide: ApiService, useValue: { placeOrder: placeOrderApi } },
      ],
    });
    TestBed.runInInjectionContext(placeOrder).subscribe((action) => results.push(action));
    actions$.next(CheckoutActions.submitted({ newKey: 'key' }));
  }

  it('does not send an order with unaccepted menu changes', () => {
    const issue: MenuIssue = { itemId: 'pizza', kind: 'unavailable' };
    run({ idempotencyKey: 'key', lines: [{ itemId: 'pizza', openPrice: false, quantity: 1, unitPrice: 1250 }], discount: 0 }, [
      { lineId: 'pizza', issue },
    ]);
    expect(placeOrderApi).not.toHaveBeenCalled();
    expect(results).toEqual([CheckoutActions.menuChanged({ issues: [issue] })]);
  });

  it('always ends with a result, even for an empty cart', () => {
    run({ idempotencyKey: 'key', lines: [], discount: 0 }, []);
    expect(results).toEqual([CheckoutActions.failed({ failure: 'rejected', error: 'The cart is empty.' })]);
  });
});
