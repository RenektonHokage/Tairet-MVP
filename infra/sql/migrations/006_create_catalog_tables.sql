-- Migration: Create catalog tables for clubs (ticket_types, table_types) + orders.items snapshot
-- Run: Execute via Supabase Dashboard SQL Editor or psql

-- ============================================================================
-- Tabla ticket_types (entradas de discotecas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticket_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),  -- Consistente con orders.total_amount
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,  -- Soft-disable (no DELETE duro)
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ticket_types IS 'Tipos de entradas para discotecas. Max 2 activos por local.';
COMMENT ON COLUMN ticket_types.is_active IS 'false = soft-disabled, no se muestra en B2C ni se puede comprar';
COMMENT ON COLUMN ticket_types.price IS 'Precio en Gs. DECIMAL(10,2) consistente con orders.total_amount';

-- ============================================================================
-- Tabla table_types (mesas de discotecas - solo reserva WhatsApp, no se cobran)
-- ============================================================================
CREATE TABLE IF NOT EXISTS table_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) CHECK (price >= 0),  -- Precio referencial (no se cobra)
  capacity INTEGER,
  includes TEXT,  -- Descripción de qué incluye la mesa
  is_active BOOLEAN NOT NULL DEFAULT true,  -- Soft-disable
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE table_types IS 'Tipos de mesas para discotecas. Solo reserva por WhatsApp, no se cobran. Max 6 por local.';
COMMENT ON COLUMN table_types.price IS 'Precio referencial en Gs (no se cobra, solo informativo)';
COMMENT ON COLUMN table_types.includes IS 'Descripción de qué incluye la mesa (bebidas, servicio, etc.)';

-- ============================================================================
-- Columna items en orders para snapshot inmutable
-- ============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN orders.items IS 'Snapshot inmutable de items al momento de crear orden. Formato: [{kind, ticket_type_id, name, price, qty}]. El total_amount se calcula desde este snapshot.';

-- ============================================================================
-- Indices para performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ticket_types_local_id ON ticket_types(local_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_active ON ticket_types(local_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_table_types_local_id ON table_types(local_id);
CREATE INDEX IF NOT EXISTS idx_table_types_active ON table_types(local_id, is_active) WHERE is_active = true;

-- ============================================================================
-- Verificación (ejecutar manualmente para confirmar)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_schema = 'public' 
--   AND table_name IN ('ticket_types', 'table_types', 'orders')
-- ORDER BY table_name, ordinal_position;
