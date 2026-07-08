import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_VERSION: z.string().default('v1'),
  JWT_SECRET: z.string().min(8),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  REDIS_URL: z.string().optional(),
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('digiabd-files'),
  S3_REGION: z.string().default('ap-south-1'),
  S3_USE_SSL: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:8081'),
  OIDC_ISSUER: z.string().optional(),
  OIDC_CLIENT_ID: z.string().optional(),
  OIDC_CLIENT_SECRET: z.string().optional(),
  OIDC_REDIRECT_URI: z.string().optional(),
  AUTH_MODE: z.enum(['dev', 'oidc', 'hybrid']).default('hybrid'),
  OTEL_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  OTEL_SERVICE_NAME: z.string().default('digiabd-api'),
  OTEL_SERVICE_VERSION: z.string().default('0.4.0'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default('http://localhost:4318'),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  OTEL_METRIC_EXPORT_INTERVAL_MS: z.coerce.number().default(10000),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function getKafkaBrokers(config: AppConfig): string[] {
  return (config.KAFKA_BROKERS ?? 'localhost:19092').split(',').map((b) => b.trim());
}

export function isOidcEnabled(config: AppConfig): boolean {
  return (
    (config.AUTH_MODE === 'oidc' || config.AUTH_MODE === 'hybrid') &&
    Boolean(config.OIDC_ISSUER && config.OIDC_CLIENT_ID)
  );
}
