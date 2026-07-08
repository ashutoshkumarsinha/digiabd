import { describe, expect, it } from 'vitest';
import { apiIntegrationSuite } from './api-int-utils.js';
import { makeTestConfig } from './test-utils.js';

describe('Auth routes', () => {
  const ctx = apiIntegrationSuite();

  it('POST /api/v1/auth/login issues JWT for known user (hybrid/dev mode)', async () => {
    expect(ctx.tokens.engineer).toBeTruthy();
    expect(ctx.tokens.admin).toBeTruthy();
    expect(ctx.tokens.oic).toBeTruthy();
  });

  it('GET /api/v1/auth/me returns JWT claims', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: ctx.authHeader(ctx.tokens.engineer),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { user: { email: string; role: string; orgId: string } };
    expect(body.user.email).toBe('engineer@demo.telecom');
    expect(body.user.role).toBeTruthy();
    expect(body.user.orgId).toBeTruthy();
  });

  it('GET /api/v1/auth/oidc/config disabled when not configured', async () => {
    const { buildApp } = await import('../app.js');
    const app = await buildApp(makeTestConfig({ AUTH_MODE: 'oidc' }));
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/oidc/config' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).enabled).toBe(false);
    await app.close();
  });

  it.todo('POST /api/v1/auth/oidc/callback exchanges code (when implemented)');
});

