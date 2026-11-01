import type { MenuItem } from '@shared';
import { category, menuItem } from '../../../testing/fixtures';
import { buildMenuRows } from './menu-rows';
import type { MenuRow } from './menu-rows';

describe('buildMenuRows', () => {
  const categories = [category({ id: 'pizza', name: 'Pizza', sortOrder: 1 }), category({ id: 'drinks', name: 'Drinks', sortOrder: 2 })];
  const items = new Map<string, MenuItem[]>([
    [
      'pizza',
      [
        menuItem({ id: 'p2', categoryId: 'pizza', name: 'Pepperoni', description: 'With spicy salami' }),
        menuItem({ id: 'p1', categoryId: 'pizza', name: 'Margherita', description: 'Tomato and basil' }),
      ],
    ],
    ['drinks', [menuItem({ id: 'd1', categoryId: 'drinks', name: 'Spicy Ginger Ale', description: '' })]],
  ]);
  const ids = (rows: MenuRow[]): string[] => rows.map((row) => row.id);

  it('lists every category in order with its items sorted by name', () => {
    expect(ids(buildMenuRows(categories, items, { categoryId: null, query: '' }))).toEqual([
      'category:pizza',
      'p1',
      'p2',
      'category:drinks',
      'd1',
    ]);
  });

  it('shows only the selected category', () => {
    expect(ids(buildMenuRows(categories, items, { categoryId: 'drinks', query: '' }))).toEqual(['category:drinks', 'd1']);
  });

  it('searches names and descriptions, ignoring case and word order', () => {
    expect(ids(buildMenuRows(categories, items, { categoryId: null, query: '  SPICY ' }))).toEqual([
      'category:pizza',
      'p2',
      'category:drinks',
      'd1',
    ]);
    expect(ids(buildMenuRows(categories, items, { categoryId: null, query: 'basil tomato' }))).toEqual(['category:pizza', 'p1']);
  });

  it('counts the matching items in each heading and hides empty categories', () => {
    const rows = buildMenuRows(categories, items, { categoryId: null, query: 'ginger' });
    expect(rows[0]).toEqual({ kind: 'category', id: 'category:drinks', name: 'Drinks', count: 1 });
    expect(rows).toHaveLength(2);
  });

  it('does not change the items it was given', () => {
    buildMenuRows(categories, items, { categoryId: null, query: '' });
    expect(items.get('pizza')?.map((item) => item.id)).toEqual(['p2', 'p1']);
  });
});
