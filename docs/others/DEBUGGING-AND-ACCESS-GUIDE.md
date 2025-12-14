# Service Debugging and Access Guide

A simple guide to debug, access, and expose services in the async-micro Kubernetes cluster.

---

## Table of Contents
1. [Quick Service Access](#quick-service-access)
2. [Debugging Services](#debugging-services)
3. [Exposing Services with NodePort](#exposing-services-with-nodeport)
4. [Currently Accessible NodePorts](#currently-accessible-nodeports)
5. [Common Troubleshooting](#common-troubleshooting)

---

## Quick Service Access

### Check All Services
```bash
# List all services with their types
kubectl get svc -A

# Check services in default namespace
kubectl get svc

# Check services in logging,staging,production namespace
kubectl get svc -n logging
kubectl get svc -n staging
kubectl get svc -n production

```

### Check All Pods Status
```bash
# All pods in default namespace
kubectl get pods

# All pods with more details
kubectl get pods -o wide

# Watch pods in real-time
kubectl get pods -w

# All pods in all namespaces
kubectl get pods -A
```

---

## Debugging Services

### 1. Check Pod Logs
```bash
# View logs of a specific pod
kubectl logs <pod-name>

# View logs of the last 50 lines
kubectl logs <pod-name> --tail=50

# Follow logs in real-time
kubectl logs <pod-name> -f

# View logs from previous crashed pod
kubectl logs <pod-name> --previous

# Example: View backend API logs
kubectl logs -l app=api --tail=50

# Example: View worker logs
kubectl logs -l app=worker -f
```

### 2. Check Pod Details
```bash
# Describe pod (shows events, errors, restarts)
kubectl describe pod <pod-name>

# Check pod events
kubectl get events --sort-by=.metadata.creationTimestamp

# Example: Describe API pod
kubectl describe pod -l app=api
```

### 3. Access Pod Shell
```bash
# Execute bash in a pod
kubectl exec -it <pod-name> -- /bin/bash

# Execute sh (if bash not available)
kubectl exec -it <pod-name> -- /bin/sh

# Run a command in pod
kubectl exec <pod-name> -- curl http://localhost:8000/health

# Example: Check API pod
kubectl exec -it $(kubectl get pod -l app=api -o jsonpath='{.items[0].metadata.name}') -- /bin/bash
```

### 4. Check Service Endpoints
```bash
# Check if service has endpoints
kubectl get endpoints

# Describe specific service
kubectl describe svc <service-name>

# Example: Check API service endpoints
kubectl describe svc api-service
```

### 5. Test Service Connectivity
```bash
# Port forward to test locally
kubectl port-forward svc/<service-name> <local-port>:<service-port>

# Example: Forward API service to localhost:8080
kubectl port-forward svc/api-service 8080:8000

# Then test in another terminal:
curl http://localhost:8080/health
```

### 6. Check Resource Usage
```bash
# Check pod resource usage (requires metrics-server)
kubectl top pods

# Check node resource usage
kubectl top nodes

# Check pod resource limits
kubectl describe pod <pod-name> | grep -A 5 Limits
```

---

## Exposing Services with NodePort

### What is NodePort?
NodePort exposes a service on a static port (30000-32767) on **each node's IP**, making it accessible from outside the cluster.

### Current Service Types in Your Setup

| Service | Namespace | Current Type | Port(s) |
|---------|-----------|--------------|---------|
| api-service | default | **NodePort** | 8000 → 30080 (staging) |
| gateway-service | default | **NodePort** | 3000 → 30000 (staging) |
| product-service | default | ClusterIP | 8001 |
| rabbitmq | default | ClusterIP | 5672, 15672 |
| grafana | logging | **NodePort** | 3000 → 30030 |
| loki | logging | ClusterIP | 3100 |

### How to Convert ClusterIP to NodePort

#### Option 1: Edit Existing Service (Recommended)
```bash
# Edit service
kubectl edit svc <service-name>

# Change:
spec:
  type: ClusterIP
  
# To:
spec:
  type: NodePort
  
# Save and exit (:wq in vim)
```

#### Option 2: Apply New YAML File
Create a new service file or update existing:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: <service-name>
spec:
  type: NodePort
  selector:
    app: <app-label>
  ports:
  - port: <service-port>
    targetPort: <container-port>
    nodePort: <optional-specific-port>  # 30000-32767, or omit for auto-assign
```

Apply the changes:
```bash
kubectl apply -f <service-file>.yaml
```

#### Option 3: Patch Existing Service
```bash
# Quick patch to change type
kubectl patch svc <service-name> -p '{"spec":{"type":"NodePort"}}'

# Example: Convert product-service to NodePort
kubectl patch svc product-service -p '{"spec":{"type":"NodePort"}}'
```

### Examples: Exposing Services

#### Example 1: Expose Product Service
```bash
# Create NodePort service for product
kubectl patch svc product-service -p '{"spec":{"type":"NodePort"}}'

# Check assigned NodePort
kubectl get svc product-service

# Access the service
curl http://<node-ip>:<nodePort>/products
```

#### Example 2: Expose RabbitMQ Management UI
```bash
# Edit rabbitmq service
kubectl edit svc rabbitmq

# Add NodePort for management port:
# Change this:
spec:
  type: ClusterIP
  ports:
  - port: 5672
    targetPort: 5672
    name: amqp
  - port: 15672
    targetPort: 15672
    name: management

# To this:
spec:
  type: NodePort
  ports:
  - port: 5672
    targetPort: 5672
    name: amqp
  - port: 15672
    targetPort: 15672
    name: management
    nodePort: 30672  # Optional: specify port

# Save and access at: http://<node-ip>:30672
```

### Get Node IP Address
```bash
# Get node IP (for Kind cluster, use localhost)
kubectl get nodes -o wide

# For Kind cluster specifically
docker ps | grep kind

# For production, use actual node IP
kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}'
```

---

## Currently Accessible NodePorts

Based on your current setup:

### Staging Environment

| Service | Internal Port | NodePort | URL (Kind) | Description |
|---------|---------------|----------|------------|-------------|
| **gateway-service** | 3000 | 30000 | http://localhost:30000 | API Gateway |
| **api-service** | 8000 | 30080 | http://localhost:30080 | Backend API |
| **grafana** | 3000 | 30030 | http://localhost:30030 | Grafana UI (logging namespace) |

### Production Environment

| Service | Internal Port | NodePort | URL (Kind) | Description |
|---------|---------------|----------|------------|-------------|
| **gateway-service** | 3000 | Auto-assigned | Check with `kubectl get svc` | API Gateway |
| **api-service** | 8000 | Auto-assigned | Check with `kubectl get svc` | Backend API |

### Services NOT Currently Exposed (ClusterIP)

| Service | Port | How to Access |
|---------|------|---------------|
| **product-service** | 8001 | Port-forward: `kubectl port-forward svc/product-service 8001:8001` |
| **rabbitmq (AMQP)** | 5672 | Internal only or port-forward |
| **rabbitmq (UI)** | 15672 | Port-forward: `kubectl port-forward svc/rabbitmq 15672:15672` |
| **loki** | 3100 | Port-forward: `kubectl port-forward svc/loki -n logging 3100:3100` |

### Test Accessible Services
```bash
# Test Gateway (staging)
curl http://localhost:30000/health

# Test Backend API (staging)
curl http://localhost:30080/health

# Create a task via NodePort
curl -X POST http://localhost:30080/task \
  -H "Content-Type: application/json" \
  -d '{"task_type":"test","id":"123","message":"Hello"}'

# Access Grafana UI
# Open browser: http://localhost:30030
# Login: admin / admin

# Check all NodePorts
kubectl get svc -A | grep NodePort
```

---

## Common Troubleshooting

### Issue 1: NodePort Not Accessible
```bash
# Check if service has endpoints
kubectl get endpoints <service-name>

# Check if pods are running
kubectl get pods -l app=<app-label>

# Check service details
kubectl describe svc <service-name>

# For Kind cluster, ensure port mapping was created
docker ps | grep kind
```

### Issue 2: Pod Not Ready
```bash
# Check pod status
kubectl describe pod <pod-name>

# Check logs
kubectl logs <pod-name>

# Check events
kubectl get events --sort-by=.metadata.creationTimestamp | grep <pod-name>
```

### Issue 3: Service Can't Connect to Backend
```bash
# Check if service selector matches pod labels
kubectl get pods --show-labels
kubectl describe svc <service-name> | grep Selector

# Test connectivity from within cluster
kubectl run test-pod --image=curlimages/curl -it --rm -- /bin/sh
# Then inside pod:
curl http://<service-name>:<port>/health
```

### Issue 4: "Connection Refused"
```bash
# Check if container is listening on correct port
kubectl exec <pod-name> -- netstat -tulpn

# Or use ss
kubectl exec <pod-name> -- ss -tulpn

# Check container port in deployment
kubectl get deployment <deployment-name> -o yaml | grep containerPort
```

### Issue 5: CrashLoopBackOff
```bash
# Check logs from crashed pod
kubectl logs <pod-name> --previous

# Check pod events
kubectl describe pod <pod-name>

# Common causes:
# - Missing environment variables
# - Can't connect to dependencies (e.g., RabbitMQ)
# - Incorrect configuration
```

### Issue 6: Find What's Using a NodePort
```bash
# List all services with NodePort
kubectl get svc -A -o wide | grep NodePort

# Check specific NodePort
kubectl get svc -A -o json | jq '.items[] | select(.spec.ports[]?.nodePort==30000)'
```

---

## Quick Reference Commands

### Debug Checklist
```bash
# 1. Check pod status
kubectl get pods

# 2. Check service endpoints
kubectl get svc
kubectl get endpoints

# 3. View logs
kubectl logs -l app=<app-name> --tail=50

# 4. Describe problematic pod
kubectl describe pod <pod-name>

# 5. Check recent events
kubectl get events --sort-by=.metadata.creationTimestamp | tail -20

# 6. Test connectivity
kubectl port-forward svc/<service-name> <local-port>:<service-port>
```

### Expose Service Checklist
```bash
# 1. Verify service exists
kubectl get svc <service-name>

# 2. Convert to NodePort
kubectl patch svc <service-name> -p '{"spec":{"type":"NodePort"}}'

# 3. Get assigned NodePort
kubectl get svc <service-name>

# 4. Test access (for Kind cluster)
curl http://localhost:<nodePort>

# 5. If not working, check pod
kubectl get pods -l app=<app-label>
kubectl logs -l app=<app-label>
```

---

## Additional Tips

### For Kind Cluster Users
Kind cluster maps NodePorts to localhost automatically. If NodePort doesn't work:

```bash
# Check Kind cluster configuration
kind get clusters

# If needed, recreate cluster with port mappings
kind delete cluster --name microservices-prod

# Create with explicit port mappings
cat <<EOF | kind create cluster --name microservices-prod --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
- role: control-plane
  extraPortMappings:
  - containerPort: 30000
    hostPort: 30000
  - containerPort: 30030
    hostPort: 30030
  - containerPort: 30080
    hostPort: 30080
EOF
```

### For Production Clusters
Use actual node IP addresses:
```bash
# Get external node IP
kubectl get nodes -o wide

# Access service at: http://<node-external-ip>:<nodePort>
```

### Security Note
NodePort exposes services on ALL cluster nodes. For production:
- Use LoadBalancer or Ingress instead
- Configure firewall rules
- Use authentication/authorization
- Consider using a service mesh

---

## Summary

| Task | Command |
|------|---------|
| List services | `kubectl get svc -A` |
| Check pods | `kubectl get pods` |
| View logs | `kubectl logs <pod-name> -f` |
| Describe pod | `kubectl describe pod <pod-name>` |
| Shell into pod | `kubectl exec -it <pod-name> -- /bin/bash` |
| Port forward | `kubectl port-forward svc/<name> <local>:<remote>` |
| Expose as NodePort | `kubectl patch svc <name> -p '{"spec":{"type":"NodePort"}}'` |
| Get NodePort number | `kubectl get svc <name>` |
| Test NodePort (Kind) | `curl http://localhost:<nodePort>` |

---

**Need Help?** Check the main [README.md](README.md) for architecture details and deployment instructions.

