-- 024_update_data_phase_tasks.sql
-- Refresh Data Phase task display names and descriptions to match the
-- S3 → Phase 0 → Phase 1 ingestion pipeline.

UPDATE lifecycle_task_definitions SET
  display_name = 'S3 Ingestion',
  description = 'Hotel PMS exports arrive in the dedicated S3 bucket (fpg-revploy-{property}-ingest). File is received and routed to /raw/incoming/{property_id}/. Triggered automatically on ObjectCreated event. Supported formats: XML (Opera 5.5 on-prem LM and PM reports).'
WHERE task_key = 'data_ingestion';

UPDATE lifecycle_task_definitions SET
  display_name = 'Phase 0 — File Validation',
  description = 'Config-driven validation against LM/PM templates. Checks filename pattern (LM_{property_id}_{date}.xml), file size thresholds, XML root structure, and required node paths. Routes output to /phase0/validated, /phase0/degraded, or /phase0/quarantine based on result.'
WHERE task_key = 'data_quality';

UPDATE lifecycle_task_definitions SET
  display_name = 'Phase 0 — Schema Validation',
  description = 'Field-level validation per report type. Checks required fields are present and non-null, date formats (DD-MMM-YY), numeric field types, duplicate records (file hash + unique key), and null thresholds. Missing required fields = FAIL. Extra or out-of-order fields = DEGRADED.'
WHERE task_key = 'data_transformation';

UPDATE lifecycle_task_definitions SET
  display_name = 'Phase 1 — Reconciliation & Anomaly Detection',
  description = 'Cross-file reconciliation checks revenue totals against room counts. Anomaly detection flags statistical outliers. Semantic validation confirms values are logically consistent (e.g. occupancy rate within expected range). Flagged records quarantined with failure reason logged.'
WHERE task_key = 'data_processing';

UPDATE lifecycle_task_definitions SET
  display_name = 'Phase 1 — Normalization & Lineage',
  description = 'Data normalized to FPG canonical format for downstream processing. Full lineage tracked from source file through each transformation step. Quarantine rows logged to /phase0/quarantine_rows/ with structured failure JSON. SLA cutoff monitoring active.'
WHERE task_key = 'data_monitoring';

UPDATE lifecycle_task_definitions SET
  display_name = 'Integrity Sign-off',
  description = 'Final engineer sign-off confirming Phase 0 and Phase 1 completed cleanly. Reviews: quarantine file count, degraded file count, audit log completeness, and null/duplicate thresholds. This is the Data Phase gate — Configuration cannot begin until signed off.'
WHERE task_key = 'data_integrity_validation';
