-- Migration: Add city column to locals
-- Purpose: Support multi-city venues for geocoding and display ("Zona • Ciudad")

ALTER TABLE public.locals
  ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN public.locals.city IS 'City/municipality for geocoding and display (allowlist enforced in backend/panel)';
