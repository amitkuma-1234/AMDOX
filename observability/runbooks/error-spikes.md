# Runbook: Troubleshooting Error Spikes

## Symptoms
- Error rate > 2% for 2+ minutes
- Grafana alert: `HighErrorRate` firing
- 5xx responses increasing in logs

## Quick Diagnosis (< 5 min)

### 1. Check Error Rate
```bash
curl -s 'http://prometheus:9090/api/v1/query?query=sum(rate(http_requests_total{status=~"5.."}[2m]))/sum(rate(http_requests_total[2m]))*100'
```

### 2. Check Logs for Errors
```bash
# Loki query: recent errors
# LogQL: {job="api"} | json | level="ERROR" | line_format "{{.message}}"

# Kubernetes logs
kubectl logs -l app.kubernetes.io/component=api -n amdox-production --tail=50 | grep -i error
```

### 3. Check Traces for Errors
- Open Jaeger UI: `http://jaeger:16686`
- Search: service=amdox-api, tags=error=true, min duration=0

### 4. Check Dependencies
```bash
# Database connectivity
kubectl exec -it $(kubectl get pod -l app.kubernetes.io/component=api -o jsonpath='{.items[0].metadata.name}' -n amdox-production) -n amdox-production -- node -e "fetch('http://localhost:4000/health/ready').then(r=>r.json()).then(console.log)"

# Redis connectivity
redis-cli -h redis -a $REDIS_PASSWORD ping
```

## Common Causes & Fixes

| Error Pattern | Cause | Fix |
|--------------|-------|-----|
| 500 on all endpoints | Database down | Check postgres pod, restart if needed |
| 500 on specific endpoint | Bug in handler | Check recent deployments, rollback |
| 502 Bad Gateway | Pod crashing | Check pod events: `kubectl describe pod` |
| 503 Service Unavailable | All pods unhealthy | Check readiness probes, restart |
| 504 Gateway Timeout | Upstream timeout | Increase timeout or fix slow dependency |
| Spike after deploy | Regression | Rollback: `kubectl rollout undo deployment/amdox-api` |

## Remediation

### Rollback (if caused by recent deploy)
```bash
kubectl rollout undo deployment/amdox-api -n amdox-production
kubectl rollout status deployment/amdox-api -n amdox-production
```

### Restart Unhealthy Pods
```bash
kubectl delete pod -l app.kubernetes.io/component=api --field-selector=status.phase!=Running -n amdox-production
```

### Circuit Break (disable problematic feature)
```bash
# Feature flag via ConfigMap
kubectl patch configmap amdox-config -n amdox-production -p '{"data":{"FEATURE_X_ENABLED":"false"}}'
kubectl rollout restart deployment/amdox-api -n amdox-production
```

## Escalation
- **Error rate > 2%**: Auto-alert to Slack
- **Error rate > 5%**: PagerDuty page on-call
- **Error rate > 10%**: Incident (P1), all-hands
- **Post-incident**: Create RCA within 48 hours
