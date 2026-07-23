-- 013_rls_policies.sql
-- Interim permissive RLS policies: allow any authenticated user to operate so we
-- can test end-to-end. These will be tightened to role/scope-based policies in a
-- later hardening pass (do not treat these as production authorization).

-- properties
CREATE POLICY "authenticated users can read properties"
ON properties FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert properties"
ON properties FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update properties"
ON properties FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- property_lifecycle_tasks
CREATE POLICY "authenticated users can read tasks"
ON property_lifecycle_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert tasks"
ON property_lifecycle_tasks FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update tasks"
ON property_lifecycle_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- lifecycle_task_definitions
CREATE POLICY "authenticated users can read task definitions"
ON lifecycle_task_definitions FOR SELECT TO authenticated USING (true);

-- brands
CREATE POLICY "authenticated users can read brands"
ON brands FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert brands"
ON brands FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update brands"
ON brands FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- owners
CREATE POLICY "authenticated users can read owners"
ON owners FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert owners"
ON owners FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update owners"
ON owners FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- regions
CREATE POLICY "authenticated users can read regions"
ON regions FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert regions"
ON regions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update regions"
ON regions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- property_contacts
CREATE POLICY "authenticated users can read contacts"
ON property_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert contacts"
ON property_contacts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update contacts"
ON property_contacts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- journal_entries
CREATE POLICY "authenticated users can read journal entries"
ON journal_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert journal entries"
ON journal_entries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update journal entries"
ON journal_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- journal_entry_reactions
CREATE POLICY "authenticated users can read reactions"
ON journal_entry_reactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert reactions"
ON journal_entry_reactions FOR INSERT TO authenticated WITH CHECK (true);

-- journal_entry_attachments
CREATE POLICY "authenticated users can read attachments"
ON journal_entry_attachments FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert attachments"
ON journal_entry_attachments FOR INSERT TO authenticated WITH CHECK (true);

-- ttv_events
CREATE POLICY "authenticated users can read ttv events"
ON ttv_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert ttv events"
ON ttv_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated users can update ttv events"
ON ttv_events FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- user_invitations
CREATE POLICY "authenticated users can read invitations"
ON user_invitations FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated users can insert invitations"
ON user_invitations FOR INSERT TO authenticated WITH CHECK (true);

-- roles (read only)
CREATE POLICY "authenticated users can read roles"
ON roles FOR SELECT TO authenticated USING (true);

-- permissions (read only)
CREATE POLICY "authenticated users can read permissions"
ON permissions FOR SELECT TO authenticated USING (true);

-- user_role_assignments
CREATE POLICY "authenticated users can read their own role assignments"
ON user_role_assignments FOR SELECT TO authenticated USING (true);

-- event_outbox (insert via dispatch_event only, but allow reads)
CREATE POLICY "authenticated users can read event outbox"
ON event_outbox FOR SELECT TO authenticated USING (true);

-- ttv_parameters is not RLS-enabled; grant read access directly.
GRANT SELECT ON ttv_parameters TO authenticated;
