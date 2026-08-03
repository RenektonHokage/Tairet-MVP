\set ON_ERROR_STOP on

CREATE SCHEMA supabase_migrations;

CREATE TABLE supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY,
  name text,
  statements text[]
);

INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES (
  '99000000000045',
  'synthetic_pre_046_approved_slice',
  ARRAY['NON_DEPLOYABLE_TEST_ONLY approved predecessor fixture']::text[]
);
