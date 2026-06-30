-- 007_seed_task_definitions.sql
-- Seed the 20 lifecycle task definitions across the data, configuration and
-- provisioning phases.

insert into lifecycle_task_definitions
  (task_key, phase, display_name, description, required_role, is_phase_gate, completion_mode, order_index, timeframe_days)
values
  -- Data phase
  ('data_ingestion', 'data', 'Data Ingestion', null, 'engineer', false, 'manual_signoff', 1, 5),
  ('data_quality', 'data', 'Data Quality Review', null, 'engineer', false, 'manual_signoff', 2, 3),
  ('data_transformation', 'data', 'Data Transformation', null, 'engineer', false, 'manual_signoff', 3, 3),
  ('data_processing', 'data', 'Data Processing', null, 'engineer', false, 'manual_signoff', 4, 3),
  ('data_monitoring', 'data', 'Data Monitoring Setup', null, 'engineer', false, 'manual_signoff', 5, 2),
  ('data_integrity_validation', 'data', 'Data Extraction & Integrity Validation', null, 'engineer', true, 'manual_signoff', 6, 2),
  -- Configuration phase
  ('config_tenant', 'configuration', 'Tenant Configuration', null, 'engineer', false, 'manual_signoff', 7, 3),
  ('config_property', 'configuration', 'Property Configuration', null, 'engineer', false, 'manual_signoff', 8, 2),
  ('config_department', 'configuration', 'Department Setup', null, 'operations', false, 'manual_signoff', 9, 2),
  ('config_products', 'configuration', 'Products Configuration', null, 'operations', false, 'manual_signoff', 10, 3),
  ('config_goals', 'configuration', 'Goals Configuration', null, 'manager', false, 'manual_signoff', 11, 2),
  ('config_incentives', 'configuration', 'Incentives Setup', null, 'manager', false, 'manual_signoff', 12, 2),
  ('config_auditing', 'configuration', 'Audit Trail Configuration', null, 'engineer', false, 'manual_signoff', 13, 2),
  ('config_training', 'configuration', 'Training Setup', null, 'operations', true, 'manual_signoff', 14, 3),
  -- Provisioning phase
  ('prov_infrastructure', 'provisioning', 'Infrastructure Provisioning', null, 'engineer', false, 'manual_signoff', 15, 5),
  ('prov_ingauge_tenant', 'provisioning', 'IN-Gauge Tenant Creation', null, 'engineer', false, 'auto_with_override', 16, 2),
  ('prov_ingauge_id_confirm', 'provisioning', 'IN-Gauge ID Confirmation', null, 'engineer', false, 'manual_signoff', 17, 1),
  ('prov_salesforce_link', 'provisioning', 'Salesforce Record Linkage', null, 'operations', false, 'manual_signoff', 18, 1),
  ('prov_connectivity_test', 'provisioning', 'Connectivity & Integration Test', null, 'engineer', false, 'manual_signoff', 19, 3),
  ('prov_activation_readiness', 'provisioning', 'Activation Readiness Sign-off', null, 'admin', true, 'manual_signoff', 20, 1)
on conflict (task_key) do nothing;
