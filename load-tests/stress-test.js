import http from 'k6/http';
import { check, sleep } from 'k6';

// Stress test configuration - find breaking point
export const options = {
  stages: [
    // { duration: '2m', target: 100 },   // Ramp to 100 users
    // { duration: '5m', target: 100 },   // Stay at 100
    // { duration: '2m', target: 200 },   // Ramp to 200 users
    // { duration: '5m', target: 200 },   // Stay at 200
    { duration: '2m', target: 300 },   // Ramp to 300 users
    // { duration: '5m', target: 300 },   // Stay at 300
    { duration: '2m', target: 0 },     // Ramp down
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:30000';

export default function () {
  // Hammer the task creation endpoint
  const payload = JSON.stringify({
    task_type: 'stress_test',
    data: { timestamp: Date.now() },
  });

  const res = http.post(`${BASE_URL}/api/task`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(0.1);
}
