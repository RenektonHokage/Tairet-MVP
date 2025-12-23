-- Schema SQL para Tairet MVP
-- Zona horaria: America/Asuncion
-- Moneda: PYG

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla: locals (locales/venues)
CREATE TABLE IF NOT EXISTS locals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('bar', 'club')), -- Tipo de local: bar o club
  description TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  ticket_price DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Precio fijo por local (PYG)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: promos
CREATE TABLE IF NOT EXISTS promos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: orders (órdenes de entrada)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_amount DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PYG',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  payment_method TEXT,
  transaction_id TEXT,
  used_at TIMESTAMPTZ, -- Check-in manual (MVP sin QR)
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: payment_events (idempotencia de callbacks)
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL UNIQUE, -- Unique para idempotencia
  status TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: reservations (reservas para bares)
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last_name TEXT, -- Apellido (opcional, para alinearse con formulario B2C)
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  guests INTEGER NOT NULL CHECK (guests > 0),
  status TEXT NOT NULL DEFAULT 'en_revision' CHECK (status IN ('en_revision', 'confirmed', 'cancelled')),
  notes TEXT, -- Comentario del cliente
  table_note TEXT, -- Nota interna del local (ej: "Mesa X / cerca ventana")
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: events_public (eventos públicos para tracking)
CREATE TABLE IF NOT EXISTS events_public (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  local_id UUID REFERENCES locals(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: whatsapp_clicks (específica para tracking de clicks)
CREATE TABLE IF NOT EXISTS whatsapp_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  phone TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: profile_views (vistas de perfil)
CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: panel_users (usuarios del panel B2B)
CREATE TABLE IF NOT EXISTS panel_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL UNIQUE, -- id del usuario en Supabase Auth
  email TEXT NOT NULL,
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla: local_daily_ops (operación diaria del local)
CREATE TABLE IF NOT EXISTS local_daily_ops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  day DATE NOT NULL, -- día local, sin hora
  is_open BOOLEAN NOT NULL DEFAULT true,
  note TEXT, -- nota corta del día (ej: "Halloween", "Privado")
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(local_id, day)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_orders_local_id ON orders(local_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_events_transaction_id ON payment_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_reservations_local_id ON reservations(local_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_promos_local_id ON promos(local_id);
CREATE INDEX IF NOT EXISTS idx_events_public_local_id ON events_public(local_id);
CREATE INDEX IF NOT EXISTS idx_events_public_type ON events_public(type);
CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_local_id ON whatsapp_clicks(local_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_local_id ON profile_views(local_id);
CREATE INDEX IF NOT EXISTS idx_panel_users_auth_user_id ON panel_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_panel_users_local_id ON panel_users(local_id);
CREATE INDEX IF NOT EXISTS idx_panel_users_email ON panel_users(email);
CREATE INDEX IF NOT EXISTS idx_local_daily_ops_local_id ON local_daily_ops(local_id);
CREATE INDEX IF NOT EXISTS idx_local_daily_ops_day ON local_daily_ops(day);

