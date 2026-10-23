import { isDevMode } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import * as menuEffects from './menu/menu.effects';
import { menuFeature } from './menu/menu.reducer';
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
    provideEffects(menuEffects, ordersEffects, realtimeEffects),
    provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() }),
  ];
}
