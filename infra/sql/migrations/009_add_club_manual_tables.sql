-- Migration: Add club_manual_tables column to local_daily_ops
-- For clubs to track manually confirmed tables (WhatsApp reservations)

-- Add column with default 0 and non-negative constraint
ALTER TABLE local_daily_ops
ADD COLUMN IF NOT EXISTS club_manual_tables INTEGER NOT NULL DEFAULT 0;

-- Add CHECK constraint for non-negative values
ALTER TABLE local_daily_ops
ADD CONSTRAINT chk_club_manual_tables_non_negative CHECK (club_manual_tables >= 0);

COMMENT ON COLUMN local_daily_ops.club_manual_tables IS 'Number of manually confirmed tables for the day (clubs only, via WhatsApp)';
