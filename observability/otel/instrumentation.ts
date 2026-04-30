/**
 * ============================================================
 * AMDOX OpenTelemetry Instrumentation — Node.js
 * ============================================================
 * Auto-instruments: Express, PostgreSQL, Redis, HTTP
 * Must be imported BEFORE any other module in main.ts:
 *   import './instrumentation';
 * ============================================================
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Enable debug logging in development
if (process.env.NODE_ENV === 'development') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const OTEL_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'amdox-api',
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.1.0',
    'deployment.environment': process.env.NODE_ENV || 'development',
    'service.namespace': 'amdox',
  }),

  // Traces → OTEL Collector → Jaeger
  traceExporter: new OTLPTraceExporter({
    url: `${OTEL_ENDPOINT}/v1/traces`,
  }),

  // Metrics → OTEL Collector → Prometheus
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: `${OTEL_ENDPOINT}/v1/metrics`,
    }),
    exportIntervalMillis: 15000,
  }),

  // Auto-instrumentation for common libraries
  instrumentations: [
    getNodeAutoInstrumentations({
      // Express
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      // HTTP client/server
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingPaths: ['/health/live', '/health/ready', '/metrics'],
      },
      // PostgreSQL (via pg driver)
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
      // Redis (via ioredis)
      '@opentelemetry/instrumentation-ioredis': {
        enabled: true,
      },
      // Disable unnecessary instrumentations
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: false,
      },
    }),
  ],
});

// Start the SDK
sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('OpenTelemetry SDK shut down'))
    .catch((err) => console.error('Error shutting down OTEL SDK', err))
    .finally(() => process.exit(0));
});

console.log('✅ OpenTelemetry instrumentation initialized');
