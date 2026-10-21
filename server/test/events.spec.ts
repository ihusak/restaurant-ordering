import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatEventId } from '@shared';
import { EventLog } from '../src/event-log';
import type { App } from '../src/app';
import { testApp } from './helpers';

describe('EventLog', () => {
  const publish = (log: EventLog, count: number): void => {
    for (let i = 0; i < count; i++) log.publish(log.next(), { type: 'item.deleted', id: `item-${i}` });
  };

  it('replays only the events a client missed', () => {
    const log = new EventLog();
    publish(log, 5);
    const result = log.since(log.epoch, 3);
    expect(result).toEqual({ kind: 'replay', events: [expect.objectContaining({ version: 4 }), expect.objectContaining({ version: 5 })] });
    expect(log.since(log.epoch, 5)).toEqual({ kind: 'replay', events: [] });
  });

  it('asks for a resync when events were dropped from the buffer', () => {
    const log = new EventLog(3);
    publish(log, 10);
    expect(log.since(log.epoch, 6)).toEqual({ kind: 'resync' });
    expect(log.since(log.epoch, 7).kind).toBe('replay');
  });

  it('asks for a resync after a server restart or for a version from the future', () => {
    const log = new EventLog();
    publish(log, 2);
    expect(log.since('old-epoch', 1)).toEqual({ kind: 'resync' });
    expect(log.since(log.epoch, 99)).toEqual({ kind: 'resync' });
  });
});

describe('GET /api/events', () => {
  let app: App;
  let baseUrl: string;
  beforeEach(async () => {
    app = await testApp();
    baseUrl = await app.server.listen({ port: 0, host: '127.0.0.1' });
  });
  afterEach(async () => {
    await app.server.close();
  });

  /** Opens the stream and collects the SSE frames until `count` named events arrived. */
  async function readEvents(headers: Record<string, string>, query: string, count: number, during?: () => void) {
    const controller = new AbortController();
    const response = await fetch(`${baseUrl}/api/events${query}`, { headers, signal: controller.signal });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    if (!response.body) throw new Error('No body');
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    const events: { id?: string; event: string; data: unknown }[] = [];
    let buffer = '';
    during?.();
    while (events.length < count) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const fields = Object.fromEntries(
          frame.split('\n').filter((line) => line && !line.startsWith(':')).map((line) => {
            const colon = line.indexOf(':');
            return [line.slice(0, colon), line.slice(colon + 1).trimStart()];
          }),
        ) as Record<string, string>;
        if (fields.event && fields.data) events.push({ id: fields.id, event: fields.event, data: JSON.parse(fields.data) });
      }
    }
    controller.abort();
    return events;
  }

  it('says hello and then streams live changes', async () => {
    const events = await readEvents({}, '', 2, () => {
      setTimeout(() => app.menu.updateItem('pizza', { available: false }), 20);
    });
    expect(events[0]).toEqual({ id: undefined, event: 'hello', data: { epoch: app.log.epoch, version: 0 } });
    expect(events[1]).toMatchObject({
      id: formatEventId(app.log.epoch, 1),
      event: 'change',
      data: { type: 'item.upserted', version: 1, item: { id: 'pizza', available: false, rev: 1 } },
    });
  });

  it('replays missed events, and Last-Event-ID wins over a stale ?since', async () => {
    app.menu.updateItem('pizza', { price: 1300 });
    app.menu.updateItem('soup', { price: 700 });
    app.menu.updateItem('soup', { price: 800 });
    const epoch = app.log.epoch;
    const events = await readEvents({ 'Last-Event-ID': formatEventId(epoch, 2) }, `?since=${formatEventId(epoch, 0)}`, 2);
    expect(events.map((event) => event.event)).toEqual(['hello', 'change']);
    expect(events[1]?.id).toBe(formatEventId(epoch, 3));
  });

  it('tells a client from a previous server run to resync', async () => {
    const events = await readEvents({}, '?since=deadbeef:5', 2);
    expect(events.map((event) => event.event)).toEqual(['hello', 'resync']);
  });
});
