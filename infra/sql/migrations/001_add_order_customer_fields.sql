-- Migration: add customer_document and customer_last_name to orders
-- Run: psql -h HOST -U USER -d DB -f infra/sql/migrations/001_add_order_customer_fields.sql

-- Add customer_document (cédula de identidad)
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_document TEXT;

-- Add customer_last_name (apellido del comprador)
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS customer_last_name TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.orders.customer_document IS 'Cédula de identidad del comprador';
COMMENT ON COLUMN public.orders.customer_last_name IS 'Apellido del comprador';

-- Verification query (run manually):
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders' 
--   AND column_name IN ('customer_document', 'customer_last_name');

