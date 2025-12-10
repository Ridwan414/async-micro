# Load Testing for Staging Environment

This directory contains load testing configurations to test autoscaling in the staging environment.

## 🎯 Autoscaling Configuration

### Current HPA Settings (Staging):

| Service | Min Replicas | Max Replicas | CPU Target | Memory Target |
|---------|--------------|--------------|------------|---------------|
| Gateway | 2 | 5 | 50% | 70% |
| API | 2 | 10 | 50% | 70% |
| Product | 1 | 5 | 50% | 70% |
| Worker | 2 | 15 | 60% | 70% |

### Scaling Behavior:

**Scale Up:**
- Immediate (0s stabilization window)
- Can scale up by 100% or add 4 pods every 15 seconds
- Uses the maximum of the two policies

**Scale Down:**
- 5-minute stabilization window (prevents flapping)
- Can scale down by 50% every 60 seconds

## 🚀 Running Load Tests

### Method 1: Using Kubernetes Job (Recommended)

```bash
# Deploy the load test job
kubectl apply -f load-test/load-test-job.yaml

# Watch the job progress
kubectl get jobs -n staging -w

# Watch pods scaling in real-time
kubectl get pods -n staging -w

# Watch HPA metrics
kubectl get hpa -n staging -w

# View load test logs
kubectl logs -n staging -l app=load-test -f
```

### Method 2: Manual Load Test from Local Machine

```bash
# Install hey (HTTP load generator)
# Linux:
wget https://hey-release.s3.us-east-2.amazonaws.com/hey_linux_amd64
chmod +x hey_linux_amd64
sudo mv hey_linux_amd64 /usr/local/bin/hey

# Mac:
brew install hey

# Windows:
# Download from: https://github.com/rakyll/hey/releases

# Port-forward to staging gateway
kubectl port-forward -n staging svc/gateway-service 3000:3000

# Run load test (in another terminal)
hey -z 5m -c 200 -q 50 http://localhost:3000/health
```

### Method 3: Using Apache Bench (ab)

```bash
# Port-forward to staging gateway
kubectl port-forward -n staging svc/gateway-service 3000:3000

# Run load test
ab -n 100000 -c 200 -t 300 http://localhost:3000/health
```

## 📊 Monitoring Autoscaling in ArgoCD UI

### Step 1: Access ArgoCD UI
```
http://103.191.50.49:30588
Username: admin
Password: DJR0wj2aMlaufRcz
```

### Step 2: Navigate to Staging Application
1. Click on **async-micro-staging** application
2. You'll see the resource tree with all deployments

### Step 3: Watch Real-Time Scaling
1. **Before Load Test:**
   - Gateway: 2 pods
   - API: 5 pods (current)
   - Product: 2 pods
   - Worker: 3 pods

2. **During Load Test:**
   - Watch pods increase as CPU/memory thresholds are exceeded
   - HPA will automatically create new pods
   - ArgoCD UI will show new pods appearing in real-time

3. **After Load Test:**
   - After 5 minutes of low load, pods will scale down
   - Returns to minimum replica counts

### Step 4: View Metrics
```bash
# Check current HPA status
kubectl get hpa -n staging

# Detailed HPA description
kubectl describe hpa api-hpa -n staging
kubectl describe hpa gateway-hpa -n staging
kubectl describe hpa product-hpa -n staging

# Check pod resource usage
kubectl top pods -n staging

# Check node resource usage
kubectl top nodes
```

## 🎬 Complete Load Test Workflow

### 1. Start Monitoring (Terminal 1)
```bash
watch -n 2 'kubectl get hpa -n staging'
```

### 2. Watch Pods (Terminal 2)
```bash
kubectl get pods -n staging -w
```

### 3. Run Load Test (Terminal 3)
```bash
kubectl apply -f load-test/load-test-job.yaml
```

### 4. View Load Test Logs (Terminal 4)
```bash
kubectl logs -n staging -l app=load-test -f
```

### 5. Monitor in ArgoCD UI
- Open: http://103.191.50.49:30588
- Navigate to: async-micro-staging
- Watch the resource tree update in real-time

## 🧹 Cleanup

```bash
# Delete the load test job
kubectl delete -f load-test/load-test-job.yaml

# Or delete all completed jobs
kubectl delete jobs -n staging -l app=load-test
```

## 📈 Expected Results

### Phase 1: Initial State (0-1 min)
- Gateway: 2 pods
- API: 2-5 pods
- Product: 1-2 pods
- CPU: <10%

### Phase 2: Load Ramp-Up (1-3 min)
- CPU increases to 50-80%
- HPA triggers scale-up
- New pods start appearing

### Phase 3: Peak Load (3-8 min)
- Gateway: 3-5 pods
- API: 5-10 pods
- Product: 3-5 pods
- CPU: 40-60% (distributed across more pods)

### Phase 4: Cool Down (8-15 min)
- Load test completes
- CPU drops below 50%
- After 5 min stabilization, pods scale down
- Returns to minimum replicas

## 🔍 Troubleshooting

### HPA Not Scaling

**Check metrics server:**
```bash
kubectl get deployment metrics-server -n kube-system
kubectl top nodes
kubectl top pods -n staging
```

**If metrics not available:**
```bash
kubectl apply -f manifests/hpa/metrics-server.yaml
```

### Load Test Job Fails

**Check job status:**
```bash
kubectl describe job load-test-staging -n staging
kubectl logs -n staging -l app=load-test
```

### Pods Not Accessible

**Check services:**
```bash
kubectl get svc -n staging
kubectl describe svc gateway-service -n staging
```

