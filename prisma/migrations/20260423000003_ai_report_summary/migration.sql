-- Phase 8.4 — AI Report Explanation
-- Adds Claude-generated summary fields to reports.

ALTER TABLE "reports"
  ADD COLUMN "ai_summary"              TEXT,
  ADD COLUMN "ai_summary_generated_at" TIMESTAMPTZ(6),
  ADD COLUMN "ai_summary_model"        VARCHAR(100),
  ADD COLUMN "ai_summary_version"      INTEGER;
