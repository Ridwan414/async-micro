import os
import logging
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.propagators.b3 import B3Format
from opentelemetry.propagate import set_global_textmap
from prometheus_client import Counter, Histogram, Gauge, start_http_server

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
TASKS_PROCESSED = Counter(
    'worker_tasks_processed_total',
    'Total tasks processed by worker',
    ['status']
)

TASK_PROCESSING_TIME = Histogram(
    'worker_task_processing_seconds',
    'Time spent processing tasks',
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0]
)

TASKS_IN_PROGRESS = Gauge(
    'worker_tasks_in_progress',
    'Number of tasks currently being processed'
)

QUEUE_MESSAGES_RECEIVED = Counter(
    'worker_queue_messages_received_total',
    'Total messages received from queue',
    ['queue']
)

RABBITMQ_CONNECTION_STATUS = Gauge(
    'worker_rabbitmq_connection_status',
    'RabbitMQ connection status (1=connected, 0=disconnected)'
)


def init_telemetry(service_name: str, service_version: str = "1.0.0"):
    """Initialize OpenTelemetry with OTLP exporters."""

    otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4317")

    resource = Resource(attributes={
        SERVICE_NAME: service_name,
        SERVICE_VERSION: service_version,
        "deployment.environment": os.getenv("ENVIRONMENT", "production")
    })

    # Tracing setup
    tracer_provider = TracerProvider(resource=resource)

    try:
        otlp_trace_exporter = OTLPSpanExporter(
            endpoint=otlp_endpoint,
            insecure=True
        )
        tracer_provider.add_span_processor(BatchSpanProcessor(otlp_trace_exporter))
        logger.info(f"OTLP trace exporter configured: {otlp_endpoint}")
    except Exception as e:
        logger.warning(f"Failed to configure OTLP trace exporter: {e}")

    trace.set_tracer_provider(tracer_provider)

    # Metrics setup
    try:
        otlp_metric_exporter = OTLPMetricExporter(
            endpoint=otlp_endpoint,
            insecure=True
        )
        metric_reader = PeriodicExportingMetricReader(
            otlp_metric_exporter,
            export_interval_millis=15000
        )
        meter_provider = MeterProvider(resource=resource, metric_readers=[metric_reader])
        metrics.set_meter_provider(meter_provider)
        logger.info("OTLP metrics exporter configured")
    except Exception as e:
        logger.warning(f"Failed to configure OTLP metrics exporter: {e}")

    # Set B3 propagator for trace context
    set_global_textmap(B3Format())

    return trace.get_tracer(service_name), metrics.get_meter(service_name)


def start_metrics_server(port: int = 8002):
    """Start Prometheus metrics HTTP server."""
    start_http_server(port)
    logger.info(f"Prometheus metrics server started on port {port}")
