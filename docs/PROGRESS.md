# Build Progress Tracker

Last updated: 2026-05-15 (Phase 5 real-data testing — GA4 ✅ complete, GSC ✅ complete with 6 bugs found and fixed)

---

## Current Status
**Phase**: Phase 5 — Real-data testing platform-by-platform
**Completed**: GA4 ✅ · GSC ✅ (6 bugs fixed)
**Completed**: GA4 ✅ · GSC ✅ · Platform logo badges on widgets ✅ · scrimverse.com GSC verified ✅
**Current Task**: YouTube Analytics real-data test

### Phase 5 — Real-Data Testing: Google Search Console (2026-05-15) ✅
- Connected GSC for techqwaz.com via Google OAuth two-step flow (OAuth → site picker → property saved)
- Built `GscSitePickerModal` component in `IntegrationsPage.tsx` — mirrors GA4 property picker pattern
- Added `triggerPostConnection()` to `IntegrationsService` — reusable method for two-step OAuth platforms
- Fixed 6 bugs (see FEATURES.md Phase 5 section for full list)
- Real data confirmed: 28 rows × 4 metrics (clicks, impressions, CTR, avg position)
- All 5 GSC widgets auto-seeding and displaying: Clicks KPI, Impressions KPI, CTR KPI, Avg Position KPI, Clicks & Impressions chart
- scrimverse.com pending GSC verification — to be done next session

### Phase 5 — Real-Data Testing: GA4 (2026-05-14) ✅
- Enabled `analyticsdata.googleapis.com` API in GCP project 433517348838
- Connected GA4 for techqwaz.com (property 318396549) and scrimverse.com
- Real data confirmed: sessions 46, users 25, new users 16, page views 748, bounce rate 32.7%, session duration 23m 8s
- All 7 GA4 widgets auto-seeding and displaying correctly

### Phase 3.9 Testing Harness — Platform Integration Tests + Test-Connection Endpoint (2026-04-29) ✅
- `src/common/http/fetch-with-retry.ts` — 429 retry wrapper with Retry-After support + exponential backoff
- `src/common/utils/safe-parse.ts` — safeInt, safeFloat, safeStr helpers used across all 74 platform services
- `src/modules/integrations/platforms/__tests__/helpers/mock-fetch.ts` — Jest mock for fetchWithRetry + fetchWithTimeout; supports queued single/sequence responses; string bodies passed through as-is for CSV mocking
- `src/modules/integrations/platforms/__tests__/helpers/mock-db.ts` — Jest mocks for mysql2/promise and pg Client
- `src/modules/integrations/platforms/__fixtures__/` — 81 fixture files (74 primary + 7 page2 paginated) covering all 74 platform API response shapes
- `src/modules/integrations/platforms/__tests__/` — 76 Jest test files (one per platform + mysql-db + amazon-redshift), 340 tests total, **all 340 passing**
- `src/modules/sync/test-connection.service.ts` — TestConnectionService dispatching to all 74 platform services
- `POST /sync/test-connection` (AGENCY_ADMIN+) — read-only probe: calls fetchCoreMetrics for last 7 days, returns `{status, rowCount, sampleRows}` or `{status: 'error', message}`
- TypeScript clean (tsc --noEmit 0 errors); Jest clean (73/73 suites, 340/340 tests)

### Phase 3.8 — Platform Catalog Expansion + Stub OAuth Connect Layer (2026-04-29) ✅
- `IntegrationPlatform` enum expanded 12 → 85 values; `IntegrationCategory` enum added
- Manual PostgreSQL migration (ADD VALUE IF NOT EXISTS) applied; Prisma client regenerated
- `PLATFORM_CATALOG` constants with metadata for all 85 platforms
- `StandardOAuthService` — full OAuth 2.0 auth-code flow for 27 platforms:
  - Standard POST-body credentials (most platforms)
  - HTTP Basic auth header (Reddit, Pinterest, X/Twitter) — **research-verified**
  - PKCE S256 (X/Twitter) — random verifier → SHA-256 challenge → verifier stored in signed state JWT → sent in token exchange — **research-verified**
  - BigCommerce `context` param forwarding — **research-verified**
  - Mailchimp `/oauth2/metadata` fetch after token exchange to store `dc` server prefix — **research-verified**
  - Per-shop URL templates (Shopify, BigCommerce)
- `StandardApiKeyService` — encrypted API key storage for ~30 API-key platforms
- `PlatformStubModule` registered last in `app.module.ts` (dedicated modules take priority)
- All new env vars added to `.env.example` and `configuration.ts`
- TypeScript clean (tsc --noEmit passed); NestJS build clean

### B16 Browser Testing + Bug Fixes (2026-04-25) ✅
Full end-to-end test of Client Portal invite flow completed. Bugs found and fixed:

- **Notifications Unread filter** — `enableImplicitConversion: true` converts `'false'` → `true` before `@Transform` runs. Fix: type `isRead` as `string` in DTO, `@IsIn(['true','false'])`, service converts `dto.isRead === 'true'`
- **Notifications delete button** — Added `DELETE /notifications/:id` backend endpoint + trash icon (group-hover) on frontend with optimistic cache update
- **Notifications heading** — Changed from red unread badge to plain black total count in brackets
- **EMAIL_FROM misconfiguration** — Was `no-reply@example.com`; Gmail SMTP rejects non-matching sender. Fixed to `AgencyPulse <kishanbm25@gmail.com>`
- **listPortalUsers missing pending users** — Only queried `clientUserAssignment` (created at accept time). Fixed to also fetch users with `pendingClientId=clientId, isActive=false` and merge both sets
- **resendClientInvite wrong field** — Frontend sent `{ userId }` but `POST /team/resend-client-invite` expects `{ email }`. Fixed mutation + call site
- **ReportDetail tabs in portal** — CLIENT_USER was seeing Schedule + Share Links tabs (agency-only). Fixed: tabs array filtered by `hasRole(role, "AGENCY_STAFF")` — CLIENT_USER (rank 10) only sees Sections, Delivery History, AI Summary
- **portal-users.controller.ts missing** — Module declared it but file didn't exist. Created `portal-users.controller.ts` in AssignmentsModule
- **Invite flow confirmed working** — Gmail SMTP sends real invite emails; `kishanbm22@gmail.com` accepted invite, logged in as CLIENT_USER (kishan nike), portal shows Test Client 1 with campaign, dashboards, reports
**Reference**: [FRONTEND_INTEGRATION_PLAN.md](./FRONTEND_INTEGRATION_PLAN.md)

### Portal Summary Backend + Portal UX Enhancements (2026-04-25) ✅
- **New backend module** (`src/modules/portal/`) — `portal-summary.service.ts`, `portal-summary.controller.ts`, `portal.module.ts` + registered in `app.module.ts`
- **`GET /campaigns/:campaignId/portal-summary`** — single call returns: 4 KPI cards with delta %, next report, AI narrative snippet (280-char, word-boundary), last sync timestamp
- KPI aggregation via raw SQL in `$transaction` with `SET LOCAL app.current_tenant` for RLS; last 30 vs prior 30 days; `dimension_key IS NULL` filter avoids double-counting
- All 5 roles handled: `assertCampaignAccess` checks CLIENT_USER via `clientUserAssignments: { some: { userId } }` — no `@Roles` guard needed
- **Portal invite management endpoints**: `GET /clients/:clientId/portal-users` (combined active + pending list) + `DELETE /clients/:clientId/portal-users/:userId` (revoke) — both ADMIN+ in `AssignmentsModule`
- **PortalClientHome enhanced**: KPI cards grid (`formatMetric` K/M/B suffixes, TrendingUp/Down delta badges), goals summary bar (avg progress + achieved/on-track/at-risk counts), next report badge (`cronToHuman` e.g. "Every Mon at 8:00 AM"), AI narrative with expand/collapse, data freshness ("Synced 2h ago")
- **ClientTeamPage portal access section**: "Portal Access" section, `InvitePortalDialog`, Active/Pending badges, Resend for pending, Revoke with AlertDialog confirmation, optimistic update with rollback
- Both repos TypeScript clean (tsc --noEmit passed)

### Frontend Phase B16 (2026-04-25) — Client Portal complete ✅
- 3 new pages under `/portal/...` — branded, read-only, CLIENT_USER scoped
- **PortalLanding** (`/portal`) — branded welcome with agency logo + greeting; auto-redirects if single client; grid of client cards with campaign counts if multiple
- **PortalClientHome** (`/portal/:clientId`) — 3-tab interface (Overview / Dashboards / Reports):
  - *Overview tab*: per-campaign cards showing connected platforms, issue indicators (amber left-border), "View Dashboard" + "View Reports" CTAs; amber border if integration issues
  - *Dashboards tab*: all dashboards across campaigns grouped by campaign, card grid with widget count
  - *Reports tab*: all reports across campaigns in a clean list with relative timestamps
  - Tabs use `?tab=` query params for deep-link + browser-back support
  - Hero header: agency logo, client name, personal greeting, quick-stat pills (campaigns/dashboards/reports)
- **PortalReportsList** (`/portal/:clientId/campaigns/:campaignId/reports`) — standalone read-only reports list with back navigation
- Reuses existing `DashboardViewer` + `ReportDetail` directly — edit buttons already hidden for `CLIENT_USER` via role checks
- No admin chrome anywhere in portal tree; "Powered by [Agency]" footer from ClientPortalLayout
- TypeScript clean (tsc --noEmit passed)

### Frontend Phase B15 (2026-04-25) — Agency Overview Command Center complete + browser tested ✅
- `/overview` — 5-section command center replacing StubPage
- **Scorecard strip**: Active Clients, Campaigns, Integration Health %, Connected/Total integrations — all live from `/agencies/health` + `/clients`
- **Insights layer**: CRITICAL/WARNING/INFO severity system — surfaces integration errors (red), expired tokens (amber), metric drops >30% (CRITICAL), 10–30% (WARNING), >20% gains (INFO); sorted by severity; each with "Fix now" / "View campaign" action buttons
- **Aggregated KPI cards**: Sessions, Users, Clicks, Impressions, Conversions, Ad Spend, Revenue, Leads — agency-wide sums across ALL campaigns, with period-over-period delta % (date range selector: 7d / 30d / 90d / MTD)
- **Campaign Ranking**: Top/Bottom performer toggle, bar chart preview, gold/silver/bronze medals, switchable by any metric (sessions/clicks/impressions/conversions/cost/revenue/leads), click → campaign detail
- **Integration Health**: per-campaign health status with colored icons (green/amber/red), scrollable, "Fix now" → integrations page
- **Clients strip**: grid of up to 8 clients with status indicator, click → client detail, "View all" → /clients
- Backend: 2 new endpoints — `GET /agencies/me/metrics/summary` (aggregates SUM across all campaigns with prior-period delta) + `GET /agencies/me/campaigns/ranking` (ranks by any metric); both with 5-min Redis cache, RLS, STAFF scoping
- TypeScript clean on both repos (tsc --noEmit passed)

### Frontend Phase B14 (2026-04-25) — Notifications Bell + SSE Stream complete ✅
- Bell icon in topbar: unread count badge (capped "9+"), hidden when 0, pulse animation (ring + scale + bounce) for 2s when new notification arrives
- Dropdown popover: last 20 notifications, unread rows bold + blue dot + bg tint, read rows muted; "Mark all read" button; empty state "You're all caught up"
- Click navigation: INVITE_ACCEPTED → /team, SYNC_FAILED/CONNECTED → /clients, others → /clients
- Optimistic mark-read: cache updated instantly, API called in background, reverts on error
- SSE stream via fetch() + ReadableStream (not EventSource — can't send auth headers): safe JSON.parse with try/catch, filters HEARTBEAT/CONNECTED events, exponential backoff reconnect (5s → 30s cap), AbortController cleanup on unmount
- Baseline poll every 60s as SSE fallback; relative timestamps refresh every 60s
- TypeScript clean (tsc --noEmit passed)

### Frontend Phase B13 (2026-04-25) — Audit Log Viewer complete ✅
- `/settings/audit-log` (ADMIN+) — quick filter chips (All / Integrations / Reports / Team), filter bar (Action dropdown, Resource dropdown, From/To date inputs with 300ms debounce), table with 7 columns
- Table: Timestamp (relative "2h ago" + absolute tooltip), User (email or "System" pill), Action (colored badge), Resource type, Resource name, IP address, Details (metadata expand)
- Action badge colors: CREATE/CONNECT/INVITE → green · UPDATE/GENERATE → blue · DELETE/DISCONNECT/REVOKE → red · RESTORE → cyan
- Metadata viewer: inline JSON expand with copy-to-clipboard button + toast confirmation, max-h-48 scrollable pre block
- Pagination: numbered page buttons with ellipsis, Prev/Next, "Showing X–Y of Z entries" count, page resets to 1 on filter change
- Empty state: "No audit log entries match your filters" + Clear filters button
- TypeScript clean (tsc --noEmit passed)

### Frontend Phase B12 (2026-04-25) — Billing/Stripe complete + browser tested ✅
- `/settings/billing` (OWNER only) — current plan card (plan badge + status badge), usage meters (Clients/Staff/Integrations with progress bars, red overflow, "Limit exceeded"), plan comparison grid (Starter/Agency/Agency Pro), "Most Popular" badge on Agency
- Upgrade flow: POST /billing/checkout → loading state per plan → `window.location.href = checkoutUrl`
- Manage Subscription: POST /billing/portal → instant redirect
- Trial banner: amber/red with days countdown, red when ≤3 days, "Upgrade Now" CTA
- Stripe not configured: amber info card shown (correct — no Stripe keys in dev env)
- `/billing/success` — subscription activated card + 3s countdown auto-redirect to billing
- `/billing/cancel` — no changes card + back to billing button
- TypeScript clean (tsc --noEmit passed after fixing TooltipTrigger asChild issue)

### Frontend Phase B11 (2026-04-25) — Custom KPIs + Templates complete + browser tested ✅
- `/kpi-definitions` (Settings → Custom KPIs) — Built-in KPI cards (CTR/CPC/ROAS/CPM), agency-level custom KPI list, create modal with real platform metric keys loaded from backend, delete with confirmation, evaluate against any campaign with platform + date range selectors
- KPI evaluate: `GET /clients/:clientId/campaigns/:campaignId/kpi?platform=GA4&from=…&to=…` — results in 3 sections: Custom KPIs, Built-in Derived KPIs, Raw base metrics (expandable)
- `/templates` (Manage → Templates) — template marketplace grid, clone modal, "Save as Template" button on DashboardViewer and ReportDetail
- 3 bugs fixed: (1) API routes were campaign-scoped — changed to `/agencies/me/kpi-definitions`; (2) DTO had wrong fields `{ label, inputMetrics[] }` → `{ name, formula, platform }`; (3) evaluate endpoint required `platform`+`from`+`to` query params + response shape was `{ base, derived, custom }` not `{ results[] }`
- All values 0/No data for test campaign — correct behavior, no real platform data ingested yet

### Frontend Phase B10 (2026-04-25) — Health + Scorecard + Forecast + Export complete + browser tested ✅
- Health (`/health`) — summary pills (connected/expired/error/disconnected counts), integration cards with status badge, last sync time with absolute tooltip, error truncation with show more/less, "View data" → dashboards, "Reconnect" → integrations ✅
- Scorecard (`/scorecard`) — platform selector, date range picker, current/prior period labels, "No metric data for this period" empty state (expected — no GA4 sync yet) ✅
- Forecast (`/forecast`) — platform + metric selectors, historical window picker, forecast horizon slider, ComposedChart with historical line + dashed projected line + 95% CI band, summary cards (projected total, projected end value, trend + R² model fit label) ✅
- Export (`/export`) — Time-series/Summary tabs, platform dropdown, date range, Day/Week/Month granularity, CSV/.XLSX format toggle, blob download with auth header (not window.open), CSV file downloaded successfully ✅
- No bugs found — all 4 pages worked on first load

### Frontend Phase B9 (2026-04-25) — AI Assistant + Insights + Report Summary complete + browser tested ✅
- AI Assistant page (`/ai`) — left panel: conversation list + "New Chat" button; right panel: SSE streaming chat, example prompts, 0/2000 char counter, Cmd/Ctrl+Enter to send, auto-scroll
- AI Insights panel — embedded on CampaignHomePage below nav cards, top-3 metric changes with sentiment colours, silently hidden on error/no data
- AI Summary tab on ReportDetail — 5th tab, generate/regenerate button, cached badge, graceful 503 error
- AI features require ANTHROPIC_API_KEY — all 3 surfaces show "AI features are not configured" graceful error when key is missing (correct behavior, not a bug)
- No crashes — all error states handled cleanly

### Frontend Phase B8 (2026-04-25) — Alerts + Goals + Notes complete + browser tested ✅
- `/clients/:clientId/campaigns/:campaignId/alerts` — list with severity badges (INFO/WARNING/CRITICAL), condition summary ("sessions above 5 (daily)"), cooldown display, debounced active toggle (400ms), expandable fire history, create/edit modal (platform+metric+condition+threshold+period+severity+emails+cooldown), delete confirmation
- `/clients/:clientId/campaigns/:campaignId/goals` — progress cards with progress bar, status badge (ON_TRACK/AT_RISK/BEHIND/ACHIEVED), period label, create/edit modal with auto-suggest date ranges, ACHIEVED locked state, progress clamped to 100%
- `/clients/:clientId/campaigns/:campaignId/notes` — compose area always visible at top, char counter (red >4500), Add Note button, note cards with pin badge, pin/unpin toggle, inline edit (Esc=cancel, Cmd/Ctrl+Enter=save), delete confirmation, optimistic updates on all mutations
- No bugs found — all 3 pages worked on first load

### Frontend Phase B7 (2026-04-25) — Reports complete + browser tested ✅
- `/clients/:clientId/campaigns/:campaignId/reports` — list reports (name, status badge, created date), create report dialog, delete confirmation
- `/clients/:clientId/campaigns/:campaignId/reports/:reportId` — 4-tab detail: Sections, Schedule, Share Links, Delivery History
- Report Builder (edit mode) — add/remove/reorder sections, type-specific config (METRICS: platform + metric picker, CHART: chart type, TEXT: content), save via PATCH
- Schedule tab — create/update cron schedule with human-readable display (`0 8 * * 1` → "Every Monday at 8:00 AM"), date range days, recipient emails
- Share Links tab — generate token link, copy to clipboard, revoke (optimistic removal), expiry display
- Delivery History tab — past email deliveries with status + recipient list
- Publish/Unpublish toggle on detail page header
- Generate PDF — triggers backend Puppeteer job, shows loading toast, download button appears on completion
- Shared report public page (`/r/:token`) — no-auth page showing report name + section cards; handles expired/revoked (404/403/410 → "Link expired or revoked")
- 2 bugs fixed: (1) `SharedReportData` type mapped to wrong shape — backend returns `{ report: {...}, downloadUrl, linkExpiresAt }` not flat; (2) `data.agency` was undefined — backend doesn't return agency field, fixed with optional chaining + "Agency Report" fallback

### Frontend Phase B5+B6 (2026-04-24) — Dashboard viewer + editor complete + browser tested ✅
- `/clients/:clientId/campaigns/:campaignId/dashboards` — list dashboards, create dashboard (POST → redirect to new), empty state, loading skeletons
- `/clients/:clientId/campaigns/:campaignId/dashboards/:dashboardId` — viewer with real widget data (KPI, Line, Bar, Pie, Table), date range picker refetches on change, 403/error states
- `/clients/:clientId/campaigns/:campaignId/dashboards/:dashboardId/edit` — same DashboardViewer, auto-enters edit mode from URL (ADMIN+)
- Edit mode: drag-to-reposition via react-grid-layout, Add Widget modal (platform + metric picker), WidgetConfigPanel for selected widget, diff-based save (only PATCH changed widgets), Cancel reverts snapshot
- `types/dashboard.ts` — added YOUTUBE_ANALYTICS, TIKTOK_ADS, AMAZON_ADS to IntegrationPlatform enum
- `useConnectedPlatforms` — fixed URL bug (was using campaignId as clientId), accepts both clientId + campaignId; clientId is UI/nav only, API calls use campaignId only
- `AddWidgetModal` — added 3 missing platforms; connected-only platforms are selectable

### Frontend Phase B4 (2026-04-24) — Integrations / Data Sources complete
- `/clients/:clientId/campaigns/:campaignId/integrations` — grid of 8 platform cards (GA4, Google Ads, Meta Ads, Search Console, YouTube, LinkedIn Ads, TikTok Ads, Amazon Ads)
- DISCONNECTED / CONNECTED / ERROR states per card; connected cards show account ID + last synced time
- Connect flow: GET auth-url → full-page redirect to platform OAuth → backend callback → redirect back to integrations page with `?connected=platform` → success toast + refetch
- Disconnect: optimistic update, confirmation dialog names the platform, `DELETE /integrations/:platform`
- RBAC: STAFF sees cards read-only; ADMIN+ gets Connect/Disconnect buttons
- **Backend fix**: `OAuthStatePayload` updated to include `clientId`; all 8 platform OAuth services updated to pass `clientId` from DB (not user input) into state JWT; all 8 callbacks now redirect to `/clients/:clientId/campaigns/:campaignId/integrations?connected=...` — no sessionStorage hack, production-grade
- `src/types/integrations.ts` — IntegrationConnection, PLATFORM_META config

### Frontend Phase B3 (2026-04-24) — White-label settings complete
- `/settings/profile` — Agency profile: edit name + slug (ADMIN+), slug regex validation (no leading/trailing/double hyphens), server error surfaced nicely for duplicate slug, save disabled unless dirty+valid, resets dirty state after save
- `/settings/branding` — White-label branding (OWNER only): logo upload (PNG/JPEG/SVG/WebP, 2 MB), favicon upload (ICO/PNG, 512 KB), brand colors (primary + secondary with color pickers + hex inputs + live preview strip), custom domain with CNAME helper text, email from-name + from-address with SPF/DKIM note
- Client-side file validation (type + size) before upload, spinner during upload, cache-busted URLs (`?v=timestamp`) after upload
- BrandingProvider `refresh()` called after every save — logo, favicon, and CSS vars update live without page reload
- RBAC: sidebar Branding nav item already gated at `minRole: AGENCY_OWNER`; Save button disabled server-side if role is wrong (RoleRoute guard blocks at route level)
- All 7 AI reviewer safeguards applied: slug regex, server errors, debounce-free atomic refresh, SVG warning, upload validation, form dirty state, RBAC UI guard

### Frontend Phase B2 (2026-04-24) — Team management browser-tested ✅
- `/team` — list all members with role badges + Active/Pending status, invite staff (POST /team/invite), resend invite on pending rows, remove member (OWNER only)
- `/clients/:clientId/team` — staff assigned to a specific client, assign from dropdown (active AGENCY_STAFF only, already-assigned filtered out), unassign with confirmation
- Optimistic updates on invite + assign + remove — UI updates instantly, revalidates on settle
- DB verified: `staff_client_assignments` rows correctly created/deleted, RLS tenant isolation confirmed
- 5 bugs found and fixed during testing (see TEST.md B2 section): RLS on invite, pending filter, remove token clear, re-invite removed users, UUID in select trigger

### Frontend Phase B1 (2026-04-24) — Clients & Campaigns complete
- `/clients` — real API list (GET), create (POST), edit (PATCH), delete (DELETE), search, list/grid toggle, role-gated (ADMIN+ for mutations)
- `/clients/:clientId` — client detail: header with status/website/counts, campaigns list, create/edit/delete campaigns, status badges (ACTIVE/PAUSED/INACTIVE)
- `/clients/:clientId/campaigns/:campaignId` — campaign home with 11 feature nav cards (Dashboards, Reports, Integrations, Alerts, Goals, Notes, Health, Scorecard, Forecast, Export, AI Assistant)
- `src/types/clients.ts` — typed shapes aligned to real backend (ClientStatus, CampaignStatus, PaginatedMeta with meta wrapper)
- Bug fixed: campaigns list staleTime removed so invalidation triggers immediate refetch after create/edit/delete
- All data verified in PostgreSQL: RLS tenant isolation confirmed, correct UUIDs, status fields correct

### Frontend Phase A (2026-04-24) — Foundation complete
- Backend leakage purged (Express, Prisma, bcrypt, jsonwebtoken removed from agencypulse)
- Project structure fixed (`@/` alias → `src/`, `components/ui/` + `lib/utils.ts` moved under `src/`)
- Unified Role enum matching backend (SUPER_ADMIN, AGENCY_OWNER, AGENCY_ADMIN, AGENCY_STAFF, CLIENT_USER)
- RBAC utilities: `rbac.ts` (hasRole, roleHome, isAgencyRole, isClientUser), `useRole`, `<RequireRole>`, `<RoleRoute>`
- API client hardened: `/api/v1` baseURL, refresh-on-401 single-flight, typed error helper
- Real auth flow wired: login, register, refresh, logout, /auth/me — role-aware redirects via roleHome helper
- BrandingProvider: fetches `/branding` on boot, injects CSS vars, updates favicon + title, falls back to platform defaults
- Two separated layouts with HARD route-tree isolation:
  - `<AgencyAppLayout>` (OWNER/ADMIN/STAFF) — sidebar + topbar + user menu, role-filtered nav (Clients, Team, Templates, Custom KPIs, Settings)
  - `<ClientPortalLayout>` (CLIENT_USER) — built fresh, never shares components with agency app
  - Cross-tree access is redirected at router level before any component mounts
- AcceptInvitePage with role-aware post-activation redirect
- StubPage component — every Phase-B route lands on this with slice label + backend endpoint list until its slice ships
- Full route tree registered in App.tsx with layered RoleRoute guards (min=AGENCY_OWNER / AGENCY_ADMIN / portalOnly)
- Verified: typecheck clean, Vite dev server boots, HTML served with correct title, SPA routes return 200

---

## Completed Milestones
- [x] Platform research (AgencyAnalytics, competitors, tech patterns)
- [x] Tech stack decision (NestJS + PostgreSQL + Redis + BullMQ)
- [x] Documentation system set up
- [x] CLAUDE.md created for context persistence
- [x] **Phase 1.1** — Backend project setup (NestJS + Docker Compose + config + Prisma + Swagger)
- [x] **Phase 1.2** — Database schema (6 models, 4 enums, soft deletes, indexes, migration SQL, seed)
- [x] **Phase 1.3** — RLS policies (current_tenant_id(), per-table policies, app role setup script)
- [x] **Phase 1.4** — Authentication (register, login, JWT, refresh rotation, rate limiting, RLS-safe login)
- [x] **Phase 1.5** — RBAC (5-level hierarchy, RolesGuard, @Roles decorator, global APP_GUARD)
- [x] **Testing** — Full integration test suite (15/15 passing): register, login, /me, refresh rotation, token theft detection, RLS tenant isolation, rate limiting, logout
- [x] **Phase 1.6** — Agency onboarding (agency profile, invite staff, accept invite, email via Nodemailer+Handlebars)
- [x] **Phase 2.1** — Client management (CRUD, soft delete/restore, role-scoped list, client_user_assignments table)
- [x] **Phase 2.2** — Campaign CRUD (nested routes, single-query role scoping via relational conditions, soft delete, paginated list)
- [x] **Phase 2.3** — Staff assignment management (assign/unassign AGENCY_STAFF to clients, DB constraint duplicate handling, validated client + user)
- [x] **Phase 2.4** — Client portal login (CLIENT_USER invite + resend, pendingClientId migration, ClientUserAssignment created at accept time, reuses accept-invite flow)
- [x] **Phase 3.1** — Integration framework (OAuth token manager, AES-256-GCM encrypted storage)
- [x] **Phase 3.2** — Google Analytics 4 integration (OAuth connect flow, GA4 API client, token refresh)
- [x] **Phase 3.3** — Google Ads integration (shared GoogleOAuthService, Google Ads OAuth flow, GAQL API client, customerId normalization)
- [x] **Phase 3.4** — Meta Ads integration (OAuthStateService extracted, Facebook OAuth, short→long token exchange, proactive expiry, adAccountId validation)
- [x] **Phase 3.5** — BullMQ background job system (IntegrationSyncProcessor, deterministic jobId, jitter backoff, precise error states, 7-day default range, manual trigger endpoint)
- [x] **Phase 3.6** — Data sync scheduler (SyncSchedulerService, 6-hour cron, 30-day cap, platform staggering, scheduler_run_id, 500 job limit, oldest-first ordering, soft-delete guards)
- [x] **Phase 4.1** — Metrics data model + sync-to-storage wiring (metric_definitions + metric_values tables, bulk upsert, value normalization, sync processor wiring)
- [x] **Phase 4.2** — Metrics query layer + Redis caching (CacheService, versioned invalidation, time-series with DATE_TRUNC, KPI summary, period filling, grouped response format)
- [x] **Phase 5.1** — Dashboard CRUD (dashboards + dashboard_widgets tables, RLS, soft deletes, multiple dashboards per campaign, is_default flag, campaign_id on widgets for integrity)
- [x] **Phase 5.2** — Batch widget data endpoint (POST .../widgets/data — all widget data in one call, KPI summary + time-series, comparison period support)
- [x] **Phase 5.3** — Default dashboard on campaign create (auto-creates "Main Dashboard" with is_default=true via fire-and-forget from CampaignsService)

---

## Remaining Build Order

### Phase 5: Dashboard System
`3 / 5 complete`
- [x] 5.1 Dashboard CRUD (backend — DB schema, API, access control)
- [x] 5.2 Widget data endpoint (backend — batch endpoint, resolves by widget type)
- [x] 5.3 Default dashboard on campaign create (auto-created on campaign create)
- [x] 5.4 Frontend: Dashboard viewer + widget rendering (KPI cards, charts, tables, date picker, real API integration)
- [x] 5.5 Frontend: Dashboard editor (drag-and-drop layout, widget config, ADMIN only)

### Phase 6: Report System
`4 / 4 complete`
- [x] 6.1 Report builder (backend — report + sections data model, API)
- [x] 6.2 PDF generation (Puppeteer, StorageService, MinIO, 30s timeout, batch metrics)
- [x] 6.3 Scheduled email reports (ReportSchedulerService, BullMQ dedup jobId, delivery tracking)
- [x] 6.4 Shareable report links (UUID token, revoke, @Public endpoint, signed download URL)

### Phase 7: White Labeling
`3 / 3 complete`
- [x] 7.1 Per-agency logo + color theming (logo/favicon upload → MinIO, colors, public branding endpoint)
- [x] 7.2 Custom subdomain routing (HostResolutionService, Redis cache, isActive guard, TenantMiddleware fallback)
- [x] 7.3 Custom email sending domain (per-agency from name + address on all email methods)

### Phase 3.7: Additional Integrations
`5 / 5 complete`
- [x] 3.7a Google Search Console (clicks, impressions, CTR, avg position — Google OAuth, Search Analytics API)
- [x] 3.7b YouTube Analytics (views, watch time, likes, subscribers — Google OAuth, YT Analytics API v2)
- [x] 3.7c LinkedIn Ads (impressions, clicks, spend, conversions — LinkedIn OAuth 2.0, 60-day tokens)
- [x] 3.7d TikTok Ads (spend, impressions, clicks, CTR — TikTok Business API, auth_code flow, 24h tokens)
- [x] 3.7e Amazon Ads (impressions, clicks, spend, sales, orders — LWA OAuth, async report polling)

### Phase 8: Advanced Features & Differentiators
`12 / 12 complete`
- [x] 8.1 Alerts & monitoring (threshold alerts, budget alerts, BullMQ post-sync check)
- [x] 8.2 Goal tracking (goals table, CRUD, progress endpoint with ON_TRACK/AT_RISK/BEHIND/ACHIEVED)
- [x] 8.3 KPI engine / custom calculated metrics (formula builder, derived metrics)
- [x] 8.4 AI report explanation (Claude API — plain-English performance summary per report, 24h cache, version-aware)
- [x] 8.5 AI assistant / campaign Q&A — AWS Q-style (multi-turn conversation + structured RAG + SSE streaming + proactive insights)
- [x] 8.6 Data Health Monitor (GET /campaigns/:id/health, GET /agencies/health, per-platform status)
- [x] 8.7 Data export (CSV streaming + XLSX via ExcelJS, 365-day cap, throttled)
- [x] 8.8 ROI forecasting (OLS linear regression, R² confidence flag, 95% CI band)
- [x] 8.9 Scorecard system (period-over-period comparison, GOOD/WARNING/BAD/NEW status per metric)
- [x] 8.10 Client communication hub (campaign_notes CRUD, pinned notes, role-scoped, soft delete)
- [x] 8.11 Template marketplace (dashboard_templates + report_templates, clone operation, save-as-template, seeded templates)
- [x] 8.12 Billing — Stripe (subscription plans, usage limits, Checkout + Customer Portal, webhook idempotency, trial)

### Audit Log
`1 / 1 complete`
- [x] Audit Log — `audit_logs` table, `AuditService` (fire-and-forget), wired into Clients/Campaigns/Team/Integrations, `GET /agencies/audit-log` ADMIN-only paginated endpoint

### In-App Notifications
`1 / 1 complete`
- [x] Notification system — `notifications` table, `NotificationsService`, `NotificationEventsService` (EventEmitter), SSE stream (`GET /notifications/stream`), list/count/mark-read endpoints, wired into alerts, sync failures, report delivery, invite acceptance

### Phase 9: Multi-Agency Hierarchy
`0 / 1 complete`
- [ ] 9.1 Sub-agency model (parent_agency_id, RESELLER role, master visibility, billing split — COMPLEX, do last)

---

## Phase Progress Summary

| Phase | Name | Progress |
|---|---|---|
| 1 | Foundation | `6 / 6 ✅` |
| 2 | Client & Campaign Management | `4 / 4 ✅` |
| 3 | Integration Layer (core) | `6 / 6 ✅` |
| 3.7 | Additional Integrations | `5 / 5 ✅` |
| 4 | Data Storage & Metrics | `2 / 2 ✅` |
| 5 | Dashboard System | `5 / 5 ✅` |
| 6 | Report System | `4 / 4 ✅` |
| 7 | White Labeling | `3 / 3 ✅` |
| 8 | Advanced Features & Differentiators | `12 / 12 ✅` |
| 9 | Multi-Agency Hierarchy | `0 / 1` |

## Overall: 47 / 48 backend features complete (all tested ✅)

### Test Status (2026-04-23)
All 75 API endpoints tested. All passing. See TEST.md for full results.
Key bugs found and fixed: RLS bypass on public endpoints (SystemPrismaService), MetricsService raw SQL missing tenant context, migration state errors, Prisma generate DLL lock.
Pending env keys: ANTHROPIC_API_KEY (AI), STRIPE_* (billing), 5× new integration OAuth keys.
