import { centsToInput, formatCents, parsePrice } from './money';

describe('money', () => {
  it.each([
    ['12', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['12,05', 1205],
    ['0.29', 29],
    [' 7 ', 700],
  ])('parses "%s" as %i cents', (text, cents) => {
    expect(parsePrice(text)).toBe(cents);
  });

  it.each(['', 'abc', '12.505', '-1', '1e3', '12.', '.5'])('rejects "%s"', (text) => {
    expect(parsePrice(text)).toBeNull();
  });

  it('formats cents for display and for inputs', () => {
    expect(formatCents(123456)).toBe('$1,234.56');
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(null)).toBe('');
  });
});
