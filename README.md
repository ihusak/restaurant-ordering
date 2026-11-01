# Restaurant ordering

A real-time ordering prototype: an Angular client and a Node.js server. Staff edit the menu in **Setup**, guests build a cart and place orders in **Menu**, and **Orders** follows each order through the kitchen. Every change shows up in every open tab without a reload.

![CI](https://github.com/ihusak/restaurant-ordering/actions/workflows/ci.yml/badge.svg)

## How to run

Requires Node.js 22 or newer.

```bash
npm install
npm start
```

Open http://localhost:4200. The server listens on http://127.0.0.1:3000, and the Angular dev server proxies `/api` to it.

| Command | What it does |
|---|---|
| `npm start` | Server and client together |
| `npm run start:demo` | Same, and the menu changes by itself every 2 s: prices and availability, to watch live updates and cart warnings |
| `npm run start:chaos` | Same, with up to 1.5 s of extra latency and 20% of API requests failing; an order response is sometimes "lost" after the order was stored |
| `npm test` | Server and client unit tests (Vitest) |
| `npm run lint` | ESLint with strict type-checked rules and angular-eslint |
| `npm run build` | Type check of the server, production build of the client |

Server settings: `PORT` (3000), `HOST` (127.0.0.1), `LOG_LEVEL` (info).

## What is inside

```
shared/   Types and rules used by both sides: models, API contracts, event protocol, money math, menu checks
server/   Fastify, data in memory, REST for commands, Server-Sent Events for live updates
client/   Angular 22: standalone, zoneless, signals, strict templates; NgRx; Angular Material + CDK
```

- **Setup**: categories and items, fixed or open price, availability. Saved on the server; dialogs warn when someone else changed or deleted the item meanwhile.
- **Menu**: 3,000 items in a virtual list, search, category filter, cart with quantities, open-price entry and a discount.
- **Checkout**: an order is never placed twice, and menu changes are shown before the order goes out.
- **Orders**: live status (accepted → preparing → ready → completed), driven by a simulated kitchen.

## Key decisions

### Server-Sent Events, not WebSockets

Live data only flows from the server to the client; every user action is a REST call. SSE fits that exactly: the browser reconnects by itself and sends `Last-Event-ID`, it is plain HTTP (proxies, compression, no extra protocol), and the server stays small. WebSockets would add a second protocol and hand-written heartbeats and reconnects without giving anything this app needs. They would become worth it for client-to-server traffic in real time, such as chat or presence.

### One version counter, replay or resync

Every change on the server gets the next global `version`, and every entity carries the version of its last change as `rev`.

- A client loads snapshots and opens the stream from their version (`?since=epoch:version`), so nothing between the two is lost.
- After a short disconnect the server replays the missed events from a bounded buffer (2,000 events).
- If the buffer no longer has them, or the server restarted (a new `epoch`), the server sends `resync` and the client reloads the snapshots.
- Each slice ignores events it has already applied, and an entity is only replaced by a newer `rev`. Duplicates and out-of-order copies (an event and a REST response carrying the same change) are therefore harmless.

The browser's own reconnect gives up when the server answers with an error status, for example a 502 from the dev proxy while the server is down. The client then reopens the stream with a growing delay (1 s to 30 s, with jitter), or at once when the browser comes back online.

### The server is the source of truth

Setup never updates the screen optimistically: it waits for the server and then applies the confirmed entity, and the same change reaches other tabs through the stream. The order total, the discount limit and the "can this line still be ordered" check are computed on the server and are the final word. The client runs the same functions from `shared` (`computeTotals`, `findMenuIssue`) only to warn early.

### An order is never placed twice

- The cart gets an idempotency key on the first checkout attempt. Every retry of that attempt sends the same key, and the server answers a repeated key with the order it already created.
- The checkout effect uses `exhaustMap`: clicks while an order is on its way are ignored, and the button is disabled.
- Network errors and 5xx responses are retried automatically, twice, with the same key.
- When no answer arrives at all, the order may exist. The key is then kept even if the cart is edited: the server refuses a different order under that key (422) instead of silently creating a second one, and the user is told to check Orders.
- The key is stored with the cart in `localStorage`, so a reload after a lost response does not create a duplicate either.

### Menu changes before confirmation

The cart is checked against the live menu continuously, with the same rule the server uses: price changed, item unavailable, item removed, fixed price became open or the other way round. Changed lines are marked, and the order cannot be placed until the user presses **Accept changes**. If the server still answers `409 MENU_CHANGED` (the stream was behind), its list is shown in the same way.

### Money in integer cents

Prices, totals and discounts are integers in cents everywhere: in the API, the state and the math. Input like `12.5` is parsed digit by digit, never through floating point, so `0.29` is 29 cents and not 28.999…

### NgRx

One store with slices for `menu`, `orders`, `cart`, `checkout` and `connection`; Entity adapters for the large collections; functional effects; components read state with `selectSignal`. The stream, REST results and user actions all go through the same reducers, which is what keeps the rules above in one place and makes them testable without a browser.

### Performance with a large menu

- A CDK virtual list with a fixed row height (64 px) renders only the rows near the screen: a few dozen instead of 3,000. The fixed height also keeps the layout from jumping while data loads, and the skeleton rows have the same height.
- Search waits for a 200 ms pause in typing; filtering and grouping all 3,000 items takes 1–2 ms.
- All pages are lazy loaded, and so is the snack bar. The first bundle is about 480 kB raw, 125 kB compressed, with a budget of 550 kB.
- The server compresses responses: the full menu is about 400 kB of JSON and about 45 kB with brotli.

### Reliability

- GET requests are retried on network errors and 5xx (0.5 s, 1 s, 2 s). Writes are never repeated by the interceptor.
- A failed first load shows an error with a retry button. A failed refresh keeps the old data on screen and offers a retry in a snack bar.
- The connection indicator in the header shows Live, Reconnecting or Offline. Checkout is disabled while the browser is offline; the menu stays usable from the last known data.
- A global `ErrorHandler` logs every uncaught error and shows one calm message at most every 10 seconds.

## Deliberately simplified

- **Data in memory.** A restart clears orders and restores the generated menu. Clients notice the new `epoch` and reload.
- **No authentication or roles.** Anyone can open Setup.
- **The kitchen and the "busy menu" are simulators** that run on the server.
- **One currency (USD) and English only.** The discount is a fixed amount, not a percentage.
- **Idempotency keys live as long as the server process.** There is no expiry.
- **The Orders page renders every order without virtualization.** A prototype session produces dozens of orders, not thousands.

## What production would need

- A real database with transactions; idempotency keys stored with the order and expired after a while.
- Authentication, and roles so that only staff can open Setup.
- Several server instances: events published through Redis pub/sub or a similar bus, so every instance streams every change; the replay buffer kept there too.
- Monitoring, structured logs shipped somewhere, alerts; rate limiting.
- End-to-end tests (Playwright) for the main flows, including reconnects.
- Translations and currency formatting per restaurant; percentage discounts.
- Optionally a PWA with an offline queue for orders.

## API

| Method and path | Purpose |
|---|---|
| `GET /api/menu` | Menu snapshot: `{ epoch, version, categories, items }` |
| `POST /api/categories`, `PATCH /api/categories/:id`, `DELETE /api/categories/:id` | Categories. A category with items cannot be deleted (409) |
| `POST /api/items`, `PATCH /api/items/:id`, `DELETE /api/items/:id` | Items. `price` is in cents, and `null` exactly when `openPrice` is true |
| `GET /api/orders` | Orders snapshot, newest first |
| `POST /api/orders` | Place an order: 201 new, 200 the same key again, 409 `MENU_CHANGED` with the list of changes, 422 the key was used for a different order |
| `GET /api/events` | Server-Sent Events: `hello`, `change`, `resync`; see `shared/src/events.ts` |
| `GET /api/health` | Liveness and the current version |

Errors always have the shape `{ code, message, issues? }`, with the codes listed in `shared/src/api.ts`.

## Tests

About 200 unit tests: 39 on the server, 163 on the client.

- **Server:** idempotency (retry, a lost response in chaos mode, a reused key), menu conflicts, validation, event replay and resync over a real SSE connection, shutdown with open streams, the kitchen simulator, the generated menu.
- **Client:** reducers and selectors (applying events, ignoring stale ones, cart math, the idempotency key lifecycle, the cart review), effects (checkout with `exhaustMap`, retries with the same key, every error answer), the realtime service against a fake `EventSource` (reconnect, backoff, continuing from the last event), the interceptor, and components (the virtual list, forms, dialogs, conflict warnings).

CI runs lint, tests and the build on every push.
