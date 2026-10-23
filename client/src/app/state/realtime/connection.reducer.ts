import { createFeature, createReducer, on } from '@ngrx/store';
import { RealtimeActions } from './realtime.actions';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline';

export interface ConnectionState {
  status: ConnectionStatus;
  browserOnline: boolean;
}

export const initialConnectionState: ConnectionState = { status: 'connecting', browserOnline: true };

export const connectionFeature = createFeature({
  name: 'connection',
  reducer: createReducer(
    initialConnectionState,
    on(RealtimeActions.connected, (state): ConnectionState => ({ ...state, status: 'online' })),
    on(
      RealtimeActions.disconnected,
      RealtimeActions.resyncRequired,
      (state): ConnectionState => ({ ...state, status: state.browserOnline ? 'reconnecting' : 'offline' }),
    ),
    on(RealtimeActions.browserStatusChanged, (state, { online }): ConnectionState => {
      if (!online) return { browserOnline: false, status: 'offline' };
      // Back online does not mean the stream is back: wait for its hello.
      return { browserOnline: true, status: state.status === 'offline' ? 'reconnecting' : state.status };
    }),
  ),
});
