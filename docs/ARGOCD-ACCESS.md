# ArgoCD Access Information

## 🔐 Login Credentials

**Username:** `admin`

**Password:** Get from Kubernetes secret:

```bash
# Linux/Mac
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Windows PowerShell
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }
```

**Current Password:** `DJR0wj2aMlaufRcz` (as of last deployment)

> **Note:** The password is auto-generated during ArgoCD installation. Use the commands above to retrieve the current password if it has changed.

---

## 🌐 Access URLs

### NodePort Access (Recommended for Remote/Production)

**HTTP (Recommended):**
```
http://103.191.50.49:30588
http://localhost:30588
```

**HTTPS Port (use HTTP protocol):**
```
http://103.191.50.49:31308
http://localhost:31308
```

> **Important:** Use `http://` (not `https://`) because insecure mode is enabled for easier local development.

### Port Forward Access (Local Development Only)

```bash
# Start port-forward
kubectl port-forward svc/argocd-server -n argocd 8080:80

# Access at:
http://localhost:8080
```

**Windows PowerShell:**
```powershell
# Start port-forward in background
$job = Start-Job -ScriptBlock { kubectl port-forward -n argocd svc/argocd-server 8888:80 }
Start-Sleep -Seconds 3

# Access at:
http://localhost:8888
```

---

## 📋 Deployed Applications

Once logged in, you'll see:

1. **async-micro-root** - Parent "App of Apps" managing all child applications
2. **async-micro-production** - Production microservices (namespace: production)
3. **async-micro-staging** - Staging microservices (namespace: staging)
4. **async-micro-monitoring** - Monitoring stack (namespace: monitoring)

---

## 🔧 Troubleshooting

### Cannot Access via NodePort

**Problem:** `http://103.191.50.49:30588` not accessible

**Solution:** Ensure Kind cluster was created with port mappings:

```bash
# Check if ports are mapped
docker port microservices-prod-control-plane

# Should show:
# 30588/tcp -> 0.0.0.0:30588
# 31308/tcp -> 0.0.0.0:31308

# If not, recreate cluster with config:
kind delete cluster --name microservices-prod
kind create cluster --config kind-config.yaml
```

### Invalid Username or Password

**Problem:** Login fails with "Invalid username or password"

**Solutions:**

1. **Use HTTP, not HTTPS:**
   - ✅ Correct: `http://103.191.50.49:30588`
   - ❌ Wrong: `https://103.191.50.49:30588`

2. **Get the current password:**
   ```bash
   kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
   ```

3. **Clear browser cache** or use incognito/private mode

4. **Wait for ArgoCD server to be ready:**
   ```bash
   kubectl wait --for=condition=Ready pod -l app.kubernetes.io/name=argocd-server -n argocd --timeout=60s
   ```

### Change Admin Password

```bash
# Login to ArgoCD CLI
argocd login <server-address>

# Update password
argocd account update-password
```

---

## 📚 Additional Resources

- [Full Deployment Guide](argocd/DEPLOYMENT-GUIDE.md)
- [Main README](README.md)
- [ArgoCD Official Docs](https://argo-cd.readthedocs.io/)

