# AgencyPulse — Google Ads API Design Document

## 1. Company Overview

**Company:** AgencyPulse (operated by Qodet, kishan@qodet.com)
**Website:** https://qodet.com
**Product:** AgencyPulse — a multi-tenant SaaS analytics platform for marketing agencies
**MCC ID:** 301-562-0019

AgencyPulse is a white-label analytics platform built for marketing agencies. Agencies sign up, connect their clients' advertising accounts (Google Ads, Meta Ads, GA4, etc.), and use our platform to monitor performance, build dashboards, and generate automated reports for their clients.

---

## 2. How We Use the Google Ads API

### Purpose
We use the Google Ads API exclusively for **reading campaign performance data** on behalf of marketing agencies who manage Google Ads accounts for their clients. We do NOT create, modify, pause, or delete any campaigns, ad groups, ads, or keywords.

### API Features Used
- **Google Ads Reporting API** — to fetch campaign-level performance metrics
- **Customer listing** — `customers:listAccessibleCustomers` to show the agency which accounts they have access to

### Metrics Fetched
Per campaign, per day:
- clicks
- impressions
- ctr (click-through rate)
- average_cpc
- cost_micros (converted to currency)
- conversions
- segments.date

### GAQL Query Used
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  metrics.clicks,
  metrics.impressions,
  metrics.ctr,
  metrics.average_cpc,
  metrics.cost_micros,
  metrics.conversions,
  segments.date
FROM campaign
WHERE segments.date BETWEEN '{startDate}' AND '{endDate}'
  AND campaign.status != 'REMOVED'
ORDER BY segments.date DESC
```

---

## 3. Data Flow

```
Step 1 — Agency connects a client's Google Ads account
  → Agency clicks "Connect Google Ads" in AgencyPulse
  → OAuth 2.0 flow: agency logs in with Google, approves access
  → AgencyPulse receives access token + refresh token
  → Tokens stored encrypted (AES-256-GCM) in our database
  → Agency selects which Google Ads customer account to link

Step 2 — Automatic background sync (every 6 hours)
  → BullMQ background job reads the stored encrypted token
  → Calls Google Ads Reporting API with the agency's access token
  → Fetches last 7 days of campaign performance data (incremental)
  → Data stored in our PostgreSQL metric_values table

Step 3 — Agency views data in dashboard
  → Agency or their client opens a dashboard in AgencyPulse
  → Frontend requests data from AgencyPulse backend (our API)
  → Our backend queries our own database — no live Google Ads API call
  → Dashboard displays the pre-fetched metrics
```

---

## 4. Authentication & Token Management

- **OAuth 2.0** with offline access (refresh tokens)
- Access tokens are refreshed automatically before expiry (proactive refresh)
- If refresh fails (token revoked), the connection is marked EXPIRED and the agency is notified to reconnect
- All tokens stored AES-256-GCM encrypted at rest — plaintext tokens never written to logs or database
- Token decryption only happens in-memory at sync time, never exposed via API

---

## 5. User Access Model

**Who connects Google Ads accounts:**
- Agency Owner (AGENCY_OWNER role) — full access
- Agency Admin (AGENCY_ADMIN role) — can connect/disconnect integrations

**Who views the data:**
- Agency Owner, Admin, Staff — see performance data in dashboards
- Client Users (CLIENT_USER role) — read-only view of their own campaign data via a branded client portal

**Data isolation:**
- Each agency's data is isolated via PostgreSQL Row Level Security (RLS)
- A tenant_id column on every table enforces that agencies cannot see each other's data
- Client users can only see the specific client they are assigned to

---

## 6. Architecture Overview

```
Frontend (React + TypeScript)
    ↓ HTTPS
Backend API (NestJS + TypeScript)
    ↓
PostgreSQL (metrics storage, RLS multi-tenancy)
Redis (job queue via BullMQ, response caching)
    ↓
Background Sync Jobs (BullMQ workers)
    ↓
Google Ads API (read-only, per-agency OAuth tokens)
```

**Backend:** NestJS (Node.js) hosted on a dedicated server
**Database:** PostgreSQL with Row Level Security
**Job Queue:** BullMQ on Redis — all Google Ads API calls happen in background workers, never on the request path
**Token Storage:** AES-256-GCM encrypted in PostgreSQL

---

## 7. Rate Limiting & Responsible API Use

- API calls are batched and run in background jobs every 6 hours — never on user request
- Each agency's sync runs independently with deterministic job IDs to prevent duplicate jobs
- Exponential backoff with jitter on failures (base 1000ms * 2^attempt + random 0-1000ms)
- HTTP 429 (rate limit) responses trigger retry without marking the connection as errored
- Maximum 500 sync jobs dispatched per scheduler cycle
- Jobs are staggered with platform-specific delays to spread API load

---

## 8. Data Retention & Usage

- Performance metric data is stored for the purposes of displaying dashboards and generating reports
- Data is only used to serve the agency that connected the account and their clients
- Data is never sold, shared with third parties, or used for advertising targeting
- Agencies can disconnect their Google Ads account at any time, which stops further data collection

---

## 9. Compliance

- All API usage follows the Google Ads API Terms and Conditions
- We only use permitted API features (reporting/read-only)
- We do not use the API for: creating campaigns, bid management, automated bidding, remarketing lists, or conversion tracking
- OAuth scopes requested: `https://www.googleapis.com/auth/adwords` (read access)
