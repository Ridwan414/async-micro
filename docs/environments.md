# Environment Strategy

This document describes the multi-environment setup for development, staging, and production.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENVIRONMENT ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      KUBERNETES CLUSTER                              │   │
│  │                                                                      │   │
│  │   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐              │   │
│  │   │     DEV     │   │   STAGING   │   │    PROD     │              │   │
│  │   │  namespace  │   │  namespace  │   │  namespace  │              │   │
│  │   │             │   │             │   │             │              │   │
│  │   │ - api       │   │ - api       │   │ - api       │              │   │
│  │   │ - gateway   │   │ - gateway   │   │ - gateway   │              │   │
│  │   │ - worker    │   │ - worker    │   │ - worker    │              │   │
│  │   │ - product   │   │ - product   │   │ - product   │              │   │
│  │   │ - rabbitmq  │   │ - rabbitmq  │   │ - rabbitmq  │              │   │
│  │   │             │   │             │   │             │              │   │
│  │   │ Port: 3000x │   │ Port: 3100x │   │ Port: 3200x │              │   │
│  │   └─────────────┘   └─────────────┘   └─────────────┘              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         ARGO CD                                      │   │
│  │                                                                      │   │
│  │   Watches 3 paths:                                                   │   │
│  │   - manifests/environments/dev/                                      │   │
│  │   - manifests/environments/staging/                                  │   │
│  │   - manifests/environments/prod/                                     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Environment Access

### ArgoCD Instances

| Environment | Type | ArgoCD URL | Protocol | Purpose |
|-------------|------|------------|----------|---------|
| **Local (Kind)** | Development | http://localhost:30588 | HTTP | Local testing, development |
| **Remote Server** | Production | https://103.191.50.49:31308 | HTTPS | Production/Staging deployment |

### Service NodePorts

| Service | Local (Kind) | Remote Server |
|---------|--------------|---------------|
| ArgoCD UI | 30588 | 31308 |
| Gateway | 30000 | 30000 |
| API | 30080 | 30080 |
| Product | 30081 | 30081 |

### ArgoCD Login

```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Windows PowerShell:
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }

# Username: admin
```

### Accessing ArgoCD Applications

1. **Local Development**: http://localhost:30588/applications
2. **Remote Production**: https://103.191.50.49:31308/applications

### View Specific Application

- **Staging**: `<argocd-url>/applications/argocd/async-micro-staging?view=tree`
- **Production**: `<argocd-url>/applications/argocd/async-micro-production?view=tree`

### Key Differences Between Environments

| Aspect | Local (Kind) | Remote (103.191.50.49) |
|--------|--------------|------------------------|
| Network | Docker internal (172.19.x.x) | Public IP |
| Access | localhost only | Accessible anywhere |
| TLS/SSL | No (HTTP) | Yes (HTTPS) |
| Purpose | Development/Testing | Production |
| Persistence | Ephemeral | Persistent |

## Environment Comparison

| Aspect | Development | Staging | Production |
|--------|-------------|---------|------------|
| **Purpose** | Local testing, debugging | Pre-prod validation | Live users |
| **Namespace** | `dev` | `staging` | `prod` |
| **Replicas** | 1 | 2 | 2-3 |
| **Image Tag** | `latest` or branch | `latest` or SHA | Specific SHA |
| **Auto-sync** | Yes | Yes | Manual approval |
| **Load Testing** | No | Yes | No |
| **Data** | Mock/test data | Test data | Real data |
| **Monitoring** | Basic | Full | Full + Alerts |

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPLOYMENT PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Developer                                                                  │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
│  │  Code   │───>│  Test   │───>│  Build  │───>│  Push   │                 │
│  │  Push   │    │  (CI)   │    │  Image  │    │  Image  │                 │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘                 │
│                                                      │                      │
│                                                      ▼                      │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                      ARGO CD SYNC                                     │ │
│  │                                                                       │ │
│  │   DEV (auto)          STAGING (auto)         PROD (manual)           │ │
│  │       │                    │                      │                   │ │
│  │       ▼                    ▼                      ▼                   │ │
│  │   Deploy              Deploy                 Approve &                │ │
│  │       │                    │                  Deploy                  │ │
│  │       ▼                    ▼                      │                   │ │
│  │   Verify              Load Test                   ▼                   │ │
│  │                            │                  Monitor                 │ │
│  │                            ▼                                          │ │
│  │                       Promote?                                        │ │
│  │                                                                       │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
manifests/
├── base/                          # Shared base manifests
│   ├── api-deployment.yaml
│   ├── gateway-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── product-deployment.yaml
│   ├── rabbitmq-statefulset.yaml
│   └── services.yaml
│
├── environments/
│   ├── dev/
│   │   ├── kustomization.yaml     # Dev-specific patches
│   │   ├── namespace.yaml
│   │   └── patches/
│   │       └── replicas.yaml      # replicas: 1
│   │
│   ├── staging/
│   │   ├── kustomization.yaml     # Staging-specific patches
│   │   ├── namespace.yaml
│   │   └── patches/
│   │       └── replicas.yaml      # replicas: 2
│   │
│   └── prod/
│       ├── kustomization.yaml     # Prod-specific patches
│       ├── namespace.yaml
│       └── patches/
│           └── replicas.yaml      # replicas: 3
│
└── argocd/
    ├── dev-application.yaml
    ├── staging-application.yaml
    └── prod-application.yaml
```

## Setup Instructions

### 1. Create Namespaces

```bash
kubectl create namespace dev
kubectl create namespace staging
kubectl create namespace prod
```

### 2. Create Base Kustomization

Create `manifests/base/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - api-deployment.yaml
  - gateway-deployment.yaml
  - worker-deployment.yaml
  - product-deployment.yaml
  - rabbitmq-statefulset.yaml
  - rabbitmq-pvc.yaml
  - api-nodeport.yaml
  - gateway-service.yaml
  - product-service.yaml
  - rabbitmq-service.yaml
```

### 3. Create Environment Kustomizations

**Dev** (`manifests/environments/dev/kustomization.yaml`):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: dev

resources:
  - ../../base

commonLabels:
  environment: dev

patches:
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 1
    target:
      kind: Deployment
```

**Staging** (`manifests/environments/staging/kustomization.yaml`):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: staging

resources:
  - ../../base

commonLabels:
  environment: staging

patches:
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 2
    target:
      kind: Deployment
```

**Prod** (`manifests/environments/prod/kustomization.yaml`):

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: prod

resources:
  - ../../base

commonLabels:
  environment: prod

patches:
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
    target:
      kind: Deployment
      name: worker
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 2
    target:
      kind: Deployment
      name: api
  - patch: |-
      - op: replace
        path: /spec/replicas
        value: 2
    target:
      kind: Deployment
      name: gateway
```

### 4. Create ArgoCD Applications

**Dev** (`argocd/dev-application.yaml`):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-microservices-dev
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    targetRevision: HEAD
    path: manifests/environments/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

**Staging** (`argocd/staging-application.yaml`):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-microservices-staging
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    targetRevision: HEAD
    path: manifests/environments/staging
  destination:
    server: https://kubernetes.default.svc
    namespace: staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

**Prod** (`argocd/prod-application.yaml`):

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-microservices-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    targetRevision: HEAD
    path: manifests/environments/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: prod
  syncPolicy:
    # NO automated sync - requires manual approval
    syncOptions:
      - CreateNamespace=true
```

### 5. Apply ArgoCD Applications

```bash
kubectl apply -f argocd/dev-application.yaml
kubectl apply -f argocd/staging-application.yaml
kubectl apply -f argocd/prod-application.yaml
```

### 6. Verify Deployments

```bash
# Check all applications
kubectl get applications -n argocd

# Check pods in each namespace
kubectl get pods -n dev
kubectl get pods -n staging
kubectl get pods -n prod
```

## Access Services by Environment

### Port-Forward Commands

```bash
# Development
kubectl port-forward svc/gateway-service -n dev 30000:3000 &
kubectl port-forward svc/api-service -n dev 30001:8000 &

# Staging
kubectl port-forward svc/gateway-service -n staging 31000:3000 &
kubectl port-forward svc/api-service -n staging 31001:8000 &

# Production
kubectl port-forward svc/gateway-service -n prod 32000:3000 &
kubectl port-forward svc/api-service -n prod 32001:8000 &
```

### Access URLs

| Service | Dev | Staging | Prod |
|---------|-----|---------|------|
| Gateway | http://localhost:30000 | http://localhost:31000 | http://localhost:32000 |
| API | http://localhost:30001 | http://localhost:31001 | http://localhost:32001 |
| RabbitMQ | http://localhost:30002 | http://localhost:31002 | http://localhost:32002 |

## CI/CD Pipeline with Environments

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: echo "Running tests..."

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - name: Build and push
        # ... build steps ...

  deploy-dev:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - name: Update dev manifests
        run: |
          # Update image tags in dev environment
          # ArgoCD auto-syncs

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Update staging manifests
        run: |
          # Update image tags in staging environment
          # ArgoCD auto-syncs

  load-test-staging:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - name: Run load tests against staging
        run: |
          k6 run -e BASE_URL=${{ secrets.STAGING_URL }} load-tests/load-test.js

  deploy-prod:
    needs: load-test-staging
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval in GitHub
    steps:
      - name: Update prod manifests
        run: |
          # Update image tags in prod environment
          # ArgoCD requires manual sync
```

## Promotion Workflow

### Dev → Staging

Automatic when merging to `main`:

```bash
# Develop on feature branch
git checkout -b feature/new-feature
# ... make changes ...
git commit -m "Add new feature"
git push origin feature/new-feature

# Create PR to main
# After merge, staging auto-deploys
```

### Staging → Production

Manual approval required:

```bash
# Option 1: Via ArgoCD UI
# 1. Open ArgoCD UI
# 2. Click on async-microservices-prod
# 3. Click "Sync"
# 4. Confirm sync

# Option 2: Via CLI
argocd app sync async-microservices-prod

# Option 3: Via kubectl
kubectl patch application async-microservices-prod -n argocd \
  --type=merge -p '{"operation":{"sync":{}}}'
```

## Environment-Specific Configuration

### Using ConfigMaps

```yaml
# manifests/environments/dev/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: dev
data:
  LOG_LEVEL: "debug"
  ENABLE_TRACING: "true"

# manifests/environments/staging/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: staging
data:
  LOG_LEVEL: "info"
  ENABLE_TRACING: "true"

# manifests/environments/prod/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: prod
data:
  LOG_LEVEL: "warn"
  ENABLE_TRACING: "false"
```

### Using Secrets

```bash
# Create secrets per environment
kubectl create secret generic db-credentials -n dev \
  --from-literal=username=dev_user \
  --from-literal=password=dev_pass

kubectl create secret generic db-credentials -n staging \
  --from-literal=username=staging_user \
  --from-literal=password=staging_pass

kubectl create secret generic db-credentials -n prod \
  --from-literal=username=prod_user \
  --from-literal=password=prod_pass
```

## Monitoring by Environment

### Grafana Dashboards

Filter by namespace in Grafana queries:

```promql
# Dev metrics
sum(rate(http_requests_total{namespace="dev"}[5m]))

# Staging metrics
sum(rate(http_requests_total{namespace="staging"}[5m]))

# Prod metrics
sum(rate(http_requests_total{namespace="prod"}[5m]))
```

### Loki Log Queries

```
# Dev logs
{namespace="dev"}

# Staging logs
{namespace="staging"}

# Prod logs
{namespace="prod"}
```

## Rollback by Environment

### Using ArgoCD

```bash
# List history
argocd app history async-microservices-prod

# Rollback to specific revision
argocd app rollback async-microservices-prod 2
```

### Using Git

```bash
# Revert specific environment
cd manifests/environments/prod
git revert HEAD
git push

# ArgoCD will sync the reverted state
```

## Best Practices

1. **Never skip staging** - Always test in staging before prod
2. **Use same images** - Dev, staging, prod should use identical images
3. **Environment parity** - Keep environments as similar as possible
4. **Automate dev/staging** - Manual approval only for prod
5. **Monitor all environments** - Catch issues early in dev/staging
6. **Separate secrets** - Never share credentials across environments
7. **Load test staging** - Validate performance before prod
8. **Quick rollback** - Have rollback plan ready before deploying

## Troubleshooting

### Check environment status

```bash
# All environments at a glance
kubectl get applications -n argocd

# Pods per environment
for ns in dev staging prod; do
  echo "=== $ns ==="
  kubectl get pods -n $ns
done
```

### Sync issues

```bash
# Force refresh
argocd app get async-microservices-staging --refresh

# Check sync status
argocd app diff async-microservices-staging
```

### Resource conflicts

```bash
# Check if resources exist in wrong namespace
kubectl get all --all-namespaces | grep -E "api|gateway|worker"
```
