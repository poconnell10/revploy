-- 011_create_property_tasks.sql
-- Seed all lifecycle task instances for a property from the task definitions.
-- SECURITY DEFINER so it can write to property_lifecycle_tasks regardless of the
-- caller's RLS context. Idempotent via the (property_id, task_definition_id)
-- unique constraint.

CREATE OR REPLACE FUNCTION create_property_tasks(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO property_lifecycle_tasks (property_id, task_definition_id)
  SELECT p_property_id, id
  FROM lifecycle_task_definitions
  ORDER BY order_index
  ON CONFLICT (property_id, task_definition_id) DO NOTHING;
END;
$$;
