-- Additive fencing token for conversation_requests leases.
-- Rehearsal-only until a later primary authorization exists.

ALTER TABLE conversation_requests
  ADD COLUMN IF NOT EXISTS lease_token UUID;

CREATE INDEX IF NOT EXISTS idx_conversation_requests_fence
  ON conversation_requests (id, lease_token);
