-- Migration: Add exact map coordinates to locals
-- Purpose: allow panel owners to set precise map pin and avoid ambiguous geocoding

ALTER TABLE public.locals
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE public.locals
  DROP CONSTRAINT IF EXISTS locals_latitude_range_check;

ALTER TABLE public.locals
  ADD CONSTRAINT locals_latitude_range_check
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE public.locals
  DROP CONSTRAINT IF EXISTS locals_longitude_range_check;

ALTER TABLE public.locals
  ADD CONSTRAINT locals_longitude_range_check
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

COMMENT ON COLUMN public.locals.latitude IS 'Exact latitude for profile map pin (optional)';
COMMENT ON COLUMN public.locals.longitude IS 'Exact longitude for profile map pin (optional)';
