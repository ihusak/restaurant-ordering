import { category, menuItem, menuSnapshot } from '../../../testing/fixtures';
import { MenuActions } from './menu.actions';
import { initialMenuState, menuFeature } from './menu.reducer';
import type { MenuState } from './menu.reducer';

const reduce = (...actions: Parameters<typeof menuFeature.reducer>[1][]): MenuState =>
  actions.reduce(menuFeature.reducer, initialMenuState);

const snapshot = menuSnapshot({
  epoch: 'run-7',
  version: 42,
  categories: [category({ id: 'drinks', name: 'Drinks', sortOrder: 2 }), category({ id: 'food', name: 'Food', sortOrder: 1 })],
  items: [
    menuItem({ id: 'cola', categoryId: 'drinks', available: false }),
    menuItem({ id: 'pizza', categoryId: 'food' }),
    menuItem({ id: 'water', categoryId: 'drinks' }),
  ],
});

describe('menu reducer', () => {
  it('stores the snapshot with its epoch and version', () => {
    const state = reduce(MenuActions.load(), MenuActions.loadSucceeded({ snapshot }));
    expect(state).toMatchObject({ epoch: 'run-7', version: 42, status: 'loaded', error: null });
    expect(state.items.ids).toHaveLength(3);
  });

  it('replaces everything on a reload instead of merging', () => {
    const reloaded = menuSnapshot({ categories: [category({ id: 'food' })], items: [menuItem({ id: 'pizza', categoryId: 'food' })] });
    const state = reduce(MenuActions.loadSucceeded({ snapshot }), MenuActions.loadSucceeded({ snapshot: reloaded }));
    expect(state.items.ids).toEqual(['pizza']);
    expect(state.categories.ids).toEqual(['food']);
  });

  it('keeps loaded data when a reload fails', () => {
    const state = reduce(MenuActions.loadSucceeded({ snapshot }), MenuActions.load(), MenuActions.loadFailed({ error: 'Offline' }));
    expect(state).toMatchObject({ status: 'error', error: 'Offline' });
    expect(state.items.ids).toHaveLength(3);
  });

  it('clears the previous error when loading starts again', () => {
    const state = reduce(MenuActions.loadFailed({ error: 'Offline' }), MenuActions.load());
    expect(state).toMatchObject({ status: 'loading', error: null });
  });
});

describe('menu selectors', () => {
  const root = { menu: reduce(MenuActions.loadSucceeded({ snapshot })) };

  it('orders categories by sortOrder', () => {
    expect(menuFeature.selectAllCategories(root).map((c) => c.id)).toEqual(['food', 'drinks']);
  });

  it('groups items by category', () => {
    const groups = menuFeature.selectItemsByCategory(root);
    expect(groups.get('drinks')?.map((item) => item.id)).toEqual(['cola', 'water']);
    expect(groups.get('food')?.map((item) => item.id)).toEqual(['pizza']);
  });

  it('counts categories, items and available items', () => {
    expect(menuFeature.selectStats(root)).toEqual({ categories: 2, items: 3, available: 2 });
  });
});
