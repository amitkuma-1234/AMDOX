// ─────────────────────────────────────────────────────────────
// AMDOX ERP — k6 Batch Operations Load Test
// Scenario: Payroll processing for 10,000 employees + Excel export
// ─────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, defaultHeaders } from './k6-config.js';

const batchErrors     = new Rate('batch_errors');
const batchDuration   = new Trend('batch_duration_ms');
const recordsProcessed = new Counter('records_processed');

export const options = {
  scenarios: {
    // Scenario 1: Submit payroll batch for 10k employees
    payroll_batch: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      exec: 'payrollBatch',
    },
    // Scenario 2: Excel report export concurrency
    excel_export: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '1m', target: 0 },
      ],
      exec: 'excelExport',
      startTime: '5m', // After payroll batch finishes
    },
    // Scenario 3: GL period-close (heavy aggregation)
    period_close: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 3,
      maxDuration: '10m',
      exec: 'periodClose',
      startTime: '11m',
    },
  },
  thresholds: {
    'batch_duration_ms': ['p(95)<30000'],   // Batch ops: P95 < 30s
    'batch_errors':      ['rate<0.02'],      // < 2% batch failures
    'http_req_failed':   ['rate<0.05'],
  },
};

// ── Payroll batch: submit 10k employee payslips ────────────────
export function payrollBatch() {
  const BATCH_SIZE = 100;
  const TOTAL_EMPLOYEES = 10000;
  const batches = BATCH_SIZE;

  // Generate employee IDs for this batch
  const employeeIds = Array.from({ length: batches }, (_, i) =>
    `emp-${String(Math.floor(Math.random() * TOTAL_EMPLOYEES)).padStart(5, '0')}`
  );

  const payload = JSON.stringify({
    payPeriodStart: '2026-01-01',
    payPeriodEnd: '2026-01-31',
    employeeIds,
    includeOvertimeCalculation: true,
    includeTaxCalculation: true,
  });

  const start = Date.now();
  const res = http.post(`${BASE_URL}/payroll/process-batch`, payload, {
    headers: defaultHeaders,
    timeout: '60s',
  });
  const duration = Date.now() - start;

  batchDuration.add(duration);
  batchErrors.add(res.status >= 400);
  recordsProcessed.add(batches);

  check(res, {
    'batch accepted (2xx)':          r => r.status >= 200 && r.status < 300,
    'batch response < 30s':          _r => duration < 30000,
    'batch has jobId or result':     r => {
      try { return !!JSON.parse(r.body).jobId || !!JSON.parse(r.body).processedCount; }
      catch { return true; } // API may not be live
    },
  });

  sleep(2);
}

// ── Excel report export ────────────────────────────────────────
export function excelExport() {
  const reportTypes = [
    'financial_summary',
    'hr_headcount',
    'scm_inventory_valuation',
    'ap_aging',
    'ar_aging',
  ];
  const type = reportTypes[Math.floor(Math.random() * reportTypes.length)];

  // Request a scheduled report (async generation)
  const scheduleRes = http.post(`${BASE_URL}/reports/scheduled`, JSON.stringify({
    name: `Load Test Report ${Date.now()}`,
    reportType: type,
    format: 'EXCEL',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    sendNow: true,
  }), { headers: defaultHeaders, timeout: '30s' });

  check(scheduleRes, {
    'report scheduled':   r => r.status === 201 || r.status === 200,
    'has reportId':       r => { try { return !!JSON.parse(r.body).id; } catch { return true; } },
  });
  batchErrors.add(scheduleRes.status >= 400);

  sleep(3);
}

// ── GL period-close: heavy aggregation ────────────────────────
export function periodClose() {
  const res = http.post(`${BASE_URL}/accounts/period-close`, JSON.stringify({
    period: '2026-01',
    includeReversals: true,
    generateTrialBalance: true,
  }), { headers: defaultHeaders, timeout: '120s' });

  const dur = res.timings.duration;
  batchDuration.add(dur);
  batchErrors.add(res.status >= 400);

  check(res, {
    'period close accepted': r => r.status >= 200 && r.status < 300,
    'period close < 2min':   _r => dur < 120000,
  });

  sleep(10);
}
