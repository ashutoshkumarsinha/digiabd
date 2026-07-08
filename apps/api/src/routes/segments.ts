import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { withOrgContext } from '../db/pool.js';
import { getAuthUser } from '../middleware/auth.js';
import * as abd from '../services/abd.js';

// Segment routes provide core construction-capture primitives.
export async function registerSegmentRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get<{ Params: { routeId: string } }>(
    '/api/v1/routes/:routeId/segments',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) =>
        abd.listSegments(client, user.orgId, request.params.routeId),
      );
    },
  );

  app.post<{ Params: { routeId: string } }>(
    '/api/v1/routes/:routeId/segments',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as {
        chainage_start: number;
        chainage_end: number;
        surface_type?: string;
      };

      if (body?.chainage_start == null || body?.chainage_end == null) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'chainage_start and chainage_end are required',
        });
      }

      const segment = await withOrgContext(pool, user.orgId, (client) =>
        abd.createSegment(client, user.orgId, user.sub, {
          route_id: request.params.routeId,
          ...body,
        }),
      );

      return reply.status(201).send(segment);
    },
  );

  app.get<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const segment = await withOrgContext(pool, user.orgId, (client) =>
        abd.getSegment(client, user.orgId, request.params.segmentId),
      );

      if (!segment) {
        return reply.status(404).send({
          type: 'https://digiabd.io/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Segment not found',
        });
      }

      return segment;
    },
  );

  app.put<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/trench',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as {
        depth_m: number;
        width_m?: number;
        bedding_type?: string;
        reinstatement_status?: string;
      };

      if (body?.depth_m == null) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'depth_m is required',
        });
      }

      // Upsert means we create the trench row once, then update same row later.
      await withOrgContext(pool, user.orgId, (client) =>
        abd.upsertTrenchRecord(client, user.orgId, request.params.segmentId, body),
      );

      const segment = await withOrgContext(pool, user.orgId, (client) =>
        abd.getSegment(client, user.orgId, request.params.segmentId),
      );

      return reply.send({ message: 'Trench record saved', segment });
    },
  );

  app.put<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/hdd-crossing',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as {
        entry_latitude: number;
        entry_longitude: number;
        exit_latitude: number;
        exit_longitude: number;
        bore_length_m: number;
        depth_m?: number;
        pipe_spec?: string;
      };
      if (
        body?.entry_latitude == null ||
        body?.entry_longitude == null ||
        body?.exit_latitude == null ||
        body?.exit_longitude == null ||
        body?.bore_length_m == null
      ) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'entry/exit coordinates and bore_length_m are required',
        });
      }
      await withOrgContext(pool, user.orgId, (client) =>
        abd.upsertHddCrossing(client, user.orgId, request.params.segmentId, body),
      );
      return reply.send({ message: 'HDD crossing record saved' });
    },
  );

  app.get<{ Params: { entityType: string; entityId: string } }>(
    '/api/v1/versions/:entityType/:entityId',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) =>
        abd.listRecordVersions(client, user.orgId, request.params.entityType, request.params.entityId),
      );
    },
  );
}
