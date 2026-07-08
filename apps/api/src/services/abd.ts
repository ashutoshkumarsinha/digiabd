import type { DbClient } from '../db/pool.js';
import type { Deviation, NocLookupResult, Project, Route, Segment, UserRole } from '../types/index.js';

export async function listProjects(client: DbClient, orgId: string): Promise<Project[]> {
  const { rows } = await client.query<Project>(
    `SELECT * FROM projects WHERE org_id = $1 ORDER BY created_at DESC`,
    [orgId],
  );
  return rows;
}

export async function createProject(
  client: DbClient,
  orgId: string,
  data: {
    name: string;
    client_name?: string;
    vendor_name?: string;
    project_type?: string;
    business_unit_id?: string;
  },
): Promise<Project> {
  const { rows } = await client.query<Project>(
    `INSERT INTO projects (org_id, name, client_name, vendor_name, project_type, business_unit_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     RETURNING *`,
    [
      orgId,
      data.name,
      data.client_name ?? null,
      data.vendor_name ?? null,
      data.project_type ?? 'urban',
      data.business_unit_id ?? null,
    ],
  );
  return rows[0];
}

export async function listRoutes(client: DbClient, orgId: string, projectId: string): Promise<Route[]> {
  const { rows } = await client.query<Route>(
    `SELECT * FROM routes WHERE org_id = $1 AND project_id = $2 ORDER BY created_at DESC`,
    [orgId, projectId],
  );
  return rows;
}

export async function createRoute(
  client: DbClient,
  orgId: string,
  data: { project_id: string; name: string; total_length_km?: number },
): Promise<Route> {
  const { rows } = await client.query<Route>(
    `INSERT INTO routes (org_id, project_id, name, total_length_km, status)
     VALUES ($1, $2, $3, $4, 'draft')
     RETURNING *`,
    [orgId, data.project_id, data.name, data.total_length_km ?? null],
  );
  return rows[0];
}

export async function listSegments(client: DbClient, orgId: string, routeId: string): Promise<Segment[]> {
  const { rows } = await client.query<Segment>(
    `SELECT * FROM segments WHERE org_id = $1 AND route_id = $2 ORDER BY chainage_start`,
    [orgId, routeId],
  );
  return rows;
}

export async function createSegment(
  client: DbClient,
  orgId: string,
  userId: string,
  data: {
    route_id: string;
    chainage_start: number;
    chainage_end: number;
    surface_type?: string;
  },
): Promise<Segment> {
  const { rows } = await client.query<Segment>(
    `INSERT INTO segments (org_id, route_id, chainage_start, chainage_end, surface_type, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft')
     RETURNING *`,
    [orgId, data.route_id, data.chainage_start, data.chainage_end, data.surface_type ?? null, userId],
  );
  return rows[0];
}

export async function getSegment(client: DbClient, orgId: string, segmentId: string): Promise<Segment | null> {
  const { rows } = await client.query<Segment>(
    `SELECT * FROM segments WHERE org_id = $1 AND id = $2`,
    [orgId, segmentId],
  );
  return rows[0] ?? null;
}

export async function upsertTrenchRecord(
  client: DbClient,
  orgId: string,
  segmentId: string,
  data: { depth_m: number; width_m?: number; bedding_type?: string; reinstatement_status?: string },
): Promise<void> {
  const before = await client.query(`SELECT * FROM trench_records WHERE segment_id = $1`, [segmentId]);
  await client.query(
    `INSERT INTO trench_records (org_id, segment_id, depth_m, width_m, bedding_type, reinstatement_status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (segment_id) DO UPDATE SET
       depth_m = EXCLUDED.depth_m,
       width_m = EXCLUDED.width_m,
       bedding_type = EXCLUDED.bedding_type,
       reinstatement_status = EXCLUDED.reinstatement_status,
       updated_at = NOW()`,
    [
      orgId,
      segmentId,
      data.depth_m,
      data.width_m ?? null,
      data.bedding_type ?? null,
      data.reinstatement_status ?? 'pending',
    ],
  );
  await updateSegmentCompleteness(client, segmentId);
  const after = await client.query(`SELECT * FROM trench_records WHERE segment_id = $1`, [segmentId]);
  if (after.rows[0]) {
    await writeRecordVersion(client, {
      org_id: orgId,
      entity_type: 'trench_record',
      entity_id: after.rows[0].id,
      change_reason: 'trench_upsert',
      before_state: before.rows[0] ?? null,
      after_state: after.rows[0],
    });
  }
}

export async function upsertHddCrossing(
  client: DbClient,
  orgId: string,
  segmentId: string,
  data: {
    entry_latitude: number;
    entry_longitude: number;
    exit_latitude: number;
    exit_longitude: number;
    bore_length_m: number;
    depth_m?: number;
    pipe_spec?: string;
  },
): Promise<void> {
  const before = await client.query(`SELECT * FROM hdd_crossings WHERE org_id = $1 AND segment_id = $2 LIMIT 1`, [orgId, segmentId]);
  if (before.rows[0]) {
    await client.query(
      `UPDATE hdd_crossings
       SET entry_point = ST_SetSRID(ST_MakePoint($3, $4), 4326),
           exit_point = ST_SetSRID(ST_MakePoint($5, $6), 4326),
           bore_length_m = $7,
           depth_m = $8,
           pipe_spec = $9
       WHERE org_id = $1 AND segment_id = $2`,
      [
        orgId,
        segmentId,
        data.entry_longitude,
        data.entry_latitude,
        data.exit_longitude,
        data.exit_latitude,
        data.bore_length_m,
        data.depth_m ?? null,
        data.pipe_spec ?? null,
      ],
    );
  } else {
    await client.query(
      `INSERT INTO hdd_crossings (org_id, segment_id, entry_point, exit_point, bore_length_m, depth_m, pipe_spec)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, $8, $9)`,
      [
        orgId,
        segmentId,
        data.entry_longitude,
        data.entry_latitude,
        data.exit_longitude,
        data.exit_latitude,
        data.bore_length_m,
        data.depth_m ?? null,
        data.pipe_spec ?? null,
      ],
    );
  }
  const after = await client.query(`SELECT * FROM hdd_crossings WHERE org_id = $1 AND segment_id = $2 LIMIT 1`, [orgId, segmentId]);
  if (after.rows[0]) {
    await writeRecordVersion(client, {
      org_id: orgId,
      entity_type: 'hdd_crossing',
      entity_id: after.rows[0].id,
      change_reason: 'hdd_upsert',
      before_state: before.rows[0] ?? null,
      after_state: after.rows[0],
    });
  }
}

export async function updateSegmentCompleteness(client: DbClient, segmentId: string): Promise<void> {
  await client.query(
    `UPDATE segments SET completeness = (
       SELECT ROUND(
         (
           (CASE WHEN EXISTS (SELECT 1 FROM trench_records t WHERE t.segment_id = s.id) THEN 25 ELSE 0 END) +
           (CASE WHEN EXISTS (SELECT 1 FROM duct_records d WHERE d.segment_id = s.id) THEN 25 ELSE 0 END) +
           (CASE WHEN EXISTS (SELECT 1 FROM photo_evidence p WHERE p.segment_id = s.id) THEN 25 ELSE 0 END) +
           (CASE WHEN EXISTS (SELECT 1 FROM cable_lay_records c WHERE c.segment_id = s.id) THEN 25 ELSE 0 END)
         )::numeric, 2
       )
       FROM segments s WHERE s.id = $1
     ), updated_at = NOW()
     WHERE id = $1`,
    [segmentId],
  );
}

export async function createDeviation(
  client: DbClient,
  orgId: string,
  userId: string,
  data: {
    segment_id: string;
    category: string;
    description: string;
    justification?: string;
    severity?: string;
  },
): Promise<Deviation> {
  const chain = await getProjectApprovalChainForSegment(client, orgId, data.segment_id);
  const { rows } = await client.query<Deviation>(
    `INSERT INTO deviations (org_id, segment_id, category, description, justification, severity, status, created_by, approval_chain, approval_stage_index)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending_approval', $7, $8, 0)
     RETURNING *`,
    [
      orgId,
      data.segment_id,
      data.category,
      data.description,
      data.justification ?? null,
      data.severity ?? 'medium',
      userId,
      chain,
    ],
  );
  await writeRecordVersion(client, {
    org_id: orgId,
    entity_type: 'deviation',
    entity_id: rows[0].id,
    changed_by: userId,
    change_reason: 'deviation_create',
    after_state: rows[0],
  });
  return rows[0];
}

export async function approveDeviation(
  client: DbClient,
  orgId: string,
  userId: string,
  userRole: UserRole,
  deviationId: string,
  decision: 'approved' | 'rejected' | 'returned',
  comments?: string,
): Promise<Deviation> {
  const { rows: beforeRows } = await client.query(
    `SELECT * FROM deviations WHERE org_id = $1 AND id = $2`,
    [orgId, deviationId],
  );
  const before = beforeRows[0];
  if (!before) throw new Error('Deviation not found');

  const chain = (before.approval_chain as UserRole[] | null) ?? ['site_supervisor', 'inspector_oic'];
  const stage = Number(before.approval_stage_index ?? 0);
  const expectedRole = chain[Math.min(stage, chain.length - 1)];
  if (decision === 'approved' && expectedRole && expectedRole !== userRole) {
    throw new Error(`Approval must be performed by role: ${expectedRole}`);
  }

  const nextStage = decision === 'approved' ? stage + 1 : stage;
  const finalApproved = decision === 'approved' && nextStage >= chain.length;
  const status = finalApproved ? 'approved' : decision === 'rejected' ? 'rejected' : 'pending_approval';
  await client.query(
    `INSERT INTO approval_actions (org_id, deviation_id, actor_id, decision, comments)
     VALUES ($1, $2, $3, $4, $5)`,
    [orgId, deviationId, userId, decision, comments ?? null],
  );
  const { rows } = await client.query<Deviation>(
    `UPDATE deviations SET status = $1, approval_stage_index = $4, updated_at = NOW()
     WHERE org_id = $2 AND id = $3
     RETURNING *`,
    [status, orgId, deviationId, finalApproved ? chain.length : nextStage],
  );
  await writeRecordVersion(client, {
    org_id: orgId,
    entity_type: 'deviation',
    entity_id: deviationId,
    changed_by: userId,
    change_reason: `deviation_${decision}`,
    before_state: before,
    after_state: rows[0],
  });
  return rows[0];
}

export async function savePhotoEvidence(
  client: DbClient,
  orgId: string,
  data: {
    segment_id: string;
    phase: string;
    file_ref: string;
    file_checksum: string;
    latitude?: number;
    longitude?: number;
    captured_at: string;
  },
): Promise<{ id: string }> {
  const locationSql =
    data.latitude != null && data.longitude != null
      ? `ST_SetSRID(ST_MakePoint($8, $9), 4326)`
      : 'NULL';

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO photo_evidence (org_id, segment_id, phase, file_ref, file_checksum, captured_at, location)
     VALUES ($1, $2, $3, $4, $5, $6, ${locationSql})
     RETURNING id`,
    data.latitude != null && data.longitude != null
      ? [
          orgId,
          data.segment_id,
          data.phase,
          data.file_ref,
          data.file_checksum,
          data.captured_at,
          data.longitude,
          data.latitude,
        ]
      : [orgId, data.segment_id, data.phase, data.file_ref, data.file_checksum, data.captured_at],
  );
  await updateSegmentCompleteness(client, data.segment_id);
  return rows[0];
}

export async function addOtdrTest(
  client: DbClient,
  orgId: string,
  userId: string,
  data: {
    closure_id: string;
    file_ref: string;
    file_checksum: string;
    result_summary?: Record<string, unknown>;
    test_date?: string;
  },
) {
  const { rows } = await client.query(
    `INSERT INTO otdr_tests (org_id, closure_id, file_ref, file_checksum, result_summary, test_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      orgId,
      data.closure_id,
      data.file_ref,
      data.file_checksum,
      data.result_summary ? JSON.stringify(data.result_summary) : null,
      data.test_date ?? new Date().toISOString(),
    ],
  );
  await writeRecordVersion(client, {
    org_id: orgId,
    entity_type: 'otdr_test',
    entity_id: rows[0].id,
    changed_by: userId,
    change_reason: 'otdr_upload',
    after_state: rows[0],
  });
  return rows[0];
}

export async function getProjectApprovalWorkflow(client: DbClient, orgId: string, projectId: string) {
  const { rows } = await client.query(
    `SELECT * FROM project_workflow_configs WHERE org_id = $1 AND project_id = $2`,
    [orgId, projectId],
  );
  return rows[0] ?? { project_id: projectId, approval_chain: ['site_supervisor', 'inspector_oic'] };
}

export async function upsertProjectApprovalWorkflow(
  client: DbClient,
  orgId: string,
  projectId: string,
  approvalChain: UserRole[],
  actorId: string,
) {
  const { rows } = await client.query(
    `INSERT INTO project_workflow_configs (org_id, project_id, approval_chain, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (project_id) DO UPDATE SET approval_chain = EXCLUDED.approval_chain, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING *`,
    [orgId, projectId, approvalChain, actorId],
  );
  return rows[0];
}

export async function listRecordVersions(
  client: DbClient,
  orgId: string,
  entityType: string,
  entityId: string,
) {
  const { rows } = await client.query(
    `SELECT * FROM record_versions WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3 ORDER BY version_number DESC`,
    [orgId, entityType, entityId],
  );
  return rows;
}

export async function getProjectChecklistConfig(
  client: DbClient,
  orgId: string,
  projectType: string,
) {
  const { rows } = await client.query(
    `SELECT * FROM project_checklist_configs WHERE org_id = $1 AND project_type = $2`,
    [orgId, projectType],
  );
  return rows[0] ?? { project_type: projectType, required_items: ['trench', 'duct', 'photos', 'cable'] };
}

export async function upsertProjectChecklistConfig(
  client: DbClient,
  orgId: string,
  projectType: string,
  requiredItems: string[],
  actorId: string,
) {
  const { rows } = await client.query(
    `INSERT INTO project_checklist_configs (org_id, project_type, required_items, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (org_id, project_type)
     DO UPDATE SET required_items = EXCLUDED.required_items, updated_by = EXCLUDED.updated_by, updated_at = NOW()
     RETURNING *`,
    [orgId, projectType, requiredItems, actorId],
  );
  return rows[0];
}

async function getProjectApprovalChainForSegment(client: DbClient, orgId: string, segmentId: string): Promise<UserRole[]> {
  const { rows } = await client.query(
    `SELECT pwc.approval_chain
     FROM segments s
     JOIN routes r ON r.id = s.route_id
     LEFT JOIN project_workflow_configs pwc ON pwc.project_id = r.project_id AND pwc.org_id = s.org_id
     WHERE s.org_id = $1 AND s.id = $2`,
    [orgId, segmentId],
  );
  return (rows[0]?.approval_chain as UserRole[] | undefined) ?? ['site_supervisor', 'inspector_oic'];
}

async function writeRecordVersion(
  client: DbClient,
  data: {
    org_id: string;
    entity_type: string;
    entity_id: string;
    changed_by?: string;
    change_reason?: string;
    before_state?: unknown;
    after_state?: unknown;
  },
) {
  const { rows } = await client.query<{ next_version: number }>(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
     FROM record_versions
     WHERE org_id = $1 AND entity_type = $2 AND entity_id = $3`,
    [data.org_id, data.entity_type, data.entity_id],
  );
  await client.query(
    `INSERT INTO record_versions (org_id, entity_type, entity_id, version_number, changed_by, change_reason, before_state, after_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      data.org_id,
      data.entity_type,
      data.entity_id,
      rows[0].next_version,
      data.changed_by ?? null,
      data.change_reason ?? null,
      data.before_state ? JSON.stringify(data.before_state) : null,
      data.after_state ? JSON.stringify(data.after_state) : null,
    ],
  );
}

export async function nocLookup(
  client: DbClient,
  orgId: string,
  params: { segment_id?: string; chainage?: number; latitude?: number; longitude?: number },
): Promise<NocLookupResult> {
  let segment: Segment | null = null;

  if (params.segment_id) {
    segment = await getSegment(client, orgId, params.segment_id);
  } else if (params.chainage != null) {
    const { rows } = await client.query<Segment>(
      `SELECT * FROM segments
       WHERE org_id = $1 AND chainage_start <= $2 AND chainage_end >= $2
       ORDER BY chainage_start LIMIT 1`,
      [orgId, params.chainage],
    );
    segment = rows[0] ?? null;
  }

  if (!segment) {
    return { segment: null, route: null, project: null, closures: [], deviations: [] };
  }

  const { rows: routes } = await client.query<Route>(
    `SELECT * FROM routes WHERE org_id = $1 AND id = $2`,
    [orgId, segment.route_id],
  );
  const route = routes[0] ?? null;

  let project: Project | null = null;
  if (route) {
    const { rows: projects } = await client.query<Project>(
      `SELECT * FROM projects WHERE org_id = $1 AND id = $2`,
      [orgId, route.project_id],
    );
    project = projects[0] ?? null;
  }

  const { rows: closures } = await client.query<{ id: string; closure_type: string; distance_m: number | null }>(
    `SELECT id, closure_type, NULL::float AS distance_m FROM joint_closures
     WHERE org_id = $1 AND segment_id = $2`,
    [orgId, segment.id],
  );

  const { rows: deviations } = await client.query<Deviation>(
    `SELECT * FROM deviations WHERE org_id = $1 AND segment_id = $2 AND status != 'approved'`,
    [orgId, segment.id],
  );

  return { segment, route, project, closures, deviations };
}

export async function writeAuditLog(
  client: DbClient,
  data: {
    org_id: string;
    entity_type: string;
    entity_id?: string;
    action: string;
    actor_id?: string;
    actor_email?: string;
    ip_address?: string;
    before_state?: unknown;
    after_state?: unknown;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO audit_logs (org_id, entity_type, entity_id, action, actor_id, actor_email, ip_address, before_state, after_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      data.org_id,
      data.entity_type,
      data.entity_id ?? null,
      data.action,
      data.actor_id ?? null,
      data.actor_email ?? null,
      data.ip_address ?? null,
      data.before_state ? JSON.stringify(data.before_state) : null,
      data.after_state ? JSON.stringify(data.after_state) : null,
    ],
  );
}
