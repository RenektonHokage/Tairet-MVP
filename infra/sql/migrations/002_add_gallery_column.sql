-- Migration: Add gallery column to locals table
-- Run: psql -h HOST -U USER -d DB -f infra/sql/migrations/002_add_gallery_column.sql
-- Or execute via Supabase Dashboard SQL Editor

-- Add gallery column (JSONB array of gallery items)
-- Each item: { id: string, url: string, kind: string, order: number }
ALTER TABLE public.locals 
  ADD COLUMN IF NOT EXISTS gallery JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.locals.gallery IS 
  'Gallery images array: [{id, url, kind, order}]. Kinds: cover, carousel, menu, drinks, food, interior. Max 12 items.';

-- Create index for faster queries on gallery (optional, for future filtering)
CREATE INDEX IF NOT EXISTS idx_locals_gallery ON locals USING GIN (gallery);

-- Verification query (run manually):
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'locals' 
--   AND column_name = 'gallery';

-- ============================================================================
-- STORAGE BUCKET SETUP (run in Supabase Dashboard -> Storage -> Create Bucket)
-- ============================================================================
-- Bucket name: local-gallery
-- Public: YES (for public read access to images)
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp
--
-- NOTE: Uploads are done via backend (service role), not directly from frontend.
-- No RLS policies needed since backend handles multi-tenant validation.
-- ============================================================================
