import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { ServerEvent, ServerEventPayload } from '@shared';

export type ReplayResult = { kind: 'replay'; events: ServerEvent[] } | { kind: 'resync' };

/**
 * Single source of the global version counter.
 *
 * Keeps the most recent events in a ring buffer so that a client which lost
 * its connection for a short while can catch up without reloading everything.
 */
export class EventLog {
  readonly epoch = randomUUID().slice(0, 8);
  private current = 0;
  private readonly buffer: ServerEvent[] = [];
  private readonly emitter = new EventEmitter();

  constructor(private readonly capacity = 2000) {
    this.emitter.setMaxListeners(0);
  }

  get version(): number {
    return this.current;
  }

  /** Reserves the next version: callers stamp it as the entity `rev` before publishing. */
  next(): number {
    return ++this.current;
  }

  publish(version: number, payload: ServerEventPayload): void {
    const event: ServerEvent = { ...payload, version };
    this.buffer.push(event);
    if (this.buffer.length > this.capacity) this.buffer.shift();
    this.emitter.emit('event', event);
  }

  /** Events with a version greater than `since`, or `resync` if some were already dropped. */
  since(epoch: string, since: number): ReplayResult {
    if (epoch !== this.epoch || since > this.current) return { kind: 'resync' };
    if (since === this.current) return { kind: 'replay', events: [] };
    const oldest = this.buffer[0]?.version ?? this.current + 1;
    if (since + 1 < oldest) return { kind: 'resync' };
    return { kind: 'replay', events: this.buffer.filter((event) => event.version > since) };
  }

  subscribe(listener: (event: ServerEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}
