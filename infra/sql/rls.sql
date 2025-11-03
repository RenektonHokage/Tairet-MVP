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

-- Policy: locals (cada usuario autenticado puede ver sus locales)
-- TODO: Ajustar según sistema de autenticación (Supabase Auth)
-- Por ahora: permitir lectura pública (RLS se aplica a otras tablas)

-- Policy: promos (solo ver promos del local correspondiente)
CREATE POLICY "promos_select_by_local" ON promos
  FOR SELECT
  USING (true); -- TODO: Filtrar por local_id según usuario autenticado

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

-- Policy: events_public (solo ver eventos del local correspondiente)
CREATE POLICY "events_public_select_by_local" ON events_public
  FOR SELECT
  USING (true); -- TODO: Filtrar por local_id según usuario autenticado

CREATE POLICY "events_public_insert_public" ON events_public
  FOR INSERT
  WITH CHECK (true); -- Permitir insertar eventos públicamente

-- Policy: whatsapp_clicks (solo ver clicks del local correspondiente)
CREATE POLICY "whatsapp_clicks_select_by_local" ON whatsapp_clicks
  FOR SELECT
  USING (true); -- TODO: Filtrar por local_id según usuario autenticado

CREATE POLICY "whatsapp_clicks_insert_public" ON whatsapp_clicks
  FOR INSERT
  WITH CHECK (true); -- Permitir insertar clicks públicamente

-- Policy: profile_views (solo ver vistas del local correspondiente)
CREATE POLICY "profile_views_select_by_local" ON profile_views
  FOR SELECT
  USING (true); -- TODO: Filtrar por local_id según usuario autenticado

CREATE POLICY "profile_views_insert_public" ON profile_views
  FOR INSERT
  WITH CHECK (true); -- Permitir insertar vistas públicamente

-- TODO: Ajustar políticas según sistema de autenticación Supabase
-- Ejemplo con auth.uid():
-- USING (local_id IN (SELECT id FROM locals WHERE owner_id = auth.uid()))

