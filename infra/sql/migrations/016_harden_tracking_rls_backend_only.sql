-- F7 CODE 01
-- Hardening mínimo del bloque tracking público.
-- Mantiene operativos los flows backend actuales (service_role con bypass de RLS)
-- y bloquea acceso SQL directo para anon/authenticated.

DROP POLICY IF EXISTS "events_public_select_by_local" ON events_public;
DROP POLICY IF EXISTS "events_public_insert_public" ON events_public;
DROP POLICY IF EXISTS "events_public_select_backend_only" ON events_public;
DROP POLICY IF EXISTS "events_public_insert_backend_only" ON events_public;

CREATE POLICY "events_public_select_backend_only" ON events_public
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "events_public_insert_backend_only" ON events_public
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "whatsapp_clicks_select_by_local" ON whatsapp_clicks;
DROP POLICY IF EXISTS "whatsapp_clicks_insert_public" ON whatsapp_clicks;
DROP POLICY IF EXISTS "whatsapp_clicks_select_backend_only" ON whatsapp_clicks;
DROP POLICY IF EXISTS "whatsapp_clicks_insert_backend_only" ON whatsapp_clicks;

CREATE POLICY "whatsapp_clicks_select_backend_only" ON whatsapp_clicks
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "whatsapp_clicks_insert_backend_only" ON whatsapp_clicks
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "profile_views_select_by_local" ON profile_views;
DROP POLICY IF EXISTS "profile_views_insert_public" ON profile_views;
DROP POLICY IF EXISTS "profile_views_select_backend_only" ON profile_views;
DROP POLICY IF EXISTS "profile_views_insert_backend_only" ON profile_views;

CREATE POLICY "profile_views_select_backend_only" ON profile_views
  FOR SELECT
  TO anon, authenticated
  USING (false);

CREATE POLICY "profile_views_insert_backend_only" ON profile_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);
