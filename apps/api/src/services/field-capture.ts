import type { DbClient } from '../db/pool.js';

export async function getSegmentDetail(client: DbClient, orgId: string, segmentId: string) {
  const { rows: segments } = await client.query(
    `SELECT * FROM segments WHERE org_id = $1 AND id = $2`,
    [orgId, segmentId],
  );
  if (!segments[0]) return null;

  const segment = segments[0];

  const [trench, duct, cables, photos, deviations, surveys, closures] = await Promise.all([
    client.query(`SELECT * FROM trench_records WHERE segment_id = $1`, [segmentId]),
    client.query(`SELECT * FROM duct_records WHERE segment_id = $1`, [segmentId]),
    client.query(`SELECT * FROM cable_lay_records WHERE segment_id = $1`, [segmentId]),
    client.query(`SELECT id, phase, file_ref, captured_at FROM photo_evidence WHERE segment_id = $1`, [segmentId]),
    client.query(`SELECT * FROM deviations WHERE segment_id = $1 ORDER BY created_at DESC`, [segmentId]),
    client.query(
      `SELECT id, ST_Y(location::geometry) AS latitude, ST_X(location::geometry) AS longitude, accuracy_m, captured_at
       FROM survey_points WHERE segment_id = $1`,
      [segmentId],
    ),
    client.query(`SELECT * FROM joint_closures WHERE segment_id = $1`, [segmentId]),
  ]);

  return {
    ...segment,
    trench: trench.rows[0] ?? null,
    duct: duct.rows[0] ?? null,
    cables: cables.rows,
    photos: photos.rows,
    deviations: deviations.rows,
    survey_points: surveys.rows,
    closures: closures.rows,
  };
}

export async function upsertDuctRecord(
  client: DbClient,
  orgId: string,
  segmentId: string,
  data: { duct_type: string; diameter_mm?: number; duct_count?: number; protection_method?: string },
): Promise<void> {
  await client.query(
    `INSERT INTO duct_records (org_id, segment_id, duct_type, diameter_mm, duct_count, protection_method)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (segment_id) DO UPDATE SET
       duct_type = EXCLUDED.duct_type,
       diameter_mm = EXCLUDED.diameter_mm,
       duct_count = EXCLUDED.duct_count,
       protection_method = EXCLUDED.protection_method,
       updated_at = NOW()`,
    [orgId, segmentId, data.duct_type, data.diameter_mm ?? null, data.duct_count ?? 1, data.protection_method ?? null],
  );
  await client.query(
    `UPDATE segments SET updated_at = NOW() WHERE id = $1`,
    [segmentId],
  );
  await import('./abd.js').then((m) => m.updateSegmentCompleteness(client, segmentId));
}

export async function createCableRecord(
  client: DbClient,
  orgId: string,
  segmentId: string,
  data: {
    core_count: number;
    laid_length_m: number;
    manufacturer?: string;
    sheath_type?: string;
    drum_number?: string;
  },
) {
  const { rows } = await client.query(
    `INSERT INTO cable_lay_records (org_id, segment_id, core_count, laid_length_m, manufacturer, sheath_type, drum_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      orgId,
      segmentId,
      data.core_count,
      data.laid_length_m,
      data.manufacturer ?? null,
      data.sheath_type ?? null,
      data.drum_number ?? null,
    ],
  );
  await import('./abd.js').then((m) => m.updateSegmentCompleteness(client, segmentId));
  return rows[0];
}

export async function addSurveyPoint(
  client: DbClient,
  orgId: string,
  segmentId: string,
  data: { latitude: number; longitude: number; altitude_m?: number; accuracy_m?: number },
) {
  const { rows } = await client.query(
    `INSERT INTO survey_points (org_id, segment_id, location, altitude_m, accuracy_m)
     VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6)
     RETURNING id, captured_at`,
    [orgId, segmentId, data.longitude, data.latitude, data.altitude_m ?? null, data.accuracy_m ?? null],
  );
  return rows[0];
}

export async function createJointClosure(
  client: DbClient,
  orgId: string,
  segmentId: string,
  userId: string,
  data: {
    latitude: number;
    longitude: number;
    closure_type: string;
    splice_count: number;
  },
) {
  const { rows } = await client.query(
    `INSERT INTO joint_closures (org_id, segment_id, location, closure_type, splice_count, technician_id)
     VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7)
     RETURNING *`,
    [orgId, segmentId, data.longitude, data.latitude, data.closure_type, data.splice_count, userId],
  );
  return rows[0];
}

export async function submitSegment(client: DbClient, orgId: string, segmentId: string) {
  const detail = await getSegmentDetail(client, orgId, segmentId);
  if (!detail) throw new Error('Segment not found');

  const missing: string[] = [];
  if (!detail.trench) missing.push('trench');
  if (!detail.duct) missing.push('duct');
  if (detail.photos.length === 0) missing.push('photos');
  if (detail.cables.length === 0) missing.push('cable');

  if (missing.length > 0) {
    return { ok: false as const, missing, segment: detail };
  }

  const { rows } = await client.query(
    `UPDATE segments SET status = 'submitted', updated_at = NOW() WHERE org_id = $1 AND id = $2 RETURNING *`,
    [orgId, segmentId],
  );
  return { ok: true as const, segment: rows[0] };
}

export async function signOffSegment(client: DbClient, orgId: string, segmentId: string) {
  const { rows: openDeviations } = await client.query(
    `SELECT id FROM deviations WHERE org_id = $1 AND segment_id = $2 AND status NOT IN ('approved', 'rejected')`,
    [orgId, segmentId],
  );

  if (openDeviations.length > 0) {
    return { ok: false as const, reason: 'open_deviations', count: openDeviations.length };
  }

  const { rows } = await client.query(
    `UPDATE segments SET status = 'signed_off', updated_at = NOW() WHERE org_id = $1 AND id = $2 RETURNING *`,
    [orgId, segmentId],
  );
  return { ok: true as const, segment: rows[0] };
}

export async function listAssets(client: DbClient, orgId: string) {
  const { rows } = await client.query(`SELECT * FROM asset_master WHERE org_id = $1 ORDER BY created_at DESC`, [orgId]);
  return rows;
}

export async function createAsset(
  client: DbClient,
  orgId: string,
  data: { asset_type: string; serial_number: string; manufacturer?: string; specifications?: Record<string, unknown> },
) {
  const { rows } = await client.query(
    `INSERT INTO asset_master (org_id, asset_type, serial_number, manufacturer, specifications)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [orgId, data.asset_type, data.serial_number, data.manufacturer ?? null, data.specifications ? JSON.stringify(data.specifications) : null],
  );
  return rows[0];
}

export async function listNotifications(client: DbClient, orgId: string, userId: string) {
  const { rows } = await client.query(
    `SELECT * FROM notifications WHERE org_id = $1 AND (user_id IS NULL OR user_id = $2)
     ORDER BY created_at DESC LIMIT 50`,
    [orgId, userId],
  );
  return rows;
}
