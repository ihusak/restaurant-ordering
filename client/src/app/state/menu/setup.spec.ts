import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import type { Action } from '@ngrx/store';
import { Subject, of, throwError } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { category, menuItem, menuSnapshot, requestIdOf } from '../../../testing/fixtures';
import { RealtimeActions } from '../realtime/realtime.actions';
import { MenuActions } from './menu.actions';
import { initialMenuState, menuFeature } from './menu.reducer';
import { SetupActions, SetupApiActions } from './setup.actions';
import { saveMenuChanges } from './setup.effects';

describe('saveMenuChanges effect', () => {
  let actions$: Subject<Action>;
  const api = {
    createCategory: vi.fn(),
    updateItem: vi.fn(),
    deleteCategory: vi.fn(),
  };

  beforeEach(() => {
    actions$ = new Subject<Action>();
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [provideMockActions(() => actions$), { provide: ApiService, useValue: api }],
    });
  });

  const collect = (): Action[] => {
    const results: Action[] = [];
    TestBed.runInInjectionContext(saveMenuChanges).subscribe((action) => results.push(action));
    return results;
  };

  it('reports the saved entity with the request id', () => {
    const saved = category({ id: 'new', name: 'Drinks', rev: 5 });
    api.createCategory.mockReturnValue(of(saved));
    const results = collect();
    actions$.next(SetupActions.createCategory({ requestId: 'r1', input: { name: 'Drinks' } }));
    expect(api.createCategory).toHaveBeenCalledWith({ name: 'Drinks' });
    expect(results).toEqual([SetupApiActions.categorySaved({ requestId: 'r1', category: saved })]);
  });

  it('reports the server message when a request fails', () => {
    const error = new HttpErrorResponse({ status: 409, error: { code: 'CATEGORY_NOT_EMPTY', message: 'Move the items first' } });
    api.deleteCategory.mockReturnValue(throwError(() => error));
    const results = collect();
    actions$.next(SetupActions.deleteCategory({ requestId: 'r2', id: 'cat-1' }));
    expect(results).toEqual([SetupApiActions.requestFailed({ requestId: 'r2', error: 'Move the items first' })]);
  });

  it('handles requests independently, so a slow one does not cancel another', () => {
    const slow = new Subject<ReturnType<typeof menuItem>>();
    api.updateItem.mockReturnValueOnce(slow).mockReturnValueOnce(of(menuItem({ id: 'b' })));
    const results = collect();
    actions$.next(SetupActions.updateItem({ requestId: 'a', id: 'a', patch: { available: false } }));
    actions$.next(SetupActions.updateItem({ requestId: 'b', id: 'b', patch: { available: false } }));
    slow.next(menuItem({ id: 'a' }));
    expect(results.map(requestIdOf)).toEqual(['b', 'a']);
  });
});

describe('menu reducer with Setup results', () => {
  const loaded = menuFeature.reducer(
    initialMenuState,
    MenuActions.loadSucceeded({ snapshot: menuSnapshot({ version: 10, items: [menuItem({ id: 'pizza', price: 1000, rev: 10 })] }) }),
  );
  const price = (state: typeof loaded): number | null | undefined => state.items.entities['pizza']?.price;

  it('shows a saved item at once without moving the stream version', () => {
    const state = menuFeature.reducer(loaded, SetupApiActions.itemSaved({ requestId: 'r', item: menuItem({ id: 'pizza', price: 1500, rev: 12 }) }));
    expect(price(state)).toBe(1500);
    expect(state.version).toBe(10);
  });

  it('keeps the newer copy when the response and the event arrive in either order', () => {
    const newer = menuItem({ id: 'pizza', price: 1500, rev: 12 });
    const older = menuItem({ id: 'pizza', price: 1200, rev: 11 });

    const eventFirst = [
      RealtimeActions.eventReceived({ event: { type: 'item.upserted', item: newer, version: 12 } }),
      SetupApiActions.itemSaved({ requestId: 'r', item: older }),
    ].reduce(menuFeature.reducer, loaded);
    expect(price(eventFirst)).toBe(1500);

    const responseFirst = [
      SetupApiActions.itemSaved({ requestId: 'r', item: newer }),
      RealtimeActions.eventReceived({ event: { type: 'item.upserted', item: older, version: 11 } }),
    ].reduce(menuFeature.reducer, loaded);
    expect(price(responseFirst)).toBe(1500);
    expect(responseFirst.version).toBe(11);
  });

  it('removes a deleted item', () => {
    const state = menuFeature.reducer(loaded, SetupApiActions.itemDeleted({ requestId: 'r', id: 'pizza' }));
    expect(state.items.ids).toEqual([]);
  });
});
