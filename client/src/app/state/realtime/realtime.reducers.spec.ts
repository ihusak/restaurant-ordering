import type { ServerEvent } from '@shared';
import { category, menuItem, menuSnapshot, order, ordersSnapshot } from '../../../testing/fixtures';
import { MenuActions } from '../menu/menu.actions';
import { initialMenuState, menuFeature } from '../menu/menu.reducer';
import type { MenuState } from '../menu/menu.reducer';
import { OrdersActions } from '../orders/orders.actions';
import { initialOrdersState, ordersFeature } from '../orders/orders.reducer';
import { connectionFeature, initialConnectionState } from './connection.reducer';
import type { ConnectionState } from './connection.reducer';
import { RealtimeActions } from './realtime.actions';

const received = (event: ServerEvent) => RealtimeActions.eventReceived({ event });

describe('menu reducer with realtime events', () => {
  const loaded: MenuState = menuFeature.reducer(
    initialMenuState,
    MenuActions.loadSucceeded({
      snapshot: menuSnapshot({ version: 10, items: [menuItem({ id: 'pizza', price: 1000, rev: 10 })] }),
    }),
  );
  const price = (state: MenuState): number | null | undefined => state.items.entities['pizza']?.price;

  it('applies a newer item change', () => {
    const state = menuFeature.reducer(
      loaded,
      received({ type: 'item.upserted', item: menuItem({ id: 'pizza', price: 1200, rev: 11 }), version: 11 }),
    );
    expect(price(state)).toBe(1200);
    expect(state.version).toBe(11);
  });

  it('ignores events the snapshot already includes', () => {
    const state = menuFeature.reducer(
      loaded,
      received({ type: 'item.upserted', item: menuItem({ id: 'pizza', price: 900, rev: 9 }), version: 9 }),
    );
    expect(state).toBe(loaded);
  });

  it('ignores an event delivered twice', () => {
    const event = received({ type: 'item.deleted', id: 'pizza', version: 11 });
    const once = menuFeature.reducer(loaded, event);
    const restored = menuFeature.reducer(
      once,
      received({ type: 'item.upserted', item: menuItem({ id: 'pizza', rev: 12 }), version: 12 }),
    );
    expect(menuFeature.reducer(restored, event)).toBe(restored);
  });

  it('adds, updates and removes categories', () => {
    let state = menuFeature.reducer(loaded, received({ type: 'category.upserted', category: category({ id: 'new', rev: 11 }), version: 11 }));
    expect(state.categories.ids).toContain('new');
    state = menuFeature.reducer(state, received({ type: 'category.deleted', id: 'new', version: 12 }));
    expect(state.categories.ids).not.toContain('new');
  });

  it('ignores order events', () => {
    expect(menuFeature.reducer(loaded, received({ type: 'order.upserted', order: order({ rev: 11 }), version: 11 }))).toBe(loaded);
  });

  it('ignores events until a snapshot is loaded', () => {
    const event = received({ type: 'item.upserted', item: menuItem({ rev: 1 }), version: 1 });
    expect(menuFeature.reducer(initialMenuState, event)).toBe(initialMenuState);
  });
});

describe('orders reducer with realtime events', () => {
  const loaded = ordersFeature.reducer(
    initialOrdersState,
    OrdersActions.loadSucceeded({ snapshot: ordersSnapshot({ version: 5, orders: [order({ id: 'a', status: 'accepted', rev: 5 })] }) }),
  );

  it('adds new orders and updates their status', () => {
    let state = ordersFeature.reducer(loaded, received({ type: 'order.upserted', order: order({ id: 'b', number: 1002, rev: 6 }), version: 6 }));
    state = ordersFeature.reducer(state, received({ type: 'order.upserted', order: order({ id: 'a', status: 'ready', rev: 7 }), version: 7 }));
    expect(ordersFeature.selectAllOrders({ orders: state }).map((o) => [o.id, o.status])).toEqual([
      ['b', 'accepted'],
      ['a', 'ready'],
    ]);
  });

  it('ignores a status that is older than the one shown', () => {
    const ready = ordersFeature.reducer(loaded, received({ type: 'order.upserted', order: order({ id: 'a', status: 'ready', rev: 7 }), version: 7 }));
    const stale = received({ type: 'order.upserted', order: order({ id: 'a', status: 'preparing', rev: 6 }), version: 6 });
    expect(ordersFeature.reducer(ready, stale)).toBe(ready);
  });
});

describe('connection reducer', () => {
  const reduce = (...actions: Parameters<typeof connectionFeature.reducer>[1][]): ConnectionState =>
    actions.reduce(connectionFeature.reducer, initialConnectionState);
  const hello = RealtimeActions.connected({ hello: { epoch: 'run-1', version: 0 } });

  it('goes online on hello and reconnecting when the stream drops', () => {
    expect(reduce(hello).status).toBe('online');
    expect(reduce(hello, RealtimeActions.disconnected()).status).toBe('reconnecting');
  });

  it('is offline while the browser has no network, whatever the stream says', () => {
    const offline = RealtimeActions.browserStatusChanged({ online: false });
    expect(reduce(hello, offline).status).toBe('offline');
    expect(reduce(hello, offline, RealtimeActions.disconnected()).status).toBe('offline');
  });

  it('waits for the stream after the network comes back', () => {
    const state = reduce(
      hello,
      RealtimeActions.browserStatusChanged({ online: false }),
      RealtimeActions.browserStatusChanged({ online: true }),
    );
    expect(state.status).toBe('reconnecting');
    expect(connectionFeature.reducer(state, hello).status).toBe('online');
  });
});
