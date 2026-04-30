# AMDOX ERP — Security Policy

## Threat Model

### Assets
| Asset | Classification | Impact |
|-------|---------------|--------|
| Employee PII (SSN, PAN, email) | Confidential | Critical |
| Financial records (GL, invoices) | Confidential | High |
| Payroll data (salaries) | Restricted | Critical |
| API keys & secrets | Restricted | Critical |
| Application source code | Internal | Medium |

### Threat Categories (STRIDE)
| Threat | Mitigation |
|--------|-----------|
| **Spoofing** | Keycloak OIDC, JWT validation, MFA |
| **Tampering** | Input validation (class-validator), CSRF protection |
| **Repudiation** | Audit logging, immutable GL entries |
| **Information Disclosure** | Encryption at rest/transit, PII redaction in logs |
| **Denial of Service** | Rate limiting (Throttler), HPA auto-scaling |
| **Elevation of Privilege** | RBAC/ABAC guards, least privilege, non-root containers |

## Compliance

### SOC 2 Type II
- **Security:** Encryption, access controls, vulnerability scanning
- **Availability:** Multi-AZ, auto-failover, 99.9% SLA target
- **Confidentiality:** Data classification, encryption, access logs
- **Processing Integrity:** Input validation, atomic transactions
- **Privacy:** PII masking, data retention policies

### GDPR
- Right to access (data export API)
- Right to erasure (soft-delete with 30-day retention)
- Data minimization (collect only required fields)
- Consent management (via Keycloak)
- Data breach notification (< 72 hours)

### ISO 27001
- Information security management system (ISMS)
- Risk assessment and treatment
- Asset management and classification
- Access control policy enforcement
- Incident management procedures

## Authentication & Authorization

### SSO Flow
```
User → Web App → Keycloak (OIDC Authorization Code + PKCE)
     ← ID Token + Access Token + Refresh Token
     → API (Bearer JWT) → Validate signature (JWKS)
                        → Extract roles, tenantId
                        → RBAC guard check
                        → Process request
```

### Role Hierarchy
| Role | Permissions |
|------|------------|
| `super-admin` | Full system access |
| `tenant-admin` | Tenant configuration, user management |
| `finance-manager` | GL, AP/AR, fiscal periods |
| `hr-manager` | Employees, payroll, leave |
| `scm-manager` | Purchase orders, inventory |
| `employee` | Self-service (leave, payslips) |
| `viewer` | Read-only access |

## Data Protection

### Encryption
| Layer | Method |
|-------|--------|
| **In Transit** | TLS 1.3 (cert-manager, Let's Encrypt) |
| **At Rest (DB)** | Aurora encryption (AWS KMS) |
| **At Rest (Cache)** | ElastiCache encryption enabled |
| **At Rest (S3)** | SSE-KMS with automatic key rotation |
| **Secrets** | SealedSecrets / AWS Secrets Manager |

### PII Handling
- SSN, PAN numbers: masked in logs (`***-**-1234`)
- Email: hashed in telemetry traces
- IP addresses: not stored in application logs
- Passwords: never logged, Argon2 hashing (via Keycloak)

## Incident Response

### Severity Levels
| Level | Criteria | Response Time | Example |
|-------|----------|--------------|---------|
| P1 — Critical | Data breach, complete outage | < 15 min | DB credentials leaked |
| P2 — High | Partial outage, data risk | < 1 hour | API error rate > 10% |
| P3 — Medium | Degraded performance | < 4 hours | P95 latency > 3s |
| P4 — Low | Minor issue, no impact | < 24 hours | Non-critical CVE |

### Response Procedure
1. **Detect:** Alert from monitoring (PagerDuty/Slack)
2. **Triage:** Assess severity, assign incident commander
3. **Contain:** Isolate affected systems, rotate credentials
4. **Eradicate:** Fix root cause, deploy patch
5. **Recover:** Restore services, verify integrity
6. **Post-Mortem:** RCA within 48 hours, update runbooks

### Contacts
| Role | Contact |
|------|---------|
| Security Lead | security@amdox.io |
| On-Call Engineer | PagerDuty rotation |
| Data Protection Officer | dpo@amdox.io |
| Incident Commander | Rotating weekly |

## Vulnerability Management

### Scanning Schedule
| Scan Type | Frequency | Tool |
|-----------|-----------|------|
| Dependency audit | Daily | `pnpm audit`, Snyk |
| Container scan | Every build | Trivy |
| Secret detection | Every commit | TruffleHog |
| SAST | Every PR | Semgrep |
| DAST | Weekly | OWASP ZAP |
| Penetration test | Quarterly | External vendor |

### Patch SLA
| Severity | Patch Within |
|----------|-------------|
| Critical CVE | 24 hours |
| High CVE | 7 days |
| Medium CVE | 30 days |
| Low CVE | 90 days |

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

- **Email:** security@amdox.io
- **Do NOT** open a public GitHub issue
- Include: description, reproduction steps, impact assessment
- We will acknowledge within 24 hours
- We aim to patch critical issues within 24 hours
