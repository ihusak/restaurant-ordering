import { createEntityAdapter } from '@ngrx/entity';
import type { EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import type { Order } from '@shared';
import type { LoadStatus } from '../load-status';
import { OrdersActions } from './orders.actions';

export interface OrdersState extends EntityState<Order> {
  epoch: string | null;
  version: number;
  status: LoadStatus;
  error: string | null;
}

/** Newest orders first. */
export const orderAdapter = createEntityAdapter<Order>({ sortComparer: (a, b) => b.number - a.number });

export const initialOrdersState: OrdersState = orderAdapter.getInitialState({
  epoch: null,
  version: 0,
  status: 'idle',
  error: null,
});

const { selectAll } = orderAdapter.getSelectors();

export const ordersFeature = createFeature({
  name: 'orders',
  reducer: createReducer(
    initialOrdersState,
    on(OrdersActions.load, (state): OrdersState => ({ ...state, status: 'loading', error: null })),
    on(
      OrdersActions.loadSucceeded,
      (state, { snapshot }): OrdersState =>
        orderAdapter.setAll(snapshot.orders, {
          ...state,
          epoch: snapshot.epoch,
          version: snapshot.version,
          status: 'loaded',
          error: null,
        }),
    ),
    on(OrdersActions.loadFailed, (state, { error }): OrdersState => ({ ...state, status: 'error', error })),
  ),
  extraSelectors: ({ selectOrdersState }) => {
    const selectAllOrders = createSelector(selectOrdersState, selectAll);
    const selectActiveCount = createSelector(
      selectAllOrders,
      (orders) => orders.filter((order) => order.status !== 'completed').length,
    );
    return { selectAllOrders, selectActiveCount };
  },
});
