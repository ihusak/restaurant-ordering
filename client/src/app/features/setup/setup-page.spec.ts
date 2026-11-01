import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Store, provideState, provideStore } from '@ngrx/store';
import type { Action } from '@ngrx/store';
import { category, menuItem, menuSnapshot } from '../../../testing/fixtures';
import { MenuActions } from '../../state/menu/menu.actions';
import { menuFeature } from '../../state/menu/menu.reducer';
import { SetupApiActions } from '../../state/menu/setup.actions';
import { MenuEditor } from './menu-editor.service';
import { SetupPage } from './setup-page';

describe('SetupPage', () => {
  let fixture: ComponentFixture<SetupPage>;
  let store: Store;
  let sent: Action[];
  let answer: (error: string | null) => void;

  beforeEach(async () => {
    sent = [];
    TestBed.configureTestingModule({
      imports: [SetupPage],
      providers: [
        provideRouter([]),
        provideStore(),
        provideState(menuFeature),
        {
          provide: MenuEditor,
          useValue: {
            run: (request: (requestId: string) => Action) => {
              sent.push(request('req'));
              return new Promise<string | null>((resolve) => (answer = resolve));
            },
          },
        },
      ],
    });
    store = TestBed.inject(Store) as Store;
    store.dispatch(
      MenuActions.loadSucceeded({
        snapshot: menuSnapshot({
          categories: [category({ id: 'food', name: 'Food', sortOrder: 1 }), category({ id: 'empty', name: 'Empty', sortOrder: 2 })],
          items: [menuItem({ id: 'pizza', categoryId: 'food', name: 'Pizza', available: true, rev: 1 })],
        }),
      }),
    );
    fixture = TestBed.createComponent(SetupPage);
    await fixture.whenStable();
  });

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  /** Lets the awaited request finish and the view update. */
  const settle = async (): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const toggle = (): HTMLButtonElement => {
    const found = element().querySelector<HTMLButtonElement>('.availability button');
    if (!found) throw new Error('No availability toggle');
    return found;
  };
  const deleteCategoryButton = (): HTMLButtonElement | null =>
    element().querySelector('button[aria-label="Delete category"]');

  it('lists the items of the first category with their prices', () => {
    expect(element().querySelector('.item-name')?.textContent).toBe('Pizza');
    expect(element().querySelector('.item-price')?.textContent).toBe('$12.50');
  });

  it('switches availability in place and locks the toggle until the server answers', async () => {
    toggle().click();
    await fixture.whenStable();
    expect(sent).toEqual([expect.objectContaining({ type: '[Setup] Update Item', id: 'pizza', patch: { available: false } })]);
    expect(toggle().disabled).toBe(true);
    expect(toggle().getAttribute('aria-checked')).toBe('false');

    store.dispatch(SetupApiActions.itemSaved({ requestId: 'req', item: menuItem({ id: 'pizza', categoryId: 'food', available: false, rev: 2 }) }));
    answer(null);
    await settle();
    expect(toggle().disabled).toBe(false);
    expect(toggle().getAttribute('aria-checked')).toBe('false');
  });

  it('puts the toggle back when the server refuses', async () => {
    toggle().click();
    await fixture.whenStable();
    answer('Item not found');
    await settle();
    expect(toggle().getAttribute('aria-checked')).toBe('true');
    expect(toggle().disabled).toBe(false);
  });

  it('only lets an empty category be deleted', async () => {
    expect(deleteCategoryButton()?.disabled).toBe(true);
    store.dispatch(SetupApiActions.itemDeleted({ requestId: 'r', id: 'pizza' }));
    await fixture.whenStable();
    expect(deleteCategoryButton()?.disabled).toBe(false);
  });
});
