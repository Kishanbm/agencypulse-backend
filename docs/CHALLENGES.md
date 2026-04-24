# Challenges Log

Every challenge faced, its root cause, and how it was resolved.
This prevents repeating the same mistakes.

---

## Format
**Challenge**: What went wrong or was difficult
**Root Cause**: Why it happened
**Resolution**: How it was fixed
**Lesson**: What to remember going forward

---

## CHALLENGE-001: `compression` package import error in NestJS/TypeScript
**Date**: 2026-04-16
**Challenge**: `import * as compression from 'compression'` caused TS error: "Type 'typeof compression' has no call signatures."
**Root Cause**: `compression` is a CommonJS module. TypeScript's esModuleInterop doesn't handle this module's types correctly with `import *` syntax.
**Resolution**: Used `const compression = require('compression')` with `// eslint-disable-next-line @typescript-eslint/no-require-imports` comment.
**Lesson**: For older CommonJS Express middleware packages, use `require()` not `import *`.

---

## CHALLENGE-004: Register race condition on duplicate email
**Date**: 2026-04-16
**Challenge**: The register flow checked for duplicate emails with a `SELECT` before inserting the user. Two simultaneous register requests with the same email could both pass the check before either inserts, causing one to hit the DB `UNIQUE` constraint and return an unhandled 500 error.
**Root Cause**: Read-then-write pattern without a serializable transaction or advisory lock. The pre-check is a best-effort UX optimization, not a reliability guarantee.
**Resolution**: Kept the pre-check (fast UX feedback for the common case), but wrapped the `$transaction` in a `try/catch` that maps Prisma error code `P2002` (unique constraint violation) to `ConflictException`. The DB constraint is the final and reliable enforcement layer.
**Lesson**: For uniqueness guarantees, always rely on DB constraints as the source of truth. Pre-checks are for UX only — never for correctness.

---

## CHALLENGE-003: RLS connection-reuse leak with plain SET
**Date**: 2026-04-16
**Challenge**: The original `PrismaService` tenant hook used plain `SET app.current_tenant = '<uuid>'` followed by `RESET` in a `finally` block. A code review flagged this as a potential cross-tenant data leak: if a connection is returned to the pool before the `finally` block runs (e.g. process crash, unhandled rejection), the next request can inherit a previous tenant's context.
**Root Cause**: `SET` is session-scoped — it persists for the entire connection lifetime. `RESET` in `finally` provides cleanup but is not guaranteed to execute in all failure scenarios.
**Resolution**: Attempted `SET LOCAL` inside `$transaction` — but this caused connection pool deadlocks (see CHALLENGE-005). Reverted to `SET` + `RESET` in `finally`. This is safe because Prisma's middleware `next()` call runs on the same connection as the `SET`/`RESET` — the finally block executes before the connection returns to the pool.
**Lesson**: `SET LOCAL` inside `$transaction` inside `$use` middleware causes pool deadlocks. Use `SET + RESET finally` for tenant GUC in Prisma middleware.

---

## CHALLENGE-005: Prisma $use middleware + $transaction = connection pool deadlock
**Date**: 2026-04-17
**Challenge**: `PrismaService` tenant hook inside `$use` called `this.$transaction()` to wrap `SET LOCAL`. Every authenticated request got "Unable to start a transaction in the given time."
**Root Cause**: `$transaction` acquires a pool connection and holds it. When called inside `$use` middleware, the middleware already holds a slot — waiting for another slot that will never free = deadlock. Additionally, `next(params)` inside the `$transaction` callback routes to the main pool (not `tx`'s connection), so `SET LOCAL` on `tx` had no effect on the actual query anyway — the whole approach was wrong.
**Resolution**: `SET` (session-level) + `RESET` in `finally` block inside the `$use` hook. `SET`, `next()`, and `RESET` all share the same connection context — no transaction needed.
**Lesson**: Never call `$transaction` inside `$use` middleware. The `next()` function in `$use` does NOT route through the transaction client `tx`.

---

## CHALLENGE-006: Two-role DB pattern — all auth ops blocked by RLS
**Date**: 2026-04-17
**Challenge**: After creating `agencypulse_app` role (non-owner, subject to RLS) and pointing DATABASE_URL at it, all auth operations failed. Register: blocked. Login: "Agency not found." JWT validation: "User not found or inactive."
**Root Cause**: Three related issues:
1. `find_user_for_login` and `find_refresh_token` SECURITY DEFINER functions had EXECUTE only granted to `agencypulse` — not to `agencypulse_app`.
2. `JwtStrategy.validate()` runs BEFORE TenantMiddleware sets AsyncLocalStorage — `prisma.user.findUnique` blocked by RLS (no tenant context).
3. All login/refresh token DB operations run before tenant is known — `agencypulse_app` blocked by RLS.
**Resolution**: Created `SystemPrismaService` — a separate Prisma client connecting as `agencypulse` (owner role, bypasses RLS). Used exclusively for auth-time operations where no tenant context exists yet: register, login, JWT validation, refresh token storage/rotation/revocation. All feature modules continue using `PrismaService` (agencypulse_app, RLS enforced).
**Lesson**: Any DB operation running before tenant context is established (auth flows, JWT validation) must use the owner-role connection. Isolate this in a dedicated service (`SystemPrismaService`) rather than conditionally bypassing RLS in the main service.

---

## CHALLENGE-009: ClientUserAssignment created at invite time — orphaned access records (AI Review Fix)
**Date**: 2026-04-17
**Challenge**: Initial Phase 2.4 plan created `ClientUserAssignment` inside `inviteClientUser()` at invite time. If the invite expired or was never accepted, the assignment row persisted — a CLIENT_USER with no active account had a live access record pointing to a client.
**Root Cause**: Natural instinct is to set up everything at invite time, but access records should only exist for activated users. "Potential access" is not the same as "actual access."
**Resolution**: Assignment is created at **accept time** inside `acceptInvite()` — after the user is activated. `clientId` is carried through the invite on a `pendingClientId` column (nullable, temporary field on `users` table, cleared after assignment is created). `ON CONFLICT DO NOTHING` handles any edge-case double-accept attempts.
```sql
-- Migration: pending_client_id on users (nullable, FK to clients, ON DELETE SET NULL)
ALTER TABLE users ADD COLUMN pending_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
```
**Lesson**: Access records (`*_assignments` tables) should only be created for active users. Store the intent (pendingClientId) on the user record and act on it during activation. Identified via external AI review of Phase 2.4 plan.

---

## CHALLENGE-008: Incomplete validation in staff assignment — deleted clients and inactive users (AI Review Fix)
**Date**: 2026-04-17
**Challenge**: Initial Phase 2.3 plan validated client existence (tenant check only) and user existence (role check only). This allowed assigning staff to soft-deleted clients and to inactive users.
**Root Cause**: Validation checks were correct in spirit but incomplete — soft deletes and isActive flags were not included.
**Resolution**: Both validation queries include all required guard conditions:
- Client: `{ id, tenantId, deletedAt: null }` — archived clients are rejected with 404
- User: `{ id, tenantId, role: AGENCY_STAFF, isActive: true }` — inactive or wrong-role users rejected with 400
- Duplicate assignment: DB `@@unique([userId, clientId])` constraint → catch Prisma `P2002` → `ConflictException` (more reliable than a pre-check SELECT)
**Lesson**: When validating referenced entities, always include soft-delete and active-status guards. Let the DB unique constraint be the source of truth for duplicate prevention — pre-checks are racy. Identified via external AI review of Phase 2.3 plan.

---

## CHALLENGE-007: Cross-module coupling and double-query pattern in campaign scoping (AI Review Fix)
**Date**: 2026-04-17
**Challenge**: Initial Phase 2.2 plan had `CampaignsService` calling `ClientsService.findOne()` to validate client access before fetching campaigns. This created tight module coupling and an unnecessary extra query on every campaign request.
**Root Cause**: Natural instinct is to "verify the parent first, then fetch children" — but this leads to N+1 style patterns and cross-module dependencies that are hard to scale.
**Resolution**: Enforce client access AND fetch campaigns in a single Prisma query using inline relational conditions on the `client` relation:
```typescript
// AGENCY_STAFF — one query, no cross-module call
{
  clientId,
  tenantId: user.tenantId,
  deletedAt: null,
  client: { staffAssignments: { some: { userId: user.id } } }
}
```
`CampaignsModule` does NOT import or use `ClientsService`. The `tenantId` is always explicit in every query as defense-in-depth alongside RLS.
**Lesson**: When scoping nested resources (campaigns under clients), enforce parent access via relational conditions in the child query — not by calling the parent module's service. This keeps modules decoupled and eliminates extra queries. Identified via external AI review of Phase 2.2 plan.

---

## CHALLENGE-013: AI review fixes for Phase 3.4 — Meta Ads Integration (AI Review Fix)
**Date**: 2026-04-17
**Challenge**: External AI review of Phase 3.4 plan identified 4 issues:
1. Plan proposed reusing GoogleOAuthService for state JWT signing — wrong abstraction, couples Meta to Google
2. Callback campaign + client re-validation needed explicit enforcement (same issue as prior phases)
3. adAccountId from client accepted without server-side verification — IDOR risk (spoofing another user's ad account)
4. Token expiry handling was only reactive (on API 401) — should also be proactive

**Root Cause**:
- #1: GoogleOAuthService name implies Google-only, but state JWT is actually platform-agnostic — the coupling would have caused confusion when adding a 4th platform
- #3: Any ID accepted from a client without verification is an IDOR vector — must always validate ownership server-side
- #4: Meta's no-refresh-token model makes proactive expiry checking especially important (no silent recovery possible)

**Resolution (all 4 fixes applied)**:
1. `OAuthStateService` extracted to `src/modules/integrations/oauth-state/` — handles only state JWT sign/verify. `GoogleOAuthService` delegates to it. `MetaAdsOAuthService` injects it directly. No platform coupling.
2. `handleCallback()` re-validates campaign + client `deletedAt: null` inside `tenantContext.run()` before storing tokens
3. New `POST /integrations/meta-ads/select-account` endpoint — calls `metaAdsApiService.listAdAccounts(accessToken)` and verifies the submitted `adAccountId` is in the returned list before saving as `externalAccountId`
4. `getValidAccessToken()` checks `tokenExpiresAt <= now` proactively, updates connection status to `EXPIRED` in DB, throws `BadRequestException` with re-connect message — before any API call is attempted

**Lesson**: Any ID submitted from the client that represents a resource on a third-party platform must be verified against that platform's API before being stored. "The user has the token" does not mean "the user owns this specific account ID."

---

## CHALLENGE-012: AI review fixes for Phase 3.3 — Google Ads Integration (AI Review Fix)
**Date**: 2026-04-17
**Challenge**: External AI review of Phase 3.3 plan identified 5 issues:
1. GOOGLE_ADS_DEVELOPER_TOKEN treated as optional everywhere — would fail silently at runtime
2. customerId not normalized — Google Ads UI shows "123-456-7890" but API requires "1234567890"
3. Callback re-validation requirement needed explicit enforcement (same as GA4)
4. Developer token must never be logged or appear in error messages
5. Bonus: building 3 Google OAuth services with duplicate sign/verify/exchange/refresh logic

**Root Cause**:
- #1/#4: Sensitive credentials require explicit handling rules at each usage site
- #2: Google Ads has a format discrepancy between UI display and API format — easy to miss
- #3: Pattern consistency requires active enforcement, not just documentation
- #5: Second Google platform is the right time to extract shared OAuth utilities

**Resolution (all 5 fixes applied)**:
1. `GoogleAdsApiService.requireDeveloperToken()` throws `ServiceUnavailableException` at call time if token missing — not at startup
2. `normalizeCustomerId()` exported utility strips dashes; called in every API call + `listCustomersForCampaign` before storing
3. `handleCallback()` validates campaign + client `deletedAt: null` inside `tenantContext.run()` before storing tokens
4. `requireDeveloperToken()` error message does NOT include the token value; no log statement touches it
5. `GoogleOAuthService` extracted to `src/modules/integrations/google/` — handles sign/verify/exchange/refresh; GA4 and Google Ads both delegate to it. Future Google platforms (Search Console) get this for free.

**Lesson**: When building the second instance of a pattern, extract the shared logic immediately. Delaying until a third instance creates more refactoring debt and more inconsistency risk.

---

## CHALLENGE-011: AI review fixes for Phase 3.2 — GA4 Integration (AI Review Fix)
**Date**: 2026-04-17
**Challenge**: External AI review of Phase 3.2 plan identified 6 issues:
1. Enum inconsistency — plan used `GA4` in routes but schema used `GOOGLE_ANALYTICS_4`
2. Callback didn't re-validate campaign + client after OAuth flow (soft-delete window)
3. `clientId` accepted from query params — spoofable (open IDOR vector)
4. Callback redirect used unchecked URL — open redirect risk
5. Refresh token overwritten even when Google doesn't return one (silent token loss)
6. `platform` missing from state JWT — callback couldn't verify which platform initiated the flow

**Root Cause**: OAuth flows have many subtle edge cases that are easy to miss when focused on the happy path. Security issues (#3, #4) and data-loss issues (#5) require explicit attention.

**Resolution (all 6 fixes applied)**:
1. Enum value standardised to `GA4` in schema + migration
2. `handleCallback()` re-validates campaign + client (`deletedAt: null`) inside `TenantContextService.run()` before storing tokens
3. `generateAuthUrl()` accepts only `campaignId` → fetches campaign from DB → derives `clientId` internally
4. `handleCallback()` redirects to `FRONTEND_URL` from config only — never a user-supplied URL
5. `storeTokens()` only includes `refreshTokenEnc` if a new refresh token was explicitly provided (conditional spread)
6. `OAuthState` JWT includes `platform: IntegrationPlatform.GA4`; callback verifies `state.platform === GA4`

**Bonus fix**: OAuth callback is `@Public()` — no JWT → no tenant context. Solved by wrapping all DB operations in `tenantContext.run(state.tenantId, ...)` which sets AsyncLocalStorage so PrismaService RLS hook sees the correct tenant. Consistent with how `acceptInvite` uses `systemPrisma`.
**Lesson**: OAuth callbacks are public endpoints with no user context — always use TenantContextService.run() to set tenant context before DB operations. Never trust any URL or ID from user input in OAuth flows.

---

## CHALLENGE-010: AI review fixes for Phase 3.1 — Integration Framework (AI Review Fix)
**Date**: 2026-04-17
**Challenge**: External AI review of Phase 3.1 plan identified 6 issues before implementation began:
1. Campaign access validation missing — integration queries relied on `campaignId` alone, not enforcing tenant+assignment+deletedAt scoping
2. Token encryption format unversioned (`iv:tag:ciphertext`) — impossible to safely rotate keys or change algorithm later
3. Upsert could overwrite existing tokens — a status-only update could silently null out live tokens
4. Missing `refreshTokenExpiresAt` — some platforms (LinkedIn, Mailchimp) expire refresh tokens too; without this, workers have no way to detect stale refresh tokens
5. Upsert needed to be a true Prisma upsert — avoid duplicate key errors if create-vs-update logic was done manually
6. `ENCRYPTION_KEY` handling needed explicit validation (exact 32 bytes / 64 hex chars), never logged

**Root Cause**: Initial plan focused on the happy path — token storage and retrieval. Edge cases around security, data safety, and future-proofing were not fully thought through.

**Resolution (all 6 fixes applied)**:
1. `assertCampaignAccess()` replicates `CampaignsService.buildScopedWhere()` — validates tenantId + client.deletedAt + role-based assignment in a single relational query before any integration operation
2. Format changed to `v1:iv:tag:ciphertext` — version prefix enables future migration path
3. Token overwrite protection: `accessTokenEnc`/`refreshTokenEnc` only included in upsert `update` block if new tokens are explicitly provided
4. `refreshTokenExpiresAt` column added to `IntegrationConnection` schema + migration
5. Prisma `upsert` with `@@unique([campaignId, platform])` as the conflict target — true atomic upsert
6. `validateEnv()` already had ENCRYPTION_KEY regex check; `EncryptionService` reads key from config (never from process.env directly), key is never logged

**User addition**: Encrypted token fields (`accessTokenEnc`, `refreshTokenEnc`) must never be returned in any HTTP response. Enforced via explicit `publicSelect()` in `IntegrationsService` — both fields are not listed, so they can never accidentally reach the controller layer.
**Lesson**: For security-sensitive modules (token storage, encryption), always review for: (a) access scoping completeness, (b) format versioning for future-proofing, (c) data loss risks in update paths, (d) field exposure in API responses. External AI review caught all of these before a line of code was written.

---

## CHALLENGE-002: Circular dependency risk between DatabaseModule and TenantModule
**Date**: 2026-04-16
**Challenge**: PrismaService needed TenantContextService. Both DatabaseModule and TenantModule are @Global. Importing TenantModule inside DatabaseModule risked circular dependency.
**Root Cause**: Re-importing a @Global module creates redundant registration.
**Resolution**: @Global modules don't need to be re-imported — NestJS resolves them from the global scope automatically. AppModule imports TenantModule before DatabaseModule to guarantee load order.
**Lesson**: Load order in AppModule's `imports` array matters when one global module depends on another.
