import type { DbClient } from '../db/pool.js';
import { checksum, createStorageClient, uploadFile } from './storage.js';
import type { AppConfig } from '../config.js';
import JSZip from 'jszip';

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

export async function buildPlannedVsActualOverlay(client: DbClient, orgId: string, routeId: string) {
  const planned = await client.query(
    `SELECT ST_AsGeoJSON(centerline)::jsonb AS geometry
     FROM routes
     WHERE org_id = $1 AND id = $2`,
    [orgId, routeId],
  );
  const actual = await client.query(
    `SELECT ST_AsGeoJSON(ST_MakeLine(sp.location ORDER BY sp.captured_at))::jsonb AS geometry
     FROM survey_points sp
     JOIN segments s ON s.id = sp.segment_id
     WHERE s.org_id = $1 AND s.route_id = $2`,
    [orgId, routeId],
  );
  const plannedGeom = planned.rows[0]?.geometry ?? null;
  const actualGeom = actual.rows[0]?.geometry ?? null;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { layer: 'planned' },
        geometry: plannedGeom,
      },
      {
        type: 'Feature',
        properties: { layer: 'actual' },
        geometry: actualGeom,
      },
    ],
  };
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
  const payload = [
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    '0',
    'LINE',
    '8',
    'ABD_ROUTE',
    '10',
    '0',
    '20',
    '0',
    '11',
    '100',
    '21',
    '0',
    '0',
    'ENDSEC',
    '0',
    'EOF',
  ].join('\n');
  const buffer = Buffer.from(payload, 'utf8');
  const hash = checksum(buffer);
  const key = `${orgId}/cad/${routeId}/${Date.now()}-asbuilt.dxf`;

  if (storage) {
    await uploadFile(storage, config.S3_BUCKET, key, buffer, 'application/dxf');
  }

  const { rows } = await client.query(
    `INSERT INTO cad_artifacts (org_id, route_id, format, file_ref, file_checksum, generated_by)
     VALUES ($1, $2, 'dxf', $3, $4, $5)
     RETURNING *`,
    [orgId, routeId, key, hash, userId],
  );
  return rows[0];
}

export async function exportGisLayer(
  client: DbClient,
  config: AppConfig,
  orgId: string,
  routeId: string,
  format: 'geojson' | 'kml' | 'shapefile',
) {
  const storage = createStorageClient(config);
  const geojson = await buildRouteGeoJson(client, orgId, routeId);
  const ts = Date.now();
  let content: Buffer;
  let key: string;
  let contentType: string;

  if (format === 'geojson') {
    content = Buffer.from(JSON.stringify(geojson, null, 2), 'utf8');
    key = `${orgId}/gis/${routeId}/${ts}-segments.geojson`;
    contentType = 'application/geo+json';
  } else if (format === 'kml') {
    const kml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<kml xmlns="http://www.opengis.net/kml/2.2">',
      '<Document>',
      `<name>Route ${routeId}</name>`,
      '<Placemark><name>Route export</name><description>Generated KML export</description></Placemark>',
      '</Document>',
      '</kml>',
    ].join('\n');
    content = Buffer.from(kml, 'utf8');
    key = `${orgId}/gis/${routeId}/${ts}-segments.kml`;
    contentType = 'application/vnd.google-earth.kml+xml';
  } else {
    const zip = new JSZip();
    zip.file('segments.geojson', JSON.stringify(geojson, null, 2));
    zip.file('README.txt', 'Shapefile export placeholder bundle. Replace with real .shp/.dbf/.shx ETL output.');
    content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    key = `${orgId}/gis/${routeId}/${ts}-segments-shapefile.zip`;
    contentType = 'application/zip';
  }

  if (storage) {
    await uploadFile(storage, config.S3_BUCKET, key, content, contentType);
  }

  return {
    route_id: routeId,
    format,
    file_ref: key,
    content_type: contentType,
    checksum_sha256: checksum(content),
    generated_at: new Date().toISOString(),
  };
}

export async function listCadArtifacts(client: DbClient, orgId: string, routeId: string) {
  const { rows } = await client.query(
    `SELECT * FROM cad_artifacts WHERE org_id = $1 AND route_id = $2 ORDER BY created_at DESC`,
    [orgId, routeId],
  );
  return rows;
}
