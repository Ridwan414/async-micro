# Monitoring Autoscaling in ArgoCD UI

## 🎯 Quick Start

### 1. Start the Load Test
```bash
kubectl apply -f load-test/load-test-job.yaml
```

### 2. Monitor via PowerShell Script
```powershell
# Windows PowerShell
.\load-test\monitor-scaling.ps1
```

### 3. Access ArgoCD UI
```
URL: http://103.191.50.49:30588
Username: admin
Password: DJR0wj2aMlaufRcz
```

---

## 📊 What to Watch in ArgoCD UI

### Step 1: Navigate to Staging Application

1. **Login to ArgoCD** at `http://103.191.50.49:30588`
2. Click on **async-micro-staging** application card
3. You'll see the application details page

### Step 2: View Resource Tree

The resource tree shows all Kubernetes resources:

```
async-micro-staging
├── 📦 Deployments
│   ├── api (2-10 replicas) ← Watch this scale!
│   ├── gateway (2-5 replicas) ← Watch this scale!
│   ├── product (1-5 replicas) ← Watch this scale!
│   └── worker (2-15 replicas) ← Watch this scale!
├── 🔄 ReplicaSets
│   └── (One per deployment)
├── 🚀 Pods
│   ├── api-xxxxx (multiple) ← New pods appear here!
│   ├── gateway-xxxxx (multiple)
│   ├── product-xxxxx (multiple)
│   └── worker-xxxxx (multiple)
├── 🌐 Services
│   ├── api-service
│   ├── gateway-service
│   ├── product-service
│   └── rabbitmq
└── 💾 StatefulSets
    └── rabbitmq-0
```

### Step 3: Watch Real-Time Scaling

**Before Load Test (Initial State):**
- Gateway: 2 pods (green)
- API: 2-5 pods (green)
- Product: 1-2 pods (green)
- Worker: 2-3 pods (green/yellow if RabbitMQ issues)

**During Load Test (1-3 minutes):**
- 🟡 New pods appear with "Progressing" status
- 🟡 Pods show "ContainerCreating" → "Running"
- 🟢 Pod count increases:
  - Gateway: 2 → 3 → 4 → 5
  - API: 5 → 6 → 7 → 8 → 9 → 10
  - Product: 2 → 3 → 4 → 5

**Peak Load (3-8 minutes):**
- 🟢 All pods "Running" and "Healthy"
- Maximum replicas reached based on HPA limits
- CPU/Memory distributed across more pods

**After Load Test (8-15 minutes):**
- 🟡 Pods start terminating after 5-minute stabilization
- 🟢 Returns to minimum replica counts
- Old ReplicaSets may show 0/0 pods

### Step 4: Enable Auto-Refresh

1. Click the **"Refresh"** button dropdown (top right)
2. Select **"Auto-Sync: Enabled"** if not already enabled
3. The UI will automatically update every few seconds

### Step 5: View Pod Details

Click on any pod to see:
- **Status**: Running, Pending, etc.
- **Containers**: Container status and restart count
- **Events**: Recent events (pulled image, started container, etc.)
- **Logs**: Click "Logs" button to view container logs
- **Resource Usage**: CPU and memory requests/limits

### Step 6: View Deployment Details

Click on a deployment (e.g., "api") to see:
- **Desired Replicas**: Target number of pods
- **Current Replicas**: Actual number of pods
- **Available Replicas**: Ready and available pods
- **Conditions**: Deployment health status

---

## 🎬 Timeline of Events

### T+0:00 - Load Test Starts
```bash
kubectl apply -f load-test/load-test-job.yaml
```
- 5 load-test pods created
- Initial traffic starts hitting services

### T+0:30 - CPU Increases
- Gateway CPU: 0% → 30%
- API CPU: 1% → 40%
- Product CPU: 1% → 35%

### T+1:00 - First Scale-Up Triggered
- HPA detects CPU > 50% threshold
- New pods requested
- ArgoCD shows new pods in "Progressing" state

### T+1:15 - New Pods Starting
- Pods appear in resource tree
- Status: "ContainerCreating"
- Images being pulled

### T+1:30 - New Pods Running
- Status changes to "Running"
- Health checks passing
- Load distributed across more pods

### T+2:00 - Second Scale-Up (if needed)
- If CPU still > 50%, more pods added
- Can add up to 4 pods or 100% every 15 seconds

### T+3:00 - Peak Load
- Maximum replicas reached
- CPU stabilizes at 40-60% per pod
- All pods healthy and serving traffic

### T+8:00 - Load Test Completes
- Load test job finishes
- Traffic drops to zero
- CPU usage decreases

### T+13:00 - Scale-Down Begins
- After 5-minute stabilization window
- HPA starts removing pods
- Pods show "Terminating" status

### T+15:00 - Back to Normal
- Returns to minimum replicas
- System stable
- Ready for next test

---

## 📈 Metrics to Monitor

### In ArgoCD UI:
- ✅ **Pod Count**: Watch numbers increase/decrease
- ✅ **Pod Status**: Green (Healthy), Yellow (Progressing), Red (Degraded)
- ✅ **Sync Status**: Should stay "Synced" (HPA changes don't affect sync)
- ✅ **Health Status**: Should stay "Healthy"

### In Terminal (kubectl):
```bash
# HPA status
kubectl get hpa -n staging -w

# Pod status
kubectl get pods -n staging -w

# Resource usage
kubectl top pods -n staging

# Deployment replicas
kubectl get deployments -n staging
```

### In PowerShell Monitor:
```powershell
.\load-test\monitor-scaling.ps1
```
Shows all metrics in one view with color coding!

---

## 🎨 ArgoCD UI Features

### Resource Filters
- Click **"Deployments"** to show only deployments
- Click **"Pods"** to show only pods
- Click **"All"** to show everything

### Search
- Use search box to find specific resources
- Example: Search "api" to see all API-related resources

### Compact/Detailed View
- Toggle between tree view and list view
- Tree view: Shows hierarchy
- List view: Shows table format

### Sync Options
- **Refresh**: Manually refresh from cluster
- **Sync**: Re-apply manifests (not needed for HPA)
- **Auto-Sync**: Automatically sync on changes

---

## 🔍 Troubleshooting

### Pods Not Scaling

**Check HPA:**
```bash
kubectl describe hpa api-hpa -n staging
```

**Look for:**
- "unable to get metrics" → Metrics server issue
- "current: <unknown>" → Metrics not available
- "ScalingActive: False" → HPA disabled

**Fix:**
```bash
# Restart metrics server
kubectl rollout restart deployment metrics-server -n kube-system

# Wait for metrics
kubectl top pods -n staging
```

### ArgoCD Shows "OutOfSync"

**This is normal!** HPA changes replica counts, which doesn't affect sync status.

**If truly out of sync:**
1. Click **"Sync"** button
2. Select **"Synchronize"**
3. Wait for sync to complete

### Load Test Not Generating Load

**Check load test pods:**
```bash
kubectl get pods -n staging -l app=load-test
kubectl logs -n staging -l app=load-test
```

**Check services:**
```bash
kubectl get svc -n staging
```

---

## 🎯 Success Criteria

✅ **Load test job running**: 5/5 pods active
✅ **HPA responding**: CPU/Memory metrics updating
✅ **Pods scaling up**: New pods appearing in ArgoCD
✅ **Pods healthy**: All pods green in ArgoCD
✅ **Load distributed**: CPU per pod decreases as pods increase
✅ **Pods scaling down**: After load stops, pods terminate
✅ **System stable**: Returns to minimum replicas

---

## 📚 Additional Commands

```bash
# Delete load test
kubectl delete -f load-test/load-test-job.yaml

# Manual scale (for testing)
kubectl scale deployment api -n staging --replicas=8

# Check HPA events
kubectl get events -n staging --sort-by='.lastTimestamp' | grep HorizontalPodAutoscaler

# Describe HPA
kubectl describe hpa -n staging
```

