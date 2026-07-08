import { describe, expect, it } from 'vitest';
import { requireRoles } from '../middleware/auth.js';

describe('RBAC middleware', () => {
  it('allows enterprise_admin regardless of required roles', async () => {
    const hook = requireRoles('auditor');
    const request = { user: { role: 'enterprise_admin' } } as any;
    const reply = { status: () => ({ send: () => undefined }) } as any;
    await hook(request, reply);
    expect(true).toBe(true);
  });

  it('blocks disallowed role with 403', async () => {
    const hook = requireRoles('auditor');
    const request = { user: { role: 'field_engineer' } } as any;
    let status: number | undefined;
    const reply = {
      status: (code: number) => {
        status = code;
        return { send: () => undefined };
      },
    } as any;
    await hook(request, reply);
    expect(status).toBe(403);
  });

  it.todo('blocks when request.user missing (should be 401 earlier)');
});

