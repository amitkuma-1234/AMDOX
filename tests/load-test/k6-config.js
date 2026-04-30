// ─────────────────────────────────────────────────────────────
// AMDOX ERP — k6 Load Test Configuration
// ─────────────────────────────────────────────────────────────

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';
export const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test-bearer-token';

export const defaultHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'X-Tenant-ID': __ENV.TENANT_ID || 'test-tenant-id',
};

export const thresholds = {
  http_req_duration: ['p(95)<300', 'p(99)<500'],
  http_req_failed: ['rate<0.01'],
  http_reqs: ['rate>100'],
};
