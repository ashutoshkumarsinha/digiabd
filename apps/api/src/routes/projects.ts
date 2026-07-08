import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { withOrgContext } from '../db/pool.js';
import { getAuthUser, requireRoles } from '../middleware/auth.js';
import * as abd from '../services/abd.js';

// Project routes are the "entry point" for navigating org data:
// projects -> routes -> segments.
export async function registerProjectRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get('/api/v1/projects', { preHandler: [app.authenticate] }, async (request) => {
    const user = getAuthUser(request);
    return withOrgContext(pool, user.orgId, (client) => abd.listProjects(client, user.orgId));
  });

  app.post('/api/v1/projects', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = getAuthUser(request);
    const body = request.body as {
      name: string;
      client_name?: string;
      vendor_name?: string;
      project_type?: string;
    };

    if (!body?.name) {
      return reply.status(400).send({
        type: 'https://digiabd.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'name is required',
      });
    }

    const project = await withOrgContext(pool, user.orgId, (client) =>
      abd.createProject(client, user.orgId, body),
    );

    // Every create action writes an audit record for compliance traceability.
    await withOrgContext(pool, user.orgId, (client) =>
      abd.writeAuditLog(client, {
        org_id: user.orgId,
        entity_type: 'project',
        entity_id: project.id,
        action: 'create',
        actor_id: user.sub,
        actor_email: user.email,
        after_state: project,
      }),
    );

    return reply.status(201).send(project);
  });

  app.get<{ Params: { projectId: string } }>(
    '/api/v1/projects/:projectId/routes',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) =>
        abd.listRoutes(client, user.orgId, request.params.projectId),
      );
    },
  );

  app.post<{ Params: { projectId: string } }>(
    '/api/v1/projects/:projectId/routes',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as { name: string; total_length_km?: number };

      if (!body?.name) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'name is required',
        });
      }

      const route = await withOrgContext(pool, user.orgId, (client) =>
        abd.createRoute(client, user.orgId, {
          project_id: request.params.projectId,
          name: body.name,
          total_length_km: body.total_length_km,
        }),
      );

      return reply.status(201).send(route);
    },
  );

  app.get<{ Params: { projectId: string } }>(
    '/api/v1/projects/:projectId/workflow/approval-chain',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      return withOrgContext(pool, user.orgId, (client) =>
        abd.getProjectApprovalWorkflow(client, user.orgId, request.params.projectId),
      );
    },
  );

  app.put<{ Params: { projectId: string } }>(
    '/api/v1/projects/:projectId/workflow/approval-chain',
    { preHandler: [app.authenticate, requireRoles('program_manager', 'enterprise_admin')] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as { approval_chain: string[] };
      if (!Array.isArray(body?.approval_chain) || body.approval_chain.length === 0) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'approval_chain must be a non-empty role array',
        });
      }
      const workflow = await withOrgContext(pool, user.orgId, (client) =>
        abd.upsertProjectApprovalWorkflow(client, user.orgId, request.params.projectId, body.approval_chain as any, user.sub),
      );
      return reply.send(workflow);
    },
  );

  app.get(
    '/api/v1/checklists/:projectType',
    { preHandler: [app.authenticate] },
    async (request) => {
      const user = getAuthUser(request);
      const params = request.params as { projectType: string };
      return withOrgContext(pool, user.orgId, (client) =>
        abd.getProjectChecklistConfig(client, user.orgId, params.projectType),
      );
    },
  );

  app.put(
    '/api/v1/checklists/:projectType',
    { preHandler: [app.authenticate, requireRoles('program_manager', 'enterprise_admin')] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const params = request.params as { projectType: string };
      const body = request.body as { required_items: string[] };
      if (!Array.isArray(body?.required_items) || body.required_items.length === 0) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'required_items must be a non-empty array',
        });
      }
      const config = await withOrgContext(pool, user.orgId, (client) =>
        abd.upsertProjectChecklistConfig(client, user.orgId, params.projectType, body.required_items, user.sub),
      );
      return reply.send(config);
    },
  );
}
