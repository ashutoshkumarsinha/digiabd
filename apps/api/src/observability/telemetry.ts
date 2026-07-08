import { logs } from '@opentelemetry/api-logs';
import { metrics, ValueType, type Counter, type Histogram } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import type { AppConfig } from '../config.js';

let sdk: NodeSDK | undefined;
let loggerProvider: LoggerProvider | undefined;

let httpRequestCounter: Counter | undefined;
let httpDurationHistogram: Histogram | undefined;
let otelLogger: ReturnType<typeof logs.getLogger> | undefined;

function parseHeaders(headers: string | undefined): Record<string, string> {
  if (!headers) return {};
  return headers
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const [key, ...rest] = pair.split('=');
      if (!key || rest.length === 0) return acc;
      acc[key.trim()] = rest.join('=').trim();
      return acc;
    }, {});
}

export async function initObservability(config: AppConfig): Promise<void> {
  if (!config.OTEL_ENABLED) return;

  const resource = resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: config.OTEL_SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.OTEL_SERVICE_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.NODE_ENV,
  });

  const exporterHeaders = parseHeaders(config.OTEL_EXPORTER_OTLP_HEADERS);
  const endpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '');

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
    headers: exporterHeaders,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${endpoint}/v1/metrics`,
    headers: exporterHeaders,
  });

  const logExporter = new OTLPLogExporter({
    url: `${endpoint}/v1/logs`,
    headers: exporterHeaders,
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: config.OTEL_METRIC_EXPORT_INTERVAL_MS,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  await sdk.start();

  loggerProvider = new LoggerProvider({ resource });
  loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(logExporter));
  logs.setGlobalLoggerProvider(loggerProvider);
  otelLogger = logs.getLogger(config.OTEL_SERVICE_NAME);

  const meter = metrics.getMeter(config.OTEL_SERVICE_NAME);
  httpRequestCounter = meter.createCounter('http.server.requests', {
    description: 'Total incoming HTTP requests',
    valueType: ValueType.INT,
  });
  httpDurationHistogram = meter.createHistogram('http.server.duration', {
    description: 'HTTP server request duration',
    unit: 'ms',
    valueType: ValueType.DOUBLE,
  });
}

export function recordHttpRequestMetric(params: {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}): void {
  if (!httpRequestCounter || !httpDurationHistogram) return;

  const attrs = {
    'http.request.method': params.method,
    'http.route': params.route,
    'http.response.status_code': params.statusCode,
  };

  httpRequestCounter.add(1, attrs);
  httpDurationHistogram.record(params.durationMs, attrs);
}

export function recordOtelLog(params: {
  severityText: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  body: string;
  attributes?: Record<string, string | number | boolean>;
}): void {
  if (!otelLogger) return;
  otelLogger.emit({
    severityText: params.severityText,
    body: params.body,
    attributes: params.attributes,
  });
}

export async function shutdownObservability(): Promise<void> {
  await sdk?.shutdown();
  await loggerProvider?.shutdown();
  sdk = undefined;
  loggerProvider = undefined;
  httpRequestCounter = undefined;
  httpDurationHistogram = undefined;
  otelLogger = undefined;
}
