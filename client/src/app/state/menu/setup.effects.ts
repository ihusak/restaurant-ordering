import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import type { Action } from '@ngrx/store';
import { catchError, map, mergeMap, of } from 'rxjs';
import type { Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { errorMessage } from '../../core/http-error';
import { SetupActions, SetupApiActions } from './setup.actions';

function send<T>(requestId: string, request: Observable<T>, done: (result: T) => Action): Observable<Action> {
  return request.pipe(
    map(done),
    catchError((error: unknown) => of(SetupApiActions.requestFailed({ requestId, error: errorMessage(error) }))),
  );
}

// mergeMap: every request is independent and none may be dropped.
export const saveMenuChanges = createEffect(
  (actions$ = inject(Actions), api = inject(ApiService)) =>
    actions$.pipe(
      ofType(
        SetupActions.createCategory,
        SetupActions.updateCategory,
        SetupActions.deleteCategory,
        SetupActions.createItem,
        SetupActions.updateItem,
        SetupActions.deleteItem,
      ),
      mergeMap((action) => {
        const { requestId } = action;
        switch (action.type) {
          case SetupActions.createCategory.type:
            return send(requestId, api.createCategory(action.input), (category) =>
              SetupApiActions.categorySaved({ requestId, category }),
            );
          case SetupActions.updateCategory.type:
            return send(requestId, api.updateCategory(action.id, action.patch), (category) =>
              SetupApiActions.categorySaved({ requestId, category }),
            );
          case SetupActions.deleteCategory.type:
            return send(requestId, api.deleteCategory(action.id), () =>
              SetupApiActions.categoryDeleted({ requestId, id: action.id }),
            );
          case SetupActions.createItem.type:
            return send(requestId, api.createItem(action.input), (item) => SetupApiActions.itemSaved({ requestId, item }));
          case SetupActions.updateItem.type:
            return send(requestId, api.updateItem(action.id, action.patch), (item) =>
              SetupApiActions.itemSaved({ requestId, item }),
            );
          case SetupActions.deleteItem.type:
            return send(requestId, api.deleteItem(action.id), () => SetupApiActions.itemDeleted({ requestId, id: action.id }));
        }
      }),
    ),
  { functional: true },
);
