# AMDOX ERP — Information Security Management System (ISMS) Policy

## 1. Purpose
This document establishes the ISMS policies for the AMDOX ERP Platform to ensure compliance with SOC 2 Type II, OWASP Top 10 2021, and industry best practices.

## 2. Scope
Applies to all AMDOX ERP services, infrastructure, and personnel.

## 3. Access Control (A01, CC6.2)
- **RBAC**: Role-based access on all API endpoints via Keycloak
- **ABAC**: Attribute-based tenant isolation on every data query
- **MFA**: Enforced per tenant configuration
- **Session**: 15-minute inactivity timeout, JWT RS256 with 1h TTL
- **Account lockout**: 5 failed attempts → 15 min lockout
- **Principle of least privilege**: Default deny, explicit allow

## 4. Cryptography (A02)
- **Transport**: TLS 1.3 enforced (HSTS header)
- **At Rest**: AES-256-GCM for sensitive fields (PAN, bank accounts)
- **Database**: RDS encryption enabled
- **File Storage**: S3 SSE-S3
- **Key Management**: Environment variables, rotated quarterly

## 5. Input Validation (A03)
- **Server**: class-validator on all DTOs, Prisma parameterized queries
- **Client**: Zod schema validation
- **XSS Prevention**: Helmet.js CSP headers, DOMPurify for HTML
- **No raw SQL**: All queries through Prisma ORM

## 6. Logging & Monitoring (A09, CC7.2)
- **Audit log**: All mutations logged to audit_logs table
- **PII masking**: SSN, PAN, account numbers redacted in logs
- **Structured logging**: JSON format to stdout (collected by Loki)
- **Tamper detection**: Hash-chained audit log entries
- **Alerts**: Failed login patterns, bulk data export, privilege escalation

## 7. Vulnerability Management (A06)
- **SCA**: Snyk scan in CI (fail on critical)
- **Container**: Trivy scan before push
- **Secrets**: TruffleHog scan in CI
- **Dependencies**: Quarterly audit, Dependabot auto-updates

## 8. Availability (CC9.1)
- **Uptime SLA**: 99.9% target
- **Health checks**: /health/live and /health/ready endpoints
- **Auto-scaling**: K8s HPA based on CPU/memory
- **Disaster recovery**: Daily database backups, 30-day retention

## 9. Incident Response
See: [Incident Response Playbook](./incident-response.md)

## 10. Review Schedule
- Quarterly penetration test + report
- Annual ISMS policy review
- Monthly vulnerability scan review
