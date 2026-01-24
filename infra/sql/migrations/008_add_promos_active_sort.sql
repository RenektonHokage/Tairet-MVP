-- Migration 008: Add is_active and sort_order to promos table
-- Required for soft-activation and manual ordering in panel

-- Add is_active column (default true for existing promos)
ALTER TABLE promos 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add sort_order column (default 0 for existing promos)
ALTER TABLE promos 
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

-- Composite index for filtered and ordered queries
CREATE INDEX IF NOT EXISTS idx_promos_local_active_sort 
  ON promos(local_id, is_active, sort_order);
