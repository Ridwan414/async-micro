# ArgoCD Deployment Guide

## 📁 Structure Overview

```
argocd/
├── application.yaml          # Root App of Apps (deploy this first!)
├── applications/             # Child applications managed by root
│   ├── production-app.yaml   # Production microservices → production namespace
│   ├── staging-app.yaml      # Staging microservices → staging namespace
│   └── monitoring-app.yaml   # Monitoring stack → monitoring namespace
└── install-argocd.sh         # ArgoCD installation script
```

## 🚀 Deployment Steps

### Step 1: Install ArgoCD
```bash
cd /root/async-micro/argocd
./install-argocd.sh
```

### Step 2: Access ArgoCD UI
```bash
# Get admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Port forward (in separate terminal)
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Access at: https://localhost:8080
# Username: admin
# Password: (from command above)
```

### Step 3: Deploy Root Application (App of Apps)
```bash
kubectl apply -f /root/async-micro/argocd/application.yaml
```

This single command will automatically create and deploy:
- ✅ **Production** environment (namespace: production)
- ✅ **Staging** environment (namespace: staging)
- ✅ **Monitoring** stack (namespace: monitoring)

## 🎯 What Gets Deployed

### Production Namespace (`production`)
- API Service (asifmahmoud414/api-service:v1)
- Gateway Service (asifmahmoud414/gateway-service:v1)
- Product Service (asifmahmoud414/product-service:v1)
- Worker Service (asifmahmoud414/worker-service:v1)
- RabbitMQ (rabbitmq:3-management)

### Staging Namespace (`staging`)
- API Service (asifmahmoud414/api-service:v1-stag)
- Gateway Service (asifmahmoud414/gateway-service:v1-stag)
- Product Service (asifmahmoud414/product-service:v1-stag)
- Worker Service (asifmahmoud414/worker-service:v1-stag)
- RabbitMQ (rabbitmq:3-management)

### Monitoring Namespace (`monitoring`)
- Grafana
- Loki
- Fluent-bit
- Minio

## 📊 Verify Deployment

### Check ArgoCD Applications
```bash
kubectl get applications -n argocd
```

Expected output:
```
NAME                      SYNC STATUS   HEALTH STATUS
async-micro-root          Synced        Healthy
async-micro-production    Synced        Healthy
async-micro-staging       Synced        Healthy
async-micro-monitoring    Synced        Healthy
```

### Check Pods by Namespace
```bash
# Production
kubectl get pods -n production

# Staging
kubectl get pods -n staging

# Monitoring
kubectl get pods -n monitoring
```

## 🔄 Sync Policies

All applications are configured with:
- **Auto-sync**: Enabled (changes in Git trigger automatic deployment)
- **Self-heal**: Enabled (manual changes are reverted)
- **Prune**: Enabled (deleted resources in Git are removed from cluster)

## 🛠️ Common Operations

### Manual Sync
```bash
# Sync specific application
kubectl argocd app sync async-micro-production -n argocd

# Sync all via root
kubectl argocd app sync async-micro-root -n argocd
```

### Disable Auto-sync for Staging (optional)
If you want manual control over staging deployments:
```bash
kubectl argocd app set async-micro-staging --sync-policy none -n argocd
```

### View Application Details
```bash
kubectl argocd app get async-micro-production -n argocd
```

## 🎨 Accessing Services

### Production
```bash
# Gateway (NodePort 30000)
curl http://<node-ip>:30000

# API (NodePort 30080)
curl http://<node-ip>:30080
```

### Monitoring
```bash
# Port-forward Grafana
kubectl port-forward -n monitoring svc/grafana 3001:3000

# Access at: http://localhost:3001
```

## 🔐 Security Notes

1. **Namespaces are isolated** - Each environment has its own namespace
2. **Credentials** - Update RabbitMQ default credentials in production
3. **Network Policies** - Consider adding NetworkPolicies for stricter isolation
4. **RBAC** - Configure proper RBAC for production access

## 📝 Git Workflow

```bash
# Make changes to manifests
vim manifests/prod-manifests/prod-api/api-deployment.yaml

# Commit and push
git add .
git commit -m "Update API deployment"
git push

# ArgoCD will auto-sync within ~3 minutes
# Or manually sync via UI/CLI
```

## 🚨 Troubleshooting

### Application Not Syncing
```bash
# Check application status
kubectl describe application async-micro-production -n argocd

# Check sync errors
kubectl argocd app get async-micro-production -n argocd
```

### Pods Not Starting
```bash
# Check pod logs
kubectl logs -n production <pod-name>

# Check events
kubectl get events -n production --sort-by='.lastTimestamp'
```

### Delete and Redeploy
```bash
# Delete root app (cascades to all children)
kubectl delete application async-micro-root -n argocd

# Reapply
kubectl apply -f /root/async-micro/argocd/application.yaml
```

## 🎓 Best Practices

1. **Always commit to Git first** - ArgoCD deploys from Git, not local changes
2. **Use branches** - Create feature branches for testing before merging to main
3. **Monitor sync status** - Keep an eye on ArgoCD dashboard
4. **Test in staging first** - Always validate changes in staging before production
5. **Use proper image tags** - Avoid using `latest` tag in production

---

**Happy Deploying! 🚀**

