import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { Action } from '@ngrx/store';
import { category, menuItem } from '../../../testing/fixtures';
import { ItemDialog } from './item-dialog';
import type { ItemDialogData } from './item-dialog';
import { MenuEditor } from './menu-editor.service';

describe('ItemDialog', () => {
  let fixture: ComponentFixture<ItemDialog>;
  let sent: Action[];
  let answer: string | null;
  const close = vi.fn();

  async function open(data: Partial<ItemDialogData> = {}): Promise<void> {
    sent = [];
    answer = null;
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [ItemDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { categoryId: 'cat-1', categories: [category()], ...data } },
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
    await open({ item: menuItem({ id: 'pizza', name: 'Pizza', price: 1000 }) });
    expect(input('price').value).toBe('10.00');
    answer = 'Category does not exist';
    await submit();

    expect(sent).toEqual([expect.objectContaining({ type: '[Setup] Update Item', id: 'pizza' })]);
    expect(close).not.toHaveBeenCalled();
    expect(element().querySelector('[role="alert"]')?.textContent).toContain('Category does not exist');
  });
});
