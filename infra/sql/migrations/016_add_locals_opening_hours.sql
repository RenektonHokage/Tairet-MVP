-- Migration: add structured opening_hours contract v1
-- opening_hours is nullable for progressive rollout.

ALTER TABLE public.locals
  ADD COLUMN IF NOT EXISTS opening_hours JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locals_opening_hours_is_object_check'
  ) THEN
    ALTER TABLE public.locals
      ADD CONSTRAINT locals_opening_hours_is_object_check
      CHECK (opening_hours IS NULL OR jsonb_typeof(opening_hours) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.locals.opening_hours IS
  'Structured weekly schedule v1. Source of truth for open/closed rules (America/Asuncion, operational cutoff 06:00).';

