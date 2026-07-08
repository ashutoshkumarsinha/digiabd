import { beforeAll, afterAll, expect } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeTestConfig } from './test-utils.js';

export function apiIntegrationSuite() {
  let app: FastifyInstance;
  let tokenEngineer: string;
  let tokenAdmin: string;
  let tokenOic: string;
  let tokenEngineer2: string;

  beforeAll(async () => {
    const { buildApp } = await import('../app.js');
    app = await buildApp(
      makeTestConfig({
        AUTH_MODE: 'hybrid',
        OTEL_ENABLED: false,
        KAFKA_ENABLED: false,
      }),
    );

    tokenEngineer = await login(app, 'engineer@demo.telecom');
    tokenAdmin = await login(app, 'admin@demo.telecom');
    tokenOic = await login(app, 'oic@demo.telecom');
    tokenEngineer2 = await login(app, 'engineer2@demo.telecom');
  });

  afterAll(async () => {
    await app.close();
  });

  return {
    get app() {
      return app;
    },
    get tokens() {
      return { engineer: tokenEngineer, admin: tokenAdmin, oic: tokenOic, engineer2: tokenEngineer2 };
    },
    authHeader(token: string) {
      return { Authorization: `Bearer ${token}` };
    },
  };
}

async function login(app: FastifyInstance, email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email },
  });
  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body) as { access_token: string };
  expect(body.access_token).toBeTruthy();
  return body.access_token;
}

