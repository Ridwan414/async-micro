# CI/CD Pipeline Architecture

This document describes the continuous integration and continuous deployment (CI/CD) pipeline for the Async Microservices Platform.

## Overview

The pipeline uses **GitHub Actions** for CI and **Argo CD** for GitOps-based CD.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD PIPELINE FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CONTINUOUS INTEGRATION (GitHub Actions)                                    │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                                                                      │  │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────────────┐   │  │
│  │  │  Push   │───>│  Test   │───>│  Build  │───>│  Push to        │   │  │
│  │  │  Code   │    │  Code   │    │  Images │    │  Docker Hub     │   │  │
│  │  └─────────┘    └─────────┘    └─────────┘    └────────┬────────┘   │  │
│  │                                                         │            │  │
│  │                                                         ▼            │  │
│  │                                              ┌─────────────────────┐ │  │
│  │                                              │  Update Manifests   │ │  │
│  │                                              │  (image tags)       │ │  │
│  │                                              └──────────┬──────────┘ │  │
│  │                                                         │            │  │
│  └─────────────────────────────────────────────────────────┼────────────┘  │
│                                                            │               │
│  CONTINUOUS DEPLOYMENT (Argo CD - GitOps)                  │               │
│  ┌─────────────────────────────────────────────────────────┼────────────┐  │
│  │                                                         │            │  │
│  │                                                         ▼            │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐   │  │
│  │  │   Argo CD       │───>│   Compare       │───>│   Auto-Sync    │   │  │
│  │  │   Watches Repo  │    │   Desired vs    │    │   to Cluster   │   │  │
│  │  │                 │    │   Live State    │    │                │   │  │
│  │  └─────────────────┘    └─────────────────┘    └────────────────┘   │  │
│  │                                                                      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Pipeline Stages

| Stage | Tool | Purpose | Trigger |
|-------|------|---------|---------|
| **Test** | GitHub Actions | Run unit tests | Push/PR to main |
| **Build** | Docker Buildx | Build container images | Push to main |
| **Push** | Docker Hub | Store images | After successful build |
| **Update** | GitHub Actions | Update K8s manifests | After push |
| **Deploy** | Argo CD | Sync to cluster | Manifest changes |
| **Load Test** | k6 | Smoke/performance tests | After build |

## GitHub Actions (CI)

### Workflow File

Location: `.github/workflows/ci-cd.yml`

### Jobs Overview

```yaml
jobs:
  test:           # Run unit tests
  build-and-push: # Build and push Docker images
  update-manifests: # Update K8s manifests with new tags
  load-test:      # Run k6 smoke tests
```

### Job: test

```yaml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Set up Python
      uses: actions/setup-python@v5
      with:
        python-version: '3.9'
    - name: Install dependencies
      run: pip install pytest requests
    - name: Run unit tests
      run: echo "Running tests..."
```

### Job: build-and-push

Builds and pushes 4 services in parallel using a matrix strategy:

| Service | Dockerfile Path | Image Name |
|---------|-----------------|------------|
| API | services/backend | asifmahmoud414/api-service |
| Gateway | services/gateway | asifmahmoud414/gateway-service |
| Product | services/product | asifmahmoud414/product-service |
| Worker | services/worker | asifmahmoud414/worker-service |

### Job: update-manifests

Automatically updates Kubernetes manifests with new image tags.

### Complete Workflow File

```yaml
# .github/workflows/ci-cd.yml

name: CI/CD Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  REGISTRY: docker.io
  IMAGE_PREFIX: asifmahmoud414

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.9'

      - name: Install dependencies
        run: |
          pip install pytest requests

      - name: Run unit tests
        run: |
          echo "Running tests..."
          # Add your test commands here

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    strategy:
      matrix:
        service:
          - name: api-service
            path: services/backend
          - name: gateway-service
            path: services/gateway
          - name: product-service
            path: services/product
          - name: worker-service
            path: services/worker

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.IMAGE_PREFIX }}/${{ matrix.service.name }}
          tags: |
            type=sha,prefix=
            type=raw,value=latest

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ${{ matrix.service.path }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  update-manifests:
    needs: build-and-push
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required to push manifest changes
    steps:
      - uses: actions/checkout@v4

      - name: Update K8s manifests with new image tags
        run: |
          SHORT_SHA=$(echo ${{ github.sha }} | cut -c1-7)
          sed -i "s|image: ${{ env.IMAGE_PREFIX }}/api-service:.*|image: ${{ env.IMAGE_PREFIX }}/api-service:${SHORT_SHA}|g" manifests/api-deployment.yaml
          sed -i "s|image: ${{ env.IMAGE_PREFIX }}/gateway-service:.*|image: ${{ env.IMAGE_PREFIX }}/gateway-service:${SHORT_SHA}|g" manifests/gateway-deployment.yaml
          sed -i "s|image: ${{ env.IMAGE_PREFIX }}/product-service:.*|image: ${{ env.IMAGE_PREFIX }}/product-service:${SHORT_SHA}|g" manifests/product-deployment.yaml
          sed -i "s|image: ${{ env.IMAGE_PREFIX }}/worker-service:.*|image: ${{ env.IMAGE_PREFIX }}/worker-service:${SHORT_SHA}|g" manifests/worker-deployment.yaml

      - name: Commit and push manifest changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add manifests/
          git commit -m "chore: update image tags to ${{ github.sha }}" || exit 0
          git push

  load-test:
    needs: build-and-push
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4

      - name: Run k6 smoke test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: load-tests/load-test.js
        env:
          BASE_URL: ${{ secrets.STAGING_URL }}
        continue-on-error: true
```

### Workflow Explanation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW BREAKDOWN                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRIGGER: push to main or PR to main                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 1: test                                                        │   │
│  │  - Runs on every push/PR                                            │   │
│  │  - Sets up Python 3.9                                               │   │
│  │  - Installs pytest, requests                                        │   │
│  │  - Runs unit tests                                                  │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │ (needs: test)                            │
│                                  ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 2: build-and-push (matrix: 4 services in parallel)             │   │
│  │  - Only runs on push to main (not PRs)                              │   │
│  │  - Uses Docker Buildx for multi-platform builds                     │   │
│  │  - Logs into Docker Hub with secrets                                │   │
│  │  - Tags images with: SHA (abc1234) + latest                         │   │
│  │  - Pushes to: asifmahmoud414/<service>:<tag>                        │   │
│  │  - Uses GitHub Actions cache for faster builds                      │   │
│  └───────────────────────────────┬─────────────────────────────────────┘   │
│                                  │ (needs: build-and-push)                  │
│                    ┌─────────────┴─────────────┐                            │
│                    ▼                           ▼                            │
│  ┌─────────────────────────────┐ ┌─────────────────────────────────────┐   │
│  │  JOB 3: update-manifests    │ │  JOB 4: load-test                   │   │
│  │  - Needs write permission   │ │  - Runs k6 smoke test               │   │
│  │  - Extracts short SHA       │ │  - Uses STAGING_URL secret          │   │
│  │  - Updates 4 manifest files │ │  - continue-on-error: true          │   │
│  │  - Commits with bot user    │ │    (won't fail pipeline)            │   │
│  │  - Pushes to main           │ │                                     │   │
│  └─────────────────────────────┘ └─────────────────────────────────────┘   │
│                    │                                                        │
│                    ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ARGO CD (watches repo)                                             │   │
│  │  - Detects manifest change from CI commit                           │   │
│  │  - Compares desired state (Git) vs live state (cluster)             │   │
│  │  - Auto-syncs new image tags to Kubernetes                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Configuration Details

| Config | Value | Purpose |
|--------|-------|---------|
| `env.IMAGE_PREFIX` | `asifmahmoud414` | Docker Hub username |
| `type=sha,prefix=` | `abc1234` | Short commit SHA as tag |
| `type=raw,value=latest` | `latest` | Also tag as latest |
| `permissions.contents` | `write` | Allow pushing manifest updates |
| `cache-from/to` | `type=gha` | Use GitHub Actions cache |
| `continue-on-error` | `true` | Load test won't fail pipeline |

### Required Secrets

| Secret | Purpose |
|--------|---------|
| `DOCKERHUB_USERNAME` | Docker Hub login |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `STAGING_URL` | URL for load testing (optional) |

## Argo CD (GitOps CD)

### What is GitOps?

GitOps uses Git as the single source of truth for declarative infrastructure and applications.

```
┌─────────────────────────────────────────────────────────────┐
│                    GITOPS WORKFLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Developer pushes code                                   │
│           │                                                 │
│           ▼                                                 │
│  2. CI builds new image → pushes to registry                │
│           │                                                 │
│           ▼                                                 │
│  3. CI updates manifest with new image tag                  │
│           │                                                 │
│           ▼                                                 │
│  4. Argo CD detects manifest change                         │
│           │                                                 │
│           ▼                                                 │
│  5. Argo CD syncs cluster to match desired state            │
│           │                                                 │
│           ▼                                                 │
│  6. New version running in production                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Argo CD Installation

```bash
# Create namespace
kubectl create namespace argocd

# Install Argo CD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for pods
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s

# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
```

### Access Argo CD UI

There are different methods depending on your environment:

| Method | Use Case |
|--------|----------|
| `port-forward` | Local development (Kind, Minikube) |
| `NodePort` | Remote VM, shared access |
| `LoadBalancer` | Cloud environments (AWS, GCP, Azure) |
| `Ingress` | Production with domain name + TLS |

**Option 1: Port-forward (Local/Kind)**
```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
# Access at https://localhost:8080
```

**Option 2: NodePort (Remote VM)**
```bash
# Patch the argocd-server service to use NodePort
kubectl patch svc argocd-server -n argocd -p '{"spec": {"type": "NodePort"}}'

# Get the assigned NodePort
kubectl get svc argocd-server -n argocd -o jsonpath='{.spec.ports[?(@.port==443)].nodePort}'

# Access at https://<VM-IP>:<NodePort>
```

Or create a dedicated NodePort service (`argocd/argocd-nodeport.yaml`):
```yaml
apiVersion: v1
kind: Service
metadata:
  name: argocd-server-nodeport
  namespace: argocd
spec:
  type: NodePort
  selector:
    app.kubernetes.io/name: argocd-server
  ports:
  - name: https
    port: 443
    targetPort: 8080
    nodePort: 30443  # Access via https://<VM-IP>:30443
```

| Property | Value |
|----------|-------|
| **URL** | https://localhost:8080 (port-forward) or https://\<VM-IP\>:30443 (NodePort) |
| **Username** | admin |
| **Password** | (from secret above) |

### Do We Need Kubernetes Dashboard?

No, not for this setup. ArgoCD already provides what you need for GitOps workflows.

| Feature | ArgoCD | K8s Dashboard |
|---------|--------|---------------|
| Deployment visualization | ✓ | ✓ |
| Pod logs/events | ✓ | ✓ |
| GitOps sync status | ✓ | ✗ |
| Auto-sync from Git | ✓ | ✗ |
| Resource creation via UI | ✗ | ✓ |
| Cluster-wide metrics | ✗ | ✓ |

**Why we don't need K8s Dashboard:**
- Using GitOps (ArgoCD + GitHub) - all changes go through Git
- ArgoCD provides deployment visualization and sync status
- Grafana provides metrics dashboards (more powerful than K8s Dashboard)
- Prometheus collects cluster metrics

**When K8s Dashboard is useful:**
- Manually creating/editing resources via UI
- Viewing cluster-wide metrics without Prometheus
- Teams not using GitOps

### Application Configuration

Location: `argocd/application.yaml`

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-microservices
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    targetRevision: HEAD
    path: manifests
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true      # Delete resources not in Git
      selfHeal: true   # Revert manual changes
```

### Sync Policies

| Policy | Value | Description |
|--------|-------|-------------|
| **automated** | true | Auto-sync on manifest changes |
| **prune** | true | Delete resources removed from Git |
| **selfHeal** | true | Revert manual cluster changes |
| **retry** | 5 attempts | Retry failed syncs |

## Complete Pipeline Example

### Trigger: Push to main

```
1. Developer: git push origin main
                    │
2. GitHub Actions:  ▼
   ┌────────────────────────────────┐
   │ test → build-and-push (4 parallel)
   │                │
   │                ▼
   │ update-manifests (commit new tags)
   │                │
   │                ▼
   │ load-test (smoke test)
   └────────────────────────────────┘
                    │
3. Argo CD:         ▼
   ┌────────────────────────────────┐
   │ Detects manifest change        │
   │         │                      │
   │         ▼                      │
   │ Compares desired vs live state │
   │         │                      │
   │         ▼                      │
   │ Syncs new images to cluster    │
   └────────────────────────────────┘
                    │
4. Kubernetes:      ▼
   ┌────────────────────────────────┐
   │ Rolling update of pods         │
   │ Zero-downtime deployment       │
   └────────────────────────────────┘
```

## Verify CI/CD Status

### Check GitHub Actions

```bash
# View workflow runs (requires gh CLI)
gh run list --workflow=ci-cd.yml
```

### Check Argo CD Application

```bash
# List applications
kubectl get applications -n argocd

# Get application status
kubectl get application async-microservices -n argocd -o jsonpath='{.status.sync.status}'

# Expected: Synced
```

### Check Sync Status in UI

1. Open https://localhost:8080
2. Login with admin credentials
3. Click on `async-microservices` application
4. View sync status, health, and recent activity

## Argo CD CLI Commands

```bash
# Install Argo CD CLI
# Windows: choco install argocd-cli
# Mac: brew install argocd

# Login
argocd login localhost:8080 --insecure

# List apps
argocd app list

# Get app status
argocd app get async-microservices

# Manual sync
argocd app sync async-microservices

# View app history
argocd app history async-microservices

# Rollback
argocd app rollback async-microservices <revision>
```

## Rollback Strategies

### Using Argo CD UI

1. Open application in Argo CD
2. Click "History and Rollback"
3. Select previous revision
4. Click "Rollback"

### Using Git

```bash
# Revert manifest changes
git revert <commit-hash>
git push

# Argo CD will auto-sync to previous state
```

### Using kubectl

```bash
# View rollout history
kubectl rollout history deployment/api

# Rollback to previous
kubectl rollout undo deployment/api

# Rollback to specific revision
kubectl rollout undo deployment/api --to-revision=2
```

## CI/CD vs Traditional Deployment

| Aspect | Traditional | This Project (GitOps) |
|--------|-------------|----------------------|
| **Deployment** | Manual kubectl/scripts | Automated via Git |
| **State** | Unknown cluster state | Git = source of truth |
| **Audit** | Manual tracking | Git history |
| **Rollback** | Manual, error-prone | Git revert |
| **Access** | Direct cluster access | Git access only |
| **Drift** | Undetected | Auto-healed |

## Testing Argo CD Setup

### 1. Check All Components

```bash
# All pods should be Running
kubectl get pods -n argocd

# Expected:
# argocd-application-controller-0      1/1     Running
# argocd-applicationset-controller     1/1     Running
# argocd-dex-server                    1/1     Running
# argocd-notifications-controller      1/1     Running
# argocd-redis                         1/1     Running
# argocd-repo-server                   1/1     Running
# argocd-server                        1/1     Running
```

### 2. Check Application Status

```bash
# List applications
kubectl get applications -n argocd

# Detailed status
kubectl describe application async-microservices -n argocd

# Get sync status
kubectl get application async-microservices -n argocd -o jsonpath='{.status.sync.status}'

# Get health status
kubectl get application async-microservices -n argocd -o jsonpath='{.status.health.status}'
```

### 3. Access Argo CD UI

```bash
# Port forward
kubectl port-forward svc/argocd-server -n argocd 8080:443 &

# Get password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Access: https://localhost:8080
# Username: admin
```

### 4. Test GitOps Flow

| Test | Steps | Expected Result |
|------|-------|-----------------|
| **Initial Deploy** | `kubectl get pods -n default` | api, gateway, worker, product pods running |
| **Git Change** | Edit manifest → push → wait 3min | Argo CD auto-syncs new changes |
| **Self-Healing** | `kubectl delete pod api-xxx` | Pod auto-restored by Argo CD |
| **Rollback** | UI → History → Rollback | Previous version deployed |

### Detailed Test Scenarios

```
┌─────────────────────────────────────────────────────────────────┐
│                    TESTING GITOPS FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TEST 1: Check Initial Deployment                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ kubectl get pods -n default                             │   │
│  │ # Should show api, gateway, worker, product pods        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  TEST 2: Make a Change in Git                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Edit manifests/api-deployment.yaml                   │   │
│  │ 2. Change replicas: 2 → replicas: 3                     │   │
│  │ 3. git commit && git push                               │   │
│  │ 4. Watch Argo CD auto-sync (within 3 minutes)           │   │
│  │ 5. kubectl get pods -n default | grep api               │   │
│  │    # Should show 3 api pods                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  TEST 3: Test Self-Healing                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Manually delete a pod:                               │   │
│  │    kubectl delete pod api-xxx -n default                │   │
│  │ 2. Watch Argo CD restore it                             │   │
│  │ 3. Check UI shows "Synced" status                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  TEST 4: Test Rollback                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. In Argo CD UI → History & Rollback                   │   │
│  │ 2. Select previous revision                             │   │
│  │ 3. Click "Rollback"                                     │   │
│  │ 4. Verify pods use old image                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Verify Deployed Resources

```bash
# Check what Argo CD deployed
kubectl get all -n default

# Should show:
# - deployment.apps/api (2 replicas)
# - deployment.apps/gateway (2 replicas)
# - deployment.apps/worker (3 replicas)
# - deployment.apps/product (2 replicas)
# - statefulset.apps/rabbitmq (1 replica)
# - services for each component
```

### 6. Common Test Scenarios Table

| Test | Command | Expected Result |
|------|---------|-----------------|
| Pods running | `kubectl get pods -n argocd` | All 7 pods Running |
| App synced | `kubectl get app -n argocd` | SYNC STATUS: Synced |
| App healthy | `kubectl get app -n argocd` | HEALTH STATUS: Healthy |
| UI accessible | `curl -k https://localhost:8080` | HTML response |
| Resources deployed | `kubectl get all -n default` | All workloads present |

### 7. Force Sync

```bash
# Force refresh
kubectl patch application async-microservices -n argocd --type merge \
  -p '{"metadata": {"annotations": {"argocd.argoproj.io/refresh": "hard"}}}'

# Using Argo CD CLI
argocd app sync async-microservices --force
```

### 8. Check Logs (if issues)

```bash
# Application controller
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller

# Server logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server

# Repo server (Git issues)
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-repo-server
```

### 9. Fix DNS Issue in Kind

```bash
# If error: "lookup github.com: no such host"

# Check if DNS is working
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup github.com

# If DNS fails, restart CoreDNS
kubectl rollout restart deployment/coredns -n kube-system

# Wait and retry
sleep 30
kubectl get application async-microservices -n argocd
```

## Troubleshooting

### GitHub Actions Failing

```bash
# Check workflow logs
gh run view <run-id> --log

# Common issues:
# - Missing secrets (DOCKERHUB_USERNAME, DOCKERHUB_TOKEN)
# - Docker build errors
# - Test failures
```

### Argo CD Not Syncing

```bash
# Check application status
kubectl describe application async-microservices -n argocd

# Check Argo CD logs
kubectl logs -n argocd -l app.kubernetes.io/name=argocd-server

# Force refresh
argocd app get async-microservices --refresh
```

### Sync Failed

```bash
# View sync result
argocd app sync async-microservices

# Check events
kubectl get events -n default --sort-by='.lastTimestamp'

# Common issues:
# - Invalid manifests
# - Resource quota exceeded
# - Image pull errors
```

## Load Testing Tools Comparison

### Tools Overview

| Tool | Language | Best For | Learning Curve | Resource Usage |
|------|----------|----------|----------------|----------------|
| **k6** ✓ (used) | JavaScript | Developer-friendly, CI/CD | Easy | Low |
| **Locust** | Python | Python teams, distributed | Easy | Medium |
| **JMeter** | Java/GUI | Complex scenarios, enterprise | Steep | High |
| **Gatling** | Scala | High performance, detailed reports | Medium | Medium |
| **Artillery** | JavaScript | Serverless, quick tests | Easy | Low |
| **wrk/wrk2** | C/Lua | Simple HTTP benchmarks | Easy | Very Low |
| **Vegeta** | Go | Constant rate testing | Easy | Very Low |

### When to Use What

| Scenario | Recommended Tool |
|----------|------------------|
| **CI/CD pipeline testing** | k6 ✅ |
| **Quick API benchmarks** | k6, wrk, Vegeta |
| **Python team** | Locust |
| **Enterprise/complex protocols** | JMeter |
| **Beautiful reports needed** | Gatling |
| **Real-time web UI monitoring** | Locust |
| **Grafana/Prometheus ecosystem** | k6 ✅ |

### Why k6 for This Project?

```
┌─────────────────────────────────────────────────────────────────┐
│                  WHY k6 IS THE BEST CHOICE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. GRAFANA ECOSYSTEM ALIGNMENT                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │  Logging:  Grafana + Loki                           │    │
│     │  Metrics:  Grafana + Prometheus                     │    │
│     │  Tracing:  Grafana + Jaeger                         │    │
│     │  Testing:  Grafana + k6  ← Same company!            │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│  2. CI/CD NATIVE                                                │
│     - Official GitHub Action: grafana/k6-action                 │
│     - Single binary, no dependencies                            │
│     - Exit codes for pass/fail                                  │
│                                                                 │
│  3. DEVELOPER FRIENDLY                                          │
│     - JavaScript (ES6)                                          │
│     - npm-like modules                                          │
│     - Easy to version control                                   │
│                                                                 │
│  4. MODERN FEATURES                                             │
│     - Thresholds (auto-fail on metrics)                         │
│     - Scenarios (ramp-up, constant, etc.)                       │
│     - Built-in protocols (HTTP, WebSocket, gRPC)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Code Comparison

**k6 (Current Choice)**
```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function() {
  let res = http.get('http://localhost:3000/health');
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

**Locust (Alternative)**
```python
from locust import HttpUser, task

class WebsiteUser(HttpUser):
    @task
    def health_check(self):
        self.client.get("/health")
```

**JMeter** - GUI-based, requires `.jmx` XML file

### Running Load Tests

```bash
# Install k6
# Windows: choco install k6
# Mac: brew install k6
# Linux: sudo apt install k6

# Run load test
k6 run load-tests/load-test.js

# Run with custom options
k6 run --vus 50 --duration 1m load-tests/load-test.js

# Run against different environment
k6 run -e BASE_URL=http://localhost:3002 load-tests/load-test.js
```

### Load Test in CI/CD

```yaml
# In GitHub Actions
- name: Run k6 smoke test
  uses: grafana/k6-action@v0.3.1
  with:
    filename: load-tests/load-test.js
```

## Image Tagging Best Practices

### Tag Types Comparison

| Tag Type | Example | Use Case | Production Ready? |
|----------|---------|----------|-------------------|
| `latest` | `api:latest` | Development only | No |
| `v1`, `v2` | `api:v1` | Simple projects | Okay |
| **Git SHA** | `api:a62c105` | Production | **Yes** |
| **Semantic** | `api:1.2.3` | Libraries/releases | Yes |

### Why Git SHA Tags are Best Practice

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHY SHA TAGS?                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. TRACEABILITY                                                │
│     Image abc123 → Git commit abc123 → Exact code deployed      │
│                                                                 │
│  2. IMMUTABILITY                                                │
│     "v1" can be overwritten, "abc123" is forever                │
│                                                                 │
│  3. ROLLBACK                                                    │
│     Know exactly which version to rollback to                   │
│                                                                 │
│  4. AUDIT                                                       │
│     "What code is running in prod right now?" → Check manifest  │
│                                                                 │
│  5. DEBUGGING                                                   │
│     Bug in prod? Check the SHA, find the exact commit           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Problem with `latest` or `v1`

```bash
# Monday: Deploy api:v1 (commit abc)
# Tuesday: Push new api:v1 (commit def)
# Wednesday: Pod restarts, pulls NEW api:v1
# Result: Unexpected change, no audit trail
```

### How SHA Tagging Works in This Project

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHA TAGGING FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Developer pushes code (commit: a62c105)                     │
│                    │                                            │
│                    ▼                                            │
│  2. CI builds image with SHA tag                                │
│     docker build -t api-service:a62c105                         │
│                    │                                            │
│                    ▼                                            │
│  3. CI pushes image to Docker Hub                               │
│     asifmahmoud414/api-service:a62c105                          │
│                    │                                            │
│                    ▼                                            │
│  4. CI updates manifest with new SHA                            │
│     image: asifmahmoud414/api-service:a62c105                   │
│                    │                                            │
│                    ▼                                            │
│  5. CI commits and pushes manifest change                       │
│                    │                                            │
│                    ▼                                            │
│  6. ArgoCD detects change, deploys new image                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### GitHub Actions Permissions for Manifest Updates

The CI workflow needs write permission to push manifest updates. Two options:

**Option 1: Repository Settings (Simplest)**
1. Go to repo → Settings → Actions → General
2. Scroll to "Workflow permissions"
3. Select "Read and write permissions"
4. Save

**Option 2: Explicit Permissions in Workflow**

```yaml
jobs:
  update-manifests:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required to push changes
    steps:
      - uses: actions/checkout@v4
      - name: Update and push manifests
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          # ... update manifests ...
          git push
```

### Verifying Image Tags

```bash
# Check what image is deployed
kubectl get deployment api -o jsonpath='{.spec.template.spec.containers[0].image}'
# Output: asifmahmoud414/api-service:a62c105

# Match to git commit
git log --oneline | grep a62c105
# Output: a62c105 feat: add new endpoint
```

## Security Best Practices

1. **Use GitHub Secrets** for credentials
2. **Limit Argo CD access** with RBAC
3. **Enable audit logging** in Argo CD
4. **Use signed commits** for manifest changes
5. **Restrict who can merge** to main branch
6. **Use private Docker registry** in production
7. **Use SHA tags** for production images (never `latest`)

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Argo CD Documentation](https://argo-cd.readthedocs.io/)
- [GitOps Principles](https://www.gitops.tech/)
- [Docker Build Action](https://github.com/docker/build-push-action)
