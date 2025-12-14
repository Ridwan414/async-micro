const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'gateway_',
});

// HTTP Request Duration Histogram
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// HTTP Request Counter
const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

// Active Requests Gauge
const httpActiveRequests = new client.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  registers: [register],
});

// Upstream Service Request Duration
const upstreamRequestDuration = new client.Histogram({
  name: 'upstream_request_duration_seconds',
  help: 'Duration of requests to upstream services',
  labelNames: ['service', 'method', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// Upstream Service Errors Counter
const upstreamErrors = new client.Counter({
  name: 'upstream_errors_total',
  help: 'Total number of upstream service errors',
  labelNames: ['service', 'error_type'],
  registers: [register],
});

// Circuit Breaker Status
const circuitBreakerStatus = new client.Gauge({
  name: 'circuit_breaker_status',
  help: 'Circuit breaker status (0=closed, 1=open, 0.5=half-open)',
  labelNames: ['service'],
  registers: [register],
});

module.exports = {
  register,
  httpRequestDuration,
  httpRequestTotal,
  httpActiveRequests,
  upstreamRequestDuration,
  upstreamErrors,
  circuitBreakerStatus,
};
