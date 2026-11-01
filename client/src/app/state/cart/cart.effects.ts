import { inject } from '@angular/core';
import { createEffect } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { distinctUntilChanged, skip, tap } from 'rxjs';
import { cartFeature } from './cart.reducer';
import { saveCart } from './cart.storage';

export const persistCart = createEffect(
  (store = inject(Store)) =>
    store.select(cartFeature.selectCartState).pipe(
      distinctUntilChanged(),
      // The first value is what was just loaded from storage.
      skip(1),
      tap((cart) => {
        saveCart(cart);
      }),
    ),
  { functional: true, dispatch: false },
);
