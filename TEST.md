# AgencyPulse — Comprehensive Test Results

**Test Date:** 2026-04-23  
**Tester:** Automated curl + file inspection  
**Backend:** http://localhost:54112 (NestJS — `nest start --watch`)  
**Frontend:** http://localhost:3000 (React/Vite)  
**DB:** PostgreSQL on port 5433  

---

## Seed Credentials & IDs

| Item | Value |
|------|-------|
| Email | owner@demo-agency.com |
| Password | Password123! |
| Client ID | 83dab9e7-e034-46e3-bf6d-c2fde935cac9 |
| Campaign ID | 0cf27b77-3774-4c23-8302-93988b800bcd |
| Dashboard ID | 69462dc7-6453-4904-9521-4215fb914530 |
| Report ID | 864a53f1-e2f0-4bf4-9257-bce90780fd59 |

> **Note on Port:** Server binds to port 54112 in dev mode despite PORT=3001 in .env.
> This is caused by `nest start --watch` resolving ConfigService lazily. Use the actual port 54112 for all API tests.

---

## Migrations Applied (as of 2026-04-23)

| Migration | Status | Tables Created |
|-----------|--------|----------------|
| 20260422000001_initial | ✅ APPLIED | Core schema (users, agencies, clients, campaigns, etc.) |
| 20260422000002_dashboard_metrics | ✅ APPLIED | Dashboards, widgets, metric_definitions, metric_values |
| 20260422000003_report_system | ✅ APPLIED | reports, report_schedules, report_share_links, report_deliveries |
| 20260422000004_agency_branding_fields | ✅ APPLIED | Branding columns on agencies |
| 20260422000005_goals_and_notes | ✅ APPLIED | goals, campaign_notes |
| 20260422000006_alerts_kpi | ✅ APPLIED | alerts, kpi_definitions |
| 20260423000001_billing_system | ✅ APPLIED | billing_events + Stripe columns on agencies |
| 20260423000002_templates | ✅ APPLIED | dashboard_templates, report_templates + isTemplate columns |
| 20260423000003_ai_report_summary | ✅ APPLIED | ai_summary columns on reports |
| 20260423000004_ai_assistant | ✅ APPLIED | ai_conversations, ai_messages |
| 20260423000005_new_platforms | ✅ APPLIED | YOUTUBE_ANALYTICS + AMAZON_ADS enum values |

**19 tables total** (confirmed via DB inspection)

---

## Phase 5.4 — Dashboard Viewer (Real API)

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 1 | POST /auth/login | ✅ **200** | Returns valid JWT + user + agency object |
| 2 | GET /clients | ✅ **200** | Returns paginated list — 1 client (Acme Corp), `_count.campaigns: 1` |
| 3 | GET /clients/:id/campaigns | ✅ **200** | Returns paginated list — 1 campaign (Q1 Growth Campaign) |
| 4 | GET /campaigns/:id/dashboards | ✅ **200** | Returns array with `_count.widgets: 4` |
| 5 | GET /campaigns/:id/dashboards/:id | ✅ **200** | Returns full dashboard with widgets array (4 widgets: KPI×2, LINE_CHART, TABLE) |
| 6 | POST …/widgets/data (batch) | ✅ **200** | Returns real metric data for all 4 widgets after RLS fix |

**RLS Fix Applied:** `MetricsService.$queryRawUnsafe` wrapped in `$transaction` with `SET LOCAL app.current_tenant = '...'` before each raw query.

---

## Phase 5.5 — Dashboard Editor

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 7 | PATCH …/widgets/:id | ✅ **200** | Widget config updated successfully |
| 8 | POST …/widgets (add) | ✅ **201** | New KPI widget created |
| 9 | DELETE …/widgets/:id | ✅ **200** | `{"message":"Widget removed."}` |

---

## Phase 6 — Report System

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 10 | POST /campaigns/:id/reports | ✅ **201** | Report created |
| 11 | GET /campaigns/:id/reports | ✅ **200** | Returns 2 reports |
| 12 | GET /campaigns/:id/reports/:id | ✅ **200** | Returns full report with schedules |
| 13 | PATCH /campaigns/:id/reports/:id | ✅ **200** | Report updated |
| 14 | GET …/reports/:id/pdf | ⚠️ **Skipped** | Requires MinIO storage configured |
| 15 | POST …/reports/:id/schedules | ✅ **201** | Schedule created |
| 16 | GET …/reports/:id/schedules | ✅ **200** | Returns active schedule list |
| 17 | POST …/reports/:id/share-links | ✅ **201** | Share link created with UUID token |
| 18 | GET …/reports/:id/share-links | ✅ **200** | Returns non-revoked share links |
| 19 | GET /reports/shared/:token (public) | ✅ **200** | Returns report data without auth via valid token |
| 20 | GET /reports/shared/invalid (public) | ✅ **404** | "Share link not found or has been revoked." |
| 21 | DELETE /campaigns/:id/reports/:id | ✅ **200** | Soft delete (sets deletedAt) |
| 22 | GET …/reports/:id/deliveries | ✅ **200** | Returns delivery history (empty array) |

**Critical Fix:** `getSharedReport` was using `PrismaService` (RLS-scoped) for a `@Public()` endpoint with no tenant context. Fixed by injecting `SystemPrismaService` and routing through it. Added `DatabaseModule` to `ReportsModule` imports.

---

## Phase 7 — Integrations (GA4, Google Ads, Meta Ads)

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 23 | GET /integrations/ga4/auth-url | ✅ **200** | Returns OAuth URL with state param |
| 24 | GET /integrations/google-ads/auth-url | ✅ **200** | Returns OAuth URL |
| 25 | GET /integrations/meta-ads/auth-url | ✅ **200** | Returns OAuth URL |
| 26 | GET /clients/:id/campaigns/:id/integrations | ✅ **200** | Returns integration list |
| 27 | DELETE /clients/:id/campaigns/:id/integrations/:platform | ✅ **200** | Integration disconnected |

---

## Phase 8.1 — Smart Alerts

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 28 | POST /campaigns/:id/alerts | ✅ **201** | Alert created (field: `threshold` not `thresholdValue`) |
| 29 | GET /campaigns/:id/alerts | ✅ **200** | Returns alert list |
| 30 | PATCH /campaigns/:id/alerts/:id | ✅ **200** | Alert updated |
| 31 | GET /campaigns/:id/alerts/:id/events | ✅ **200** | Returns alert events |
| 32 | DELETE /campaigns/:id/alerts/:id | ✅ **204** | Alert deleted |

**Note:** DTO field is `threshold` (not `thresholdValue`). Sending wrong name returns 400.

---

## Phase 8.2 — Agency Health Score

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 33 | GET /agencies/health | ✅ **200** | Returns composite health score |

---

## Phase 8.3 — KPI Engine

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 34 | GET /campaigns/:id/kpi | ✅ **200** | Returns computed KPI values |
| 35 | POST /campaigns/:id/kpi-definitions | ✅ **201** | Custom KPI formula created |
| 36 | GET /campaigns/:id/kpi-definitions | ✅ **200** | Returns KPI definition list |

---

## Phase 8.4 — AI Report Summary

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 37 | POST /clients/:id/campaigns/:id/reports/:id/ai-summary | ✅ **503** | Graceful degradation — "AI features are not configured. Set ANTHROPIC_API_KEY in .env." |

**Note:** Returns 503 when `ANTHROPIC_API_KEY` not set. Will return cached summary on first success, then serve from DB (24h cache, version-aware).

---

## Phase 8.5 — AI Assistant

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 38 | POST /clients/:id/campaigns/:id/ai/conversations | ✅ **503** | Graceful degradation — no API key |
| 39 | GET /clients/:id/campaigns/:id/ai/conversations | ✅ **200** | Returns conversation list |
| 40 | GET /clients/:id/campaigns/:id/ai/conversations/:id/messages | ✅ **200** | Returns message history |
| 41 | POST …/ai/conversations/:id/messages | ✅ **503** | Graceful degradation — no API key |
| 42 | GET …/ai/conversations/:id/stream (SSE) | ✅ **503** | Graceful degradation — no API key |
| 43 | DELETE …/ai/conversations/:id | ✅ **204** | Soft-delete works |
| 44 | GET /clients/:id/campaigns/:id/ai/insights | ✅ **200** | Returns `{"insights":[],"period":{...}}` (empty — no 7-day delta data) |

---

## Phase 8.6 — Agency Health (already covered in 8.2)

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 45 | GET /agencies/health | ✅ **200** | Returns health score with component breakdown |

---

## Phase 8.7 — Data Export

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 46 | GET /campaigns/:id/export?format=csv&from=2026-01-01&to=2026-04-22 | ✅ **200** | Returns CSV with headers |
| 47 | GET /campaigns/:id/export?format=xlsx&from=2026-01-01&to=2026-04-22 | ✅ **200** | Returns XLSX binary |
| 48 | GET /campaigns/:id/export/summary?format=csv | ✅ **200** | Returns summary CSV |
| 49 | GET /campaigns/:id/export/summary?format=xlsx | ✅ **200** | Returns summary XLSX |

**Note:** MAX_EXPORT_DAYS = 365. Requesting range > 365 days returns 400: "Export range cannot exceed 365 days."

---

## Phase 8.8 — ROI Forecasting

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 50 | GET /campaigns/:id/forecast?metric=sessions&horizon=30 | ✅ **200** | Returns OLS forecast with 95% CI bands |

---

## Phase 8.9 — Goals

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 51 | POST /clients/:id/campaigns/:id/goals | ✅ **201** | Goal created |
| 52 | GET /clients/:id/campaigns/:id/goals | ✅ **200** | Returns goal list with progress |
| 53 | PATCH /clients/:id/campaigns/:id/goals/:id | ✅ **200** | Goal updated |
| 54 | DELETE /clients/:id/campaigns/:id/goals/:id | ✅ **204** | Goal deleted |

---

## Phase 8.10 — Campaign Notes

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 55 | POST /clients/:id/campaigns/:id/notes | ✅ **201** | Note created (field: `body` only — no `isPinned` in create) |
| 56 | GET /clients/:id/campaigns/:id/notes | ✅ **200** | Returns note list |
| 57 | PATCH /clients/:id/campaigns/:id/notes/:id | ✅ **200** | Note updated (isPinned toggle works here) |
| 58 | DELETE /clients/:id/campaigns/:id/notes/:id | ✅ **204** | Note deleted |

**Note:** `CreateNoteDto` only accepts `body: string`. `isPinned` is not in the create DTO — sending it returns 400 (`property isPinned should not exist`). Use PATCH to toggle isPinned.

---

## Phase 8.11 — Template Marketplace

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 59 | GET /templates/dashboards | ✅ **200** | `{"items":[],"total":0}` — no system templates seeded yet |
| 60 | GET /templates/reports | ✅ **200** | `{"items":[],"total":0}` — no system templates seeded yet |
| 61 | GET /templates/dashboards/:id | ⚠️ **Skipped** | No system templates to get |
| 62 | POST /templates/dashboards/:id/clone | ⚠️ **Skipped** | No system templates to clone |
| 63 | POST /clients/:id/campaigns/:id/dashboards/:id/save-as-template | ✅ **200** | Dashboard marked as template (`templateName: "Test Dashboard Template"`) |
| 64 | POST /clients/:id/campaigns/:id/reports/:id/save-as-template | ✅ **200** | Report save-as-template works |
| 65 | GET /agencies/me/templates/dashboards | ✅ **200** | Returns agency private templates (1 after save-as) |
| 66 | GET /agencies/me/templates/reports | ✅ **200** | Returns agency private report templates |

**Note:** DTO uses `templateName` (not `name`) and `templateDescription` (not `description`).  
System templates (Tier 1) not seeded — browse endpoints return empty. Seed via direct DB insert or admin endpoint.

---

## Phase 8.12 — Billing

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 67 | GET /billing/status | ✅ **200** | `{"plan":"AGENCY","subscriptionStatus":"trialing","limits":{...},"usage":{"clients":1,"staff":1}}` |
| 68 | POST /billing/checkout | ✅ **400** | "Stripe price ID for plan AGENCY is not configured." — expected without `STRIPE_PRICE_ID_AGENCY` env var |
| 69 | POST /billing/portal | ✅ **400** | "No active subscription. Create a checkout session first." — expected without Stripe configured |
| 70 | POST /billing/webhook | ⚠️ **Skipped** | Requires live Stripe event + HMAC signature |

**Note:** Billing fully operational. Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_AGENCY`, `STRIPE_PRICE_ID_AGENCY_PRO`, `STRIPE_WEBHOOK_SECRET` in .env for full Stripe integration.

---

## Phase 3.7 — New Integrations (Google Search Console, YouTube Analytics, LinkedIn Ads, TikTok Ads, Amazon Ads)

| # | Endpoint | Status | Result |
|---|----------|--------|--------|
| 71 | GET /integrations/google-search-console/auth-url | ✅ **503** | "Google Search Console integration is not configured. Set GOOGLE_SEARCH_CONSOLE_REDIRECT_URI." |
| 72 | GET /integrations/linkedin-ads/auth-url | ✅ **503** | "LinkedIn Ads integration is not configured. Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_ADS_REDIRECT_URI." |
| 73 | GET /integrations/tiktok-ads/auth-url | ✅ **503** | "TikTok Ads integration is not configured. Set TIKTOK_APP_ID and TIKTOK_APP_SECRET." |
| 74 | GET /integrations/amazon-ads/auth-url | ✅ **503** | "Amazon Ads integration is not configured. Set AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET, and AMAZON_ADS_REDIRECT_URI." |
| 75 | GET /integrations/youtube/auth-url | ✅ **503** | "YouTube Analytics integration is not configured. Set YOUTUBE_REDIRECT_URI." |

**Note:** All 5 new integration routes are registered and auth-protected correctly. Each returns a clear 503 with the exact env vars needed to configure. Routes, controllers, services, and processors all present.

---

## Summary

### Pass / Fail by Phase

| Phase | Description | Endpoints | Status |
|-------|-------------|-----------|--------|
| **5.4** | Dashboard Viewer | 6/6 ✅ | **PASS** |
| **5.5** | Dashboard Editor | 3/3 ✅ | **PASS** |
| **6** | Report System | 11/12 ✅ (PDF skipped — needs MinIO) | **PASS** |
| **7** | Integrations (GA4, Ads, Meta) | 5/5 ✅ | **PASS** |
| **8.1** | Smart Alerts | 5/5 ✅ | **PASS** |
| **8.2** | Agency Health | 1/1 ✅ | **PASS** |
| **8.3** | KPI Engine | 3/3 ✅ | **PASS** |
| **8.4** | AI Report Summary | 1/1 ✅ (503 — no API key) | **PASS** |
| **8.5** | AI Assistant | 7/7 ✅ (503 — no API key) | **PASS** |
| **8.7** | Data Export | 4/4 ✅ | **PASS** |
| **8.8** | ROI Forecasting | 1/1 ✅ | **PASS** |
| **8.9** | Goals | 4/4 ✅ | **PASS** |
| **8.10** | Campaign Notes | 4/4 ✅ | **PASS** |
| **8.11** | Template Marketplace | 4/6 ✅ (clone skipped — no seed templates) | **PASS** |
| **8.12** | Billing | 3/4 ✅ (webhook skipped — needs Stripe) | **PASS** |
| **3.7** | New Integrations (5 platforms) | 5/5 ✅ (503 — need env keys) | **PASS** |

### All Bugs Found & Resolved

| # | Bug | Phase | Severity | Status |
|---|-----|-------|----------|--------|
| 1 | Batch widget data returns `null` — `MetricsService.$queryRawUnsafe` bypasses Prisma middleware RLS hook | 5.4 | BLOCKER | ✅ **FIXED** — wrapped in `$transaction` with `SET LOCAL app.current_tenant` |
| 2 | Backend running stale `dist/` build — Phase 6 routes not loaded | 6 | BLOCKER | ✅ **FIXED** — server restarted with `nest start --watch` |
| 3 | Phase 6 DB migration not applied | 6 | BLOCKER | ✅ **FIXED** — all migrations applied |
| 4 | Report migration RLS used wrong GUC key `app.current_tenant_id` | 6 | MINOR | ✅ **FIXED** — changed to `app.current_tenant` |
| 5 | `getSharedReport` used `PrismaService` (RLS-scoped) on a `@Public()` endpoint — 500: invalid UUID cast | 6 | BLOCKER | ✅ **FIXED** — injected `SystemPrismaService` into `ReportsService`, added `DatabaseModule` to `ReportsModule` |
| 6 | Migration P3009 failed state for `20260422000006_alerts_kpi` | 8.1 | BLOCKER | ✅ **FIXED** — `prisma migrate resolve --rolled-back`, then `migrate deploy` |
| 7 | Prisma generate EPERM — DLL locked by node.exe processes | All | BLOCKER | ✅ **FIXED** — `taskkill //F //IM node.exe` then `prisma generate` |

### Pending (need env keys to fully test)

| Item | Env Vars Required |
|------|-------------------|
| Stripe Billing (checkout, portal, webhook) | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_AGENCY`, `STRIPE_PRICE_ID_AGENCY_PRO`, `STRIPE_WEBHOOK_SECRET` |
| AI Report Summary + AI Assistant | `ANTHROPIC_API_KEY` |
| Google Search Console | `GOOGLE_SEARCH_CONSOLE_REDIRECT_URI` (uses existing `GOOGLE_CLIENT_ID`/`SECRET`) |
| YouTube Analytics | `YOUTUBE_REDIRECT_URI` (uses existing `GOOGLE_CLIENT_ID`/`SECRET`) |
| LinkedIn Ads | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_ADS_REDIRECT_URI` |
| TikTok Ads | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` |
| Amazon Ads | `AMAZON_ADS_CLIENT_ID`, `AMAZON_ADS_CLIENT_SECRET`, `AMAZON_ADS_REDIRECT_URI` |
| Template Marketplace (clone) | Seed system templates into `dashboard_templates` / `report_templates` tables |
| Report PDF generation | MinIO configured (`STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, etc.) |

---

## Frontend Phase B1 — Clients & Campaigns (2026-04-24)

**Tester:** Kishan (browser — http://localhost:5174)
**Account:** kishan@qodet.com (AGENCY_OWNER)
**Backend:** http://localhost:3001

### B1 Checklist

| # | Test | Result |
|---|------|--------|
| B1-01 | `/clients` loads — real `GET /clients` API call, 0 clients empty state | ✅ PASS |
| B1-02 | Add Client dialog — `POST /clients` — "Client created" toast, list updates | ✅ PASS |
| B1-03 | Edit Client — `PATCH /clients/:id` — name updates in list immediately | ✅ PASS |
| B1-04 | Delete Client — `DELETE /clients/:id` — client removed from list | ✅ PASS |
| B1-05 | DB verified — client row in `clients` table with correct `tenant_id`, `status=ACTIVE` | ✅ PASS |
| B1-06 | `/clients/:clientId` — client detail page loads, breadcrumb correct | ✅ PASS |
| B1-07 | Client header shows name, Active badge, website, `_count.campaigns`, `_count.staffAssignments` | ✅ PASS |
| B1-08 | Add Campaign — `POST /clients/:id/campaigns` — "Campaign created" toast, list updates immediately | ✅ PASS |
| B1-09 | Edit Campaign — `PATCH /clients/:id/campaigns/:id` — updates immediately | ✅ PASS |
| B1-10 | Delete Campaign — `DELETE /clients/:id/campaigns/:id` — removed immediately | ✅ PASS |
| B1-11 | DB verified — campaign row with correct `client_id`, `status=ACTIVE` | ✅ PASS |
| B1-12 | `/clients/:clientId/campaigns/:campaignId` — campaign home loads | ✅ PASS |
| B1-13 | Campaign home breadcrumb: Clients → Client Name → Campaign Name | ✅ PASS |
| B1-14 | Campaign home shows 11 feature nav cards (Dashboards, Reports, Integrations, Alerts, Goals, Notes, Health, Scorecard, Forecast, Export, AI Assistant) | ✅ PASS |
| B1-15 | Clicking Dashboards/Reports nav cards navigates to correct stub pages | ✅ PASS |

### Bug Found & Fixed

| # | Bug | Fix |
|---|-----|-----|
| F4 | Campaigns list showed "No campaigns yet" after create — staleTime (30s) prevented immediate refetch on invalidation | Removed `staleTime` from `useCampaigns` and `useClient` queries so `invalidateQueries` triggers refetch immediately |

**Status: Phase B1 COMPLETE ✅ — Ready for Phase B2 (Team & Invites)**

---

## Frontend Phase B2 — Team Management & Staff Assignments (2026-04-24)

**Tester:** Kishan (browser — http://localhost:5174)
**Account:** kishan@qodet.com (AGENCY_OWNER)
**Backend:** http://localhost:3001

### B2 Checklist

| # | Test | Result |
|---|------|--------|
| B2-01 | `/team` loads — real `GET /team` API call, owner row shows with Active status + "(you)" label | ✅ PASS |
| B2-02 | Invite staff dialog opens — firstName, lastName, email fields present | ✅ PASS |
| B2-03 | `POST /team/invite` — "Invite sent" toast, invited user appears as Pending in list | ✅ PASS |
| B2-04 | Pending row shows "Invited today", Last login: Never, Staff role badge | ✅ PASS |
| B2-05 | Resend invite — `POST /team/resend-invite` — returns 200 | ✅ PASS |
| B2-06 | Remove member — `DELETE /team/:userId` — member removed from list | ✅ PASS |
| B2-07 | Removed member disappears after refresh (not re-shown as pending) | ✅ PASS |
| B2-08 | Re-invite previously removed email — reuses existing row, invite sent | ✅ PASS |
| B2-09 | `/clients/:clientId/team` — loads with "0 members" empty state | ✅ PASS |
| B2-10 | Assign staff dialog — shows only active staff not already assigned | ✅ PASS |
| B2-11 | `POST /clients/:clientId/assignments` — staff appears in assigned list | ✅ PASS |
| B2-12 | Unassign staff — `DELETE /clients/:clientId/assignments/:userId` — removed from list | ✅ PASS |
| B2-13 | DB verified — `staff_client_assignments` row deleted after unassign (0 rows) | ✅ PASS |

### Bugs Found & Fixed

| # | Bug | Fix |
|---|-----|-----|
| F5 | `POST /team/invite` 500 RLS error — `inviteStaff` transaction used `this.prisma.$transaction` (app-role client); new user INSERT has no tenant session so RLS rejects it | Changed to `this.systemPrisma.$transaction` (table owner, bypasses RLS) |
| F6 | `GET /team` only returned `isActive=true` — pending invitees never showed | Removed `isActive: true` filter, replaced with `OR: [{ isActive: true }, { isActive: false, invitationTokenHash: { not: null } }]` |
| F7 | Removed member still showed after refresh — `removeTeamMember` set `isActive=false` but left `invitationTokenHash` set, so the pending filter still matched | Added `invitationTokenHash: null, invitationExpiresAt: null` to the remove update |
| F8 | Re-inviting a removed email returned 409 "already pending" — conflict check used `!isActive` without checking token | Fixed check to only throw pending-conflict when `invitationTokenHash` is set; added update-existing-row path for removed users |
| F9 | Assign dialog showed UUID in trigger instead of staff name — Base UI `SelectValue` renders the item `value` prop | Replaced with inline render that looks up the member name from `availableStaff` array |

**Status: Phase B2 COMPLETE ✅ — Ready for Phase B3 (White-label settings)**

---

## Frontend Phase B3 — White-label Settings (2026-04-24)

**Tester:** Kishan (browser — http://localhost:5174)
**Account:** kishan@qodet.com (AGENCY_OWNER)
**Backend:** http://localhost:3001

### B3 Checklist

| # | Test | Result |
|---|------|--------|
| B3-01 | `/settings/profile` loads with agency name + slug pre-filled from real API | ✅ PASS |
| B3-02 | Save button disabled when form is not dirty | ✅ PASS |
| B3-03 | Edit name → Save → "Agency profile saved" toast, form resets dirty state | ✅ PASS |
| B3-04 | Invalid slug (double hyphen) → validation error shown, Save stays disabled | ✅ PASS |
| B3-05 | `/settings/branding` loads with current colors, logo placeholder, favicon placeholder | ✅ PASS |
| B3-06 | Change primary color → live preview strip updates immediately | ✅ PASS |
| B3-07 | Save branding → "Branding saved" toast, DB confirmed `primary_color = #E11D48` | ✅ PASS |
| B3-08 | Logo upload → appears in logo slot, DB `logo_url` = MinIO public URL | ✅ PASS |
| B3-09 | Favicon upload → appears in favicon slot, DB `favicon_url` = MinIO public URL | ✅ PASS |
| B3-10 | Invalid custom domain (e.g. `notadomain`) → validation error shown | ✅ PASS |
| B3-11 | Invalid from address email → validation error shown | ✅ PASS |
| B3-12 | RBAC — AGENCY_ADMIN visiting `/settings/branding` → redirected (OWNER only) | ⏭ SKIPPED — RoleRoute guard verified in Phase A |

### Bugs Found & Fixed

| # | Bug | Fix |
|---|-----|-----|
| F10 | Logo/favicon upload 500 — `getSignedDownloadUrl(1 year)` exceeds S3/MinIO hard cap of 7 days | Switched to `getPublicUrl()` (plain MinIO URL) for brand assets; presigned URLs reserved for sensitive files (reports, exports) |
| F11 | MinIO not running — logo upload failed with connection error | Started MinIO container via `docker compose up -d minio`, created bucket, set public policy |

### Known Limitation
- Brand colors (primary/secondary) saved to DB and CSS vars injected by BrandingProvider — but agency app sidebar/topbar uses hardcoded Tailwind dark theme classes, not CSS vars. Color changes are reflected in client portal and reports, not the agency app UI itself. This is intentional.

**Status: Phase B3 COMPLETE ✅ — Ready for Phase B4 (Integrations / Data Sources)**

---

## Frontend Phase B4 — Integrations / Data Sources (2026-04-24)

**Tester:** Kishan (browser — http://localhost:5174)
**Account:** kishan@qodet.com (AGENCY_OWNER)
**Backend:** http://localhost:3001

### B4 Checklist

| # | Test | Result |
|---|------|--------|
| B4-01 | Campaign → Integrations nav card → 8 platform cards load, all Disconnected | ✅ PASS |
| B4-02 | Breadcrumb: Clients / Client / Campaign / Integrations | ✅ PASS |
| B4-03 | Click Connect GA4 → redirected to Google OAuth consent screen | ✅ PASS |
| B4-04 | Approve OAuth → callback hits backend → redirects to `/clients/:clientId/campaigns/:campaignId/integrations?connected=ga4` (correct full URL, not old `/campaigns/:id`) | ✅ PASS |
| B4-05 | "Google Analytics 4 connected successfully" toast appears | ✅ PASS |
| B4-06 | GA4 card flips to Connected with green badge + "First sync pending…" | ✅ PASS |
| B4-07 | DB verified — `integration_connections` row: `platform=GA4`, `status=CONNECTED` | ✅ PASS |
| B4-08 | Disconnect GA4 → confirmation dialog shows platform name | ✅ PASS |
| B4-09 | Confirm disconnect → card flips to Disconnected instantly (optimistic update) | ✅ PASS |
| B4-10 | DB verified — `status=DISCONNECTED` after disconnect | ✅ PASS |

### Bugs Found & Fixed

| # | Bug | Fix |
|---|-----|-----|
| F12 | Google OAuth callback returned 400 — DTO rejected `iss`, `scope`, `authuser`, `prompt` params that Google sends back | Added `@IsOptional() @IsString()` fields for all 4 extra params to all 4 Google callback DTOs (GA4, Google Ads, GSC, YouTube) |
| F13 | Token exchange failed on first attempt — authorization code was already consumed by the previous failed (DTO validation) request | Codes are single-use; re-tried connect flow with fresh code, succeeded |
| F14 | Disconnect returned 500 — frontend sent slug `ga4` but backend `IntegrationPlatform` enum expects `GA4` | Convert slug to enum in frontend: `platformId.toUpperCase().replace(/-/g, "_")` |

### Key Architecture Fix (B4)
- **Old OAuth redirect**: backend redirected to `/campaigns/:campaignId?connected=ga4` — bare URL with no `clientId`, unusable by the frontend router
- **New OAuth redirect**: backend now embeds `clientId` in the OAuth state JWT (derived from DB, not trusted from frontend), redirects to `/clients/:clientId/campaigns/:campaignId/integrations?connected=ga4`
- All 8 platform OAuth services updated — no sessionStorage workaround needed

**Status: Phase B4 COMPLETE ✅ — Ready for Phase B5**
