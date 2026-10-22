import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { OrdersSnapshot } from '@shared';

export const OrdersActions = createActionGroup({
  source: 'Orders',
  events: {
    Load: emptyProps(),
    'Load Succeeded': props<{ snapshot: OrdersSnapshot }>(),
    'Load Failed': props<{ error: string }>(),
  },
});
