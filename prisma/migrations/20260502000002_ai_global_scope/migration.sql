-- ─── AI Global scope ─────────────────────────────────────────────────────────
-- Adds GLOBAL conversation scope so the platform-wide AI assistant can
-- operate without a campaign context. Existing campaign-scoped conversations
-- get scope='CAMPAIGN'.

ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'CAMPAIGN';

-- Make campaign_id nullable so GLOBAL conversations can store NULL.
ALTER TABLE ai_conversations
  ALTER COLUMN campaign_id DROP NOT NULL;

-- Backfill any nulls (defensive — should already be 'CAMPAIGN' from default)
UPDATE ai_conversations SET scope = 'CAMPAIGN' WHERE scope IS NULL;

-- Fast lookup for "my recent global conversations"
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_scope
  ON ai_conversations (tenant_id, user_id, scope, updated_at DESC);
