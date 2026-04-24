-- Phase 1.6: Add invitation token fields to users table
--
-- Why on the users table (not a separate invitations table):
--   An invited user IS their invitation — there's a 1:1 relationship.
--   Embedding the token on the user row avoids an extra table, extra join,
--   and orphan cleanup logic. Once accepted, fields are simply cleared.
--   A separate table becomes worth it when you need multiple pending invites
--   per user or invite audit history — not needed at our scale.

ALTER TABLE "users"
  ADD COLUMN "invitation_token_hash" VARCHAR(64),      -- SHA-256 hex of raw token
  ADD COLUMN "invitation_expires_at" TIMESTAMPTZ;      -- 48h TTL from invite time

-- Index for fast token lookup during acceptance (public endpoint, no RLS context yet)
CREATE INDEX "users_invitation_token_hash_idx"
  ON "users" ("invitation_token_hash")
  WHERE "invitation_token_hash" IS NOT NULL;
