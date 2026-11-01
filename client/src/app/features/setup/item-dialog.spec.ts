import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store, provideState, provideStore } from '@ngrx/store';
import type { Action } from '@ngrx/store';
import type { MenuItem } from '@shared';
import { category, menuItem, menuSnapshot } from '../../../testing/fixtures';
import { MenuActions } from '../../state/menu/menu.actions';
import { menuFeature } from '../../state/menu/menu.reducer';
import { RealtimeActions } from '../../state/realtime/realtime.actions';
import { ItemDialog } from './item-dialog';
import type { ItemDialogData } from './item-dialog';
import { MenuEditor } from './menu-editor.service';

describe('ItemDialog', () => {
  let fixture: ComponentFixture<ItemDialog>;
  let sent: Action[];
  let answer: string | null;
  const close = vi.fn();

  async function open(data: Partial<ItemDialogData> = {}, items: MenuItem[] = []): Promise<void> {
    sent = [];
    answer = null;
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [ItemDialog],
      providers: [
        provideStore(),
        provideState(menuFeature),
        { provide: MAT_DIALOG_DATA, useValue: { categoryId: 'cat-1', ...data } },
        { provide: MatDialogRef, useValue: { close } },
        {
          provide: MenuEditor,
          useValue: {
            run: (request: (requestId: string) => Action) => {
              sent.push(request('req'));
              return Promise.resolve(answer);
            },
          },
        },
      ],
    });
    TestBed.inject(Store).dispatch(
      MenuActions.loadSucceeded({ snapshot: menuSnapshot({ version: 10, categories: [category()], items }) }),
    );
    fixture = TestBed.createComponent(ItemDialog);
    await fixture.whenStable();
  }

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const input = (name: string): HTMLInputElement => {
    const found = element().querySelector<HTMLInputElement>(`[formcontrolname="${name}"]`);
    if (!found) throw new Error(`No field ${name}`);
    return found;
  };
  const type = (name: string, value: string): void => {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };
  const toggle = (name: string): void => {
    element().querySelector<HTMLButtonElement>(`[formcontrolname="${name}"] button`)?.click();
  };
  const submit = async (): Promise<void> => {
    element().querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  it('creates an item with the price in cents', async () => {
    await open();
    type('name', '  Margherita ');
    type('price', '12.5');
    await submit();

    expect(sent).toEqual([
      expect.objectContaining({
        type: '[Setup] Create Item',
        input: { categoryId: 'cat-1', name: 'Margherita', description: '', openPrice: false, price: 1250, available: true },
      }),
    ]);
    expect(close).toHaveBeenCalledWith(true);
  });

  it('does not send an invalid price', async () => {
    await open();
    type('name', 'Margherita');
    type('price', '12.505');
    await submit();
    expect(sent).toEqual([]);
    expect(element().textContent).toContain('Use a number like 12.50');
  });

  it('needs no price for an open-price item and sends null', async () => {
    await open();
    type('name', 'Catch of the day');
    toggle('openPrice');
    await fixture.whenStable();
    expect(input('price').disabled).toBe(true);
    await submit();
    expect(sent).toMatchObject([{ input: { openPrice: true, price: null } }]);
  });

  it('edits an existing item and keeps the dialog open when the server refuses', async () => {
    const pizza = menuItem({ id: 'pizza', name: 'Pizza', price: 1000, rev: 10 });
    await open({ item: pizza }, [pizza]);
    expect(input('price').value).toBe('10.00');
    answer = 'Category does not exist';
    await submit();

    expect(sent).toEqual([expect.objectContaining({ type: '[Setup] Update Item', id: 'pizza' })]);
    expect(close).not.toHaveBeenCalled();
    expect(element().querySelector('[role="alert"]')?.textContent).toContain('Category does not exist');
  });

  describe('when someone else edits the item meanwhile', () => {
    const pizza = menuItem({ id: 'pizza', name: 'Pizza', price: 1000, rev: 10 });
    const receive = async (event: Parameters<typeof RealtimeActions.eventReceived>[0]['event']): Promise<void> => {
      TestBed.inject(Store).dispatch(RealtimeActions.eventReceived({ event }));
      await fixture.whenStable();
    };
    const alert = (): string | undefined => element().querySelector('[role="alert"]')?.textContent;
    const saveButton = (): HTMLButtonElement | null => element().querySelector('button[type="submit"]');

    it('warns about the change and can load the latest version', async () => {
      await open({ item: pizza }, [pizza]);
      expect(alert()).toBeUndefined();

      await receive({ type: 'item.upserted', item: { ...pizza, price: 1400, rev: 11 }, version: 11 });
      expect(alert()).toContain('Someone else changed this item');

      [...element().querySelectorAll('button')].find((button) => button.textContent.includes('Load latest'))?.click();
      await fixture.whenStable();
      expect(input('price').value).toBe('14.00');
      expect(alert()).toBeUndefined();
    });

    it('blocks saving once the item is deleted', async () => {
      await open({ item: pizza }, [pizza]);
      await receive({ type: 'item.deleted', id: 'pizza', version: 11 });
      expect(alert()).toContain('deleted this item');
      expect(saveButton()?.disabled).toBe(true);
      await submit();
      expect(sent).toEqual([]);
    });
  });
});
