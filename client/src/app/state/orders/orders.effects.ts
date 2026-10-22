import { inject } from '@angular/core';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/http-error';
import { OrdersActions } from './orders.actions';

export const loadOrdersOnStart = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => OrdersActions.load()),
    ),
  { functional: true },
);

export const loadOrders = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(OrdersActions.load),
      switchMap(() =>
        api.getOrders().pipe(
          map((snapshot) => OrdersActions.loadSucceeded({ snapshot })),
          catchError((error: unknown) => of(OrdersActions.loadFailed({ error: errorMessage(error) }))),
        ),
      ),
    ),
  { functional: true },
);
