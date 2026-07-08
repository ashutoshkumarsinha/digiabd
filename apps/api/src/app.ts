import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { AppConfig } from './config.js';
import { createPool } from './db/pool.js';
import { authenticate } from './middleware/auth.js';
import { registerAuthRoutes, registerOrgRoutes } from './routes/auth.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerSegmentRoutes } from './routes/segments.js';
import { registerDeviationRoutes, registerNocRoutes, registerPhotoRoutes } from './routes/workflows.js';

export async function buildApp(config: AppConfig) {
  const app = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  const pool = createPool(config);

  await app.register(cors, { origin: config.CORS_ORIGIN });
  await app.register(jwt, { secret: config.JWT_SECRET });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Digital ABD API',
        description: 'As-Built Documentation platform for OFC networks',
        version: '0.1.0',
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

  app.addHook('onRequest', async (request, reply) => {
    reply.header('X-Request-ID', request.id);
  });

  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return {
      status: 'ok',
      service: 'digiabd-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  });

  await registerAuthRoutes(app, pool);
  await registerOrgRoutes(app, pool);
  await registerProjectRoutes(app, pool);
  await registerSegmentRoutes(app, pool);
  await registerDeviationRoutes(app, pool);
  await registerPhotoRoutes(app, pool, config);
  await registerNocRoutes(app, pool);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      type: 'https://digiabd.io/errors/internal',
      title: 'Internal Server Error',
      status: error.statusCode ?? 500,
      detail: config.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
      instance: request.url,
    });
  });

  app.addHook('onClose', async () => {
    await pool.end();
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: typeof authenticate;
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
