// ─────────────────────────────────────────────────────────────
// AMDOX ERP — k6 API Load Test
// Scenario: 2000 VUs, mixed read/write, 20 min total
// ─────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, defaultHeaders, thresholds } from './k6-config.js';

const errorRate = new Rate('errors');
const readDuration = new Trend('read_duration');
const writeDuration = new Trend('write_duration');

export const options = {
  stages: [
    { duration: '5m', target: 2000 },  // Ramp up
    { duration: '10m', target: 2000 }, // Steady state
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds,
};

export default function () {
  const rand = Math.random();

  if (rand < 0.3) {
    // 30% Read operations
    const res = http.get(`${BASE_URL}/accounts`, { headers: defaultHeaders });
    readDuration.add(res.timings.duration);
    check(res, { 'GET status 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  } else if (rand < 0.6) {
    // 30% Read - different endpoint
    const res = http.get(`${BASE_URL}/inventory`, { headers: defaultHeaders });
    readDuration.add(res.timings.duration);
    check(res, { 'GET inventory 200': (r) => r.status === 200 });
    errorRate.add(res.status !== 200);
  } else {
    // 40% Write operations
    const payload = JSON.stringify({
      title: `Load Test Widget ${Date.now()}`,
      type: 'KPI_CARD',
      query: 'SELECT COUNT(*) FROM accounts',
    });
    const res = http.post(`${BASE_URL}/dashboard/widgets`, payload, { headers: defaultHeaders });
    writeDuration.add(res.timings.duration);
    check(res, { 'POST status 201': (r) => r.status === 201 || r.status === 200 });
    errorRate.add(res.status >= 400);
  }

  sleep(Math.random() * 2 + 0.5);
}
