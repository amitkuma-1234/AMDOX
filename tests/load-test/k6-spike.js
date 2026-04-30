// ─────────────────────────────────────────────────────────────
// AMDOX ERP — k6 Spike Test
// Scenario: Ramp to 5000 VUs in 30s, verify graceful degradation
// ─────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders } from './k6-config.js';

export const options = {
  stages: [
    { duration: '30s', target: 5000 },  // Spike!
    { duration: '1m', target: 5000 },   // Hold
    { duration: '2m', target: 100 },    // Recovery
    { duration: '1m', target: 0 },      // Cool down
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],  // Allow up to 10% errors during spike
    http_req_duration: ['p(95)<2000'], // Relaxed threshold during spike
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health/live`, { headers: defaultHeaders });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'no server error': (r) => r.status < 500,
  });
  sleep(0.1);
}
