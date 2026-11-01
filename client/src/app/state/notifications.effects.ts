import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { filter, map, switchMap } from 'rxjs';
import { Notifier } from '../core/notifier.service';
import { MenuActions } from './menu/menu.actions';
import { menuFeature } from './menu/menu.reducer';
import { OrdersActions } from './orders/orders.actions';
import { ordersFeature } from './orders/orders.reducer';

/*
 * A failed first load is shown on the page itself, with a retry button.
 * A failed refresh keeps the old data on screen, so it needs a message of its own.
 */

export const menuRefreshFailed = createEffect(
  (actions$ = inject(Actions), store = inject(Store), notifier = inject(Notifier)) =>
    actions$.pipe(
      ofType(MenuActions.loadFailed),
      concatLatestFrom(() => store.select(menuFeature.selectEpoch)),
      filter(([, epoch]) => epoch !== null),
      switchMap(([{ error }]) => notifier.show(`Could not refresh the menu. ${error}`, 'Retry')),
      map(() => MenuActions.load()),
    ),
  { functional: true },
);

export const ordersRefreshFailed = createEffect(
  (actions$ = inject(Actions), store = inject(Store), notifier = inject(Notifier)) =>
    actions$.pipe(
      ofType(OrdersActions.loadFailed),
      concatLatestFrom(() => store.select(ordersFeature.selectEpoch)),
      filter(([, epoch]) => epoch !== null),
      switchMap(([{ error }]) => notifier.show(`Could not refresh the orders. ${error}`, 'Retry')),
      map(() => OrdersActions.load()),
    ),
  { functional: true },
);
