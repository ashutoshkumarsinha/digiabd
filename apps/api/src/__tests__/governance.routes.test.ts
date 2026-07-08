import { describe, expect, it } from 'vitest';
import { apiIntegrationSuite } from './api-int-utils.js';

describe('Governance routes (Phase 4)', () => {
  const ctx = apiIntegrationSuite();
  const PROJECT_ID = 'c0000000-0000-4000-8000-000000000001';
  const ROUTE_ID = 'd0000000-0000-4000-8000-000000000001';

  it('GET /api/v1/governance/dashboard returns KPIs (FR-050)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/governance/dashboard',
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/v1/governance/projects/:projectId/sla returns SLA metrics (FR-052)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/governance/projects/${PROJECT_ID}/sla`,
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/v1/governance/segments/:segmentId/compliance returns compliance checks (FR-050, FR-055)', async () => {
    const segRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/routes/${ROUTE_ID}/segments`,
      headers: { ...ctx.authHeader(ctx.tokens.engineer), 'content-type': 'application/json' },
      payload: { chainage_start: 3000, chainage_end: 3500, surface_type: 'urban' },
    });
    expect(segRes.statusCode).toBe(201);
    const seg = JSON.parse(segRes.body) as { id: string };

    const trenchRes = await ctx.app.inject({
      method: 'PUT',
      url: `/api/v1/segments/${seg.id}/trench`,
      headers: { ...ctx.authHeader(ctx.tokens.engineer), 'content-type': 'application/json' },
      payload: { depth_m: 1.7, width_m: 0.4, reinstatement_status: 'completed' },
    });
    expect(trenchRes.statusCode).toBe(200);

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/governance/segments/${seg.id}/compliance`,
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/v1/governance/escalations/evaluate evaluates rules (FR-053, FR-055)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/governance/escalations/evaluate',
      headers: { ...ctx.authHeader(ctx.tokens.admin), 'content-type': 'application/json' },
      payload: { project_id: PROJECT_ID },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { triggered_count: number };
    expect(body.triggered_count).toBeGreaterThanOrEqual(0);

    const notifications = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(notifications.statusCode).toBe(200);
    const parsed = JSON.parse(notifications.body) as Array<{ event_type: string }>;
    expect(parsed.some((n) => n.event_type === 'governance.escalation.triggered')).toBe(true);
  });

  it('GET /api/v1/governance/escalations lists events (FR-053)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/governance/escalations',
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST acknowledge/resolve manages escalation lifecycle (FR-053)', async () => {
    const listRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/governance/escalations?status=open',
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(listRes.statusCode).toBe(200);
    const events = JSON.parse(listRes.body) as Array<{ id: string; status: string }>;
    expect(events.length).toBeGreaterThan(0);

    const eventId = events[0].id;
    const ackRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/governance/escalations/${eventId}/acknowledge`,
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(ackRes.statusCode).toBe(200);
    expect(JSON.parse(ackRes.body).status).toBe('acknowledged');

    const resolveRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/governance/escalations/${eventId}/resolve`,
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(resolveRes.statusCode).toBe(200);
    const resolved = JSON.parse(resolveRes.body) as { status: string; resolved_at: string | null };
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolved_at).toBeTruthy();

    const repeatResolve = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/governance/escalations/${eventId}/resolve`,
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(repeatResolve.statusCode).toBe(409);
  });

  it('GET /api/v1/governance/executive/summary returns rollup (FR-077)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/governance/executive/summary',
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /api/v1/governance/noc/rca-hints returns hints (FR-054)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/governance/noc/rca-hints?chainage=2500',
      headers: ctx.authHeader(ctx.tokens.admin),
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/v1/governance/audit/export returns audit artifact (FR-033 partial)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/governance/audit/export',
      headers: { ...ctx.authHeader(ctx.tokens.admin), 'content-type': 'application/json' },
      payload: { project_id: PROJECT_ID },
    });
    expect([200, 201]).toContain(res.statusCode);
  });

  it('RBAC: engineer cannot access governance dashboard (FR-060)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/governance/dashboard',
      headers: ctx.authHeader(ctx.tokens.engineer),
    });
    expect(res.statusCode).toBe(403);
  });
});

