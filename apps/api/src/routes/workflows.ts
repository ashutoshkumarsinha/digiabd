import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import type { AppConfig } from '../config.js';
import { withOrgContext } from '../db/pool.js';
import { getAuthUser, requireRoles } from '../middleware/auth.js';
import * as abd from '../services/abd.js';
import { checksum, createStorageClient, uploadFile } from '../services/storage.js';

export async function registerDeviationRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.post('/api/v1/deviations', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = getAuthUser(request);
    const body = request.body as {
      segment_id: string;
      category: string;
      description: string;
      justification?: string;
      severity?: string;
    };

    if (!body?.segment_id || !body?.category || !body?.description) {
      return reply.status(400).send({
        type: 'https://digiabd.io/errors/validation',
        title: 'Validation Error',
        status: 400,
        detail: 'segment_id, category, and description are required',
      });
    }

    const deviation = await withOrgContext(pool, user.orgId, (client) =>
      abd.createDeviation(client, user.orgId, user.sub, body),
    );

    return reply.status(201).send(deviation);
  });

  app.post<{ Params: { deviationId: string } }>(
    '/api/v1/deviations/:deviationId/approve',
    { preHandler: [app.authenticate, requireRoles('inspector_oic', 'site_supervisor')] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const body = request.body as {
        decision: 'approved' | 'rejected' | 'returned';
        comments?: string;
      };

      if (!body?.decision) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'decision is required',
        });
      }

      const deviation = await withOrgContext(pool, user.orgId, (client) =>
        abd.approveDeviation(client, user.orgId, user.sub, request.params.deviationId, body.decision, body.comments),
      );

      return reply.send(deviation);
    },
  );
}

export async function registerPhotoRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  config: AppConfig,
): Promise<void> {
  const storage = createStorageClient(config);

  app.post<{ Params: { segmentId: string } }>(
    '/api/v1/segments/:segmentId/photos',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const user = getAuthUser(request);
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          type: 'https://digiabd.io/errors/validation',
          title: 'Validation Error',
          status: 400,
          detail: 'photo file is required',
        });
      }

      const buffer = await data.toBuffer();
      if (buffer.length > 25 * 1024 * 1024) {
        return reply.status(413).send({
          type: 'https://digiabd.io/errors/payload-too-large',
          title: 'Payload Too Large',
          status: 413,
          detail: 'Photo must be ≤ 25 MB',
        });
      }

      const phase = (data.fields.phase as { value?: string } | undefined)?.value ?? 'during';
      const latField = data.fields.latitude as { value?: string } | undefined;
      const lngField = data.fields.longitude as { value?: string } | undefined;
      const fileHash = checksum(buffer);
      const key = `${user.orgId}/segments/${request.params.segmentId}/${randomUUID()}-${data.filename}`;

      if (storage) {
        await uploadFile(storage, config.S3_BUCKET, key, buffer, data.mimetype);
      }

      const photo = await withOrgContext(pool, user.orgId, (client) =>
        abd.savePhotoEvidence(client, user.orgId, {
          segment_id: request.params.segmentId,
          phase,
          file_ref: key,
          file_checksum: fileHash,
          latitude: latField?.value ? Number(latField.value) : undefined,
          longitude: lngField?.value ? Number(lngField.value) : undefined,
          captured_at: new Date().toISOString(),
        }),
      );

      return reply.status(201).send({ id: photo.id, file_ref: key, checksum: fileHash });
    },
  );
}

export async function registerNocRoutes(app: FastifyInstance, pool: pg.Pool): Promise<void> {
  app.get(
    '/api/v1/noc/lookup',
    { preHandler: [app.authenticate, requireRoles('noc_operator', 'program_manager', 'inspector_oic')] },
    async (request) => {
      const user = getAuthUser(request);
      const query = request.query as {
        segment_id?: string;
        chainage?: string;
        latitude?: string;
        longitude?: string;
      };

      return withOrgContext(pool, user.orgId, (client) =>
        abd.nocLookup(client, user.orgId, {
          segment_id: query.segment_id,
          chainage: query.chainage ? Number(query.chainage) : undefined,
          latitude: query.latitude ? Number(query.latitude) : undefined,
          longitude: query.longitude ? Number(query.longitude) : undefined,
        }),
      );
    },
  );
}
