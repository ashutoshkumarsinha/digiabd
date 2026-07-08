import { randomUUID } from 'node:crypto';
import type { DbClient } from '../db/pool.js';
import type { AppConfig } from '../config.js';
import { checksum, createStorageClient, uploadFile } from './storage.js';
import JSZip from 'jszip';

export interface ComplianceCheck {
  checkpoint: string;
  status: 'pass' | 'fail' | 'warning';
  detail: string;
}

export async function getOrgDashboard(client: DbClient, orgId: string) {
  const [projects, segments, deviations, faults, escalations] = await Promise.all([
    client.query(`SELECT COUNT(*)::int AS count FROM projects WHERE org_id = $1`, [orgId]),
    client.query(
      `SELECT
         COUNT(*)::int AS total,
         ROUND(AVG(completeness), 2) AS avg_completeness,
         COUNT(*) FILTER (WHERE status = 'signed_off')::int AS signed_off
       FROM segments WHERE org_id = $1`,
      [orgId],
    ),
    client.query(
      `SELECT COUNT(*)::int AS open_count
       FROM deviations WHERE org_id = $1 AND status NOT IN ('approved', 'rejected')`,
      [orgId],
    ),
    client.query(
      `SELECT
         COUNT(*)::int AS total_faults,
         ROUND(AVG(mttr_minutes), 2) AS avg_mttr_minutes
       FROM fault_events WHERE org_id = $1 AND resolved_at IS NOT NULL`,
      [orgId],
    ),
    client.query(
      `SELECT COUNT(*)::int AS open_count FROM escalation_events
       WHERE org_id = $1 AND status = 'open'`,
      [orgId],
    ),
  ]);

  return {
    projects: projects.rows[0].count,
    segments: segments.rows[0],
    open_deviations: deviations.rows[0].open_count,
    faults: faults.rows[0],
    open_escalations: escalations.rows[0].open_count,
    platform_availability_sla: 99.9,
    generated_at: new Date().toISOString(),
  };
}

export async function getProjectSla(client: DbClient, orgId: string, projectId: string) {
  const { rows: segmentStats } = await client.query(
    `SELECT
       COUNT(s.id)::int AS total_segments,
       ROUND(AVG(s.completeness), 2) AS avg_completeness,
       COUNT(s.id) FILTER (WHERE s.completeness >= 95)::int AS segments_meeting_target,
       COUNT(s.id) FILTER (WHERE s.status = 'signed_off')::int AS signed_off_count
     FROM segments s
     JOIN routes r ON r.id = s.route_id
     WHERE s.org_id = $1 AND r.project_id = $2`,
    [orgId, projectId],
  );

  const { rows: deviationStats } = await client.query(
    `SELECT
       COUNT(d.id)::int AS total,
       COUNT(d.id) FILTER (WHERE d.status NOT IN ('approved', 'rejected'))::int AS open_count,
       ROUND(AVG(EXTRACT(EPOCH FROM (d.updated_at - d.created_at)) / 86400)::numeric, 2) AS avg_closure_days
     FROM deviations d
     JOIN segments s ON s.id = d.segment_id
     JOIN routes r ON r.id = s.route_id
     WHERE d.org_id = $1 AND r.project_id = $2`,
    [orgId, projectId],
  );

  const { rows: faultStats } = await client.query(
    `SELECT
       COUNT(f.id)::int AS fault_count,
       ROUND(AVG(f.mttr_minutes), 2) AS avg_mttr_minutes,
       ROUND(AVG(
         EXTRACT(EPOCH FROM (f.resolved_at - f.reported_at)) / 86400
       ) FILTER (WHERE f.resolved_at IS NOT NULL)::numeric, 2) AS avg_resolution_days
     FROM fault_events f
     JOIN routes r ON r.id = f.route_id
     WHERE f.org_id = $1 AND r.project_id = $2`,
    [orgId, projectId],
  );

  const stats = segmentStats[0];
  const completenessRate =
    stats.total_segments > 0
      ? Math.round((stats.segments_meeting_target / stats.total_segments) * 10000) / 100
      : 0;

  return {
    project_id: projectId,
    abd_completeness_target: 95,
    abd_completeness_rate: completenessRate,
    avg_completeness: stats.avg_completeness,
    total_segments: stats.total_segments,
    signed_off_segments: stats.signed_off_count,
    open_deviations: deviationStats[0]?.open_count ?? 0,
    avg_deviation_closure_days: deviationStats[0]?.avg_closure_days ?? null,
    fault_count: faultStats[0]?.fault_count ?? 0,
    avg_mttr_minutes: faultStats[0]?.avg_mttr_minutes ?? null,
    mtbf_days_estimate: faultStats[0]?.fault_count > 0 ? Math.round(365 / faultStats[0].fault_count) : null,
    sla_status: completenessRate >= 95 ? 'compliant' : 'at_risk',
    generated_at: new Date().toISOString(),
  };
}

export async function buildSegmentComplianceChecks(
  client: DbClient,
  orgId: string,
  segmentId: string,
): Promise<ComplianceCheck[]> {
  const { rows: segments } = await client.query(
    `SELECT s.*, t.depth_m, t.reinstatement_status
     FROM segments s
     LEFT JOIN trench_records t ON t.segment_id = s.id
     WHERE s.org_id = $1 AND s.id = $2`,
    [orgId, segmentId],
  );
  if (!segments[0]) return [];

  const segment = segments[0];
  const checks: ComplianceCheck[] = [];

  checks.push({
    checkpoint: 'trenching_depth',
    status: segment.depth_m != null && Number(segment.depth_m) >= 1.65 ? 'pass' : 'fail',
    detail: segment.depth_m ? `Depth ${segment.depth_m} m` : 'No trench record',
  });

  const { rows: duct } = await client.query(`SELECT duct_type FROM duct_records WHERE segment_id = $1`, [segmentId]);
  checks.push({
    checkpoint: 'duct_type',
    status: duct[0] ? 'pass' : 'fail',
    detail: duct[0] ? `Duct type: ${duct[0].duct_type}` : 'No duct record',
  });

  const { rows: photos } = await client.query(`SELECT COUNT(*)::int AS count FROM photo_evidence WHERE segment_id = $1`, [segmentId]);
  checks.push({
    checkpoint: 'photographic_evidence',
    status: photos[0].count > 0 ? 'pass' : 'fail',
    detail: `${photos[0].count} photo(s) attached`,
  });

  const { rows: cables } = await client.query(`SELECT COUNT(*)::int AS count FROM cable_lay_records WHERE segment_id = $1`, [segmentId]);
  checks.push({
    checkpoint: 'cable_lay_record',
    status: cables[0].count > 0 ? 'pass' : 'fail',
    detail: cables[0].count > 0 ? 'Cable lay recorded' : 'No cable record',
  });

  const { rows: otdr } = await client.query(
    `SELECT COUNT(ot.id)::int AS count
     FROM joint_closures jc
     LEFT JOIN otdr_tests ot ON ot.closure_id = jc.id
     WHERE jc.segment_id = $1`,
    [segmentId],
  );
  checks.push({
    checkpoint: 'otdr_testing',
    status: otdr[0].count > 0 ? 'pass' : 'warning',
    detail: otdr[0].count > 0 ? 'OTDR results linked' : 'No OTDR tests (optional until jointing)',
  });

  const { rows: openDev } = await client.query(
    `SELECT COUNT(*)::int AS count FROM deviations
     WHERE segment_id = $1 AND status NOT IN ('approved', 'rejected')`,
    [segmentId],
  );
  checks.push({
    checkpoint: 'deviations_resolved',
    status: openDev[0].count === 0 ? 'pass' : 'fail',
    detail: openDev[0].count === 0 ? 'No open deviations' : `${openDev[0].count} open deviation(s)`,
  });

  checks.push({
    checkpoint: 'reinstatement',
    status: segment.reinstatement_status === 'completed' ? 'pass' : 'warning',
    detail: `Reinstatement: ${segment.reinstatement_status ?? 'pending'}`,
  });

  return checks;
}

export async function generateComplianceReport(
  client: DbClient,
  orgId: string,
  segmentId: string,
  userId: string,
) {
  const checks = await buildSegmentComplianceChecks(client, orgId, segmentId);
  const passed = checks.filter((c) => c.status === 'pass').length;
  const failed = checks.filter((c) => c.status === 'fail').length;

  const { rows: segment } = await client.query(
    `SELECT route_id FROM segments WHERE org_id = $1 AND id = $2`,
    [orgId, segmentId],
  );

  const { rows } = await client.query(
    `INSERT INTO compliance_reports (org_id, route_id, report_type, entity_id, passed_count, failed_count, total_checks, details, generated_by)
     VALUES ($1, $2, 'segment', $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      orgId,
      segment[0]?.route_id ?? null,
      segmentId,
      passed,
      failed,
      checks.length,
      JSON.stringify(checks),
      userId,
    ],
  );

  return { report: rows[0], checks, compliance_status: failed === 0 ? 'compliant' : 'non_compliant' };
}

export async function listEscalationRules(client: DbClient, orgId: string) {
  const { rows } = await client.query(
    `SELECT * FROM escalation_rules WHERE org_id = $1 AND is_active = TRUE ORDER BY created_at`,
    [orgId],
  );
  return rows;
}

export async function createEscalationRule(
  client: DbClient,
  orgId: string,
  data: {
    name: string;
    trigger_type: string;
    threshold: number;
    severity?: string;
    notify_roles?: string[];
  },
) {
  const { rows } = await client.query(
    `INSERT INTO escalation_rules (org_id, name, trigger_type, threshold, severity, notify_roles)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [orgId, data.name, data.trigger_type, data.threshold, data.severity ?? 'medium', data.notify_roles ?? ['program_manager']],
  );
  return rows[0];
}

async function createEscalationEventIfNeeded(client: DbClient, params: {
  orgId: string;
  ruleId: string;
  projectId: string;
  triggerType: string;
  severity: string;
  message: string;
}) {
  const existing = await client.query(
    `SELECT id FROM escalation_events
     WHERE org_id = $1 AND rule_id = $2 AND project_id = $3 AND trigger_type = $4 AND status = 'open'
     LIMIT 1`,
    [params.orgId, params.ruleId, params.projectId, params.triggerType],
  );
  if (existing.rows[0]?.id) {
    return { eventId: existing.rows[0].id as string, created: false };
  }

  const inserted = await client.query(
    `INSERT INTO escalation_events (org_id, rule_id, project_id, trigger_type, severity, message)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [params.orgId, params.ruleId, params.projectId, params.triggerType, params.severity, params.message],
  );

  await client.query(
    `INSERT INTO notifications (org_id, user_id, channel, event_type, title, body, metadata)
     VALUES ($1, NULL, 'in_app', 'governance.escalation.triggered', $2, $3, $4::jsonb)`,
    [
      params.orgId,
      `Governance escalation (${params.severity})`,
      params.message,
      JSON.stringify({
        trigger_type: params.triggerType,
        project_id: params.projectId,
        escalation_event_id: inserted.rows[0].id,
      }),
    ],
  );

  return { eventId: inserted.rows[0].id as string, created: true };
}

export async function evaluateEscalations(client: DbClient, orgId: string, projectId?: string) {
  const rules = await listEscalationRules(client, orgId);
  const triggered: Array<{ rule_id: string; message: string; severity: string; event_id?: string }> = [];

  for (const rule of rules) {
    if (rule.trigger_type === 'completeness_below') {
      const { rows } = await client.query(
        `SELECT p.id, p.name, ROUND(AVG(s.completeness), 2) AS avg_completeness
         FROM projects p
         JOIN routes r ON r.project_id = p.id
         JOIN segments s ON s.route_id = r.id
         WHERE p.org_id = $1 ${projectId ? 'AND p.id = $2' : ''}
         GROUP BY p.id, p.name
         HAVING AVG(s.completeness) < $${projectId ? 3 : 2}`,
        projectId ? [orgId, projectId, rule.threshold] : [orgId, rule.threshold],
      );

      for (const row of rows) {
        const message = `Project "${row.name}" ABD completeness ${row.avg_completeness}% below threshold ${rule.threshold}%`;
        const result = await createEscalationEventIfNeeded(client, {
          orgId,
          ruleId: rule.id,
          projectId: row.id,
          triggerType: rule.trigger_type,
          severity: rule.severity,
          message,
        });
        if (result.created) {
          triggered.push({ rule_id: rule.id, message, severity: rule.severity, event_id: result.eventId });
        }
      }
    }

    if (rule.trigger_type === 'open_deviations') {
      const { rows } = await client.query(
        `SELECT p.id, p.name, COUNT(d.id)::int AS open_count
         FROM projects p
         JOIN routes r ON r.project_id = p.id
         JOIN segments s ON s.route_id = r.id
         JOIN deviations d ON d.segment_id = s.id
         WHERE p.org_id = $1 AND d.status NOT IN ('approved', 'rejected')
         ${projectId ? 'AND p.id = $2' : ''}
         GROUP BY p.id, p.name
         HAVING COUNT(d.id) >= $${projectId ? 3 : 2}`,
        projectId ? [orgId, projectId, rule.threshold] : [orgId, rule.threshold],
      );

      for (const row of rows) {
        const message = `Project "${row.name}" has ${row.open_count} open deviation(s) (threshold: ${rule.threshold})`;
        const result = await createEscalationEventIfNeeded(client, {
          orgId,
          ruleId: rule.id,
          projectId: row.id,
          triggerType: rule.trigger_type,
          severity: rule.severity,
          message,
        });
        if (result.created) {
          triggered.push({ rule_id: rule.id, message, severity: rule.severity, event_id: result.eventId });
        }
      }
    }
  }

  return { evaluated_at: new Date().toISOString(), triggered_count: triggered.length, events: triggered };
}

export async function listEscalationEvents(client: DbClient, orgId: string, status?: string) {
  const { rows } = await client.query(
    status
      ? `SELECT * FROM escalation_events WHERE org_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 100`
      : `SELECT * FROM escalation_events WHERE org_id = $1 ORDER BY created_at DESC LIMIT 100`,
    status ? [orgId, status] : [orgId],
  );
  return rows;
}

type EscalationEventStatus = 'open' | 'acknowledged' | 'resolved';

export async function updateEscalationEventStatus(
  client: DbClient,
  orgId: string,
  eventId: string,
  nextStatus: EscalationEventStatus,
  actorId: string,
) {
  const { rows: existing } = await client.query(
    `SELECT * FROM escalation_events WHERE org_id = $1 AND id = $2`,
    [orgId, eventId],
  );
  const event = existing[0];
  if (!event) return { ok: false as const, reason: 'not_found' as const };

  const currentStatus = event.status as EscalationEventStatus;
  const allowed: Record<EscalationEventStatus, EscalationEventStatus[]> = {
    open: ['acknowledged', 'resolved'],
    acknowledged: ['resolved'],
    resolved: [],
  };

  if (!allowed[currentStatus].includes(nextStatus)) {
    return {
      ok: false as const,
      reason: 'invalid_transition' as const,
      current_status: currentStatus,
      requested_status: nextStatus,
    };
  }

  const { rows } = await client.query(
    `UPDATE escalation_events
     SET status = $3,
         resolved_at = CASE WHEN $3 = 'resolved' THEN NOW() ELSE resolved_at END
     WHERE org_id = $1 AND id = $2
     RETURNING *`,
    [orgId, eventId, nextStatus],
  );

  await client.query(
    `INSERT INTO audit_logs (org_id, entity_type, entity_id, action, actor_id, after_state)
     VALUES ($1, 'escalation_event', $2, $3, $4, $5::jsonb)`,
    [
      orgId,
      eventId,
      `escalation.${nextStatus}`,
      actorId,
      JSON.stringify({ status: nextStatus, previous_status: currentStatus }),
    ],
  );

  return { ok: true as const, event: rows[0] };
}

function createSimplePdfReport(lines: string[]): Buffer {
  const safeLines = lines.map((line) =>
    line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'),
  );
  const textOps = ['BT', '/F1 12 Tf', '50 780 Td'];
  for (let i = 0; i < safeLines.length; i += 1) {
    if (i > 0) textOps.push('0 -16 Td');
    textOps.push(`(${safeLines[i]}) Tj`);
  }
  textOps.push('ET');
  const content = textOps.join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

export async function getExecutiveSummary(client: DbClient, orgId: string) {
  const dashboard = await getOrgDashboard(client, orgId);

  const { rows: projects } = await client.query(
    `SELECT p.id, p.name, p.status, p.vendor_name,
       COUNT(s.id)::int AS segment_count,
       ROUND(AVG(s.completeness), 2) AS avg_completeness
     FROM projects p
     LEFT JOIN routes r ON r.project_id = p.id
     LEFT JOIN segments s ON s.route_id = r.id
     WHERE p.org_id = $1
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [orgId],
  );

  const { rows: recentReports } = await client.query(
    `SELECT id, report_type, entity_id, passed_count, failed_count, generated_at
     FROM compliance_reports WHERE org_id = $1 ORDER BY generated_at DESC LIMIT 10`,
    [orgId],
  );

  return {
    portfolio: dashboard,
    projects,
    recent_compliance_reports: recentReports,
    kpis: {
      abd_completeness_target: 95,
      mttr_target_minutes: 240,
      platform_sla_target: 99.9,
    },
    generated_at: new Date().toISOString(),
  };
}

export async function getRcaHints(
  client: DbClient,
  orgId: string,
  params: { segment_id?: string; chainage?: number },
) {
  let segmentId = params.segment_id;

  if (!segmentId && params.chainage != null) {
    const { rows } = await client.query(
      `SELECT id FROM segments
       WHERE org_id = $1 AND chainage_start <= $2 AND chainage_end >= $2
       LIMIT 1`,
      [orgId, params.chainage],
    );
    segmentId = rows[0]?.id;
  }

  if (!segmentId) return { hints: [], segment_id: null };

  const { rows: deviations } = await client.query(
    `SELECT category, description, severity, status FROM deviations
     WHERE org_id = $1 AND segment_id = $2`,
    [orgId, segmentId],
  );

  const { rows: crossings } = await client.query(
    `SELECT crossing_type, protection_measure FROM crossings
     WHERE org_id = $1 AND segment_id = $2`,
    [orgId, segmentId],
  );

  const hints: string[] = [];
  if (deviations.length > 0) {
    hints.push(`Segment has ${deviations.length} construction deviation(s) — review for correlation with fault.`);
  }
  for (const d of deviations) {
    if (d.severity === 'high' || d.severity === 'critical') {
      hints.push(`High-severity deviation: ${d.category} — ${d.description}`);
    }
  }
  for (const c of crossings) {
    hints.push(`Nearby ${c.crossing_type} crossing — verify protection: ${c.protection_measure ?? 'not documented'}`);
  }
  if (hints.length === 0) {
    hints.push('No construction deviations or special crossings recorded near fault location.');
  }

  return { segment_id: segmentId, hints, deviation_count: deviations.length, crossing_count: crossings.length };
}

export async function exportAuditPackage(
  client: DbClient,
  config: AppConfig,
  orgId: string,
  userId: string,
  params: { project_id?: string; route_id?: string },
) {
  const segments = await client.query(
    params.route_id
      ? `SELECT s.*, r.name AS route_name, p.name AS project_name
         FROM segments s
         JOIN routes r ON r.id = s.route_id
         JOIN projects p ON p.id = r.project_id
         WHERE s.org_id = $1 AND s.route_id = $2`
      : `SELECT s.*, r.name AS route_name, p.name AS project_name
         FROM segments s
         JOIN routes r ON r.id = s.route_id
         JOIN projects p ON p.id = r.project_id
         WHERE s.org_id = $1 AND p.id = $2`,
    params.route_id ? [orgId, params.route_id] : [orgId, params.project_id],
  );

  const { rows: auditLogs } = await client.query(
    `SELECT * FROM audit_logs WHERE org_id = $1 ORDER BY created_at DESC LIMIT 500`,
    [orgId],
  );

  const exportedAt = new Date().toISOString();
  const packageData = {
    exported_at: exportedAt,
    org_id: orgId,
    segment_count: segments.rows.length,
    segments: segments.rows,
    audit_log_sample: auditLogs,
  };

  const geoJson = {
    type: 'FeatureCollection',
    features: segments.rows.map((segment) => ({
      type: 'Feature',
      geometry: null,
      properties: {
        segment_id: segment.id,
        route_id: segment.route_id,
        chainage_start: segment.chainage_start,
        chainage_end: segment.chainage_end,
        status: segment.status,
        completeness: segment.completeness,
        route_name: segment.route_name,
        project_name: segment.project_name,
      },
    })),
  };

  const reportLines = [
    'Digital ABD Audit Package',
    `Exported At: ${exportedAt}`,
    `Org ID: ${orgId}`,
    `Project ID: ${params.project_id ?? 'N/A'}`,
    `Route ID: ${params.route_id ?? 'N/A'}`,
    `Segment Count: ${segments.rows.length}`,
    `Audit Log Entries Included: ${auditLogs.length}`,
    '',
    'This package includes:',
    '- report.txt',
    '- report.pdf',
    '- segments.geojson',
    '- audit-log.json',
    '- manifest.json',
  ];
  const reportText = reportLines.join('\n');
  const reportPdf = createSimplePdfReport(reportLines);

  const manifest = {
    version: 1,
    exported_at: exportedAt,
    org_id: orgId,
    project_id: params.project_id ?? null,
    route_id: params.route_id ?? null,
    files: ['report.txt', 'report.pdf', 'segments.geojson', 'audit-log.json', 'manifest.json'],
    record_count: segments.rows.length,
  };

  const zip = new JSZip();
  zip.file('report.txt', reportText);
  zip.file('report.pdf', reportPdf);
  zip.file('segments.geojson', JSON.stringify(geoJson, null, 2));
  zip.file('audit-log.json', JSON.stringify(auditLogs, null, 2));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const hash = checksum(zipBuffer);

  const exportId = randomUUID();
  const key = `${orgId}/audit-exports/${exportId}.zip`;
  const storage = createStorageClient(config);
  if (storage) {
    await uploadFile(storage, config.S3_BUCKET, key, zipBuffer, 'application/zip');
  }

  const { rows } = await client.query(
    `INSERT INTO audit_exports (id, org_id, project_id, route_id, export_type, file_ref, record_count, generated_by)
     VALUES ($1, $2, $3, $4, 'audit_package_zip', $5, $6, $7)
     RETURNING *`,
    [exportId, orgId, params.project_id ?? null, params.route_id ?? null, key, segments.rows.length, userId],
  );

  return {
    export: rows[0],
    package_manifest: manifest,
    package: packageData,
    artifact: {
      file_ref: key,
      content_type: 'application/zip',
      checksum_sha256: hash,
    },
  };
}

export async function recordSlaSnapshot(
  client: DbClient,
  orgId: string,
  projectId: string,
  metrics: Array<{ name: string; value: number; target?: number; unit?: string }>,
) {
  for (const m of metrics) {
    await client.query(
      `INSERT INTO sla_metric_snapshots (org_id, project_id, metric_name, metric_value, target_value, unit)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orgId, projectId, m.name, m.value, m.target ?? null, m.unit ?? null],
    );
  }
}
