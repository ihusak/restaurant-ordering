import type { Category, MenuItem, Order } from './models';

/**
 * Real-time protocol (Server-Sent Events on GET /api/events):
 *
 * - `hello`  → { epoch, version }: sent once per connection.
 * - `change` → ServerEvent, with SSE id `${epoch}:${version}`.
 * - `resync` → {}: the server cannot replay what the client missed; reload snapshots.
 *
 * Every change increments one global `version`. A client reconnects with
 * `?since=<epoch>:<version>` (or the Last-Event-ID header) and the server
 * replays the missed events from a bounded buffer.
 */
export type ServerEventPayload =
  | { type: 'category.upserted'; category: Category }
  | { type: 'category.deleted'; id: string }
  | { type: 'item.upserted'; item: MenuItem }
  | { type: 'item.deleted'; id: string }
  | { type: 'order.upserted'; order: Order };

export type ServerEvent = ServerEventPayload & { version: number };

export interface HelloEvent {
  epoch: string;
  version: number;
}

export const SSE_EVENT = {
  hello: 'hello',
  change: 'change',
  resync: 'resync',
} as const;

export function formatEventId(epoch: string, version: number): string {
  return `${epoch}:${version}`;
}

export function parseEventId(id: string | null | undefined): { epoch: string; version: number } | null {
  if (!id) return null;
  const separator = id.lastIndexOf(':');
  if (separator <= 0) return null;
  const version = Number(id.slice(separator + 1));
  if (!Number.isInteger(version) || version < 0) return null;
  return { epoch: id.slice(0, separator), version };
}
