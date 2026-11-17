-- Run only by an authorized TAIRET database administrator. No credentials here.
-- Required psql variables: local_id (UUID), publish (true/false), expected (true/false).
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE publication_result ON COMMIT DROP AS
WITH changed AS (
  UPDATE public.locals
  SET is_published = :'publish'::boolean, updated_at = now()
  WHERE id = :'local_id'::uuid
    AND type = 'bar'
    AND is_published = :'expected'::boolean
  RETURNING id, slug, type, is_published
)
SELECT * FROM changed;

DO $$
BEGIN
  IF (SELECT count(*) FROM publication_result) <> 1 THEN
    RAISE EXCEPTION 'No single matching bar with the expected publication state; nothing committed';
  END IF;
END $$;

TABLE publication_result;
COMMIT;
