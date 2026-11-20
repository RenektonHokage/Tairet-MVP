BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.locals
  ADD COLUMN is_club_catalog_hidden boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT locals_catalog_hidden_only_for_clubs
    CHECK (type = 'club' OR NOT is_club_catalog_hidden);

COMMENT ON COLUMN public.locals.is_club_catalog_hidden IS
  'Hides a club from public discovery, its slug profile and its legacy catalog. Does not change orders or panel history.';

COMMIT;
