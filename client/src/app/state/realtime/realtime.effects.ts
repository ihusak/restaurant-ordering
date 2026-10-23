import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { EMPTY, filter, fromEvent, map, merge, of, switchMap } from 'rxjs';
import type { Action } from '@ngrx/store';
import { RealtimeService } from '../../core/realtime.service';
import type { RealtimeMessage } from '../../core/realtime.service';
import { MenuActions } from '../menu/menu.actions';
import { OrdersActions } from '../orders/orders.actions';
import { RealtimeActions } from './realtime.actions';
import { selectSyncPoint } from './realtime.selectors';

function toAction(message: RealtimeMessage): Action {
  switch (message.kind) {
    case 'hello':
      return RealtimeActions.connected({ hello: message.hello });
    case 'change':
      return RealtimeActions.eventReceived({ event: message.event });
    case 'resync':
      return RealtimeActions.resyncRequired();
    case 'disconnected':
      return RealtimeActions.disconnected();
  }
}

/** (Re)opens the stream every time fresh snapshots are in place: at startup and after a resync. */
export const streamEvents = createEffect(
  (actions$ = inject(Actions), store = inject(Store), realtime = inject(RealtimeService)) =>
    actions$.pipe(
      ofType(MenuActions.loadSucceeded, OrdersActions.loadSucceeded),
      concatLatestFrom(() => store.select(selectSyncPoint)),
      map(([, point]) => point),
      filter((point) => point !== null),
      switchMap((point) =>
        point === 'mismatch' ? of(RealtimeActions.resyncRequired()) : realtime.stream(point).pipe(map(toAction)),
      ),
    ),
  { functional: true },
);

/** The server cannot replay what was missed: start over from fresh snapshots. */
export const resync = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(RealtimeActions.resyncRequired),
      switchMap(() => of(MenuActions.load(), OrdersActions.load())),
    ),
  { functional: true },
);

export const watchBrowserConnection = createEffect(
  (window = inject(DOCUMENT).defaultView) => {
    if (!window) return EMPTY;
    return merge(of(null), fromEvent(window, 'online'), fromEvent(window, 'offline')).pipe(
      map(() => RealtimeActions.browserStatusChanged({ online: window.navigator.onLine })),
    );
  },
  { functional: true },
);
