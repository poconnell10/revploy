-- 021_product_seeding_rpcs.sql
-- Per-product seeding: each property_product gets its own 20 tasks + 22
-- checklist items, tagged with the property_product_id.

-- Seed 20 tasks for a specific property_product
CREATE OR REPLACE FUNCTION create_product_tasks(p_property_id uuid, p_property_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO property_lifecycle_tasks (property_id, task_definition_id, property_product_id)
  SELECT p_property_id, id, p_property_product_id
  FROM lifecycle_task_definitions
  ORDER BY order_index
  ON CONFLICT DO NOTHING;
END;
$$;

-- Seed 22 checklist items for a specific property_product
CREATE OR REPLACE FUNCTION create_product_checklist_items(p_property_id uuid, p_property_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO property_checklist_items (property_id, definition_id, property_product_id)
  SELECT p_property_id, id, p_property_product_id
  FROM operational_checklist_definitions
  ORDER BY order_index
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION create_product_tasks(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_product_checklist_items(uuid, uuid) TO authenticated;
