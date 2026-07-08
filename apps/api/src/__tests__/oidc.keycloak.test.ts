import { describe, it } from 'vitest';

describe('OIDC / Keycloak integration', () => {
  it.todo('accepts a valid Keycloak JWT and maps realm role -> AuthUser.role (FR-060)');
  it.todo('rejects token with wrong issuer/audience/expiry (FR-060)');
  it.todo('supports hybrid: falls back to internal JWT when OIDC token verify fails');
  it.todo('orgId claim is required for tenant isolation (FR-071)');
});

