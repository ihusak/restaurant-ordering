import { createEntityAdapter } from '@ngrx/entity';
import type { EntityAdapter, EntityState } from '@ngrx/entity';
import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import type { Category, MenuItem, ServerEvent } from '@shared';
import type { LoadStatus } from '../load-status';
import { RealtimeActions } from '../realtime/realtime.actions';
import { MenuActions } from './menu.actions';
import { SetupApiActions } from './setup.actions';

export interface MenuState {
  categories: EntityState<Category>;
  items: EntityState<MenuItem>;
  epoch: string | null;
  /** Version of the snapshot or of the last applied event: anything older is already included. */
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

/**
 * Keeps whichever copy is newer: the same change can arrive twice, once in the
 * REST response and once from the event stream, in either order.
 */
function setNewer<T extends { id: string; rev: number }>(adapter: EntityAdapter<T>, entity: T, state: EntityState<T>): EntityState<T> {
  const existing = state.entities[entity.id];
  return existing && existing.rev >= entity.rev ? state : adapter.setOne(entity, state);
}

function applyMenuEvent(state: MenuState, event: ServerEvent): MenuState {
  switch (event.type) {
    case 'category.upserted':
      return { ...state, categories: setNewer(categoryAdapter, event.category, state.categories) };
    case 'category.deleted':
      return { ...state, categories: categoryAdapter.removeOne(event.id, state.categories) };
    case 'item.upserted':
      return { ...state, items: setNewer(itemAdapter, event.item, state.items) };
    case 'item.deleted':
      return { ...state, items: itemAdapter.removeOne(event.id, state.items) };
    default:
      return state;
  }
}

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
    on(RealtimeActions.eventReceived, (state, { event }): MenuState => {
      if (state.epoch === null || event.version <= state.version) return state;
      const next = applyMenuEvent(state, event);
      return next === state ? state : { ...next, version: event.version };
    }),
    // Confirmed by the server: shown right away, even if the event stream is down.
    // The version stays as it is, so events that are still on their way are not skipped.
    on(SetupApiActions.categorySaved, (state, { category }): MenuState => ({
      ...state,
      categories: setNewer(categoryAdapter, category, state.categories),
    })),
    on(SetupApiActions.categoryDeleted, (state, { id }): MenuState => ({
      ...state,
      categories: categoryAdapter.removeOne(id, state.categories),
    })),
    on(SetupApiActions.itemSaved, (state, { item }): MenuState => ({ ...state, items: setNewer(itemAdapter, item, state.items) })),
    on(SetupApiActions.itemDeleted, (state, { id }): MenuState => ({ ...state, items: itemAdapter.removeOne(id, state.items) })),
  ),
  extraSelectors: ({ selectCategories, selectItems }) => {
    const selectAllCategories = createSelector(selectCategories, categorySelectors.selectAll);
    const selectCategoryEntities = createSelector(selectCategories, categorySelectors.selectEntities);
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

    return {
      selectAllCategories,
      selectCategoryEntities,
      selectAllItems,
      selectItemEntities,
      selectItemsByCategory,
      selectStats,
    };
  },
});
