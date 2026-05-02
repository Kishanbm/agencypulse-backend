Here's the full scope and plan before I touch anything:

What This Involves
Phase 1 — Hardening (4 steps):

Create fetch-with-retry.ts — 429 retry wrapper around fetchWithTimeout
Create safe-parse.ts — safeInt, safeFloat, safeStr utilities
Update all 74 service files — swap imports, add safe parsers, add pagination caps (MAX_PAGES=100), add response shape guards, fix null safety
npx tsc --noEmit — zero errors before moving on
Phase 2 — Test Harness (4 steps):

Create mock-fetch.ts + mock-db.ts test helpers
Create 74 fixture JSON files — one per platform, based on docs
Write 74 Jest test files — 5 test cases each (golden path, empty, null fields, auth error, pagination)
Add POST /sync/test-connection endpoint to sync.controller.ts + sync.service.ts
Scale Reality Check
Artifact	Count
Service files to update	74
Fixture files to create	74
Test files to create	74
New utility files	3
Total files touched	~225+
This is a large automated task. I'll do it phase by phase using agents in parallel where possible. Each phase will end with a TypeScript check.

One Decision Needed
For Phase 1 Step 3, the 74 service files have varying patterns. Some already have good null safety (like Klaviyo), some don't. Should I:

Option A: Apply all 4 changes (import swap, safe parse, pagination cap, shape guard) mechanically to every file regardless of whether it already has them → cleanest, uniform, may add redundant guards
Option B: Apply only what's missing per file → cleaner diffs but slower and inconsistent
I'd recommend Option A — uniform, fast, consistent.

Shall I proceed with Phase 1 first? Once you confirm, I'll start with Step 1.1 and 1.2 in parallel, then do the 74 file updates, then run the TypeScript check before touching Phase 2.