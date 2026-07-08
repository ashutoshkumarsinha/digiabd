import { createHash } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import type { AppConfig } from '../config.js';

export function createStorageClient(config: AppConfig): S3Client | null {
  if (!config.S3_ENDPOINT || !config.S3_ACCESS_KEY || !config.S3_SECRET_KEY) {
    return null;
  }

  return new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY,
      secretAccessKey: config.S3_SECRET_KEY,
    },
  });
}

export function checksum(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function uploadFile(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
