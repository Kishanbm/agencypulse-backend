# Architecture Decisions Log

Format: Decision → Why → Trade-offs → Date

---

## DECISION-001: NestJS over Express for Backend Framework
**Date**: 2026-04-16
**Decision**: Use NestJS as the backend framework instead of plain Express or Fastify.
**Why**: This platform has ~80+ integrations, background jobs, RBAC, multi-tenancy, OAuth flows, report generation, and white-labeling. NestJS provides: module system to organize by domain, DI container for service composition, built-in guards for role-based access, interceptors for tenant context injection, @nestjs/bullmq for queue integration, and @nestjs/swagger for API docs. Plain Express at this scale becomes a maintenance nightmare.
**Trade-offs**: More boilerplate upfront; heavier than Express; learning curve if team is Express-only. Acceptable because the structure pays dividends at scale.

---

## DECISION-002: Shared Schema Multi-Tenancy with PostgreSQL RLS
**Date**: 2026-04-16
**Decision**: Single database, single schema, `tenant_id` on every table, enforced via PostgreSQL Row Level Security.
**Why**: Schema-per-tenant approach doesn't scale past ~1000 tenants. Running migrations across thousands of schemas is a DevOps nightmare. RLS gives DB-level isolation with a single schema. Composite indexes on `(tenant_id, ...)` keep overhead to 2–4%.
**Trade-offs**: RLS policies must be tested rigorously (violations are silent — wrong data, no error). Application role must NOT be the table owner or RLS is bypassed. Add pgTAP tests for RLS in CI.
**How**: Set `SET app.current_tenant = '<uuid>'` as session variable in NestJS middleware. Every query automatically filters by tenant.
**Implementation (Phase 1.3)**:
- `current_tenant_id()` SECURITY DEFINER SQL function wraps `current_setting('app.current_tenant', true)` — returns NULL safely instead of throwing when GUC is unset.
- One `PERMISSIVE` policy per table, applied to the `agencypulse` app role only. Migration role (postgres) bypasses RLS for migrations and admin ops.
- `agencies` table policy: `id = current_tenant_id()` — agency can only see itself.
- All other tables: `tenant_id = current_tenant_id()`.
- `scripts/setup-db-role.sql` creates the `agencypulse` DB role with DML grants — run once as superuser before migrations.
- `PrismaService.$use()` middleware sets `SET app.current_tenant` before every query and `RESET app.current_tenant` in the `finally` block — prevents connection reuse leakage in the pool.

---

## DECISION-003: Plain PostgreSQL for Metrics — No TimescaleDB
**Date**: 2026-04-16 (revised same day)
**Decision**: Use plain PostgreSQL for all data including metrics. No TimescaleDB extension.
**Why**: Current scale is 2–3 agencies with 10–25 integrations initially. Estimated volume ~700k metric rows/year maximum. PostgreSQL with a composite index on `(tenant_id, client_id, integration, date)` handles this comfortably. TimescaleDB adds real operational overhead (extension setup, hypertable config, continuous aggregate maintenance) with zero benefit at this volume.
**Upgrade path**: TimescaleDB is a PostgreSQL extension — can be enabled on the same database instance later with a single command + table conversion, no data migration needed. Design the metrics table with this in mind (date column as primary time dimension).
**Trade-offs**: Slightly less query performance at extreme scale. Irrelevant at current scale. Saves complexity now.

---

## DECISION-004: BullMQ + Redis for Background Jobs
**Date**: 2026-04-16
**Decision**: Use BullMQ (backed by Redis) for all background job processing.
**Why**: BullMQ is purpose-built for Node.js, uses Redis as backend (which we already need for caching), has built-in retry/backoff/rate-limiting/priority/delayed jobs. Queue-per-integration-type approach prevents one slow integration from blocking others. Jobs carry `tenantId` metadata for isolation.
**Pattern**: One queue per integration type (google_ads, meta_ads, ga4...), not per tenant. Workers horizontally scalable.
**Trade-offs**: Redis is a required dependency; adds operational overhead. Acceptable given Redis is also needed for caching.

---

## DECISION-005: Separate Backend and Frontend Repos
**Date**: 2026-04-16
**Decision**: Backend lives in `D:\projects\agency-backend`, frontend in `D:\projects\agencypulse`. They are separate Node.js projects.
**Why**: The AI-generated frontend had Express + Prisma mixed in. That pattern doesn't scale. Backend should be independently deployable, independently testable, independently scalable. Frontend is a pure React SPA that calls our backend API.
**Impact**: The `server.ts` and Prisma setup in the frontend repo will be cleaned out as we build the real backend. Frontend will use TanStack Query to call backend API endpoints.

---

## DECISION-006: JWT Authentication with Refresh Tokens
**Date**: 2026-04-16
**Decision**: Use JWT (short-lived access tokens) + refresh tokens (long-lived, stored in httpOnly cookie).
**Why**: Stateless access tokens don't require DB lookup on every request (performance). Refresh tokens allow revocation (security). httpOnly cookie for refresh token prevents XSS access.
**Trade-offs**: Access token revocation requires short expiry (15min) + refresh token rotation. More complex than session-based auth. Worth it for scalability.
**Implementation (Phase 1.4)**:
- Access token: JWT, 15m, signed with `JWT_ACCESS_SECRET`, payload contains `{ sub, tenantId, role, email }`
- Refresh token: opaque 48-byte random string (base64url), 7d, stored as SHA-256 hash in `refresh_tokens` table, delivered as `httpOnly; secure; sameSite=strict; path=/api/v1/auth` cookie
- Token rotation: every `/auth/refresh` revokes the old token and issues a new pair. Reuse of a revoked token triggers revocation of ALL user tokens (theft detection)
- Timing attack prevention: dummy bcrypt hash compared even when user not found — prevents email enumeration via response time
- Rate limiting: 10 req/15min on `/auth/login`, 5 req/15min on `/auth/register` via `@nestjs/throttler`
- SECURITY DEFINER SQL functions for login (`find_user_for_login`) and refresh (`find_refresh_token`) — bypass RLS for the initial lookup before tenant context is known, return minimal fields only

---

## DECISION-007: OAuth Token Encryption
**Date**: 2026-04-16 (implemented 2026-04-17 in Phase 3.1)
**Decision**: All third-party OAuth access tokens and refresh tokens stored encrypted at rest using AES-256-GCM.
**Why**: If the database is compromised, attacker should not get access to client marketing platform accounts. Encryption key stored in environment variable (not in DB). Never logged.
**Implementation (Phase 3.1)**:
- `EncryptionService` (`src/common/encryption/`) — global module, injected where needed
- Encryption format: `v1:iv_hex:tag_hex:ciphertext_hex` — versioned so future key rotation or algorithm upgrades can be handled by detecting the `v1:` prefix without rewriting all tokens
- `ENCRYPTION_KEY` must be exactly 64 hex chars (32 bytes for AES-256) — validated at startup by `validateEnv()`, app fails to boot if wrong
- Key length never logged — only `keyLengthBytes` exposed for diagnostics
- `accessTokenEnc` and `refreshTokenEnc` fields are NEVER selected or returned in any HTTP response — enforced by explicit `publicSelect()` in `IntegrationsService` that omits both fields
- Decryption only via `IntegrationsService.getDecryptedTokens()` — internal method called by workers, never by controllers

---

## DECISION-009: Shared GoogleOAuthService for All Google Platform Integrations
**Date**: 2026-04-17
**Decision**: Extract a `GoogleOAuthService` in `src/modules/integrations/google/` that handles state JWT sign/verify, authorization code exchange, and token refresh. All Google platform OAuth services (GA4, Google Ads, Search Console, etc.) inject and delegate to it.
**Why**: When building the second Google OAuth integration (Google Ads), the code for sign/verify/exchange/refresh was identical to GA4. The right time to extract shared logic is at the second instance — delaying until a third instance means three places to fix any security issue.
**Trade-offs**:
- Adds one more module/file (`GoogleModule`, `GoogleOAuthService`)
- Each platform service still holds its own scopes, redirectUri config key, and `assertConfigured()` logic
- If Google changes the token endpoint, only one file needs updating
- GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET shared across all Google platforms — intentional (one OAuth app in Google Cloud Console)
**Each platform keeps**: scope selection, redirect URI config key, `assertConfigured()` (checks platform-specific redirectUri), `handleCallback()` (validates platform-specific state.platform)

## DECISION-008: Integration Connection Model Design
**Date**: 2026-04-17
**Decision**: One `IntegrationConnection` row per (campaign, platform) pair. Status field tracks connection health. Encrypted tokens stored on the same row.
**Why**: Campaigns are the primary workspace unit in AgencyPulse (mirrors AgencyAnalytics). All integrations attach to campaigns. One platform per campaign is enforced by DB UNIQUE constraint — no ambiguity for workers querying which token to use.
**Key design choices**:
- `refreshTokenExpiresAt` stored (some platforms expire refresh tokens too — silent failures otherwise)
- `platformAccountType` stored (Google Ads has MCC vs individual accounts — useful for Phase 3.3+)
- Status transitions: DISCONNECTED → CONNECTED → EXPIRED / ERROR → DISCONNECTED
- Row kept on disconnect (not hard deleted) — preserves audit history
- Token upsert rule: existing tokens preserved unless new tokens explicitly provided in DTO

---

## DECISION-010: Dashboard Validation & Integrity Constraints
**Date**: 2026-04-22
**Decision**: Multi-layered validation for dashboard integrity: DB constraints + DTO validation + service logic.
**Why**: Prevents data corruption and race conditions, provides fail-fast user feedback, and enforces business rules at multiple levels.
**Implementation (Phase 5.1–5.3 + tweaks)**:

1. **DB Constraint — Single Default Dashboard**:
   - UNIQUE index: `CREATE UNIQUE INDEX ux_default_dashboard_per_campaign ON dashboards (campaign_id) WHERE is_default = true AND deleted_at IS NULL`
   - Enforced at DB level — prevents race condition where two concurrent requests both try to set is_default=true
   - Soft delete guard (deleted_at IS NULL) — allows re-creating a default dashboard after soft-deleting the previous one
   - Service-level `clearDefaultFlag()` unsets other defaults before creating/updating, but DB constraint is the ultimate guardian

2. **DTO Validation — Fail-Fast User Feedback**:
   - `metricKeys`: `@ArrayMinSize(1)` — rejects empty metric arrays with clear message "At least one metric key is required"
   - `aggregation`: `@IsIn(['sum', 'avg', 'last'])` — validates string is one of allowed enums
   - `comparison`: `@IsIn(['previous_period', 'previous_year', 'none'])` — validates comparison period option
   - `from` and `to`: `@IsDateString()` with descriptive messages — validates date format
   - Date range: service-level check `from < to` throws `BadRequestException` with message "Date range invalid: 'from' must be before 'to'"

3. **Service Logic — Campaign & Dashboard Access**:
   - `assertCampaignAccess()` — validates user has access to campaign (role-based: ADMIN→all, STAFF→assigned, CLIENT_USER→assigned)
   - `assertDashboardAccess()` — validates dashboard belongs to campaign and both exist
   - `validateMetricKeys()` — checks metric_keys exist in metric_definitions for the given platform
   - Widget-campaign integrity: `campaign_id` directly on `dashboard_widgets` table, enforced in every query WHERE clause

**Trade-offs**:
- Multiple validation layers means some redundancy, but each serves a purpose (DB prevents data corruption, DTO gives user feedback, service logic enforces business rules)
- DB constraint requires exact index design — small cost for critical safety guarantee
- Worth the complexity because dashboards are core to the product; data integrity failure breaks the entire reporting experience

---

## DECISION-011: AI Assistant — Structured RAG over Vector Embeddings
**Date**: 2026-04-23
**Decision**: For Phase 8.5 AI Assistant, use **structured retrieval** (intent parser → direct PostgreSQL queries) instead of vector embeddings.
**Why**: Campaign data is already structured — metrics are numbers indexed by (tenant, campaign, platform, date, metric_key). A user asking "why did CTR drop last week?" needs an exact timeseries fetch, not a semantic similarity search. PostgreSQL queries are more precise AND cheaper than embedding + cosine similarity. We detect intent via keyword matching (time references, metric names, comparison signals) and issue targeted SQL queries.
**How**: `intent-parser.ts` extracts: time range (last week/month/quarter), metric hints (sessions, CTR, cost), platform hints (GA4, Meta), trend/comparison signals. `ai-chat.service.ts` uses these to call `metricsService.getMetricSummary()` + optional `getMetrics()` timeseries. Context is rebuilt fresh per message (never cached — prevents cross-user leaks).
**Trade-offs**:
- Structured RAG requires hand-crafted intent rules — won't handle every phrasing perfectly
- No fuzzy semantic matching (e.g. "ad efficiency" won't map to CPC automatically)
- If we add unstructured content (PDFs, notes, doc uploads) we'd revisit with vector embeddings for those specific surfaces
- Dramatically cheaper: no OpenAI embeddings API call, no vector DB, no embedding refresh when data changes
- More deterministic and debuggable than similarity-based retrieval

---

## DECISION-012: AI Chat Conversation Isolation — Three Layers
**Date**: 2026-04-23
**Decision**: Conversation privacy enforced at three independent layers, not just RLS.
**Why**: RLS protects tenants from each other, but within a single agency, AGENCY_OWNER should NOT be able to read AGENCY_STAFF's private chat sessions. Users expect their AI conversations to be personal.
**How**:
1. **DB layer (RLS)**: `ai_conversations.tenant_id` policy — physically blocks cross-tenant reads.
2. **Service layer**: every conversation lookup filters by `AND user_id = :userId` in addition to tenant.
3. **Context layer**: system prompt is built fresh from the authenticated user's own data on every message. No shared prompt cache, no context bleed between requests.
**Trade-offs**:
- Agencies who want shared team chats would need an explicit "share conversation" feature (deferred)
- Extra WHERE clause on every read — negligible cost with the `(tenant_id, user_id, updated_at)` index

---

## DECISION-013: Billing Plan Limits — Enforce at Service Layer, Not Guards
**Date**: 2026-04-23
**Decision**: `BillingLimitsService.assertWithinLimits()` called from inside `ClientsService.create()`, `TeamService.inviteStaff()`, `IntegrationsService.upsert()` — not via an `@RequiresPlan()` guard.
**Why**: The limit check needs to know WHICH resource is being created and COUNT current usage from the DB. Guards run before the service, don't have easy access to the counted collection, and would duplicate the tenant-resolution logic. Service-layer enforcement keeps the count + check + create in one place.
**How**: BillingLimitsService exported from BillingModule. Three consumers import BillingModule. `assertWithinLimits(tenantId, 'clients')` runs COUNT query, compares against `PLAN_LIMITS[plan]`, throws ForbiddenException with an upgrade-prompt message. AGENCY_PRO uses `Infinity` sentinel — no DB query needed on the hot path.
**Trade-offs**:
- Duplicated import in three modules (acceptable — explicit dependencies)
- Count queries on every create — negligible with existing `(tenant_id, deleted_at)` indexes
- Trial period handled via "effective plan": FREELANCER + subscriptionStatus='trialing' + trialEndsAt in future → AGENCY-tier limits applied

---

## DECISION-014: Stripe Webhook Idempotency via UNIQUE constraint
**Date**: 2026-04-23
**Decision**: Record every Stripe webhook to `billing_events` FIRST with `stripe_event_id` UNIQUE; only then process. Duplicates caught by the constraint and silently ignored.
**Why**: Stripe retries webhooks aggressively (up to 3 days). Without idempotency, a duplicate `customer.subscription.updated` could double-apply a plan change or re-send an email. Using the event_id as a unique key makes the DB itself the idempotency mechanism — no Redis lock, no time-window check.
**How**: Webhook handler catches P2002 / unique violation on insert, returns 200 silently. Processing only runs after the insert succeeds. `processed_at` and `error` columns track success/failure per event for observability. Raw body required for HMAC verification — scoped `express.raw()` middleware in `main.ts` applied only to `/api/v1/billing/webhook`.
**Trade-offs**:
- Every webhook hits the DB once for the idempotency insert (cheap)
- `billing_events` grows unbounded — future cleanup job can purge events older than 90 days
- Webhooks run via SystemPrismaService (RLS bypass) because they have no auth context — tenant_id backfilled from metadata or stripeCustomerId lookup

---

## DECISION-015: Phase 3.7 — Platform-Specific OAuth Patterns
**Date**: 2026-04-23
**Decision**: Each of the 5 new integration platforms has distinct OAuth and token behaviors; we implement each correctly rather than forcing a common abstraction.

**Platform breakdown**:
- **Google Search Console**: Uses shared `GoogleOAuthService` (same Google OAuth app). Scope: `webmasters.readonly`. Site URL stored as externalAccountId (e.g. `sc-domain:example.com`). Must URL-encode siteUrl in Search Analytics API path.
- **YouTube Analytics**: Uses shared `GoogleOAuthService`. Scopes: `yt-analytics.readonly` + `youtube.readonly` (needed to list channels). YouTube Analytics API response is a 2D array with column headers — mapped via index lookup. Channel ID stored as externalAccountId.
- **LinkedIn Ads**: Separate OAuth (LinkedIn OAuth 2.0). Access token: 60 days. Refresh token: 365 days if app has token rotation enabled (optional). Analytics API uses REST-li dot-notation params and requires account URN format (`urn:li:sponsoredAccount:{id}`). Numeric ID stored as externalAccountId; URN constructed at call time.
- **TikTok Ads**: Three unique differences vs all other platforms: (1) callback param is `auth_code` not `code`, (2) token exchange uses POST with JSON body (not form-encoded), body fields are `app_id`/`secret`/`auth_code` (not client_id/secret/code), (3) access token expires in 24 hours with NO refresh token. `Access-Token` header (not `Bearer`). Response wrapped in `{ code, data }` envelope.
- **Amazon Ads**: Login with Amazon (LWA) OAuth — standard code + form-encoded exchange. Access token: 1 hour, refresh token: long-lived. Report API is async (PENDING→PROCESSING→COMPLETED). Polling done within the BullMQ sync job (max 90s). Report download is gzip-compressed JSON — decompressed with Node.js `zlib.gunzip`. `Amazon-Advertising-API-ClientId` and `Amazon-Advertising-API-Scope` (profileId) headers required on all API calls.

**Why not force a common abstraction**: Meta/LinkedIn/TikTok/Amazon all work differently at the token exchange layer. Forcing them into a single OAuth service would require messy conditionals. The cost of 5 separate OAuth services is lower than the maintenance cost of one abstract service full of platform-specific branches.

---

## DECISION-016: Agency Overview — Raw SQL Aggregation in a Dedicated Module
**Date**: 2026-04-25
**Decision**: Agency-wide metric aggregation (cross-campaign SUM + prior-period delta) and campaign ranking live in a dedicated `agency-overview` NestJS module using raw SQL inside `prisma.$transaction()` with `SET LOCAL app.current_tenant`.
**Why**: Prisma's fluent API cannot express a single cross-campaign SUM query across `metric_values` with the required filters (dimension_key IS NULL, staff scoping via EXISTS subquery, dynamic ORDER + LIMIT). Using `prisma.$queryRawUnsafe()` inside `$transaction` (which sets `SET LOCAL app.current_tenant = '${tenantId}'`) guarantees RLS fires on the raw query without the session-leak risk of the middleware SET pattern.
**STAFF scoping**: `$4::uuid IS NULL OR EXISTS (SELECT 1 FROM staff_client_assignments WHERE user_id = $4 AND client_id = c.id)` — when `staffUserId` is null (OWNER/ADMIN), the filter is a no-op; when set (STAFF), it restricts to assigned clients.
**Why `dimension_key IS NULL`**: metric_values stores breakdown rows (e.g. per-device-type sessions) alongside summary rows. Only summary rows (`dimension_key IS NULL`) should be SUMmed to avoid double-counting.
**Trade-offs**: Raw SQL bypasses Prisma's type safety — any schema change to `metric_values` must be reflected manually in these queries. Mitigated by isolating the raw SQL to two private methods in the service.

---

## DECISION-017: Agency Overview — CampaignId→ClientId Cross-Reference from Ranking Data
**Date**: 2026-04-25
**Decision**: The `GET /agencies/health` endpoint returns campaigns without a `clientId` field. Rather than changing the backend response shape, the frontend builds a `campaignId→clientId` map client-side from the ranking endpoint response (which does include `clientId`).
**Why**: The ranking endpoint (`GET /agencies/me/campaigns/ranking`) is already fetched on the overview page with `limit=50`. It includes `clientId` on every row. Building a `Record<string, string>` map from this data is O(n) and requires no extra API call. Changing the health endpoint would require a migration + test update across two repos for a cosmetic improvement.
**How**: `OverviewHealth` accepts `rankingData?: CampaignRankingItem[]` as a prop. The health component builds `{ [campaignId]: clientId }` from it. "Fix now" links navigate to `/clients/${clientId}/campaigns/${campaignId}/integrations` for known campaigns, fall back to `/clients` for unknowns.
**Trade-offs**: If a campaign has health issues but zero metric data (so it never appears in ranking results), the fallback `/clients` link is used instead of a deep link. Acceptable — campaigns with no metric data don't have a meaningful direct link to integrations anyway.

---

## DECISION-018: Agency Insights — Severity-First Architecture
**Date**: 2026-04-25
**Decision**: The Insights panel on the Agency Overview page classifies insights into three tiers (CRITICAL/WARNING/INFO) and surfaces them sorted by severity descending, capped at 8 cards.
**Why**: An overview page that shows a flat unsorted list of "things happening" forces the user to scan everything. Severity sorting guarantees the most action-required items appear first. The 8-card cap prevents the panel from overwhelming the page on large agencies with many campaigns.
**Severity rules**:
- CRITICAL (red): integration errors (`errorCount > 0`), expired tokens (`expiredCount > 0`), metric drops > 30%
- WARNING (amber): metric drops 10–30%, no integrations connected while campaigns exist
- INFO (green): metric gains > 20%
**Each insight carries a deep-link action button** so users can navigate directly to the relevant page (integrations, campaign detail, client list) without guessing.
**Trade-offs**: Thresholds (10%, 30%, 20%) are hardcoded. A future improvement would be per-agency configurable thresholds. Hardcoded is the right starting point — we can make it configurable when users ask for it.

---

## DECISION-019: Overview Page — Component Decomposition at 700 Lines
**Date**: 2026-04-25
**Decision**: Decomposed the monolithic `OverviewPage.tsx` (700+ lines) into 8 focused files: `overview.types.ts`, `overview.utils.ts`, and 5 single-responsibility components (`OverviewInsights`, `OverviewKpis`, `OverviewRanking`, `OverviewHealth`, `OverviewClients`) with a thin `OverviewPage` orchestrator.
**Why**: A 700-line single-file component violates separation of concerns — each section (KPIs, rankings, health, insights, clients) has distinct data dependencies, loading states, and interaction logic. Co-locating them in one file makes each section hard to test and reason about independently. The decomposition was triggered by an external AI review.
**React Query deduplication benefit**: Because each child component uses the same queryKey pattern (e.g. `['overview', 'ranking', metric, from, to, 50, 'desc']`), TanStack Query deduplicates the fetch — OverviewInsights and OverviewHealth both read ranking data without an extra network request.
**Trade-offs**: More files to navigate. Mitigated by co-locating everything under `src/pages/overview/` with a `components/` subdirectory — the structure is self-documenting.

---

## DECISION-020: Single generic OAuth service (StandardOAuthService) over 65 individual platform modules
**Date**: 2026-04-29
**Decision**: Implement one `StandardOAuthService` + `StandardApiKeyService` in a `platform-stub` catch-all module instead of creating 65 individual NestJS modules (one per new platform).
**Why**: The auth-connect flow for all OAuth 2.0 platforms is structurally identical — the only differences are endpoint URLs, scopes, credential env-var names, and a handful of platform-specific behaviors (Basic auth, PKCE, per-shop URLs). A config-driven approach captures all of this in a data structure (`OAUTH_PLATFORM_CONFIGS`) with zero per-platform code. Creating 65 modules would produce ~200+ near-identical files with no added value at this stage. The dedicated-module pattern (GA4, MetaAds, etc.) is reserved for platforms that need custom sync/data-fetch logic.
**Trade-offs**: All unimplemented platforms share one service — platform-specific runtime errors (bad credentials, wrong scope) surface in the same code path. Acceptable because each platform's config entry is clearly labeled and the error message includes the platform name. When a platform gets a sync implementation, a dedicated module is added and NestJS's route priority (specific before catch-all) ensures the stub is bypassed automatically.
**Implementation**: `PlatformStubModule` is registered LAST in `app.module.ts`. `StandardOAuthService` reads platform config from `OAUTH_PLATFORM_CONFIGS` Map and handles: standard POST auth, Basic auth, PKCE S256, BigCommerce context param, Mailchimp metadata fetch.

---

## DECISION-021: PKCE code_verifier stored in signed state JWT (not Redis)
**Date**: 2026-04-29
**Decision**: Store the PKCE `code_verifier` inside the OAuth state JWT payload rather than in Redis keyed by state.
**Why**: The state JWT is already signed with `JWT_ACCESS_SECRET` and expires in 10 minutes — it provides tamper-proof, stateless transport of arbitrary payload across the OAuth redirect round-trip. Using Redis would require an extra write (on auth-url generation) and read (on callback), plus a TTL management concern. The JWT approach is zero-infrastructure and equally secure.
**Trade-offs**: Slightly larger JWT payload (verifier adds ~43 bytes). The state JWT is already not a sensitive secret — it flows through the browser as a query parameter. The verifier itself is not sensitive before the code exchange completes; after exchange it is consumed and worthless.
