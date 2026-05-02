# AgencyPulse — Platform Overview
*Simple explanation for anyone new to the platform*

---

## What is AgencyPulse?

AgencyPulse is a **SaaS tool built for marketing agencies**.

A marketing agency is a company that runs ads, manages SEO, handles social media etc. **for other businesses**. AgencyPulse gives those agencies one place to:
- Connect all their clients' ad platforms (Google, Meta, TikTok etc.)
- See all the data in one dashboard
- Generate automated reports
- Share results with their clients

---

## Real-World Example

Let's use this example throughout:

- **Qodet Agency** — a marketing agency (the one signing up to AgencyPulse)
- **Nike** — one of Qodet's clients (a business that pays Qodet to run their ads)
- **John** — an employee at Nike who wants to see how their ads are going
- **Sarah** — an employee at Qodet Agency who manages the Nike account

---

## The 5 Types of People in AgencyPulse

| Who | Role Name | What they can do |
|---|---|---|
| The agency boss | **Agency Owner** | Everything. Full control. Billing, branding, team, clients. |
| Senior agency employee | **Agency Admin** | Manage clients, campaigns, team, reports. Cannot touch billing/branding. |
| Regular agency employee | **Agency Staff** | Can only see and work on clients they are assigned to. |
| The client's own employee | **Client User** | Logs into the portal. Can only VIEW their own company's data. Cannot edit anything. |
| AgencyPulse company itself | **Super Admin** | Platform-level admin. Not relevant for day-to-day use. |

---

## The Main Concepts

### Agency
The marketing company that signed up to AgencyPulse. In our example: **Qodet Agency**.
- One agency = one account = one workspace
- Everything inside belongs to that agency (clients, campaigns, data, reports)
- The agency can white-label the platform — meaning their clients see THEIR logo, not AgencyPulse's logo

### Client
A business that the agency works for. In our example: **Nike**.
- An agency can have many clients (Nike, Adidas, Apple, whoever)
- A client is just a record in the system — a name, website, email
- Adding a client does NOT send any email or invite. It's just creating a workspace for that client's data.

### Campaign
A specific marketing project under a client. In our example: **"Nike Summer 2026 Campaign"**.
- One client can have many campaigns
- Each campaign is where you connect the actual ad platforms
- Example campaigns under Nike: "Nike Summer Ads", "Nike Instagram Campaign", "Nike SEO Project"

### Integration / Data Source
The ad platforms connected to a campaign. Examples: Google Ads, Meta Ads, GA4, TikTok Ads.
- You connect them using OAuth (the "Connect" button → login with Google/Meta etc.)
- Once connected, data automatically syncs every 6 hours in the background
- The data feeds into dashboards and reports automatically

### Dashboard
A visual display of the campaign's performance data.
- KPI cards, charts, tables — all auto-populated from the connected platforms
- Agency Admins can build and customize dashboards
- Client Users can view dashboards in the portal (read-only)

### Report
A formatted performance report for the client.
- Can be generated as a PDF
- Can be scheduled to send automatically every week/month
- Can be shared via a public link (no login needed for the client to view)
- Agency can use AI to auto-generate written summaries

---

## How the Platform Works — Step by Step

```
STEP 1: Agency Owner signs up
        → Creates their agency account
        → White-labels the platform (adds their logo, colors, custom domain)
        → Their clients will see their brand, not "AgencyPulse"

STEP 2: Add Clients
        → Owner/Admin goes to Clients → "Add Client"
        → Adds Nike, Adidas, etc.
        → No email sent — this is just creating a workspace

STEP 3: Create Campaigns under each Client
        → Go into Nike → "Add Campaign"
        → Example: "Nike Summer 2026 Campaign"

STEP 4: Connect Data Sources
        → Inside the campaign → Integrations
        → Click "Connect" on Google Ads, Meta Ads etc.
        → OAuth flow → data starts syncing automatically

STEP 5: Data flows in
        → Every 6 hours, the system pulls fresh data from all platforms
        → Dashboards auto-populate
        → Alerts trigger if something goes wrong

STEP 6: Invite your own Staff (optional)
        → Team → "Invite Staff" → sends email to Sarah
        → Sarah creates her password → she's now an Agency Staff member
        → Assign Sarah to the Nike client so she can manage it

STEP 7: Invite the Client to view their portal
        → Go to Nike → Team tab → "Invite Portal User"
        → Enter John's email → sends him an invite email
        → John clicks the link → sets his password → logs in
        → John lands on the portal → sees ONLY Nike's dashboards and reports
        → John CANNOT see Adidas, cannot edit anything, cannot see other clients

STEP 8: Reports go out automatically
        → Set up a schedule: "Email Nike's report every Monday at 8am"
        → System generates PDF → emails it to John automatically
        → John can also view it anytime in the portal
```

---

## What the Client Portal Looks Like (from John's perspective)

When John (Nike's employee) logs in, he sees:
- Nike's branding (Qodet Agency's logo/colors, not AgencyPulse)
- His campaigns listed
- Each campaign's dashboards (view-only)
- Reports — can download as PDF
- NO access to: other clients, team settings, integrations, billing, anything admin-related

---

## What Staffs Can and Cannot Do

When Sarah (Qodet's employee) logs in, she sees:
- The full agency app
- ONLY the clients she has been assigned to (not all clients)
- She can manage campaigns, dashboards, reports for her assigned clients
- She CANNOT: invite other staff, change billing, change branding, see other clients

---

## How AgencyPulse Makes Money

AgencyPulse is a **subscription SaaS** (Software as a Service).

The agency owner pays a monthly fee to use the platform. There are 3 plans:

| Plan | Who it's for | Limits |
|---|---|---|
| **Freelancer** | Solo marketer / very small agency | Few clients, limited staff, limited integrations |
| **Agency** | Small to mid-size agency | More clients, more staff, more integrations |
| **Agency Pro** | Large agency | Unlimited everything |

**The more clients and team members the agency has, the higher plan they need → they pay more.**

New agencies get a **free trial** on the Agency plan so they can test the full platform before paying.

Payment is handled through **Stripe** (like every major SaaS). The agency owner enters their card, gets charged monthly/yearly.

**AgencyPulse does NOT charge the end clients (Nike, Adidas etc.) — only the agency pays.**

---

## Platform Connections — How Each Integration Works

### Each platform needs its own separate connection

Even for Google — GA4, Google Ads, Search Console, and YouTube are four separate "Connect" buttons. They all use your Google account but each asks for different permissions. Connecting GA4 does NOT automatically connect Google Ads.

```
Integrations page for "Nike Summer Campaign"

[Google Ads — Connect]    [GA4 — Connect]    [Search Console — Connect]
[Meta Ads — Connect]      [YouTube — Connect] [LinkedIn Ads — Connect]
[TikTok Ads — Connect]    [Amazon Ads — Connect]
```

Each card is completely independent. You connect only the ones you actually use.

---

### What happens when you click Connect

Every platform follows the same 3-step flow:

```
STEP 1 — OAuth
  Click "Connect"
  → Redirected to Google / Facebook / LinkedIn / TikTok login screen
  → You approve access
  → Redirected back to AgencyPulse

STEP 2 — Pick your account
  → System shows you a list of accounts under your login
  → You pick which one belongs to THIS campaign
  → That account ID is saved (encrypted) in the database

STEP 3 — Done
  → System starts pulling data automatically every 6 hours
  → No further action needed
```

What you pick in Step 2 depends on the platform:

| Platform | What you pick |
|---|---|
| **Google Ads** | A **Customer Account** (the top-level ad account, e.g. "Nike Global - 123-456-7890") |
| **GA4** | A **GA4 Property** (e.g. "Nike Website — UA-XXXXXXX") |
| **Meta Ads** | An **Ad Account** (e.g. "Nike Ad Account — act_XXXXXXXXXX") |
| **Search Console** | A **site property** (e.g. "https://nike.com") |
| **YouTube** | A **YouTube channel** |
| **LinkedIn Ads** | An **Ad Account** |

---

### You run multiple ads — does it pull all of them?

**Yes — one connection pulls ALL ads from that account automatically. You never add individual ad links.**

Here is exactly what happens under the hood:

**Example:** Nike runs 4 ads inside their Google Ads account:
- "Nike Summer Brand Campaign" — 500 clicks today
- "Nike Performance Max" — 800 clicks today
- "Nike YouTube Pre-Roll" — 200 clicks today
- "Nike Retargeting" — 150 clicks today

When you connect that Google Ads customer account to AgencyPulse:
```
Sync job runs every 6 hours
→ Calls Google Ads API with your customer account ID
→ API returns ALL 4 campaigns' data for the date range
→ AgencyPulse totals them up:  500 + 800 + 200 + 150 = 1,650 clicks
→ Stores 1,650 as the "clicks" metric for that day
→ Your dashboard shows: Clicks — 1,650
```

The same applies to Meta Ads (all campaigns in that Ad Account), GA4 (all sessions on that property), etc.

**You never have to link individual ads, campaigns, or ad sets. The account-level connection covers everything inside it.**

---

### What if the client has multiple separate accounts?

Sometimes a client runs separate Google Ads accounts for different regions or brands. In that case you create separate AgencyPulse campaigns and connect each account:

```
AgencyPulse: Client = Nike
  ├── Campaign: "Nike Global" → connects Google Ads account: Nike Global (US/EU/APAC)
  ├── Campaign: "Nike India" → connects Google Ads account: Nike India
  └── Campaign: "Nike SEO"   → connects GA4: nike.com + Search Console: nike.com
```

One AgencyPulse campaign = one account per platform. Multiple accounts = multiple campaigns.

---

### How the system knows it's YOUR ads account (not someone else's)

The OAuth token you grant is tied to your Google / Meta / LinkedIn login. The system can only access accounts that YOUR login has permission to see. If someone else's ad account is not in your Google Ads manager account, it won't appear in the picker and cannot be connected — there is no way to connect an account you don't have access to.

---

### After connecting — what data flows in

| Platform | What gets pulled every 6 hours |
|---|---|
| **Google Ads** | Clicks, impressions, cost (ad spend), conversions, CTR, CPC — totalled across ALL campaigns in the account |
| **GA4** | Sessions, users, bounce rate, page views — totalled across the entire property |
| **Meta Ads** | Clicks, impressions, cost, reach, conversions — totalled across ALL campaigns in the Ad Account |
| **Search Console** | Organic clicks, impressions, average position, CTR — for the connected site |
| **YouTube** | Views, watch time, subscribers gained |
| **LinkedIn Ads** | Clicks, impressions, cost, leads |
| **TikTok Ads** | Clicks, impressions, cost, video views |
| **Amazon Ads** | Clicks, impressions, cost, sales |

The data is never fetched live when you open a dashboard. It is fetched in the background every 6 hours and stored in the database. Dashboards just read from the database — fast and quota-safe.

---

## White-Labeling — How It Actually Works in Production

This is the most important thing to understand before going live. White-labeling is **domain-based** — it fires based on the URL being visited, not the user's role.

### How the branding resolves

When someone visits a URL, the backend reads the `Host` header and looks up which agency owns that domain:

```
User visits:  qodet.agencypulse.com
Backend sees: Host = "qodet.agencypulse.com"
              → slug "qodet" extracted
              → looks up agency with slug = "qodet"
              → returns Qodet's logo, colors, name

User visits:  localhost:5173  (dev only)
Backend sees: Host = "localhost"
              → matches platform's own domain
              → returns AgencyPulse defaults (no agency branding)
```

This means **on localhost, white-labeling never fires** — everyone sees the AgencyPulse default. This is expected and correct. You can only test real white-labeling with a real domain.

### Who sees the agency's branding?

**Everyone on that domain** — not just clients. The owner, staff, and client users all see the same branding when they access via the agency's subdomain:

| Person | URL they visit | What they see |
|---|---|---|
| Agency Owner (Kishan/Qodet) | `qodet.agencypulse.com` | Qodet logo + colors |
| Agency Staff (Sarah) | `qodet.agencypulse.com` | Qodet logo + colors |
| Client User (John/Nike) | `qodet.agencypulse.com` | Qodet logo + colors |
| Anyone | `localhost:5173` | AgencyPulse defaults |

### Two ways an agency can white-label

**Option A — Subdomain (built in, no DNS setup needed by agency)**
```
Agency slug = "qodet"
URL = qodet.agencypulse.com
→ Works automatically once you deploy with a wildcard DNS entry
```

**Option B — Custom domain (agency points their own domain)**
```
Agency sets customDomain = "analytics.qodet.com"
Qodet adds a CNAME record:  analytics.qodet.com → agencypulse.com
URL = analytics.qodet.com
→ Backend matches by customDomain field in DB
→ Full white-label, no "agencypulse" in the URL at all
```

### What to configure when you deploy

**1. Wildcard DNS** — Add a `*.agencypulse.com → your server IP` DNS record. This makes every `slug.agencypulse.com` subdomain automatically reach your server.

**2. SSL wildcard certificate** — Get a `*.agencypulse.com` TLS cert (Let's Encrypt + certbot with DNS challenge, or Cloudflare). Without this, browsers will show a security warning on agency subdomains.

**3. Backend `.env`** — Set the correct values:
```env
FRONTEND_URL=https://agencypulse.com        # platform's own root domain
BACKEND_URL=https://api.agencypulse.com     # your API server
```
The backend uses `FRONTEND_URL` to identify the platform's own domain and exclude it from subdomain resolution.

**4. Nginx / reverse proxy** — Configure to accept `*.agencypulse.com` and pass `Host` header through to the backend:
```nginx
server_name *.agencypulse.com agencypulse.com;
proxy_set_header Host $host;  # MUST forward the Host header
```

**5. Agency slug** — When an agency signs up, they set their slug in Settings → Profile. That slug becomes their subdomain automatically. No manual DNS work needed per-agency.

### Testing white-labeling before full production deploy

If you want to test locally before deploying:
1. Add to your `hosts` file: `127.0.0.1   qodet.localhost`
2. Update backend `.env`: `FRONTEND_URL=http://localhost:5173` → change to `http://agencypulse.localhost:5173`
3. Visit `http://qodet.localhost:5173` — the backend now won't treat `qodet.localhost` as the platform domain, so it will resolve the agency and return Qodet's branding

### "Powered by AgencyPulse" footer

The portal shows a small "Powered by AgencyPulse" footer at the bottom. In AgencyAnalytics and similar SaaS tools, this is a **tiered feature**:
- Lower plans: footer is visible (free marketing for AgencyPulse)
- Higher plans: agency can remove/replace it completely

This is already in the portal layout (`ClientPortalLayout`) and can be toggled by a plan-level flag later.

---

## Summary in One Paragraph

AgencyPulse is a white-label analytics platform for marketing agencies. An agency signs up, makes it their own with their logo and colors, adds their clients (businesses they work for), creates campaigns, connects ad platforms (Google/Meta/TikTok etc.), and the data automatically flows into dashboards and reports. The agency's staff can log in and manage accounts. The agency's clients (like Nike) can log in through a separate clean portal and view their own reports — nothing else. The agency pays AgencyPulse a monthly subscription fee based on how many clients and team members they have.
