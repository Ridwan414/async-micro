const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-grpc');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { ExpressInstrumentation } = require('@opentelemetry/instrumentation-express');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');
const { B3Propagator, B3InjectEncoding } = require('@opentelemetry/propagator-b3');

const serviceName = process.env.SERVICE_NAME || 'gateway-service';
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://otel-collector:4317';

console.log(`[Telemetry] Initializing OpenTelemetry for ${serviceName}`);
console.log(`[Telemetry] OTLP endpoint: ${otlpEndpoint}`);

// Resource identifying the service
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.ENVIRONMENT || 'production',
});

// OTLP Trace Exporter
const traceExporter = new OTLPTraceExporter({
  url: otlpEndpoint,
});

// OTLP Metric Exporter
const metricExporter = new OTLPMetricExporter({
  url: otlpEndpoint,
});

// Metric Reader
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 15000,
});

// Initialize SDK
const sdk = new NodeSDK({
  resource: resource,
  traceExporter: traceExporter,
  metricReader: metricReader,
  instrumentations: [
    new HttpInstrumentation({
      ignoreIncomingPaths: ['/health', '/metrics'],
      requestHook: (span, request) => {
        span.setAttribute('http.request.id', request.headers['x-request-id'] || 'none');
      },
      responseHook: (span, response) => {
        span.setAttribute('http.response.content_length', response.headers['content-length'] || 0);
      },
    }),
    new ExpressInstrumentation({
      ignoreLayers: [],
      ignoreLayersType: [],
    }),
  ],
  textMapPropagator: new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }),
});

// Start SDK
sdk.start();
console.log(`[Telemetry] OpenTelemetry SDK started`);

// Graceful shutdown
const shutdown = async () => {
  console.log('[Telemetry] Shutting down OpenTelemetry SDK...');
  try {
    await sdk.shutdown();
    console.log('[Telemetry] SDK shut down successfully');
  } catch (err) {
    console.error('[Telemetry] Error shutting down SDK:', err);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { sdk };
