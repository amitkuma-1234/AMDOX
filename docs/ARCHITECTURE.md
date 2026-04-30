# AMDOX ERP — System Architecture

## C4 Model — System Context

```mermaid
graph TB
    subgraph Users
        Admin["Admin User"]
        Employee["Employee"]
        Manager["Manager"]
    end

    subgraph AMDOX["AMDOX ERP Platform"]
        Web["Web App<br/>Next.js 15"]
        API["API Server<br/>NestJS 11"]
        ML["ML Service<br/>FastAPI"]
    end

    subgraph Infrastructure
        DB["PostgreSQL 17<br/>Aurora Serverless v2"]
        Cache["Redis 8<br/>ElastiCache"]
        Search["Elasticsearch 8"]
        IAM["Keycloak 25<br/>Identity Provider"]
    end

    subgraph Observability
        Prom["Prometheus"]
        Graf["Grafana"]
        Jaeger["Jaeger"]
        Loki["Loki"]
    end

    Admin --> Web
    Employee --> Web
    Manager --> Web
    Web --> API
    API --> DB
    API --> Cache
    API --> Search
    API --> IAM
    API --> ML
    API --> Prom
    Prom --> Graf
    Loki --> Graf
    Jaeger --> Graf
```

## Technology Stack

| Category | Technology | Version | Rationale |
|----------|-----------|---------|-----------|
| **Frontend** | Next.js + React | 15 / 19 | SSR, App Router, streaming |
| **Backend** | NestJS + TypeScript | 11 / 5.7 | Enterprise DI, decorators, modules |
| **ML/AI** | FastAPI + scikit-learn | 0.115 / 1.6 | Async, high performance, ML ecosystem |
| **Database** | PostgreSQL (Aurora) | 17 | ACID, JSON, partitioning, Serverless v2 |
| **ORM** | Prisma | 5.10 | Type-safe, migrations, schema-first |
| **Cache** | Redis | 8 | Sub-ms latency, BullMQ job queues |
| **Search** | Elasticsearch | 8.17 | Full-text search, analytics, aggregations |
| **Auth** | Keycloak | 25 | OIDC/SAML, RBAC, multi-tenant realms |
| **Container** | Docker + distroless | 22 | Minimal attack surface, no shell |
| **Orchestration** | Kubernetes + Helm | 1.29 | Auto-scaling, self-healing, declarative |
| **IaC** | Terraform | 1.7+ | Multi-cloud, state management, modules |
| **CI/CD** | GitHub Actions + ArgoCD | - | GitOps, canary deploys, auto-rollback |
| **Observability** | OTEL + Prometheus + Grafana | - | Metrics, traces, logs, dashboards |

## Deployment Topology

```mermaid
graph TB
    subgraph AWS["AWS Cloud (ap-south-1)"]
        subgraph VPC["VPC 10.0.0.0/16"]
            subgraph Public["Public Subnets"]
                ALB["Application<br/>Load Balancer"]
                NAT["NAT Gateway"]
            end
            subgraph Private["Private Subnets"]
                subgraph EKS["EKS Cluster"]
                    API_Pod["API Pods (x3)"]
                    Web_Pod["Web Pods (x2)"]
                    ML_Pod["ML Pod (x1)"]
                end
                RDS["Aurora PostgreSQL<br/>Writer + Reader"]
                ElastiCache["ElastiCache<br/>Redis Cluster"]
            end
        end
        S3["S3<br/>Backups/Exports"]
        CloudWatch["CloudWatch<br/>Logs/Metrics"]
        Route53["Route 53<br/>DNS"]
    end

    Internet["Internet"] --> Route53
    Route53 --> ALB
    ALB --> API_Pod
    ALB --> Web_Pod
    API_Pod --> RDS
    API_Pod --> ElastiCache
    API_Pod --> ML_Pod
    EKS --> CloudWatch
    RDS --> S3
```

## Data Flow — Purchase Order to Payment

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web (Next.js)
    participant A as API (NestJS)
    participant DB as PostgreSQL
    participant R as Redis
    participant Q as BullMQ

    U->>W: Create Purchase Order
    W->>A: POST /api/v1/purchase-orders
    A->>A: Validate (class-validator)
    A->>DB: BEGIN TRANSACTION
    A->>DB: INSERT purchase_order
    A->>DB: INSERT line_items
    A->>DB: COMMIT
    A->>R: Invalidate cache
    A->>Q: Enqueue approval notification
    A-->>W: 201 Created
    W-->>U: PO Created ✓

    Note over A,Q: Async approval workflow
    Q->>A: Process approval
    A->>DB: UPDATE po.status = APPROVED
    A->>DB: CREATE goods_receipt_note
    A->>DB: UPDATE inventory (stock_in)
    A->>DB: CREATE gl_entry (debit/credit)
    A->>Q: Enqueue payment processing
```

## API Patterns

### REST Conventions
- **Base URL:** `/api/v1/`
- **Naming:** Plural nouns (`/invoices`, `/employees`)
- **Methods:** GET (list/read), POST (create), PATCH (update), DELETE (soft-delete)
- **Filtering:** `?status=ACTIVE&from=2024-01-01`
- **Pagination:** Cursor-based (`?cursor=abc&limit=20`)
- **Sorting:** `?sort=createdAt:desc`

### Error Response Schema
```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "Validation failed",
  "details": [
    { "field": "amount", "message": "Must be positive" }
  ],
  "timestamp": "2024-01-15T10:30:00Z",
  "path": "/api/v1/invoices",
  "traceId": "abc123"
}
```

## Database Schema (Core Entities)

```mermaid
erDiagram
    TENANT ||--o{ USER : has
    TENANT ||--o{ CHART_OF_ACCOUNTS : has
    USER ||--o{ ROLE : has
    
    CHART_OF_ACCOUNTS ||--o{ GL_ACCOUNT : contains
    GL_ACCOUNT ||--o{ GL_ENTRY : has
    GL_ENTRY }o--|| JOURNAL : "belongs to"
    
    TENANT ||--o{ EMPLOYEE : employs
    EMPLOYEE ||--o{ PAYSLIP : receives
    EMPLOYEE ||--o{ LEAVE_REQUEST : submits
    
    TENANT ||--o{ VENDOR : has
    VENDOR ||--o{ PURCHASE_ORDER : receives
    PURCHASE_ORDER ||--o{ PO_LINE_ITEM : contains
    PURCHASE_ORDER ||--o{ GOODS_RECEIPT : generates
    
    TENANT ||--o{ CUSTOMER : has
    CUSTOMER ||--o{ INVOICE : receives
    INVOICE ||--o{ PAYMENT : settles
```
