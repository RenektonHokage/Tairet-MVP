-- Migration: Add min_age column to locals table
-- Purpose: Store minimum age restriction for venues (e.g., 18, 21)
-- NULL = no age restriction (all ages welcome)

ALTER TABLE public.locals
  ADD COLUMN IF NOT EXISTS min_age SMALLINT;

-- Add constraint to ensure valid age range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'locals_min_age_range'
  ) THEN
    ALTER TABLE public.locals
      ADD CONSTRAINT locals_min_age_range CHECK (min_age IS NULL OR (min_age >= 0 AND min_age <= 99));
  END IF;
END $$;

COMMENT ON COLUMN public.locals.min_age IS
  'Minimum age restriction (e.g., 18, 21). NULL means no restriction / all ages.';
