# 🚀 Load Test Summary - Staging Autoscaling

## ✅ Load Test Deployed Successfully!

The load test is now running in the staging environment to demonstrate Horizontal Pod Autoscaling (HPA).

---

## 📊 Current Status

### Load Test Job
```bash
kubectl get jobs -n staging
kubectl get pods -n staging -l app=load-test
```

### HPA Configuration (Staging)

| Service | Min | Max | CPU Target | Memory Target | Current Replicas |
|---------|-----|-----|------------|---------------|------------------|
| Gateway | 2   | 5   | 50%        | 70%           | 2                |
| API     | 2   | 10  | 50%        | 70%           | 5                |
| Product | 1   | 5   | 50%        | 70%           | 2                |
| Worker  | 2   | 15  | 60%        | 70%           | 3                |

---

## 🎬 How to Monitor in ArgoCD UI

### Step 1: Access ArgoCD
```
URL: http://103.191.50.49:30588
Username: admin
Password: DJR0wj2aMlaufRcz
```

### Step 2: Navigate to Staging Application
1. Click on **async-micro-staging** card
2. You'll see the application resource tree

### Step 3: Watch Real-Time Scaling

**What to Watch:**
- 📦 **Deployments**: Click to see replica counts changing
- 🚀 **Pods**: New pods appearing as load increases
- 🟢 **Status**: Pods transitioning from Pending → Running
- 📈 **ReplicaSets**: New ReplicaSets created for scaled deployments

**Expected Behavior:**
1. **Initial State** (0-1 min):
   - Gateway: 2 pods
   - API: 2-5 pods
   - Product: 1-2 pods

2. **Load Ramp-Up** (1-3 min):
   - CPU increases above 50%
   - HPA triggers scale-up
   - New pods appear in ArgoCD UI

3. **Peak Load** (3-5 min):
   - Gateway: 3-5 pods
   - API: 6-10 pods
   - Product: 3-5 pods
   - CPU distributed across pods

4. **Cool Down** (5-10 min):
   - Load test completes
   - After 5-minute stabilization, pods scale down
   - Returns to minimum replicas

---

## 📈 Monitoring Commands

### Watch HPA in Real-Time
```bash
# Watch HPA status
kubectl get hpa -n staging -w

# Detailed HPA info
kubectl describe hpa api-hpa -n staging
```

### Watch Pods Scaling
```bash
# Watch all pods
kubectl get pods -n staging -w

# Count pods by deployment
kubectl get pods -n staging -l app=api --no-headers | wc -l
kubectl get pods -n staging -l app=gateway --no-headers | wc -l
kubectl get pods -n staging -l app=product --no-headers | wc -l
```

### Check Resource Usage
```bash
# Pod resource usage
kubectl top pods -n staging

# Node resource usage
kubectl top nodes

# Deployment status
kubectl get deployments -n staging
```

### View Load Test Logs
```bash
# Follow load test logs
kubectl logs -n staging -l app=load-test -f

# Get logs from specific pod
kubectl logs -n staging load-test-staging-xxxxx
```

### Use PowerShell Monitor (Windows)
```powershell
# Run the monitoring script
.\load-test\monitor-scaling.ps1
```

---

## 🎯 Load Test Phases

### Phase 1: Warm-up (30 seconds)
- **Target**: Gateway health endpoint
- **Load**: 50 concurrent connections
- **Purpose**: Warm up services

### Phase 2: API Service Load (60 seconds)
- **Target**: API service via gateway
- **Load**: 100 concurrent connections
- **Purpose**: Test API scaling

### Phase 3: Product Service Load (60 seconds)
- **Target**: Product service via gateway
- **Load**: 100 concurrent connections
- **Purpose**: Test Product scaling

### Phase 4: Heavy Load (180 seconds) ⚡
- **Target**: All services simultaneously
- **Load**: 200 concurrent connections per service (600 total)
- **Purpose**: Trigger autoscaling
- **Expected**: Pods should scale up to handle load

**Total Duration**: ~5 minutes

---

## 📸 What You'll See in ArgoCD UI

### Before Load Test
```
async-micro-staging
├── Deployments
│   ├── api (2/2 replicas) 🟢
│   ├── gateway (2/2 replicas) 🟢
│   ├── product (1/1 replicas) 🟢
│   └── worker (2/2 replicas) 🟢
└── Pods (7 total)
```

### During Heavy Load (Phase 4)
```
async-micro-staging
├── Deployments
│   ├── api (8/8 replicas) 🟢 ← SCALED UP!
│   ├── gateway (4/4 replicas) 🟢 ← SCALED UP!
│   ├── product (4/4 replicas) 🟢 ← SCALED UP!
│   └── worker (2/2 replicas) 🟢
└── Pods (18 total) ← NEW PODS APPEARED!
    ├── api-xxxxx-1 🟢
    ├── api-xxxxx-2 🟢
    ├── api-xxxxx-3 🟢 ← NEW
    ├── api-xxxxx-4 🟢 ← NEW
    ...
```

### After Load Test (10 minutes later)
```
async-micro-staging
├── Deployments
│   ├── api (2/2 replicas) 🟢 ← SCALED DOWN
│   ├── gateway (2/2 replicas) 🟢 ← SCALED DOWN
│   ├── product (1/1 replicas) 🟢 ← SCALED DOWN
│   └── worker (2/2 replicas) 🟢
└── Pods (7 total) ← BACK TO NORMAL
```

---

## 🧹 Cleanup

```bash
# Delete load test job
kubectl delete -f load-test/load-test-job.yaml

# Or delete all load test resources
kubectl delete jobs,pods -n staging -l app=load-test
```

---

## 📚 Additional Resources

- **Load Test README**: `load-test/README.md`
- **ArgoCD Monitoring Guide**: `load-test/ARGOCD-MONITORING-GUIDE.md`
- **ArgoCD Access Info**: `ARGOCD-ACCESS.md`
- **PowerShell Monitor**: `load-test/monitor-scaling.ps1`

---

## 🔍 Troubleshooting

### Pods Not Scaling

**Check HPA:**
```bash
kubectl describe hpa -n staging
```

**Check Metrics Server:**
```bash
kubectl get deployment metrics-server -n kube-system
kubectl top nodes
```

### Load Test Failing

**Check logs:**
```bash
kubectl logs -n staging -l app=load-test
```

**Check services:**
```bash
kubectl get svc -n staging
```

---

## ✨ Success Indicators

✅ Load test job running (5 pods)
✅ HPA showing CPU/Memory metrics
✅ Pods scaling up during heavy load
✅ New pods visible in ArgoCD UI
✅ Pods scaling down after load stops
✅ System returns to stable state

**Enjoy watching your microservices scale automatically! 🎉**

