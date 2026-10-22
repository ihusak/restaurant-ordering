import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { MenuSnapshot } from '@shared';

export const MenuActions = createActionGroup({
  source: 'Menu',
  events: {
    Load: emptyProps(),
    'Load Succeeded': props<{ snapshot: MenuSnapshot }>(),
    'Load Failed': props<{ error: string }>(),
  },
});
