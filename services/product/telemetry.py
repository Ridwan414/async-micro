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
from opentelemetry.instrumentation.flask import FlaskInstrumentor
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency in seconds',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

PRODUCTS_TOTAL = Gauge(
    'products_total',
    'Total number of products in database'
)

PRODUCTS_CREATED = Counter(
    'products_created_total',
    'Total products created'
)

PRODUCTS_DELETED = Counter(
    'products_deleted_total',
    'Total products deleted'
)

PRODUCTS_UPDATED = Counter(
    'products_updated_total',
    'Total products updated'
)

DB_OPERATIONS = Counter(
    'db_operations_total',
    'Total database operations',
    ['operation', 'status']
)

ACTIVE_REQUESTS = Gauge(
    'http_requests_active',
    'Number of active HTTP requests'
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


def instrument_flask_app(app):
    """Instrument Flask app with OpenTelemetry."""
    FlaskInstrumentor().instrument_app(
        app,
        excluded_urls="health,metrics"
    )
    logger.info("Flask instrumentation enabled")


def get_prometheus_metrics():
    """Return Prometheus metrics in exposition format."""
    return generate_latest(), CONTENT_TYPE_LATEST
