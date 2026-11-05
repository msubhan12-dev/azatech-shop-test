# Azatech Shop — Online Shop Order Management System

Production-grade order management system with product, customer, and multi-item order management featuring an order status state machine, stock concurrency control, idempotency, background jobs, and role-based access control.

## Tech Stack

| Component | Technology | Reason |
|-----------|-----------|--------|
| Backend | NestJS (TypeScript, strict mode) | Modular architecture, DI, excellent testing support |
| Frontend | Next.js 15 + React 19 + TypeScript | App Router, SSR, code-splitting |
| Database | PostgreSQL 16 | ACID compliance, row-level locking, mature |
| ORM | Prisma 6 | Type-safe queries, migrations, excellent DX |
| Queue | BullMQ + Redis | Reliable background jobs with retry/backoff |
| Cache | Redis (ioredis) | Fast in-memory cache for dashboard summary |
| Auth | JWT (access + refresh with rotation) | Stateless, secure token rotation |
| Testing | Vitest + Supertest | Fast unit + integration/e2e testing |
| UI | Tailwind CSS | Utility-first, responsive |
| Data Fetching | TanStack Query | Cache invalidation, optimistic updates |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Or Node.js 24+ and pnpm 9+

### Option 1: Docker Compose (recommended)

```bash
# Clone
git clone <repo-url> azatech-shop
cd azatech-shop

# Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Build and start all services
docker compose up --build

# The system will:
# 1. Start PostgreSQL, Redis, Mailpit
# 2. Run migrations + seed
# 3. Start API on http://localhost:3001
# 4. Start Worker (background jobs)
# 5. Start Web on http://localhost:3000
```

### Option 2: Local Development

```bash
# Install pnpm
npm install -g pnpm

# Install dependencies
pnpm install

# Start PostgreSQL and Redis (via Docker)
docker compose up db redis mailpit -d

# Setup database
cd apps/api
cp .env.example .env
npx prisma migrate deploy
npx prisma db seed
cd ../..

# Start API (terminal 1)
cd apps/api && pnpm dev

# Start Worker (terminal 2)
cd apps/api && npx ts-node src/worker.ts

# Start Web (terminal 3)
cd apps/web && pnpm dev
```

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@azatech.id | Password123! |
| Cashier | cashier@azatech.id | Password123! |

## API Documentation

Swagger UI available at: http://localhost:3001/api/docs

## Running Tests

```bash
# Install dependencies
pnpm install

# Generate Prisma client
cd apps/api && npx prisma generate && cd ../..

# Unit tests (no DB required)
cd apps/api && pnpm test

# E2E tests (requires PostgreSQL + Redis running)
cd apps/api && pnpm test:e2e

# Frontend component tests
cd apps/web && pnpm test
```

For E2E tests, set environment variables:
```bash
export DATABASE_URL="postgresql://azatech:azatech_secret@localhost:5432/azatech_shop_test"
export REDIS_HOST=localhost
export REDIS_PORT=6379
export JWT_SECRET=test-jwt-secret
export JWT_REFRESH_SECRET=test-refresh-secret
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture, ADRs, and scaling discussion.

## Key Features

- **Stock Concurrency**: Pessimistic locking (SELECT FOR UPDATE) with ordered lock acquisition to prevent deadlocks and overselling
- **Idempotency**: Database-backed idempotency keys with payload validation for order creation
- **Order State Machine**: Centralized state transitions with role enforcement (409 on invalid transitions)
- **RBAC**: Backend-enforced role-based access control (admin vs cashier)
- **Background Jobs**: Invoice generation + email on PAID, low-stock notifications via BullMQ
- **Audit Ledger**: Every stock change recorded in stock_movements
- **Dashboard Cache**: Redis-cached dashboard summary with invalidation on mutations
- **Rate Limiting**: Login (5/min) and order creation (20/min) throttling
- **Structured Logging**: JSON logging with request_id propagation
- **Health Check**: GET /api/health checks DB + Redis

## Project Structure

```
azatech-shop/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Database schema
│   │   │   ├── seed.ts         # Seeder
│   │   │   └── migrations/     # SQL migrations
│   │   ├── src/
│   │   │   ├── auth/            # JWT auth + refresh rotation
│   │   │   ├── products/        # Product CRUD + stock adjustment
│   │   │   ├── customers/       # Customer CRUD
│   │   │   ├── orders/          # Order lifecycle, state machine, idempotency
│   │   │   ├── reports/         # Sales + top products reports
│   │   │   ├── dashboard/       # Cached dashboard summary
│   │   │   ├── queue/           # BullMQ processors (invoice, notifications)
│   │   │   ├── common/          # Guards, filters, interceptors, DTOs
│   │   │   └── main.ts         # API entry point
│   │   ├── test/               # E2E integration tests
│   │   └── Dockerfile
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/            # App Router pages
│       │   ├── components/      # Reusable components
│       │   ├── hooks/           # Custom hooks (useAuth, etc.)
│       │   ├── lib/             # API client, formatters
│       │   ├── store/           # Zustand state
│       │   └── types/           # TypeScript types
│       └── Dockerfile
├── docker-compose.yml
├── pnpm-workspace.yaml
└── .github/workflows/ci.yml
```

## CI/CD

GitHub Actions pipeline runs:
1. Lint & Type Check (TypeScript strict)
2. Unit Tests (state machine, domain logic)
3. E2E Tests (with PostgreSQL + Redis services)
4. Build (API + Web)

![CI Status](https://github.com/yourusername/azatech-shop/actions/workflows/ci.yml/badge.svg)

## AI Usage

See [AI_USAGE.md](./AI_USAGE.md) for details on AI tool usage during development.

## Unfinished / Known Limitations

- Product and customer create/update forms in frontend could use more robust error display
- E2E tests with Playwright for frontend not yet implemented (marked as bonus)
- OpenTelemetry tracing not implemented (bonus item)
- Audit log for sensitive actions partially implemented via stock_movements; full audit trail would need a separate table
- CSV/Excel export for reports not implemented (bonus item)

## License

MIT
