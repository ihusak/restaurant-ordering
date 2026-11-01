import type { Cents } from '@shared';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatCents(cents: Cents): string {
  return currency.format(cents / 100);
}

/** For form fields: 1250 → "12.50". */
export function centsToInput(cents: Cents | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

/**
 * Parses what the user typed ("12", "12.5", "12,50") into cents, or null.
 * Works on the digits instead of multiplying a float, so "0.29" is 29 and not 28.999….
 */
export function parsePrice(text: string): Cents | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;
  const [, units = '0', fraction = ''] = match;
  return Number(units) * 100 + Number(fraction.padEnd(2, '0'));
}
