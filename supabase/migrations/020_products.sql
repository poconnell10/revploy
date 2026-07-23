-- 020_products.sql
-- Products sprint (Addendum 002): product catalog + per-property product
-- instances, each tracked independently with their own lifecycle/TTV. Task and
-- checklist rows gain a property_product_id so they can be scoped per product.

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  product_key text UNIQUE NOT NULL CHECK (product_key IN ('deskmax','bookmax','checkmax','revmax')),
  display_name text NOT NULL,
  description text,
  color text NOT NULL,
  created_at timestamptz DEFAULT now()
);

INSERT INTO products (product_key, display_name, description, color) VALUES
('deskmax', 'DeskMax', 'Front desk upsell platform', '#7c3aed'),
('bookmax', 'BookMax', 'Pre-arrival upsell platform', '#2563eb'),
('revmax', 'RevMax', 'Upsell pricing engine', '#16a34a'),
('checkmax', 'CheckMax', 'Restaurant performance application', '#d97706');

CREATE TABLE property_products (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  property_id uuid NOT NULL REFERENCES properties ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products,
  lifecycle_state text NOT NULL DEFAULT 'onboarding' CHECK (lifecycle_state IN ('onboarding','activated','archived')),
  phase_current text CHECK (phase_current IN ('data','configuration','provisioning')),
  activation_date date NULL,
  activated_at timestamptz NULL,
  salesforce_id text NULL,
  ingauge_id text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (property_id, product_id)
);

ALTER TABLE property_lifecycle_tasks ADD COLUMN property_product_id uuid NULL REFERENCES property_products;
ALTER TABLE property_checklist_items ADD COLUMN property_product_id uuid NULL REFERENCES property_products;

-- Task and checklist rows are now scoped to a property_product. The old
-- uniqueness on (property, definition) prevented a property from ever holding
-- more than one product's copy of a task/item, so it must move to
-- (property_product, definition). Without this, seeding the second product for
-- a property would collide on every row and seed nothing.
ALTER TABLE property_lifecycle_tasks
  DROP CONSTRAINT IF EXISTS property_lifecycle_tasks_property_id_task_definition_id_key;
ALTER TABLE property_lifecycle_tasks
  ADD CONSTRAINT property_lifecycle_tasks_product_task_key
  UNIQUE (property_product_id, task_definition_id);

ALTER TABLE property_checklist_items
  DROP CONSTRAINT IF EXISTS property_checklist_items_property_id_definition_id_key;
ALTER TABLE property_checklist_items
  ADD CONSTRAINT property_checklist_items_product_definition_key
  UNIQUE (property_product_id, definition_id);

ALTER TABLE property_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can read property_products" ON property_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert property_products" ON property_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update property_products" ON property_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
