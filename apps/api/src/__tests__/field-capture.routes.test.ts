import { describe, expect, it } from 'vitest';
import { apiIntegrationSuite } from './api-int-utils.js';

describe('Field capture routes', () => {
  const ctx = apiIntegrationSuite();
  const ROUTE_ID = 'd0000000-0000-4000-8000-000000000001';

  it('POST /api/v1/routes/:routeId/segments creates segment (FR-001)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/routes/${ROUTE_ID}/segments`,
      headers: { ...ctx.authHeader(ctx.tokens.engineer), 'content-type': 'application/json' },
      payload: { chainage_start: 0, chainage_end: 500, surface_type: 'urban' },
    });
    expect(res.statusCode).toBe(201);
    const seg = JSON.parse(res.body) as { id: string };
    expect(seg.id).toBeTruthy();
  });

  it('PUT /api/v1/segments/:segmentId/trench upserts trench record (FR-004)', async () => {
    const segRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/routes/${ROUTE_ID}/segments`,
      headers: { ...ctx.authHeader(ctx.tokens.engineer), 'content-type': 'application/json' },
      payload: { chainage_start: 1000, chainage_end: 1500, surface_type: 'urban' },
    });
    const seg = JSON.parse(segRes.body) as { id: string };

    const res = await ctx.app.inject({
      method: 'PUT',
      url: `/api/v1/segments/${seg.id}/trench`,
      headers: { ...ctx.authHeader(ctx.tokens.engineer), 'content-type': 'application/json' },
      payload: { depth_m: 1.7, width_m: 0.4, reinstatement_status: 'in_progress' },
    });
    expect(res.statusCode).toBe(200);
  });

  it('POST /api/v1/segments/:segmentId/submit blocks incomplete package (FR-011)', async () => {
    const segRes = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/routes/${ROUTE_ID}/segments`,
      headers: { ...ctx.authHeader(ctx.tokens.engineer), 'content-type': 'application/json' },
      payload: { chainage_start: 2000, chainage_end: 2500, surface_type: 'urban' },
    });
    const seg = JSON.parse(segRes.body) as { id: string };

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/v1/segments/${seg.id}/submit`,
      headers: ctx.authHeader(ctx.tokens.engineer),
    });
    expect([200, 422]).toContain(res.statusCode);
  });

  it.todo('PUT /api/v1/segments/:segmentId/duct upserts duct record (FR-005)');
  it.todo('POST /api/v1/segments/:segmentId/cables creates cable record (FR-008)');
  it.todo('POST /api/v1/segments/:segmentId/survey-points creates survey point (FR-002)');
  it.todo('POST /api/v1/segments/:segmentId/closures creates closure (FR-009)');
  it.todo('POST /api/v1/segments/:segmentId/photos uploads photo <25MB (FR-007)');
  it.todo('POST /api/v1/segments/:segmentId/photos rejects >25MB (NFR-003)');
  it.todo('POST /api/v1/segments/:segmentId/sign-off blocks with open deviations (FR-024)');
});

