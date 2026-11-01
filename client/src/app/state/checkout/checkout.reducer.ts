import { createFeature, createReducer, on } from '@ngrx/store';
import type { MenuIssue, Order } from '@shared';
import { CartActions } from '../cart/cart.actions';
import { CheckoutActions } from './checkout.actions';

export interface CheckoutState {
  status: 'idle' | 'submitting' | 'failed' | 'menu-changed';
  error: string | null;
  issues: MenuIssue[];
  /** The order just placed, shown as a confirmation. */
  placed: Order | null;
}

export const initialCheckoutState: CheckoutState = { status: 'idle', error: null, issues: [], placed: null };

export const checkoutFeature = createFeature({
  name: 'checkout',
  reducer: createReducer(
    initialCheckoutState,
    on(CheckoutActions.submitted, (state): CheckoutState => ({ ...state, status: 'submitting', error: null, placed: null })),
    on(CheckoutActions.succeeded, (_, { order }): CheckoutState => ({ ...initialCheckoutState, placed: order })),
    on(CheckoutActions.menuChanged, (state, { issues }): CheckoutState => ({ ...state, status: 'menu-changed', issues })),
    on(CheckoutActions.failed, (state, { error }): CheckoutState => ({ ...state, status: 'failed', error })),
    on(CheckoutActions.confirmationDismissed, (state): CheckoutState => ({ ...state, placed: null })),
    // A new item in the cart starts a new order: the old confirmation is no longer relevant.
    on(CartActions.itemAdded, (state): CheckoutState => (state.placed ? { ...state, placed: null } : state)),
  ),
});
