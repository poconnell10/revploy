-- 019_create_checklist_items_rpc.sql
-- Seed a property's operational checklist items from the definitions.

CREATE OR REPLACE FUNCTION create_property_checklist_items(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO property_checklist_items (property_id, definition_id)
  SELECT p_property_id, id
  FROM operational_checklist_definitions
  ORDER BY order_index
  ON CONFLICT (property_id, definition_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION create_property_checklist_items(uuid) TO authenticated;
