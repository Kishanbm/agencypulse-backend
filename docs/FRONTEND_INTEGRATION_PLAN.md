# Frontend Integration Plan — AgencyPulse

_Last updated: 2026-04-24_

## Context

The backend is production-ready and feature-complete (47/48 features, all tested, ~100+ endpoints across 34 modules, 5-role RBAC, 8 OAuth integrations, SSE for notifications & AI chat, Stripe billing, audit log, white-labeling). See [PROGRESS.md](./PROGRESS.md).

The frontend at `D:\projects\agencypulse` was generated in a single pass by Google AI Studio from a narrower brief ([GoogleAiStudioReseaarch.txt](../GoogleAiStudioReseaarch.txt)) than what we actually built. It is a **rough reference only** — incomplete, inconsistent, misaligned with our real domain model, and still carries legacy Express + Prisma + SQLite glue that was meant to be a stub backend.

This document captures **what exists, what's usable, what must be rebuilt, and the sequence** for wiring the frontend to the real backend. It is the living reference for frontend work going forward.

---

## Strategy — Hybrid: Foundation First, Then Vertical Slices

Two phases:

- **Phase A (Foundation):** purge backend leakage, fix structure, unify role enum, wire real auth + refresh, add RBAC utilities, add branding provider, separate agency app from client portal layouts at the route level. Deliverable: register → log in → role-gated skeleton shell → log out works end-to-end, and every Phase-B route is registered as a stub so nav works everywhere from day one.
- **Phase B (Vertical slices):** build each feature end-to-end (UI + API + errors + loading + role gating + browser test), one at a time, in dependency order.

Rejected: big-bang rewrite (wastes solid Shadcn + layout + widget primitives), or full-shell-then-wire (long dead period, shells that don't match real APIs).

---

## Current Frontend Audit

### Foundation (salvageable — KEEP)
- **Stack:** React 19, TypeScript 5.8, Vite 6, Tailwind v4, Shadcn UI (27 components pre-installed), React Router v7, TanStack Query (installed, unused), Zustand, Axios, react-hook-form + zod, recharts, react-grid-layout, sonner, lucide-react, next-themes, motion.
- **Shadcn components ready:** alert-dialog, avatar, badge, button, calendar, card, checkbox, command, dialog, dropdown-menu, form, input, label, popover, radio-group, scroll-area, select, separator, sheet, sonner, table, tabs, textarea, toggle, tooltip.
- **API client:** `src/lib/api.ts` — axios with token interceptor + 401 redirect (architecture correct, just needs to point at real backend).
- **Auth store:** `src/lib/store.ts` — Zustand + localStorage persist (keep shape, wire real tokens).
- **Layout:** `src/components/layout/DashboardLayout.tsx` — well-built responsive sidebar + topbar with animations (keep, adapt nav).
- **Dashboard editor primitives:** `src/components/dashboard/*` — WidgetRenderer, KPIWidget, LineChartWidget, BarChartWidget, PieChartWidget, TableWidget, WidgetEmptyState, WidgetError, WidgetSkeleton, AddWidgetModal, DashboardGrid, DateRangePicker, WidgetConfigPanel.
- **Form patterns:** LoginForm, RegisterForm use RHF + zod correctly.

### Backend leakage (REMOVE)
- `server.ts` (Express stub)
- `src/lib/auth.ts` (Express middleware)
- `prisma/` directory (schema.prisma, dev.db, seed)
- `package.json` deps: `express`, `@prisma/client`, `prisma`, `bcrypt`, `jsonwebtoken`, `@types/express`
- `"dev": "tsx server.ts"` → `"dev": "vite"`

### Critical misalignments (FIX)
- **Role enum:** Prisma has `SUPER_ADMIN | STAFF | CLIENT | VIEWER`; `LoginForm` hardcodes `AGENCY_ADMIN`; real backend uses `SUPER_ADMIN | AGENCY_OWNER | AGENCY_ADMIN | AGENCY_STAFF | CLIENT_USER`. Unify everywhere.
- **No RBAC utility** — no `useRole()`, `<RequireRole>`, or route guard beyond a token-exists check.
- **No tenant/branding context** — backend supports per-agency logo + colors + subdomain; frontend ignores all of it.
- **Import bug:** `@/src/lib/store` (double `src/`) should be `@/lib/store`.
- **`@/` alias** points at repo root; should point at `src/`. `components/ui/` sits at repo root — should move under `src/components/ui/`.

### Page inventory

| Route | Page | State | Backend | Action |
|---|---|---|---|---|
| `/login` | LoginForm | mock token, hardcoded role | `POST /auth/login` | Rewire (UI OK) |
| `/register` | RegisterForm | form only | `POST /auth/register` | Rewire (UI OK) |
| `/dashboard/clients` | Clients | mock CRUD | `/clients/*` | Rewire (UI strong) |
| `/dashboard/clients/:id/*` | ClientDetail | tabs, empty states | multi | Partial rebuild |
| `/dashboard/clients/:id/dashboards` | DashboardsList | scaffolding | `GET /campaigns/:id/dashboards` | Rewire |
| `/dashboard/clients/:id/dashboards/:id` | DashboardViewer | scaffolding | dashboard + widgets/data | Rewire + finish |
| `/dashboard/reports` | Reports | mock CRUD | `/reports/*` | Rewire (UI strong) |
| `/dashboard/reports/:id` | ReportDetail | stub | report builder + schedules + share links | Rebuild |
| `/dashboard/roll-up` | RollupDashboards | wizard + grid editor, mock data | dashboard + widget CRUD | Rewire + adapt |
| `/dashboard/goals` | Goals | multi-step form, local | `/goals/*` | Rewire |
| `/dashboard/tasks` | Tasks | local CRUD | — | **Delete** |
| `/dashboard/alerts` | Alerts | form UI, no wiring | `/alerts/*` | Rewire |
| `/dashboard/data-sources` | DataSources | static cards | OAuth flow per platform | Rebuild |
| `/dashboard/custom-metrics` | stub div | — | `/kpi-definitions/*` | Build new |
| `/dashboard/templates` | stub div | — | `/templates/*` | Build new |
| `/dashboard/bulk-actions` | stub div | — | — | **Delete** |

### Missing entirely (need to be built)
Agency Overview · Team management · Integrations OAuth completion · Report builder · Scheduled email UI · Public shared report viewer · AI Assistant (SSE) · AI report summary button · Proactive insights · Alert events · Scorecard · Forecast · Data Health · Data export · Campaign notes · Billing · Audit log viewer · Notifications bell + SSE · Branding settings · Agency profile · Client portal · Accept-invite page.

---

## Gap vs Google AI Studio Brief

Brief specified 4 roles (we have 5); no audit log; no in-app notifications; no data export spec; no template marketplace; no scorecard/forecast/health; used GoHighLevel for email. **~30-40% of backend features have no frontend scaffold.**

---

## Phase A — Foundation Cleanup

Must land first, before any feature work. One short sprint. No demoable features yet — intentional.

1. **Purge backend leakage** — delete `server.ts`, `src/lib/auth.ts`, `prisma/`, remove Express/Prisma/bcrypt/jwt deps, fix `dev` script to `vite`.
2. **Fix project structure** — normalize `@/` alias to `src/`, move `components/ui/` under `src/components/ui/`, fix `@/src/lib/store` import bugs.
3. **Unify role enum** — one `Role` type in `src/types/auth.ts` matching backend. Grep+replace all old role strings.
4. **Real auth flow** — `POST /auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `GET /auth/me`. Refresh token rotation via httpOnly cookie. Axios response interceptor: refresh-on-401. Keep Zustand for access token + user.
5. **RBAC utilities** — `useRole()`, `hasRole(min)`, `<RequireRole min="…">`, `<RoleRoute min="…">`. Hierarchy: OWNER > ADMIN > STAFF > CLIENT_USER (SUPER_ADMIN separate).
6. **Branding context provider** — `<BrandingProvider>` at app root. On boot: `GET /branding` by `Host` header → inject CSS variables for primary/accent. Fallback to AgencyPulse defaults.
7. **Layout adaptations** — new sidebar IA (see below), role-filtered nav, branding-aware logo, notification bell stub, user menu with logout.
8. **API client hardening** — `baseURL` to `VITE_API_BASE_URL + /api/v1`, refresh-on-401 interceptor, typed error shape, centralized toast on errors.
9. **Two layouts — HARD separation.** `<AgencyAppLayout>` for OWNER/ADMIN/STAFF under `/*`. `<ClientPortalLayout>` for CLIENT_USER under `/portal/*`. Rules:
   - No conditional branches like `{role === 'CLIENT_USER' ? … : …}` inside agency-layout components. Ever.
   - CLIENT_USER hitting any non-`/portal` route is redirected to `/portal` at the router level, before any agency component mounts.
   - OWNER/ADMIN/STAFF hitting `/portal/*` is redirected to `/`.
   - Portal nav is built from scratch in `ClientPortalLayout` — does NOT import agency sidebar config and filter.
   - This is the single most important invariant: **partial reuse of agency layout for CLIENT_USER = role leak.**
10. **Accept-invite public route** — `/accept-invite?token=…` → `POST /team/accept-invite`.
    - **Post-success redirect is role-aware.** Via a `roleHome(role)` helper reused by login and redirect guards:
      - `CLIENT_USER` → `/portal`
      - `AGENCY_STAFF` / `AGENCY_ADMIN` / `AGENCY_OWNER` → `/`
    - Never hardcode `/` as the post-invite destination.

**Deliverable:** register → log in → role-gated skeleton shell with agency branding → log out → refresh. Every Phase-B route registered pointing at `<StubPage>`, nav works everywhere.

---

## Phase B — Vertical Slices in Priority Order

Each slice: UI + API calls + error/loading + role gating + browser test. One at a time.

| # | Slice | Backend modules | Why this order |
|---|---|---|---|
| B1 | Clients & Campaigns | `/clients`, `/campaigns`, `/assignments` | Foundation; everything below depends on selecting a campaign. |
| B2 | Team & invites | `/team/*` | Lets us create test users with every role to verify RBAC downstream. |
| B3 | White-label settings | `/agencies/me`, `/branding` | Branding flows into provider from A6. |
| B4 | Integrations — GA4 first, then scale | `/integrations/ga4/*`, sync trigger | Without data sources, dashboards and reports are empty. Shared Google OAuth covers Ads/Search Console/YouTube. |
| B5 | Dashboard viewer (Phase 5.4) | dashboard GET + `POST widgets/data` + metrics + KPI | Product centerpiece. |
| B6 | Dashboard editor (Phase 5.5) | widget CRUD + react-grid-layout | Reuse RollupDashboards grid primitives. |
| B7 | Reports | `/reports/*`, schedules, share-links, generate, shared viewer | Split into list → builder → scheduling → public viewer. |
| B8 | Alerts + Goals + Notes | `/alerts/*`, `/goals/*`, `/notes` | Small; existing form scaffolds reused. |
| B9 | AI — summary + assistant (SSE) + insights | `/ai-summary`, `/ai/conversations/*`, SSE `/stream`, `/ai/insights` | SSE via native EventSource. |
| B10 | Scorecard + Forecast + Health + Data Export | `/scorecard`, `/forecast`, `/health`, `/export` | Read-only pages land together. |
| B11 | Custom KPIs + Templates | `/kpi-definitions/*`, `/templates/*` | Previously stubs. |
| B12 | Billing | `/billing/*` | Redirect-heavy, isolated. |
| B13 | Audit log viewer | `GET /agencies/audit-log` | Single ADMIN+ page. |
| B14 | Notifications (bell + SSE) | `/notifications/*`, `/notifications/stream` | Replaces Phase-A stub in layout. |
| B15 | Client Portal polish | same APIs, `ClientPortalLayout` | Final read-only, branded experience pass. |

Slices are top-down by dependency, not effort. Each ends with a browser walk-through.

---

## Sidebar IA

**Agency app (OWNER/ADMIN/STAFF)**
- Clients — list, create, assignments
- Campaigns (contextual, under a client): Dashboards · Reports · Integrations · Alerts · Goals · Notes · Health · Scorecard · Forecast · Export
- AI Assistant (campaign-scoped)
- Team (ADMIN+)
- Templates
- Custom KPIs (ADMIN+)
- Settings (ADMIN+): Profile · Branding · Billing · Audit log · Notifications

**Client portal (CLIENT_USER)**
- Their assigned clients → dashboards + reports (read-only). No admin nav.

Tasks and Bulk Actions dropped — no backend support.

---

## Full Route Map (locked)

```
PUBLIC
  /login                          → LoginForm
  /register                       → RegisterForm
  /accept-invite?token=…          → AcceptInvitePage (staff + client invites)
  /r/:token                       → SharedReportViewer (public report links)

AGENCY APP  (OWNER / ADMIN / STAFF — <AgencyAppLayout>)
  /                               → redirect to /clients
  /overview                       → Agency overview
  /clients                        → Clients list
  /clients/:clientId              → Client detail
  /clients/:clientId/team         → Staff assignments
  /clients/:clientId/campaigns/:campaignId
    ├── /                         → Campaign home
    ├── /dashboards               → Dashboards list
    ├── /dashboards/:dashboardId  → Dashboard viewer
    ├── /dashboards/:dashboardId/edit  → Editor (ADMIN+)
    ├── /reports                  → Reports list
    ├── /reports/:reportId        → Report detail
    ├── /reports/:reportId/edit   → Report builder (ADMIN+)
    ├── /integrations             → Data sources
    ├── /alerts                   → Alerts
    ├── /goals                    → Goals
    ├── /notes                    → Notes
    ├── /health                   → Data health
    ├── /scorecard                → Scorecard
    ├── /forecast                 → Forecast
    ├── /export                   → Export
    └── /ai                       → AI Assistant
  /team                           → Team (ADMIN+)
  /templates                      → Templates marketplace
  /kpi-definitions                → Custom KPIs (ADMIN+)
  /settings
    ├── /profile                  → Agency profile
    ├── /branding                 → Branding [OWNER]
    ├── /billing                  → Billing [OWNER]
    ├── /audit-log                → Audit log (ADMIN+)
    └── /notifications            → Notification preferences

CLIENT PORTAL  (CLIENT_USER — <ClientPortalLayout>)
  /portal                         → redirect to first assigned client
  /portal/:clientId               → Client home
  /portal/:clientId/campaigns/:campaignId/dashboards/:dashboardId   → Read-only dashboard
  /portal/:clientId/campaigns/:campaignId/reports                   → Report list
  /portal/:clientId/campaigns/:campaignId/reports/:reportId         → Report viewer
```

`<RoleRoute min="ROLE">` gates every agency route; CLIENT_USER hitting `/` redirects to `/portal`. OWNER hitting `/portal` redirects to `/`. Root `/` redirects by role from `/auth/me`.

---

## Stub Strategy (end of Phase A)

- Single reusable `<StubPage sliceId="B7" feature="Reports" />` — centered card: "Coming in slice B7 — the backend is ready, this screen is next." Lists backend endpoints it will call for dev visibility.
- All Phase-B route paths registered in `App.tsx` from day one, pointing at `StubPage`.
- Nav items always present and role-filtered; clicking any lands on a stub (not a dead link) until that slice ships.
- Existing mock-data pages stay on disk as scaffolding references for the slice that will repurpose them — but their routes point at `StubPage` until rewired. No mock data ever shown to a logged-in user.

---

## Files to Modify / Create / Delete (Phase A)

**Modify:**
- [src/App.tsx](../../agencypulse/src/App.tsx) — new route tree, role-gated routing, layout selection
- [src/main.tsx](../../agencypulse/src/main.tsx) — wrap with BrandingProvider + ThemeProvider
- [src/lib/api.ts](../../agencypulse/src/lib/api.ts) — `/api/v1` baseURL, refresh-on-401
- [src/lib/store.ts](../../agencypulse/src/lib/store.ts) — update Role type
- [src/components/auth/LoginForm.tsx](../../agencypulse/src/components/auth/LoginForm.tsx) — real axios call + roleHome redirect
- [src/components/auth/RegisterForm.tsx](../../agencypulse/src/components/auth/RegisterForm.tsx) — wire real submit
- [src/components/layout/DashboardLayout.tsx](../../agencypulse/src/components/layout/DashboardLayout.tsx) — role-filtered nav, branding logo slot, bell stub
- [vite.config.ts](../../agencypulse/vite.config.ts) — `@/` alias → `./src`
- [package.json](../../agencypulse/package.json) — remove backend deps, fix scripts

**Delete:**
- `server.ts`
- `src/lib/auth.ts`
- `prisma/` (entire dir)
- `src/pages/dashboard/Tasks.tsx`
- Any `bulk-actions` references

**Create:**
- `src/types/auth.ts` — unified Role type
- `src/lib/rbac.ts` — role hierarchy + `hasRole` + `roleHome`
- `src/hooks/useRole.ts`
- `src/components/auth/RequireRole.tsx`
- `src/components/auth/RoleRoute.tsx`
- `src/contexts/BrandingContext.tsx` + `src/hooks/useBranding.ts`
- `src/components/layout/AgencyAppLayout.tsx` (rename/refactor from DashboardLayout)
- `src/components/layout/ClientPortalLayout.tsx`
- `src/components/common/StubPage.tsx`
- `src/pages/auth/AcceptInvitePage.tsx`
- `src/lib/http-errors.ts`
- `.env.example` with `VITE_API_BASE_URL=http://localhost:3000/api/v1`

---

## Verification (Phase A)

1. `npm install` after dep cleanup — no Prisma/Express errors.
2. `npm run dev` boots on Vite only.
3. Register new agency → log in → see user email in topbar.
4. `GET /auth/me` populates agency name and role; logout clears token.
5. Force a 401 in devtools → refresh-on-401 retries and recovers.
6. Switch test user's role in DB → reload → sidebar items change; direct URL to admin-only route 403s/redirects.
7. Point `Host` at a seeded test agency with custom branding → logo + colors swap at login.
8. Accept-invite: send backend invite, open link, set password, auto-login with role-aware redirect.

For each Phase B slice: golden path + 1-2 role-boundary checks + 1 error-state check in a real browser.

---

## Reuse vs Rebuild Matrix

| Asset | Decision | Rationale |
|---|---|---|
| Shadcn 27 components | Reuse | Installed, on-design |
| `DashboardLayout.tsx` | Reuse + adapt nav | Good responsive shell |
| Axios `api.ts` | Reuse + harden | Architecture correct |
| Zustand `store.ts` | Reuse + retype role | Lightweight |
| `LoginForm`/`RegisterForm` | Reuse UI, rewire submit | RHF+zod fine |
| Widget primitives | Reuse | Charts, skeletons, empty/error states all there |
| `react-grid-layout` editor | Reuse | Non-trivial to rebuild |
| `Clients.tsx` table/grid | Reuse, strip mocks | UI strong |
| `Reports.tsx` table | Reuse, strip mocks | UI solid |
| `Goals.tsx`/`Alerts.tsx` forms | Reuse pattern | RHF scaffolding salvageable |
| `DataSources.tsx` | Rebuild | Static cards ≠ real OAuth flow |
| `ReportDetail.tsx` | Rebuild | Stub; builder is new |
| `Tasks.tsx` | Delete | No backend |
| Custom Metrics/Templates/Bulk Actions | Build new/Build new/Delete | |
| `prisma/`, `server.ts`, `src/lib/auth.ts` | Delete | Legacy stub backend |
