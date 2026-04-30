# ADR-001: Monolith (NestJS) over Microservices

## Status
**Accepted** — 2024-01-15

## Context
AMDOX ERP requires multiple business domains: Finance (GL, AP/AR), HR (Payroll, Leave), Supply Chain (Procurement, Inventory). We needed to decide between:

1. **Modular Monolith** — Single NestJS application with domain modules
2. **Microservices** — Separate services per domain (Finance, HR, SCM)

## Decision
We chose a **modular monolith** using NestJS modules with clear domain boundaries.

## Rationale

### Why Monolith
- **Team size:** Small team (< 10 engineers). Microservices add operational overhead that doesn't justify the benefits at this scale.
- **Data consistency:** ERP transactions span multiple domains (e.g., PO → GRN → GL entry). A monolith provides ACID transactions across domains without distributed sagas.
- **Development velocity:** Single codebase, single deployment, shared Prisma schema. Faster iteration in early stages.
- **Operational simplicity:** One Docker image, one deployment, one set of logs. Debugging is straightforward.

### Why NOT Microservices (for now)
- Distributed transactions require saga pattern → complex failure handling
- Service discovery, circuit breakers, API gateways → operational burden
- Network latency between services → slower cross-domain operations
- Team would spend more time on infrastructure than business logic

### Mitigation: Modular Design
NestJS modules enforce boundaries that make future extraction possible:
```
src/
├── finance/    → Could become finance-service
├── hr/         → Could become hr-service
├── scm/        → Could become scm-service
├── auth/       → Shared (Keycloak integration)
└── common/     → Shared utilities
```

## v2 Roadmap
When the team grows to 20+ engineers or specific domains need independent scaling:
1. Extract ML Service (already done — FastAPI)
2. Extract Payroll Engine (CPU-intensive background jobs)
3. Extract Reporting Service (read-heavy, can use read replicas)

## Consequences
- **Positive:** Fast development, simple operations, strong consistency
- **Negative:** Single point of failure (mitigated by replicas), scaling is all-or-nothing (mitigated by HPA)
- **Risk:** Module coupling if boundaries aren't maintained → enforce via ESLint rules and code review
