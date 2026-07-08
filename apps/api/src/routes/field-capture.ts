import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { withOrgContext } from '../db/pool.js';
import { getAuthUser, requireRoles } from '../middleware/auth.js';
import * as field from '../services/field-capture.js';
import { emitAbdEvent } from '../services/webhooks.js';

// Field capture routes complete segment-level documentation artifacts.
export async function registerFieldCaptureRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/detail',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const detail = await withOrgContext(pool, user.orgId, (client) =>
        field.getSegmentDetail(client, user.orgId, request.params.segmentId),
      );
      if (!detail) {
        return reply.status(404).send({ type: 'https://digiabd.io/errors/not-found', title: 'Not Found', status: 404, detail: 'Segment not found' });
      }
      return detail;
    },
  );

  app.put<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/duct',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as { duct_type: string; diameter_mm?: number; duct_count?: number; protection_method?: string };
      if (!body?.duct_type) {
        return reply.status(400).send({ type: 'https://digiabd.io/errors/validation', title: 'Validation Error', status: 400, detail: 'duct_type is required' });
      }
      await withOrgContext(pool, user.orgId, (client) =>
        field.upsertDuctRecord(client, user.orgId, request.params.segmentId, body),
      );
      return reply.send({ message: 'Duct record saved' });
    },
  );

  app.post<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/cables',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as { core_count: number; laid_length_m: number; manufacturer?: string; sheath_type?: string; drum_number?: string };
      if (body?.core_count == null || body?.laid_length_m == null) {
        return reply.status(400).send({ type: 'https://digiabd.io/errors/validation', title: 'Validation Error', status: 400, detail: 'core_count and laid_length_m are required' });
      }
      const cable = await withOrgContext(pool, user.orgId, (client) =>
        field.createCableRecord(client, user.orgId, request.params.segmentId, body),
      );
      return reply.status(201).send(cable);
    },
  );

  app.post<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/survey-points',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as { latitude: number; longitude: number; altitude_m?: number; accuracy_m?: number };
      if (body?.latitude == null || body?.longitude == null) {
        return reply.status(400).send({ type: 'https://digiabd.io/errors/validation', title: 'Validation Error', status: 400, detail: 'latitude and longitude are required' });
      }
      const point = await withOrgContext(pool, user.orgId, (client) =>
        field.addSurveyPoint(client, user.orgId, request.params.segmentId, body),
      );
      return reply.status(201).send(point);
    },
  );

  app.post<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/closures',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as { latitude: number; longitude: number; closure_type: string; splice_count: number };
      if (!body?.closure_type || body?.latitude == null || body?.longitude == null) {
        return reply.status(400).send({ type: 'https://digiabd.io/errors/validation', title: 'Validation Error', status: 400, detail: 'closure_type, latitude, longitude are required' });
      }
      const closure = await withOrgContext(pool, user.orgId, (client) =>
        field.createJointClosure(client, user.orgId, request.params.segmentId, user.sub, body),
      );
      return reply.status(201).send(closure);
    },
  );

  app.post<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/submit',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const result = await withOrgContext(pool, user.orgId, (client) =>
        field.submitSegment(client, user.orgId, request.params.segmentId),
      );
      if (!result.ok) {
        // Submission gate prevents incomplete ABD packets from progressing.
        return reply.status(422).send({
          type: 'https://digiabd.io/errors/incomplete',
          title: 'Incomplete ABD Package',
          status: 422,
          detail: `Missing required records: ${result.missing.join(', ')}`,
          missing: result.missing,
        });
      }

      void emitAbdEvent(pool, user.orgId, 'abd.segment.submitted', {
        segment_id: result.segment.id,
        route_id: result.segment.route_id,
        completeness: result.segment.completeness,
      });

      return reply.send(result.segment);
    },
  );

  app.post<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/sign-off',
    { preHandler: [app.authenticate, requireRoles('inspector_oic')] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const result = await withOrgContext(pool, user.orgId, (client) =>
        field.signOffSegment(client, user.orgId, request.params.segmentId),
      );
      if (!result.ok) {
        // Final sign-off is blocked if unresolved deviations still exist.
        return reply.status(422).send({
          type: 'https://digiabd.io/errors/blocked',
          title: 'Sign-off Blocked',
          status: 422,
          detail: `${result.count} open deviation(s) must be resolved first`,
        });
      }

      void emitAbdEvent(pool, user.orgId, 'abd.segment.completed', {
        segment_id: result.segment.id,
        route_id: result.segment.route_id,
        status: 'signed_off',
      });

      return reply.send(result.segment);
    },
  );

  app.get('/api/v1/assets', { preHandler: [app.authenticate] }, async (request) => {
    const user = getAuthUser(request);
    return withOrgContext(pool, user.orgId, (client) => field.listAssets(client, user.orgId));
  });

  app.post('/api/v1/assets', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = getAuthUser(request);
    const body = request.body as { asset_type: string; serial_number: string; manufacturer?: string };
    if (!body?.asset_type || !body?.serial_number) {
      return reply.status(400).send({ type: 'https://digiabd.io/errors/validation', title: 'Validation Error', status: 400, detail: 'asset_type and serial_number are required' });
    }
    const asset = await withOrgContext(pool, user.orgId, (client) => field.createAsset(client, user.orgId, body));
    return reply.status(201).send(asset);
  });

  app.get('/api/v1/notifications', { preHandler: [app.authenticate] }, async (request) => {
    const user = getAuthUser(request);
    return withOrgContext(pool, user.orgId, (client) => field.listNotifications(client, user.orgId, user.sub));
  });
}
