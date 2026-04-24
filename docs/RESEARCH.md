# Platform Research Notes

Compiled: 2026-04-16

---

## AgencyAnalytics.com — What It Is

- White-label marketing reporting SaaS built exclusively for digital agencies
- Aggregates data from 80+ third-party platforms into client-facing dashboards and automated reports
- Agencies pay per "campaign" (= client workspace)
- Key features: drag-drop dashboards, automated PDF/email reports, white-label (custom domain + logo), rank tracker, SEO audit, client portal login

### Pricing Model
- Freelancer: ~$59–79/mo for 5 clients
- Agency: ~$12–18/client/month
- API access gated to highest tier

### Key Weaknesses (Our Opportunities)
- Integration reliability — users report 2–3 day data delays (especially Meta, Google Ads)
- No visibility into when data was last refreshed
- **Our differentiator**: reliable 4-hour refreshes with visible sync status per integration

---

## Competitive Landscape

| Platform | Target | Integrations | Key Differentiator |
|---|---|---|---|
| AgencyAnalytics | Agencies | 80+ | Built-in rank tracker; white-label |
| Databox | Agencies + in-house | 120+ | Scorecard/KPI tracking; mobile app |
| Whatagraph | Mid-market agencies | 55+ | AI summaries; blended cross-channel metrics |
| DashThis | Small agencies | 34+ | Simplest UX; lowest learning curve |
| Supermetrics | Data teams | 100+ | Connector only — ships to BigQuery/Looker Studio, no dashboards |
| TapClicks | Enterprise | 250+ | Largest integration library |
| Funnel.io | In-house marketing | 500+ | ETL-focused, no dashboards, customer owns data warehouse |

---

## Key Technical Insights

### Data Freshness Strategy
| Data Type | Target Freshness | Mechanism |
|---|---|---|
| Paid Ads (Google/Meta) | Every 4–6 hours | BullMQ scheduled jobs |
| SEO Rankings | Daily (24h) | Overnight low-priority queue |
| GA4 / Analytics | Every 4–12 hours | Incremental date-range fetches |
| Social Media | Every 6–12 hours | Webhook where available, polling otherwise |
| Email Metrics | Every 12–24 hours | Low urgency |

### Multi-Tenancy Pattern
- Shared schema + PostgreSQL RLS is industry standard at this scale
- `tenant_id` on every table enforced at DB level via `SET app.current_tenant = '<uuid>'`
- Application role must NOT be table owner (owners bypass RLS)
- Test RLS with pgTAP in CI

### Background Job Pattern
```
Scheduler (cron)
  → enqueue "sync job" per [tenant × client × integration]
  → BullMQ workers (horizontally scaled)
    → fetch from 3rd-party API (with OAuth token)
    → normalize/transform data
    → upsert into TimescaleDB
    → invalidate Redis cache for affected dashboards
```

### OAuth Token Management
- Authorization Code Flow → receive code → exchange for access_token + refresh_token
- Encrypt refresh tokens at rest (AES-256-GCM)
- Detect 401 → auto-refresh before requeueing
- **Meta API**: requires App Review for production access — plan 4–6 weeks
- **Meta API version**: v19+ as of 2025; some legacy APIs deprecated Q1 2026

### Caching Architecture
- Redis L1 cache: dashboard widget data (15–60 min TTL)
- Cache key: `dashboard:{tenant_id}:{client_id}:{widget_id}:{date_range}`
- Invalidation: sync job completion → Redis pub/sub → dashboard service invalidates keys
- TimescaleDB continuous aggregates: pre-aggregate weekly/monthly totals

### White-Labeling Requirements
- Per-tenant subdomain routing OR custom domain CNAME support
- Per-tenant logo/color theming stored in DB
- Per-tenant email sending domain (SendGrid subuser model)

---

## Integration Priority Order
Based on market demand and user research:
1. Google Analytics 4
2. Google Ads
3. Meta Ads (Facebook + Instagram)
4. Google Search Console
5. LinkedIn Ads
6. Mailchimp
7. Shopify
8. SEMrush / Ahrefs
9. TikTok Ads
10. Microsoft/Bing Ads

---

## Key References
- AgencyAnalytics: https://agencyanalytics.com
- TimescaleDB docs: https://docs.timescale.com
- BullMQ docs: https://docs.bullmq.io
- NestJS docs: https://docs.nestjs.com
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Meta Marketing API: https://developers.facebook.com/docs/marketing-api
