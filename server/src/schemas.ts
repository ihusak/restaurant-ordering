import { z } from 'zod';
import { MAX_FIXED_PRICE, MAX_QUANTITY } from '@shared';
import { ApiError } from './errors';

const id = z.string().min(1).max(100);
const name = z.string().trim().min(1).max(120);
const cents = z.int().min(0).max(MAX_FIXED_PRICE);

export const categoryInput = z.strictObject({
  name,
  sortOrder: z.int().min(0).optional(),
});
export const categoryPatch = categoryInput.partial();

export const menuItemInput = z.strictObject({
  categoryId: id,
  name,
  description: z.string().trim().max(500),
  openPrice: z.boolean(),
  price: cents.nullable(),
  available: z.boolean(),
});
export const menuItemPatch = menuItemInput.partial();

export const createOrderRequest = z.strictObject({
  idempotencyKey: z.string().min(8).max(100),
  lines: z
    .array(
      z.strictObject({
        itemId: id,
        openPrice: z.boolean(),
        quantity: z.int().min(1).max(MAX_QUANTITY),
        unitPrice: cents,
      }),
    )
    .min(1)
    .max(200),
  discount: cents,
});

export const idParams = z.strictObject({ id });

/** Parses untrusted input or throws a 400 with a readable message. */
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(400, 'VALIDATION', z.prettifyError(result.error));
  return result.data;
}
