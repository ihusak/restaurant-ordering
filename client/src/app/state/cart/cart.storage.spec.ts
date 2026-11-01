import { initialCartState } from './cart.reducer';
import type { CartState } from './cart.reducer';
import { loadCart, saveCart } from './cart.storage';

describe('cart storage', () => {
  const cart: CartState = {
    lines: [{ lineId: 'pizza', itemId: 'pizza', name: 'Pizza', openPrice: false, unitPrice: 1250, quantity: 2 }],
    discount: 100,
    idempotencyKey: 'key-1',
    outcomeUnknown: true,
  };

  function memoryStorage(initial: string | null = null): Pick<Storage, 'getItem' | 'setItem'> {
    let value = initial;
    return {
      getItem: () => value,
      setItem: (_, next) => {
        value = next;
      },
    };
  }

  it('reads a cart saved before checkout existed', () => {
    const old = JSON.stringify({ lines: cart.lines, discount: 100 });
    expect(loadCart(memoryStorage(old))).toEqual({ ...cart, idempotencyKey: null, outcomeUnknown: false });
  });

  it('restores a saved cart with its idempotency key', () => {
    const storage = memoryStorage();
    saveCart(cart, storage);
    expect(loadCart(storage)).toEqual(cart);
  });

  it.each([
    ['nothing saved', null],
    ['broken JSON', '{"lines": ['],
    ['a different shape', '{"items": []}'],
    ['a fractional price', JSON.stringify({ ...cart, lines: [{ ...cart.lines[0], unitPrice: 12.5 }] })],
    ['a negative discount', JSON.stringify({ ...cart, discount: -5 })],
  ])('starts empty when there is %s', (_, saved) => {
    expect(loadCart(memoryStorage(saved))).toEqual(initialCartState);
  });

  it('keeps working when storage is unavailable', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadCart(broken)).toEqual(initialCartState);
    expect(() => {
      saveCart(cart, broken);
    }).not.toThrow();
  });
});
