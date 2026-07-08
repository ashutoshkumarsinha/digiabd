import 'dotenv/config';
import { loadConfig } from './config.js';
import { initObservability, shutdownObservability } from './observability/telemetry.js';

// This is the API process entry point.
// High-level flow:
// 1) Load environment config
// 2) Start observability first (so instrumentation can hook modules early)
// 3) Build and start Fastify app
// 4) Gracefully close resources on SIGINT/SIGTERM
async function main() {
  const config = loadConfig();
  await initObservability(config);
  const { buildApp } = await import('./app.js');
  const app = await buildApp(config);

  // Centralized shutdown avoids leaked connections (DB/Redis/Kafka/OTel).
  const shutdown = async (signal: NodeJS.Signals) => {
    app.log.info({ signal }, 'Shutting down API');
    await app.close();
    await shutdownObservability();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(`Digital ABD API listening on http://localhost:${config.PORT}`);
    app.log.info(`API docs available at http://localhost:${config.PORT}/docs`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
