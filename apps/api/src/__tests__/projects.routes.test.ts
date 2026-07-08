import { describe, expect, it } from 'vitest';
import { apiIntegrationSuite } from './api-int-utils.js';

describe('Project & route routes', () => {
  const ctx = apiIntegrationSuite();

  it('GET /api/v1/projects returns list for authenticated user (FR-070)', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: ctx.authHeader(ctx.tokens.engineer),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as unknown[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it('POST /api/v1/projects validates required fields (FR-070)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { ...ctx.authHeader(ctx.tokens.admin), 'content-type': 'application/json' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/v1/projects/:projectId/routes lists routes (FR-070)', async () => {
    const projectsRes = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: ctx.authHeader(ctx.tokens.engineer),
    });
    const projects = JSON.parse(projectsRes.body) as Array<{ id: string }>;
    const projectId = projects[0]?.id;
    expect(projectId).toBeTruthy();

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/v1/projects/${projectId}/routes`,
      headers: ctx.authHeader(ctx.tokens.engineer),
    });
    expect(res.statusCode).toBe(200);
    const routes = JSON.parse(res.body) as unknown[];
    expect(Array.isArray(routes)).toBe(true);
  });

  it('RBAC: unauthorized without bearer token (FR-060)', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/v1/projects' });
    expect(res.statusCode).toBe(401);
  });

  it('Tenant isolation: org-scoped project list differs by org (FR-071)', async () => {
    const resOrg1 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: ctx.authHeader(ctx.tokens.engineer),
    });
    expect(resOrg1.statusCode).toBe(200);
    const projectsOrg1 = JSON.parse(resOrg1.body) as Array<{ org_id?: string; orgId?: string; id: string }>;
    expect(projectsOrg1.length).toBeGreaterThan(0);

    const resOrg2 = await ctx.app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: ctx.authHeader(ctx.tokens.engineer2),
    });
    expect(resOrg2.statusCode).toBe(200);
    const projectsOrg2 = JSON.parse(resOrg2.body) as Array<{ org_id?: string; orgId?: string; id: string }>;
    expect(projectsOrg2.length).toBeGreaterThan(0);

    // With RLS + org-scoped queries, IDs should not overlap across orgs.
    const ids1 = new Set(projectsOrg1.map((p) => p.id));
    const overlap = projectsOrg2.some((p) => ids1.has(p.id));
    expect(overlap).toBe(false);
  });
});

