# Distributed Tracing Documentation

## Overview

This document describes the distributed tracing setup for the async-micro microservices platform. Tracing enables end-to-end visibility of requests as they flow through Gateway, Backend, Product, Worker services, and RabbitMQ.

## Architecture

```
                         Jaeger UI
                        (port 16686)
                             ^
                             |
                      Jaeger Collector
                             ^
                             |
    +------------------------+------------------------+
    |                        |                        |
+--------+    traces    +--------+    traces    +--------+
| Gateway| -----------> | Backend| -----------> | Worker |
| :3000  |              | :8000  |              | (async)|
+--------+              +--------+              +--------+
    |                        |
    | traces                 | traces
    v                        v
+----------+           +-----------+
| Product  |           | RabbitMQ  |
| :8001    |           | :5672     |
+----------+           +-----------+
```

## Infrastructure Components

### Jaeger (All-in-One)

Jaeger provides distributed tracing collection, storage, and visualization.

| Port | Protocol | Purpose |
|------|----------|---------|
| 5775 | UDP | Agent - accept zipkin.thrift |
| 6831 | UDP | Agent - accept jaeger.thrift compact |
| 6832 | UDP | Agent - accept jaeger.thrift binary |
| 5778 | HTTP | Agent - serve configs |
| 16686 | HTTP | Query - UI and API |
| 14268 | HTTP | Collector - accept jaeger.thrift |
| 14250 | gRPC | Collector - accept model.proto |

### Service Configuration

All services are pre-configured with Jaeger agent environment variables:

```yaml
environment:
  JAEGER_AGENT_HOST: jaeger
  JAEGER_AGENT_PORT: 6831
```

## Instrumentation

### Python Services (Backend, Product, Worker)

#### Required Dependencies

```txt
opentelemetry-api==1.21.0
opentelemetry-sdk==1.21.0
opentelemetry-exporter-jaeger==1.21.0
opentelemetry-instrumentation-flask==0.42b0
opentelemetry-instrumentation-pika==0.42b0
opentelemetry-instrumentation-requests==0.42b0
```

#### Setup Code

```python
# tracing.py
import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME

def init_tracing(service_name: str):
    """Initialize OpenTelemetry tracing with Jaeger exporter."""
    resource = Resource(attributes={
        SERVICE_NAME: service_name
    })

    provider = TracerProvider(resource=resource)

    jaeger_exporter = JaegerExporter(
        agent_host_name=os.getenv("JAEGER_AGENT_HOST", "localhost"),
        agent_port=int(os.getenv("JAEGER_AGENT_PORT", 6831)),
    )

    provider.add_span_processor(BatchSpanProcessor(jaeger_exporter))
    trace.set_tracer_provider(provider)

    return trace.get_tracer(service_name)
```

#### Flask Integration

```python
# app.py
from flask import Flask
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from tracing import init_tracing

app = Flask(__name__)

# Initialize tracing
tracer = init_tracing("backend-service")
FlaskInstrumentor().instrument_app(app)

@app.route("/api/tasks", methods=["POST"])
def create_task():
    with tracer.start_as_current_span("create-task") as span:
        span.set_attribute("task.type", "async")
        # ... task creation logic
```

#### RabbitMQ/Pika Integration

```python
# worker.py
from opentelemetry.instrumentation.pika import PikaInstrumentor
from tracing import init_tracing

tracer = init_tracing("worker-service")
PikaInstrumentor().instrument()

def process_message(ch, method, properties, body):
    with tracer.start_as_current_span("process-task") as span:
        span.set_attribute("queue.name", "task_queue")
        # ... message processing logic
```

### Node.js Gateway

#### Required Dependencies

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.7.0",
    "@opentelemetry/sdk-node": "^0.45.0",
    "@opentelemetry/auto-instrumentations-node": "^0.40.0",
    "@opentelemetry/exporter-jaeger": "^1.21.0"
  }
}
```

#### Setup Code

```javascript
// tracing.js
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const jaegerExporter = new JaegerExporter({
  host: process.env.JAEGER_AGENT_HOST || 'localhost',
  port: parseInt(process.env.JAEGER_AGENT_PORT) || 6831,
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'gateway-service',
  }),
  traceExporter: jaegerExporter,
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
```

#### Usage

```javascript
// index.js - require tracing FIRST
require('./tracing');
const express = require('express');
// ... rest of application
```

## Context Propagation

### HTTP Headers

Trace context is automatically propagated via W3C Trace Context headers:

- `traceparent`: Contains trace-id, span-id, and trace flags
- `tracestate`: Vendor-specific trace information

### RabbitMQ Messages

For async messaging, inject trace context into message headers:

```python
from opentelemetry import propagate
from opentelemetry.propagators.textmap import CarrierT

def publish_with_trace(channel, message):
    headers = {}
    propagate.inject(headers)

    channel.basic_publish(
        exchange='',
        routing_key='task_queue',
        body=message,
        properties=pika.BasicProperties(headers=headers)
    )
```

Extract context in the worker:

```python
def callback(ch, method, properties, body):
    ctx = propagate.extract(properties.headers or {})
    with tracer.start_as_current_span("process-message", context=ctx):
        # Process message with trace context
```

## Accessing Traces

### Jaeger UI

Access the Jaeger UI at: `http://localhost:16686`

Features:
- Search traces by service, operation, tags, or duration
- View trace timeline and span details
- Compare traces
- Analyze service dependencies

### Grafana Integration

Jaeger is pre-configured as a datasource in Grafana (`http://localhost:3001`):

1. Go to Explore
2. Select "Jaeger" datasource
3. Search for traces by service or trace ID

## Trace Sampling

### Development (Default)

All traces are sampled (100% sampling rate):

```python
from opentelemetry.sdk.trace.sampling import ALWAYS_ON
provider = TracerProvider(sampler=ALWAYS_ON)
```

### Production

Use probabilistic sampling to reduce overhead:

```python
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
sampler = TraceIdRatioBased(0.1)  # Sample 10% of traces
provider = TracerProvider(sampler=sampler)
```

## Best Practices

### Span Naming

- Use lowercase with hyphens: `create-task`, `process-order`
- Include operation type: `db-query`, `http-request`, `queue-publish`
- Be specific but not too granular

### Span Attributes

Add meaningful attributes for debugging:

```python
span.set_attribute("user.id", user_id)
span.set_attribute("order.total", order_total)
span.set_attribute("db.statement", query)
span.set_attribute("http.status_code", response.status_code)
```

### Error Handling

Record exceptions in spans:

```python
from opentelemetry.trace import Status, StatusCode

try:
    result = process_task(task)
except Exception as e:
    span.set_status(Status(StatusCode.ERROR, str(e)))
    span.record_exception(e)
    raise
```

### Span Events

Add events for significant occurrences within a span:

```python
span.add_event("cache-miss", {"key": cache_key})
span.add_event("retry-attempt", {"attempt": retry_count})
```

## Troubleshooting

### No Traces Appearing

1. Verify Jaeger is running:
   ```bash
   docker ps | grep jaeger
   ```

2. Check service connectivity to Jaeger:
   ```bash
   docker exec <service-container> nc -zv jaeger 6831
   ```

3. Verify environment variables are set:
   ```bash
   docker exec <service-container> env | grep JAEGER
   ```

### Missing Spans

1. Ensure instrumentation is initialized before application code
2. Check that context propagation headers are passed between services
3. Verify BatchSpanProcessor is flushing (check for shutdown hooks)

### High Latency

1. Reduce sampling rate in production
2. Use BatchSpanProcessor instead of SimpleSpanProcessor
3. Check Jaeger collector resource usage

## Docker Compose Configuration

```yaml
jaeger:
  image: jaegertracing/all-in-one:latest
  container_name: jaeger
  ports:
    - "5775:5775/udp"
    - "6831:6831/udp"
    - "6832:6832/udp"
    - "5778:5778"
    - "16686:16686"
    - "14268:14268"
    - "14250:14250"
  networks:
    - microservices-network
```

## Kubernetes Deployment

For production Kubernetes deployments, consider:

1. **Jaeger Operator**: Manages Jaeger instances in Kubernetes
2. **Elasticsearch Backend**: For persistent trace storage
3. **OpenTelemetry Collector**: Centralized telemetry pipeline

Example Jaeger CR:

```yaml
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: jaeger-production
spec:
  strategy: production
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: http://elasticsearch:9200
```

## References

- [OpenTelemetry Python Documentation](https://opentelemetry.io/docs/instrumentation/python/)
- [OpenTelemetry JavaScript Documentation](https://opentelemetry.io/docs/instrumentation/js/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [W3C Trace Context Specification](https://www.w3.org/TR/trace-context/)
