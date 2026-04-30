# Contributing to AMDOX ERP

Thank you for your interest in contributing to AMDOX! This guide covers development setup, code standards, and the contribution workflow.

## 📋 Prerequisites

- **Node.js** 22+ (via [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** 9.15+ (`corepack enable && corepack prepare pnpm@9.15.4`)
- **Docker** & Docker Compose
- **Python** 3.13+ (for ML service)
- **Git** 2.40+

## 🛠 Development Setup

```bash
# 1. Clone the repository
git clone https://github.com/amdox/amdox-erp.git
cd amdox-erp

# 2. Install dependencies
pnpm install

# 3. Start infrastructure
docker compose up -d

# 4. Configure environment
cp .env.example .env
# Edit .env with your local settings

# 5. Run database migrations
pnpm db:migrate
pnpm db:seed

# 6. Start development servers
pnpm dev  # Starts API + Web via Turborepo
```

## 📐 Code Style

### TypeScript / JavaScript
- **Linter:** ESLint (config in `.eslintrc.json`)
- **Formatter:** Prettier (config in `.prettierrc`)
- **Rules:** Strict TypeScript, no `any`, explicit return types on public methods

```bash
pnpm lint          # Run ESLint
pnpm format        # Auto-format with Prettier
pnpm format:check  # Check formatting (CI)
pnpm typecheck     # TypeScript type checking
```

### Python (ML Service)
- **Linter:** Ruff
- **Type Checker:** mypy (strict mode)
- **Style:** PEP 8, 100 char line length

```bash
cd apps/ml-service
ruff check .
mypy app/ --strict
```

### Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `style` | Formatting (no logic change) |
| `refactor` | Code restructuring |
| `perf` | Performance improvement |
| `test` | Adding/updating tests |
| `chore` | Build, CI, tooling |

**Examples:**
```
feat(finance): add multi-currency support for GL entries
fix(hr): correct leave balance calculation for part-time employees
docs(api): update Swagger annotations for payroll endpoints
```

## 🧪 Testing

### Unit Tests
```bash
pnpm test                    # All unit tests
pnpm test -- --watch         # Watch mode
pnpm test:cov                # With coverage
```

### Integration Tests
```bash
# Requires running PostgreSQL and Redis
pnpm test:e2e
```

### ML Service Tests
```bash
cd apps/ml-service
pytest --cov=app -v
```

### Test Patterns
- **Unit tests:** `*.spec.ts` colocated with source
- **Integration tests:** `test/` directory
- **Mocking:** Use `@nestjs/testing` for DI, `jest.mock()` for modules
- **Assertions:** Prefer explicit assertions over snapshot tests

## 🔀 Pull Request Process

### 1. Branch from `develop`
```bash
git checkout develop
git pull origin develop
git checkout -b feature/issue-123-add-currency-support
```

### 2. Make changes
- Write code with tests
- Update documentation if needed
- Ensure all checks pass locally:
  ```bash
  pnpm lint && pnpm typecheck && pnpm test
  ```

### 3. Submit PR
- Target branch: `develop`
- Title: `feat(finance): add multi-currency GL support (#123)`
- Fill in the PR template
- Link related issues

### 4. Review & Merge
- Minimum 1 approval required
- All CI checks must pass (lint, test, build, security scan)
- Squash merge preferred
- Delete branch after merge

## 🌿 Branching Strategy

```
main          ← Production (deployed via tags)
  └── develop ← Integration branch
       ├── feature/issue-123-description
       ├── fix/issue-456-bug-name
       └── chore/update-dependencies
```

- `main`: Production-ready. Deploys via tagged releases (`v1.0.0`)
- `develop`: Integration branch. Auto-deploys to staging
- `feature/*`: New features (from `develop`)
- `fix/*`: Bug fixes (from `develop`)
- `hotfix/*`: Critical fixes (from `main`, merged to both `main` and `develop`)

## 📁 Project Structure

```
amdox-erp/
├── apps/
│   ├── api/              # NestJS API server
│   ├── web/              # Next.js frontend
│   ├── ml-service/       # Python ML service
│   └── test/             # E2E tests
├── packages/
│   ├── db/               # Prisma schema & client
│   ├── types/            # Shared TypeScript types
│   └── ui/               # Shared UI components
├── charts/               # Helm charts
├── k8s/                  # Kubernetes manifests
├── terraform/            # Infrastructure as Code
├── observability/        # Monitoring configs
├── docs/                 # Documentation
├── prisma/               # Database schema
└── src/                  # Legacy source (migrating to apps/)
```
