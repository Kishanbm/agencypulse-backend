# AgencyPulse — Deployment Guide

---

## Architecture Overview

Same GitHub repository, same codebase — deployed twice with different environment configs.

```
SAME CODEBASE (agency-backend + agencypulse frontend)
         │
         ├── Deployment 1: INTERNAL (Qodet)
         │     Domain:   qodet.agencypulse.com
         │     Database: PostgreSQL DB #1  ← Qodet's data only
         │     Redis:    Redis instance #1
         │     Purpose:  Qodet uses AgencyPulse internally to manage their own clients
         │               Acts as a live staging environment before B2B rollouts
         │
         └── Deployment 2: B2B (AgencyPulse product)
               Domain:   agencypulse.com + *.agencypulse.com (wildcard)
               Database: PostgreSQL DB #2  ← all external agency tenants
               Redis:    Redis instance #2
               Purpose:  Public product — other agencies sign up and pay subscription
```

---

## Why Two Separate Deployments

- Qodet's client data is fully isolated from external agency data (separate DB, no shared tenants)
- Qodet tests new features internally before rolling out to B2B customers
- Qodet does not pay a subscription to their own product (no Stripe needed on internal instance)
- Different OAuth branding: internal shows Qodet credentials, B2B shows AgencyPulse credentials
- Independent scaling: B2B can scale without touching Qodet's internal instance
- The codebase requires ZERO changes — all differences are in the `.env` file only

---

## Domain Setup

### Domains to Register
| Domain | Purpose |
|---|---|
| `agencypulse.com` | B2B product — public landing page + app |
| `api.agencypulse.com` | B2B backend API |
| `qodet.agencypulse.com` | Qodet internal frontend (auto-resolved via wildcard) |

### DNS Records Required
```
# B2B — root domain
A     agencypulse.com          → B2B server IP
A     api.agencypulse.com      → B2B backend server IP

# Wildcard — covers all agency subdomains (qodet.agencypulse.com, nike.agencypulse.com etc.)
A     *.agencypulse.com        → B2B server IP

# Qodet internal (if hosted on separate server)
A     internal.qodet.com       → Qodet internal server IP
  OR
# Qodet internal via wildcard (no extra DNS needed — covered by *.agencypulse.com above)
# qodet.agencypulse.com auto-routes to B2B server, branding resolves by slug
```

### SSL Certificates
- `agencypulse.com` — standard cert
- `*.agencypulse.com` — wildcard cert (required for all agency subdomains)
- Use Let's Encrypt with Certbot DNS challenge OR Cloudflare for wildcard SSL
- Without wildcard SSL, browsers show security warnings on agency subdomains

---

## Environment Variables — Differences Between Deployments

Most `.env` values are the same structure — only these differ:

| Variable | Internal (Qodet) | B2B (AgencyPulse) |
|---|---|---|
| `FRONTEND_URL` | `https://qodet.agencypulse.com` | `https://agencypulse.com` |
| `GOOGLE_CLIENT_ID` | Current dev credentials (nextor project) | New AgencyPulse-branded credentials |
| `GOOGLE_CLIENT_SECRET` | Current dev secret | New AgencyPulse secret |
| `GOOGLE_REDIRECT_URI` | `https://api.qodet.com/api/v1/...` | `https://api.agencypulse.com/api/v1/...` |
| `STRIPE_SECRET_KEY` | *(empty — not needed internally)* | Real Stripe live key |
| `STRIPE_WEBHOOK_SECRET` | *(empty)* | Real webhook secret |
| `STRIPE_PRICE_ID_AGENCY` | *(empty)* | Real Stripe price ID |
| `STRIPE_PRICE_ID_AGENCY_PRO` | *(empty)* | Real Stripe price ID |
| `DATABASE_URL` | Qodet's PostgreSQL DB connection | AgencyPulse's PostgreSQL DB connection |
| `REDIS_HOST` | Qodet's Redis instance | AgencyPulse's Redis instance |
| `EMAIL_FROM` | `AgencyPulse <noreply@qodet.com>` | `AgencyPulse <noreply@agencypulse.com>` |
| `SMTP_HOST/USER/PASS` | Qodet SMTP | AgencyPulse SMTP (Resend or SendGrid recommended) |
| `ENCRYPTION_KEY` | Unique 64-char hex (generate separately) | Unique 64-char hex (generate separately) |
| `JWT_ACCESS_SECRET` | Unique long random string | Unique long random string |
| `JWT_REFRESH_SECRET` | Unique long random string | Unique long random string |

> ⚠️ ENCRYPTION_KEY and JWT secrets must be different between deployments and must be kept secret. Generate with:
> `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

---

## OAuth Developer Apps — Two Sets of Credentials

### Internal (Qodet) — already set up
- Google Cloud project: `nextor` (under kishan@qodet.com)
- OAuth consent screen: "AgencyPulse Dev"
- Used for: Qodet's internal use + localhost development
- Status: ✅ Working (test mode — only whitelisted users)

### B2B (AgencyPulse) — set up when domain is ready
- Google Cloud project: create new project named `AgencyPulse`
- OAuth consent screen: "AgencyPulse" with `agencypulse.com` as authorized domain
- Used for: all external agencies connecting their platform accounts
- Status: 🔲 Create after agencypulse.com domain is registered
- After creating: submit for Google OAuth verification (1–4 weeks)

When agencies connect Google Ads / GA4 / Meta etc., they see the OAuth consent screen. Internal = "AgencyPulse Dev", B2B = "AgencyPulse" — the B2B one looks professional and trusted.

---

## Pending Credentials (to collect before launch)

### From Lead — still needed
| Item | Platform | Why needed | Priority |
|---|---|---|---|
| Facebook Business account access | Meta | Create Meta Ads developer app (Facebook + Instagram Ads) | High |
| Anthropic API key + credits | Claude AI | AI report summaries + AI assistant chat | High |
| Stripe account | Stripe | Billing + subscriptions (B2B only) | High |
| LinkedIn company page access | LinkedIn | Create LinkedIn Ads developer app | Medium |
| TikTok Business account | TikTok | Create TikTok Ads developer app | Medium |
| Amazon Advertising account | Amazon | Create Amazon Ads developer app | Low |

### Already done
| Item | Status | Notes |
|---|---|---|
| Google OAuth Client ID + Secret | ✅ | In `.env` — `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| Google redirect URIs (all 4) | ✅ | GA4, Google Ads, Search Console, YouTube |
| Google Ads Developer Token | ✅ | `W1gOMeOJ2AuPoqaPk1V7UA` — in `.env` |
| Google Ads Basic Access application | ✅ | Submitted — awaiting approval (~3 business days) |

---

## Production Approval Submissions — Timeline

These require a live production URL. Submit after domain + deployment are ready.

| Platform | What to submit | Estimated wait | Requires |
|---|---|---|---|
| Google OAuth Verification | OAuth consent screen verification | 1–4 weeks | Live homepage + privacy policy URL |
| Google Ads Basic Access | Already submitted ✅ | ~3 business days | *(done)* |
| Meta App Review | `ads_read` + `ads_management` permissions | 1–2 weeks | Privacy policy + screencast of OAuth flow |
| LinkedIn MDP Access | Marketing Developer Platform access | 1–4 weeks | Company website |
| TikTok App Review | Production access | 1–2 weeks | Live app |

> Start all submissions on the SAME DAY you deploy to production — they all run in parallel.

---

## Pre-Launch Checklist

### Domain & DNS
- [ ] Register `agencypulse.com`
- [ ] Add A record: `agencypulse.com` → server IP
- [ ] Add A record: `api.agencypulse.com` → backend IP
- [ ] Add A record: `*.agencypulse.com` → server IP (wildcard for agency subdomains)
- [ ] SSL cert for `agencypulse.com`
- [ ] SSL wildcard cert for `*.agencypulse.com`

### B2B Server Setup
- [ ] Provision server (minimum: 2 vCPU, 4GB RAM)
- [ ] Install Docker + Docker Compose
- [ ] Set up PostgreSQL (or managed DB — RDS, Supabase, Railway)
- [ ] Set up Redis (or managed — Upstash, Railway)
- [ ] Set up S3-compatible storage for logos/PDFs (Cloudflare R2 or AWS S3)
- [ ] Set up SMTP for emails (Resend or SendGrid recommended over Gmail)
- [ ] Deploy backend + frontend with B2B `.env`
- [ ] Run `prisma migrate deploy` on B2B database
- [ ] Verify health endpoint responds: `GET /api/v1/health`

### Qodet Internal Server Setup
- [ ] Provision server (can be smaller — 1 vCPU, 2GB RAM)
- [ ] Separate PostgreSQL DB + Redis
- [ ] Deploy same codebase with Qodet `.env`
- [ ] Run `prisma migrate deploy` on Qodet database
- [ ] Register Qodet as first agency on internal instance

### OAuth Apps (B2B)
- [ ] Create new Google Cloud project: `AgencyPulse`
- [ ] Enable same 6 APIs (Analytics, Google Ads, Search Console, YouTube x2)
- [ ] Create new OAuth 2.0 client with production redirect URIs
- [ ] Add `agencypulse.com` as authorized domain on consent screen
- [ ] Update B2B `.env` with new `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`
- [ ] Add production redirect URIs to Google Cloud Console:
  ```
  https://api.agencypulse.com/api/v1/integrations/ga4/callback
  https://api.agencypulse.com/api/v1/integrations/google-ads/callback
  https://api.agencypulse.com/api/v1/integrations/google-search-console/callback
  https://api.agencypulse.com/api/v1/integrations/youtube/callback
  ```
- [ ] Create Meta developer app + add production redirect URI
- [ ] Create LinkedIn developer app + add production redirect URI
- [ ] Create TikTok developer app + add production redirect URI

### Production Approvals (submit all on launch day)
- [ ] Submit Google OAuth verification
- [ ] Submit Meta App Review
- [ ] Submit LinkedIn MDP access application
- [ ] Submit TikTok app review

### Stripe (B2B only)
- [ ] Create Stripe account
- [ ] Create "Agency" product + monthly price → copy `STRIPE_PRICE_ID_AGENCY`
- [ ] Create "Agency Pro" product + monthly price → copy `STRIPE_PRICE_ID_AGENCY_PRO`
- [ ] Set up webhook endpoint in Stripe: `https://api.agencypulse.com/api/v1/billing/webhook`
- [ ] Enable events: `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`, `checkout.session.completed`
- [ ] Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`
- [ ] Test with Stripe CLI: `stripe listen --forward-to localhost:3001/api/v1/billing/webhook`

### Final Verification
- [ ] Register a test agency on B2B instance — confirm email arrives
- [ ] Connect a Google Ads test account — confirm OAuth flow works
- [ ] Trigger a manual sync — confirm data flows into database
- [ ] Open a dashboard — confirm widgets render
- [ ] Invite a client portal user — confirm invite email arrives + login works
- [ ] Test Stripe checkout flow (use test card `4242 4242 4242 4242`)
- [ ] Verify RLS: log in as two different agencies — confirm neither can see the other's data

---

## Generate Secrets for Production

Run these locally and paste the output into the production `.env`:

```bash
# ENCRYPTION_KEY (must be exactly 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# JWT_ACCESS_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT_REFRESH_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Generate separate values for Qodet internal and B2B deployments. Never reuse the same secrets across deployments.

---

## Recommended Hosting Stack

| Component | Recommended | Alternative |
|---|---|---|
| Backend server | Railway / Render / DigitalOcean App Platform | Any VPS (Ubuntu + Docker) |
| PostgreSQL | Railway / Supabase / AWS RDS | Self-hosted Docker |
| Redis | Upstash / Railway | Self-hosted Docker |
| File storage | Cloudflare R2 (cheapest) | AWS S3 |
| Email | Resend (simplest) | SendGrid / Postmark |
| SSL | Cloudflare (free wildcard) | Let's Encrypt + Certbot |
| DNS | Cloudflare (free, fast) | Route53 |
| Frontend | Vercel (frontend repo) | Same server as backend |

> Cloudflare for DNS + SSL is strongly recommended — it gives free wildcard SSL for `*.agencypulse.com` which is required for agency subdomains, and the proxy handles DDoS protection automatically.
