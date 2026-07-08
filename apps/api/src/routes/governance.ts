import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { withOrgContext } from '../db/pool.js';
import { getAuthUser, requireRoles } from '../middleware/auth.js';
import * as governance from '../services/governance.js';

export async function registerGovernanceRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get(
    '/api/v1/governance/dashboard',
    { preHandler: [app.authenticate, requireRoles('program_manager', 'enterprise_admin', 'auditor', 'inspector_oic')] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) => governance.getOrgDashboard(client, user.orgId));
    },
  );

  app.get<{ Params: { projectId: string } }>(
    '/api/v1/governance/projects/:projectId/sla',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      const sla = await withOrgContext(pool, user.orgId, (client) =>
        governance.getProjectSla(client, user.orgId, request.params.projectId),
      );
      await withOrgContext(pool, user.orgId, (client) =>
        governance.recordSlaSnapshot(client, user.orgId, request.params.projectId, [
          { name: 'abd_completeness_rate', value: sla.abd_completeness_rate, target: 95, unit: '%' },
          { name: 'avg_mttr_minutes', value: sla.avg_mttr_minutes ?? 0, target: 240, unit: 'minutes' },
        ]),
      );
      return sla;
    },
  );

  app.get<{ Params: { segmentId: string } }>(
    '/api/v1/governance/segments/:segmentId/compliance',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) =>
        governance.generateComplianceReport(client, user.orgId, request.params.segmentId, user.sub),
      );
    },
  );

  app.get(
    '/api/v1/governance/escalations/rules',
    { preHandler: [app.authenticate, requireRoles('program_manager', 'enterprise_admin')] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) => governance.listEscalationRules(client, user.orgId));
    },
  );

  app.post(
    '/api/v1/governance/escalations/rules',
    { preHandler: [app.authenticate, requireRoles('program_manager', 'enterprise_admin')] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as {
        name: string;
        trigger_type: string;
        threshold: number;
        severity?: string;
        notify_roles?: string[];
      };
      if (!body?.name || !body?.trigger_type || body?.threshold == null) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'name, trigger_type, and threshold are required',
        });
      }
      const rule = await withOrgContext(pool, user.orgId, (client) =>
        governance.createEscalationRule(client, user.orgId, body),
      );
      return reply.status(201).send(rule);
    },
  );

  app.post(
    '/api/v1/governance/escalations/evaluate',
    { preHandler: [app.authenticate, requireRoles('program_manager', 'enterprise_admin')] },
    async (request) => {
      const user = getAuthUser(request);
      const body = request.body as { project_id?: string };
      return withOrgContext(pool, user.orgId, (client) =>
        governance.evaluateEscalations(client, user.orgId, body?.project_id),
      );
    },
  );

  app.get(
    '/api/v1/governance/escalations',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      const query = request.query as { status?: string };
      return withOrgContext(pool, user.orgId, (client) =>
        governance.listEscalationEvents(client, user.orgId, query.status),
      );
    },
  );

  app.get(
    '/api/v1/governance/executive/summary',
    { preHandler: [app.authenticate, requireRoles('program_manager', 'enterprise_admin', 'auditor')] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) => governance.getExecutiveSummary(client, user.orgId));
    },
  );

  app.get(
    '/api/v1/governance/noc/rca-hints',
    { preHandler: [app.authenticate, requireRoles('noc_operator', 'program_manager', 'inspector_oic')] },
    async (request) => {
      const user = getAuthUser(request);
      const query = request.query as { segment_id?: string; chainage?: string };
      return withOrgContext(pool, user.orgId, (client) =>
        governance.getRcaHints(client, user.orgId, {
          segment_id: query.segment_id,
          chainage: query.chainage ? Number(query.chainage) : undefined,
        }),
      );
    },
  );

  app.post(
    '/api/v1/governance/audit/export',
    { preHandler: [app.authenticate, requireRoles('auditor', 'inspector_oic', 'program_manager', 'enterprise_admin')] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as { project_id?: string; route_id?: string };
      if (!body?.project_id && !body?.route_id) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'project_id or route_id is required',
        });
      }
      const result = await withOrgContext(pool, user.orgId, (client) =>
        governance.exportAuditPackage(client, user.orgId, user.sub, body),
      );
      return reply.status(201).send(result);
    },
  );
}
