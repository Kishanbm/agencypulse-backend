-- Phase 8.5 — AI Assistant (Campaign Q&A — AWS Q-style chat)

CREATE TABLE "ai_conversations" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"     UUID NOT NULL,
  "user_id"       UUID NOT NULL,
  "campaign_id"   UUID NOT NULL,
  "title"         VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"    TIMESTAMPTZ(6),

  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_messages" (
  "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id"       UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "role"            VARCHAR(20) NOT NULL,  -- 'user' | 'assistant' | 'system'
  "content"         TEXT NOT NULL,
  "token_count"     INTEGER,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "idx_ai_conversations_user"     ON "ai_conversations"("tenant_id", "user_id", "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX "idx_ai_conversations_campaign" ON "ai_conversations"("tenant_id", "campaign_id", "deleted_at");
CREATE INDEX "idx_ai_messages_conversation"  ON "ai_messages"("conversation_id", "created_at" ASC);

-- Foreign keys
ALTER TABLE "ai_conversations"
  ADD CONSTRAINT "ai_conversations_tenant_id_fkey"   FOREIGN KEY ("tenant_id")   REFERENCES "agencies"("id")  ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "ai_conversations_user_id_fkey"     FOREIGN KEY ("user_id")     REFERENCES "users"("id")     ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "ai_conversations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_tenant_id_fkey"       FOREIGN KEY ("tenant_id")       REFERENCES "agencies"("id")           ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id")   ON DELETE CASCADE    ON UPDATE NO ACTION;

-- RLS
ALTER TABLE "ai_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_messages"      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON "ai_conversations"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
CREATE POLICY "tenant_isolation" ON "ai_messages"
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid);
