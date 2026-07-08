import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { AppConfig } from './config.js';
import { createPool } from './db/pool.js';
import { closeRedis } from './db/redis.js';
import { authenticate } from './middleware/auth.js';
import { checkIdempotency } from './middleware/idempotency.js';
import { registerAuthRoutes, registerOrgRoutes } from './routes/auth.js';
import { registerFieldCaptureRoutes } from './routes/field-capture.js';
import { registerSyncRoutes, registerWebhookAdminRoutes, registerIntegrationRoutes } from './routes/integrations.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerGovernanceRoutes } from './routes/governance.js';
import { registerResilienceRoutes } from './routes/resilience.js';
import { registerSegmentRoutes } from './routes/segments.js';
import { registerDeviationRoutes, registerNocRoutes, registerPhotoRoutes } from './routes/workflows.js';
import { closeEventBus, initEventBus, isEventBusEnabled } from './services/events.js';
import { recordHttpRequestMetric, recordOtelLog } from './observability/telemetry.js';

// buildApp wires all platform dependencies (DB, auth, docs, routes, hooks)
// and returns a fully initialized Fastify instance.
export async function buildApp(config: AppConfig) {
  // Fastify app instance with request IDs for traceability.
  const app = Fastify({
    logger: { level: config.NODE_ENV === 'production' ? 'info' : 'debug' },
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  app.decorate('config', config);
  const pool = createPool(config);

  // Event bus is optional in dev; API continues even if Kafka is unavailable.
  await initEventBus(config).catch((err) => {
    app.log.warn({ err }, 'Kafka event bus unavailable — continuing without events');
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
  });
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });
  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_MAX,
    timeWindow: `${config.RATE_LIMIT_WINDOW_SECONDS} seconds`,
    errorResponseBuilder: (_request, context) => ({
      type: 'https://digiabd.io/errors/rate-limit',
      title: 'Too Many Requests',
      status: 429,
      detail: `Rate limit exceeded: max ${context.max} requests per ${context.after}`,
    }),
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Digital ABD API',
        description: 'As-Built Documentation platform for OFC networks',
        version: '0.4.0',
      },
      servers: [{ url: `http://localhost:${config.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.decorate('authenticate', authenticate);

  // onRequest starts request timing and returns request ID to clients.
  app.addHook('onRequest', async (request, reply) => {
    request.observabilityStartNs = process.hrtime.bigint();
    reply.header('X-Request-ID', request.id);
  });

  // onResponse publishes metrics/log records for every request.
  app.addHook('onResponse', async (request, reply) => {
    const startedAt = request.observabilityStartNs;
    if (!startedAt) return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = request.routeOptions.url ?? request.url;
    const statusCode = reply.statusCode;

    recordHttpRequestMetric({
      method: request.method,
      route,
      statusCode,
      durationMs,
    });

    recordOtelLog({
      severityText: statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARN' : 'INFO',
      body: 'http.server.request',
      attributes: {
        'http.request.method': request.method,
        'http.route': route,
        'http.response.status_code': statusCode,
        'http.server.duration_ms': durationMs,
      },
    });
  });

  // Idempotency check applies to API writes so retries are safe.
  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/v1/') && request.method !== 'GET') {
      const proceed = await checkIdempotency(pool, config, request, reply);
      if (!proceed) return reply;
    }
  });

  // Lightweight health endpoint used by smoke tests and orchestration.
  app.get('/health', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async () => {
    await pool.query('SELECT 1');
    return {
      status: 'ok',
      service: 'digiabd-api',
      version: '0.4.0',
      phase: 4,
      kafka: isEventBusEnabled(),
      timestamp: new Date().toISOString(),
    };
  });

  // Register bounded route modules. Each module owns one domain.
  await registerAuthRoutes(app, pool, config);
  await registerOrgRoutes(app, pool);
  await registerProjectRoutes(app, pool);
  await registerSegmentRoutes(app, pool);
  await registerFieldCaptureRoutes(app, pool);
  await registerDeviationRoutes(app, pool);
  await registerPhotoRoutes(app, pool, config);
  await registerNocRoutes(app, pool);
  await registerSyncRoutes(app, pool, config);
  await registerWebhookAdminRoutes(app, pool);
  await registerIntegrationRoutes(app, pool);
  await registerResilienceRoutes(app, pool, config);
  await registerGovernanceRoutes(app, pool, config);

  // Uniform RFC7807 error response contract.
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    recordOtelLog({
      severityText: 'ERROR',
      body: 'http.server.error',
      attributes: {
        'http.request.method': request.method,
        'http.route': request.routeOptions.url ?? request.url,
        'error.message': error.message,
      },
    });
    reply.status(error.statusCode ?? 500).send({
      type: 'https://digiabd.io/errors/internal',
      title: 'Internal Server Error',
      status: error.statusCode ?? 500,
      detail: config.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      instance: request.url,
    });
  });

  // Ensure all long-lived resources are closed when app shuts down.
  app.addHook('onClose', async () => {
    await closeEventBus();
    await closeRedis();
    await pool.end();
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
    config: AppConfig;
  }

  interface FastifyRequest {
    observabilityStartNs?: bigint;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub: string;
      orgId: string;
      email: string;
      role: string;
      name: string;
    };
  }
}
