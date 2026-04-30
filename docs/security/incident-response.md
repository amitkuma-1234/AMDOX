# AMDOX ERP — Incident Response Playbook

## 1. Severity Levels

| Level | Description | Response Time | Escalation |
|-------|-------------|---------------|------------|
| P1 | Data breach, service down | 15 min | CTO, Legal |
| P2 | Security vulnerability, partial outage | 1 hour | Engineering Lead |
| P3 | Performance degradation, minor bug | 4 hours | On-call engineer |
| P4 | Cosmetic, non-urgent | Next business day | Team backlog |

## 2. Response Phases

### Phase 1: Detection & Triage (0-15 min)
1. Alert received (PagerDuty / Grafana / manual)
2. Assign incident commander
3. Classify severity (P1-P4)
4. Create incident channel (#incident-YYYY-MM-DD)

### Phase 2: Containment (15-60 min)
1. Isolate affected systems
2. Block suspicious IPs/accounts
3. Preserve evidence (logs, snapshots)
4. Communicate status to stakeholders

### Phase 3: Eradication (1-4 hours)
1. Identify root cause
2. Deploy fix (hotfix branch)
3. Verify fix in staging
4. Deploy to production

### Phase 4: Recovery (4-24 hours)
1. Restore affected data from backups
2. Monitor for recurrence
3. Re-enable affected services
4. Confirm all systems nominal

### Phase 5: Post-Incident (1-5 days)
1. Blameless post-mortem
2. Document timeline and decisions
3. Identify preventive measures
4. Update runbooks and policies
5. Share lessons learned

## 3. Communication Templates

### Internal Alert
```
[P{LEVEL}] Incident: {TITLE}
Time: {TIMESTAMP}
Impact: {DESCRIPTION}
Commander: {NAME}
Channel: #incident-{DATE}
```

### External (Customer-facing)
```
We are currently investigating an issue affecting {SERVICE}.
Current status: {STATUS}
Expected resolution: {ETA}
Updates: status.amdox.com
```

## 4. Contacts
- On-call: PagerDuty rotation
- Engineering Lead: escalation@amdox.com
- Legal: legal@amdox.com
- Security: security@amdox.com
