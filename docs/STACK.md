# Tech Stack — AgencyPulse

**Decided**: 2026-04-16
**Status**: Confirmed

---

## Backend

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | I/O-heavy workload (API calls, file gen); TypeScript ecosystem |
| Framework | NestJS | v10+ | Module system, DI container, guards for RBAC, built-in BullMQ/Redis support, Swagger auto-gen — essential at this complexity |
| Language | TypeScript | 5.x | Type safety across full stack |
| ORM | Prisma | v5+ | Type-safe schema, migrations, works well with PostgreSQL RLS |
| Auth | Passport.js + JWT | — | JWT for stateless auth; Passport for OAuth 2.0 integration flows |
| Validation | class-validator + class-transformer | — | NestJS native validation with DTOs |
| Docs | Swagger (OpenAPI) | — | Auto-generated via @nestjs/swagger decorators |

## Database

| Role | Technology | Rationale |
|---|---|---|
| Primary + Metrics | PostgreSQL 16+ | ACID, JSONB, Row Level Security for multi-tenancy, handles our data volume comfortably with proper indexing |
| Cache + Queue Backend | Redis 7+ | BullMQ uses Redis; API response caching; session storage |

**Decision: Plain PostgreSQL only — no TimescaleDB**
Current scale: 2–3 agencies, 10–25 integrations initially. Estimated data volume: ~700k metric rows/year max.
PostgreSQL with a composite index on `(tenant_id, client_id, integration, date)` handles this with ease.
TimescaleDB adds operational overhead (extension setup, hypertable config, continuous aggregates) that is not justified.
**Upgrade path**: TimescaleDB is a PostgreSQL extension — can be added to the same database later without migration if query latency becomes a problem at scale.

**Decision: Shared schema multi-tenancy with RLS**
Every table has `tenant_id UUID NOT NULL`. PostgreSQL Row Level Security enforces isolation at DB level.
NOT schema-per-tenant (doesn't scale past ~1000 tenants without heavy migration tooling).

## Background Jobs

| Technology | Role |
|---|---|
| BullMQ | Job queue — data fetching, report generation, email sending |
| Redis | BullMQ backend |
| @nestjs/bullmq | NestJS integration |

**Queue strategy**: One queue per integration type (not per tenant). Jobs tagged with `tenantId` metadata. Rate limiting per integration type to respect 3rd-party API limits.

## Frontend

| Technology | Version | Rationale |
|---|---|---|
| React | 19 | Latest stable; existing frontend uses it |
| TypeScript | 5.x | Type safety |
| Vite | 6 | Fast dev server + build; existing setup |
| TailwindCSS | v4 | Utility-first CSS; existing setup |
| Shadcn UI | Latest | Radix UI-based component library; existing setup |
| React Router | v7 | Routing; existing setup |
| TanStack Query | v5 | Server state, caching, invalidation for API calls |
| Zustand | v5 | Client-side state (auth state, UI state) |
| React Hook Form + Zod | Latest | Form handling + validation; existing setup |
| Recharts | v3 | Charts; existing setup |
| React Grid Layout | v2 | Drag-and-drop dashboard widgets; existing setup |

## Infrastructure (Target)

| Layer | Technology |
|---|---|
| Containerization | Docker + Docker Compose (dev), Docker (prod) |
| Cloud | AWS (RDS for PostgreSQL, ElastiCache for Redis, ECS for containers) |
| File Storage | AWS S3 / Cloudflare R2 (PDF reports, white-label assets) |
| Email | SendGrid (transactional + white-label sending domains) |
| CDN | Cloudflare |
| Monitoring | Sentry (errors), OpenTelemetry (tracing), Prometheus + Grafana (metrics) |

## What We Are NOT Using (and why)

| Rejected | Reason |
|---|---|
| Express (standalone) | Too much manual wiring for a codebase this complex; NestJS gives structure for free |
| MongoDB | Relational data needs SQL; PostgreSQL covers everything |
| TimescaleDB | Overkill for current scale (2–3 agencies, ~700k rows/year). Plain PostgreSQL with proper indexes is sufficient. Add later if needed. |
| InfluxDB / separate TSDB | Adds operational complexity with no SQL join capability |
| Schema-per-tenant | Doesn't scale past ~1000 tenants; migration complexity |
| Next.js for frontend | No SSR need for dashboard app; Vite is faster for SPA; existing setup already React+Vite |
| GraphQL | Adds complexity overhead; REST is sufficient and simpler for this use case |
