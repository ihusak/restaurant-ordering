import { createEntityAdapter } from '@ngrx/entity';
import type { EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import type { Category, MenuItem } from '@shared';
import type { LoadStatus } from '../load-status';
import { MenuActions } from './menu.actions';

export interface MenuState {
  categories: EntityState<Category>;
  items: EntityState<MenuItem>;
  epoch: string | null;
  version: number;
  status: LoadStatus;
  error: string | null;
}

export const categoryAdapter = createEntityAdapter<Category>({
  sortComparer: (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
});
// Items stay unsorted: sorting thousands of entities on every update is wasted work.
export const itemAdapter = createEntityAdapter<MenuItem>();

export const initialMenuState: MenuState = {
  categories: categoryAdapter.getInitialState(),
  items: itemAdapter.getInitialState(),
  epoch: null,
  version: 0,
  status: 'idle',
  error: null,
};

const categorySelectors = categoryAdapter.getSelectors();
const itemSelectors = itemAdapter.getSelectors();

export const menuFeature = createFeature({
  name: 'menu',
  reducer: createReducer(
    initialMenuState,
    on(MenuActions.load, (state): MenuState => ({ ...state, status: 'loading', error: null })),
    on(
      MenuActions.loadSucceeded,
      (state, { snapshot }): MenuState => ({
        categories: categoryAdapter.setAll(snapshot.categories, state.categories),
        items: itemAdapter.setAll(snapshot.items, state.items),
        epoch: snapshot.epoch,
        version: snapshot.version,
        status: 'loaded',
        error: null,
      }),
    ),
    // Data loaded earlier is kept: a failed reload should not empty the screen.
    on(MenuActions.loadFailed, (state, { error }): MenuState => ({ ...state, status: 'error', error })),
  ),
  extraSelectors: ({ selectCategories, selectItems }) => {
    const selectAllCategories = createSelector(selectCategories, categorySelectors.selectAll);
    const selectAllItems = createSelector(selectItems, itemSelectors.selectAll);
    const selectItemEntities = createSelector(selectItems, itemSelectors.selectEntities);

    /** Items grouped by category id. */
    const selectItemsByCategory = createSelector(selectAllItems, (items) => {
      const groups = new Map<string, MenuItem[]>();
      for (const item of items) {
        const group = groups.get(item.categoryId);
        if (group) group.push(item);
        else groups.set(item.categoryId, [item]);
      }
      return groups;
    });

    const selectStats = createSelector(selectAllCategories, selectAllItems, (categories, items) => ({
      categories: categories.length,
      items: items.length,
      available: items.filter((item) => item.available).length,
    }));

    return { selectAllCategories, selectAllItems, selectItemEntities, selectItemsByCategory, selectStats };
  },
});
