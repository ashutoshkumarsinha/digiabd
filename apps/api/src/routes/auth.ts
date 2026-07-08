import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { AppConfig } from '../config.js';
import { isOidcEnabled } from '../config.js';
import { query } from '../db/pool.js';
import type { Organization } from '../types/index.js';

async function issueTokenForUser(
  reply: import('fastify').FastifyReply,
  user: { id: string; org_id: string; email: string; full_name: string; role: string },
) {
  const token = await reply.jwtSign({
    sub: user.id,
    orgId: user.org_id,
    email: user.email,
    role: user.role,
    name: user.full_name,
  });
  return { access_token: token, token_type: 'Bearer', expires_in: 3600 };
}

export async function registerAuthRoutes(app: FastifyInstance, pool: pg.Pool, config: AppConfig): Promise<void> {
  if (config.AUTH_MODE === 'dev' || config.AUTH_MODE === 'hybrid') {
    app.post('/api/v1/auth/login', async (request, reply) => {
      const body = request.body as { email?: string };

      if (!body?.email) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'email is required',
        });
      }

      const users = await query<{
        id: string;
        org_id: string;
        email: string;
        full_name: string;
        role: string;
      }>(pool, `SELECT id, org_id, email, full_name, role FROM users WHERE email = $1 AND is_active = TRUE`, [
        body.email,
      ]);

      const user = users[0];
      if (!user) {
        return reply.status(401).send({
          type: 'https://digiabd.io/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid credentials',
        });
      }

      return issueTokenForUser(reply, user);
    });
  }

  app.get('/api/v1/auth/oidc/config', async () => {
    if (!isOidcEnabled(config)) {
      return { enabled: false, mode: config.AUTH_MODE };
    }
    return {
      enabled: true,
      mode: config.AUTH_MODE,
      issuer: config.OIDC_ISSUER,
      client_id: config.OIDC_CLIENT_ID,
      redirect_uri: config.OIDC_REDIRECT_URI,
      note: 'Configure Azure AD / Okta app registration with these values. Token exchange endpoint ships in Phase 2.1.',
    };
  });

  // Phase 2.1: wire openid-client authorization code exchange when IdP credentials are available
  app.post('/api/v1/auth/oidc/callback', async (_request, reply) => {
    if (!isOidcEnabled(config)) {
      return reply.status(404).send({ enabled: false });
    }
    return reply.status(501).send({
      type: 'https://digiabd.io/errors/not-implemented',
      title: 'OIDC Callback Pending',
      status: 501,
      detail: 'OIDC code exchange requires IdP credentials. Use /api/v1/auth/login in hybrid mode for pilot.',
    });
  });

  app.get('/api/v1/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    return { user: request.user };
  });
}

export async function registerOrgRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get('/api/v1/organizations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { orgId: string };
    const orgs = await query<Organization>(pool, `SELECT * FROM organizations WHERE id = $1`, [user.orgId]);

    if (!orgs[0]) {
      return reply.status(404).send({
        type: 'https://digiabd.io/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'Organization not found',
      });
    }

    return orgs[0];
  });
}
