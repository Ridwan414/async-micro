# Kubernetes Autoscaling Guide

This document provides comprehensive guidance for implementing autoscaling in the async-micro application on a single VM Kubernetes cluster.

## Table of Contents

1. [Overview](#overview)
2. [Scaling Fundamentals](#scaling-fundamentals)
   - [What is Scaling?](#what-is-scaling)
   - [Types of Scaling](#types-of-scaling)
   - [Horizontal vs Vertical Scaling](#horizontal-vs-vertical-scaling-comparison)
   - [When to Use Each Scaling Type](#when-to-use-each-scaling-type)
   - [Hybrid Scaling Strategies](#hybrid-scaling-strategies)
3. [Kubernetes Autoscaling Types](#kubernetes-autoscaling-types)
   - [HPA (Horizontal Pod Autoscaler)](#horizontal-pod-autoscaler-hpa)
   - [VPA (Vertical Pod Autoscaler)](#vertical-pod-autoscaler-vpa)
   - [Cluster Autoscaler](#cluster-autoscaler)
   - [Choosing the Right Autoscaler](#choosing-the-right-autoscaler)
4. [Why HPA for This Project?](#why-hpa-for-this-project)
   - [Project Context Analysis](#project-context-analysis)
   - [Decision Matrix](#decision-matrix-why-hpa-wins)
   - [Detailed Reasoning](#detailed-reasoning)
   - [When VPA Would Be Better](#when-vpa-would-be-better)
   - [When Cluster Autoscaler Would Be Better](#when-cluster-autoscaler-would-be-better)
5. [Prerequisites](#prerequisites)
6. [Architecture](#architecture)
7. [Installation](#installation)
8. [Configuration](#configuration)
9. [Scaling Strategies](#scaling-strategies)
10. [Monitoring](#monitoring)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)
    - [Testing Autoscaling](#5-testing-autoscaling)
    - [Verified Test Results](#verified-test-results)
    - [Understanding Test Results in Detail](#understanding-the-test-results-in-detail)
13. [Quick Reference](#quick-reference)
    - [Kind Cluster Setup](#kind-cluster-setup)
14. [Monitoring with ArgoCD](#monitoring-with-argocd)
    - [Accessing ArgoCD UI](#accessing-argocd-ui)
    - [Viewing HPA in ArgoCD](#viewing-hpa-in-argocd)
    - [ArgoCD CLI Commands](#argocd-cli-commands)

---

## Overview

### What is Autoscaling?

Autoscaling automatically adjusts the number of running pods based on observed metrics like CPU utilization, memory usage, or custom metrics. This ensures your application can handle varying loads while optimizing resource usage.

---

## Scaling Fundamentals

### What is Scaling?

Scaling is the process of adjusting computing resources to meet varying workload demands. It ensures applications maintain performance during traffic spikes while optimizing costs during low-demand periods.

**Key Objectives of Scaling:**
- **Availability**: Ensure the application remains accessible under varying loads
- **Performance**: Maintain acceptable response times and throughput
- **Cost Efficiency**: Use only the resources needed at any given time
- **Fault Tolerance**: Distribute workload to prevent single points of failure

### Types of Scaling

There are two fundamental approaches to scaling: **Horizontal** and **Vertical**.

#### Horizontal Scaling (Scaling Out/In)

Horizontal scaling involves adding or removing instances (pods, containers, VMs) of an application.

```
Before Scaling:          After Scaling Out:
┌─────────┐             ┌─────────┐ ┌─────────┐ ┌─────────┐
│  App    │     →       │  App    │ │  App    │ │  App    │
│ Instance│             │Instance1│ │Instance2│ │Instance3│
└─────────┘             └─────────┘ └─────────┘ └─────────┘
     ↓                        ↓          ↓          ↓
┌─────────┐             ┌─────────────────────────────────┐
│  Load   │             │         Load Balancer           │
└─────────┘             └─────────────────────────────────┘
```

**Characteristics:**
| Aspect | Description |
|--------|-------------|
| **Mechanism** | Add/remove identical instances |
| **Downtime** | Zero downtime (instances added alongside existing ones) |
| **Fault Tolerance** | High (failure of one instance doesn't affect others) |
| **Complexity** | Requires load balancing and stateless design |
| **Cost Model** | Linear (pay per instance) |
| **Upper Limit** | Theoretically unlimited |

**Best Suited For:**
- Stateless applications (REST APIs, web servers)
- Microservices architectures
- Read-heavy workloads
- Applications with unpredictable traffic patterns

**Challenges:**
- Requires stateless application design or external state management
- Session management complexity (sticky sessions or distributed sessions)
- Data consistency across instances
- Increased operational complexity

#### Vertical Scaling (Scaling Up/Down)

Vertical scaling involves increasing or decreasing the resources (CPU, RAM, storage) of an existing instance.

```
Before Scaling:          After Scaling Up:
┌─────────────┐         ┌─────────────────────┐
│    App      │         │         App         │
│  2 CPU      │    →    │       8 CPU         │
│  4GB RAM    │         │      32GB RAM       │
└─────────────┘         └─────────────────────┘
```

**Characteristics:**
| Aspect | Description |
|--------|-------------|
| **Mechanism** | Increase/decrease resources of single instance |
| **Downtime** | Usually requires restart (except for hot-add in some systems) |
| **Fault Tolerance** | Low (single point of failure) |
| **Complexity** | Simple (no load balancing needed) |
| **Cost Model** | Non-linear (larger instances cost more per unit) |
| **Upper Limit** | Hardware limits of largest available instance |

**Best Suited For:**
- Stateful applications (databases, legacy systems)
- Applications with vertical performance requirements (large in-memory processing)
- Workloads that are difficult to distribute
- Quick fixes for capacity issues

**Challenges:**
- Physical hardware limits
- Usually requires downtime for changes
- Single point of failure
- Diminishing returns at higher resource levels

### Horizontal vs Vertical Scaling: Comparison

| Criteria | Horizontal Scaling | Vertical Scaling |
|----------|-------------------|------------------|
| **Scalability** | Nearly unlimited | Limited by hardware |
| **Downtime** | None | Usually required |
| **Fault Tolerance** | High (redundant instances) | Low (single instance) |
| **Cost at Scale** | More efficient | Expensive (premium for large instances) |
| **Complexity** | Higher (distributed systems) | Lower (single system) |
| **Data Consistency** | Challenging (eventual consistency) | Simple (single source) |
| **State Management** | Requires external state | State can be local |
| **Recovery Time** | Fast (other instances available) | Slow (full restart needed) |

### When to Use Each Scaling Type

```
                    ┌─────────────────────────────────────┐
                    │        Scaling Decision Tree        │
                    └─────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
            Is application                    Is application
              stateless?                        stateful?
                    │                                 │
         ┌────────┴────────┐               ┌────────┴────────┐
         ▼                  ▼               ▼                  ▼
       Yes                 No            Database          Legacy App
         │                  │               │                  │
         ▼                  ▼               ▼                  ▼
   ┌──────────┐      Can it be       Consider           ┌──────────┐
   │Horizontal│      refactored?     read replicas      │ Vertical │
   │ Scaling  │           │          + write primary    │ Scaling  │
   └──────────┘     ┌─────┴─────┐         │             └──────────┘
                    ▼           ▼         ▼
                   Yes         No    Horizontal for
                    │           │    reads, Vertical
                    ▼           ▼    for writes
              Refactor to  ┌──────────┐
              stateless    │ Vertical │
                    │      │ Scaling  │
                    ▼      └──────────┘
              ┌──────────┐
              │Horizontal│
              │ Scaling  │
              └──────────┘
```

### Hybrid Scaling Strategies

In practice, most production systems use a combination of both approaches:

**1. Diagonal Scaling**
Start with vertical scaling for quick wins, then switch to horizontal scaling for long-term growth.

```
Phase 1 (Quick Fix):     Phase 2 (Scale Out):
┌───────────────┐        ┌─────────┐ ┌─────────┐ ┌─────────┐
│   Larger      │   →    │ Medium  │ │ Medium  │ │ Medium  │
│   Instance    │        │Instance1│ │Instance2│ │Instance3│
└───────────────┘        └─────────┘ └─────────┘ └─────────┘
```

**2. Tiered Scaling**
Different scaling strategies for different components:

| Component | Scaling Strategy | Rationale |
|-----------|-----------------|-----------|
| Web Servers | Horizontal | Stateless, easy to replicate |
| Application Servers | Horizontal | Stateless with external session store |
| Cache (Redis) | Horizontal (Cluster) | Read distribution |
| Database Primary | Vertical | Write consistency |
| Database Replicas | Horizontal | Read distribution |

**3. Auto-Scaling with Limits**
Combine automated horizontal scaling with vertical resource optimization:

```yaml
# Example: HPA with VPA recommendations
HPA: Scale pods 2-10 based on CPU
VPA: Recommend optimal CPU/memory per pod
Result: Right-sized pods that scale horizontally
```

---

## Kubernetes Autoscaling Types

Kubernetes provides three main autoscaling mechanisms:

### Types of Autoscaling

| Type | Description | Use Case |
|------|-------------|----------|
| **HPA** (Horizontal Pod Autoscaler) | Scales the number of pod replicas | Stateless workloads |
| **VPA** (Vertical Pod Autoscaler) | Adjusts CPU/memory requests | Right-sizing containers |
| **Cluster Autoscaler** | Adds/removes nodes | Multi-node clusters |

### Horizontal Pod Autoscaler (HPA)

HPA automatically scales the number of pod replicas based on observed metrics.

**How HPA Works:**
```
┌──────────────┐     Metrics      ┌──────────────┐
│   Metrics    │ ───────────────▶ │     HPA      │
│   Server     │                  │  Controller  │
└──────────────┘                  └──────┬───────┘
       ▲                                 │
       │ Collect                         │ Scale
       │ metrics                         ▼
┌──────┴───────┐                  ┌──────────────┐
│    Pods      │ ◀─────────────── │  Deployment  │
│  (replicas)  │    Adjust count  │              │
└──────────────┘                  └──────────────┘
```

**Scaling Algorithm:**
```
desiredReplicas = ceil[currentReplicas × (currentMetricValue / desiredMetricValue)]
```

Example: If current CPU = 80%, target = 50%, and replicas = 2:
```
desiredReplicas = ceil[2 × (80/50)] = ceil[3.2] = 4
```

**Pros:**
- Zero downtime scaling
- Works with any stateless workload
- Supports multiple metrics (CPU, memory, custom)
- Native Kubernetes resource

**Cons:**
- Requires stateless applications
- Cold start latency for new pods
- Reactive (scales after load increases)

### Vertical Pod Autoscaler (VPA)

VPA automatically adjusts CPU and memory requests/limits for containers.

**How VPA Works:**
```
┌──────────────┐     Resource      ┌──────────────┐
│   Metrics    │    Utilization    │     VPA      │
│   History    │ ───────────────▶  │  Recommender │
└──────────────┘                   └──────┬───────┘
                                          │
                                          │ Recommendations
                                          ▼
                                   ┌──────────────┐
                                   │   Updater    │
                                   │  (optional)  │
                                   └──────┬───────┘
                                          │ Evict & recreate
                                          ▼
                                   ┌──────────────┐
                                   │    Pods      │
                                   │ (new limits) │
                                   └──────────────┘
```

**VPA Modes:**
| Mode | Behavior |
|------|----------|
| **Off** | Only provides recommendations, no action |
| **Initial** | Applies recommendations only at pod creation |
| **Auto** | Updates running pods (may cause restarts) |

**Pros:**
- Optimal resource utilization
- Reduces over-provisioning waste
- Helps with initial resource estimation

**Cons:**
- Pod restarts when updating resources
- Cannot be used with HPA on same metrics
- Slower to react than HPA

### Cluster Autoscaler

Cluster Autoscaler adjusts the number of nodes in a cluster.

**How Cluster Autoscaler Works:**
```
┌─────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     ┌─────────┐   │
│  │  Node1  │ │  Node2  │ │  Node3  │ ... │ NodeN   │   │
│  │ ██████  │ │ ██████  │ │ ██████  │     │ (new)   │   │
│  │ (full)  │ │ (full)  │ │ (full)  │     │         │   │
│  └─────────┘ └─────────┘ └─────────┘     └─────────┘   │
│       ▲                                        ▲        │
│       │         Cluster Autoscaler             │        │
│       └────────────────┬───────────────────────┘        │
│                        │                                 │
│              ┌─────────▼─────────┐                      │
│              │ Pending Pods?     │                      │
│              │ Underutilized?    │                      │
│              └───────────────────┘                      │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Cloud Provider    │
              │   (Add/Remove VMs)  │
              └─────────────────────┘
```

**Scale Up Trigger:** Pods are pending due to insufficient resources
**Scale Down Trigger:** Node utilization below threshold for extended period

**Pros:**
- Handles cluster-level resource constraints
- Works with cloud provider APIs
- Complements HPA and VPA

**Cons:**
- Only for multi-node cloud clusters
- Slower than pod scaling (minutes)
- Not applicable to single VM setups

### Choosing the Right Autoscaler

| Scenario | Recommended Autoscaler |
|----------|----------------------|
| Stateless web application with variable traffic | HPA |
| Long-running batch jobs with unknown resource needs | VPA |
| Multi-node cloud cluster with HPA workloads | HPA + Cluster Autoscaler |
| Single VM/node deployment | HPA only |
| Mixed workloads (stateless + stateful) | HPA for stateless, VPA for stateful |
| Initial deployment (unknown resource requirements) | VPA in "Off" mode for recommendations |

### HPA vs VPA vs Cluster Autoscaler

| Feature | HPA | VPA | Cluster Autoscaler |
|---------|-----|-----|-------------------|
| **Scales** | Pod count | Pod resources | Node count |
| **Direction** | Horizontal | Vertical | Horizontal (nodes) |
| **Latency** | Seconds | Minutes (restart) | Minutes |
| **Downtime** | None | Pod restart | None |
| **Metrics** | CPU, memory, custom | CPU, memory | Pending pods |
| **Best For** | Stateless apps | Right-sizing | Cloud clusters |
| **Single VM** | Yes | Yes | No |

This guide focuses on **HPA** as it's the most suitable for single VM deployments.

---

## Why HPA for This Project?

This section explains in detail why **Horizontal Pod Autoscaler (HPA)** was chosen over VPA and Cluster Autoscaler for the async-micro application.

### Project Context Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ASYNC-MICRO PROJECT CONTEXT                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Deployment Environment: Single VM (Minikube/K3s/MicroK8s)              │
│  Application Type: Microservices (Gateway, API, Worker, Product)        │
│  State Management: Stateless services + External state (RabbitMQ)       │
│  Traffic Pattern: Variable, unpredictable user requests                 │
│  Priority: Zero downtime, fast response to load changes                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │  Best Fit: HPA (Horizontal    │
                    │       Pod Autoscaler)         │
                    └───────────────────────────────┘
```

### Decision Matrix: Why HPA Wins

| Evaluation Criteria | HPA | VPA | Cluster Autoscaler | Winner |
|---------------------|-----|-----|-------------------|--------|
| **Single VM Compatible** | Yes | Yes | No (requires cloud) | HPA/VPA |
| **Zero Downtime Scaling** | Yes | No (pod restart) | Yes | HPA |
| **Scaling Speed** | Seconds | Minutes | Minutes | HPA |
| **Stateless Workloads** | Excellent | Good | N/A | HPA |
| **Native K8s Support** | Built-in | Requires install | Requires cloud | HPA |
| **Operational Complexity** | Low | Medium | High | HPA |
| **Resource Efficiency** | Good | Excellent | Good | VPA |

**Final Score: HPA wins 5/7 categories**

### Detailed Reasoning

#### 1. Single VM Deployment Constraint

The async-micro project runs on a **single VM** using lightweight Kubernetes distributions:

```
┌─────────────────────────────────────────────────────────────┐
│                      SINGLE VM                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Kubernetes (K3s/Minikube)               │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │    │
│  │  │ Gateway │ │   API   │ │ Worker  │ │ Product │    │    │
│  │  │  Pods   │ │  Pods   │ │  Pods   │ │  Pods   │    │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ❌ Cluster Autoscaler: CANNOT add more VMs                  │
│  ✅ HPA: CAN add more pods within VM resources               │
│  ✅ VPA: CAN adjust pod resources (but requires restarts)    │
└─────────────────────────────────────────────────────────────┘
```

**Cluster Autoscaler is eliminated** because:
- Requires cloud provider API (AWS, GCP, Azure) to provision new nodes
- Cannot create additional VMs in a single-VM setup
- Designed for multi-node production clusters

#### 2. Stateless Application Architecture

All services in async-micro are designed to be **stateless**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                    APPLICATION STATE ANALYSIS                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  STATELESS SERVICES (Perfect for HPA):                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │
│  │   Gateway   │ │     API     │ │   Worker    │ │   Product   │    │
│  │             │ │             │ │             │ │             │    │
│  │ • No local  │ │ • No local  │ │ • No local  │ │ • No local  │    │
│  │   state     │ │   state     │ │   state     │ │   state     │    │
│  │ • Any pod   │ │ • Any pod   │ │ • Any pod   │ │ • Any pod   │    │
│  │   can serve │ │   can serve │ │   can serve │ │   can serve │    │
│  │   request   │ │   request   │ │   any job   │ │   request   │    │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘    │
│        ✅              ✅              ✅              ✅             │
│       HPA             HPA             HPA             HPA            │
│                                                                       │
│  STATEFUL SERVICE (NOT suitable for HPA):                            │
│  ┌─────────────┐                                                     │
│  │  RabbitMQ   │  • Persistent message queue                         │
│  │             │  • Requires clustering for HA                       │
│  │ StatefulSet │  • Uses PersistentVolumeClaim                       │
│  └─────────────┘                                                     │
│        ❌                                                             │
│   No autoscaling (kept at 1 replica)                                 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Why stateless = HPA:**
- Pods are interchangeable - any pod can handle any request
- No session affinity required
- Load balancer can distribute evenly
- New pods are immediately useful after startup

**Why RabbitMQ is excluded:**
- Message broker requires persistent storage
- Scaling requires proper clustering configuration
- Data consistency must be maintained

#### 3. Zero Downtime Requirement

Production applications cannot afford downtime during scaling operations:

```
                        HPA Scaling (Zero Downtime)
┌─────────────────────────────────────────────────────────────────────┐
│  Time: T0 (2 pods)         Time: T1 (scaling)       Time: T2 (4 pods) │
│                                                                       │
│  ┌─────┐ ┌─────┐          ┌─────┐ ┌─────┐          ┌─────┐ ┌─────┐  │
│  │Pod 1│ │Pod 2│    →     │Pod 1│ │Pod 2│    →     │Pod 1│ │Pod 2│  │
│  │ ✅  │ │ ✅  │          │ ✅  │ │ ✅  │          │ ✅  │ │ ✅  │  │
│  └─────┘ └─────┘          └─────┘ └─────┘          └─────┘ └─────┘  │
│                           ┌─────┐ ┌─────┐          ┌─────┐ ┌─────┐  │
│                           │Pod 3│ │Pod 4│          │Pod 3│ │Pod 4│  │
│                           │ 🔄  │ │ 🔄  │          │ ✅  │ │ ✅  │  │
│                           └─────┘ └─────┘          └─────┘ └─────┘  │
│                                                                       │
│  Existing pods continue serving traffic while new pods start          │
│  Result: ✅ ZERO DOWNTIME                                             │
└─────────────────────────────────────────────────────────────────────┘

                        VPA Scaling (Causes Downtime)
┌─────────────────────────────────────────────────────────────────────┐
│  Time: T0 (100m CPU)       Time: T1 (eviction)      Time: T2 (200m CPU) │
│                                                                       │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐   │
│  │   Pod 1     │    →     │   Pod 1     │    →     │   Pod 1     │   │
│  │  100m CPU   │          │ ❌ EVICTED  │          │  200m CPU   │   │
│  │     ✅      │          │  RESTARTING │          │     ✅      │   │
│  └─────────────┘          └─────────────┘          └─────────────┘   │
│                                                                       │
│  Pod must be terminated and recreated with new resource limits        │
│  Result: ❌ DOWNTIME during restart                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**VPA causes downtime because:**
- Cannot change resource limits of a running container
- Must evict (terminate) the pod
- Creates new pod with updated limits
- Service disruption during pod restart (30s - 2min typically)

#### 4. Response Time to Load Changes

When traffic spikes, fast scaling is critical:

```
                    Scaling Response Time Comparison

Traffic Spike ─────────────────────────────────────────────────────▶
     │
     │   ┌─────────────────────────────────────────────────────────┐
     │   │                                                         │
     ▼   │  HPA Response                                          │
         │  ├── Metrics detected: 0s                               │
    ┌────│  ├── Decision made: ~15s                               │
    │    │  ├── New pods scheduled: ~5s                           │
    │    │  ├── Containers started: ~10-30s                       │
    │    │  └── Total: 30-60 seconds                              │
    │    │      ✅ Fast enough for most traffic spikes            │
    │    │                                                         │
    │    ├─────────────────────────────────────────────────────────┤
    │    │                                                         │
    │    │  VPA Response                                          │
    │    │  ├── Metrics analyzed: ~minutes (historical data)      │
    │    │  ├── Recommendation generated: ~1-5 min                │
    │    │  ├── Pod eviction: ~30s                                │
    │    │  ├── New pod startup: ~30s-1min                        │
    │    │  └── Total: 2-10 minutes                               │
    │    │      ⚠️ Too slow for real-time traffic spikes          │
    │    │                                                         │
    │    ├─────────────────────────────────────────────────────────┤
    │    │                                                         │
    │    │  Cluster Autoscaler Response                           │
    │    │  ├── Pending pods detected: ~30s                       │
    │    │  ├── Node provisioning: 2-5 min (cloud API)            │
    │    │  ├── Node registration: ~1 min                         │
    │    │  ├── Pod scheduling: ~30s                              │
    │    │  └── Total: 4-10 minutes                               │
    │    │      ⚠️ Designed for capacity, not real-time           │
    │    │                                                         │
    └────└─────────────────────────────────────────────────────────┘
```

#### 5. Operational Simplicity

| Aspect | HPA | VPA | Cluster Autoscaler |
|--------|-----|-----|-------------------|
| **Installation** | Built into K8s | Requires separate install | Cloud-specific setup |
| **Configuration** | Simple YAML | Complex tuning | Cloud IAM + config |
| **Dependencies** | Metrics Server only | Metrics + Admission Controller | Cloud provider API |
| **Monitoring** | `kubectl get hpa` | Custom dashboards | Cloud console + kubectl |
| **Debugging** | `kubectl describe hpa` | Complex (multiple components) | Cloud logs + K8s events |

```bash
# HPA: Simple to verify
kubectl get hpa
kubectl describe hpa api-hpa

# VPA: Multiple components to check
kubectl get vpa
kubectl get pods -n kube-system | grep vpa
kubectl logs -n kube-system vpa-recommender-xxx
kubectl logs -n kube-system vpa-updater-xxx

# Cluster Autoscaler: Cloud + K8s debugging
kubectl logs -n kube-system cluster-autoscaler-xxx
aws autoscaling describe-auto-scaling-groups  # or equivalent
```

### When VPA Would Be Better

VPA is still useful in specific scenarios (not applicable to this project):

| Scenario | Why VPA | Example |
|----------|---------|---------|
| **Unknown resource needs** | Learns optimal sizing | New application deployment |
| **Batch jobs** | Adjusts for each run | ML training jobs |
| **Vertical performance** | Single-threaded apps | Legacy monoliths |
| **Cost optimization** | Right-sizes over-provisioned pods | Reducing resource waste |

**Recommended VPA Usage for async-micro:**
```yaml
# Use VPA in "Off" mode just for recommendations
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  updatePolicy:
    updateMode: "Off"  # Only recommend, don't apply
```

Then check recommendations:
```bash
kubectl describe vpa api-vpa
# Use recommendations to tune HPA resource requests
```

### When Cluster Autoscaler Would Be Better

Cluster Autoscaler becomes relevant when:

| Scenario | Why Cluster Autoscaler |
|----------|----------------------|
| **Multi-node cloud cluster** | Can provision new VMs |
| **HPA hits node limits** | Pods pending due to no node capacity |
| **Cost optimization at scale** | Remove underutilized nodes |
| **Production high availability** | Multi-AZ node distribution |

```
Future Growth Path:
┌──────────────────────────────────────────────────────────────────┐
│                                                                   │
│   Phase 1 (Current)          Phase 2 (Future)                    │
│   Single VM                   Multi-Node Cloud                    │
│                                                                   │
│   ┌─────────────┐            ┌─────────────────────────────────┐ │
│   │   Single    │     →      │  ┌─────┐ ┌─────┐ ┌─────┐       │ │
│   │     VM      │            │  │Node1│ │Node2│ │Node3│       │ │
│   │             │            │  └─────┘ └─────┘ └─────┘       │ │
│   │  HPA only   │            │                                 │ │
│   └─────────────┘            │  HPA + Cluster Autoscaler       │ │
│                              └─────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Summary: Why HPA for async-micro

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FINAL RECOMMENDATION: HPA                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ MATCHES PROJECT REQUIREMENTS:                                    │
│     • Single VM deployment (K3s/Minikube)                           │
│     • Stateless microservices architecture                          │
│     • Zero downtime scaling requirement                             │
│     • Fast response to traffic changes                              │
│     • Simple operations and debugging                               │
│                                                                      │
│  ❌ VPA NOT CHOSEN BECAUSE:                                         │
│     • Causes pod restarts (downtime)                                │
│     • Slower response time                                          │
│     • Cannot be used with HPA on same metrics                       │
│     • More complex operational overhead                             │
│                                                                      │
│  ❌ CLUSTER AUTOSCALER NOT CHOSEN BECAUSE:                          │
│     • Requires multi-node cloud cluster                             │
│     • Not applicable to single VM setups                            │
│     • Needs cloud provider integration                              │
│                                                                      │
│  📋 SERVICES USING HPA:                                             │
│     • Gateway (2-5 replicas)                                        │
│     • API (2-10 replicas)                                           │
│     • Worker (2-15 replicas)                                        │
│     • Product (1-5 replicas)                                        │
│                                                                      │
│  📋 SERVICES NOT USING HPA:                                         │
│     • RabbitMQ (StatefulSet, 1 replica - requires clustering)       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Single VM Kubernetes Options

Choose one of these lightweight Kubernetes distributions:

#### Option 1: K3s (Recommended for Production)

```bash
# Install K3s
curl -sfL https://get.k3s.io | sh -

# Verify installation
sudo k3s kubectl get nodes

# Set kubeconfig
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
```

#### Option 2: Minikube (Development)

```bash
# Install Minikube
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube-linux-amd64
sudo install minikube-linux-amd64 /usr/local/bin/minikube

# Start with Docker driver
minikube start --driver=docker --memory=4096 --cpus=2

# Enable metrics-server addon
minikube addons enable metrics-server
```

#### Option 3: MicroK8s (Ubuntu)

```bash
# Install MicroK8s
sudo snap install microk8s --classic

# Enable required addons
microk8s enable dns storage metrics-server

# Alias kubectl
alias kubectl='microk8s kubectl'
```

### VM Resource Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 20 GB | 50+ GB |

---

## Architecture

### Application Services

```
┌─────────────────────────────────────────────────────────────────┐
│                         KUBERNETES CLUSTER                       │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Gateway    │    │     API      │    │   Product    │       │
│  │   (2-5)      │───▶│   (2-10)     │    │   (1-5)      │       │
│  │   HPA        │    │   HPA        │    │   HPA        │       │
│  └──────────────┘    └──────┬───────┘    └──────────────┘       │
│                             │                                    │
│                      ┌──────▼───────┐                           │
│                      │   RabbitMQ   │                           │
│                      │   (1 replica)│                           │
│                      └──────┬───────┘                           │
│                             │                                    │
│                      ┌──────▼───────┐                           │
│                      │    Worker    │                           │
│                      │   (2-15)     │                           │
│                      │   HPA        │                           │
│                      └──────────────┘                           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Metrics Server                         │   │
│  │              (Collects CPU/Memory metrics)                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Scaling Configuration Summary

| Service | Min Replicas | Max Replicas | CPU Target | Memory Target |
|---------|--------------|--------------|------------|---------------|
| Gateway | 2 | 5 | 50% | 70% |
| API | 2 | 10 | 50% | 70% |
| Worker | 2 | 15 | 60% | 70% |
| Product | 1 | 5 | 50% | 70% |

---

## Installation

### Step 1: Install Metrics Server

The Metrics Server is required for HPA to function. It collects resource metrics from kubelets.

```bash
# Apply the metrics-server manifest (includes --kubelet-insecure-tls for single VM)
kubectl apply -f manifests/hpa/metrics-server.yaml

# Wait for metrics-server to be ready
kubectl wait --for=condition=available --timeout=300s deployment/metrics-server -n kube-system

# Verify metrics are available (may take 1-2 minutes)
kubectl top nodes
kubectl top pods
```

**Expected output:**
```
NAME       CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
minikube   250m         12%    1024Mi          25%
```

### Step 2: Deploy Application with Resource Limits

Resource requests and limits are **required** for HPA to calculate utilization percentages.

```bash
# Apply all deployments (already configured with resources)
kubectl apply -f manifests/api-deployment.yaml
kubectl apply -f manifests/gateway-deployment.yaml
kubectl apply -f manifests/worker-deployment.yaml
kubectl apply -f manifests/product-deployment.yaml

# Verify deployments
kubectl get deployments
```

### Step 3: Apply HPA Configurations

```bash
# Apply all HPA configurations
kubectl apply -f manifests/hpa/

# Verify HPAs are created
kubectl get hpa
```

**Expected output:**
```
NAME          REFERENCE            TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
api-hpa       Deployment/api       10%/50%         2         10        2          1m
gateway-hpa   Deployment/gateway   8%/50%          2         5         2          1m
worker-hpa    Deployment/worker    5%/60%          2         15        3          1m
product-hpa   Deployment/product   12%/50%         1         5         2          1m
```

---

## Configuration

### HPA Manifest Structure

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api                    # Target deployment
  minReplicas: 2                 # Minimum pods (high availability)
  maxReplicas: 10                # Maximum pods (resource limit)
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50   # Scale when CPU > 50%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70   # Scale when Memory > 70%
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min before scale down
    scaleUp:
      stabilizationWindowSeconds: 0    # Scale up immediately
```

### Resource Configuration

Each deployment must have resource requests defined:

```yaml
resources:
  requests:
    cpu: "100m"      # 0.1 CPU core (used for HPA calculations)
    memory: "128Mi"  # 128 MB RAM
  limits:
    cpu: "500m"      # 0.5 CPU core maximum
    memory: "256Mi"  # 256 MB RAM maximum
```

### Scaling Behavior Configuration

```yaml
behavior:
  scaleDown:
    stabilizationWindowSeconds: 300  # Prevents flapping
    policies:
    - type: Percent
      value: 50                      # Scale down max 50% at a time
      periodSeconds: 60
  scaleUp:
    stabilizationWindowSeconds: 0    # React immediately to load
    policies:
    - type: Percent
      value: 100                     # Can double pods
      periodSeconds: 15
    - type: Pods
      value: 4                       # Or add 4 pods
      periodSeconds: 15
    selectPolicy: Max                # Use whichever adds more pods
```

---

## Scaling Strategies

### Strategy 1: CPU-Based Scaling (Default)

Best for: API services, Gateway, compute-intensive workloads

```yaml
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 50
```

### Strategy 2: Memory-Based Scaling

Best for: Services with memory-intensive operations

```yaml
metrics:
- type: Resource
  resource:
    name: memory
    target:
      type: Utilization
      averageUtilization: 70
```

### Strategy 3: Combined CPU + Memory (Recommended)

Best for: Production workloads with varying resource patterns

```yaml
metrics:
- type: Resource
  resource:
    name: cpu
    target:
      type: Utilization
      averageUtilization: 50
- type: Resource
  resource:
    name: memory
    target:
      type: Utilization
      averageUtilization: 70
```

### Strategy 4: Custom Metrics (Advanced)

For queue-based scaling (requires Prometheus Adapter):

```yaml
metrics:
- type: External
  external:
    metric:
      name: rabbitmq_queue_messages
      selector:
        matchLabels:
          queue: task_queue
    target:
      type: AverageValue
      averageValue: 10
```

---

## Monitoring

### Real-Time HPA Monitoring

```bash
# Watch HPA status continuously
kubectl get hpa -w

# Detailed HPA information
kubectl describe hpa api-hpa

# View scaling events
kubectl get events --sort-by='.lastTimestamp' | grep -i scale
```

### Resource Monitoring

```bash
# Current resource usage
kubectl top pods

# Node resource usage
kubectl top nodes

# Detailed pod metrics
kubectl top pods --containers
```

### Grafana Dashboard Queries

If using the included Grafana setup, add these Prometheus queries:

```promql
# Current replicas vs desired
kube_horizontalpodautoscaler_status_current_replicas{horizontalpodautoscaler="api-hpa"}
kube_horizontalpodautoscaler_status_desired_replicas{horizontalpodautoscaler="api-hpa"}

# CPU utilization percentage
sum(rate(container_cpu_usage_seconds_total{pod=~"api-.*"}[5m])) /
sum(kube_pod_container_resource_requests{pod=~"api-.*", resource="cpu"}) * 100

# Memory utilization percentage
sum(container_memory_usage_bytes{pod=~"api-.*"}) /
sum(kube_pod_container_resource_requests{pod=~"api-.*", resource="memory"}) * 100
```

---

## Troubleshooting

### Common Issues

#### 1. HPA Shows `<unknown>` for Targets

**Cause:** Metrics server not running or no resource requests defined.

```bash
# Check metrics server
kubectl get pods -n kube-system | grep metrics-server

# Verify metrics are available
kubectl top pods

# Check deployment has resources defined
kubectl get deployment api -o yaml | grep -A 10 resources
```

**Solution:**
```bash
# Restart metrics server
kubectl rollout restart deployment/metrics-server -n kube-system

# Ensure deployments have resource requests
kubectl apply -f manifests/api-deployment.yaml
```

#### 2. HPA Not Scaling Up

**Cause:** Target utilization not reached or stabilization window.

```bash
# Check current utilization
kubectl describe hpa api-hpa

# Look for scaling events
kubectl get events --field-selector reason=SuccessfulRescale
```

#### 3. HPA Scaling Too Aggressively

**Cause:** Stabilization window too short.

**Solution:** Increase `stabilizationWindowSeconds`:
```yaml
behavior:
  scaleUp:
    stabilizationWindowSeconds: 60  # Wait 1 minute
```

#### 4. Pods Pending After Scale Up

**Cause:** Insufficient node resources.

```bash
# Check node capacity
kubectl describe node | grep -A 10 "Allocated resources"

# Check pending pods
kubectl get pods --field-selector=status.phase=Pending
```

**Solution:** Reduce `maxReplicas` or increase VM resources.

### Diagnostic Commands

```bash
# Complete HPA status
kubectl get hpa -o yaml

# HPA events
kubectl describe hpa api-hpa | grep -A 20 Events

# Pod resource usage history
kubectl top pods --containers

# Check if metrics API is working
kubectl get --raw /apis/metrics.k8s.io/v1beta1/pods
```

---

## Best Practices

### 1. Resource Configuration

- **Always set resource requests** - HPA requires them
- **Set limits 2-5x requests** - Allows burst capacity
- **Monitor actual usage** - Adjust based on real metrics

```yaml
resources:
  requests:
    cpu: "100m"      # Start conservative
    memory: "128Mi"
  limits:
    cpu: "500m"      # 5x headroom for bursts
    memory: "512Mi"  # 4x headroom
```

### 2. Replica Limits for Single VM

| VM RAM | Recommended Max Total Pods |
|--------|---------------------------|
| 4 GB | 15-20 pods |
| 8 GB | 30-40 pods |
| 16 GB | 60-80 pods |

**Our Configuration:**
- Gateway: max 5
- API: max 10
- Worker: max 15
- Product: max 5
- **Total max: 35 pods** (suitable for 8GB+ VM)

### 3. Scaling Behavior

```yaml
behavior:
  scaleUp:
    stabilizationWindowSeconds: 0    # React fast to load
    policies:
    - type: Pods
      value: 4
      periodSeconds: 15
  scaleDown:
    stabilizationWindowSeconds: 300  # Prevent flapping (5 min)
    policies:
    - type: Percent
      value: 50
      periodSeconds: 60
```

### 4. Service-Specific Recommendations

| Service | Min | Max | CPU Target | Notes |
|---------|-----|-----|------------|-------|
| Gateway | 2 | 5 | 50% | Entry point, keep stable |
| API | 2 | 10 | 50% | Scales with request load |
| Worker | 2 | 15 | 60% | Scales with queue depth |
| Product | 1 | 5 | 50% | Lower traffic expected |
| RabbitMQ | 1 | 1 | N/A | StatefulSet, don't scale |

### 5. Testing Autoscaling

#### Prerequisites for Testing

Before testing, ensure all components are properly configured:

```bash
# 1. Verify metrics server is running
kubectl get pods -n kube-system | grep metrics-server
# Expected: metrics-server-xxx   1/1   Running

# 2. Verify metrics are being collected
kubectl top nodes
kubectl top pods
# Should show CPU and memory values, not <unknown>

# 3. Verify HPAs are configured and receiving metrics
kubectl get hpa
# Expected: TARGETS should show actual percentages, not <unknown>
```

#### Test Method 1: CPU Stress Test (Recommended)

Stress a pod's CPU directly to trigger scaling:

```bash
# 1. Get the name of an API pod
kubectl get pods -l app=api

# 2. Stress the pod's CPU (runs multiple CPU-intensive processes)
kubectl exec -it <api-pod-name> -- sh -c "for i in 1 2 3 4 5; do yes > /dev/null & done"

# 3. In another terminal, watch the HPA react
kubectl get hpa -w

# 4. Watch pods scale up
kubectl get pods -l app=api -w

# 5. Clean up - delete the stressed pod (deployment will recreate it)
kubectl delete pod <api-pod-name> --grace-period=0 --force
```

#### Test Method 2: HTTP Load Generator

Generate HTTP traffic to simulate real load:

```bash
# Create a load generator pod
kubectl run load-generator --image=busybox:1.36 --restart=Never -- \
  /bin/sh -c "while true; do wget -q -O- http://gateway-service:3000/health; done"

# Watch scaling in action
kubectl get hpa -w

# In another terminal, watch pods
kubectl get pods -w

# Clean up
kubectl delete pod load-generator
```

#### Test Method 3: Heavy Load with Multiple Generators

For more aggressive testing:

```bash
# Create multiple load generators
for i in 1 2 3 4 5; do
  kubectl run load-gen-$i --image=busybox:1.36 --restart=Never -- \
    /bin/sh -c "while true; do wget -q -O- http://api-service:8000/ 2>/dev/null; done"
done

# Watch HPA
kubectl get hpa -w

# Clean up all generators
kubectl delete pod -l run=load-gen-1
kubectl delete pod -l run=load-gen-2
# ... or
kubectl delete pods load-gen-1 load-gen-2 load-gen-3 load-gen-4 load-gen-5
```

#### Verified Test Results

The following comprehensive test was performed on the `microservices-prod` kind cluster on **2025-12-10**.

**Test Environment:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                    TEST ENVIRONMENT                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Cluster Type:     kind (Kubernetes in Docker)                       │
│  Cluster Name:     microservices-prod                                │
│  Node:             microservices-prod-control-plane                  │
│  Kubernetes:       v1.34.0                                           │
│  Container Runtime: containerd://2.1.3                               │
│  OS:               Debian GNU/Linux 12 (bookworm)                    │
│  Metrics Server:   v0.7.0                                            │
│  Platform:         WSL2 on Windows                                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Node Resources:**
```
NAME                               CPU(cores)   CPU(%)   MEMORY(bytes)   MEMORY(%)
microservices-prod-control-plane   583m         7%       2055Mi          26%
```

---

##### Test 1: API Service Scale-Up and Scale-Down

**Baseline State (08:37:59):**
```
NAME          REFERENCE            TARGETS                        MINPODS   MAXPODS   REPLICAS
api-hpa       Deployment/api       cpu: 1%/50%, memory: 16%/70%   2         10        2
gateway-hpa   Deployment/gateway   cpu: 0%/50%, memory: 26%/70%   2         5         2
product-hpa   Deployment/product   cpu: 1%/50%, memory: 17%/70%   1         5         1
worker-hpa    Deployment/worker    cpu: 1%/60%, memory: 8%/70%    2         15        2

Pod Counts: API=2, Gateway=2, Worker=2, Product=1
```

**Stress Test Started (08:38:12):**
```bash
# Command executed:
kubectl exec api-66bd89b9bf-m24cz -- sh -c "for i in 1 2 3 4 5 6 7 8; do yes > /dev/null & done"
```

**Scale-Up Detected (08:40:37):**
```
NAME      REFERENCE        TARGETS                         MINPODS   MAXPODS   REPLICAS
api-hpa   Deployment/api   cpu: 50%/50%, memory: 16%/70%   2         10        10

Pod Resource Usage:
NAME                   CPU(cores)   MEMORY(bytes)
api-66bd89b9bf-m24cz   500m         22Mi            (stressed pod - hitting limit)
api-66bd89b9bf-nwnr9   1m           21Mi
api-66bd89b9bf-258w5   1m           21Mi            (new)
api-66bd89b9bf-75qsx   1m           21Mi            (new)
... (8 new pods created)
```

**API HPA Scaling Events:**
```
TIMESTAMP   EVENT                 REPLICAS   REASON
08:38:36    SuccessfulRescale    2 → 6      cpu resource utilization above target
08:38:51    SuccessfulRescale    6 → 10     cpu resource utilization above target
```

**Scale-Up Analysis:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                    API SCALE-UP ANALYSIS                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Initial State:                                                      │
│    - Replicas: 2                                                     │
│    - CPU per pod: 1m (1% of 100m request)                           │
│                                                                      │
│  During Stress:                                                      │
│    - Stressed pod CPU: 500m (500% of 100m request, capped at limit) │
│    - Average CPU: (500 + 1) / 2 = 250.5m                            │
│    - Utilization: 250.5 / 100 = 250%                                │
│                                                                      │
│  HPA Calculation:                                                    │
│    desiredReplicas = ceil[2 × (250 / 50)] = ceil[10] = 10           │
│                                                                      │
│  Scaling Behavior:                                                   │
│    - scaleUp.stabilizationWindowSeconds: 0 (immediate)              │
│    - scaleUp.policies: 100% or +4 pods per 15s                      │
│    - Result: 2 → 6 → 10 in ~15 seconds                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Stress Removed (08:42:56):**
```bash
kubectl delete pod api-66bd89b9bf-m24cz --grace-period=0 --force
```

**Scale-Down Sequence:**
```
TIMESTAMP   EVENT                 REPLICAS   REASON
08:45:00    (stabilization)      10         Waiting for 5-minute window
08:47:48    SuccessfulRescale    10 → 5     All metrics below target
08:48:48    SuccessfulRescale    5 → 3      All metrics below target
08:52:48    SuccessfulRescale    3 → 2      All metrics below target (min reached)
```

**Scale-Down Analysis:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                    API SCALE-DOWN TIMELINE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  08:42:56  Stress removed, CPU drops to 1%                          │
│            │                                                         │
│            ├──── 5 minute stabilization window ────┤                │
│            │                                        │                │
│  08:47:48  First scale-down: 10 → 5 pods                            │
│            (50% reduction per scaleDown policy)                      │
│            │                                                         │
│  08:48:48  Second scale-down: 5 → 3 pods                            │
│            (50% of 5 = 2.5, rounds to 3)                            │
│            │                                                         │
│  08:52:48  Final scale-down: 3 → 2 pods                             │
│            (reached minReplicas)                                     │
│                                                                      │
│  Total scale-down time: ~10 minutes                                  │
│  Configuration:                                                      │
│    - stabilizationWindowSeconds: 300 (5 minutes)                    │
│    - scaleDown policy: 50% per 60 seconds                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

##### Test 2: Gateway Service Scale-Up and Scale-Down

**Stress Test Started (08:43:31):**
```bash
kubectl exec gateway-67644498-2jv8j -- sh -c "for i in 1 2 3 4 5 6; do yes > /dev/null & done"
```

**Scale-Up Detected (08:49:46):**
```
NAME          REFERENCE            TARGETS                          REPLICAS
gateway-hpa   Deployment/gateway   cpu: 100%/50%, memory: 26%/70%   5

Pod Resource Usage:
NAME                     CPU(cores)   MEMORY(bytes)
gateway-67644498-2jv8j   501m         34Mi            (stressed pod)
gateway-67644498-499l5   1m           33Mi
gateway-67644498-kzhn7   1m           33Mi            (new)
gateway-67644498-lzjtv   0m           33Mi            (new)
gateway-67644498-z9mj9   1m           33Mi            (new)
```

**Gateway HPA Scaling Events:**
```
TIMESTAMP   EVENT                 REPLICAS   REASON
08:44:45    SuccessfulRescale    2 → 4      cpu resource utilization above target
08:45:00    SuccessfulRescale    4 → 5      cpu resource utilization above target
08:50:35    SuccessfulRescale    5 → 3      All metrics below target
08:50:35    SuccessfulRescale    3 → 2      All metrics below target
```

---

##### Complete Test Summary

**All Scaling Events (Chronological):**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│  TIME      SERVICE    ACTION      REPLICAS   REASON                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  08:38:36  API        Scale Up    2 → 6      CPU above target (250%)         │
│  08:38:51  API        Scale Up    6 → 10     CPU above target                │
│  08:44:45  Gateway    Scale Up    2 → 4      CPU above target (100%)         │
│  08:45:00  Gateway    Scale Up    4 → 5      CPU above target                │
│  08:47:48  API        Scale Down  10 → 5     All metrics below target        │
│  08:48:48  API        Scale Down  5 → 3      All metrics below target        │
│  08:50:35  Gateway    Scale Down  5 → 3      All metrics below target        │
│  08:50:35  Gateway    Scale Down  3 → 2      All metrics below target        │
│  08:52:48  API        Scale Down  3 → 2      All metrics below target        │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Final State (08:53:08):**
```
NAME          REFERENCE            TARGETS                        MINPODS   MAXPODS   REPLICAS
api-hpa       Deployment/api       cpu: 1%/50%, memory: 16%/70%   2         10        2
gateway-hpa   Deployment/gateway   cpu: 1%/50%, memory: 26%/70%   2         5         2
product-hpa   Deployment/product   cpu: 1%/50%, memory: 17%/70%   1         5         1
worker-hpa    Deployment/worker    cpu: 1%/60%, memory: 8%/70%    2         15        2

Final Pod Counts: API=2, Gateway=2, Worker=2, Product=1
```

**Test Results Summary:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                    TEST RESULTS SUMMARY                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ API HPA Scale-Up:      PASSED (2 → 10 in ~15 seconds)           │
│  ✅ API HPA Scale-Down:    PASSED (10 → 2 in ~10 minutes)           │
│  ✅ Gateway HPA Scale-Up:  PASSED (2 → 5 in ~15 seconds)            │
│  ✅ Gateway HPA Scale-Down: PASSED (5 → 2 in ~5 minutes)            │
│  ✅ Metrics Server:        WORKING (accurate CPU/memory metrics)    │
│  ✅ Stabilization Window:  WORKING (5-minute delay before scale-down)│
│  ✅ Scale Policies:        WORKING (50% max scale-down per minute)  │
│                                                                      │
│  Key Observations:                                                   │
│  • Scale-up is immediate (stabilizationWindowSeconds: 0)            │
│  • Scale-down is gradual (5-min stabilization + 50% policy)         │
│  • New pods start receiving traffic within ~30 seconds               │
│  • CPU limits (500m) effectively cap stressed pod resource usage    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### Verifying Test Success

```bash
# Check scaling events
kubectl describe hpa api-hpa | grep -A 15 Events

# Expected output:
#   Normal  SuccessfulRescale  New size: 6; reason: cpu resource utilization above target
#   Normal  SuccessfulRescale  New size: 10; reason: cpu resource utilization above target
#   Normal  SuccessfulRescale  New size: 5; reason: All metrics below target
#   Normal  SuccessfulRescale  New size: 3; reason: All metrics below target
#   Normal  SuccessfulRescale  New size: 2; reason: All metrics below target

# View all HPA scaling events
kubectl get events --sort-by='.lastTimestamp' --field-selector reason=SuccessfulRescale

# Monitor HPA in real-time
kubectl get hpa -w

# Check pod resource usage
kubectl top pods
```

---

#### Understanding the Test Results in Detail

##### How CPU Percentage is Calculated

```
┌─────────────────────────────────────────────────────────────────────┐
│                CPU UTILIZATION CALCULATION                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Formula:                                                            │
│    CPU Utilization % = (Actual CPU Usage / CPU Request) × 100       │
│                                                                      │
│  Example from API Test:                                              │
│    CPU Request: 100m (defined in deployment)                        │
│    Actual Usage: 500m (during stress - capped at limit)             │
│    Utilization: (500 / 100) × 100 = 500%                            │
│                                                                      │
│  Note: Utilization CAN exceed 100% because:                         │
│    - Request is the "guaranteed" amount                             │
│    - Limit is the "maximum" amount (500m in our config)             │
│    - Pod can use up to limit if node has capacity                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

##### How Memory Percentage is Calculated

```
┌─────────────────────────────────────────────────────────────────────┐
│                MEMORY UTILIZATION CALCULATION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Formula:                                                            │
│    Memory Utilization % = (Actual Memory / Memory Request) × 100    │
│                                                                      │
│  Example from API Test:                                              │
│    Memory Request: 128Mi                                            │
│    Actual Usage: 21Mi                                               │
│    Utilization: (21 / 128) × 100 = 16%                              │
│                                                                      │
│  Note: Memory stayed low because our stress test only               │
│        consumed CPU, not memory.                                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

##### HPA Replica Calculation Formula

```
┌─────────────────────────────────────────────────────────────────────┐
│                HPA SCALING ALGORITHM                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Formula:                                                            │
│    desiredReplicas = ceil[currentReplicas × (currentMetric/target)] │
│                                                                      │
│  API Scale-Up Calculation:                                          │
│    Before stress:                                                    │
│      Pod 1: 1m CPU (1%)                                             │
│      Pod 2: 1m CPU (1%)                                             │
│      Average: 1%                                                     │
│                                                                      │
│    After stress applied:                                            │
│      Pod 1: 500m CPU (500% - capped at limit)                       │
│      Pod 2: 1m CPU (1%)                                             │
│      Average: (500 + 1) / 2 = 250.5m = 250%                         │
│                                                                      │
│    Calculation:                                                      │
│      desiredReplicas = ceil[2 × (250 / 50)]                         │
│      desiredReplicas = ceil[2 × 5]                                  │
│      desiredReplicas = ceil[10]                                     │
│      desiredReplicas = 10                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

##### Why Scale-Up Was Fast (~15 seconds)

```
┌─────────────────────────────────────────────────────────────────────┐
│                SCALE-UP BEHAVIOR CONFIGURATION                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Configuration (from api-hpa.yaml):                                 │
│    behavior:                                                         │
│      scaleUp:                                                        │
│        stabilizationWindowSeconds: 0  # No waiting - immediate      │
│        policies:                                                     │
│        - type: Percent                                               │
│          value: 100                   # Can double pods              │
│          periodSeconds: 15                                           │
│        - type: Pods                                                  │
│          value: 4                     # Or add 4 pods                │
│          periodSeconds: 15                                           │
│        selectPolicy: Max              # Use whichever adds more      │
│                                                                      │
│  Result:                                                             │
│    - stabilizationWindowSeconds: 0 means react immediately          │
│    - 100% policy allows doubling: 2 → 4 → 8                         │
│    - +4 pods policy allows: 2 → 6 → 10                              │
│    - selectPolicy: Max chooses the larger increase                  │
│    - Total time: 2 → 6 → 10 in ~15 seconds                          │
│                                                                      │
│  Why Fast Scale-Up Matters:                                          │
│    - Traffic spikes need immediate response                         │
│    - Users shouldn't wait for pods to scale                         │
│    - Better to over-provision briefly than drop requests            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

##### Why Scale-Down Was Slow (~10 minutes)

```
┌─────────────────────────────────────────────────────────────────────┐
│                SCALE-DOWN BEHAVIOR CONFIGURATION                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Configuration (from api-hpa.yaml):                                 │
│    behavior:                                                         │
│      scaleDown:                                                      │
│        stabilizationWindowSeconds: 300  # Wait 5 minutes first      │
│        policies:                                                     │
│        - type: Percent                                               │
│          value: 50                      # Max 50% reduction          │
│          periodSeconds: 60              # Per minute                 │
│                                                                      │
│  Timeline:                                                           │
│    08:42:56  Stress removed, CPU drops to 1%                        │
│    08:43-08:47  Stabilization window (5 minutes) - NO changes       │
│    08:47:48  First scale-down: 10 → 5 (50% reduction)               │
│    08:48:48  Second scale-down: 5 → 3 (50% = 2.5, rounds to 3)      │
│    08:52:48  Final scale-down: 3 → 2 (reached minReplicas)          │
│                                                                      │
│  Why Slow Scale-Down Matters:                                        │
│    - Prevents "flapping" (rapid scale up/down cycles)               │
│    - Traffic dips might be temporary                                │
│    - Allows time for traffic patterns to stabilize                  │
│    - Avoids killing pods during brief low-traffic periods           │
│    - Gradual reduction prevents sudden capacity loss                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

##### Visual Timeline of API Scaling Test

```
                    API SERVICE SCALING TEST

    Replicas
       │
    10 ┤                 ████████████████
       │                █               █
     8 ┤               █                 █
       │              █                   █
     6 ┤             █                     █
       │            █                       █
     4 ┤                                     █
       │                                      █
     2 ┤████████████                           ████████████
       │
       └──────────────────────────────────────────────────────► Time
         08:38    08:40    08:43    08:48    08:53

         │        │        │        │        │
         │        │        │        │        └── Final: 2 pods (min)
         │        │        │        └── Scale-down: 10→5→3→2
         │        │        └── Stress removed
         │        └── Scale-up: 2→6→10 (max)
         └── Stress started
```

##### Visual Timeline of Gateway Scaling Test

```
                    GATEWAY SERVICE SCALING TEST

    Replicas
       │
     5 ┤            ████████████████████
       │           █                    █
     4 ┤          █                      █
       │                                  █
     3 ┤                                   █
       │                                    █
     2 ┤██████████                           █████████████
       │
       └──────────────────────────────────────────────────────► Time
         08:43    08:45    08:50    08:51

         │        │        │        │
         │        │        │        └── Final: 2 pods (min)
         │        │        └── Scale-down: 5→3→2
         │        └── Scale-up: 2→4→5 (max)
         └── Stress started
```

##### Test Validation Matrix

| Test Case | Expected | Actual | Result |
|-----------|----------|--------|--------|
| API scale-up triggers at >50% CPU | Yes | Triggered at 250% | ✅ PASS |
| API scales to max (10) | Yes | Scaled to 10 | ✅ PASS |
| Scale-up is fast (<60s) | Yes | ~15 seconds | ✅ PASS |
| Stabilization window enforced | 5 min wait | 5 min observed | ✅ PASS |
| Scale-down is gradual (50%/min) | Yes | 10→5→3→2 | ✅ PASS |
| Returns to minReplicas | 2 pods | 2 pods | ✅ PASS |
| Gateway HPA works independently | Yes | Scaled 2→5→2 | ✅ PASS |
| Metrics Server provides data | Yes | CPU/Memory shown | ✅ PASS |

##### Practical Implications for Production

```
┌─────────────────────────────────────────────────────────────────────┐
│                PRODUCTION IMPLICATIONS                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. TRAFFIC SPIKES                                                   │
│     Your services will automatically handle traffic spikes by       │
│     adding pods within ~15-30 seconds. Users experience minimal     │
│     latency increase during scaling.                                │
│                                                                      │
│  2. COST EFFICIENCY                                                  │
│     Scale-down is gradual, preventing unnecessary resource waste    │
│     while avoiding premature pod termination. You only pay for      │
│     what you need.                                                  │
│                                                                      │
│  3. HIGH AVAILABILITY                                                │
│     Minimum replicas (2 for API/Gateway, 1 for Product) ensure      │
│     services stay available even during scale-down. No single       │
│     point of failure.                                               │
│                                                                      │
│  4. RESOURCE PROTECTION                                              │
│     CPU limits (500m) prevent any single pod from consuming all     │
│     node resources. Other pods and system components remain         │
│     responsive.                                                     │
│                                                                      │
│  5. PREDICTABLE BEHAVIOR                                             │
│     - Scale-up: Immediate (0s stabilization)                        │
│     - Scale-down: Gradual (5-min wait + 50% policy)                 │
│     - New pods receive traffic within ~30 seconds                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6. Production Checklist

- [ ] Metrics Server installed and running
- [ ] All deployments have resource requests/limits
- [ ] HPA manifests applied
- [ ] Stabilization windows configured
- [ ] Max replicas within VM capacity
- [ ] Monitoring/alerting configured
- [ ] Load testing completed

---

## Quick Reference

### Apply All Scaling Components

```bash
# 1. Install metrics server
kubectl apply -f manifests/hpa/metrics-server.yaml

# 2. Wait for metrics
kubectl wait --for=condition=available deployment/metrics-server -n kube-system --timeout=300s

# 3. Apply deployments (with resources)
kubectl apply -f manifests/prod-manifests/

# 4. Apply HPAs
kubectl apply -f manifests/hpa/

# 5. Verify
kubectl get hpa
kubectl top pods
```

### Kind Cluster Setup

For kind (Kubernetes in Docker) clusters:

```bash
# 1. Create cluster (if not exists)
kind create cluster --name microservices-prod

# 2. Switch context
kubectl config use-context kind-microservices-prod

# 3. Load images into kind (if using local images)
kind load docker-image <image-name> --name microservices-prod

# 4. Apply metrics server (includes --kubelet-insecure-tls)
kubectl apply -f manifests/hpa/metrics-server.yaml

# 5. Wait for metrics server
kubectl wait --for=condition=available deployment/metrics-server -n kube-system --timeout=300s

# 6. Deploy application with resources
kubectl apply -f manifests/prod-manifests/

# 7. Apply HPAs
kubectl apply -f manifests/hpa/

# 8. Verify everything is working
kubectl get hpa
kubectl top pods
```

**Note:** If metrics-server shows `ImagePullBackOff`, the image needs to be loaded into kind:
```bash
docker pull registry.k8s.io/metrics-server/metrics-server:v0.7.0
kind load docker-image registry.k8s.io/metrics-server/metrics-server:v0.7.0 --name microservices-prod
kubectl rollout restart deployment/metrics-server -n kube-system
```

### Remove Autoscaling

```bash
# Delete HPAs (pods remain at current count)
kubectl delete -f manifests/hpa/api-hpa.yaml
kubectl delete -f manifests/hpa/gateway-hpa.yaml
kubectl delete -f manifests/hpa/worker-hpa.yaml
kubectl delete -f manifests/hpa/product-hpa.yaml

# Or delete all HPAs
kubectl delete hpa --all
```

### Manual Scaling (Override HPA)

```bash
# Temporarily disable HPA and set replicas
kubectl scale deployment api --replicas=5

# Re-enable HPA control
kubectl apply -f manifests/hpa/api-hpa.yaml
```

---

## Additional Resources

- [Kubernetes HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Metrics Server](https://github.com/kubernetes-sigs/metrics-server)
- [K3s Documentation](https://docs.k3s.io/)
- [Autoscaling Design Proposals](https://github.com/kubernetes/design-proposals-archive/blob/main/autoscaling/horizontal-pod-autoscaler.md)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)

---

## Monitoring with ArgoCD

ArgoCD provides GitOps-based continuous delivery for Kubernetes. This section explains how to monitor HPA and scaling activity through ArgoCD.

### Accessing ArgoCD UI

#### Step 1: Port-Forward to ArgoCD Server

```bash
# Forward ArgoCD server to local port 8080
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

#### Step 2: Get Admin Credentials

```bash
# Get the initial admin password
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d

# Username: admin
# Password: <output from above command>
```

#### Step 3: Access the UI

Open your browser and navigate to:
```
https://localhost:8080
```

> **Note**: You may see a certificate warning since ArgoCD uses a self-signed certificate by default. Accept the warning to proceed.

### Viewing HPA in ArgoCD

#### Understanding ArgoCD Application Structure

```
ArgoCD Application: async-microservices
│
├── Source Repository: https://github.com/Ridwan414/async-micro.git
├── Path: manifests/
├── Target Revision: HEAD
│
└── Managed Resources:
    ├── Deployments (api, gateway, product, worker)
    ├── Services (api-service, gateway-service, product-service, rabbitmq)
    ├── StatefulSets (rabbitmq)
    ├── HPAs (api-hpa, gateway-hpa, product-hpa, worker-hpa)  ← Scaling Resources
    └── Other (PVC, ConfigMaps, etc.)
```

#### Viewing HPA Resources in ArgoCD UI

1. **Navigate to Application**
   - Click on `async-microservices` application
   - You'll see a visual graph of all managed resources

2. **Filter by Resource Type**
   - Use the filter dropdown to select "HorizontalPodAutoscaler"
   - This shows only HPA resources

3. **View HPA Details**
   - Click on any HPA resource (e.g., `api-hpa`)
   - View the YAML manifest, live status, and events

4. **Monitor Real-time Scaling**
   ```
   ┌─────────────────────────────────────────────────────────────────┐
   │                    ArgoCD Application View                       │
   │                                                                  │
   │  ┌──────────┐     ┌──────────┐     ┌──────────────────────────┐ │
   │  │ api-hpa  │────→│   api    │────→│  api-5d8f9b7c6d-xxxxx   │ │
   │  │ (HPA)    │     │(Deploy)  │     │  api-5d8f9b7c6d-yyyyy   │ │
   │  │          │     │          │     │  api-5d8f9b7c6d-zzzzz   │ │
   │  │CPU: 45%  │     │Replicas:3│     └──────────────────────────┘ │
   │  └──────────┘     └──────────┘                                  │
   │                                                                  │
   │  Status: ● Synced   Health: ● Healthy                           │
   └─────────────────────────────────────────────────────────────────┘
   ```

5. **Check Sync Status**
   - **Synced**: HPA configuration matches the Git repository
   - **OutOfSync**: HPA has drifted from Git (manual changes or pending sync)
   - **Unknown**: ArgoCD cannot determine status

### ArgoCD CLI Commands

#### Install ArgoCD CLI

```bash
# Linux
curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
chmod +x argocd
sudo mv argocd /usr/local/bin/

# macOS
brew install argocd

# Windows (using chocolatey)
choco install argocd-cli
```

#### Login to ArgoCD

```bash
# Get the admin password
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)

# Login (using port-forward)
argocd login localhost:8080 --username admin --password $ARGOCD_PASSWORD --insecure
```

#### View Application and HPA Status

```bash
# List all applications
argocd app list

# Get detailed application info
argocd app get async-microservices

# View specific resource (HPA)
argocd app resources async-microservices --kind HorizontalPodAutoscaler

# View live manifest of HPA
argocd app manifests async-microservices --source live | grep -A 50 "kind: HorizontalPodAutoscaler"
```

#### Monitor Application Events

```bash
# Watch application events in real-time
argocd app watch async-microservices

# View application history
argocd app history async-microservices

# View sync status
argocd app sync-status async-microservices
```

### Configuring ArgoCD to Manage HPAs

#### Option 1: Include HPA in Main Manifests Path

Ensure your HPA manifests are in the path monitored by ArgoCD:

```yaml
# ArgoCD Application spec
spec:
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    path: manifests/prod-manifests  # Include HPA folder
    targetRevision: HEAD
```

#### Option 2: Use Multiple Sources (ArgoCD 2.6+)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-microservices
  namespace: argocd
spec:
  project: default
  sources:
    - repoURL: https://github.com/Ridwan414/async-micro.git
      path: manifests/prod-manifests
      targetRevision: HEAD
    - repoURL: https://github.com/Ridwan414/async-micro.git
      path: manifests/hpa
      targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: default
```

#### Option 3: Separate Application for HPAs

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-microservices-hpa
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    path: manifests/hpa
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: default
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Monitoring HPA via kubectl (Alternative)

While ArgoCD provides a great UI, you can also use kubectl directly:

```bash
# Watch HPA status in real-time
kubectl get hpa -w

# Detailed HPA information
kubectl describe hpa api-hpa

# View HPA with current metrics
kubectl get hpa -o custom-columns=\
NAME:.metadata.name,\
REFERENCE:.spec.scaleTargetRef.name,\
MIN:.spec.minReplicas,\
MAX:.spec.maxReplicas,\
CURRENT:.status.currentReplicas,\
CPU:.status.currentMetrics[0].resource.current.averageUtilization,\
MEMORY:.status.currentMetrics[1].resource.current.averageUtilization

# View HPA events
kubectl get events --field-selector involvedObject.kind=HorizontalPodAutoscaler
```

### Current Cluster Status

To check your current HPA status:

```bash
kubectl get hpa

# Expected output:
# NAME          REFERENCE            TARGETS                        MINPODS   MAXPODS   REPLICAS
# api-hpa       Deployment/api       cpu: 1%/50%, memory: 16%/70%   2         10        2
# gateway-hpa   Deployment/gateway   cpu: 1%/50%, memory: 26%/70%   2         5         2
# product-hpa   Deployment/product   cpu: 1%/50%, memory: 17%/70%   1         5         1
# worker-hpa    Deployment/worker    cpu: 1%/60%, memory: 8%/70%    2         15        2
```

### Troubleshooting ArgoCD + HPA

| Issue | Cause | Solution |
|-------|-------|----------|
| HPA not showing in ArgoCD | HPA path not in source | Update application source path |
| HPA shows OutOfSync | Manual changes made | Run `argocd app sync` |
| HPA shows Unknown metrics | Metrics server not running | Deploy metrics-server |
| HPA ignored by ArgoCD | Resource excluded in config | Check `resource.exclusions` in argocd-cm |

### Quick Access Commands

```bash
# One-liner to access ArgoCD UI
kubectl port-forward svc/argocd-server -n argocd 8080:443 &
echo "Access ArgoCD at: https://localhost:8080"
echo "Username: admin"
echo "Password: $(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)"
```

---

## Testing Autoscaling via ArgoCD UI (Remote Server)

This section provides step-by-step instructions for testing autoscaling on a remote server using ArgoCD UI without SSH access.

### Prerequisites

1. **ArgoCD UI accessible** via NodePort or Ingress
2. **HPA Application deployed** via ArgoCD
3. **Load Test Application deployed** via ArgoCD
4. **Staging environment running** with services

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ARGOCD APPLICATIONS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐    │
│  │ async-micro-hpa   │    │async-micro-staging│    │async-micro-load-  │    │
│  │                   │    │                   │    │      test         │    │
│  │ Deploys:          │    │ Deploys:          │    │ Deploys:          │    │
│  │ • api-hpa         │    │ • api deployment  │    │ • load-test-staging│   │
│  │ • gateway-hpa     │    │ • gateway deploy  │    │ • load-test-ab    │    │
│  │ • product-hpa     │    │ • product deploy  │    │ • spike-test      │    │
│  │ • worker-hpa      │    │ • worker deploy   │    │                   │    │
│  │ • metrics-server  │    │ • rabbitmq        │    │                   │    │
│  └───────────────────┘    └───────────────────┘    └───────────────────┘    │
│           │                        │                        │                │
│           └────────────────────────┼────────────────────────┘                │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         STAGING NAMESPACE                                │ │
│  │                                                                          │ │
│  │   Load Test Pods ──────▶ Gateway ──────▶ API ──────▶ RabbitMQ           │ │
│  │        │                    │              │             │               │ │
│  │        │                    │              │             ▼               │ │
│  │        │                    │              │         Worker              │ │
│  │        │                    │              │                             │ │
│  │        │                    ▼              ▼                             │ │
│  │        │               HPA monitors CPU/Memory                          │ │
│  │        │                    │              │                             │ │
│  │        │                    ▼              ▼                             │ │
│  │        │            Scale Up/Down pods automatically                    │ │
│  │        │                                                                 │ │
│  └────────┼─────────────────────────────────────────────────────────────────┘ │
│           │                                                                    │
│           └───────────────── Traffic Flow ──────────────────────────────────▶ │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Access ArgoCD UI

**Remote Server URL:** `http://<server-ip>:30588`

**Example:** `http://103.191.50.49:30588`

**Credentials:**
- Username: `admin`
- Password: Get from secret or use saved password

### Step 2: Deploy HPA Application

If `async-micro-hpa` doesn't exist, create it:

1. Click **"+ NEW APP"** in ArgoCD UI
2. Click **"EDIT AS YAML"**
3. Clear all content and paste:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-micro-hpa
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    targetRevision: stag
    path: manifests/hpa
  destination:
    server: https://kubernetes.default.svc
    namespace: staging
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

4. Click **"SAVE"** → **"CREATE"**
5. Click **"SYNC"** → **"SYNCHRONIZE"**

### Step 3: Verify HPA Deployment

After syncing, click on **async-micro-hpa** app. You should see:

```
async-micro-hpa (Healthy, Synced)
├── HorizontalPodAutoscaler/api-hpa ✓
├── HorizontalPodAutoscaler/gateway-hpa ✓
├── HorizontalPodAutoscaler/product-hpa ✓
├── HorizontalPodAutoscaler/worker-hpa ✓
└── Deployment/metrics-server (kube-system) ✓
```

### Step 4: Deploy Load Test Application

If `async-micro-load-test` doesn't exist, create it:

1. Click **"+ NEW APP"**
2. Click **"EDIT AS YAML"**
3. Paste:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: async-micro-load-test
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/Ridwan414/async-micro.git
    targetRevision: stag
    path: load-test
  destination:
    server: https://kubernetes.default.svc
    namespace: staging
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
```

4. Click **"SAVE"** → **"CREATE"**

### Step 5: Trigger Load Test

1. Click on **async-micro-load-test** app
2. Click **"SYNC"** → **"SYNCHRONIZE"**
3. Watch the Jobs deploy:

```
async-micro-load-test (Healthy, Synced)
├── Job/load-test-staging
│   └── Healthy 10 pods (running load)
├── Job/load-test-ab
│   └── Healthy 5 pods (running load)
└── Job/spike-test-staging
    └── Healthy 5 pods (running load)
```

### Step 6: Monitor Scaling in Real-Time

1. Go back to **Applications** list
2. Click on **async-micro-staging**
3. Click **"REFRESH"** dropdown → Enable **"Auto-Refresh"**
4. Watch the deployment replicas change!

**What to Look For:**

| Time | What You'll See |
|------|-----------------|
| 0-2 min | Load test pods starting, services receiving traffic |
| 2-5 min | HPA detects high CPU, triggers scale-up |
| 5-10 min | Pods increasing: API 2→10, Gateway 2→5, Product 1→5 |
| 10-15 min | Load test completes |
| 15-25 min | Stabilization window (pods stay high) |
| 25+ min | Gradual scale-down back to minimum |

### Step 7: View Scaling Details

**Option A: Click on a Deployment**

1. In **async-micro-staging**, click on `api` deployment
2. View the **SUMMARY** tab:
   - Current replicas
   - Desired replicas
   - Pod status

**Option B: Click on an HPA (if visible)**

1. In **async-micro-hpa**, click on `api-hpa`
2. View the **LIVE MANIFEST** tab to see current metrics

### Step 8: Re-run Load Test

To test scaling again:

1. Go to **async-micro-load-test** app
2. Click on each Job → Click **"DELETE"**
3. Click **"SYNC"** → **"SYNCHRONIZE"** to recreate jobs

### Visual Guide: What Scaling Looks Like in ArgoCD

**Before Load Test:**
```
async-micro-staging
├── api (deploy)
│   └── api-xxxxx ✓ (1 pod)
├── gateway (deploy)
│   └── gateway-xxxxx ✓ (2 pods)
├── product (deploy)
│   └── product-xxxxx ✓ (1 pod)
└── worker (deploy)
    └── worker-xxxxx ✓ (2 pods)
```

**During Load Test (After ~5 minutes):**
```
async-micro-staging
├── api (deploy)
│   ├── api-xxxxx ✓
│   ├── api-yyyyy ✓
│   ├── api-zzzzz ✓
│   ├── api-aaaaa ✓
│   └── ... (scaling to 10 pods) 📈
├── gateway (deploy)
│   ├── gateway-xxxxx ✓
│   ├── gateway-yyyyy ✓
│   ├── gateway-zzzzz ✓
│   └── ... (scaling to 5 pods) 📈
├── product (deploy)
│   ├── product-xxxxx ✓
│   └── ... (scaling to 5 pods) 📈
└── worker (deploy)
    └── worker-xxxxx ✓ (2 pods - no direct load)
```

**After Load Test (After ~25 minutes):**
```
async-micro-staging
├── api (deploy)
│   └── api-xxxxx ✓ (back to 2 pods) 📉
├── gateway (deploy)
│   └── gateway-xxxxx ✓ (back to 2 pods) 📉
├── product (deploy)
│   └── product-xxxxx ✓ (back to 1 pod) 📉
└── worker (deploy)
    └── worker-xxxxx ✓ (2 pods)
```

### Troubleshooting

#### Issue: Pods Not Scaling

**Possible Causes:**
1. HPA not deployed
2. Metrics server not running
3. Deployments missing resource requests

**Solution via ArgoCD:**
1. Check **async-micro-hpa** app exists and is **Synced**
2. In **async-micro-hpa**, verify `metrics-server` deployment is healthy
3. Check **async-micro-staging** deployments have resource limits

#### Issue: Load Test Not Running

**Possible Causes:**
1. Jobs already completed (Jobs run once)
2. Gateway service not accessible from load test pods

**Solution:**
1. Delete completed Jobs and re-sync
2. Check gateway-service exists in staging namespace

#### Issue: HPA Shows Unknown Metrics

**Cause:** Metrics server not collecting data yet

**Solution:** Wait 1-2 minutes after metrics-server deploys, then refresh

### Expected Scaling Behavior

| Service | Min | Max | CPU Target | Expected Scale-Up |
|---------|-----|-----|------------|-------------------|
| API | 2 | 10 | 50% | 2 → 6 → 10 |
| Gateway | 2 | 5 | 30% | 2 → 4 → 5 |
| Product | 1 | 5 | 50% | 1 → 3 → 5 |
| Worker | 2 | 15 | 60% | Minimal (no direct HTTP load) |

### Timeline Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTOSCALING TEST TIMELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  T+0 min    │ Sync load-test app → Jobs created → 20 pods start             │
│             │                                                                │
│  T+2 min    │ Load hits services → CPU increases                            │
│             │                                                                │
│  T+3 min    │ HPA detects high CPU → triggers scale-up                      │
│             │                                                                │
│  T+5 min    │ New pods running → API: 10, Gateway: 5, Product: 5            │
│             │                                                                │
│  T+10 min   │ Load test Jobs complete → load decreases                      │
│             │                                                                │
│  T+15 min   │ Stabilization window (5 min) → no scale-down yet              │
│             │                                                                │
│  T+20 min   │ Scale-down starts → 50% reduction per minute                  │
│             │                                                                │
│  T+25 min   │ Back to minimum → API: 2, Gateway: 2, Product: 1              │
│             │                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Quick Reference: ArgoCD Apps for Autoscaling

| Application | Purpose | Path | Auto-Sync |
|-------------|---------|------|-----------|
| async-micro-hpa | Deploy HPAs & metrics-server | `manifests/hpa` | Yes |
| async-micro-staging | Deploy services | `manifests/staging-manifests` | Yes |
| async-micro-load-test | Run load tests | `load-test` | No (manual) |
