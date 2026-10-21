import { randomUUID } from 'node:crypto';
import { MAX_FIXED_PRICE, isValidCents } from '@shared';
import type { Category, CategoryInput, CategoryPatch, MenuItem, MenuItemInput, MenuItemPatch, MenuSnapshot } from '@shared';
import { ApiError, notFound } from './errors';
import type { EventLog } from './event-log';

export interface MenuSeed {
  categories: Omit<Category, 'rev'>[];
  items: Omit<MenuItem, 'rev'>[];
}

export class MenuStore {
  private readonly categories = new Map<string, Category>();
  private readonly items = new Map<string, MenuItem>();

  constructor(private readonly log: EventLog) {}

  load(seed: MenuSeed): void {
    for (const category of seed.categories) this.categories.set(category.id, { ...category, rev: 0 });
    for (const item of seed.items) this.items.set(item.id, { ...item, rev: 0 });
  }

  snapshot(): MenuSnapshot {
    return {
      epoch: this.log.epoch,
      version: this.log.version,
      categories: [...this.categories.values()],
      items: [...this.items.values()],
    };
  }

  findItem(id: string): MenuItem | undefined {
    return this.items.get(id);
  }

  allItems(): MenuItem[] {
    return [...this.items.values()];
  }

  createCategory(input: CategoryInput): Category {
    const rev = this.log.next();
    const maxOrder = Math.max(0, ...[...this.categories.values()].map((category) => category.sortOrder));
    const category: Category = { id: randomUUID(), name: input.name, sortOrder: input.sortOrder ?? maxOrder + 1, rev };
    this.categories.set(category.id, category);
    this.log.publish(rev, { type: 'category.upserted', category });
    return category;
  }

  updateCategory(id: string, patch: CategoryPatch): Category {
    const existing = this.categories.get(id);
    if (!existing) throw notFound('Category');
    const rev = this.log.next();
    const category: Category = { ...existing, ...patch, id, rev };
    this.categories.set(id, category);
    this.log.publish(rev, { type: 'category.upserted', category });
    return category;
  }

  deleteCategory(id: string): void {
    if (!this.categories.has(id)) throw notFound('Category');
    // Deliberately no cascade: deleting a category with items is almost always a mistake.
    if ([...this.items.values()].some((item) => item.categoryId === id)) {
      throw new ApiError(409, 'CATEGORY_NOT_EMPTY', 'Move or delete the items of this category first');
    }
    this.categories.delete(id);
    this.log.publish(this.log.next(), { type: 'category.deleted', id });
  }

  createItem(input: MenuItemInput): MenuItem {
    const draft = this.normalize({ ...input, id: randomUUID(), rev: 0 });
    const item: MenuItem = { ...draft, rev: this.log.next() };
    this.items.set(item.id, item);
    this.log.publish(item.rev, { type: 'item.upserted', item });
    return item;
  }

  updateItem(id: string, patch: MenuItemPatch): MenuItem {
    const existing = this.items.get(id);
    if (!existing) throw notFound('Item');
    const draft = this.normalize({ ...existing, ...patch, id });
    const item: MenuItem = { ...draft, rev: this.log.next() };
    this.items.set(id, item);
    this.log.publish(item.rev, { type: 'item.upserted', item });
    return item;
  }

  deleteItem(id: string): void {
    if (!this.items.delete(id)) throw notFound('Item');
    this.log.publish(this.log.next(), { type: 'item.deleted', id });
  }

  /** Enforces the invariants that a request schema alone cannot express. */
  private normalize(item: MenuItem): MenuItem {
    if (!this.categories.has(item.categoryId)) {
      throw new ApiError(400, 'VALIDATION', 'Category does not exist');
    }
    if (item.openPrice) return { ...item, price: null };
    if (!isValidCents(item.price, MAX_FIXED_PRICE)) {
      throw new ApiError(400, 'VALIDATION', 'A fixed-price item needs a positive price');
    }
    return item;
  }
}
