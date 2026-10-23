import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { Action } from '@ngrx/store';
import { NEVER, Subject, toArray } from 'rxjs';
import type { Observable } from 'rxjs';
import { RealtimeService } from '../../core/realtime.service';
import type { SyncPoint } from '../../core/realtime.service';
import { menuSnapshot, ordersSnapshot } from '../../../testing/fixtures';
import { MenuActions } from '../menu/menu.actions';
import { initialMenuState, menuFeature } from '../menu/menu.reducer';
import { OrdersActions } from '../orders/orders.actions';
import { initialOrdersState, ordersFeature } from '../orders/orders.reducer';
import { RealtimeActions } from './realtime.actions';
import { resync, streamEvents } from './realtime.effects';
import { selectSyncPoint } from './realtime.selectors';

describe('realtime effects', () => {
  let actions$: Subject<Action>;
  let store: MockStore;
  let stream: ReturnType<typeof vi.fn<(point: SyncPoint) => Observable<never>>>;

  beforeEach(() => {
    actions$ = new Subject<Action>();
    stream = vi.fn<(point: SyncPoint) => Observable<never>>(() => NEVER);
    TestBed.configureTestingModule({
      providers: [provideMockActions(() => actions$), provideMockStore(), { provide: RealtimeService, useValue: { stream } }],
    });
    store = TestBed.inject(MockStore) as MockStore;
  });

  const run = <T>(effect: () => Observable<T>): Observable<T> => TestBed.runInInjectionContext(effect);
  const loaded = MenuActions.loadSucceeded({ snapshot: menuSnapshot() });

  it('waits until both snapshots are loaded', () => {
    store.overrideSelector(selectSyncPoint, null);
    run(streamEvents).subscribe();
    actions$.next(loaded);
    expect(stream).not.toHaveBeenCalled();
  });

  it('opens the stream from the sync point and reopens it after a reload', () => {
    store.overrideSelector(selectSyncPoint, { epoch: 'run-1', version: 3 });
    run(streamEvents).subscribe();
    actions$.next(loaded);
    store.overrideSelector(selectSyncPoint, { epoch: 'run-2', version: 0 });
    store.refreshState();
    actions$.next(OrdersActions.loadSucceeded({ snapshot: ordersSnapshot() }));
    expect(stream.mock.calls.map(([point]) => point)).toEqual([
      { epoch: 'run-1', version: 3 },
      { epoch: 'run-2', version: 0 },
    ]);
  });

  it('asks for a resync when the snapshots come from different server runs', () => {
    store.overrideSelector(selectSyncPoint, 'mismatch');
    const results: Action[] = [];
    run(streamEvents).subscribe((action) => results.push(action));
    actions$.next(loaded);
    expect(results).toEqual([RealtimeActions.resyncRequired()]);
    expect(stream).not.toHaveBeenCalled();
  });

  it('reloads both snapshots on resync', async () => {
    const result = new Promise<Action[]>((resolve) => {
      run(resync).pipe(toArray()).subscribe(resolve);
    });
    actions$.next(RealtimeActions.resyncRequired());
    actions$.complete();
    expect(await result).toEqual([MenuActions.load(), OrdersActions.load()]);
  });
});

describe('selectSyncPoint', () => {
  const menu = (epoch: string, version: number) =>
    menuFeature.reducer(initialMenuState, MenuActions.loadSucceeded({ snapshot: menuSnapshot({ epoch, version }) }));
  const orders = (epoch: string, version: number) =>
    ordersFeature.reducer(initialOrdersState, OrdersActions.loadSucceeded({ snapshot: ordersSnapshot({ epoch, version }) }));

  it('starts from the older snapshot', () => {
    expect(selectSyncPoint.projector(menu('run-1', 10), orders('run-1', 7))).toEqual({ epoch: 'run-1', version: 7 });
  });

  it('is not ready while a snapshot is loading', () => {
    const reloading = ordersFeature.reducer(orders('run-1', 7), OrdersActions.load());
    expect(selectSyncPoint.projector(menu('run-1', 10), reloading)).toBeNull();
  });

  it('reports snapshots from different server runs', () => {
    expect(selectSyncPoint.projector(menu('run-1', 10), orders('run-2', 0))).toBe('mismatch');
  });
});
