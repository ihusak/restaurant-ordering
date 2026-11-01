import { createActionGroup, props } from '@ngrx/store';
import type { Category, CategoryInput, CategoryPatch, MenuItem, MenuItemInput, MenuItemPatch } from '@shared';

/** `requestId` lets the screen that sent a request find out how it ended. */
interface Request {
  requestId: string;
}

export const SetupActions = createActionGroup({
  source: 'Setup',
  events: {
    'Create Category': props<Request & { input: CategoryInput }>(),
    'Update Category': props<Request & { id: string; patch: CategoryPatch }>(),
    'Delete Category': props<Request & { id: string }>(),
    'Create Item': props<Request & { input: MenuItemInput }>(),
    'Update Item': props<Request & { id: string; patch: MenuItemPatch }>(),
    'Delete Item': props<Request & { id: string }>(),
  },
});

export const SetupApiActions = createActionGroup({
  source: 'Setup API',
  events: {
    'Category Saved': props<Request & { category: Category }>(),
    'Category Deleted': props<Request & { id: string }>(),
    'Item Saved': props<Request & { item: MenuItem }>(),
    'Item Deleted': props<Request & { id: string }>(),
    'Request Failed': props<Request & { error: string }>(),
  },
});
