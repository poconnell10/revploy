-- 023_ingest_events.sql
-- Audit log for S3 data-ingestion callbacks (Lambda + manual test).

CREATE TABLE ingest_events (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  property_id uuid NOT NULL REFERENCES properties ON DELETE CASCADE,
  property_code text NOT NULL,
  s3_bucket text NOT NULL,
  s3_key text,
  source text NOT NULL CHECK (source IN ('s3_trigger','manual_test','curl')),
  status text NOT NULL CHECK (status IN ('received','processed','failed')),
  tasks_updated integer DEFAULT 0,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ingest_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated can read ingest events"
  ON ingest_events FOR SELECT TO authenticated USING (true);

GRANT INSERT, UPDATE ON ingest_events TO service_role;
GRANT SELECT ON ingest_events TO authenticated;
