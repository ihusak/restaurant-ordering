import { parseArgs } from 'node:util';
import { buildApp } from './app';

const { values: flags } = parseArgs({
  options: {
    demo: { type: 'boolean', default: false },
    chaos: { type: 'boolean', default: false },
  },
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '127.0.0.1';

const { server, menu } = await buildApp({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  // --demo: the menu changes by itself so live updates are visible right away.
  menuChurnMs: flags.demo ? 2_000 : 0,
  // --chaos: slow and unreliable network to show retries and error handling.
  ...(flags.chaos ? { chaos: { maxLatencyMs: 1_500, failureRate: 0.2 } } : {}),
});

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.log.info(`${signal} received, shutting down`);
    server.close().then(
      () => process.exit(0),
      (error: unknown) => {
        server.log.error(error);
        process.exit(1);
      },
    );
  });
}

try {
  await server.listen({ port, host });
  const modes = [flags.demo && 'demo', flags.chaos && 'chaos'].filter(Boolean).join(', ');
  server.log.info(`Menu: ${menu.allItems().length} items${modes ? ` · modes: ${modes}` : ''}`);
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
