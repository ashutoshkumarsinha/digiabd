import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { query } from '../db/pool.js';
import type { Organization } from '../types/index.js';

export async function registerAuthRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  // Development login — replace with OIDC/SAML in production
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

    const token = await reply.jwtSign({
      sub: user.id,
      orgId: user.org_id,
      email: user.email,
      role: user.role,
      name: user.full_name,
    });

    return { access_token: token, token_type: 'Bearer', expires_in: 3600 };
  });

  app.get('/api/v1/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    return { user: request.user };
  });
}

export async function registerOrgRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get('/api/v1/organizations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as { orgId: string };
    const orgs = await query<Organization>(
      pool,
      `SELECT * FROM organizations WHERE id = $1`,
      [user.orgId],
    );

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
