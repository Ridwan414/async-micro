
## Load Testing Tools Comparison

### Tools Overview

| Tool | Language | Best For | Learning Curve | Resource Usage |
|------|----------|----------|----------------|----------------|
| **k6** ✓ (used) | JavaScript | Developer-friendly, CI/CD | Easy | Low |
| **Locust** | Python | Python teams, distributed | Easy | Medium |
| **JMeter** | Java/GUI | Complex scenarios, enterprise | Steep | High |
| **Gatling** | Scala | High performance, detailed reports | Medium | Medium |
| **Artillery** | JavaScript | Serverless, quick tests | Easy | Low |
| **wrk/wrk2** | C/Lua | Simple HTTP benchmarks | Easy | Very Low |
| **Vegeta** | Go | Constant rate testing | Easy | Very Low |

### When to Use What

| Scenario | Recommended Tool |
|----------|------------------|
| **CI/CD pipeline testing** | k6 ✅ |
| **Quick API benchmarks** | k6, wrk, Vegeta |
| **Python team** | Locust |
| **Enterprise/complex protocols** | JMeter |
| **Beautiful reports needed** | Gatling |
| **Real-time web UI monitoring** | Locust |
| **Grafana/Prometheus ecosystem** | k6 ✅ |

### Why k6 for This Project?

```
┌─────────────────────────────────────────────────────────────────┐
│                  WHY k6 IS THE BEST CHOICE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. GRAFANA ECOSYSTEM ALIGNMENT                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │  Logging:  Grafana + Loki                           │    │
│     │  Metrics:  Grafana + Prometheus                     │    │
│     │  Tracing:  Grafana + Jaeger                         │    │
│     │  Testing:  Grafana + k6  ← Same company!            │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│  2. CI/CD NATIVE                                                │
│     - Official GitHub Action: grafana/k6-action                 │
│     - Single binary, no dependencies                            │
│     - Exit codes for pass/fail                                  │
│                                                                 │
│  3. DEVELOPER FRIENDLY                                          │
│     - JavaScript (ES6)                                          │
│     - npm-like modules                                          │
│     - Easy to version control                                   │
│                                                                 │
│  4. MODERN FEATURES                                             │
│     - Thresholds (auto-fail on metrics)                         │
│     - Scenarios (ramp-up, constant, etc.)                       │
│     - Built-in protocols (HTTP, WebSocket, gRPC)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Code Comparison

**k6 (Current Choice)**
```javascript
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function() {
  let res = http.get('http://localhost:3000/health');
  check(res, { 'status 200': (r) => r.status === 200 });
}
```

**Locust (Alternative)**
```python
from locust import HttpUser, task

class WebsiteUser(HttpUser):
    @task
    def health_check(self):
        self.client.get("/health")
```

**JMeter** - GUI-based, requires `.jmx` XML file

### Running Load Tests

```bash
# Install k6
# Windows: choco install k6
# Mac: brew install k6
# Linux: sudo apt install k6

# Run load test
k6 run load-tests/load-test.js

# Run with custom options
k6 run --vus 50 --duration 1m load-tests/load-test.js

# Run against different environment
k6 run -e BASE_URL=http://localhost:3002 load-tests/load-test.js
```

### Load Test in CI/CD

```yaml
# In GitHub Actions
- name: Run k6 smoke test
  uses: grafana/k6-action@v0.3.1
  with:
    filename: load-tests/load-test.js
```

---

## Load Testing Best Practices

### 1. Test Types (Run in Order)

| Test Type | Purpose | Users | Duration |
|-----------|---------|-------|----------|
| **Smoke Test** | Verify system works | 1-2 | 1-2 min |
| **Load Test** | Baseline performance | Expected load | 5-15 min |
| **Stress Test** | Find breaking point | 2-3x expected | 10-20 min |
| **Spike Test** | Handle sudden bursts | Sudden ramp | 5-10 min |
| **Soak Test** | Find memory leaks | Normal load | 1-4 hours |

```
Traffic Pattern Visualization:

Smoke:    ___
Load:     ___/‾‾‾‾‾‾‾\___
Stress:   ___/‾‾‾/‾‾‾/‾‾‾\___
Spike:    ___/|\___/|\___
Soak:     ___/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\___
```

### 2. Key Metrics to Monitor

| Metric | Target | Critical |
|--------|--------|----------|
| **Response Time (p95)** | < 500ms | > 2000ms |
| **Response Time (p99)** | < 1000ms | > 5000ms |
| **Throughput (RPS)** | Baseline +20% | < Baseline |
| **Error Rate** | < 1% | > 5% |
| **CPU Usage** | < 70% | > 90% |
| **Memory Usage** | < 80% | > 95% |
| **Queue Depth** | < 100 | > 1000 |

### 3. Environment Best Practices

```
DO:
✓ Test against production-like environment
✓ Isolate load generator from target system
✓ Run load generator in same network/region
✓ Warm up the system before measuring
✓ Run tests multiple times for consistency
✓ Monitor all services (not just the entry point)

DON'T:
✗ Test against production without approval
✗ Run load generator on same machine as target
✗ Ignore infrastructure metrics (CPU, memory, network)
✗ Test with unrealistic data or patterns
✗ Skip warm-up phase
```

### 4. Load Testing Microservices

For async microservices like this project:

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHAT TO MEASURE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SYNCHRONOUS PATH (Gateway → API → Response)                    │
│  ├── Response time (p50, p95, p99)                              │
│  ├── Throughput (requests/second)                               │
│  └── Error rate                                                 │
│                                                                 │
│  ASYNCHRONOUS PATH (API → RabbitMQ → Worker)                    │
│  ├── Queue depth (messages waiting)                             │
│  ├── Processing rate (messages/second)                          │
│  ├── Consumer lag (time in queue)                               │
│  └── Worker throughput                                          │
│                                                                 │
│  INFRASTRUCTURE                                                 │
│  ├── Pod CPU/Memory usage                                       │
│  ├── HPA scaling events                                         │
│  └── Network I/O                                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. k6 Thresholds for This Project

```javascript
// Recommended thresholds for microservices
export let options = {
  thresholds: {
    // HTTP metrics
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // Response time
    http_req_failed: ['rate<0.01'],                   // Error rate < 1%

    // Custom metrics (if configured)
    'http_req_duration{endpoint:gateway}': ['p(95)<200'],
    'http_req_duration{endpoint:tasks}': ['p(95)<500'],
    'http_req_duration{endpoint:products}': ['p(95)<300'],
  },
};
```

### 6. Interpreting Results

```
GOOD RESULTS:
┌────────────────────────────────────────┐
│  ✓ checks.....................: 100%   │
│  ✓ http_req_duration..........: p95=89ms│
│  ✓ http_req_failed............: 0.00%  │
│  ✓ http_reqs..................: 5000/s │
└────────────────────────────────────────┘

BAD RESULTS (investigate):
┌────────────────────────────────────────┐
│  ✗ checks.....................: 85%    │  ← Failures occurring
│  ✗ http_req_duration..........: p95=2.5s│  ← Too slow
│  ✗ http_req_failed............: 15%    │  ← High error rate
│  ↓ http_reqs..................: 500/s  │  ← Throughput dropped
└────────────────────────────────────────┘
```

### 7. Common Issues & Solutions

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| High p99, low p50 | Resource contention | Scale horizontally, add HPA |
| Increasing latency over time | Memory leak | Check pod restarts, heap usage |
| Sudden errors at load | Connection limits | Increase connection pools |
| Queue depth growing | Workers too slow | Scale workers, optimize processing |
| Timeouts | Downstream service | Check dependent services |

### 8. Load Testing with Auto-Scaling

When testing with HPA enabled:

```bash
# 1. Watch HPA during test
kubectl get hpa -w

# 2. Watch pod scaling
kubectl get pods -w

# 3. Check RabbitMQ queue
kubectl exec rabbitmq-0 -- rabbitmqctl list_queues

# 4. Run load test
k6 run load-tests/stress-test.js
```

Expected behavior:
```
Time 0:00  - Base pods: 2
Time 0:30  - CPU > 50%, HPA triggers scale-up
Time 1:00  - Pods: 4, latency stabilizes
Time 2:00  - Load decreases, cooldown starts
Time 7:00  - Scale-down to 2 pods
```

---

## Kubernetes Load Test Jobs

In addition to k6, this project includes Kubernetes Job-based load tests that run directly in the cluster. These are useful for testing auto-scaling behavior from within the cluster network.

### Available Load Test Jobs

| Job | File | Purpose |
|-----|------|---------|
| **Load Test** | `load-test/load-test-job.yaml` | Gradual ramp-up to sustained heavy load |
| **Spike Test** | `load-test/spike-test-job.yaml` | Sudden traffic bursts to test HPA responsiveness |

### Spike Test

The spike test simulates sudden, dramatic traffic increases followed by rapid decreases - mimicking real-world scenarios like flash sales, viral content, or breaking news events.

#### Traffic Pattern

```
Requests/sec
    ^
    |         _____
    |        /     \
    |   ___/        \___
    |  /                \
    | /                  \
    |/                    \____
    +-------------------------> Time
    Phase: 1    2    3    4    5

Phase 1: Baseline (30s)     - Normal traffic, ~2 concurrent
Phase 2: Spike #1 (30s)     - Sudden surge, ~30 concurrent
Phase 3: Recovery (20s)     - Traffic drop, ~2 concurrent
Phase 4: Spike #2 (45s)     - Extreme surge, ~60 concurrent
Phase 5: Recovery (30s)     - Return to baseline
```

#### Running the Spike Test

```bash
# Apply the spike test job
kubectl apply -f load-test/spike-test-job.yaml

# Watch the pods start
kubectl get pods -n staging -l app=spike-test -w

# Follow the logs
kubectl logs -f -l app=spike-test -n staging

# Monitor HPA scaling in another terminal
kubectl get hpa -n staging -w

# Monitor pod scaling
kubectl get pods -n staging -w
```

#### Expected Results

| Phase | Requests (per pod) | Total (3 pods) |
|-------|-------------------|----------------|
| Baseline | ~120 | ~360 |
| Spike #1 | ~6,600 | ~19,800 |
| Recovery | ~40 | ~120 |
| Spike #2 | ~23,400 | ~70,200 |
| Final Recovery | ~120 | ~360 |
| **Total** | **~30,000** | **~90,000** |

#### HPA Response

During spike phases, you should observe:

```
NAME          REFERENCE            TARGETS            REPLICAS
gateway-hpa   Deployment/gateway   cpu: 156%/50%      5 (scaled from 2)
```

The HPA should:
1. Detect CPU spike above threshold (50%)
2. Scale gateway pods to maximum (5 replicas)
3. Stabilize latency as new pods come online
4. Eventually scale down during recovery period

#### Cleanup

```bash
# Delete the spike test job
kubectl delete job spike-test-staging -n staging

# Or delete all completed jobs
kubectl delete jobs -n staging -l app=spike-test
```

### Load Test Job

The standard load test provides sustained heavy traffic to test system capacity and autoscaling under prolonged load.

#### Running the Load Test

```bash
# Apply the load test job
kubectl apply -f load-test/load-test-job.yaml

# Monitor
kubectl logs -f -l app=load-test -n staging
kubectl get hpa -n staging -w
```

### Comparing Test Types

| Aspect | Spike Test | Load Test |
|--------|------------|-----------|
| **Duration** | ~3 minutes | ~5+ minutes |
| **Pattern** | Burst → Recovery → Burst | Gradual ramp → Sustained |
| **Use Case** | Test HPA responsiveness | Test sustained capacity |
| **Peak Concurrency** | 60 per pod | 200 per pod |
| **Pods** | 3 parallel | 5 parallel |

### Troubleshooting

**Pods stuck in ImagePullBackOff:**
- Check network connectivity from the cluster
- The spike test uses `asifmahmoud414/gateway-service:v1-stag` which should already be cached

**Job not completing:**
```bash
kubectl describe job spike-test-staging -n staging
kubectl logs -l app=spike-test -n staging --tail=50
```

**HPA not scaling:**
```bash
# Check HPA status and events
kubectl describe hpa gateway-hpa -n staging

# Verify metrics-server is running
kubectl get pods -n kube-system | grep metrics-server
```

---

## HPA Pod Scaling Deep Dive

This section explains how HPA calculates replica counts, with real log data from spike testing.

### HPA Configuration

```yaml
# Current gateway-hpa configuration
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 30    # Scale when CPU > 30%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80    # Scale when Memory > 80%
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 0     # Immediate scale-up
      policies:
      - type: Percent
        value: 100                      # Can double pods
        periodSeconds: 15               # Every 15 seconds
    scaleDown:
      stabilizationWindowSeconds: 60    # Wait 60s before scale-down
      policies:
      - type: Percent
        value: 100                      # Can remove all excess pods
        periodSeconds: 30
      - type: Pods
        value: 4                        # Or remove up to 4 pods
        periodSeconds: 30
      selectPolicy: Max                 # Use whichever removes more
```

### Pod Calculation Formula

HPA uses this formula to calculate desired replicas:

```
desiredReplicas = ceil(currentReplicas × (currentMetricValue / targetMetricValue))
```

**Example Calculations from Real Test Data:**

| Current State | Calculation | Result |
|--------------|-------------|--------|
| 3 pods, CPU 274% | `ceil(3 × (274/30))` | `ceil(27.4)` = 28 → capped at 10 |
| 10 pods, CPU 2% | `ceil(10 × (2/30))` | `ceil(0.67)` = 1 → raised to min 2 |
| 6 pods, Memory 69% | `ceil(6 × (69/80))` | `ceil(5.17)` = 6 (no change) |

### Scale-Up Behavior (Real Log Data)

During spike test, HPA scaled aggressively:

```
Time     CPU%   Memory%   Pods   HPA Event
──────────────────────────────────────────────────────────────────────
12:24:08   1%     52%      3     Baseline - spike test started
12:24:28  31%     55%      3     Load detected, above 30% threshold
12:24:43  78%     55%      3     CPU rising rapidly
12:24:58 274%     96%      6     New size: 6; reason: cpu resource utilization above target
12:25:13 316%    112%     10     New size: 10; reason: cpu resource utilization above target
12:25:28 361%    118%     10     At max replicas, cannot scale further
```

**Key Observations:**
- Scale-up happened in ~30 seconds (from 3 → 10 pods)
- `stabilizationWindowSeconds: 0` means no delay for scale-up
- CPU at 361% with 10 pods = would need 36 pods ideally

### What Happens at Max Replicas

When load exceeds capacity at max replicas, HPA shows:

```
Conditions:
  Type            Status  Reason            Message
  ----            ------  ------            -------
  ScalingLimited  True    TooManyReplicas   the desired replica count is more than the maximum replica count
```

**Real example at max:**
```
NAME          REFERENCE            TARGETS                           MINPODS   MAXPODS   REPLICAS
gateway-hpa   Deployment/gateway   cpu: 316%/30%, memory: 112%/70%   2         10        10
```

**Impact when maxed out:**
- HPA wants 28+ pods but capped at 10
- Response times may increase
- Error rates may rise
- Queue depth grows if using message queues

**Solutions:**
1. Increase `maxReplicas` if cluster has capacity
2. Optimize application to use less CPU
3. Add vertical scaling (more CPU per pod)
4. Implement request rate limiting

### Scale-Down Behavior (Real Log Data)

After spike test completed, scale-down was gradual:

```
Time     CPU%   Memory%   Pods   HPA Event
──────────────────────────────────────────────────────────────────────
12:28:00   2%    107%     10     Load stopped, metrics dropping
12:28:30   2%     65%     10     Memory normalizing
12:29:00   0%     64%     10     Stabilization window (60s)
12:29:30   1%     68%      7     New size: 7; reason: All metrics below target
12:30:00   0%     69%      6     New size: 6; reason: All metrics below target
12:30:30   1%     69%      6     Holding - memory would exceed 80% if scaled down
```

**Why it stopped at 6 pods:**
```
Calculation: If scaled to 5 pods
  Memory per pod at 6 pods = 69%
  Memory at 5 pods = 6 × 69% / 5 = 82.8%
  82.8% > 80% target → Don't scale down
```

### HPA Status Conditions Explained

From `kubectl describe hpa`:

| Condition | Status | Meaning |
|-----------|--------|---------|
| `AbleToScale: True, ReadyForNewScale` | Ready | HPA can scale if needed |
| `AbleToScale: True, ScaleDownStabilized` | Waiting | Recent recommendations were higher, waiting for stabilization |
| `ScalingActive: True, ValidMetricFound` | Working | Metrics are being collected successfully |
| `ScalingActive: False, FailedGetResourceMetric` | Error | Cannot get metrics (pods starting/stopping) |
| `ScalingLimited: True, TooManyReplicas` | Maxed | Wants more pods but at maxReplicas |
| `ScalingLimited: True, TooFewReplicas` | Floored | Wants fewer pods but at minReplicas |
| `ScalingLimited: False, DesiredWithinRange` | Normal | Desired replicas within min/max bounds |

### HPA Events Log Reference

Real events from spike test session:

```bash
$ kubectl describe hpa gateway-hpa -n staging

Events:
  Type     Reason             Age    Message
  ----     ------             ----   -------
  # Scale-up events during spike
  Normal   SuccessfulRescale  23m    New size: 6; reason: cpu resource utilization above target
  Normal   SuccessfulRescale  23m    New size: 10; reason: cpu resource utilization above target

  # Scale-down events after spike
  Normal   SuccessfulRescale  8m     New size: 8; reason: All metrics below target
  Normal   SuccessfulRescale  7m     New size: 7; reason: All metrics below target
  Normal   SuccessfulRescale  6m     New size: 6; reason: All metrics below target

  # Warning events (transient, during pod transitions)
  Warning  FailedGetResourceMetric  41m  failed to get cpu utilization: did not receive metrics
                                         for targeted pods (pods might be unready)
```

**Event Meanings:**

| Event Type | Reason | Description |
|------------|--------|-------------|
| `Normal` | `SuccessfulRescale` | Pods were successfully scaled up/down |
| `Warning` | `FailedGetResourceMetric` | Temporary - metrics unavailable during pod startup |
| `Warning` | `FailedComputeMetricsReplicas` | Cannot calculate replicas - usually transient |

### CPU vs Memory: Which Drives Scaling?

HPA uses the **higher** of the two calculated replica counts:

```
Scenario: 6 pods, CPU 10%, Memory 69%

CPU calculation:  ceil(6 × (10/30)) = ceil(2.0) = 2 pods
Memory calculation: ceil(6 × (69/80)) = ceil(5.17) = 6 pods

Result: max(2, 6) = 6 pods (memory is the limiting factor)
```

**Real-world implications:**

| Scenario | CPU-driven | Memory-driven |
|----------|-----------|---------------|
| Spike Test (burst requests) | ✓ Primary driver | Secondary |
| Post-spike (idle) | Low (0-2%) | ✓ Prevents scale-down |
| Memory leak | Normal | ✓ Keeps scaling up |
| Compute-heavy tasks | ✓ Primary driver | Usually stable |

### Tuning Recommendations

Based on our testing results:

| Parameter | Conservative | Aggressive (Current) | Use Case |
|-----------|-------------|---------------------|----------|
| `scaleUp.stabilizationWindowSeconds` | 60 | 0 | Fast response to spikes |
| `scaleDown.stabilizationWindowSeconds` | 300 | 60 | Quick recovery, cost savings |
| CPU target | 50% | 30% | Headroom for burst traffic |
| Memory target | 70% | 80% | Allow more consolidation |

### Monitoring Commands

```bash
# Real-time HPA monitoring
kubectl get hpa -n staging -w

# Detailed HPA status
kubectl describe hpa gateway-hpa -n staging

# Pod resource usage
kubectl top pods -n staging

# Watch pod scaling
kubectl get pods -n staging -l app=gateway -w

# Check metrics-server
kubectl top nodes
```

### Pod Status Reference

Understanding pod statuses from `kubectl get pods -w`:

#### Normal Lifecycle Statuses

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| `Pending` | Pod scheduled but container not started yet | Wait - pulling image or waiting for resources |
| `ContainerCreating` | Image pulled, container being created | Wait - normal startup |
| `Running` | Container running and healthy | None - working normally |
| `Completed` | Container finished successfully (exit code 0) | None - Job completed |
| `Terminating` | Pod being deleted, graceful shutdown in progress | Wait - cleaning up |

#### Error Statuses

| Status | Meaning | Common Causes | Fix |
|--------|---------|---------------|-----|
| `ErrImagePull` | Failed to pull container image | Wrong image name, no network, private registry | Check image name, registry credentials |
| `ImagePullBackOff` | Repeated image pull failures, backing off | Same as ErrImagePull | Fix image issue, then delete pod |
| `CrashLoopBackOff` | Container crashes repeatedly | App error, missing config, bad command | Check logs: `kubectl logs <pod>` |
| `Error` | Container exited with non-zero code | App crash, OOM killed, failed health check | Check logs and events |
| `OOMKilled` | Container exceeded memory limit | Memory leak, limit too low | Increase memory limit or fix leak |
| `CreateContainerError` | Cannot create container | Bad config, missing secrets/configmaps | Check pod events |
| `InvalidImageName` | Image name format is wrong | Typo in image name | Fix image name in deployment |

#### Real Examples from Log Data

**ImagePullBackOff (load-test pods):**
```
load-test-staging-bmd46    0/1     ErrImagePull        0     3h43m
load-test-staging-bmd46    0/1     ImagePullBackOff    0     3h43m
```
- First attempt: `ErrImagePull` - couldn't pull image
- Subsequent attempts: `ImagePullBackOff` - Kubernetes backs off retry attempts
- Fix: Check image exists, delete job and recreate with correct image

**Terminating → Error (gateway pods during scale-down):**
```
gateway-84db99d488-hzk2w   1/1     Terminating         0     15m
gateway-84db99d488-hzk2w   0/1     Error               0     15m
```
- `Terminating` - HPA requested scale-down, pod shutting down
- `Error` - Container didn't exit cleanly within grace period
- Usually harmless during scale-down - pod was force-killed

**Normal scale-down sequence:**
```
gateway-84db99d488-vppgp   1/1     Running       0     16m    # Healthy
gateway-84db99d488-vppgp   1/1     Terminating   0     16m    # SIGTERM sent
gateway-84db99d488-vppgp   0/1     Terminating   0     16m    # Container stopped
gateway-84db99d488-vppgp   0/1     Terminating   0     16m    # Cleanup
(pod disappears from list)                                     # Fully removed
```

#### READY Column Explained

The `READY` column shows `ready/total` containers:

| READY | Meaning |
|-------|---------|
| `0/1` | Container not ready (starting, failing, or terminating) |
| `1/1` | Container ready and passing health checks |
| `1/2` | 1 of 2 containers ready (sidecar pattern) |

#### Troubleshooting Commands

```bash
# Get detailed pod status
kubectl describe pod <pod-name> -n staging

# Check container logs
kubectl logs <pod-name> -n staging

# Check previous container logs (after crash)
kubectl logs <pod-name> -n staging --previous

# Watch events in namespace
kubectl get events -n staging --sort-by='.lastTimestamp'

# Force delete stuck terminating pod
kubectl delete pod <pod-name> -n staging --force --grace-period=0
```

#### Cleaning Up Failed Jobs

```bash
# Delete specific job and its pods
kubectl delete job load-test-staging -n staging

# Delete all failed pods in namespace
kubectl delete pods -n staging --field-selector=status.phase=Failed

# Delete all completed jobs
kubectl delete jobs -n staging --field-selector=status.successful=1
```

### Complete Scaling Timeline (Real Test)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SPIKE TEST SCALING TIMELINE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Pods                                                                        │
│   10 ─────────────────────────────■■■■■■■■■■■■■■■────────────────────────   │
│    9 ─────────────────────────────────────────────────────────────────────   │
│    8 ─────────────────────────────────────────────────■──────────────────   │
│    7 ───────────────────────■─────────────────────────────■──────────────   │
│    6 ─────────────────────■───────────────────────────────────■■■■■■■■■■■   │
│    5 ───────────────────■─────────────────────────────────────────────────   │
│    4 ─────────────────■───────────────────────────────────────────────────   │
│    3 ─■■■■■■■■■■■■■■■─────────────────────────────────────────────────────   │
│    2 ─────────────────────────────────────────────────────────────────────   │
│      │         │         │         │         │         │         │           │
│    12:24     12:25     12:26     12:27     12:28     12:29     12:30        │
│                                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Events:                                                                     │
│  12:24:08 - Spike test started (3 pods baseline)                            │
│  12:24:28 - CPU exceeds 30% threshold                                       │
│  12:24:58 - Scale to 6 pods (CPU-driven)                                    │
│  12:25:13 - Scale to 10 pods (max reached)                                  │
│  12:27:00 - Spike test completed                                            │
│  12:28:00 - Stabilization window starts                                     │
│  12:29:30 - Scale down begins (10 → 7)                                      │
│  12:30:30 - Stabilizes at 6 pods (memory-limited)                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```