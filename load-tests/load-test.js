import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const taskCreationTrend = new Trend('task_creation_duration');
const productListTrend = new Trend('product_list_duration');

// Test configuration - shorter for demo
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Ramp up to 10 users
    { duration: '20s', target: 30 },   // Ramp up to 30 users
    { duration: '20s', target: 30 },   // Stay at 30 users
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% of requests under 1s
    errors: ['rate<0.3'],                // Error rate under 30%
  },
};

const GATEWAY_URL = __ENV.GATEWAY_URL || 'http://localhost:3000';
const BACKEND_URL = __ENV.BACKEND_URL || 'http://localhost:8000';
const PRODUCT_URL = __ENV.PRODUCT_URL || 'http://localhost:8001';

export default function () {
  // Test 1: Health check via gateway
  const healthRes = http.get(`${GATEWAY_URL}/health`);
  check(healthRes, {
    'gateway health is 200': (r) => r.status === 200,
  });

  // Test 2: Create async task (direct to backend)
  const taskPayload = JSON.stringify({
    task_type: 'load_test',
    id: Math.random().toString(36).substring(7),
    message: `Load test at ${new Date().toISOString()}`,
  });

  const taskStart = Date.now();
  const taskRes = http.post(`${BACKEND_URL}/task`, taskPayload, {
    headers: { 'Content-Type': 'application/json' },
  });
  taskCreationTrend.add(Date.now() - taskStart);

  const taskSuccess = check(taskRes, {
    'task creation status is 202': (r) => r.status === 202,
  });
  errorRate.add(!taskSuccess);

  sleep(0.3);

  // Test 3: Get products (direct to product service)
  const productStart = Date.now();
  const productRes = http.get(`${PRODUCT_URL}/products`);
  productListTrend.add(Date.now() - productStart);

  const productSuccess = check(productRes, {
    'product list status is 200': (r) => r.status === 200,
  });
  errorRate.add(!productSuccess);

  sleep(0.5);
}
