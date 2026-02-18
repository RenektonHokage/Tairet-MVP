-- Migration: create public reviews table for B2C MVP
-- Scope:
--   - Create public.reviews table
--   - Add anti-spam columns (fingerprint, ip_hash)
--   - Add indexes for venue feed + fingerprint limits
--   - Enable RLS with public read-only policy

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.locals(id) ON DELETE CASCADE,
  venue_type TEXT NOT NULL CHECK (venue_type IN ('bar', 'club')),
  display_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fingerprint TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT NULL,
  CONSTRAINT reviews_display_name_non_empty CHECK (char_length(trim(display_name)) > 0),
  CONSTRAINT reviews_comment_non_empty CHECK (char_length(trim(comment)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_reviews_venue_created_at
  ON public.reviews(venue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_fingerprint_created_at
  ON public.reviews(fingerprint, created_at DESC);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_select_public ON public.reviews;
CREATE POLICY reviews_select_public
  ON public.reviews
  FOR SELECT
  USING (true);
