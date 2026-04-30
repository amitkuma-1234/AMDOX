# AMDOX ERP Platform

<p align="center">
  <strong>Next-Generation, Multi-Tenant Enterprise Resource Planning</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22-339933?logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Python-3.13-3776AB?logo=python" alt="Python" />
  <img src="https://img.shields.io/badge/Kubernetes-ready-326CE5?logo=kubernetes" alt="K8s" />
  <img src="https://img.shields.io/badge/License-UNLICENSED-red" alt="License" />
</p>

---

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│  Next.js 15  │────▶│  NestJS 11  │────▶│ PostgreSQL 17   │
│  (Frontend)  │     │  (API)      │     │ (Aurora Srv v2) │
│  :3000       │     │  :4000      │     │  :5432          │
└─────────────┘     └──────┬──────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐     ┌─────────────────┐
                    │  Redis 8    │     │  ML Service      │
                    │  (Cache/MQ) │     │  FastAPI/Python  │
                    │  :6379      │     │  :8000           │
                    └─────────────┘     └─────────────────┘
                           │
                    ┌──────┴──────┐
                    │ Keycloak 25 │
                    │   (IAM)     │
                    │  :8080      │
                    └─────────────┘
```

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/amdox/amdox-erp.git
cd amdox-erp

# Install dependencies
pnpm install

# Start infrastructure (PostgreSQL, Redis, Keycloak, Elasticsearch)
docker compose up -d

# Configure environment
cp .env.example .env

# Run database migrations & seed
pnpm db:migrate
pnpm db:seed

# Start development
pnpm dev
```

## 📦 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15, React 19 | Dashboard, UI |
| **API** | NestJS 11, TypeScript | Business logic, REST API |
| **ML Service** | FastAPI, scikit-learn | AI/ML document intelligence |
| **Database** | PostgreSQL 17 (Aurora) | Primary data store (ACID) |
| **Cache** | Redis 8 | Caching, BullMQ job queues |
| **Auth** | Keycloak 25 | SSO, RBAC, OIDC |
| **Search** | Elasticsearch 8 | Full-text search, analytics |
| **Orchestration** | Kubernetes, Helm | Container orchestration |
| **IaC** | Terraform | AWS infrastructure |
| **CI/CD** | GitHub Actions, ArgoCD | Automated pipelines |
| **Observability** | Prometheus, Grafana, Jaeger | Metrics, logs, traces |

## 🧩 Modules

### Finance & Ledger
- **General Ledger (GL):** Atomic double-entry with multi-currency
- **AP/AR:** 3-way matching, payment run workflows
- **Fiscal Management:** Automated period closing

### Human Resources & Payroll
- **Employee Management:** Full lifecycle tracking
- **Payroll Engine:** BullMQ background processing
- **Leave Management:** Automated entitlements

### Supply Chain & Inventory
- **Procurement:** Purchase Order lifecycle, GRN
- **Inventory:** Real-time multi-warehouse tracking
- **Stock Movements:** Automated ledger integration

### Core Infrastructure
- **Multi-tenancy:** Database-level data isolation
- **IAM:** Keycloak SSO with RBAC/ABAC guards
- **Observability:** OpenTelemetry instrumentation

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, C4 diagrams, data flows |
| [API_DOCS.md](docs/API_DOCS.md) | REST API reference, auth, pagination |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Cloud deployment guide (AWS/K8s) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, code style, PR process |
| [SECURITY.md](SECURITY.md) | Threat model, compliance, incident response |

## 🧪 Testing

```bash
pnpm test              # Unit tests
pnpm test:e2e          # Integration tests
pnpm test:cov          # Coverage report
```

## 🐳 Docker

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.prod.yml up -d

# Observability stack
docker compose -f observability/docker-compose.observability.yml up -d
```

## ☸️ Kubernetes

```bash
# Install via Helm
helm install amdox charts/amdox-erp -f charts/amdox-erp/values-prod.yaml

# Validate
helm lint charts/amdox-erp
helm template amdox charts/amdox-erp --dry-run
```

## 🏗️ Infrastructure (Terraform)

```bash
cd terraform
terraform init -backend-config=environments/prod/backend.hcl
terraform plan -var-file=environments/prod/terraform.tfvars
terraform apply -var-file=environments/prod/terraform.tfvars
```

## 📜 License

AMDOX is [UNLICENSED](LICENSE).
