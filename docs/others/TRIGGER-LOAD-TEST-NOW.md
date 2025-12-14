# 🚀 TRIGGER LOAD TEST FROM ARGOCD UI - QUICK GUIDE

## ✅ Setup Complete!

The load test application is now ready in your ArgoCD UI. Follow these simple steps to trigger it.

---

## 📍 Step-by-Step Instructions

### Step 1: Access ArgoCD UI

Open your browser and go to:
```
http://103.191.50.49:30588
```

**Login Credentials:**
- Username: `admin`
- Password: `DJR0wj2aMlaufRcz`

---

### Step 2: Find the Load Test Application

You should see **5 applications** in the dashboard:

1. ✅ **async-micro-root** (Synced, Healthy)
2. ✅ **async-micro-production** (Synced, Healthy)
3. ✅ **async-micro-staging** (OutOfSync, Healthy) ← We'll watch this!
4. ✅ **async-micro-monitoring** (Synced, Healthy)
5. 🆕 **async-micro-load-test** (OutOfSync, Missing) ← Click this!

---

### Step 3: Click on "async-micro-load-test"

Click on the **async-micro-load-test** application card.

You'll see:
- **Status**: OutOfSync (this is normal - not deployed yet)
- **Health**: Missing (no resources deployed yet)
- **Sync Policy**: Manual

---

### Step 4: Sync (Deploy) the Load Test

**Click the "SYNC" button** at the top of the page.

A dialog will appear with sync options:

1. **Revision**: Should show `HEAD` or `stag`
2. **Sync Options**: Leave defaults
3. Click the **"SYNCHRONIZE"** button

---

### Step 5: Watch the Load Test Deploy

You'll see:
- ✅ Job resource appearing
- ✅ 5 pods being created
- ✅ Status changing to "Synced"
- ✅ Health changing to "Healthy"

**Resource Tree:**
```
async-micro-load-test
└── Job: load-test-staging
    ├── Pod: load-test-staging-xxxxx (Running)
    ├── Pod: load-test-staging-xxxxx (Running)
    ├── Pod: load-test-staging-xxxxx (Running)
    ├── Pod: load-test-staging-xxxxx (Running)
    └── Pod: load-test-staging-xxxxx (Running)
```

---

### Step 6: Watch Autoscaling in Staging

**Go back to the applications list** (click "Applications" in the left menu)

**Click on "async-micro-staging"** application

**Enable Auto-Refresh:**
1. Click the "Refresh" dropdown (top right)
2. The UI will auto-update every few seconds

**Watch the magic happen! 🎉**

You'll see pods scaling up in real-time:

**Before (Initial State):**
- Gateway: 2 pods
- API: 2-5 pods
- Product: 1-2 pods

**During Load Test (1-3 minutes):**
- Gateway: 2 → 3 → 4 → 5 pods ⬆️
- API: 5 → 6 → 7 → 8 → 9 → 10 pods ⬆️
- Product: 2 → 3 → 4 → 5 pods ⬆️

**After Load Test (10 minutes):**
- Gateway: 5 → 4 → 3 → 2 pods ⬇️
- API: 10 → 8 → 6 → 4 → 2 pods ⬇️
- Product: 5 → 4 → 3 → 2 → 1 pods ⬇️

---

## 🎬 Timeline

| Time | Event | What You'll See in ArgoCD |
|------|-------|---------------------------|
| T+0:00 | Click SYNC on load-test app | Load test pods creating |
| T+0:30 | Load test starts | 5 load test pods running |
| T+1:00 | CPU increases | Gateway/API CPU rising |
| T+1:30 | First scale-up | New pods appearing! |
| T+2:00 | More scaling | Pod count increasing |
| T+3:00 | Peak load | Maximum pods reached |
| T+5:00 | Load test completes | Load test pods finish |
| T+10:00 | Scale down begins | Pods terminating |
| T+15:00 | Back to normal | Original pod count |

---

## 📊 What to Watch in ArgoCD UI

### In "async-micro-staging" Application:

**Deployments Section:**
- Click on "gateway" deployment → See replicas: 2/2 → 5/5
- Click on "api" deployment → See replicas: 2/2 → 10/10
- Click on "product" deployment → See replicas: 1/1 → 5/5

**Pods Section:**
- Watch new pods appear with status "Pending" → "ContainerCreating" → "Running"
- Pod names will be like: `gateway-xxxxx-yyyyy`
- Green = Healthy, Yellow = Progressing, Red = Degraded

**Resource Tree:**
- Shows hierarchy of all resources
- New pods appear as children of deployments
- Real-time status updates

---

## 🎯 Quick Actions in ArgoCD UI

### View Pod Logs
1. Click on any pod in the resource tree
2. Click "LOGS" button (top right)
3. See real-time logs

### View Pod Details
1. Click on any pod
2. See container status, events, resource usage

### Refresh Application
1. Click "REFRESH" button
2. Fetches latest state from cluster

### Enable Auto-Refresh
1. Click "Refresh" dropdown
2. UI updates automatically every few seconds

---

## 🔄 Re-run the Load Test

### Method 1: Delete and Re-sync

1. In **async-micro-load-test** app
2. Click on the "load-test-staging" Job
3. Click "DELETE" button
4. Confirm deletion
5. Click "SYNC" button to redeploy

### Method 2: Delete Application and Recreate

1. Click on **async-micro-load-test** app
2. Click "DELETE" button (top)
3. Type app name to confirm
4. Go back to applications list
5. The app will auto-recreate (if using App of Apps)
6. Click "SYNC" to deploy

---

## 📈 Monitoring Commands (Optional)

While watching in ArgoCD UI, you can also run these commands:

```bash
# Watch HPA status
kubectl get hpa -n staging -w

# Watch pods
kubectl get pods -n staging -w

# Check resource usage
kubectl top pods -n staging

# View load test logs
kubectl logs -n staging -l app=load-test -f
```

---

## ✅ Success Indicators

You'll know it's working when you see:

- ✅ **async-micro-load-test**: Synced, Healthy
- ✅ **5 load test pods**: Running (green)
- ✅ **Gateway pods**: Increasing from 2 → 5
- ✅ **API pods**: Increasing from 2 → 10
- ✅ **Product pods**: Increasing from 1 → 5
- ✅ **All pods**: Green (Healthy) status
- ✅ **Resource tree**: Updating in real-time

---

## 🎥 Visual Guide

### 1. Applications Dashboard
```
┌─────────────────────────────────────┐
│  Applications                       │
├─────────────────────────────────────┤
│  ✅ async-micro-root                │
│  ✅ async-micro-production          │
│  ✅ async-micro-staging    ← Watch! │
│  ✅ async-micro-monitoring          │
│  🆕 async-micro-load-test  ← Click! │
└─────────────────────────────────────┘
```

### 2. Load Test Application
```
┌─────────────────────────────────────┐
│  async-micro-load-test              │
│  [SYNC] [REFRESH] [DELETE]          │
├─────────────────────────────────────┤
│  📦 Job: load-test-staging          │
│    ├── 🚀 Pod: ...xxxxx (Running)  │
│    ├── 🚀 Pod: ...xxxxx (Running)  │
│    ├── 🚀 Pod: ...xxxxx (Running)  │
│    ├── 🚀 Pod: ...xxxxx (Running)  │
│    └── 🚀 Pod: ...xxxxx (Running)  │
└─────────────────────────────────────┘
```

### 3. Staging Application (During Load)
```
┌─────────────────────────────────────┐
│  async-micro-staging                │
│  [SYNC] [REFRESH] [DELETE]          │
├─────────────────────────────────────┤
│  📦 Deployment: gateway (5/5) ⬆️    │
│  📦 Deployment: api (10/10) ⬆️      │
│  📦 Deployment: product (5/5) ⬆️    │
│  📦 Deployment: worker (2/2)        │
│                                     │
│  🚀 20+ Pods (all green!)           │
└─────────────────────────────────────┘
```

---

## 🎉 You're Ready!

**Now go to the ArgoCD UI and click SYNC on the load test application!**

**URL**: `http://103.191.50.49:30588`

**Watch the autoscaling magic happen in real-time! 🚀**

