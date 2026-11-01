import type { Category, MenuItem } from '@shared';

/** One line of the virtual list: a category heading or an item. Both have the same height. */
export type MenuRow =
  | { kind: 'category'; id: string; name: string; count: number }
  | { kind: 'item'; id: string; item: MenuItem };

export interface MenuFilter {
  categoryId: string | null;
  query: string;
}

export function normalizeQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

function matches(item: MenuItem, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const text = `${item.name} ${item.description}`.toLocaleLowerCase();
  return words.every((word) => text.includes(word));
}

/**
 * Items in menu order (category order, then name), each group under its heading.
 * Every word of the query must appear in the name or the description.
 */
export function buildMenuRows(
  categories: readonly Category[],
  itemsByCategory: ReadonlyMap<string, readonly MenuItem[]>,
  filter: MenuFilter,
): MenuRow[] {
  const words = normalizeQuery(filter.query).split(/\s+/).filter(Boolean);
  const rows: MenuRow[] = [];
  for (const category of categories) {
    if (filter.categoryId && category.id !== filter.categoryId) continue;
    const items = (itemsByCategory.get(category.id) ?? [])
      .filter((item) => matches(item, words))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (items.length === 0) continue;
    rows.push({ kind: 'category', id: `category:${category.id}`, name: category.name, count: items.length });
    for (const item of items) rows.push({ kind: 'item', id: item.id, item });
  }
  return rows;
}
