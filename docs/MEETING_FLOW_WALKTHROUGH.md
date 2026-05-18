# AgencyPulse — Meeting Presentation Walkthrough
## Frontend Flow Guide (Screen-by-Screen)

> **How to use this doc:** Walk through each section in order while sharing your screen. For each screen: show it, say the talking points, and if they ask "how does that work?" read the **Tech** note.

---

## 1. Landing Page — `/`

**What to show:** Open the root URL. The landing page loads automatically for unauthenticated visitors.

**What to say:**
- This is the public marketing site. Completely separate from the app shell — no sidebar, no nav, no auth.
- Notice the scroll-progress bar at the top edge — tracks reading position.
- Sections from top to bottom: Hero → Platform logos strip → Features → Bento grid → Workflow → Testimonials → Pricing → FAQ → CTA → Footer.
- The floating **sparkle bubble** in the bottom-right is live — visitors can ask about the platform without signing up. Click it to demo.

**Demo the AI widget:**
- Click the bubble. It opens a chat panel. Ask "What integrations do you support?" or "How much does it cost?"
- It knows everything about AgencyPulse — features, pricing tiers, integrations — but refuses to answer anything off-topic.
- Suggested prompts appear when there's no history: "What is AgencyPulse?", "What integrations do you support?", "How much does it cost?", "How do I get started?"

**Tech:**
- `LandingPage.tsx` composes all section components. Routing: `RootRedirect` — if no JWT in Zustand store, renders `LandingPage`; if authenticated, redirects to role home.
- Sections use `motion/react` (Framer Motion) animations, `AuroraBackground`, `Spotlight`, `AnimatedNumber`, `Marquee`, `TiltCard`, `GradientText` — all custom animation primitives in `src/components/motion/`.
- `PublicAiWidget` is a **stateless** floating widget. No auth required. It persists conversation in `localStorage` (key `ap.public-ai.history`, max 20 messages) so returning visitors see their history.
- Widget calls `POST /api/v1/ai/public/messages` — a public (no JWT) endpoint, IP-throttled at 8 requests/min via NestJS `ThrottlerGuard`. Sends the user message + up to 20 messages of local history.
- Backend: `AiPublicService` builds a tightly scoped system prompt that contains the full AgencyPulse knowledge base (features, pricing, integrations, limits) baked in. No tools, no DB queries. Claude returns max 400 tokens. Anything outside the platform scope gets politely declined.
- `ScrollProgress` reads `window.scrollY` on a `requestAnimationFrame` loop and sets a CSS scaleX transform on a fixed bar.

---

## 2. Login Page — `/login`

**What to show:** Click "Sign in" in the landing nav or navigate to `/login`. Show the split-layout auth page.

**What to say:**
- Split layout: branded left panel, form on the right.
- The public AI widget is also mounted here — visitors can ask questions while deciding to sign in.
- Email + password. "Forgot password?" link is live.
- On submit, the access token is stored and the user lands on their role-appropriate home.

**Tech:**
- `AuthSplitLayout.tsx` wraps both `/login` and `/register`. Mounts `PublicAiWidget` so prospects can ask questions while on auth pages.
- `LoginForm.tsx` uses React Hook Form + Zod validation.
- Submit calls `POST /api/v1/auth/login` → backend returns `{ accessToken, user }`. The `httpOnly` refresh token cookie is set automatically by the browser (SameSite=Lax, Secure in prod).
- Zustand `useAuthStore` stores `{ token, user }` and persists to `localStorage` via the `persist` middleware.
- On 401 from any subsequent API call, the Axios interceptor in `api.ts` fires `POST /api/v1/auth/refresh` (sends the cookie). If that succeeds, it retries the original request transparently. If refresh fails, it clears the store and redirects to `/login`.
- `RootRedirect` runs `GET /api/v1/auth/me` via `AppBootstrap` on every app load to rehydrate the user object from a live DB lookup (catches role changes, suspension, etc.).

---

## 3. Forgot Password Flow — `/forgot-password` → `/reset-password?token=…`

**What to show:** Click "Forgot password?" on the login form.

**What to say:**
- Enter your email. If the account exists, an email arrives with a secure reset link. The UI always says "check your email" regardless — no user enumeration.
- Clicking the link in the email opens the reset page. Enter new password + confirm. On success, redirects to login.

**Tech:**
- `ForgotPasswordPage.tsx` calls `POST /api/v1/auth/forgot-password`. Backend generates a 32-byte random token, SHA-256 hashes it (only the hash stored in DB — `password_reset_token_hash` column), expiry 1 hour. Sends plain token in the email link.
- `ResetPasswordPage.tsx` reads `?token=` from URL, calls `POST /api/v1/auth/reset-password { token, password }`. Backend hashes the submitted token, looks it up, checks expiry, then bcrypt-hashes the new password and clears the reset token.
- Email rendered from a Handlebars template (`forgot-password.hbs`) via Nodemailer (SMTP configured in `EMAIL_*` env vars).
- The token is never stored in plaintext — same pattern as session tokens to prevent DB-dump attacks.

---

## 4. Registration — 3-Step Signup — `/register`

**What to show:** Click "Start free trial" or "Get started" from the landing page. Walk through all three steps.

**What to say:**
- Step 1 — Account: first name, last name, email, password, confirm password.
- Step 2 — Agency Profile: agency name (required), website, company size (dropdown), country, timezone. This is the tenant creation step.
- Step 3 — Personalization: what services they offer (checkboxes: SEO, PPC, Social Media, Email, Analytics, etc.) and how they heard about us. Optional but helps onboarding.
- Progress bar at the top shows which step they're on. Each step validates before moving forward.
- On submit at step 3, the account and agency are created together. They're logged in immediately.

**Tech:**
- `RegisterForm.tsx` is a multi-step wizard using React Hook Form in "uncontrolled" mode — a single `useForm` instance wraps all three steps. Step state is local React state (`step: 1 | 2 | 3`).
- `trigger(['email','password',…])` is called on "Next" — validates only the current step's fields before advancing. The form doesn't submit until step 3.
- On final submit: `POST /api/v1/auth/register` with all fields. Backend uses a PostgreSQL `SECURITY DEFINER` function (`register_agency`) that runs as the superuser role, bypassing Row Level Security — necessary because no `tenant_id` exists yet at registration time. The function atomically creates the `Agency` row + `User` row in one transaction.
- The new user gets role `AGENCY_OWNER`. A JWT access token is returned immediately. The user is logged in.
- A verification email is dispatched asynchronously (doesn't block the response).
- `auth.service.ts` on the backend: `register()` method calls `prisma.$executeRaw` with the SECURITY DEFINER function, then issues tokens.

---

## 5. Email Verification — `/verify-email?token=…`

**What to show:** After registration, show the amber banner that appears across the top of the app.

**What to say:**
- After signup, an amber banner appears: "Please verify your email address. [Resend email]"
- The verification email has a link. Clicking it marks the account verified and the banner disappears.
- The app is fully usable before verification — it's a soft gate, not a hard block.

**Tech:**
- `EmailVerificationBanner.tsx` is mounted in `AgencyAppLayout` above all content. It checks `useAuthStore(s => s.user.emailVerifiedAt)` — shows if null.
- "Resend" button calls `POST /api/v1/auth/resend-verification`. Rate-limited to prevent abuse.
- The email link hits `/verify-email?token=…` → `VerifyEmailPage.tsx` → calls `POST /api/v1/auth/verify-email { token }`. Same token hashing pattern as password reset (`email_verification_token_hash` column on `users` table).
- On success, `PATCH` updates `emailVerifiedAt` timestamp and the Zustand store is refreshed.

---

## 6. Agency App Shell — First Login View

**What to show:** After login/registration, show the main app layout with sidebar and topbar.

**What to say:**
- This is the AgencyAppLayout — persistent for all agency-role users (AGENCY_OWNER, AGENCY_ADMIN, AGENCY_STAFF).
- Left sidebar with collapsible nav. Topbar with agency name, notification bell, user avatar menu.
- The bottom-right sparkle bubble is the **Global AI Assistant** — available on every page, knows everything about your agency's data.
- Nav items are role-filtered — staff sees fewer options than owner.

**Tech:**
- `AgencyAppLayout.tsx` composes: collapsible `Sidebar`, `Topbar`, `EmailVerificationBanner`, `GlobalAiWidget`, and `<Outlet />` for page content.
- Role-filtered nav: `AGENCY_STAFF` cannot see Team, Branding, Billing, Audit Log, KPI Definitions nav items. Implemented via `<RequireRole min="AGENCY_ADMIN">` wrappers around those nav sections.
- `GlobalAiWidget.tsx` — floating bubble, opens `AiChatPanel` in a sheet/panel. Scoped to the whole agency (not just one campaign). Calls `POST /api/v1/ai/global/messages` with streaming SSE or the tool-use JSON endpoint depending on message type.
- `NotificationBell.tsx` in topbar shows unread count badge. Subscribes to `GET /api/v1/notifications/stream` (SSE) via `EventSource` — real-time push from backend when alerts fire, reports finish, invites are accepted.
- Client portal users (`CLIENT_USER`) never see this layout — they're redirected to `/portal/*` at the router level before `AgencyAppLayout` mounts.

---

## 7. Agency Overview — `/overview`

**What to show:** Click "Overview" in the sidebar.

**What to say:**
- Command center for the whole agency. See all clients at a glance.
- KPI summary cards at the top — total clients, active campaigns, alerts firing, avg health score.
- Client health grid — each client card shows their overall data health (green/amber/red).
- Recent insights panel — AI-generated observations across all campaigns.
- Quick-access to top alerts and flagged campaigns.

**Tech:**
- `OverviewPage.tsx` composes `OverviewKpis`, `OverviewClients`, `OverviewHealth`, `OverviewRanking`, `OverviewInsights` — each is a separate component with its own TanStack Query `useQuery` hook.
- Queries: `GET /api/v1/clients` for client list, `GET /api/v1/agencies/me/overview` for KPI aggregates, `GET /api/v1/ai/insights` for the AI insights panel.
- `InsightsPanel.tsx` calls the backend AI insights endpoint which runs Claude against recent metric deltas across all campaigns and surfaces notable changes.

---

## 8. Clients — `/clients`

**What to show:** Click "Clients" in the sidebar. Show the client list with table/grid toggle.

**What to say:**
- All clients are listed here. Toggle between table and card grid views.
- Create a new client with the "+ New Client" button — name, logo, website, timezone, currency.
- Click a client to go into their detail page.
- Each card shows the client logo, number of campaigns, active integrations, and last-synced timestamp.

**Tech:**
- `ClientsPage.tsx` — TanStack Query `useQuery(['clients'], () => api.get('/clients'))`. Paginated with `?page=&limit=`. Toggle view state is local.
- Create client: `POST /api/v1/clients { name, website, timezone, currency }`. Returns the new client with auto-generated `tenant_id`-scoped row in the DB.
- All DB queries run under the `agencypulse_app` role which has PostgreSQL Row Level Security enforced — `WHERE tenant_id = current_setting('app.current_tenant_id')`. The backend sets this via `SET LOCAL app.current_tenant_id = ?` at the start of each request (injected by `TenantMiddleware`).
- `ClientDetailPage.tsx` — tabbed layout: Overview, Campaigns, Team (staff assignments), Settings.

---

## 9. Campaigns — `/clients/:clientId/campaigns/:campaignId`

**What to show:** Open a client, then click into a campaign.

**What to say:**
- Each client has one or more campaigns (e.g., "Q1 2025 SEO", "Google Ads — APAC"). A campaign is the unit that integrations, dashboards, reports, goals, and alerts are attached to.
- Campaign home shows a summary — connected integrations, recent KPIs, active alerts, open goals.

**Tech:**
- `CampaignHomePage.tsx` — fetches `GET /api/v1/clients/:clientId/campaigns/:campaignId` and related summary data.
- Campaign is the central entity in the data model. All metrics rows carry `campaign_id` + `tenant_id`.
- The URL is scoped: `/clients/:clientId/campaigns/:campaignId/...` — every sub-page (dashboards, reports, integrations, etc.) uses these two params.

---

## 10. Integrations — `/clients/:clientId/campaigns/:campaignId/integrations`

**What to show:** Navigate to the Integrations tab for a campaign. Show the 85-platform catalog.

**What to say:**
- 85 marketing platforms organized by category: SEO, PPC, Social, Email, Analytics, eCommerce, Call Tracking, and more.
- Each platform shows its logo (using Iconify + Simple Icons icon libraries), name, category, and connection status.
- Click "Connect" on any platform. Two connection flows exist:
  1. **OAuth flow** (Google Analytics, Google Ads, Facebook Ads, Instagram, LinkedIn, etc.) — redirects to the platform's OAuth consent screen. After approval, the backend receives the authorization code and exchanges it for access + refresh tokens.
  2. **API Key flow** (SEMrush, Ahrefs, Mailchimp, HubSpot, Stripe, etc.) — a modal appears with fields specific to that platform. Enter the API key (and any other required fields). Saved and encrypted immediately.
- Once connected, the platform appears as "Connected" with a sync status and "Disconnect" option.

**Demo:** Click "Connect" on Google Analytics 4 — show the OAuth redirect. Or click a simpler platform like SEMrush — show the API key modal.

**Tech:**
- `IntegrationsPage.tsx` — reads from `platform-catalog.ts` (85 platforms, each with `id`, `name`, `category`, `authType: 'oauth' | 'api_key'`, `tier: 'A' | 'B' | 'C'`).
- For OAuth platforms: calls `GET /api/v1/integrations/:platform/oauth/url?campaignId=...` → backend generates the platform-specific OAuth URL with state param → frontend does `window.location.href = url`. After user approves on the platform, they're redirected back to our `/oauth/callback/:platform` route → backend exchanges the code → stores encrypted tokens → shows "Connected."
- For API key platforms: `ApiKeyConnectModal.tsx` — dynamically renders fields from `platform-credentials.ts` (a schema map: platform → `CredentialField[]`). Validates with Zod schema generated at runtime. Submits to `POST /api/v1/integrations/:platform/connect` with the credential payload.
- **Token encryption:** OAuth access tokens and API keys are encrypted with AES-256-GCM before storage. Each credential row stores `encrypted_value`, `iv`, `auth_tag`. The encryption key comes from `ENCRYPTION_KEY` env var.
- **3 integration tiers:**
  - Tier A: Platform with full dedicated module (GA4, Google Ads, Facebook Ads, etc.)
  - Tier B: Shared OAuth module (uses `standard-oauth.service.ts` with platform-specific scope config)
  - Tier C: Shared API key module (uses `standard-api-key.service.ts` with platform-specific endpoint config)
- **Sync engine:** Once connected, BullMQ queues a sync job immediately, then schedules recurring syncs every 6 hours via a cron job. The sync job decrypts the token, calls the platform API, normalizes the data into the `metrics` table (fields: `campaign_id`, `platform`, `metric_name`, `value`, `recorded_at`), and updates `last_synced_at`.
- 3 retry attempts with exponential backoff. Failed syncs mark the integration as `status: 'error'` and fire a notification.

---

## 11. Dashboards List — `/clients/:clientId/campaigns/:campaignId/dashboards`

**What to show:** Navigate to Dashboards tab for a campaign.

**What to say:**
- A campaign can have multiple dashboards — e.g., "Executive Summary," "SEO Performance," "Paid Ads Detail."
- Each dashboard card shows name, last modified, number of widgets, and a thumbnail preview.
- Click a dashboard to view it. Agency admins see an "Edit" button to open the drag-and-drop editor.

**Tech:**
- `DashboardsList.tsx` — `GET /api/v1/clients/:clientId/campaigns/:campaignId/dashboards`.
- Create dashboard: `POST` with name + optional template ID.

---

## 12. Dashboard Viewer — `/clients/:clientId/campaigns/:campaignId/dashboards/:dashboardId`

**What to show:** Open a dashboard. Show widgets loading, date range picker, and the live data.

**What to say:**
- Widgets render in a responsive grid. Each widget fetches its own data independently.
- KPI cards, line charts, bar charts, pie charts, data tables — all configurable.
- Date range picker in the topbar filters all widgets simultaneously.
- Widgets show skeleton loaders while fetching, error states if the integration is disconnected, and empty states if no data exists for the period.
- Click "Edit Dashboard" (ADMIN+) to enter the drag-and-drop editor.

**Tech:**
- `DashboardViewer.tsx` — fetches the dashboard config (`GET /api/v1/dashboards/:id`). The config is a JSON layout: `{ id, name, widgets: [{ id, type, position, size, config }] }`.
- Each widget's data is fetched via `POST /api/v1/dashboards/:id/widgets/:widgetId/data { dateRange }`. This endpoint looks up the widget's connected metric, queries the `metrics` table filtered by `campaign_id + recorded_at BETWEEN start AND end`, aggregates (sum, avg, etc.), and returns the series.
- `WidgetRenderer.tsx` — dispatches to the correct widget component based on `widget.type`: `KPIWidget`, `LineChartWidget`, `BarChartWidget`, `PieChartWidget`, `TableWidget`.
- Charts use Recharts. All widget components handle loading/error/empty states via `WidgetSkeleton`, `WidgetError`, `WidgetEmptyState` sub-components.
- `DateRangePicker.tsx` — uses Shadcn Calendar + Popover. Stores selected range in URL params (`?from=&to=`) so it's shareable and survives refresh.
- `DashboardGrid.tsx` uses `react-grid-layout` — in viewer mode it's non-draggable. In edit mode it enables drag + resize.

---

## 13. Dashboard Editor — Edit Mode

**What to show:** Click "Edit Dashboard" (requires AGENCY_ADMIN role).

**What to say:**
- Drag and resize any widget. Add new widgets from the widget picker. Configure each widget.
- Widget picker lets you choose type (KPI, line, bar, pie, table) and then select which metric to display.
- Widget config panel: title, metric source (which integration + which metric), aggregation method, comparison period, color.
- Save button persists the layout and config changes.

**Tech:**
- Edit mode enables `react-grid-layout` dragging + resizing. Layout changes are buffered in local state.
- "Save" calls `PATCH /api/v1/dashboards/:id { layout, widgets }`.
- `AddWidgetModal.tsx` — shows available metric sources (based on connected integrations for this campaign). Selecting a metric creates a new widget entry in local state.
- `WidgetConfigPanel.tsx` — a sheet/drawer that opens when clicking a widget's gear icon in edit mode. Edits the widget's config object in local state.
- `<RequireRole min="AGENCY_ADMIN">` wraps the Edit button — AGENCY_STAFF sees a read-only view.

---

## 14. Reports List — `/clients/:clientId/campaigns/:campaignId/reports`

**What to show:** Navigate to the Reports tab.

**What to say:**
- All reports for this campaign — monthly summaries, client-facing presentations, ad-hoc analyses.
- Reports can be generated as PDFs, scheduled for delivery, and shared via a public link.
- Each report card shows name, status (Draft/Published), last generated date, and a "Generate PDF" button.

**Tech:**
- `ReportsList.tsx` — `GET /api/v1/clients/:clientId/campaigns/:campaignId/reports`.
- Create: `POST /api/v1/reports { campaignId, name, templateId? }`.

---

## 15. Report Builder — `/reports/:reportId/edit`

**What to show:** Click into a report and open the editor.

**What to say:**
- Reports are built from sections — drag and drop to reorder. Each section has a type: Metric Summary, Chart, Data Table, Text Block, AI Summary.
- The AI Summary section type is particularly powerful — clicking "Generate AI Summary" for any section sends the underlying data to Claude and writes a professional narrative explaining the numbers.
- When the report is ready, click "Generate PDF" — a PDF is created on the backend and a download link appears. Reports can also be emailed on a schedule.

**Tech:**
- `ReportBuilder.tsx` — drag-and-drop section ordering via `@dnd-kit` or similar. Each section has a `type`, `config`, and `order`.
- `PATCH /api/v1/reports/:id { sections }` saves section order and config.
- "Generate PDF" → `POST /api/v1/reports/:id/generate` — backend uses Puppeteer (headless Chrome) to render the report to HTML and convert to PDF. PDF stored in the configured storage (S3/local). Returns `{ url }`.
- AI Summary: `POST /api/v1/reports/:id/sections/:sectionId/ai-summary` — fetches the metric data for that section, passes it to Claude with a "write a professional executive summary of these marketing results" prompt, returns the generated text which is saved back to the section.
- `ReportDetail.tsx` — the read/published view. Shows sections rendered as formatted content. Has "Share" button (generates a share link) and "Schedule" button.

---

## 16. Report Scheduling & Sharing

**What to show:** Show the schedule and share link options on a report.

**What to say:**
- **Scheduling:** Set a recurring schedule — daily, weekly, monthly. Pick the day and time. Enter recipient emails. The report auto-generates and emails the PDF at the scheduled time.
- **Share links:** Generate a public URL like `agencypulse.com/r/abc123xyz`. Anyone with the link can view the report in a clean branded viewer — no login required. You can set an expiry date or revoke the link at any time.

**Tech:**
- Schedule: `POST /api/v1/reports/:id/schedules { frequency, dayOfWeek?, dayOfMonth?, hour, recipients[] }`. Backend registers a BullMQ repeatable job using cron expression derived from the schedule config.
- Share link: `POST /api/v1/reports/:id/share-links { expiresAt? }` → returns a random opaque token. `GET /api/v1/reports/shared/:token` is a public endpoint (no auth) that looks up the token, checks expiry, and returns the report data. Renders in `SharedReportPage.tsx` at `/r/:token`.
- Email delivery uses the same Nodemailer service, attaches the PDF blob from storage.

---

## 17. Goals — `/clients/:clientId/campaigns/:campaignId/goals`

**What to show:** Navigate to Goals tab.

**What to say:**
- Set measurable targets for any metric — e.g., "Achieve 10,000 organic sessions by end of Q2."
- Each goal shows a progress bar, current value vs. target, and projected completion date.
- Goals can be tied to specific metrics from connected integrations or custom KPIs.

**Tech:**
- `GoalsPage.tsx` — `GET /api/v1/clients/:clientId/campaigns/:campaignId/goals`.
- Create goal: `POST` with `{ metricName, targetValue, targetDate, platform }`.
- Progress calculated server-side: latest metric value from `metrics` table vs. `targetValue`. Projection uses linear regression on the last 30 days of data.

---

## 18. Alerts — `/clients/:clientId/campaigns/:campaignId/alerts`

**What to show:** Navigate to Alerts tab. Show an active alert and the alert creation form.

**What to say:**
- Alerts fire when a metric crosses a threshold — e.g., "Notify me if cost-per-click exceeds $5" or "Alert if organic traffic drops more than 20% week-over-week."
- Alert types: absolute threshold, percentage change, anomaly detection.
- When an alert fires, the user gets an in-app notification (bell badge) and an email.
- Alert history shows every time the condition was met.

**Tech:**
- `AlertsPage.tsx` — `GET /api/v1/clients/:clientId/campaigns/:campaignId/alerts`.
- Alert evaluation runs after every sync job completes. The sync worker calls `AlertsService.evaluate(campaignId)` which loads all active alerts for the campaign, computes the current metric values, checks conditions, and creates `alert_event` rows for any that fired.
- Notifications: `NotificationsService.create(userId, { type: 'ALERT_FIRED', payload })` — writes to `notifications` table. SSE endpoint pushes the new notification to the user's open EventSource connection in real time.
- Email: same Nodemailer service, template for alert notification.

---

## 19. Notes — `/clients/:clientId/campaigns/:campaignId/notes`

**What to show:** Navigate to Notes tab.

**What to say:**
- Campaign notes for the team — pinned observations, client feedback, context for unusual metric movements.
- Notes are visible to all staff assigned to the campaign. Pinned notes appear at the top.

**Tech:**
- `NotesPage.tsx` — `GET /api/v1/clients/:clientId/campaigns/:campaignId/notes`. Simple CRUD.
- Notes are scoped by `campaign_id` and `tenant_id`. RLS prevents cross-tenant access.

---

## 20. Health Monitor — `/clients/:clientId/campaigns/:campaignId/health`

**What to show:** Navigate to Health tab.

**What to say:**
- Data health dashboard. Shows which integrations are syncing successfully, which have errors, and when each last synced.
- Each integration has a health score based on sync success rate, data freshness, and completeness.
- Red flags: sync errors, stale data (>24h old), missing expected metrics.

**Tech:**
- `HealthPage.tsx` — `GET /api/v1/clients/:clientId/campaigns/:campaignId/health`. Aggregates from `integration_credentials` (last_synced_at, status) and `sync_logs` (recent job results).
- Health score algorithm: 100% base, -20 for sync error in last 24h, -10 for stale data, -5 per missing expected metric.

---

## 21. Scorecard — `/clients/:clientId/campaigns/:campaignId/scorecard`

**What to show:** Navigate to Scorecard tab.

**What to say:**
- Period-over-period performance comparison. This month vs. last month, this quarter vs. last quarter, etc.
- Every tracked metric shown in a table with current value, previous value, absolute change, and percentage change. Color-coded — green for improvement, red for decline.
- Configurable: choose the comparison periods and which metrics to include.

**Tech:**
- `ScorecardPage.tsx` — `GET /api/v1/clients/:clientId/campaigns/:campaignId/scorecard?period=month`.
- Backend queries `metrics` table twice (current period and previous period), pivots by metric name, computes delta and percentage change.

---

## 22. ROI Forecast — `/clients/:clientId/campaigns/:campaignId/forecast`

**What to show:** Navigate to Forecast tab.

**What to say:**
- Forward-looking projection for key metrics based on historical trends.
- Shows the projected trajectory over the next 30/60/90 days with a confidence interval band.
- Useful for client meetings — "based on current trajectory, here's where you'll be in 3 months."

**Tech:**
- `ForecastPage.tsx` — `GET /api/v1/clients/:clientId/campaigns/:campaignId/forecast?days=90`.
- Backend uses linear regression on the last 90 days of metric data to project forward. Returns `{ date, projected, lower, upper }` series. Recharts renders the projected line + shaded confidence band.

---

## 23. Data Export — `/clients/:clientId/campaigns/:campaignId/export`

**What to show:** Navigate to Export tab.

**What to say:**
- Export any metric data as CSV or Excel. Choose date range, select which platforms and metrics, and download.
- Useful for clients who want raw data or for importing into other tools.

**Tech:**
- `ExportPage.tsx` — form selecting date range + metric checklist.
- Submit calls `POST /api/v1/clients/:clientId/campaigns/:campaignId/export { format, dateRange, metrics[] }`.
- Backend queries `metrics` table, formats as CSV (using `fast-csv`) or XLSX (using `exceljs`), streams the file in the response with `Content-Disposition: attachment`.

---

## 24. AI Assistant (Per-Campaign) — `/clients/:clientId/campaigns/:campaignId/ai`

**What to show:** Navigate to AI tab for a campaign. Show a multi-turn conversation.

**What to say:**
- This is the campaign-scoped AI assistant. It has access to all this campaign's data — metrics, integrations, goals, alerts, reports.
- Ask it anything: "What's our best performing ad group this month?", "Why did sessions drop last week?", "Generate a performance summary for the client."
- It can actually take actions — generate a report PDF and give you a download link, pull metric data and surface it in the chat.
- The response renders rich Markdown — tables, code blocks, bold text, clickable links.

**Demo:** Ask "Summarize the last 30 days of performance" or "Generate a PDF report for this month."

**Tech:**
- `AiAssistantPage.tsx` uses `AiChatPanel.tsx` — a reusable chat panel component (also used by `GlobalAiWidget`).
- Campaign chat: `POST /api/v1/ai/conversations/:id/messages { content }`. Creates or continues a conversation in the `ai_conversations` table (`scope: 'CAMPAIGN'`, `campaign_id` set).
- Backend: `AiChatService.sendMessage()` runs a **tool-use loop** (up to 5 rounds):
  1. Send messages + system prompt to Claude with 8 tool definitions.
  2. If Claude returns `tool_use`, the backend executes the tool and appends the result.
  3. Loop repeats until Claude returns a final text response or max rounds reached.
- **8 available tools:**
  - `get_metrics` — query the metrics table for any platform/metric/date range
  - `get_campaign_summary` — pull campaign info + connected integrations
  - `get_alerts` — list active and recent alerts
  - `get_goals` — list goals and progress
  - `get_reports` — list existing reports
  - `generate_report_pdf` — trigger PDF generation, returns download URL
  - `get_kpi_definitions` — list custom KPIs
  - `get_insights` — pull AI-generated insights
- `MarkdownMessage.tsx` renders responses with `react-markdown` + `remark-gfm`. Links to internal routes (`/clients/…`, `/reports/…`) render as `<Link>` (React Router). External links open in new tab. Code blocks are styled.
- Conversation history is stored in DB (`ai_messages` table) — full multi-session memory per campaign.

---

## 25. Global AI Widget — Floating Bubble (All Pages)

**What to show:** Click the sparkle bubble in the bottom-right corner of any page inside the app.

**What to say:**
- This is the agency-wide AI assistant. It knows about all your clients, all campaigns, all data — not just one campaign.
- Ask it: "Which client had the biggest traffic drop this week?" or "Show me all campaigns with active alerts."
- Same tool-use capabilities as the campaign assistant but with agency-wide scope.
- Available on every page — you never have to navigate to a special page to ask a question.

**Tech:**
- `GlobalAiWidget.tsx` — floating button (gradient sparkle bubble, matches the public widget style). Opens a panel that mounts `AiChatPanel`.
- Calls `POST /api/v1/ai/global/messages`. Backend: `AiGlobalService` — same tool-use loop but tools query across all campaigns for the current tenant (using the tenant's RLS context). System prompt emphasizes agency-wide context.
- Conversation scope: `scope: 'AGENCY'`, `campaign_id: null` in `ai_conversations`.
- The widget is mounted directly in `AgencyAppLayout.tsx` — always present, position `fixed bottom-5 right-5 z-50`.

---

## 26. Team Management — `/team`

**What to show:** Click "Team" in the sidebar.

**What to say:**
- See all staff members in the agency — name, email, role (AGENCY_OWNER/ADMIN/STAFF), status (Active/Pending invite).
- Invite new staff: enter email + select role. An invitation email is sent with a magic link.
- Assign staff to specific clients — controlling which campaigns they can access.
- Remove or change roles of existing members.

**Tech:**
- `TeamPage.tsx` — `GET /api/v1/team { members[] }`. Paginated.
- Invite: `POST /api/v1/team/invite { email, role }`. Backend generates a short-lived invite token, emails it. `POST /api/v1/team/accept-invite { token, password }` at the `/accept-invite` public route activates the account.
- `AcceptInvitePage.tsx` — reads `?token=` from URL, shows a "Set your password" form. On submit, activates the account and auto-logs-in. Redirects to role home (`/` for staff, `/portal` for client users — the same `roleHome()` helper used by login).
- Role management: `PATCH /api/v1/team/:userId/role { role }`. Only `AGENCY_OWNER` can change roles.
- Client assignment: `POST /api/v1/clients/:clientId/assignments { userId }` / `DELETE …` — controls which staff can access which client's campaigns.

---

## 27. Settings — Agency Profile — `/settings/profile`

**What to show:** Navigate to Settings → Profile.

**What to say:**
- Update the agency's name, website, contact email, phone, address, country, and timezone.
- These details appear in email signatures and report headers.

**Tech:**
- `AgencyProfilePage.tsx` — `GET /api/v1/agencies/me` (returns the agency row for the current tenant). `PATCH /api/v1/agencies/me { name, website, … }`.
- The agency row is fetched at app boot by `AppBootstrap` and cached in Zustand — profile changes propagate via a store update after save.

---

## 28. Settings — White-Label Branding — `/settings/branding`

**What to show:** Navigate to Settings → Branding.

**What to say:**
- Full white-labeling. Upload your agency logo and favicon. Pick primary and accent colors from a color picker.
- Set a custom domain (e.g., `analytics.youragency.com`) — clients access the platform on your domain instead of agencypulse.com.
- Preview mode shows how the app looks with the custom branding applied.
- When clients log in via your custom domain, they see your logo and colors everywhere — on the login page, in the sidebar, in report emails.

**Tech:**
- `BrandingPage.tsx` — `GET /api/v1/agencies/me/branding`. `PATCH /api/v1/agencies/me/branding { primaryColor, accentColor, customDomain }`.
- Logo upload: `POST /api/v1/agencies/me/branding/logo` (multipart form, stored in S3/local storage). Returns `{ logoUrl }`.
- Favicon upload: `POST /api/v1/agencies/me/branding/favicon`. Same pattern.
- At app boot, `BrandingProvider` (`src/contexts/BrandingContext.tsx`) calls `GET /api/v1/branding` (public endpoint, resolves agency from `Host` header). Injects the returned colors as CSS variables (`--color-primary`, `--color-accent`). Tailwind v4's `@theme` uses these variables, so all components pick up the agency's colors automatically.
- Custom domain: backend sets a `custom_domain` field on the agency row. A reverse proxy (Nginx/Cloudflare) routes the custom domain to the app, and the `Host`-based lookup finds the right agency.

---

## 29. Settings — Billing — `/settings/billing`

**What to show:** Navigate to Settings → Billing.

**What to say:**
- Shows current plan (Starter/Growth/Agency), usage stats (clients, campaigns, team members against plan limits), billing period, and next invoice date.
- "Upgrade Plan" button redirects to Stripe Checkout — choose the new plan, pay with card. On success, plan upgrades immediately.
- "Manage Billing" button opens the Stripe Customer Portal — update payment method, download invoices, cancel subscription.

**Tech:**
- `BillingPage.tsx` — `GET /api/v1/billing/status { plan, usage, nextBillingDate, stripeCustomerId }`.
- Checkout: `POST /api/v1/billing/checkout { priceId }` → backend creates a Stripe Checkout Session → returns `{ url }` → frontend does `window.location.href = url`.
- Success lands on `/billing/success` (`BillingSuccessPage.tsx`) — confirms upgrade and returns to dashboard.
- Cancel lands on `/billing/cancel` (`BillingCancelPage.tsx`) — shows "No changes made."
- Stripe webhooks (`/webhooks/stripe`): backend listens for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` to update the agency's `plan` and `subscriptionStatus` in the DB.
- Customer Portal: `POST /api/v1/billing/portal` → Stripe API → returns session URL → redirect.

---

## 30. Settings — Audit Log — `/settings/audit-log`

**What to show:** Navigate to Settings → Audit Log.

**What to say:**
- Immutable log of every significant action in the agency — who did what, when.
- Covers: logins, client creates/edits/deletes, integration connects/disconnects, report generates, team invites, settings changes, role changes.
- Filterable by date range, user, and action type. AGENCY_ADMIN+ only.

**Tech:**
- `AuditLogPage.tsx` — `GET /api/v1/agencies/audit-log?from=&to=&userId=&action=`. Paginated table.
- Backend: every significant service method calls `AuditLogService.record(tenantId, userId, action, payload)` which writes to `audit_log` table. Row-level security ensures tenants cannot see each other's logs.

---

## 31. Settings — Notifications — `/settings/notifications`

**What to show:** Navigate to Settings → Notifications.

**What to say:**
- Configure which events trigger in-app and email notifications.
- Categories: Alert fired, Sync error, Report generated, Team invite accepted, Billing events.
- Toggle each on/off per channel (in-app bell / email).

**Tech:**
- `NotificationsPage.tsx` — `GET /api/v1/notifications/preferences`. `PATCH /api/v1/notifications/preferences { [eventType]: { inApp: bool, email: bool } }`.
- The notification bell in the topbar: `NotificationBell.tsx` — opens a dropdown showing recent unread notifications. Subscribes to `GET /api/v1/notifications/stream` via `EventSource`. On receiving an event, appends to local list and increments badge count. "Mark all read" calls `POST /api/v1/notifications/mark-read-all`.

---

## 32. Custom KPI Definitions — `/kpi-definitions`

**What to show:** Navigate to KPI Definitions in the sidebar.

**What to say:**
- Define custom calculated metrics — combine raw metrics from any connected platform using formulas.
- Example: "Blended ROAS" = (Google Ads Revenue + Facebook Ads Revenue) / (Google Ads Spend + Facebook Ads Spend).
- Once defined, custom KPIs appear in dashboard widget pickers and scorecard just like native metrics.

**Tech:**
- `KpiDefinitionsPage.tsx` — `GET /api/v1/agencies/me/kpi-definitions`. CRUD with `POST/PATCH/DELETE`.
- A KPI definition stores a formula AST (JSON). Backend evaluates it at query time by fetching the constituent metric values and applying the formula.

---

## 33. Templates Marketplace — `/templates`

**What to show:** Navigate to Templates in the sidebar.

**What to say:**
- Pre-built dashboard and report templates for common agency use cases: "SEO Monthly Report," "Google Ads Performance Dashboard," "E-commerce Revenue Overview," etc.
- Browse, preview, and apply a template to any campaign.
- Agencies can also save their own dashboards/reports as reusable templates.

**Tech:**
- `TemplatesPage.tsx` — `GET /api/v1/templates?type=dashboard|report&category=seo|ppc|social`. Public templates from AgencyPulse + agency's own saved templates.
- Apply template: `POST /api/v1/campaigns/:id/dashboards { templateId }` — backend deep-copies the template's widget layout and binds metric references to the campaign's connected integrations.
- Save as template: `POST /api/v1/templates { sourceId, sourceType, name, description }`.

---

## 34. Client Portal — Invite Flow

**What to show:** Demonstrate inviting a client to the portal.

**What to say:**
- From the Client detail page → Team tab → "Invite Client" — enter the client contact's email.
- The client receives an invitation email with a magic link. They click it, set a password, and are in.
- Their experience is completely separate from the agency app — different layout, different URL path (`/portal/*`), read-only, fully branded with the agency's logo and colors.

**Tech:**
- Client invite: `POST /api/v1/team/invite { email, role: 'CLIENT_USER', clientId }`. Same invite endpoint as staff invite — role determines which layout they land in after accepting.
- `AcceptInvitePage.tsx` on success: checks `role` in the response. `CLIENT_USER` → redirect to `/portal`. Agency roles → redirect to `/`.
- The `roleHome(role)` helper centralizes this mapping — used by login form, accept-invite, and root redirect. Never hardcoded per-component.

---

## 35. Client Portal — `/portal`

**What to show:** Log in as a CLIENT_USER or open a portal invite. Show the portal layout.

**What to say:**
- The client sees a completely different app — clean, branded with the agency's logo and colors, read-only.
- They can view their dashboards and reports. No access to team management, settings, integrations, or any agency-internal feature.
- The URL is `/portal/*` — if a client tries to navigate to `/clients` or any agency route, the router redirects them back to `/portal` before any agency component mounts.
- Agencies can brand this entirely as their own product — clients never see "AgencyPulse."

**Tech:**
- `ClientPortalLayout.tsx` — completely separate component from `AgencyAppLayout`. Different nav (only their assigned clients → dashboards/reports), different topbar (agency logo from branding context, no team/settings nav), read-only UI (no edit/create/delete buttons render).
- Route guard: `<RoleRoute min="CLIENT_USER">` in `App.tsx` wraps all `/portal/*` routes. Any agency-role user hitting `/portal` is redirected to `/`. Any `CLIENT_USER` hitting any non-`/portal` route is redirected to `/portal`. Enforced at the router level — no agency component ever conditionally branches on `CLIENT_USER` role.
- `PortalLanding.tsx` → redirects to their first assigned client.
- `PortalClientHome.tsx` — shows the client's dashboards and reports list.
- `PortalReportsList.tsx` — read-only report viewer (same data, stripped action buttons).
- Data access enforced at the backend service layer: `CLIENT_USER` JWT carries their `userId`. Service methods check `ClientAssignment` table — if the user isn't assigned to the requested client, 403 Forbidden.

---

## 36. Security Model Summary (If Asked)

**What to say:**
- Multi-tenancy via PostgreSQL Row Level Security — even if there's a bug in our application code, data from one agency cannot leak to another because the DB enforces the boundary.
- JWT access tokens expire in 15 minutes. Refresh tokens are opaque (SHA-256 hashed in DB, never stored in plaintext), rotate on every use (theft detection — if an old refresh token is presented, all sessions are invalidated).
- OAuth tokens from platforms (Google, Meta, etc.) are encrypted at rest with AES-256-GCM. Even if the DB were dumped, the tokens would be useless without the encryption key.
- All API endpoints require authentication except: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/ai/public/messages`, `/branding`, `/reports/shared/:token`. These are explicitly marked `@Public()`.
- RBAC enforced at two levels: route guard (NestJS `RolesGuard` via `@Roles()` decorator) and service layer (explicit `hasAccess` checks). Defense in depth.

---

## 37. Current State Summary (Honest Snapshot)

**What to say:**
- The backend is **production-ready** — all 85 integrations implemented, all 47+ features built, tested, and documented.
- The frontend is **feature-complete in structure** — every page and route exists and is wired to the backend.
- Pages fully live and working end-to-end: Auth (login, register, forgot password, verify email), Landing page with AI widget, Global AI widget, Campaign AI assistant, Integrations catalog and connection flows, Dashboard viewer with widgets, Client portal.
- Pages that are UI-complete and wired but benefit from real data to demonstrate: Reports builder, Scorecard, Forecast, Alerts, Goals, Team management, Branding settings, Billing, Audit log.
- **Next priorities:** Polish the data visualization with real connected accounts, add more pre-built templates, and fine-tune the AI assistant prompts with domain-specific examples.

---

*Document generated 2026-05-04. Reflects the current state of `d:\projects\agencypulse` (frontend) and `D:\projects\agency-backend` (backend).*
