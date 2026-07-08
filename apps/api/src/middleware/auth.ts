import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthUser } from '../types/index.js';
import type { AppConfig } from '../config.js';
import { isOidcEnabled } from '../config.js';
import { verifyOidcAccessToken } from '../auth/oidc.js';

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    const config = request.server.config as AppConfig | undefined;
    const auth = request.headers.authorization;

    if (config && isOidcEnabled(config) && auth?.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length);
      try {
        const user = await verifyOidcAccessToken({ config, token });
        (request as unknown as { user: AuthUser }).user = user;
        return;
      } catch {
        // Fall through to internal JWT verification (hybrid mode).
      }
    }

    await request.jwtVerify();
  } catch {
    reply.status(401).send({
      type: 'https://digiabd.io/errors/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail: 'Valid bearer token required',
    });
  }
}

export function getAuthUser(request: FastifyRequest): AuthUser {
  return request.user as AuthUser;
}

export function requireRoles(...roles: AuthUser['role'][]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = getAuthUser(request);
    if (!roles.includes(user.role) && user.role !== 'system_admin' && user.role !== 'enterprise_admin') {
      reply.status(403).send({
        type: 'https://digiabd.io/errors/forbidden',
        title: 'Forbidden',
        status: 403,
        detail: `Role ${user.role} is not permitted for this operation`,
      });
    }
  };
}
