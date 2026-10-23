import { createSelector } from '@ngrx/store';
import type { SyncPoint } from '../../core/realtime.service';
import { menuFeature } from '../menu/menu.reducer';
import { ordersFeature } from '../orders/orders.reducer';

/**
 * Where the stream should start once both snapshots are loaded: the older of
 * the two versions, so neither slice misses an event (the newer one skips the
 * events it already has). Snapshots from different server runs cannot be combined.
 */
export const selectSyncPoint = createSelector(
  menuFeature.selectMenuState,
  ordersFeature.selectOrdersState,
  (menu, orders): SyncPoint | 'mismatch' | null => {
    if (menu.status !== 'loaded' || orders.status !== 'loaded' || !menu.epoch || !orders.epoch) return null;
    if (menu.epoch !== orders.epoch) return 'mismatch';
    return { epoch: menu.epoch, version: Math.min(menu.version, orders.version) };
  },
);
