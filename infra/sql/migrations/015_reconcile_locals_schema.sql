-- Migration: reconcile locals schema drift (repo vs DB real)
-- Goal: keep migration idempotent and non-breaking.
-- IMPORTANT: do not change existing column types in production.

ALTER TABLE public.locals
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS panel_handle TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS hours JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS min_age SMALLINT;

-- Ensure JSONB defaults for legacy fields (non-breaking).
ALTER TABLE public.locals
  ALTER COLUMN hours SET DEFAULT '[]'::jsonb,
  ALTER COLUMN additional_info SET DEFAULT '[]'::jsonb,
  ALTER COLUMN gallery SET DEFAULT '[]'::jsonb,
  ALTER COLUMN attributes SET DEFAULT '[]'::jsonb;

-- Keep constraints idempotent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locals_min_age_range'
  ) THEN
    ALTER TABLE public.locals
      ADD CONSTRAINT locals_min_age_range
      CHECK (min_age IS NULL OR (min_age >= 0 AND min_age <= 99));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locals_latitude_range_check'
  ) THEN
    ALTER TABLE public.locals
      ADD CONSTRAINT locals_latitude_range_check
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locals_longitude_range_check'
  ) THEN
    ALTER TABLE public.locals
      ADD CONSTRAINT locals_longitude_range_check
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_locals_gallery ON public.locals USING GIN (gallery);
