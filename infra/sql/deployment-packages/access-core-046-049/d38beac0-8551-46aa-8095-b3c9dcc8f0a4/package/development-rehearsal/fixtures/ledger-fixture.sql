\set ON_ERROR_STOP on

CREATE SCHEMA supabase_migrations;

CREATE TABLE supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY,
  name text,
  statements text[]
);

INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES ('20260711062758','045_access_core_paid_checkin_operational_window',ARRAY['LOCAL_PACKAGE_SYNTHETIC_PREDECESSOR_STATEMENT']::text[]);
