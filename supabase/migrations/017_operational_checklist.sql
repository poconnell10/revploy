-- 017_operational_checklist.sql
-- Operational Checklist feature (Addendum 001): definition + per-property tables.

-- New table: operational checklist definitions (seed data)
CREATE TABLE operational_checklist_definitions (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  item_key text UNIQUE NOT NULL,
  category text NOT NULL CHECK (category IN ('kickoff_calls','products_revenue','front_desk_sop','elearning','administrative','ingauge_ops')),
  display_name text NOT NULL,
  description text,
  points numeric NOT NULL,
  is_auto boolean DEFAULT false,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- New table: per-property checklist items
CREATE TABLE property_checklist_items (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  property_id uuid NOT NULL REFERENCES properties ON DELETE CASCADE,
  definition_id uuid NOT NULL REFERENCES operational_checklist_definitions,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','complete','blocked')),
  assigned_to uuid NULL,
  completed_at timestamptz NULL,
  blocked_reason text NULL,
  notes text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (property_id, definition_id)
);

-- RLS
ALTER TABLE operational_checklist_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read checklist definitions" ON operational_checklist_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can read checklist items" ON property_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert checklist items" ON property_checklist_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update checklist items" ON property_checklist_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
