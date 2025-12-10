# 🚀 Trigger Load Test from ArgoCD UI

This guide shows you how to deploy and trigger the load test directly from the ArgoCD UI on your remote server.

---

## 📋 Prerequisites

1. ✅ ArgoCD UI accessible at: `http://103.191.50.49:30588`
2. ✅ Load test files committed to Git repository
3. ✅ Staging environment deployed and running

---

## 🎯 Method 1: Deploy Load Test Application (Recommended)

### Step 1: Commit Load Test Files to Git

**On your local machine:**

```bash
# Add load test files
git add load-test/
git add argocd/applications/load-test-app.yaml

# Commit
git commit -m "Add load test application for staging autoscaling demo"

# Push to repository
git push origin HEAD
```

### Step 2: Access ArgoCD UI

1. Open browser: `http://103.191.50.49:30588`
2. Login:
   - Username: `admin`
   - Password: `DJR0wj2aMlaufRcz`

### Step 3: Create Load Test Application

**Option A: Using UI (Manual)**

1. Click **"+ NEW APP"** button (top left)
2. Fill in the form:
   - **Application Name**: `async-micro-load-test`
   - **Project**: `default`
   - **Sync Policy**: `Manual` (or `Automatic`)
   
3. **Source** section:
   - **Repository URL**: `https://github.com/Ridwan414/async-micro.git`
   - **Revision**: `HEAD` (or your branch name)
   - **Path**: `load-test`
   
4. **Destination** section:
   - **Cluster URL**: `https://kubernetes.default.svc`
   - **Namespace**: `staging`
   
5. Click **"CREATE"** at the top

**Option B: Using Manifest (Faster)**

1. Click **"+ NEW APP"** button
2. Click **"EDIT AS YAML"** button (top right)
3. Paste this YAML:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-micro-load-test
spec:
  project: default
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    targetRevision: HEAD
    path: load-test
  destination:
    server: https://kubernetes.default.svc
    namespace: staging
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
```

4. Click **"SAVE"**
5. Click **"CREATE"**

### Step 4: Sync (Deploy) the Load Test

1. Click on the **async-micro-load-test** application card
2. Click **"SYNC"** button (top)
3. Click **"SYNCHRONIZE"** button
4. Watch the load test job deploy!

### Step 5: Monitor Scaling in Real-Time

1. Go back to applications list
2. Click on **async-micro-staging** application
3. Watch the pods scale up as load increases!

---

## 🎯 Method 2: Manual Sync from Existing Application

If you've already added the load test to the root app:

### Step 1: Refresh Root Application

1. Click on **async-micro-root** application
2. Click **"REFRESH"** button
3. It will detect the new `load-test-app.yaml`

### Step 2: Sync Root Application

1. Click **"SYNC"** button
2. Select **"SYNCHRONIZE"**
3. The load test application will be created

### Step 3: Sync Load Test Application

1. Go back to applications list
2. Click on **async-micro-load-test** (newly created)
3. Click **"SYNC"** → **"SYNCHRONIZE"**
4. Load test starts!

---

## 🎯 Method 3: Quick Deploy via kubectl (Fastest)

If you want to deploy immediately without waiting for Git:

```bash
# Deploy the load test application to ArgoCD
kubectl apply -f argocd/applications/load-test-app.yaml

# Wait a few seconds, then sync via UI or CLI
argocd app sync async-micro-load-test
```

Then go to ArgoCD UI to watch it!

---

## 🎯 Method 4: Direct kubectl Apply (No ArgoCD)

If you just want to run the load test without ArgoCD:

```bash
# Apply directly
kubectl apply -f load-test/load-test-job.yaml

# Watch in ArgoCD staging app
# The job will appear in the staging namespace
```

---

## 📊 What You'll See in ArgoCD UI

### After Deploying Load Test App:

```
Applications List:
├── async-micro-root (Synced, Healthy)
├── async-micro-production (Synced, Healthy)
├── async-micro-staging (Synced, Healthy) ← Watch this!
├── async-micro-monitoring (Synced, Healthy)
└── async-micro-load-test (Synced, Healthy) ← New!
```

### In Load Test Application:

```
async-micro-load-test
└── Job: load-test-staging
    ├── Pod: load-test-staging-xxxxx (Running)
    ├── Pod: load-test-staging-xxxxx (Running)
    ├── Pod: load-test-staging-xxxxx (Running)
    ├── Pod: load-test-staging-xxxxx (Running)
    └── Pod: load-test-staging-xxxxx (Running)
```

### In Staging Application (Watch This!):

```
async-micro-staging
├── Deployments
│   ├── api (2 → 8 replicas) 📈 SCALING!
│   ├── gateway (2 → 5 replicas) 📈 SCALING!
│   ├── product (1 → 4 replicas) 📈 SCALING!
│   └── worker (2 replicas)
└── Pods (increasing in real-time!)
```

---

## 🎬 Step-by-Step Visual Guide

### 1. Before Load Test
![Before](https://via.placeholder.com/800x400?text=Before:+7+pods+in+staging)
- Gateway: 2 pods
- API: 2 pods
- Product: 1 pod

### 2. Deploy Load Test
- Click "SYNC" on load-test app
- 5 load test pods start

### 3. During Load Test (1-3 minutes)
![During](https://via.placeholder.com/800x400?text=During:+18+pods+in+staging)
- Gateway: 2 → 5 pods (MAX!)
- API: 2 → 8 pods
- Product: 1 → 4 pods
- **Watch pods appear in real-time!**

### 4. After Load Test (10 minutes)
![After](https://via.placeholder.com/800x400?text=After:+7+pods+in+staging)
- Pods scale back down
- Returns to normal

---

## 🔄 Re-running the Load Test

### Option 1: Delete and Re-sync

1. In **async-micro-load-test** app, click on the Job
2. Click **"DELETE"** button
3. Click **"SYNC"** button to redeploy

### Option 2: Via kubectl

```bash
# Delete the job
kubectl delete job load-test-staging -n staging

# Re-sync in ArgoCD UI
# Or apply again
kubectl apply -f load-test/load-test-job.yaml
```

### Option 3: Edit Job Name

Change the job name in `load-test-job.yaml` to create a new job:
```yaml
metadata:
  name: load-test-staging-2  # Changed from load-test-staging
```

Then sync in ArgoCD UI.

---

## 📈 Monitoring Tips

### Enable Auto-Refresh in ArgoCD

1. Click the **"Refresh"** dropdown (top right)
2. Enable **"Auto-Refresh"**
3. UI updates every few seconds automatically!

### Watch Multiple Apps

1. Open **async-micro-staging** in one browser tab
2. Open **async-micro-load-test** in another tab
3. Switch between tabs to see both!

### Use Compact View

1. Click the **"View"** button
2. Select **"Compact"** or **"Tree"**
3. Easier to see all resources at once

---

## ✅ Success Indicators

In ArgoCD UI, you should see:

- ✅ **async-micro-load-test**: Synced, Healthy
- ✅ **5 load test pods**: Running
- ✅ **async-micro-staging**: Synced, Healthy
- ✅ **Gateway pods**: Increasing from 2 → 5
- ✅ **API pods**: Increasing from 2 → 8
- ✅ **Product pods**: Increasing from 1 → 4
- ✅ **Pod status**: Green (Healthy)

---

## 🧹 Cleanup

### Delete Load Test Application

1. Click on **async-micro-load-test** app
2. Click **"DELETE"** button (top)
3. Type the app name to confirm
4. Click **"OK"**

### Or via kubectl

```bash
kubectl delete application async-micro-load-test -n argocd
kubectl delete job load-test-staging -n staging
```

---

## 🎯 Quick Commands Reference

```bash
# Commit and push load test
git add load-test/ argocd/applications/load-test-app.yaml
git commit -m "Add load test for autoscaling demo"
git push

# Deploy load test app
kubectl apply -f argocd/applications/load-test-app.yaml

# Watch HPA
kubectl get hpa -n staging -w

# Watch pods
kubectl get pods -n staging -w

# Delete load test
kubectl delete job load-test-staging -n staging
```

---

**Now go to ArgoCD UI and deploy the load test! 🚀**

URL: `http://103.191.50.49:30588`

