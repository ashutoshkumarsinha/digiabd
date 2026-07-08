import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { AppConfig } from '../config.js';
import { withOrgContext } from '../db/pool.js';
import { getAuthUser, requireRoles } from '../middleware/auth.js';
import * as resilience from '../services/resilience.js';

export async function registerResilienceRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  config: AppConfig,
): Promise<void> {
  app.get('/api/v1/gis/wms/capabilities', { preHandler: [app.authenticate] }, async () => {
    return {
      service: 'WMS',
      version: '1.3.0',
      title: 'Digital ABD GIS Service',
      layers: ['centerline', 'segments', 'closures', 'crossings'],
      formats: ['application/json', 'image/png'],
      note: 'Phase 3 stub endpoint; connect to GeoServer/MapServer in production.',
    };
  });

  app.get<{ Params: { routeId: string } }>(
    '/api/v1/gis/routes/:routeId/geojson',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, async (client) => {
        const geojson = await resilience.buildRouteGeoJson(client, user.orgId, request.params.routeId);
        const featureCount =
          typeof geojson === 'object' &&
          geojson !== null &&
          'features' in geojson &&
          Array.isArray((geojson as { features: unknown[] }).features)
            ? (geojson as { features: unknown[] }).features.length
            : 0;
        await resilience.registerGisLayerSnapshot(
          client,
          user.orgId,
          request.params.routeId,
          user.sub,
          'segments',
          featureCount,
        );
        return geojson;
      });
    },
  );

  app.post<{ Params: { routeId: string } }>(
    '/api/v1/cad/routes/:routeId/generate',
    { preHandler: [app.authenticate, requireRoles('gis_engineer', 'inspector_oic', 'program_manager')] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const artifact = await withOrgContext(pool, user.orgId, (client) =>
        resilience.generateCadArtifact(client, config, user.orgId, request.params.routeId, user.sub),
      );
      return reply.status(201).send(artifact);
    },
  );

  app.get<{ Params: { routeId: string } }>(
    '/api/v1/cad/routes/:routeId/artifacts',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) =>
        resilience.listCadArtifacts(client, user.orgId, request.params.routeId),
      );
    },
  );

  app.post<{ Params: { routeId: string } }>(
    '/api/v1/etl/routes/:routeId/jobs',
    { preHandler: [app.authenticate, requireRoles('gis_engineer', 'program_manager')] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as { job_type?: 'gis_layer_refresh' | 'cad_generation' | 'data_quality_scan' };
      const jobType = body.job_type ?? 'gis_layer_refresh';
      const job = await withOrgContext(pool, user.orgId, (client) =>
        resilience.queueEtlJob(client, user.orgId, request.params.routeId, user.sub, jobType),
      );
      return reply.status(201).send(job);
    },
  );

  app.get('/api/v1/etl/jobs', { preHandler: [app.authenticate] }, async (request) => {
    const user = getAuthUser(request);
    const query = request.query as { route_id?: string };
    return withOrgContext(pool, user.orgId, (client) =>
      resilience.listEtlJobs(client, user.orgId, query.route_id),
    );
  });
}
