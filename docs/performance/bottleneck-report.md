# AMDOX ERP — Performance Bottleneck Report Template

**Date**: <!-- YYYY-MM-DD -->
**Environment**: <!-- staging / production -->
**Conducted by**: <!-- Engineer name -->
**Tool**: k6 v0.54+, Grafana, EXPLAIN ANALYZE

---

## 1. Executive Summary

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| P95 API Response | < 300ms | — | 🔲 |
| P99 API Response | < 500ms | — | 🔲 |
| Error Rate | < 1% | — | 🔲 |
| Throughput | ≥ 100 req/s | — | 🔲 |
| Batch Payroll (10k) | < 30s | — | 🔲 |
| Dashboard Metrics | < 300ms | — | 🔲 |

---

## 2. Test Configuration

```
Scenarios run:
- API Load Test:       2000 VUs × 10 min
- Dashboard Test:       500 VUs × 5 min
- Batch Test:            10 VUs × 5 min (payroll)
- Spike Test:          5000 VUs × 30s ramp
```

---

## 3. API Endpoint Latency Breakdown

| Endpoint | P50 | P95 | P99 | Throughput | Notes |
|----------|-----|-----|-----|------------|-------|
| GET /metrics/financial | — | — | — | — | |
| GET /metrics/hr | — | — | — | — | |
| GET /metrics/scm | — | — | — | — | |
| POST /payroll/process-batch | — | — | — | — | |
| GET /projects/:id/gantt | — | — | — | — | |
| POST /predict (ML) | — | — | — | — | |

---

## 4. Database Query Analysis

### Slow Queries (> 100ms)

```sql
-- Paste EXPLAIN ANALYZE output here
-- Run: EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) <your query>
```

| Query | Table | Duration | Issue | Fix |
|-------|-------|----------|-------|-----|
| — | — | — | Missing index | `CREATE INDEX …` |

### Missing Indexes

```sql
-- Check for sequential scans:
SELECT
  schemaname, tablename, seq_scan, idx_scan,
  round(seq_scan * 100.0 / NULLIF(seq_scan + idx_scan, 0), 1) AS seq_pct
FROM pg_stat_user_tables
ORDER BY seq_scan DESC LIMIT 20;
```

---

## 5. Memory & CPU Profile

| Service | Baseline CPU | Peak CPU | Baseline Mem | Peak Mem | Notes |
|---------|-------------|----------|--------------|----------|-------|
| NestJS API | — | — | — | — | |
| ML Service | — | — | — | — | |
| PostgreSQL | — | — | — | — | |
| Redis | — | — | — | — | |

---

## 6. Identified Bottlenecks

### Critical (blocks targets)
- [ ] <!-- Bottleneck 1 -->
- [ ] <!-- Bottleneck 2 -->

### High Priority
- [ ] <!-- Issue 1 -->

### Low Priority / Future
- [ ] <!-- Issue 1 -->

---

## 7. Optimization Actions

| # | Bottleneck | Action | Owner | ETA | Impact |
|---|------------|--------|-------|-----|--------|
| 1 | — | Add composite index on `(tenant_id, posting_date)` | — | — | High |
| 2 | — | Enable materialized views for BI queries | — | — | High |
| 3 | — | Add Redis caching layer for `/metrics/*` | — | — | Medium |
| 4 | — | Enable PgBouncer connection pooling | — | — | Medium |
| 5 | — | Increase ML service worker count to 4 | — | — | Medium |

---

## 8. Before / After Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| P95 Latency | — | — | — |
| Throughput | — | — | — |
| Error Rate | — | — | — |
| DB CPU | — | — | — |

---

## 9. Recommendations

1. **Short-term** (this sprint): Add missing indexes, enable Redis caching for dashboard metrics
2. **Medium-term** (next sprint): Deploy PgBouncer, implement materialized views
3. **Long-term** (Q3): Evaluate read replicas for BI workloads, consider TimescaleDB for time-series

---

## 10. Appendix — Raw k6 Output

```
Paste full k6 summary output here:
  k6 run k6-api.js --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)"
```
