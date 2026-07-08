import type { DbClient } from '../db/pool.js';
import { checksum, createStorageClient, uploadFile } from './storage.js';
import type { AppConfig } from '../config.js';

export async function queueEtlJob(
  client: DbClient,
  orgId: string,
  routeId: string,
  userId: string,
  jobType: 'gis_layer_refresh' | 'cad_generation' | 'data_quality_scan',
) {
  const { rows } = await client.query(
    `INSERT INTO etl_jobs (org_id, route_id, job_type, requested_by, status)
     VALUES ($1, $2, $3, $4, 'queued')
     RETURNING *`,
    [orgId, routeId, jobType, userId],
  );
  return rows[0];
}

export async function listEtlJobs(client: DbClient, orgId: string, routeId?: string) {
  const { rows } = await client.query(
    routeId
      ? `SELECT * FROM etl_jobs WHERE org_id = $1 AND route_id = $2 ORDER BY created_at DESC LIMIT 50`
      : `SELECT * FROM etl_jobs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`,
    routeId ? [orgId, routeId] : [orgId],
  );
  return rows;
}

export async function buildRouteGeoJson(client: DbClient, orgId: string, routeId: string) {
  const { rows } = await client.query<{ featurecollection: unknown }>(
    `WITH segment_features AS (
       SELECT jsonb_build_object(
         'type', 'Feature',
         'properties', jsonb_build_object(
           'segment_id', s.id,
           'chainage_start', s.chainage_start,
           'chainage_end', s.chainage_end,
           'status', s.status,
           'completeness', s.completeness
         ),
         'geometry', ST_AsGeoJSON(r.centerline)::jsonb
       ) AS feature
       FROM segments s
       JOIN routes r ON r.id = s.route_id
       WHERE s.org_id = $1 AND s.route_id = $2 AND r.centerline IS NOT NULL
    )
    SELECT jsonb_build_object(
      'type', 'FeatureCollection',
      'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
    ) AS featurecollection
    FROM segment_features`,
    [orgId, routeId],
  );
  return rows[0]?.featurecollection ?? { type: 'FeatureCollection', features: [] };
}

export async function registerGisLayerSnapshot(
  client: DbClient,
  orgId: string,
  routeId: string,
  userId: string,
  layerType: 'centerline' | 'segments' | 'closures' | 'crossings',
  featureCount: number,
) {
  const { rows } = await client.query(
    `INSERT INTO gis_layers (org_id, route_id, layer_type, feature_count, generated_by, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [orgId, routeId, layerType, featureCount, userId, JSON.stringify({ source: 'api', version: 'phase3' })],
  );
  return rows[0];
}

export async function generateCadArtifact(
  client: DbClient,
  config: AppConfig,
  orgId: string,
  routeId: string,
  userId: string,
) {
  const storage = createStorageClient(config);
  const payload = {
    route_id: routeId,
    generated_at: new Date().toISOString(),
    note: 'Phase 3 CAD artifact placeholder; replace with AutoCAD/DXF generator pipeline.',
  };
  const buffer = Buffer.from(JSON.stringify(payload, null, 2), 'utf8');
  const hash = checksum(buffer);
  const key = `${orgId}/cad/${routeId}/${Date.now()}-asbuilt.json`;

  if (storage) {
    await uploadFile(storage, config.S3_BUCKET, key, buffer, 'application/json');
  }

  const { rows } = await client.query(
    `INSERT INTO cad_artifacts (org_id, route_id, format, file_ref, file_checksum, generated_by)
     VALUES ($1, $2, 'json', $3, $4, $5)
     RETURNING *`,
    [orgId, routeId, key, hash, userId],
  );
  return rows[0];
}

export async function listCadArtifacts(client: DbClient, orgId: string, routeId: string) {
  const { rows } = await client.query(
    `SELECT * FROM cad_artifacts WHERE org_id = $1 AND route_id = $2 ORDER BY created_at DESC`,
    [orgId, routeId],
  );
  return rows;
}
