import { isDevMode } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import * as cartEffects from './cart/cart.effects';
import { cartFeature } from './cart/cart.reducer';
import { loadCart } from './cart/cart.storage';
import * as checkoutEffects from './checkout/checkout.effects';
import { checkoutFeature } from './checkout/checkout.reducer';
import * as menuEffects from './menu/menu.effects';
import * as notificationEffects from './notifications.effects';
import { menuFeature } from './menu/menu.reducer';
import * as setupEffects from './menu/setup.effects';
import * as ordersEffects from './orders/orders.effects';
import { ordersFeature } from './orders/orders.reducer';
import { connectionFeature } from './realtime/connection.reducer';
import * as realtimeEffects from './realtime/realtime.effects';

export function provideAppState(): EnvironmentProviders[] {
  return [
    provideStore(),
    provideState(menuFeature),
    provideState(ordersFeature),
    provideState(connectionFeature),
    provideState(cartFeature.name, cartFeature.reducer, { initialState: loadCart }),
    provideState(checkoutFeature),
    provideEffects(menuEffects, setupEffects, ordersEffects, realtimeEffects, cartEffects, checkoutEffects, notificationEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
  ];
}
