# Observability Guide

This guide covers how to utilize the complete observability stack: OpenTelemetry, Jaeger, Prometheus, Grafana, Loki, and Promtail.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Access URLs](#access-urls)
4. [Prometheus - Metrics](#prometheus---metrics)
5. [Grafana - Visualization](#grafana---visualization)
6. [Loki - Logs](#loki---logs)
7. [Jaeger - Tracing](#jaeger---tracing)
8. [OpenTelemetry - Unified Instrumentation](#opentelemetry---unified-instrumentation)
9. [Correlating Data Across Tools](#correlating-data-across-tools)
10. [Alerting](#alerting)
11. [Best Practices](#best-practices)

---

## Overview

The observability stack follows the **three pillars of observability**:

```
┌─────────────────────────────────────────────────────────────────┐
│                         GRAFANA                                  │
│                    (Unified Dashboard)                           │
│         ┌──────────────┬──────────────┬──────────────┐          │
│         │   Metrics    │    Logs      │   Traces     │          │
│         └──────┬───────┴──────┬───────┴──────┬───────┘          │
└────────────────┼──────────────┼──────────────┼──────────────────┘
                 │              │              │
         ┌───────▼───────┐ ┌───▼───┐ ┌────────▼────────┐
         │  PROMETHEUS   │ │ LOKI  │ │     JAEGER      │
         │  (Metrics)    │ │(Logs) │ │   (Traces)      │
         └───────┬───────┘ └───┬───┘ └────────┬────────┘
                 │             │              │
         ┌───────▼───────┐ ┌───▼────┐ ┌───────▼────────┐
         │   /metrics    │ │Promtail│ │ OpenTelemetry  │
         │   endpoints   │ │        │ │     SDK        │
         └───────────────┘ └────────┘ └────────────────┘
                 │              │              │
         ┌───────┴──────────────┴──────────────┴───────┐
         │              APPLICATION SERVICES            │
         │    Gateway | Backend | Product | Worker      │
         └─────────────────────────────────────────────┘
```

---

## Quick Start

### Start the Full Observability Stack

```bash
# Using Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Or using Make
make prod-up
```

### Verify All Services Are Running

```bash
docker-compose -f docker-compose.prod.yml ps
```

Expected output:
```
NAME         STATUS    PORTS
grafana      running   0.0.0.0:3001->3000/tcp
prometheus   running   0.0.0.0:9090->9090/tcp
loki         running   0.0.0.0:3100->3100/tcp
promtail     running
jaeger       running   0.0.0.0:16686->16686/tcp
...
```

---

## Access URLs

| Tool | URL | Credentials |
|------|-----|-------------|
| **Grafana** | http://localhost:3001 | admin / admin |
| **Prometheus** | http://localhost:9090 | - |
| **Jaeger UI** | http://localhost:16686 | - |
| **Loki** | http://localhost:3100 | - |
| **RabbitMQ Management** | http://localhost:15672 | admin / admin |

---

## Prometheus - Metrics

Prometheus collects time-series metrics from your services via HTTP endpoints.

### How It Works

1. Services expose metrics at `/metrics` endpoint
2. Prometheus scrapes these endpoints every 15 seconds
3. Metrics are stored in time-series database
4. Query using PromQL

### Current Scrape Targets

| Job | Target | Metrics Path |
|-----|--------|--------------|
| prometheus | localhost:9090 | /metrics |
| gateway | gateway:3000 | /metrics |
| backend | backend:8000 | /metrics |
| product | product:8001 | /metrics |
| rabbitmq | rabbitmq:15692 | /metrics |

### Verify Targets

1. Go to http://localhost:9090/targets
2. Check all targets show "UP" status

### Basic PromQL Queries

```promql
# RabbitMQ queue messages ready
rabbitmq_queue_messages_ready

# RabbitMQ connections count
rabbitmq_connections

# Message publish rate (per minute)
rate(rabbitmq_channel_messages_published_total[1m])

# Message delivery rate (per minute)
rate(rabbitmq_channel_messages_delivered_total[1m])

# Queue consumer count
rabbitmq_queue_consumers

# Memory usage by RabbitMQ
rabbitmq_process_resident_memory_bytes
```

### Adding Metrics to Python Services

```python
# requirements.txt
prometheus-client==0.19.0

# app.py
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from flask import Flask, Response

app = Flask(__name__)

# Define metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

# Expose metrics endpoint
@app.route('/metrics')
def metrics():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

# Instrument your routes
@app.route('/api/tasks', methods=['POST'])
def create_task():
    with REQUEST_LATENCY.labels(method='POST', endpoint='/api/tasks').time():
        # Your logic here
        REQUEST_COUNT.labels(method='POST', endpoint='/api/tasks', status='200').inc()
        return {"status": "ok"}
```

### Adding Metrics to Node.js Gateway

```javascript
// package.json - add dependency
"prom-client": "^15.0.0"

// metrics.js
const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});
register.registerMetric(httpRequestTotal);

module.exports = { register, httpRequestDuration, httpRequestTotal };

// index.js
const { register, httpRequestDuration, httpRequestTotal } = require('./metrics');

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Middleware to track all requests
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.path, status_code: res.statusCode });
    httpRequestTotal.inc({ method: req.method, route: req.path, status_code: res.statusCode });
  });
  next();
});
```

---

## Grafana - Visualization

Grafana provides unified dashboards for metrics, logs, and traces.

### Pre-configured Datasources

| Datasource | Type | URL |
|------------|------|-----|
| Prometheus | prometheus | http://prometheus:9090 |
| Loki | loki | http://loki:3100 |
| Jaeger | jaeger | http://jaeger:16686 |

### Using the Pre-built Dashboard

1. Login to Grafana: http://localhost:3001 (admin/admin)
2. Go to Dashboards → Browse
3. Find "Async Microservices" dashboard

The dashboard includes:
- RabbitMQ Queue Messages (stat panel)
- RabbitMQ Connections (stat panel)
- Message Rate per minute (time series)
- Container Logs (logs panel)

### Creating Custom Dashboards

#### Step 1: Create New Dashboard
1. Click "+" → "New Dashboard"
2. Click "Add visualization"

#### Step 2: Add Metrics Panel
```promql
# Example: HTTP request rate by service
sum(rate(http_requests_total[5m])) by (service)

# Example: 95th percentile latency
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))
```

#### Step 3: Add Logs Panel
1. Select "Loki" as datasource
2. Use LogQL query:
```logql
{container_name="backend"} |= "error"
```

#### Step 4: Add Traces Panel
1. Select "Jaeger" as datasource
2. Choose service from dropdown
3. Set time range

### Useful Dashboard Panels

#### Service Health Overview
```promql
# Up status for all services
up{job=~"gateway|backend|product"}
```

#### Error Rate
```promql
# Error rate percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) * 100
```

#### Queue Depth Alert
```promql
# Messages waiting in queue
rabbitmq_queue_messages_ready > 100
```

---

## Loki - Logs

Loki aggregates logs from all containers via Promtail.

### How It Works

1. **Promtail** reads Docker container logs from `/var/lib/docker/containers/`
2. Parses JSON logs and extracts labels
3. Pushes to **Loki** at `http://loki:3100/loki/api/v1/push`
4. Query logs using **LogQL** in Grafana

### LogQL Query Examples

```logql
# All logs from a specific container
{container_name="backend"}

# Filter logs containing "error" (case insensitive)
{container_name="backend"} |~ "(?i)error"

# Filter logs NOT containing "health"
{container_name="gateway"} !~ "health"

# Parse JSON logs and filter by level
{container_name="backend"} | json | level="error"

# Count errors per container
sum(count_over_time({container_name=~".+"} |~ "error" [5m])) by (container_name)

# Logs from multiple containers
{container_name=~"backend|worker|gateway"}

# Search for specific request ID
{container_name=~".+"} |= "request_id=abc123"
```

### Using Loki in Grafana

1. Go to **Explore** (compass icon)
2. Select **Loki** datasource
3. Build query using:
   - **Label browser**: Click labels to filter
   - **Query builder**: Visual query construction
   - **Code mode**: Write raw LogQL

### Log Correlation with Traces

To correlate logs with traces, include trace ID in logs:

```python
import logging
from opentelemetry import trace

logger = logging.getLogger(__name__)

def process_request():
    span = trace.get_current_span()
    trace_id = span.get_span_context().trace_id

    # Include trace_id in log
    logger.info(f"Processing request", extra={
        "trace_id": format(trace_id, '032x')
    })
```

---

## Jaeger - Tracing

Jaeger provides distributed tracing to track requests across services.

### Accessing Jaeger UI

1. Go to http://localhost:16686
2. Select a service from dropdown
3. Click "Find Traces"

### Jaeger UI Features

#### Search Traces
- **Service**: Filter by service name
- **Operation**: Filter by operation/endpoint
- **Tags**: Search by span attributes (e.g., `http.status_code=500`)
- **Min/Max Duration**: Find slow requests
- **Limit**: Number of results

#### Trace View
- **Timeline**: Visual representation of spans
- **Span Details**: Tags, logs, process info
- **Critical Path**: Highlighted slow operations
- **Compare**: Compare two traces side by side

#### Dependencies
- View service dependency graph
- Shows call relationships between services

### Understanding Trace Data

```
Trace: abc123
├── gateway: HTTP GET /api/products (50ms)
│   ├── backend: HTTP GET /products (30ms)
│   │   └── db: SELECT * FROM products (10ms)
│   └── cache: GET products:all (5ms)
```

Key concepts:
- **Trace**: Complete journey of a request
- **Span**: Single operation within a trace
- **Parent/Child**: Hierarchical relationship
- **Tags**: Key-value metadata
- **Logs**: Events within a span

### Search by Tags

Common tag searches:
```
http.status_code=500
error=true
user.id=12345
http.method=POST
```

---

## OpenTelemetry - Unified Instrumentation

OpenTelemetry provides vendor-neutral instrumentation for traces, metrics, and logs.

### Why OpenTelemetry?

- **Vendor-neutral**: Switch backends without code changes
- **Unified**: Single SDK for traces, metrics, logs
- **Auto-instrumentation**: Automatic instrumentation for frameworks
- **Standard**: W3C Trace Context for propagation

### Architecture with OpenTelemetry

```
┌─────────────────────────────────────────────────────────┐
│                    Your Services                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │           OpenTelemetry SDK                      │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │    │
│  │  │ Traces  │ │ Metrics │ │  Logs   │           │    │
│  │  └────┬────┘ └────┬────┘ └────┬────┘           │    │
│  └───────┼───────────┼───────────┼─────────────────┘    │
└──────────┼───────────┼───────────┼──────────────────────┘
           │           │           │
           ▼           ▼           ▼
┌──────────────────────────────────────────────────────────┐
│              OpenTelemetry Collector (Optional)          │
│         Process, filter, and export telemetry            │
└─────────┬─────────────────┬─────────────────┬────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │  Jaeger  │     │Prometheus│     │   Loki   │
    └──────────┘     └──────────┘     └──────────┘
```

### Complete Python Setup

```python
# requirements.txt
opentelemetry-api==1.21.0
opentelemetry-sdk==1.21.0
opentelemetry-exporter-jaeger==1.21.0
opentelemetry-exporter-prometheus==0.42b0
opentelemetry-instrumentation-flask==0.42b0
opentelemetry-instrumentation-requests==0.42b0
opentelemetry-instrumentation-pika==0.42b0

# telemetry.py
import os
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from prometheus_client import start_http_server

def init_telemetry(service_name: str, metrics_port: int = 8000):
    """Initialize OpenTelemetry with Jaeger and Prometheus exporters."""

    # Resource identifies the service
    resource = Resource(attributes={
        SERVICE_NAME: service_name
    })

    # === TRACING ===
    tracer_provider = TracerProvider(resource=resource)

    jaeger_exporter = JaegerExporter(
        agent_host_name=os.getenv("JAEGER_AGENT_HOST", "localhost"),
        agent_port=int(os.getenv("JAEGER_AGENT_PORT", 6831)),
    )

    tracer_provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))
    trace.set_tracer_provider(tracer_provider)

    # === METRICS ===
    # PrometheusMetricReader exposes metrics at /metrics
    reader = PrometheusMetricReader()
    meter_provider = MeterProvider(resource=resource, metric_readers=[reader])
    metrics.set_meter_provider(meter_provider)

    return trace.get_tracer(service_name), metrics.get_meter(service_name)

# app.py
from flask import Flask
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from telemetry import init_telemetry

app = Flask(__name__)

# Initialize telemetry BEFORE instrumenting
tracer, meter = init_telemetry("backend-service")

# Auto-instrument Flask and requests library
FlaskInstrumentor().instrument_app(app)
RequestsInstrumentor().instrument()

# Create custom metrics
request_counter = meter.create_counter(
    name="tasks_created",
    description="Number of tasks created",
    unit="1"
)

@app.route("/api/tasks", methods=["POST"])
def create_task():
    # Custom span
    with tracer.start_as_current_span("create-task") as span:
        span.set_attribute("task.type", "async")

        # Increment counter
        request_counter.add(1, {"status": "success"})

        # Your logic
        return {"status": "created"}
```

### Complete Node.js Setup

```javascript
// package.json dependencies
{
  "@opentelemetry/api": "^1.7.0",
  "@opentelemetry/sdk-node": "^0.45.0",
  "@opentelemetry/auto-instrumentations-node": "^0.40.0",
  "@opentelemetry/exporter-jaeger": "^1.21.0",
  "@opentelemetry/exporter-prometheus": "^0.45.0"
}

// telemetry.js - MUST be required first
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { PrometheusExporter } = require('@opentelemetry/exporter-prometheus');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const serviceName = process.env.SERVICE_NAME || 'gateway-service';

// Jaeger exporter for traces
const jaegerExporter = new JaegerExporter({
  host: process.env.JAEGER_AGENT_HOST || 'localhost',
  port: parseInt(process.env.JAEGER_AGENT_PORT) || 6831,
});

// Prometheus exporter for metrics
const prometheusExporter = new PrometheusExporter({
  port: 9464, // Metrics available at :9464/metrics
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  }),
  traceExporter: jaegerExporter,
  metricReader: prometheusExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/metrics'],
      },
    }),
  ],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Telemetry terminated'))
    .finally(() => process.exit(0));
});

module.exports = sdk;

// index.js - require telemetry FIRST
require('./telemetry');

const express = require('express');
const { trace, metrics } = require('@opentelemetry/api');

const app = express();
const tracer = trace.getTracer('gateway-service');
const meter = metrics.getMeter('gateway-service');

// Custom metric
const requestCounter = meter.createCounter('gateway_requests_total', {
  description: 'Total requests to gateway',
});

app.get('/api/products', async (req, res) => {
  // Create custom span
  const span = tracer.startSpan('fetch-products');

  try {
    requestCounter.add(1, { endpoint: '/api/products' });
    // Your logic
    span.setStatus({ code: 1 }); // OK
  } catch (error) {
    span.setStatus({ code: 2, message: error.message }); // ERROR
    span.recordException(error);
  } finally {
    span.end();
  }
});
```

---

## Correlating Data Across Tools

The real power of observability comes from correlating metrics, logs, and traces.

### Scenario: Investigating High Latency

#### Step 1: Identify the Problem (Metrics)
```promql
# Find slow endpoints
histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, endpoint))
```

#### Step 2: Find Related Traces (Jaeger)
1. Go to Jaeger UI
2. Select the slow service
3. Filter by operation and min duration
4. Examine trace timeline

#### Step 3: Check Logs (Loki)
```logql
# Find logs during the incident
{container_name="backend"} | json | ts >= "2024-01-15T10:00:00Z" | ts <= "2024-01-15T10:05:00Z"
```

#### Step 4: Correlate by Trace ID
```logql
# Find all logs for a specific trace
{container_name=~".+"} |= "trace_id=abc123def456"
```

### Setting Up Trace-to-Logs in Grafana

1. Go to **Configuration** → **Data sources** → **Jaeger**
2. Under "Trace to logs":
   - Select Loki datasource
   - Set filter: `{container_name="${__span.tags.service}"}`
3. Now clicking a trace span shows related logs

### Setting Up Metrics-to-Traces

1. Add exemplars to your metrics (requires OpenTelemetry)
2. In Grafana, enable "Exemplars" in panel options
3. Click exemplar points to jump to traces

---

## Alerting

### Prometheus Alerting Rules

Create `monitoring/prometheus/alerts.yml`:

```yaml
groups:
  - name: microservices
    rules:
      - alert: HighErrorRate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
          description: Error rate is {{ $value | printf "%.2f" }}%

      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: Service {{ $labels.job }} is down

      - alert: HighQueueDepth
        expr: rabbitmq_queue_messages_ready > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: RabbitMQ queue depth is high
          description: Queue {{ $labels.queue }} has {{ $value }} messages

      - alert: HighLatency
        expr: histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High latency on {{ $labels.service }}
```

### Grafana Alerting

1. Edit a panel in Grafana
2. Go to "Alert" tab
3. Set conditions:
   - Evaluate every: 1m
   - For: 5m
   - Condition: WHEN avg() OF query IS ABOVE 0.05
4. Configure notification channels (Slack, PagerDuty, email)

---

## Best Practices

### Metrics

1. **Use histograms for latency** - Not averages
2. **Add labels wisely** - High cardinality = high cost
3. **Use rate() for counters** - Raw counters are less useful
4. **Name consistently** - `{namespace}_{subsystem}_{name}_{unit}`

### Logging

1. **Use structured logging** - JSON format
2. **Include context** - Request ID, user ID, trace ID
3. **Log levels matter** - ERROR for errors, INFO for business events
4. **Don't log sensitive data** - Passwords, tokens, PII

### Tracing

1. **Instrument at boundaries** - HTTP, RPC, database, queue
2. **Use meaningful span names** - `db.query` not `span1`
3. **Add relevant attributes** - user_id, order_id, etc.
4. **Sample in production** - 100% sampling is expensive

### General

1. **Set up alerts early** - Don't wait for production issues
2. **Create runbooks** - Link alerts to documentation
3. **Review dashboards regularly** - Remove unused panels
4. **Test your observability** - Chaos engineering

---

## Troubleshooting

### Prometheus Not Scraping

```bash
# Check target status
curl http://localhost:9090/api/v1/targets

# Test metrics endpoint directly
curl http://localhost:8000/metrics
```

### Loki Not Receiving Logs

```bash
# Check Promtail logs
docker logs promtail

# Verify Loki is healthy
curl http://localhost:3100/ready

# Check if logs are being pushed
curl http://localhost:3100/loki/api/v1/query?query={job="containerlogs"}
```

### Jaeger Not Showing Traces

```bash
# Check Jaeger health
curl http://localhost:14269/

# Verify UDP connectivity (from service container)
docker exec backend nc -zvu jaeger 6831

# Check Jaeger logs
docker logs jaeger
```

### Grafana Datasource Errors

1. Check datasource connectivity in Grafana UI
2. Verify internal Docker network DNS resolution
3. Test from Grafana container:
   ```bash
   docker exec grafana wget -qO- http://prometheus:9090/api/v1/status/config
   ```

---

## Quick Reference

| Task | Tool | Query/Action |
|------|------|--------------|
| Check service health | Prometheus | `up{job="backend"}` |
| Find error logs | Loki | `{container_name="backend"} \|~ "error"` |
| Trace slow request | Jaeger | Filter by duration > 1s |
| View request rate | Grafana | `rate(http_requests_total[5m])` |
| Check queue depth | Prometheus | `rabbitmq_queue_messages_ready` |
| Find specific request | Loki | `{} \|= "request_id=abc123"` |
| Compare deployments | Grafana | Time shift comparison |

---

## Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
- [LogQL Documentation](https://grafana.com/docs/loki/latest/logql/)
