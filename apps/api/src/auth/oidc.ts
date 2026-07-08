import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AuthUser, UserRole } from '../types/index.js';
import type { AppConfig } from '../config.js';

type OidcClaims = JWTPayload & {
  email?: string;
  name?: string;
  preferred_username?: string;
  orgId?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
};

let cachedJwks:
  | {
      issuer: string;
      jwks: ReturnType<typeof createRemoteJWKSet>;
    }
  | undefined;

async function discoverJwksUri(issuer: string): Promise<string> {
  const res = await fetch(`${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
  if (!res.ok) {
    throw new Error(`OIDC discovery failed: ${res.status}`);
  }
  const json = (await res.json()) as { jwks_uri?: string };
  if (!json.jwks_uri) throw new Error('OIDC discovery missing jwks_uri');
  return json.jwks_uri;
}

async function getJwks(issuer: string) {
  if (cachedJwks?.issuer === issuer) return cachedJwks.jwks;
  const jwksUri = await discoverJwksUri(issuer);
  const jwks = createRemoteJWKSet(new URL(jwksUri));
  cachedJwks = { issuer, jwks };
  return jwks;
}

const ROLE_ALLOWLIST: UserRole[] = [
  'field_engineer',
  'site_supervisor',
  'inspector_oic',
  'gis_engineer',
  'noc_operator',
  'program_manager',
  'auditor',
  'vendor_admin',
  'enterprise_admin',
  'system_admin',
];

function pickRoleFromClaims(claims: OidcClaims, config: AppConfig): UserRole {
  const realmRoles = claims.realm_access?.roles ?? [];
  const clientRoles = config.OIDC_CLIENT_ID
    ? claims.resource_access?.[config.OIDC_CLIENT_ID]?.roles ?? []
    : [];
  const merged = [...realmRoles, ...clientRoles].map((r) => r.trim()).filter(Boolean);

  const found = merged.find((r): r is UserRole => ROLE_ALLOWLIST.includes(r as UserRole));
  return found ?? 'field_engineer';
}

export function mapOidcClaimsToAuthUser(claims: OidcClaims, config: AppConfig): AuthUser {
  const email = claims.email ?? '';
  const name = claims.name ?? claims.preferred_username ?? email ?? 'Unknown';
  const orgId = claims.orgId ?? 'a0000000-0000-4000-8000-000000000001';
  const role = pickRoleFromClaims(claims, config);

  return {
    sub: String(claims.sub ?? ''),
    orgId,
    email,
    role,
    name,
  };
}

export async function verifyOidcAccessToken(params: {
  config: AppConfig;
  token: string;
}): Promise<AuthUser> {
  const issuer = params.config.OIDC_ISSUER;
  if (!issuer) throw new Error('OIDC_ISSUER not configured');

  const jwks = await getJwks(issuer);
  const { payload } = await jwtVerify<OidcClaims>(params.token, jwks, {
    issuer,
    audience: params.config.OIDC_CLIENT_ID,
  });

  return mapOidcClaimsToAuthUser(payload, params.config);
}

