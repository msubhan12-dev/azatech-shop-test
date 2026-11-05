# Decisions

This file answers the four required decision questions. Detailed context is also available in [ARCHITECTURE.md](./ARCHITECTURE.md) under the ADRs section.

## a. How do I prevent stock from going negative when two orders arrive simultaneously?

I use **pessimistic row-level locking** (`SELECT ... FOR UPDATE`) inside a PostgreSQL transaction with `ReadCommitted` isolation level. When creating an order, I:

1. Sort the requested product IDs in ascending order
2. Lock each product row with `SELECT ... FOR UPDATE` (via `tx.$queryRaw`)
3. Check stock availability for each item
4. Deduct stock and record a `stock_movements` ledger entry
5. Commit the transaction

The ascending lock order is the key to avoiding deadlocks: if two concurrent orders share products, both transactions try to lock the same rows in the same order, so one waits for the other instead of creating a circular wait.

This is proven by the concurrency test (`apps/api/test/app.e2e.spec.ts` — "Stock Concurrency (WAJIB)") which sends 20 concurrent requests for a product with stock=5 and asserts exactly 5 succeed, 15 fail, and final stock is 0.

File: `apps/api/src/orders/orders.service.ts`, `createOrderInternal` method.

## b. Why is the folder and layer structure the way it is, and what would I change if the app grows?

The structure is **feature-based**: each domain (auth, products, customers, orders, reports, dashboard) is a self-contained NestJS module with its own controller, service, DTOs, and tests. Shared concerns (Prisma connection, Redis, guards, filters, interceptors) live in `common/` and are registered globally.

This makes it easy to find all code related to "orders" in one folder, rather than spreading controllers, services, and DTOs across different directories.

**If the app grows**, I would:
- Extract shared TypeScript types into a `@azatech/shared` package (used by both API and Web)
- Split into bounded-context microservices: an Order Service, Inventory Service, and Reporting Service
- Add an API Gateway for routing and cross-cutting concerns
- Use event-driven communication (Kafka/RabbitMQ) instead of direct DB access
- Move to CQRS for complex read/write separation (especially for reports)
- Add a dedicated `audit_logs` table separate from `stock_movements`

## c. A bug or problem I encountered, and how I found it

During development of the order creation logic, I discovered that **Prisma's typed client API does not expose `SELECT ... FOR UPDATE` row-level locks**. The `$transaction` interactive mode gives you a `TransactionClient` with all the Prisma methods, but none of them let you explicitly lock a row.

I found this when writing the concurrency test — without explicit locks, PostgreSQL's default `ReadCommitted` isolation doesn't prevent two transactions from reading the same stock value and both succeeding, leading to overselling.

**Solution**: I used `tx.$queryRaw` with raw SQL (`SELECT ... FROM products WHERE id = $1 FOR UPDATE`) inside the Prisma interactive transaction. This gives me both the locking guarantee and Prisma's type-safe update/insert API for the rest of the transaction.

File: `apps/api/src/orders/orders.service.ts`, lines with `tx.$queryRaw` in `createOrderInternal`.

## d. Parts that are unfinished or weak, and my next steps

**Unfinished / Weak:**
- **Frontend product create/update forms**: The API supports product CRUD, but the frontend only has list + detail views with stock adjustment. Create/edit product form is not built.
- **Playwright E2E tests**: Backend E2E tests exist (Vitest + Supertest), but browser-level E2E tests are not implemented.
- **Audit log**: Stock movements serve as a partial audit trail, but there's no dedicated `audit_logs` table for sensitive actions like product deletion or order cancellation.
- **Report export (CSV/Excel)**: Not implemented.
- **OpenTelemetry**: Not implemented (bonus item).
- **Rate limiting granularity**: Basic throttle exists, but per-endpoint limits could be more sophisticated.

**Next steps:**
1. Build the product create/edit form component with Zod validation
2. Add Playwright E2E tests covering: login → create order → pay → cancel → verify stock restored
3. Add `audit_logs` table with before/after snapshots for sensitive operations
4. Add a background job that generates CSV/Excel reports and emails them
5. Add OpenTelemetry tracing with spans for DB queries and job processing
