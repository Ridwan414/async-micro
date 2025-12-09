# Async Microservices Platform

A production-ready microservices architecture demonstrating asynchronous task processing with comprehensive observability stack.

## Architecture

```
                                    +------------------+
                                    |    Grafana       |
                                    |   (Dashboards)   |
                                    +--------+---------+
                                             |
              +------------------------------+------------------------------+
              |                              |                              |
    +---------v---------+         +----------v----------+         +---------v---------+
    |    Prometheus     |         |        Loki         |         |      Jaeger       |
    |    (Metrics)      |         |      (Logs)         |         |    (Tracing)      |
    +-------------------+         +---------------------+         +-------------------+
              ^                              ^                              ^
              |                              |                              |
+-------------+------------------------------------------------------------------+
|                                                                                |
|  +----------+      +----------+      +----------+      +----------+           |
|  |  Gateway |----->|  Backend |----->| RabbitMQ |----->|  Worker  |           |
|  |  :3000   |      |  :8000   |      |  :5672   |      | (async)  |           |
|  +----------+      +----------+      +----------+      +----------+           |
|       |                                                                        |
|       v                                                                        |
|  +----------+                                                                  |
|  | Product  |                                                                  |
|  |  :8001   |                                                                  |
|  +----------+                                                                  |
|                                                                                |
+--------------------------------------------------------------------------------+
```

## Features

- **Async Task Processing**: RabbitMQ-based message queue with worker consumers
- **API Gateway**: Unified entry point for all services
- **Observability Stack**:
  - Prometheus for metrics collection
  - Grafana for visualization dashboards
  - Loki for centralized logging
  - Jaeger for distributed tracing
- **Dual Deployment**: Docker Compose + Kubernetes
- **GitOps CI/CD**: GitHub Actions + Argo CD
- **Load Testing**: k6 scripts for performance testing


### Here's the comparison:

  | Component     | Current Setup      | Production Setup          |
  |---------------|--------------------|---------------------------|
  | Log Collector | Loki Docker Driver | Fluent Bit (K8s native)   |
  | Log Storage   | Loki (filesystem)  | Loki + MinIO (S3 storage) |
  | Scalability   | Single node        | Distributed               |


## Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (optional)
- k6 (for load testing)
- kubectl + Kind (for Kubernetes deployment)

### Install Loki Docker Plugin (First time only)

```bash
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

## Deployment Options

### Option 1: Docker Compose (Single VM)

```bash
# Clone the repository
git clone https://github.com/Ridwan414/async-micro.git
cd async-micro

# Start all services with monitoring
make prod-up

# Or without make:
docker compose -f docker-compose.prod.yml up -d
```

#### Docker Compose URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Gateway | http://localhost:3000 | - |
| Backend API | http://localhost:8000 | - |
| Product Service | http://localhost:8001 | - |
| RabbitMQ Management | http://localhost:15672 | admin / admin |
| Grafana | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| Jaeger UI | http://localhost:16686 | - |
| Loki | http://localhost:3100 | - |

### Option 2: Kubernetes (Kind)

```bash
# Create Kind cluster
kind create cluster --name microservices-prod

# Deploy all manifests
make k8s-deploy

# Or without make:
kubectl apply -f manifests/

# Check status
kubectl get pods

# Port forward to access services
kubectl port-forward svc/gateway-service 3002:3000 &
kubectl port-forward svc/api-service 8002:8000 &
kubectl port-forward svc/rabbitmq 15673:15672 &
```

#### Kubernetes URLs (after port-forward)

| Service | URL | Credentials |
|---------|-----|-------------|
| Gateway | http://localhost:3002 | - |
| Backend API | http://localhost:8002 | - |
| RabbitMQ Management | http://localhost:15673 | admin / admin |

#### Kubernetes Deployment Details

| Component | Replicas | Description |
|-----------|----------|-------------|
| API | 2 | Task creation service |
| Gateway | 2 | API Gateway |
| Product | 2 | Product service |
| Worker | 3 | Async task consumers |
| RabbitMQ | 1 | Message broker (StatefulSet) |

## API Endpoints

### Gateway (Port 3000/3002)

```bash
# Health check
curl http://localhost:3000/health

# Response: {"status":"ok","service":"gateway"}
```

### Backend API (Port 8000/8002)

```bash
# Create async task
curl -X POST http://localhost:8000/task \
  -H "Content-Type: application/json" \
  -d '{"task_type": "process_data", "id": "123", "message": "Hello World"}'

# Response: {"message":{...},"status":"Task submitted"}
```

### Product Service (Port 8001)

```bash
# List products
curl http://localhost:8001/products

# Get product by ID
curl http://localhost:8001/products/1
```

## Load Testing

### Install k6

```bash
# Windows (chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo apt install k6
```

### Run Load Tests

```bash
# Test Docker Compose deployment
make load-test

# Test Kubernetes deployment
k6 run -e GATEWAY_URL=http://localhost:3002 \
       -e BACKEND_URL=http://localhost:8002 \
       -e PRODUCT_URL=http://localhost:8001 \
       load-tests/load-test.js
```

### Load Test Results

Both deployments tested with 30 concurrent users over 1 minute:

| Metric | Docker Compose | Kubernetes |
|--------|----------------|------------|
| Total Requests | 4,221 | 4,059 |
| Requests/sec | 69.6 | 67.2 |
| Avg Response | 18ms | 29ms |
| p95 Response | 92ms | 153ms |
| Error Rate | 0% | 0% |
| Success Rate | 100% | 100% |

### Test Stages

| Stage | Duration | Users |
|-------|----------|-------|
| Ramp up | 10s | 0 → 10 |
| Ramp up | 20s | 10 → 30 |
| Steady | 20s | 30 |
| Ramp down | 10s | 30 → 0 |

## Observability

### Grafana Dashboards

1. Open http://localhost:3001
2. Login with `admin` / `admin`
3. Go to **Dashboards** → **Browse**
4. Click on **"Async Microservices"** dashboard

The dashboard includes:
- RabbitMQ Queue Messages (real-time)
- RabbitMQ Connections count
- Message Rate (published/delivered per minute)
- Container Logs stream

### View Logs in Grafana

1. Click the **Explore** icon (compass) in the left sidebar
2. Select **"Loki"** from the datasource dropdown
3. Use these queries:
   ```
   # All logs
   {compose_project="async-micro"}

   # Specific service logs
   {container_name="backend"}
   {container_name="worker"}
   {container_name="gateway"}
   ```

### View Traces in Jaeger

1. Open http://localhost:16686
2. Select a service from the **Service** dropdown
3. Click **"Find Traces"**
4. Click on any trace to see the full request flow

### Prometheus Metrics

1. Open http://localhost:9090
2. Example queries:
   ```promql
   # Queue depth
   rabbitmq_queue_messages_ready

   # Total connections
   rabbitmq_connections

   # Message publish rate
   rate(rabbitmq_channel_messages_published_total[1m])
   ```

### RabbitMQ Management

1. Open http://localhost:15672 (Docker) or http://localhost:15673 (K8s)
2. Login with `admin` / `admin`
3. Go to **Queues** tab to see `task-queue`

## CI/CD

### GitHub Actions

The workflow (`.github/workflows/ci-cd.yml`) includes:

1. **Test**: Run unit tests
2. **Build & Push**: Build Docker images and push to Docker Hub
3. **Update Manifests**: Update K8s manifests with new image tags
4. **Load Test**: Run smoke tests

#### Required Secrets

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

### Argo CD (GitOps)

```bash
# Install Argo CD
make argocd-install

# Or manually:
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
kubectl apply -f argocd/application.yaml

# Access Argo CD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open https://localhost:8080 (accept self-signed certificate warning)
# Username: admin
# Password: (run command below)
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

## Project Structure

```
async-micro/
├── services/
│   ├── backend/          # Task creation API (Python/Flask)
│   ├── gateway/          # API Gateway (Node.js/Express)
│   ├── product/          # Product service (Python/Flask)
│   └── worker/           # Async task worker (Python)
├── manifests/            # Kubernetes manifests
├── monitoring/
│   ├── prometheus/       # Prometheus config
│   ├── grafana/          # Grafana provisioning
│   │   └── provisioning/
│   │       ├── datasources/   # Prometheus, Loki, Jaeger
│   │       └── dashboards/    # Pre-configured dashboards
│   └── loki/             # Loki config
├── argocd/               # Argo CD application
├── load-tests/           # k6 load test scripts
├── .github/workflows/    # CI/CD pipelines
├── docker-compose.yml    # Development setup
├── docker-compose.prod.yml # Production with monitoring
└── Makefile              # Convenience commands
```

## Makefile Commands

```bash
# Development
make up              # Start basic services
make down            # Stop services
make logs            # View logs

# Production (Docker Compose)
make prod-up         # Start with full monitoring stack
make prod-down       # Stop production stack
make prod-logs       # View production logs

# Kubernetes
make k8s-deploy      # Deploy to Kubernetes
make k8s-delete      # Delete from Kubernetes
make k8s-status      # Check deployment status

# Build & Push
make build-all       # Build all Docker images
make push-all        # Push all images to registry

# Argo CD
make argocd-install  # Install Argo CD
make argocd-ui       # Port forward to Argo CD UI

# Testing
make load-test       # Run k6 load test
make stress-test     # Run k6 stress test

# Cleanup
make clean           # Remove all containers and volumes
```

## Demo Script (For Hackathon)

### 1. Start Both Deployments

```bash
# Docker Compose
make prod-up

# Kubernetes
kind create cluster --name microservices-prod
make k8s-deploy
kubectl port-forward svc/gateway-service 3002:3000 &
kubectl port-forward svc/api-service 8002:8000 &
```

### 2. Send Test Tasks

```bash
# To Docker Compose
for i in {1..10}; do
  curl -X POST http://localhost:8000/task \
    -H "Content-Type: application/json" \
    -d "{\"task_type\":\"demo\",\"id\":\"$i\"}"
  echo ""
done

# To Kubernetes
for i in {1..10}; do
  curl -X POST http://localhost:8002/task \
    -H "Content-Type: application/json" \
    -d "{\"task_type\":\"k8s_demo\",\"id\":\"$i\"}"
  echo ""
done
```

### 3. Show Observability

- **Grafana Dashboard**: http://localhost:3001
- **RabbitMQ Queues**: http://localhost:15672
- **Jaeger Traces**: http://localhost:16686
- **Prometheus Metrics**: http://localhost:9090

### 4. Run Load Tests

```bash
# Docker Compose
make load-test

# Kubernetes
k6 run -e BACKEND_URL=http://localhost:8002 load-tests/load-test.js
```

### 5. Show Kubernetes Scaling

```bash
# Scale workers
kubectl scale deployment worker --replicas=5

# Watch pods
kubectl get pods -w
```

## Troubleshooting

### Grafana not starting
```bash
docker stop grafana && docker rm grafana
docker volume rm async-micro_grafana-data
docker compose -f docker-compose.prod.yml up -d grafana
```

### Loki Docker driver not found
```bash
docker plugin install grafana/loki-docker-driver:latest --alias loki --grant-all-permissions
```

### Workers in CrashLoopBackOff
Workers restart while waiting for RabbitMQ. They auto-recover once RabbitMQ is healthy (usually within 1-2 minutes).

### Port conflicts
```bash
# Find what's using a port (Windows)
netstat -ano | findstr :3000

# Kill process (Windows)
taskkill /PID <pid> /F
```

### Reset everything
```bash
# Docker Compose
make clean
docker volume prune -f
make prod-up

# Kubernetes
kubectl delete -f manifests/
kubectl apply -f manifests/
```

### ArgoCD UI not loading / empty
```bash
# Check if argocd namespace is stuck terminating
kubectl get namespace argocd

# If stuck, remove finalizer from application first
kubectl patch application async-microservices -n argocd -p '{"metadata":{"finalizers":null}}' --type=merge

# Reinstall ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s
kubectl apply -f argocd/application.yaml

# Port-forward and access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Open https://localhost:8080
```

## Environment Variables

### Backend Service
| Variable | Default | Description |
|----------|---------|-------------|
| RABBITMQ_HOST | rabbitmq | RabbitMQ hostname |
| RABBITMQ_USER | admin | RabbitMQ username |
| RABBITMQ_PASS | admin | RabbitMQ password |

### Gateway Service
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Gateway port |
| BACKEND_SERVICE_URL | http://backend:8000 | Backend URL |
| PRODUCT_SERVICE_URL | http://product:8001 | Product URL |

## License

MIT

---

Built for hackathon demonstration of microservices architecture with full observability.

**Tested Configurations:**
- Docker Compose: 10 services, 0% error rate
- Kubernetes (Kind): 10 pods, 0% error rate
- Load tested: 4000+ requests, 67+ req/sec
