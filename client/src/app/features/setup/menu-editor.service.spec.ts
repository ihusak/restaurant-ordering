import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { Action } from '@ngrx/store';
import { Subject } from 'rxjs';
import { category, requestIdOf } from '../../../testing/fixtures';
import { SetupActions, SetupApiActions } from '../../state/menu/setup.actions';
import { MenuEditor } from './menu-editor.service';

describe('MenuEditor', () => {
  let actions$: Subject<Action>;
  let dispatched: Action[];
  let editor: MenuEditor;

  beforeEach(() => {
    actions$ = new Subject<Action>();
    TestBed.configureTestingModule({ providers: [provideMockActions(() => actions$), provideMockStore()] });
    const store = TestBed.inject(MockStore) as MockStore;
    dispatched = [];
    store.scannedActions$.subscribe((action) => dispatched.push(action));
    editor = TestBed.inject(MenuEditor);
  });

  const lastRequestId = (): string => requestIdOf(dispatched.at(-1));

  it('resolves with null once its own request succeeded', async () => {
    const result = editor.run((requestId) => SetupActions.createCategory({ requestId, input: { name: 'Drinks' } }));
    const requestId = lastRequestId();
    actions$.next(SetupApiActions.requestFailed({ requestId: 'someone-else', error: 'Not mine' }));
    actions$.next(SetupApiActions.categorySaved({ requestId, category: category() }));
    expect(await result).toBeNull();
  });

  it('resolves with the error message when its request failed', async () => {
    const result = editor.run((requestId) => SetupActions.deleteItem({ requestId, id: 'pizza' }));
    actions$.next(SetupApiActions.requestFailed({ requestId: lastRequestId(), error: 'Item not found' }));
    expect(await result).toBe('Item not found');
  });
});
