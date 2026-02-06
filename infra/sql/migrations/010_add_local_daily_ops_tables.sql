-- Migration: Add tables_whatsapp and tables_tairet columns to local_daily_ops
-- For clubs to track manually confirmed tables by channel

ALTER TABLE local_daily_ops
ADD COLUMN IF NOT EXISTS tables_whatsapp INTEGER NOT NULL DEFAULT 0;

ALTER TABLE local_daily_ops
ADD COLUMN IF NOT EXISTS tables_tairet INTEGER NOT NULL DEFAULT 0;

ALTER TABLE local_daily_ops
ADD CONSTRAINT chk_local_daily_ops_tables_whatsapp_non_negative CHECK (tables_whatsapp >= 0);

ALTER TABLE local_daily_ops
ADD CONSTRAINT chk_local_daily_ops_tables_tairet_non_negative CHECK (tables_tairet >= 0);

COMMENT ON COLUMN local_daily_ops.tables_whatsapp IS 'Manual tables confirmed via WhatsApp for the day (clubs only)';
COMMENT ON COLUMN local_daily_ops.tables_tairet IS 'Manual tables confirmed via Tairet for the day (clubs only)';
