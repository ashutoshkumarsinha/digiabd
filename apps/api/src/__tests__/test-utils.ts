import type { AppConfig } from '../config.js';

export function makeTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    API_VERSION: 'v1',
    JWT_SECRET: process.env.JWT_SECRET ?? 'test-jwt-secret-1234567890',
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: undefined,
    KAFKA_BROKERS: undefined,
    KAFKA_ENABLED: false,
    S3_ENDPOINT: undefined,
    S3_ACCESS_KEY: undefined,
    S3_SECRET_KEY: undefined,
    S3_BUCKET: 'digiabd-files',
    S3_REGION: 'ap-south-1',
    S3_USE_SSL: undefined,
    CORS_ORIGIN: 'http://localhost:5173',
    OIDC_ISSUER: undefined,
    OIDC_CLIENT_ID: undefined,
    OIDC_CLIENT_SECRET: undefined,
    OIDC_REDIRECT_URI: 'http://localhost:5173/auth/callback',
    AUTH_MODE: 'hybrid',
    OTEL_ENABLED: false,
    OTEL_SERVICE_NAME: 'digiabd-api',
    OTEL_SERVICE_VERSION: '0.4.0',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    OTEL_EXPORTER_OTLP_HEADERS: undefined,
    OTEL_METRIC_EXPORT_INTERVAL_MS: 10000,
    ...overrides,
  };
}

