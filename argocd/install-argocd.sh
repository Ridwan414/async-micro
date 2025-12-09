#!/bin/bash

# Install Argo CD on Kubernetes cluster
echo "Installing Argo CD..."

# Create namespace
kubectl create namespace argocd

# Install Argo CD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for Argo CD to be ready
echo "Waiting for Argo CD pods to be ready..."
kubectl wait --for=condition=Ready pods --all -n argocd --timeout=300s

# Get initial admin password
echo ""
echo "=== Argo CD Installation Complete ==="
echo ""
echo "Initial admin password:"
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d
echo ""
echo ""
echo "To access Argo CD UI, run:"
echo "  kubectl port-forward svc/argocd-server -n argocd 8080:443"
echo ""
echo "Then open: https://localhost:8080"
echo "Username: admin"
echo ""

# Apply the application
echo "Applying the async-microservices application..."
kubectl apply -f argocd/application.yaml
