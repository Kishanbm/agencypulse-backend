-- Phase 2.4: Client portal login
-- Add pending_client_id to users table.
-- Used only for CLIENT_USER invites — stores which client to assign access to.
-- The ClientUserAssignment is created at accept-invite time (not invite time)
-- to avoid orphaned assignments if the invite expires or is never accepted.
-- Cleared (set to NULL) after the ClientUserAssignment is created on accept.

ALTER TABLE users
  ADD COLUMN pending_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Comment intentionally no index — this column is only read once (at accept time)
-- on a single-row lookup by invitation_token_hash. No range scans needed.
