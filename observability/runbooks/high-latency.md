# Runbook: Troubleshooting High Latency

## Symptoms
- P95 latency > 1s for 5+ minutes
- Grafana alert: `HighP95Latency` firing
- Users reporting slow page loads or API timeouts

## Quick Diagnosis (< 5 min)

### 1. Check Current Latency
```bash
# Prometheus query
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket[5m]))by(le,service_name))'
```

### 2. Identify Slow Endpoints
```bash
# Top 10 slowest endpoints
curl -s 'http://prometheus:9090/api/v1/query?query=topk(10,histogram_quantile(0.95,sum(rate(http_request_duration_seconds_bucket[5m]))by(le,handler)))'
```

### 3. Check Database Queries
```bash
# Slow query log
kubectl logs -l app.kubernetes.io/component=api -n amdox-production --tail=100 | grep "slow_query"

# DB query duration
curl -s 'http://prometheus:9090/api/v1/query?query=histogram_quantile(0.95,sum(rate(db_query_duration_seconds_bucket[5m]))by(le))'
```

### 4. Check Redis
```bash
# Cache hit rate (should be > 80%)
curl -s 'http://prometheus:9090/api/v1/query?query=rate(cache_hits_total[5m])/(rate(cache_hits_total[5m])%2Brate(cache_misses_total[5m]))*100'

# Redis latency
redis-cli --latency -h redis -a $REDIS_PASSWORD
```

## Root Cause Analysis

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| All endpoints slow | DB connection pool exhausted | Increase `connection_limit` in DATABASE_URL |
| Single endpoint slow | Missing index or N+1 query | Add index, optimize query |
| Periodic spikes | Background job contention | Adjust job scheduling |
| Cache miss rate high | Cache eviction or cold start | Increase Redis `maxmemory` |
| Gradual degradation | Memory leak | Restart pods, investigate leak |

## Remediation Steps

### Database Issues
```bash
# Check active connections
kubectl exec -it postgres-0 -- psql -U amdox -c "SELECT count(*) FROM pg_stat_activity;"

# Kill long-running queries (> 30s)
kubectl exec -it postgres-0 -- psql -U amdox -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE duration > interval '30 seconds' AND state = 'active';"
```

### Scale Out
```bash
# Increase API replicas
kubectl scale deployment amdox-api --replicas=5 -n amdox-production

# Check HPA status
kubectl get hpa -n amdox-production
```

### Restart (Last Resort)
```bash
kubectl rollout restart deployment/amdox-api -n amdox-production
```

## Escalation
- **Severity**: Warning → Slack #amdox-alerts
- **Duration > 15 min**: Escalate to on-call engineer (PagerDuty)
- **Duration > 30 min**: Incident (P2), create post-mortem
