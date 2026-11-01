import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { MenuIssue, Order } from '@shared';

/**
 * - `rejected`: the server refused the order and stored nothing.
 * - `unknown`: no answer (network, 5xx): the order may or may not exist.
 * - `key-used`: the key already belongs to another order, placed by an earlier attempt.
 */
export type CheckoutFailure = 'rejected' | 'unknown' | 'key-used';

export const CheckoutActions = createActionGroup({
  source: 'Checkout',
  events: {
    /** `newKey` is used only if the cart has no idempotency key yet. */
    Submitted: props<{ newKey: string }>(),
    Succeeded: props<{ order: Order }>(),
    'Menu Changed': props<{ issues: MenuIssue[] }>(),
    Failed: props<{ failure: CheckoutFailure; error: string }>(),
    'Confirmation Dismissed': emptyProps(),
  },
});
