import { buildApp } from '../src/app';
import type { App, AppOptions } from '../src/app';
import type { MenuSeed } from '../src/menu-store';

export const seed: MenuSeed = {
  categories: [
    { id: 'cat-food', name: 'Food', sortOrder: 1 },
    { id: 'cat-empty', name: 'Empty', sortOrder: 2 },
  ],
  items: [
    { id: 'pizza', categoryId: 'cat-food', name: 'Pizza', description: '', openPrice: false, price: 1250, available: true },
    { id: 'soup', categoryId: 'cat-food', name: 'Soup', description: '', openPrice: false, price: 600, available: true },
    { id: 'special', categoryId: 'cat-food', name: 'Special', description: '', openPrice: true, price: null, available: true },
  ],
};

/** A small app with the kitchen turned off, so order statuses only change when a test wants them to. */
export function testApp(options: AppOptions = {}): Promise<App> {
  return buildApp({ seed, kitchenStepMs: { min: 0, max: 0 }, ...options });
}
