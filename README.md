# AMDOX ERP Platform

AMDOX is a next-generation, multi-tenant Enterprise Resource Planning (ERP) platform built with NestJS, Prisma, and Keycloak. It is designed for high-performance, scalability, and robust enterprise-grade security.

## 🚀 Status: Phase 2 Completed

Phase 2 implementation is officially complete, adding core business modules for Finance, HR, and Supply Chain.

### Implemented Modules

#### 💎 Finance & Ledger (Phase 2)
- **General Ledger (GL):** Atomic double-entry financial ledger with multi-currency support.
- **AP/AR:** Accounts Payable and Accounts Receivable with 3-way matching and payment run workflows.
- **Fiscal Management:** Automated period closing and fiscal year transitions.

#### 👥 Human Resources & Payroll (Phase 2)
- **Employee Management:** Comprehensive lifecycle tracking from onboarding to offboarding.
- **Payroll Engine:** High-volume background processing (via BullMQ) for payslip generation.
- **Leave Management:** Automated entitlement tracking and approval workflows.

#### 📦 Supply Chain & Inventory (Phase 2)
- **Procurement:** Full Purchase Order lifecycle and Goods Receipt Note (GRN) processing.
- **Inventory Control:** Real-time stock tracking with multi-warehouse support.
- **Stock Movements:** Automated ledger integration for inventory valuation.

#### 🔐 Core Infrastructure (Phase 1)
- **Multi-tenant Architecture:** Secure data isolation at the database level.
- **Identity & Access (IAM):** Keycloak integration with RBAC/ABAC guards.
- **Monitoring & Health:** OpenTelemetry instrumentation and comprehensive health checks.

---

## 🛠 Project Setup

### Prerequisites
- Node.js (v20+)
- Docker & Docker Compose
- PostgreSQL, Redis, and Keycloak (Managed via Docker)

### Installation
```bash
$ npm install
```

### Environment Configuration
Copy `.env.example` to `.env` and configure your local settings.
```bash
$ cp .env.example .env
```

### Infrastructure Startup
```bash
$ npm run docker:up
```

### Database Migration & Seeding
```bash
$ npm run db:migrate
$ npm run db:seed
```

---

## 🏃 Running the Application

```bash
# development mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

---

## 🧪 Testing

```bash
# unit tests
$ npm run test

# integration tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

---

## 📜 License
AMDOX is [UNLICENSED](LICENSE).
