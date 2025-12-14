1. What is "Argo CD uses a self-signed SSL certificate by default"?

This is safe for local development/testing. The self-signed certificate encrypts traffic but isn't verified by a Certificate Authority. Since you're running Kind locally, kubectl port-forward maps the Argo CD service to your localhost. On an actual VM deployment, you'd use the VM's IP address with the NodePort.

2. Why does ArgoCD UI show nothing / not load?

The ArgoCD namespace or application may have been deleted or stuck in terminating state. To fix:

```bash
# Check if argocd namespace exists and its status
kubectl get namespace argocd

# If stuck in Terminating, remove the finalizer from the application
kubectl patch application <app-name> -n argocd -p '{"metadata":{"finalizers":null}}' --type=merge

# Reinstall ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s

# Apply your application
kubectl apply -f argocd/application.yaml

# Port-forward to access UI
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Access at: https://localhost:8080 (accept the self-signed certificate warning)

Get admin password:
```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
```

3. Why is the application showing "Degraded" with ImagePullBackOff?

The Kubernetes deployment is trying to pull a Docker image that doesn't exist or has incorrect name. Check:

```bash
# See which image is failing
kubectl get pods
kubectl describe pod <pod-name> | grep -A5 "Events"

# Check the deployment image
kubectl get deployment <deployment-name> -o jsonpath='{.spec.template.spec.containers[0].image}'
```

Fix: Ensure the image name in your manifest matches exactly what's on Docker Hub. In our case, the gateway deployment had `Ridwan414/gateway-service:v1` but the correct image was `asifmahmoud414/gateway-service:v1`.

After fixing the manifest, push to GitHub and ArgoCD will auto-sync:
```bash
git add manifests/
git commit -m "fix: correct image name"
git push
```

4. How to access ArgoCD UI?

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

Or create a dedicated NodePort service:
```yaml
# argocd/argocd-nodeport.yaml
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

Apply with:
```bash
kubectl apply -f argocd/argocd-nodeport.yaml
```

5.