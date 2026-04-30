# ADR-003: Kubernetes over Serverless

## Status
**Accepted** — 2024-02-01

## Context
AMDOX ERP needs a production deployment platform. We evaluated:

1. **Kubernetes (EKS)** — Container orchestration, full control
2. **Serverless (Lambda + Fargate)** — Managed, pay-per-invocation
3. **PaaS (Vercel + Railway)** — Managed, minimal ops

## Decision
We chose **Kubernetes (AWS EKS)** with Helm charts for deployment.

## Rationale

### Why Kubernetes

**1. Stateful Requirements**
- WebSocket connections for real-time updates
- Long-running payroll batch jobs (30+ minutes)
- ML model loading requires persistent memory (cold start = 30s on Lambda)
- Redis connection pooling requires persistent processes

**2. Resource Control**
- Fine-grained CPU/memory limits per service
- GPU node selector for ML workloads (future)
- HPA for auto-scaling based on custom metrics
- PDB for zero-downtime deployments

**3. Operational Maturity**
- Health checks (liveness + readiness probes)
- Rolling updates with configurable strategy
- Network policies for zero-trust security
- Service mesh (Istio) for canary deployments

**4. Multi-Service Orchestration**
- API + Web + ML Service + Keycloak + monitoring stack
- Service discovery via DNS
- Shared secrets and config via K8s resources

### Why NOT Serverless
- **Cold starts:** Lambda cold starts (1-5s) unacceptable for API latency targets (< 200ms P95)
- **Execution limits:** Lambda 15-min timeout too short for payroll batch processing
- **Connection limits:** Lambda creates new DB connections per invocation → connection pool exhaustion
- **Cost at scale:** Sustained traffic is cheaper on reserved instances than per-invocation pricing

### Why NOT PaaS
- Limited control over networking, security groups
- No GPU support for ML workloads
- Vendor lock-in concerns for enterprise clients
- Cannot run Keycloak, Elasticsearch, monitoring stack

## Consequences
- **Positive:** Full control, scalability, security, multi-service support
- **Negative:** Higher operational complexity (mitigated by Helm + ArgoCD + Terraform)
- **Cost:** ~$580-880/mo for production (acceptable for enterprise ERP)
