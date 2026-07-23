-- 014_journal_reaction_delete_policy.sql
-- Interim permissive DELETE policy for journal_entry_reactions so a user can
-- toggle a reaction off. Migration 013 only granted SELECT/INSERT on this table.
-- The client restricts deletes to the current user's own reactions; this will be
-- tightened alongside the rest of the RLS hardening pass.
--
-- Note: journal entries are removed via SOFT delete (UPDATE deleted_at), which is
-- already covered by the existing journal_entries UPDATE policy — no journal
-- entries DELETE policy is needed.

CREATE POLICY "authenticated users can delete reactions"
ON journal_entry_reactions FOR DELETE TO authenticated USING (true);
