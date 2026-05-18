# AgencyPulse — Platform Deep Dive

**Audience:** technical / product walkthrough. Use this as a meeting reference.
**Last verified:** 2026-05-02 (against the current state of agency-backend and agencypulse repos)
**Backend:** NestJS · TypeScript · Prisma · PostgreSQL · Redis · BullMQ
**Frontend:** React 19 · TypeScript · Vite · Tailwind v4 · Shadcn UI · TanStack Query · Zustand

---

## Table of Contents

1. [What it is, who it's for, mental model](#1-what-it-is)
2. [Five-role RBAC](#2-five-role-rbac)
3. [Multi-tenancy + Postgres Row-Level Security](#3-multi-tenancy--rls)
4. [Auth, sessions, refresh-token theft detection](#4-auth)
5. [3-step signup, email verification, forgot password](#5-signup--auth-extras)
6. [Integrations (85 platforms)](#6-integrations)
7. [Sync engine (BullMQ + scheduler)](#7-sync-engine)
8. [Metrics storage and query](#8-metrics)
9. [Dashboards](#9-dashboards)
10. [Reports + scheduled delivery + share links](#10-reports)
11. [Alerts](#11-alerts)
12. [Goals](#12-goals)
13. [Scorecard, Forecast, Health](#13-scorecard-forecast-health)
14. [Notifications + SSE bell](#14-notifications)
15. [AI features (7 surfaces)](#15-ai-features)
16. [Billing (Stripe)](#16-billing)
17. [Audit log](#17-audit-log)
18. [White-label branding](#18-branding)
19. [Templates marketplace](#19-templates)
20. [Custom KPIs](#20-custom-kpis)
21. [Client portal (read-only branded experience)](#21-client-portal)
22. [Current state](#22-current-state)
23. [Meeting cheat-sheet](#meeting-cheat-sheet--likely-questions-and-answers)

---

## 1. What it is

A **multi-tenant SaaS analytics platform for marketing agencies** — a self-hosted alternative to AgencyAnalytics.com.

**Mental model:**
> Agency `Qodet` connects their client `Nike`'s ad platforms (Google Ads, Meta, GA4, etc.) → AgencyPulse pulls the data on a 6-hour cron → unified dashboards and white-labeled PDF reports. Nike's marketing manager `John` gets a branded login at the agency's custom domain to view (read-only) those dashboards and reports.

**Three actors per tenant:**
- **The agency** — the customer paying us
- **The client** — the agency's customer (whose data is being tracked)
- **The client's user** — a portal viewer

---

## 2. Five-Role RBAC

| Role | Rank | What they can do | Where enforced |
|---|---|---|---|
| `PLATFORM_OWNER` (us) | 4 | Cross-tenant admin (unused day-to-day) | — |
| `AGENCY_OWNER` | 3 | Everything: billing, branding, team, clients, settings | `@Roles(AGENCY_OWNER)` |
| `AGENCY_ADMIN` | 2 | Manage clients/campaigns/team/reports. **Can't** touch billing/branding | `@Roles(AGENCY_ADMIN)` |
| `AGENCY_STAFF` | 1 | Only sees clients they're **assigned** to | service-layer scope filter |
| `CLIENT_USER` | 0 | Read-only portal of their assigned clients only | `clientUserAssignment` join |

**How it's wired:**
- Two-layer enforcement:
  1. **Route guard** (`RolesGuard` in `src/modules/auth/guards/roles.guard.ts`) — uses `ROLE_HIERARCHY` array; `userLevel >= minimumRequiredLevel`
  2. **Service-layer scope filter** — `applyScopeFilter()` in `clients.service.ts` joins `clientUserAssignments.some({ userId })` for STAFF/CLIENT_USER
- Frontend mirror: `<RoleRoute min="AGENCY_ADMIN">` wraps `/team`, `/settings/billing`, etc.
- CLIENT_USER hits a completely separate route tree under `/portal/*` — invariant: no `{role === 'CLIENT_USER' ? ... : ...}` branches inside the agency app shell. Hard separation prevents role leaks.

---

## 3. Multi-tenancy + RLS

**Strategy chosen:** shared schema + Postgres Row-Level Security (NOT schema-per-tenant). Every business table has a `tenant_id UUID NOT NULL` column.

**Two database roles:**
- `agencypulse_app` (low-privilege) — used by `PrismaService`. Subject to RLS.
- `agencypulse` / `neondb_owner` (table owner) — used by `SystemPrismaService`. Bypasses RLS. Reserved for: registration, login, refresh-token rotation, audit writes.

**Per-request RLS context:**
1. Every request hits `TenantMiddleware` (`src/common/tenant/tenant.middleware.ts`) which extracts `tenantId` from the JWT and stores it in `AsyncLocalStorage` via `TenantContextService`.
2. A Prisma middleware (`registerTenantHook` in `prisma.service.ts`) wraps every model query:
   ```sql
   SET app.current_tenant = '<uuid>';
   <actual query>
   RESET app.current_tenant;  -- in finally block
   ```
3. RLS policies (migration `20260417000005_strict_rls_register_fn`) enforce:
   ```sql
   CREATE POLICY agencies_isolation ON agencies FOR ALL TO agencypulse_app
     USING (current_tenant_id() IS NOT NULL AND id = current_tenant_id());
   ```
4. Tenant id is **validated against UUID v4 regex** before string interpolation — prevents SQL injection via the SET command.
5. Uses session-level `SET` (not `SET LOCAL`) to avoid transaction deadlocks; `RESET` in finally ensures connection pool cleanup.

**Pre-tenant operations** (registration, login, refresh) MUST use `systemPrisma` since no tenant context exists yet. Helper SQL functions like `find_user_for_login`, `find_refresh_token` are `SECURITY DEFINER` running as owner.

---

## 4. Auth

### JWT access tokens
- **Payload:** `{ sub (userId), tenantId, role, email }`
- **Lifetime:** 15 min (configurable `jwt.accessExpiresIn`)
- **Signed by:** `TokenService.signAccessToken()` (`src/modules/auth/token.service.ts` lines 32-36)

### Refresh tokens — opaque, not JWT
- **Why not JWT?** Revocation requires DB lookup anyway, so signing adds no value.
- **Format:** 48 random bytes → base64url (64 chars), stored as **SHA-256 hash** in `refresh_tokens` table
- **Cookie:** `httpOnly` (no JS access), `secure` in prod, `sameSite=strict`, `path=/api/v1/auth`
- **Lifetime:** 7 days
- **Rotation:** every refresh creates a new token, marks the old one `revoked_at`
- **Theft detection:** if a `revoked_at` token is reused → `revokeAllUserTokens(userId)` kills every session. (`validateAndRotateRefreshToken` lines 94-167)

### Login flow
1. `find_user_for_login(email)` — SECURITY DEFINER SQL function, owner role, bypasses RLS (no tenant context yet)
2. **Timing-attack defense:** even when user not found, run bcrypt comparison against dummy hash `$2b$12$invalidhash...` — same response time
3. Single error message for both "user not found" and "wrong password"
4. Reject if `is_active=false` or `password_hash IS NULL` (invited user who hasn't set password)

### Tokens at rest
- **AES-256-GCM** (`src/common/encryption/encryption.service.ts`)
- Format: `v1:<iv_hex>:<tag_hex>:<ciphertext_hex>` — versioned for future key rotation
- 12-byte IV per encryption, 16-byte auth tag
- Used for: integration OAuth tokens, API keys. Refresh tokens are stored as SHA-256 hash, not encrypted ciphertext.

---

## 5. Signup + Auth Extras

### 3-step signup (mirrors AgencyAnalytics)
`src/modules/auth/dto/register.dto.ts`:
- **Step 1 — Account:** firstName, lastName, email, password, phone (optional)
- **Step 2 — Agency profile:** agencyName, website, size (1/2-5/6-10/...), country (ISO-2), timezone
- **Step 3 — Use-case (skippable):** interests[] (SEO/PPC/...), clientCountEstimate, referralSource

**How registration is atomic:**
`AuthService.register()` calls `register_agency(...)` SECURITY DEFINER function (one transaction, owner role) which inserts the agency, the first user as `AGENCY_OWNER`, and updates `agency.owner_id`. Failure on duplicate email → SQLSTATE `23505` → caught + converted to `ConflictException`.

### Email verification
- Token: 32 random bytes → base64url; SHA-256 hash stored in `users.email_verification_token_hash` with `email_verification_expires_at` (48h)
- `POST /auth/verify-email { token }` — looks up via `find_user_by_email_verification_token(hash)` SECURITY DEFINER fn, sets `email_verified_at`, clears token
- Frontend: amber banner (`EmailVerificationBanner.tsx`) with "Resend verification" button. Banner hides after `emailVerifiedAt` is non-null.

### Forgot password
- `POST /auth/forgot-password { email }` — generates 32-byte token, hashes, stores in `users.password_reset_token_hash` with 1-hour expiry, sends email. **Always returns 200** to prevent email enumeration.
- `POST /auth/reset-password { token, password }` — validates hash + expiry, updates `passwordHash`, **revokes all existing refresh tokens** (forces re-login on every device).

### Email templates
`src/modules/email/templates/`: `forgot-password.hbs`, `verify-email.hbs`, `invite-staff.hbs`, `invite-client-user.hbs`, `welcome.hbs`, `report-delivery.hbs`. Handlebars + nodemailer SMTP.

---

## 6. Integrations

### Catalog: 85 platforms across 9 categories
`src/modules/integrations/platform-catalog.constants.ts` — `PLATFORM_CATALOG[]` of 85 entries with `{ key, name, category, authType, description, isImplemented, authLabel }`.

**Categories:** PPC, SEO, SOCIAL, EMAIL, ECOMMERCE, ANALYTICS, CALL_TRACKING, LOCAL, DATABASE
**Auth types:** OAUTH | API_KEY | BOTH

### Three integration architectures

**Architecture A — Dedicated module (8 platforms with specialised quirks):**
GA4, Google Ads, Meta Ads, Google Search Console, LinkedIn Ads, YouTube, TikTok Ads, Amazon Ads. Each has its own folder (`src/modules/integrations/<platform>/`) with `*-oauth.service.ts` and `*-api.service.ts` because they have unique requirements (GA4 uses Service Account JSON, Meta uses 60-day long-lived tokens, TikTok has special PKCE quirks).

**Architecture B — Shared OAuth (27 platforms):**
`StandardOAuthService` (`src/modules/integrations/platform-stub/standard-oauth.service.ts`) handles OAuth 2.0 auth-code flow generically. Quirks per platform encoded in `OAUTH_PLATFORM_CONFIGS` map:
- **PKCE S256** — X/Twitter (verifier hashed → challenge sent in auth URL → verifier stored in signed state JWT → sent in token exchange)
- **HTTP Basic auth header** — Reddit, Pinterest, X
- **POST-body credentials** — most others
- **`context` param forwarding** — BigCommerce
- **Mailchimp `dc` prefix fetch** after token exchange
- **Per-shop URL templates** — Shopify, BigCommerce (auth URL contains `{shopDomain}`)

**Architecture C — Shared API-key (~50 platforms):**
`StandardApiKeyService.connect()` encrypts the key via `IntegrationsService.storeTokens()`, stores auxiliary fields.

### Three credential tiers (frontend mirror in `platform-credentials.ts`)
- **Tier A** — apiKey only (Klaviyo, Brevo, etc.)
- **Tier B** — apiKey + apiUrl OR accessId (ActiveCampaign needs account URL, Moz needs accessId, Twilio needs accountSid)
- **Tier C** — multi-field JSON in `externalAccountId` (WooCommerce: `{siteUrl, consumerSecret}`; MySQL: `{host, port, database, user, query}`; Snowflake: `{account, user, database, schema, warehouse, query}`)

### Storage layout — `IntegrationConnection` table
- `accessTokenEnc` — main credential, AES-256-GCM encrypted
- `refreshTokenEnc` — OAuth refresh token, encrypted
- `externalAccountId` — auxiliary (JSON or raw string or `'default'`)
- `status`: CONNECTED | ERROR | SYNCING | DISCONNECTED
- `lastSyncAt`, `lastErrorMessage`, `tokenExpiresAt`
- Unique constraint: `[campaignId, platform]`

### Endpoints
- `GET :platform/auth-url?campaignId=...` (OAuth) — generates auth URL with signed state JWT
- `GET :platform/callback?code=...&state=...` — exchanges code, stores tokens, redirects to frontend with `?connected=<slug>`
- `POST :platform/connect { campaignId, apiKey, apiUrl?, accessId?, externalAccountId? }` — API-key flow
- `GET /clients/:c/campaigns/:c/integrations` — list connections
- `DELETE /clients/:c/campaigns/:c/integrations/:platform` — disconnect (nulls tokens, status → DISCONNECTED)
- `POST /sync/test-connection` — read-only probe via `TestConnectionService` — calls `fetchCoreMetrics` for last 7 days, returns `{status, rowCount, sampleRows}` without writing anything

---

## 7. Sync Engine

### Queue + processor
- **BullMQ queue:** `SYNC_QUEUE = 'integration-sync'` (`src/modules/sync/constants/sync-queue.constants.ts`)
- **Processor:** `IntegrationSyncProcessor` (`src/modules/sync/processors/integration-sync.processor.ts`), `concurrency: 5`
- **Backoff:** exponential `2^attempts * 5s + jitter(0-1000ms)`
- **Retries:** 3 attempts before marking `status=ERROR`

### Per-job flow
1. `TenantContextService.run(tenantId, ...)` sets RLS context for the worker
2. `StandardTokenService.getValidAccessToken()` decrypts; auto-refreshes OAuth token if expiring within 5 min
3. **Switch by platform** dispatches to one of ~85 sync methods, each calling the platform's `*ApiService.fetchCoreMetrics(token, externalAccountId, dateRange)`
4. Service returns `MetricRowInput[]` (each row: `{date, metricKey, value, dimensionKey?, dimensionVal?}`)
5. `MetricsService.bulkInsertMetrics()` upserts 500 rows at a time with `ON CONFLICT...DO UPDATE`
6. `IntegrationConnection.lastSyncAt = NOW()`, status → `CONNECTED`

### Platform service uniformity
74 files at `src/modules/integrations/platforms/*-api.service.ts`, each implementing:
```ts
async fetchCoreMetrics(
  accessToken: string,
  externalAccountId: string,
  dateRange: { from: string; to: string },
): Promise<MetricRowInput[]>
```
Common pattern: `fetchWithRetry` (429 retry + Retry-After + exp backoff) → `safeInt`/`safeFloat` parsing → return rows.

### Scheduling
`SyncSchedulerService` — `@Cron(process.env.SYNC_CRON ?? '0 */6 * * *')` (every 6h):
1. Query `systemPrisma` for all `CONNECTED` connections (ordered by `lastSyncAt ASC`, nulls first), cap 500 per cycle
2. Compute date range:
   - Never synced: from = today-30d, to = today
   - Otherwise: from = max(lastSyncAt - 1d, today-30d), to = today (1-day overlap catches late attribution)
3. Batch-dispatch 50 jobs/200ms; stagger Google Ads +2min, Meta +4min to avoid rate limits

### Test harness
- 76 Jest spec files, **340 tests passing**
- Helpers: `mock-fetch.ts`, `mock-db.ts`
- Fixtures: 81 JSON files at `__fixtures__/`

---

## 8. Metrics

### Storage
**Table:** `metrics` (legacy) and `MetricValue` (current)
**Primary key:** `(tenant_id, campaign_id, platform, metric_key, recorded_at, COALESCE(dimension_key,''), COALESCE(dimension_val,''))`
**Why composite PK:** allows breakdown rows (e.g. per-country, per-device) without unique-constraint headaches

### Reads
`MetricsService` (`src/modules/metrics/metrics.service.ts`):
- `getMetricSummary(tenantId, campaignId, platform, from, to, metricKeys?, aggregate)` — raw SQL with `SUM`/`AVG`/`LAST` per metric. Derived metrics (CTR, CPC) reject AVG.
- `getMetrics(...)` — timeseries with `DATE_TRUNC('day' | 'week' | 'month', recorded_at AT TIME ZONE 'UTC')`. Frontend client fills missing periods.
- 5-min Redis cache with version key (incremented on sync writes — no key SCAN needed for invalidation)

### Tenant isolation
RLS-enforced via `SET LOCAL app.current_tenant` in transactions. Every query also filters by `campaignId`.

---

## 9. Dashboards

**Tables:** `Dashboard`, `DashboardWidget`. Widget config + position stored as JSON.

**Widget types:** KPI, line chart, bar chart, pie chart, table.

**Live data fetch:** `POST /widgets/data` — batches widget requests, dispatches:
- KPI widgets → `getMetricSummary`
- Chart widgets → `getMetrics` with granularity
- Per-widget 10s timeout to prevent slow integrations stalling the page

**Frontend grid:** `DashboardGrid.tsx` uses `react-grid-layout`, 12-column grid, 80px row height. `onDragStop`/`onResizeStop` saves layout. Edit mode toggles `isDraggable`/`isResizable`. ADMIN+ only.

**Default dashboard** auto-created on campaign creation.

---

## 10. Reports

**Tables:** `Report`, `ReportSchedule`, `ReportShareLink`, `ReportDelivery`.
**Sections:** JSON array `{ type: TEXT | METRICS | CHART, ... }`.

### PDF generation flow
`ReportsService.generatePdf()`:
1. **Cache check:** if `pdfGeneratedAt` is today AND `pdfGeneratedAt >= updatedAt` (unchanged since render) → return existing signed URL
2. Otherwise call `ReportRenderService.renderAndStore()`:
   - Batch metric queries by platform (1 query per platform, NOT per section)
   - Render HTML → PDF via Puppeteer
   - Upload to object storage via `StorageService`
3. Return `{reportId, pdfUrl, downloadUrl, cached, generatedAt}` — `downloadUrl` is a signed S3/GCS URL

### Scheduled delivery
`report-generation.processor.ts` — BullMQ `concurrency: 2` (Puppeteer is heavy). Cron-driven via `cron-parser`. Emails the PDF (or signed URL if >10MB) using `EmailService.sendReportDelivery()`.

### Share links
Token in URL → `GET /reports/shared/:token` → uses `systemPrisma` to bypass RLS (public access by token). Expiry checked. Used for sending reports to clients without forcing them to log in.

### Frontend
- `ReportsList`, `ReportDetail` (5 tabs: Sections / Schedule / Share Links / Delivery History / AI Summary)
- `ReportBuilder` for ADMIN+ — section drag-drop
- `SharedReportPage` — public route `/r/:token`

---

## 11. Alerts

**Tables:** `Alert`, `AlertEvent`.
**Alert config:** `{ platform, metricKey, threshold, condition: ABOVE | BELOW | PERCENT_CHANGE_UP | PERCENT_CHANGE_DOWN, severity: INFO | WARNING | CRITICAL, cooldownHours }`.

**Queue:** `ALERT_CHECK_QUEUE`. Processor evaluates thresholds on a schedule, writes `AlertEvent` on breach, respects `cooldownHours` to prevent spam.

**On trigger:** writes notification (`NotificationsService.notifyAdmins()`), sends optional email, surfaces in agency overview.

**Frontend:** Alerts CRUD page per campaign + event history viewer with severity filtering.

---

## 12. Goals

**Table:** `Goal` — `{ platform, metricKey, targetValue, periodStart, periodEnd }`.

**Progress computation** (`GoalsService.getProgress()`):
1. Query `getMetricSummary` for `(platform, metricKey, periodStart, periodEnd)`
2. Compute `actual / target * 100` → `progressPct`
3. Status via `goalProgressStatus()` utility:
   - `>= 100%` → ACHIEVED
   - `>= 70%` → ON_TRACK
   - `>= 40%` → AT_RISK
   - `< 40%` → BEHIND
4. 60s cache TTL

---

## 13. Scorecard, Forecast, Health

- **Scorecard** — period-over-period comparison page: `current vs prior` for top metrics with delta % and arrows
- **Forecast** — naive linear ROI projection (current trajectory → end of month/quarter)
- **Health** — sync recency score per integration: `(time-since-last-sync vs expected sync interval) + error rate %`

All three are read-only views of existing metric/integration data — no new storage.

---

## 14. Notifications

**Table:** `Notification` — `{ tenantId, userId, type, title, message, resourceType, resourceId, isRead }`.

**Real-time push:**
- SSE endpoint: `/notifications/stream`
- Frontend `NotificationBell.tsx` connects EventSource, exponential backoff `5s → 30s` on disconnect, **60s polling fallback** if SSE fails

**Server side:** `NotificationsService.create()` writes async (fire-and-forget — never throws), then `NotificationEventsService.emit()` pushes to subscribed SSE clients.

**`notifyAdmins()`** — queries all `AGENCY_OWNER + AGENCY_ADMIN` users for the tenant and creates one notification per user.

---

## 15. AI Features

**Single shared SDK wrapper:** `AnthropicClient` (`src/modules/ai/anthropic.client.ts`) — Anthropic SDK, 30s timeout, `claude-haiku-4-5` for both chat and report summaries (cost optimisation).

**Tables:** `ai_conversations` (id, tenantId, userId, **campaignId nullable**, **scope: CAMPAIGN | GLOBAL**, title), `ai_messages` (role, content, tokenCount).

### A. Per-campaign chat — `AiChatService`
**Endpoints:** under `/clients/:c/campaigns/:c/ai/conversations[/:id/messages|stream]`
**Per-message flow:**
1. `parseIntent(userMessage)` — extracts time range, metric keys, platform hints, comparison/timeseries signals
2. **Structured RAG** — fetches metric summary (current + prior period if comparison wanted), optional 3-metric timeseries, top 5 goals with status, recent 5 alerts, integration health
3. `buildChatSystemPrompt(ctxPayload)` — fresh prompt every request
4. Loads last 20 messages from DB for multi-turn context
5. **Tool-use loop** (max 5 rounds): if `stop_reason==='tool_use'` → dispatch tools → append `tool_result` blocks → loop. Else extract text and break.
6. Persist user + assistant messages

### B. Global agency-wide chat — `AiGlobalService`
**Endpoints:** under `/ai/global/conversations`
**System prompt:** agency snapshot (client count, campaign count, alert count, top 5 most-active clients with links). Live data ALWAYS fetched via tools (no pre-built RAG).

### C. AI Tools (8 callable by Claude) — `AiToolsService`
Each tool is `{ name, description, input_schema, dispatch() }`. `dispatch()` is bound to `user.tenantId` (RLS-enforced). Returns JSON-stringified payload.

| Tool | Purpose |
|---|---|
| `list_clients` | Search/filter clients with campaign counts + URLs |
| `list_campaigns` | Optionally per client |
| `list_reports` | Required before generating PDF |
| `query_metrics` | Live metric summary; multi-platform fallback if platform omitted |
| `get_recent_alerts` | Last N days, severity-tagged |
| `find_underperforming_goals` | Goals < 70% of target |
| `get_integration_health` | Per-platform status + last error |
| **`generate_report_pdf`** | Calls `ReportsService.generatePdf()` → returns signed `downloadUrl` |

**Critical flow** ("generate last week's report for Acme"):
`list_clients(search='acme')` → `list_campaigns(clientId)` → `list_reports(campaignId)` → `generate_report_pdf(campaignId, reportId, days=7)` → AI replies with markdown `[Download PDF](https://signed-url...)` which the frontend renders as a green download pill.

### D. AI Report Summary — `AiReportService`
**Endpoint:** `POST .../reports/:id/ai-summary?force=true`
- Builds context from report's date range, connected platforms, metric summaries (current + prior with `computeChangePct`), goals, integration health
- `REPORT_SUMMARY_SYSTEM_PROMPT` instructs 3-5 paragraph professional narrative, no fabrication
- **24h cache** with version tracking on `aiSummary`, `aiSummaryGeneratedAt`, `aiSummaryVersion`
- Re-renders only if `force=true`, version changed, or >24h old

### E. AI Insights (proactive, no LLM) — `AiInsightsService`
**Endpoint:** `GET .../ai/insights`
- Heuristic comparison: last 7 days vs prior 7 days
- Top 3 metrics with absolute delta ≥ 10%
- Sentiment by metric type: cost metrics (spend/CPC/CPM/bounce_rate) — UP=negative; everything else — UP=positive
- Returns `{direction, sentiment, headline}` with emoji prefix
- 1h cache

### F. Public marketing chat — `AiPublicService`
**Endpoint:** `POST /ai/public/messages` (no auth, 8 req/min/IP throttle)
- Stateless — browser sends `{message, history[]}`; nothing persisted
- System prompt (`public-assistant.prompt.ts`) baked with: features, all 85 integrations grouped by category, real pricing ($0/$79/$179), security info, sign-up links
- Hard guardrails: only AgencyPulse questions, refuse jailbreak attempts, never invent features/prices
- Max 400 tokens out
- Frontend `PublicAiWidget` on landing/auth pages

### G. Frontend AI components
- `MarkdownMessage.tsx` — `react-markdown + remark-gfm` with smart link routing: `/clients/...` → `<Link>`, signed PDFs/`.pdf` → green Download pill, others → external link with icon
- `AiChatPanel.tsx` — reusable chat panel; tool execution surfaced as toast
- `GlobalAiWidget.tsx` — floating bubble bottom-right (z-50, 56×56), 420×640 panel, conversation history drawer, persists `conversationId` in localStorage
- `PublicAiWidget.tsx` — same look, stateless
- Throttle: 20 req/min/user for chat, 5 req/min/user for report summary

---

## 16. Billing (Stripe)

**Tables:** `BillingEvent` (idempotent — `stripe_event_id` UNIQUE), `Agency.{stripeCustomerId, plan, trialEndsAt}`.

**Plans** (`src/modules/billing/constants/plans.ts`):

| Plan | Price | Clients | Staff | Integrations/Campaign |
|---|---|---|---|---|
| FREELANCER | $0 | 2 | 1 | 2 |
| AGENCY | $79/mo | 20 | 10 | 10 |
| AGENCY_PRO | $179/mo | ∞ | ∞ | ∞ |

**Webhook:** `BillingWebhookService`:
- Validates Stripe signature
- Records event idempotently
- `checkout.session.completed` → set `stripeCustomerId`
- `customer.subscription.*` → maps `priceId → plan` via `planFromPriceId()`, updates agency

**Limits enforcement:** `BillingLimitsService.assertWithinLimits()`:
- Counts current resource usage
- Compares to `PLAN_LIMITS[plan].maxXxx`
- AGENCY_PRO short-circuits without DB query (uses `Number.POSITIVE_INFINITY`)
- Trial period grants AGENCY-tier limits even on FREELANCER plan

**Frontend:** redirects to Stripe Checkout for upgrade, Stripe Customer Portal for plan management.

---

## 17. Audit Log

**Table:** `AuditLog` (immutable, append-only) — `{ tenantId, userId nullable, userEmail, action, resourceType, resourceId, resourceName, metadata JSONB, ipAddress, createdAt }`.

**No FK on user_id or resource_id** — records survive deletion (audit trail must persist).

**`AuditService.log()`** — fire-and-forget, never throws (audit failure must not break the user action). Called from service layers on every mutation: CREATE, UPDATE, DELETE, CONNECT, DISCONNECT, GENERATE.

**Read endpoint:** `GET /agencies/audit-log` — paginated, filter by `resourceType`, ADMIN+ only.

---

## 18. Branding

**Agency fields:** `logoUrl`, `faviconUrl`, `primaryColor`, `secondaryColor`, `customDomain`, `emailFromName`, `emailFromAddress`.

**Public branding lookup** (`BrandingService.getPublicBranding()`):
1. `HostResolutionService` resolves the request's `Host` header to a tenant via `customDomain`
2. Returns `{logoUrl, primaryColor, ...}` or platform default
3. **No auth required** — used at login screen to swap branding before user has a session

**Frontend:** `BrandingProvider` (`src/contexts/BrandingContext.tsx`) injects CSS vars (`--primary`, `--accent`) at app boot. Logo slot in topbar + email "from" name uses agency name.

**Per-agency email sender:** `EmailService` accepts an `AgencyFrom` override — emails sent from `"Acme Marketing" <reports@acme.com>` if `emailFromAddress` is set, else falls back to platform default sender with the agency name prepended.

**Uploads:** PNG/JPEG/SVG/WebP MIME validation; tenant-scoped storage keys.

---

## 19. Templates Marketplace

**Two tiers:**
- **System templates** — `DashboardTemplate`/`ReportTemplate` (no tenant), seeded by us
- **Agency templates** — `isTemplate=true` flag on regular dashboard/report rows, tenant-scoped

**Operations** (`src/modules/templates/templates.service.ts`):
- `cloneDashboardTemplate()` — transactional deep copy of widgets
- `cloneReportTemplate()` — copies sections array
- `saveDashboardAsTemplate()` — marks an existing dashboard with `templateName/templateDescription`
- Browse endpoint: paginate by `category | platform`, sort by `cloneCount DESC`

---

## 20. Custom KPIs

**Table:** `CustomMetricDefinition` — `{ tenantId, name, formula, variableKeys[] }`.

**Formula examples:**
- `revenue / sessions * 100` → revenue per 100 visits
- `clicks / impressions * 100` → CTR (built-in equivalent exists)

**Evaluation** (`KpiService`):
1. `evaluateFormula()` parses expression, looks up base metric values from a fetch round
2. Validates: rejects formulas referencing other custom metrics (would resolve to 0 — explicit error instead)
3. 5-min cache (matches `MetricsService` cache TTL)

---

## 21. Client Portal

**Hard separation** from agency app:
- All routes under `/portal/*`
- Layout: `ClientPortalLayout` — distinct nav, no admin chrome, "Powered by [Agency]" footer
- Router-level redirects: CLIENT_USER hitting non-`/portal` route → redirect to `/portal`; AGENCY_* hitting `/portal/*` → redirect to `/`
- **Never** uses `{role === 'CLIENT_USER' ? ... : ...}` branches inside agency components — strict invariant to prevent role leak

**Pages:**
- `/portal` — landing (auto-redirects if single client)
- `/portal/:clientId` — client home, 3 tabs (Overview / Dashboards / Reports), pulls `GET /campaigns/:c/portal-summary` for KPI strip + AI narrative + next-report card
- `/portal/:clientId/campaigns/:c/dashboards/:id` — read-only dashboard viewer (reuses `DashboardViewer` — edit buttons hidden on role check)
- `/portal/:clientId/campaigns/:c/reports[/:id]` — read-only reports

**Backend:** `PortalSummaryService.getPortalSummary()` — single endpoint returns 4 KPI cards (with delta %), next scheduled report, AI narrative snippet (280 chars, word-boundary), last sync timestamp. Uses `$transaction` with `SET LOCAL app.current_tenant` for RLS. CLIENT_USER access verified by `clientUserAssignments.some({ userId })`.

---

## 22. Current State

**Backend ✅ complete and TypeScript-clean:**
- 47 of 48 features (all phases through 8.12 + 3.7 + 3.8 + 3.9)
- 85 platform catalog + 27 OAuth + ~50 API-key + 8 dedicated modules
- 76 Jest spec files, 340 tests passing
- All tool-use AI flows wired (8 tools, max 5 rounds)
- Public + Global + Per-campaign AI all live
- Email verification + forgot password + 3-step signup all wired
- Migrations ready: `20260502000001_auth_extras` (auth columns), `20260502000002_ai_global_scope` (AI conversation scope)

**Frontend ✅ Phase A + B1-B16 done:**
- 5-role RBAC + portal hard separation
- 3-step signup, forgot/reset password pages, email verification banner
- Integrations page with 85 platforms + category tabs + search + brand logos via `@iconify/logos` and `simple-icons`
- Global AI floating widget on every agency page (post-login)
- Public AI bubble on landing page + all auth pages
- Per-campaign AI chat with tool-use + markdown rendering
- All major pages built: clients, campaigns, dashboards, reports, alerts, goals, notes, health, scorecard, forecast, export, AI assistant, team, templates, KPI definitions, settings (profile/branding/billing/audit-log/notifications)
- Client portal: landing → client home (3 tabs) → dashboard viewer → reports

**Deployment:**
- Backend on Render (free tier, Singapore), auto-deploys on push to `main`, ~50s cold start
- Frontend on Vercel
- Database: Neon Postgres (staging — RLS not enforced yet, both app + migration roles aliased to `neondb_owner`)
- Redis: Upstash (TLS enabled via `REDIS_TLS=true`)
- Email: SMTP stub in staging (Gmail SMTP working in dev) — needs Resend/Postmark for prod
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for full deploy notes + known prod issues

**What's NOT yet done:**
- Per-platform sync method coverage in `IntegrationSyncProcessor` for the 74 stub-architecture platforms (frontend can connect them, backend stores credentials, but cron won't sync them yet — only the 8 dedicated-module platforms sync today)
- Production RLS enforcement (Neon currently uses owner role for both — needs migration to least-privilege `agencypulse_app` role)
- `set_updated_at()` trigger function should be a proper migration (currently pre-seeded manually on Neon)
- SMTP not configured in prod
- Anthropic API key not yet set on Render → AI features 503 in staging

---

## Quick reference — where to find what

| Concern | Path |
|---|---|
| Auth | `agency-backend/src/modules/auth/` |
| RLS / tenant context | `agency-backend/src/database/`, `agency-backend/src/common/tenant/` |
| Integrations | `agency-backend/src/modules/integrations/` |
| Sync engine | `agency-backend/src/modules/sync/` |
| Metrics | `agency-backend/src/modules/metrics/` |
| Reports | `agency-backend/src/modules/reports/` |
| AI | `agency-backend/src/modules/ai/` |
| Billing | `agency-backend/src/modules/billing/` |
| Frontend AI components | `agencypulse/src/components/ai/` |
| Frontend layouts | `agencypulse/src/components/layout/` |
| Auth pages | `agencypulse/src/components/auth/`, `agencypulse/src/pages/auth/` |

---

## Meeting cheat-sheet — likely questions and answers

> **"How do you keep one agency's data isolated from another's?"**
> Postgres Row-Level Security. Every table has `tenant_id`. The app role `agencypulse_app` is bound by RLS policies. On every request we extract `tenantId` from the JWT and `SET app.current_tenant` before the query runs — RLS policies use `current_tenant_id()` to filter. Auth-level operations use a separate owner role (systemPrisma) since tenant context isn't established yet.

> **"What happens if someone steals a refresh token?"**
> We hash all refresh tokens (SHA-256) and rotate on every use. If a `revoked_at` token is reused (theft signature), `revokeAllUserTokens()` kills every session for that user. Refresh cookies are httpOnly + sameSite=strict + path-scoped to /api/v1/auth.

> **"How does the AI generate a real report?"**
> Tool-use. Claude has 8 tools defined as JSON schemas. When user says "generate Q4 report for Acme", Claude calls `list_clients` → `list_campaigns` → `list_reports` → `generate_report_pdf`. The last tool calls our `ReportsService.generatePdf()` which renders Puppeteer HTML→PDF, uploads to object storage, returns a signed URL. Claude wraps it in markdown `[Download PDF](url)` which the frontend renders as a download pill.

> **"How do you sync 85 different platforms?"**
> 8 platforms with unique quirks have dedicated modules (GA4 service-account, Meta long-lived token, etc). 27 OAuth platforms share `StandardOAuthService` with per-platform config (PKCE, Basic auth, custom URL templates). ~50 API-key platforms share `StandardApiKeyService`. All 74 stub-architecture services implement the same `fetchCoreMetrics(token, accountId, dateRange)` interface — BullMQ processor dispatches via switch/case and writes to `MetricValue`.

> **"What happens when an integration breaks?"**
> Sync job retries 3x with exponential backoff + jitter. After 3 failures, `status=ERROR`, `lastErrorMessage` populated. Surfaces in agency overview with severity, in `get_integration_health` AI tool, and in the integration detail page. Token refresh is automatic if expiring within 5 min.

> **"How does the public chat differ from the in-app one?"**
> Public is **stateless** (no DB, browser keeps history in localStorage), **no tools** (no data access), heavy IP throttle (8/min), 400-token cap, hard-scoped system prompt that refuses anything off-topic. The in-app one is multi-turn-persistent, has tool access (live data + report generation), tenant-scoped via RLS.

> **"Where are OAuth tokens stored and how are they protected?"**
> Encrypted at rest with AES-256-GCM in `IntegrationConnection.accessTokenEnc/refreshTokenEnc`. Format `v1:<iv>:<tag>:<ciphertext>` is versioned for future key rotation. Random 12-byte IV per encryption, 16-byte auth tag. Encryption key is a 64-char hex env var (`ENCRYPTION_KEY`).

> **"How does branding work for white-label?"**
> The login screen does a public `GET /branding` that resolves `Host` header to a tenant via `customDomain`. Returns logo + primary color. `BrandingProvider` injects CSS vars at app boot. Same agency logo used in PDF reports and email "from" name (`"Acme Marketing" <reports@acme.com>` if custom email-from is set, else our default sender with agency name prepended).

> **"What's the data freshness?"**
> 6-hour sync cron by default (configurable via `SYNC_CRON` env var). On each sync, fetches data from `max(lastSyncAt - 1d, today - 30d)` to today — the 1-day overlap catches late-attribution updates that ad platforms backfill. Metrics reads are cached for 5 min in Redis with version-key invalidation (incremented on every sync write).

> **"How does the audit log catch malicious admin activity?"**
> Every mutation in service layers calls `AuditService.log()` (fire-and-forget — never breaks the user action). Records `userId`, `userEmail`, `action`, `resourceType`, `resourceId`, `metadata`, `ipAddress`. Append-only — no FK on user/resource so records survive deletion. Read via `GET /agencies/audit-log`, ADMIN+ only, paginated and filterable.

---

*This document is the synthesized current-state truth (verified against code on 2026-05-02). For the planned roadmap, see [PROGRESS.md](./PROGRESS.md). For per-feature build history, see [FEATURES.md](./FEATURES.md). For architecture decisions, see [DECISIONS.md](./DECISIONS.md).*
