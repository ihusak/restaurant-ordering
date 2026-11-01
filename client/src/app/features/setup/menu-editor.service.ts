import { Injectable, inject } from '@angular/core';
import { Actions, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import type { Action } from '@ngrx/store';
import { filter, firstValueFrom, map } from 'rxjs';
import { SetupApiActions } from '../../state/menu/setup.actions';

/** Sends a Setup change through the store and waits for the server's answer. */
@Injectable({ providedIn: 'root' })
export class MenuEditor {
  private readonly store = inject(Store);
  private readonly actions$ = inject(Actions);

  /** Resolves with null when the server accepted the change, or with an error message. */
  run(request: (requestId: string) => Action): Promise<string | null> {
    const requestId = crypto.randomUUID();
    const outcome = firstValueFrom(
      this.actions$.pipe(
        ofType(
          SetupApiActions.categorySaved,
          SetupApiActions.categoryDeleted,
          SetupApiActions.itemSaved,
          SetupApiActions.itemDeleted,
          SetupApiActions.requestFailed,
        ),
        filter((action) => action.requestId === requestId),
        map((action) => (action.type === SetupApiActions.requestFailed.type ? action.error : null)),
      ),
    );
    this.store.dispatch(request(requestId));
    return outcome;
  }
}
