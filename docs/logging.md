# Logging Architecture

This document describes the centralized logging stack for the Async Microservices Platform.

## Overview

The logging stack consists of four main components:

```
+------------------+     +------------------+     +------------------+
|   Application    | --> |   Fluent Bit     | --> |      Loki        |
|     Pods         |     |   (Collector)    |     |   (Aggregator)   |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
                         +------------------+     +------------------+
                         |     Grafana      | <-- |      MinIO       |
                         |  (Visualization) |     |    (Storage)     |
                         +------------------+     +------------------+
```

| Component | Purpose | Port |
|-----------|---------|------|
| Fluent Bit | Log collection from containers | 2020 (metrics) |
| Loki | Log aggregation and querying | 3100 (HTTP), 9096 (gRPC) |
| MinIO | S3-compatible object storage | 9000 (API), 9001 (Console) |
| Grafana | Log visualization and dashboards | 3000 |

## Logging Pipeline Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LOGGING PIPELINE WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: LOG GENERATION                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                                  │
│  │  Worker  │  │   API    │  │  Gateway │  ← Application pods write logs   │
│  │   Pod    │  │   Pod    │  │   Pod    │    to stdout/stderr              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                                  │
│       │             │             │                                         │
│       ▼             ▼             ▼                                         │
│  ┌─────────────────────────────────────┐                                   │
│  │     /var/log/containers/*.log       │  ← Kubernetes writes to node      │
│  └─────────────────┬───────────────────┘                                   │
│                    │                                                        │
│  STEP 2: LOG COLLECTION                                                     │
│                    ▼                                                        │
│  ┌─────────────────────────────────────┐                                   │
│  │           FLUENT BIT                │  ← DaemonSet on every node        │
│  │   • Tails container log files       │    collects & enriches logs       │
│  │   • Adds K8s metadata (pod, ns)     │                                   │
│  │   • Parses JSON logs                │                                   │
│  └─────────────────┬───────────────────┘                                   │
│                    │                                                        │
│  STEP 3: LOG AGGREGATION                                                    │
│                    ▼                                                        │
│  ┌─────────────────────────────────────┐                                   │
│  │             LOKI                    │  ← Receives, indexes & stores     │
│  │   • Indexes by labels (not content) │    logs efficiently               │
│  │   • Compresses log chunks           │                                   │
│  │   • Stores in MinIO (S3)            │                                   │
│  └─────────────────┬───────────────────┘                                   │
│                    │                                                        │
│  STEP 4: LOG STORAGE                                                        │
│                    ▼                                                        │
│  ┌─────────────────────────────────────┐                                   │
│  │             MINIO                   │  ← S3-compatible object storage   │
│  │   • loki-data bucket (log chunks)   │    for durability & scale         │
│  │   • 7-day retention configured      │                                   │
│  └─────────────────┬───────────────────┘                                   │
│                    │                                                        │
│  STEP 5: LOG VISUALIZATION                                                  │
│                    ▼                                                        │
│  ┌─────────────────────────────────────┐                                   │
│  │           GRAFANA                   │  ← Query & visualize logs         │
│  │   • LogQL queries                   │    with powerful filtering        │
│  │   • Real-time log streaming         │                                   │
│  │   • Dashboards & alerts             │                                   │
│  └─────────────────────────────────────┘                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Workflow Steps Explained

| Step | Component | What Happens |
|------|-----------|--------------|
| 1 | Application Pods | Services (worker, API, gateway) write logs to stdout/stderr |
| 2 | Kubernetes | Container runtime captures logs to `/var/log/containers/` |
| 3 | Fluent Bit | DaemonSet tails log files, parses JSON, adds K8s metadata |
| 4 | Loki | Receives logs, indexes by labels, compresses into chunks |
| 5 | MinIO | Stores log chunks in S3-compatible buckets |
| 6 | Grafana | Queries Loki via LogQL, displays logs and dashboards |

## Live Demo - Proving the Pipeline Works

Use these commands to demonstrate each step of the logging pipeline:

### Step 1: Verify Applications Generate Logs

```bash
# Show logs from worker pods
kubectl logs -l app=worker --tail=3

# Show logs from API pods
kubectl logs -l app=api --tail=3
```

### Step 2: Prove Fluent Bit is Collecting

```bash
# Check Fluent Bit metrics (requires port-forward on 2020)
curl -s http://localhost:2020/api/v1/metrics

# Expected output shows:
# - "records": number of logs collected
# - "bytes": data processed
# - "errors": 0 (healthy)
```

### Step 3: Prove Loki Received Logs

```bash
# Check available labels (requires port-forward on 3101)
curl -s "http://localhost:3101/loki/api/v1/labels"

# Expected: namespace, pod, container, job labels

# Query recent logs
curl -s -G "http://localhost:3101/loki/api/v1/query" \
  --data-urlencode 'query={job="fluent-bit"}' \
  --data-urlencode 'limit=3'
```

### Step 4: Prove MinIO is Storing Data

1. Open MinIO Console: http://localhost:9002
2. Login: `minioadmin` / `minioadmin`
3. Go to **Object Browser**
4. Click on `loki-data` bucket
5. Show the stored log chunks

### Step 5: Query Logs in Grafana

1. Open Grafana: http://localhost:3004
2. Login: `admin` / `admin`
3. Go to **Explore** (compass icon)
4. Select **Loki** datasource
5. Run queries:

```logql
# All logs from default namespace
{namespace="default"}

# Worker pod logs
{pod=~"worker.*"}

# Search for errors
{namespace="default"} |= "error"

# Count logs per pod
sum by (pod) (count_over_time({namespace="default"}[5m]))
```

## Components

### Fluent Bit (Log Collector)

Fluent Bit runs as a DaemonSet, ensuring one instance per node to collect logs from all containers.

**Configuration:** `manifests/logging/fluent-bit.yaml`

**Key Features:**
- Tails container logs from `/var/log/containers/*.log`
- Enriches logs with Kubernetes metadata (namespace, pod, container names)
- Outputs to Loki with automatic labeling
- Memory buffer limit: 50MB per node

**Labels Applied:**
- `job=fluent-bit`
- `namespace=$kubernetes['namespace_name']`
- `pod=$kubernetes['pod_name']`
- `container=$kubernetes['container_name']`

**Resource Limits:**
```yaml
requests:
  memory: "64Mi"
  cpu: "50m"
limits:
  memory: "128Mi"
  cpu: "200m"
```

### Loki (Log Aggregator)

Loki stores and indexes logs, making them queryable via LogQL.

**Configuration:** `manifests/logging/loki.yaml`

**Key Settings:**
- Schema: v11 with BoltDB shipper
- Index period: 24 hours
- Retention period: 168 hours (7 days)
- Max ingestion rate: 16 MB/s
- Burst size: 32 MB

**Storage Configuration:**
- Index stored in BoltDB
- Chunks stored in MinIO (S3-compatible)
- Bucket: `loki-data`

**Resource Limits:**
```yaml
requests:
  memory: "256Mi"
  cpu: "100m"
limits:
  memory: "512Mi"
  cpu: "500m"
```

### MinIO (Object Storage)

MinIO provides S3-compatible storage for Loki's log chunks.

**Configuration:** `manifests/logging/minio.yaml`

**Credentials:**
- Username: `minioadmin`
- Password: `minioadmin`

**Buckets:**
- `loki-data` - Log chunk storage
- `loki-ruler` - Alerting rules storage

**Storage:**
- PersistentVolumeClaim: 5Gi

### Grafana (Visualization)

Grafana provides the UI for querying and visualizing logs.

**Configuration:** `manifests/logging/grafana.yaml`

**Access:**
- NodePort: 30030
- Username: `admin`
- Password: `admin`

**Pre-configured Datasource:**
- Loki at `http://loki:3100`

## Deployment

### Deploy Logging Stack

```bash
# Create logging namespace and deploy all components
kubectl apply -f manifests/logging/minio.yaml
kubectl apply -f manifests/logging/loki.yaml
kubectl apply -f manifests/logging/fluent-bit.yaml
kubectl apply -f manifests/logging/grafana.yaml

# Or deploy all at once
kubectl apply -f manifests/logging/
```

### Verify Deployment

```bash
# Check all pods are running
kubectl get pods -n logging

# Expected output:
# NAME                       READY   STATUS    RESTARTS
# fluent-bit-xxxxx           1/1     Running   0
# grafana-xxxxx              1/1     Running   0
# loki-xxxxx                 1/1     Running   0
# minio-xxxxx                1/1     Running   0
```

### Access Services in Kind

Kind runs Kubernetes inside Docker, so NodePort services aren't directly accessible on localhost. Use `kubectl port-forward` to access the logging services.

**Important:** If Docker Compose is also running on your machine, use different ports to avoid conflicts:

```bash
# Grafana - Log visualization UI
kubectl port-forward svc/grafana -n logging 3004:3000 &
# Access at: http://localhost:3004
# Credentials: admin / admin

# Loki - Log query API
kubectl port-forward svc/loki -n logging 3101:3100 &
# Access at: http://localhost:3101

# MinIO Console - Object storage UI
kubectl port-forward svc/minio -n logging 9002:9001 &
# Access at: http://localhost:9002
# Credentials: minioadmin / minioadmin

# MinIO API - S3-compatible endpoint
kubectl port-forward svc/minio -n logging 9003:9000 &
# Access at: http://localhost:9003

# Fluent Bit Metrics - Health monitoring
kubectl port-forward svc/fluent-bit -n logging 2020:2020 &
# Access at: http://localhost:2020/api/v1/metrics
```

**Note:** If Docker Compose is NOT running, you can use the standard ports (3000, 3100, 9001).

#### Quick Start Script

Run all port-forwards at once:

```bash
# Start all logging service port-forwards
kubectl port-forward svc/grafana -n logging 3000:3000 &
kubectl port-forward svc/loki -n logging 3100:3100 &
kubectl port-forward svc/minio -n logging 9001:9001 &

echo "Logging services available at:"
echo "  Grafana:       http://localhost:3000  (admin/admin)"
echo "  Loki API:      http://localhost:3100"
echo "  MinIO Console: http://localhost:9001  (minioadmin/minioadmin)"
```

#### Stop Port Forwards

```bash
# Kill all kubectl port-forward processes
pkill -f "kubectl port-forward"

# Or on Windows
taskkill /F /IM kubectl.exe
```

### Access Services URLs Summary

| Service | URL | Credentials | Purpose |
|---------|-----|-------------|---------|
| Grafana | http://localhost:3000 | admin / admin | Log visualization & dashboards |
| Loki | http://localhost:3100 | - | Log query API |
| MinIO Console | http://localhost:9001 | minioadmin / minioadmin | Storage management |
| MinIO API | http://localhost:9000 | minioadmin / minioadmin | S3-compatible API |
| Fluent Bit | http://localhost:2020 | - | Metrics & health |

### Alternative: NodePort with Kind Extra Port Mappings

To use NodePort directly, create Kind cluster with port mappings:

```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    extraPortMappings:
      - containerPort: 30030
        hostPort: 30030
        protocol: TCP
```

```bash
# Create cluster with config
kind create cluster --name microservices-prod --config kind-config.yaml

# Then Grafana will be accessible at http://localhost:30030
```

## Querying Logs

### Using Grafana Explore

1. Open Grafana at http://localhost:3000 (or NodePort 30030)
2. Click **Explore** (compass icon)
3. Select **Loki** datasource
4. Enter LogQL query

### LogQL Query Examples

```logql
# All logs from a namespace
{namespace="default"}

# Logs from a specific pod
{pod="api-deployment-xxxxx"}

# Logs from a specific container
{container="backend"}

# Filter by log content
{namespace="default"} |= "error"

# Regex filter
{namespace="default"} |~ "ERROR|WARN"

# JSON parsing
{container="backend"} | json | level="error"

# Rate of errors per minute
rate({namespace="default"} |= "error" [1m])
```

### Using Loki API

```bash
# Query logs via API
curl -G -s "http://localhost:3100/loki/api/v1/query_range" \
  --data-urlencode 'query={namespace="default"}' \
  --data-urlencode 'start=1h' | jq

# Check Loki status
curl http://localhost:3100/ready

# Get label values
curl http://localhost:3100/loki/api/v1/labels
```

## Comparison: Dev vs Production

| Component | Docker Compose (Dev) | Kubernetes (Prod) |
|-----------|---------------------|-------------------|
| Log Collector | Loki Docker Driver | Fluent Bit DaemonSet |
| Log Storage | Loki (filesystem) | Loki + MinIO (S3) |
| Scalability | Single node | Distributed |
| Retention | Default | 7 days configured |
| High Availability | No | Possible with replicas |

## Troubleshooting

### Fluent Bit Not Collecting Logs

```bash
# Check Fluent Bit logs
kubectl logs -n logging -l app=fluent-bit

# Verify RBAC permissions
kubectl auth can-i get pods --as=system:serviceaccount:logging:fluent-bit

# Check if pods are being watched
kubectl exec -n logging -it <fluent-bit-pod> -- cat /var/log/flb_kube.db
```

### Loki Not Receiving Logs

```bash
# Check Loki logs
kubectl logs -n logging -l app=loki

# Verify Loki is ready
curl http://localhost:3100/ready

# Check Loki metrics
curl http://localhost:3100/metrics | grep loki_ingester
```

### MinIO Connection Issues

```bash
# Check MinIO logs
kubectl logs -n logging -l app=minio

# Verify bucket exists
kubectl exec -n logging -it <minio-pod> -- mc alias set local http://localhost:9000 minioadmin minioadmin
kubectl exec -n logging -it <minio-pod> -- mc ls local/
```

### No Logs in Grafana

1. Verify Loki datasource is configured correctly
2. Check time range in Grafana (logs may be outside selected range)
3. Verify namespace labels match your query
4. Check Fluent Bit -> Loki connectivity:
   ```bash
   kubectl exec -n logging -it <fluent-bit-pod> -- wget -qO- http://loki:3100/ready
   ```

## Resource Tuning

### For High-Volume Logs

Increase Fluent Bit memory buffer:
```yaml
# In fluent-bit.conf
[INPUT]
    Mem_Buf_Limit     100MB  # Increase from 50MB
```

Increase Loki ingestion limits:
```yaml
# In loki.yaml
limits_config:
  ingestion_rate_mb: 32      # Increase from 16
  ingestion_burst_size_mb: 64  # Increase from 32
```

### For Longer Retention

Modify Loki retention settings:
```yaml
# In loki.yaml
limits_config:
  reject_old_samples_max_age: 336h  # 14 days

table_manager:
  retention_period: 336h  # 14 days
```

Increase MinIO storage:
```yaml
# In minio.yaml
resources:
  requests:
    storage: 20Gi  # Increase from 5Gi
```

## Security Considerations

### Production Recommendations

1. **Change default credentials** for MinIO and Grafana
2. **Enable authentication** in Loki (`auth_enabled: true`)
3. **Use Kubernetes Secrets** instead of hardcoded credentials
4. **Enable TLS** for inter-service communication
5. **Restrict network policies** to logging namespace

### Example: Using Secrets

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: minio-credentials
  namespace: logging
type: Opaque
data:
  access-key: <base64-encoded>
  secret-key: <base64-encoded>
```

## Storage & Volumes

### Volume Types Used

| Component | Volume Name | Type | Size | Purpose |
|-----------|-------------|------|------|---------|
| **MinIO** | minio-pvc | PersistentVolumeClaim | 5Gi | Log chunk storage (durable) |
| **Loki** | loki-data | emptyDir | - | Temporary index/cache (ephemeral) |
| **Loki** | config | ConfigMap | - | Loki configuration |
| **Fluent Bit** | varlog | hostPath | - | Access node's `/var/log` |
| **Fluent Bit** | varlibdockercontainers | hostPath | - | Access container logs |
| **Fluent Bit** | config | ConfigMap | - | Fluent Bit configuration |
| **Grafana** | datasources | ConfigMap | - | Datasource configuration |

### Volume Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      VOLUME TYPES USED                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PersistentVolumeClaim (PVC)     ← DURABLE STORAGE             │
│  ┌─────────────────────────┐                                   │
│  │ MinIO: minio-pvc (5Gi)  │  Survives pod restarts            │
│  │ StorageClass: standard  │  Backed by local-path-provisioner │
│  └─────────────────────────┘                                   │
│                                                                 │
│  emptyDir                        ← EPHEMERAL STORAGE           │
│  ┌─────────────────────────┐                                   │
│  │ Loki: loki-data         │  Lost on pod restart              │
│  │ (index cache only)      │  Actual logs stored in MinIO      │
│  └─────────────────────────┘                                   │
│                                                                 │
│  hostPath                        ← NODE FILESYSTEM ACCESS      │
│  ┌─────────────────────────┐                                   │
│  │ Fluent Bit:             │  Reads logs from node             │
│  │ /var/log                │  Read-only access                 │
│  │ /var/lib/docker/...     │                                   │
│  └─────────────────────────┘                                   │
│                                                                 │
│  ConfigMap                       ← CONFIGURATION               │
│  ┌─────────────────────────┐                                   │
│  │ All components          │  Mounted as files                 │
│  │ (fluent-bit.conf, etc)  │                                   │
│  └─────────────────────────┘                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Design?

| Volume Type | Used By | Reason |
|-------------|---------|--------|
| **PVC** | MinIO | Logs must persist across restarts |
| **emptyDir** | Loki | Cache only; actual data in MinIO (S3) |
| **hostPath** | Fluent Bit | Must read container logs from node filesystem |
| **ConfigMap** | All | Configuration as code, version controlled |

> **Key Point:** "MinIO uses PersistentVolumeClaim for durable storage. Even if pods restart, log data persists. Loki uses emptyDir for working cache, but actual log chunks are stored in MinIO, so no data loss occurs."

## Deployment Patterns

### Patterns Used

| Pattern | Used? | Component |
|---------|-------|-----------|
| **DaemonSet** | ✅ Yes | Fluent Bit |
| **Sidecar** | ❌ No | Not used |

### DaemonSet Pattern (Used by Fluent Bit)

```
┌─────────────────────────────────────────────────────────────────┐
│                    DAEMONSET PATTERN                            │
│                    (One per Node)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Node 1                    Node 2                    Node 3     │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────┐ │
│  │ ┌─────┐ ┌─────┐│      │ ┌─────┐ ┌─────┐│      │ ┌─────┐ │ │
│  │ │ App │ │ App ││      │ │ App │ │ App ││      │ │ App │ │ │
│  │ └──┬──┘ └──┬──┘│      │ └──┬──┘ └──┬──┘│      │ └──┬──┘ │ │
│  │    │       │   │      │    │       │   │      │    │    │ │
│  │    ▼       ▼   │      │    ▼       ▼   │      │    ▼    │ │
│  │  /var/log/containers   │  /var/log/containers  │  /var/log │
│  │         │      │      │         │      │      │    │    │ │
│  │    ┌────▼────┐ │      │    ┌────▼────┐ │      │ ┌──▼──┐ │ │
│  │    │Fluent   │ │      │    │Fluent   │ │      │ │Fluen│ │ │
│  │    │Bit Pod  │ │      │    │Bit Pod  │ │      │ │t Bit│ │ │
│  │    └─────────┘ │      │    └─────────┘ │      │ └─────┘ │ │
│  └─────────────────┘      └─────────────────┘      └─────────┘ │
│                                                                 │
│  ✅ One Fluent Bit per node collects ALL container logs        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Sidecar Pattern (NOT Used)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIDECAR PATTERN                              │
│                    (One per Pod)                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pod 1                     Pod 2                     Pod 3      │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────┐ │
│  │ ┌─────┐ ┌─────┐│      │ ┌─────┐ ┌─────┐│      │┌───┐┌───┐│ │
│  │ │ App │ │Fluen││      │ │ App │ │Fluen││      ││App││FB ││ │
│  │ │     │ │t Bit││      │ │     │ │t Bit││      ││   ││   ││ │
│  │ └─────┘ └─────┘│      │ └─────┘ └─────┘│      │└───┘└───┘│ │
│  └─────────────────┘      └─────────────────┘      └─────────┘ │
│                                                                 │
│  ❌ One Fluent Bit per pod = more resource usage               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### DaemonSet vs Sidecar Comparison

| Factor | DaemonSet | Sidecar |
|--------|-----------|---------|
| **Resource Usage** | 1 collector per node | 1 collector per pod (wasteful) |
| **Management** | Single config for all | Config per pod |
| **Scaling** | Scales with nodes | Scales with pods |
| **Coupling** | Decoupled from apps | Tightly coupled |
| **Deployment** | Independent | Must redeploy apps |
| **Best For** | Standard log collection | Per-pod processing needs |

### Why We Chose DaemonSet

1. **Resource Efficient**: One Fluent Bit instance serves all pods on a node
2. **Decoupled**: Log collection independent of application deployments
3. **Simpler Management**: Single configuration applies cluster-wide
4. **Kubernetes Native**: Automatically deploys to new nodes

### When Would You Use Sidecar Instead?

- Need per-pod log processing/filtering
- Multi-tenant isolation requirements
- Application-specific log formats
- Istio/service mesh integration (Envoy sidecar)
- Logs need to be processed before leaving the pod

### Verify Our Pattern

```bash
# Fluent Bit runs as DaemonSet (one per node)
kubectl get daemonset -n logging
# NAME         DESIRED   CURRENT   READY
# fluent-bit   1         1         1

# App pods have single container (no sidecar)
kubectl get pods -n default -o custom-columns=POD:.metadata.name,CONTAINERS:.spec.containers[*].name
# POD              CONTAINERS
# api-xxx          api
# worker-xxx       worker
# gateway-xxx      gateway
```

## Basics:
Why loki-ruler is empty:
  - This bucket stores alerting/recording rules
  - Since no alerting rules are configured, it's empty
  - This is normal!

  Why loki-data has only one old file:
  - Loki keeps logs in memory first (in the ingester)
  - Chunks are flushed to MinIO only when:
    - Chunk size reaches ~1.5MB, OR
    - Chunk age reaches 1 hour, OR
    - Ingester restarts

  "Loki uses a two-tier storage model. Fresh logs are held in memory for fast queries, then flushed to S3-compatible storage (MinIO) for long-term retention. This gives us both speed and durability."

## Why Loki/Grafana Instead of ELK Stack?

This project uses the **Grafana Stack (PLG)** instead of the **Elastic Stack (ELK)**. Here's why:

### Stack Comparison

| Component | Elastic Stack (ELK) | This Project (PLG) |
|-----------|--------------------|--------------------|
| **Log Collector** | Filebeat | Fluent Bit |
| **Log Storage/Index** | Elasticsearch | Loki |
| **Visualization** | Kibana | Grafana |
| **Query Language** | KQL (Kibana Query) | LogQL |

### Architecture Comparison

```
ELASTIC STACK (ELK):
┌──────────┐    ┌───────────────┐    ┌─────────┐
│ Filebeat │───>│ Elasticsearch │───>│ Kibana  │
└──────────┘    │  (Heavy, $$)  │    └─────────┘
                └───────────────┘

THIS PROJECT (PLG):
┌────────────┐    ┌──────────────┐    ┌─────────┐
│ Fluent Bit │───>│    Loki      │───>│ Grafana │
└────────────┘    │ (Lightweight)│    └─────────┘
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐
                  │    MinIO     │
                  │  (S3 Store)  │
                  └──────────────┘
```

### Why We Chose Loki Over Elasticsearch

| Factor | Elasticsearch | Loki |
|--------|--------------|------|
| **Resource Usage** | Heavy (8GB+ RAM minimum) | Lightweight (~256MB) |
| **Indexing Strategy** | Full-text index (expensive) | Labels only (cheap) |
| **Storage Cost** | High (indexes everything) | Low (compresses logs) |
| **Complexity** | Complex cluster setup | Simple single binary |
| **Best For** | Full-text search, analytics | Log aggregation, streaming |
| **Kubernetes Native** | Needs tuning | Built for K8s labels |

### Key Advantages of Our Choice

1. **10x More Resource-Efficient**: Elasticsearch indexes every word in every log. Loki only indexes metadata labels (pod, namespace, container) and compresses actual log content.

2. **Cost-Effective Storage**: Loki stores compressed logs in object storage (MinIO/S3), which is significantly cheaper than Elasticsearch indices.

3. **Kubernetes-Native**: Loki leverages Kubernetes labels naturally, making it ideal for container environments.

4. **Unified Observability**: Grafana provides a single pane of glass for metrics (Prometheus), logs (Loki), and traces (Jaeger).

### When Would You Use ELK Instead?

- Need full-text search across log content
- Complex log analytics and aggregations
- Security/SIEM use cases (Elastic SIEM)
- Already have Elasticsearch expertise

## Complete Observability Tools Comparison

### Log Collectors - When to Use What

| Tool | Best For | Resource Usage | Key Strength |
|------|----------|----------------|--------------|
| **Fluent Bit** ✓ | Kubernetes, edge, IoT | Ultra-light (~450KB) | Minimal footprint, C-based |
| **Fluentd** | Complex routing, plugins | Medium (~40MB) | 500+ plugins, Ruby-based |
| **Logstash** | ELK stack, transformations | Heavy (~1GB) | Powerful filters, JVM-based |
| **Promtail** | Loki-only environments | Light (~20MB) | Native Loki integration |
| **Vector** | High-throughput pipelines | Medium (~50MB) | Rust-based, very fast |
| **OpenTelemetry Collector** | Unified telemetry | Medium (~100MB) | Metrics + Logs + Traces |
| **Filebeat** | Elasticsearch environments | Light (~30MB) | Simple, reliable for ELK |

### Log Storage/Aggregation - When to Use What

| Tool | Best For | Resource Usage | Indexing |
|------|----------|----------------|----------|
| **Loki** ✓ | K8s, cost-conscious | Light (256MB+) | Labels only |
| **Elasticsearch** | Full-text search, SIEM | Heavy (8GB+) | Full-text |
| **ClickHouse** | Analytics, time-series | Medium (2GB+) | Columnar |
| **Splunk** | Enterprise, compliance | Heavy ($$) | Full-text |

### Visualization - When to Use What

| Tool | Best For | Integrates With |
|------|----------|-----------------|
| **Grafana** ✓ | Unified observability | Loki, Prometheus, Jaeger, 50+ |
| **Kibana** | Elasticsearch only | Elasticsearch |
| **Splunk UI** | Splunk only | Splunk |

### OpenTelemetry (OTel) - The Future Standard

```
┌─────────────────────────────────────────────────────────────────┐
│                    OPENTELEMETRY ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │ Metrics │  │  Logs   │  │ Traces  │  ← Three Pillars        │
│  └────┬────┘  └────┬────┘  └────┬────┘                         │
│       │            │            │                               │
│       └────────────┼────────────┘                               │
│                    ▼                                            │
│  ┌─────────────────────────────────────┐                       │
│  │     OpenTelemetry Collector         │  ← Unified Pipeline   │
│  │  • Receives from any source         │                       │
│  │  • Processes/transforms             │                       │
│  │  • Exports to any backend           │                       │
│  └─────────────────┬───────────────────┘                       │
│                    │                                            │
│       ┌────────────┼────────────┐                              │
│       ▼            ▼            ▼                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │
│  │Prometheus│  │  Loki   │  │ Jaeger  │  ← Any Backend         │
│  └─────────┘  └─────────┘  └─────────┘                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**When to Use OpenTelemetry:**
- Building new applications with observability from scratch
- Need vendor-neutral instrumentation
- Want unified metrics, logs, and traces
- Planning to switch backends in the future

**Why We Didn't Use OTel (Yet):**
- Adds complexity for a demo project
- Fluent Bit is simpler and sufficient for log collection
- OTel is still maturing for logs (metrics/traces more stable)

### Decision Matrix - Quick Reference

| Scenario | Collector | Storage | Visualization |
|----------|-----------|---------|---------------|
| **K8s + Budget-conscious** ✓ | Fluent Bit | Loki + MinIO | Grafana |
| **Enterprise + Full-text search** | Logstash/Filebeat | Elasticsearch | Kibana |
| **High-volume analytics** | Vector | ClickHouse | Grafana |
| **Cloud-native + Vendor lock-in OK** | CloudWatch Agent | CloudWatch | CloudWatch |
| **Future-proof + All telemetry** | OTel Collector | Loki/Tempo/Mimir | Grafana |

### Why Our Stack (Fluent Bit + Loki + Grafana)?

```
✅ Lightweight     - Runs on minimal resources (good for Kind/local dev)
✅ Cost-effective  - No expensive full-text indexing
✅ K8s-native      - Labels-based, perfect for container metadata
✅ Unified UI      - Grafana for metrics, logs, AND traces
✅ Production-ready - Used by Grafana Cloud, many enterprises
✅ Simple setup    - 4 YAML files vs complex ELK cluster
```

### Talking Points for Judges

> **Q: Why not use OpenTelemetry?**
> "OpenTelemetry is excellent for new greenfield projects needing vendor-neutral instrumentation. For this demo, Fluent Bit provides simpler, proven log collection. We could add OTel Collector later as a drop-in replacement."

> **Q: Why not Elasticsearch/ELK?**
> "Elasticsearch requires 8GB+ RAM minimum and indexes every word. Loki uses 256MB and only indexes labels. For Kubernetes logs where we filter by pod/namespace, label-based indexing is more efficient."

> **Q: What about Splunk?**
> "Splunk is excellent but expensive ($2000+/GB/day indexed). Our stack achieves similar functionality using open-source tools at near-zero cost."

## References

- [Fluent Bit Documentation](https://docs.fluentbit.io/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [MinIO Documentation](https://min.io/docs/minio/kubernetes/upstream/)
- [LogQL Query Language](https://grafana.com/docs/loki/latest/logql/)
