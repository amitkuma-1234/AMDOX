// ─────────────────────────────────────────────────────────────
// AMDOX ERP — k6 Dashboard Query Load Test
// Scenario: 500 VUs hitting /api/metrics/financial
// ─────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

export const options = {
  stages: [
    { duration: '2m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    ...thresholds,
    http_reqs: ['rate>=100'], // Target: >= 100 req/s sustained
  },
};

export default function () {
  const endpoints = [
    '/metrics/financial',
    '/metrics/hr',
    '/metrics/scm',
    '/metrics/cash-flow',
  ];
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}?tenantId=test-tenant`, { headers: defaultHeaders });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 300ms': (r) => r.timings.duration < 300,
  });

  sleep(0.5);
}
