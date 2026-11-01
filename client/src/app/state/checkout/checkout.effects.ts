import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import type { Action } from '@ngrx/store';
import { catchError, exhaustMap, map, of, retry, throwError, timer } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { errorMessage, isApiErrorBody, isTransient } from '../../core/http-error';
import { cartFeature } from '../cart/cart.reducer';
import { selectCartReview } from './cart-review';
import { CheckoutActions } from './checkout.actions';

const CHECKOUT_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

function toFailure(error: unknown): Action {
  if (error instanceof HttpErrorResponse && isApiErrorBody(error.error)) {
    const body = error.error;
    if (body.code === 'MENU_CHANGED') return CheckoutActions.menuChanged({ issues: body.issues ?? [] });
    if (body.code === 'IDEMPOTENCY_MISMATCH') {
      return CheckoutActions.failed({
        failure: 'key-used',
        error: 'An earlier attempt may already have placed this order. Check Orders before ordering again.',
      });
    }
  }
  if (isTransient(error)) {
    return CheckoutActions.failed({
      failure: 'unknown',
      error: 'We could not confirm the order. Try again: it will not be placed twice.',
    });
  }
  return CheckoutActions.failed({ failure: 'rejected', error: errorMessage(error) });
}

export const placeOrder = createEffect(
  (actions$ = inject(Actions), store = inject(Store), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(CheckoutActions.submitted),
      // The reducer has already put the key into the cart, so the request carries it.
      concatLatestFrom(() => [store.select(cartFeature.selectOrderRequest), store.select(selectCartReview)]),
      // While an order is on its way, more clicks are ignored rather than queued.
      exhaustMap(([, request, review]) => {
        // Every submit must end with a result action, or the screen would wait forever.
        if (!request || request.lines.length === 0) {
          return of(CheckoutActions.failed({ failure: 'rejected', error: 'The cart is empty.' }));
        }
        // The user has to see and accept menu changes before the order goes out.
        if (review.length > 0) return of(CheckoutActions.menuChanged({ issues: review.map(({ issue }) => issue) }));
        return api.placeOrder(request).pipe(
          // Safe to repeat: the same key gives back the same order.
          retry({
            count: CHECKOUT_RETRIES,
            delay: (error: unknown, attempt) =>
              isTransient(error) ? timer(RETRY_DELAY_MS * 2 ** (attempt - 1)) : throwError(() => error),
          }),
          map((order) => CheckoutActions.succeeded({ order })),
          catchError((error: unknown) => of(toFailure(error))),
        );
      }),
    ),
  { functional: true },
);
