-- Row Level Security (RLS) policies para multi-tenant
-- Cada local solo ve sus propios datos

-- Habilitar RLS en todas las tablas
ALTER TABLE locals ENABLE ROW LEVEL SECURITY;
ALTER TABLE promos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_public ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_daily_ops ENABLE ROW LEVEL SECURITY;

-- Policy: locals (cada usuario autenticado puede ver sus locales)
-- TODO: Ajustar según sistema de autenticación (Supabase Auth)
-- Por ahora: permitir lectura pública (RLS se aplica a otras tablas)

-- Policy: promos (backend only; clientes anon/authenticated no deben leer por SQL directo)
CREATE POLICY "promos_select_backend_only" ON promos
  FOR SELECT
  TO anon, authenticated
  USING (false);

-- Policy: orders (solo ver órdenes del local correspondiente)
CREATE POLICY "orders_select_by_local" ON orders
  FOR SELECT
  USING (true); -- TODO: Filtrar por local_id según usuario autenticado

CREATE POLICY "orders_insert_by_local" ON orders
  FOR INSERT
  WITH CHECK (true); -- TODO: Validar local_id según usuario

-- Policy: reservations (solo ver reservas del local correspondiente)
CREATE POLICY "reservations_select_by_local" ON reservations
  FOR SELECT
  USING (true); -- TODO: Filtrar por local_id según usuario autenticado

CREATE POLICY "reservations_insert_public" ON reservations
  FOR INSERT
  WITH CHECK (true); -- Permitir crear reservas públicamente

-- Policy: tracking público (sin acceso SQL directo para anon/authenticated)
-- El backend observable usa service_role y bypassea RLS; estas tablas no deben
-- quedar abiertas por SQL directo para clientes anon/authenticated.
CREATE POLICY "events_public_select_backend_only" ON events_public
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "events_public_insert_backend_only" ON events_public
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "whatsapp_clicks_select_backend_only" ON whatsapp_clicks
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "whatsapp_clicks_insert_backend_only" ON whatsapp_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

CREATE POLICY "profile_views_select_backend_only" ON profile_views
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "profile_views_insert_backend_only" ON profile_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- Policy: local_daily_ops (solo ver/modificar operación del local correspondiente)
CREATE POLICY "local_daily_ops_select_by_local" ON local_daily_ops
  FOR SELECT
  USING (true); -- TODO: Filtrar por local_id según usuario autenticado

CREATE POLICY "local_daily_ops_insert_by_local" ON local_daily_ops
  FOR INSERT
  WITH CHECK (true); -- TODO: Validar local_id según usuario

CREATE POLICY "local_daily_ops_update_by_local" ON local_daily_ops
  FOR UPDATE
  USING (true); -- TODO: Validar local_id según usuario

-- TODO: Ajustar políticas según sistema de autenticación Supabase
-- Ejemplo con auth.uid():
-- USING (local_id IN (SELECT id FROM locals WHERE owner_id = auth.uid()))

