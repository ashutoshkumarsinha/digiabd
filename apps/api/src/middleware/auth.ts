import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthUser } from '../types/index.js';
import type { AppConfig } from '../config.js';
import { isOidcEnabled } from '../config.js';
import { verifyOidcAccessToken } from '../auth/oidc.js';

// authenticate supports two token strategies:
// 1) OIDC external JWTs (Keycloak/IdP) when enabled
// 2) Internal JWTs issued by /api/v1/auth/login
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
        // For OIDC tokens we manually set request.user to the mapped AuthUser shape.
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
  // Thin helper so route handlers can use typed user data consistently.
  return request.user as AuthUser;
}

export function requireRoles(...roles: AuthUser['role'][]) {
  // Route-level authorization gate with enterprise/system admin override.
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
