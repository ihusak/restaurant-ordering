import { inject } from '@angular/core';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/http-error';
import { MenuActions } from './menu.actions';

export const loadMenuOnStart = createEffect(
  (actions$ = inject(Actions)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      map(() => MenuActions.load()),
    ),
  { functional: true },
);

export const loadMenu = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(MenuActions.load),
      switchMap(() =>
        api.getMenu().pipe(
          map((snapshot) => MenuActions.loadSucceeded({ snapshot })),
          catchError((error: unknown) => of(MenuActions.loadFailed({ error: errorMessage(error) }))),
        ),
      ),
    ),
  { functional: true },
);
