-- 012_generate_display_code_rpc.sql
-- Expose generate_display_code() as a callable RPC for authenticated users.
--
-- generate_display_code() inserts/updates id_sequences, which has RLS enabled
-- with no policies. A plain (SECURITY INVOKER) function would therefore be
-- rejected when called by the `authenticated` role. Promote it to
-- SECURITY DEFINER (with a fixed search_path) so the counter write runs as the
-- function owner and bypasses RLS — mirroring dispatch_event / has_permission.
ALTER FUNCTION generate_display_code(text)
  SECURITY DEFINER
  SET search_path = public;

GRANT EXECUTE ON FUNCTION generate_display_code(text) TO authenticated;
