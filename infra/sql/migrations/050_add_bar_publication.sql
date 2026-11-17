BEGIN;
SET LOCAL lock_timeout = '5s';

-- B-01: publication is administered by TAIRET, outside owner profile updates.
-- Existing rows (including demos) and future inserts start unpublished.
-- Enforcement is limited to bars; club/Access contracts are unchanged.
ALTER TABLE public.locals
  ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.locals.is_published IS
  'TAIRET-managed bar publication. Defaults false; owner profile saves cannot change it. Not yet enforced for clubs.';

-- Preserve the closed 021 boundary. Fail if direct client access has drifted,
-- rather than granting a new path around the API publication filter.
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.locals', 'SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated', 'public.locals', 'SELECT,INSERT,UPDATE,DELETE') THEN
    RAISE EXCEPTION 'B-01 requires the locals Data API boundary from migration 021';
  END IF;
END $$;
COMMIT;
