import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { ROOT_EFFECTS_INIT } from '@ngrx/effects';
import type { Action } from '@ngrx/store';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import type { MenuSnapshot } from '@shared';
import { ApiService } from '../../core/api.service';
import { menuSnapshot } from '../../../testing/fixtures';
import { MenuActions } from './menu.actions';
import { loadMenu, loadMenuOnStart } from './menu.effects';

describe('menu effects', () => {
  let actions$: Subject<Action>;
  let getMenu: ReturnType<typeof vi.fn<() => Observable<MenuSnapshot>>>;

  beforeEach(() => {
    actions$ = new Subject<Action>();
    getMenu = vi.fn<() => Observable<MenuSnapshot>>();
    TestBed.configureTestingModule({
      providers: [provideMockActions(() => actions$), { provide: ApiService, useValue: { getMenu } }],
    });
  });

  const run = <T>(effect: () => Observable<T>): Observable<T> => TestBed.runInInjectionContext(effect);

  it('loads the menu when the app starts', async () => {
    const result = firstValueFrom(run(loadMenuOnStart));
    actions$.next({ type: ROOT_EFFECTS_INIT });
    expect(await result).toEqual(MenuActions.load());
  });

  it('turns the response into loadSucceeded', async () => {
    const snapshot = menuSnapshot();
    getMenu.mockReturnValue(of(snapshot));
    const result = firstValueFrom(run(loadMenu));
    actions$.next(MenuActions.load());
    expect(await result).toEqual(MenuActions.loadSucceeded({ snapshot }));
  });

  it('turns a failure into a readable message and keeps working', () => {
    getMenu.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })));
    getMenu.mockReturnValueOnce(of(menuSnapshot()));
    const results: Action[] = [];
    run(loadMenu).subscribe((action) => results.push(action));

    actions$.next(MenuActions.load());
    actions$.next(MenuActions.load());

    expect(results).toEqual([
      MenuActions.loadFailed({ error: 'The server is unreachable. Check your connection.' }),
      MenuActions.loadSucceeded({ snapshot: menuSnapshot() }),
    ]);
  });

  it('ignores the response of a load that was replaced by a newer one', () => {
    const first = new Subject<MenuSnapshot>();
    const second = new Subject<MenuSnapshot>();
    getMenu.mockReturnValueOnce(first).mockReturnValueOnce(second);
    const results: Action[] = [];
    run(loadMenu).subscribe((action) => results.push(action));

    actions$.next(MenuActions.load());
    actions$.next(MenuActions.load());
    first.next(menuSnapshot({ version: 1 }));
    second.next(menuSnapshot({ version: 2 }));

    expect(results).toEqual([MenuActions.loadSucceeded({ snapshot: menuSnapshot({ version: 2 }) })]);
  });
});
