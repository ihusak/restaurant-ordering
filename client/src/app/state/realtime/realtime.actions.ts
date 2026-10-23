import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { HelloEvent, ServerEvent } from '@shared';

export const RealtimeActions = createActionGroup({
  source: 'Realtime',
  events: {
    Connected: props<{ hello: HelloEvent }>(),
    Disconnected: emptyProps(),
    'Event Received': props<{ event: ServerEvent }>(),
    'Resync Required': emptyProps(),
    'Browser Status Changed': props<{ online: boolean }>(),
  },
});
