import { order, ordersSnapshot } from '../../../testing/fixtures';
import { OrdersActions } from './orders.actions';
import { initialOrdersState, ordersFeature } from './orders.reducer';

describe('orders state', () => {
  const snapshot = ordersSnapshot({
    epoch: 'run-7',
    version: 9,
    orders: [
      order({ id: 'a', number: 1001, status: 'completed' }),
      order({ id: 'c', number: 1003, status: 'accepted' }),
      order({ id: 'b', number: 1002, status: 'ready' }),
    ],
  });
  const state = ordersFeature.reducer(initialOrdersState, OrdersActions.loadSucceeded({ snapshot }));
  const root = { orders: state };

  it('stores the snapshot with its epoch and version', () => {
    expect(state).toMatchObject({ epoch: 'run-7', version: 9, status: 'loaded' });
  });

  it('lists the newest orders first', () => {
    expect(ordersFeature.selectAllOrders(root).map((o) => o.number)).toEqual([1003, 1002, 1001]);
  });

  it('counts orders that are not completed yet', () => {
    expect(ordersFeature.selectActiveCount(root)).toBe(2);
  });
});
