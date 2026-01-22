-- Migration: Add attributes column to locals table
-- Purpose: Store up to 3 tags/specialties per local for filtering and display

ALTER TABLE public.locals
  ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.locals.attributes IS
  'Up to 3 attributes/tags selected from allowlist (bar: specialties, club: genres); used for B2C cards & filters.';
