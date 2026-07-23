-- 015_admin_rls.sql
-- Interim permissive DELETE policies so admins can remove reference data and
-- hard-delete reply-less journal entries. INSERT/UPDATE/SELECT are already
-- covered by migration 013. These will be tightened in the RBAC hardening pass.

CREATE POLICY "authenticated users can delete brands"
ON brands FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated users can delete owners"
ON owners FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated users can delete regions"
ON regions FOR DELETE TO authenticated USING (true);

CREATE POLICY "authenticated users can delete journal entries"
ON journal_entries FOR DELETE TO authenticated USING (true);
