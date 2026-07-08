import 'dotenv/config';
import { loadConfig } from './config.js';
import { buildApp } from './app.js';

async function main() {
  const config = loadConfig();
  const app = await buildApp(config);

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
