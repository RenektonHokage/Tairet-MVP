-- F7 CODE 03
-- Hardening mínimo del bloque reviews.
-- Mantiene operativos los flows backend actuales (service_role con bypass de RLS)
-- y bloquea lectura SQL directa para anon/authenticated.

DROP POLICY IF EXISTS "reviews_select_public" ON reviews;
DROP POLICY IF EXISTS "reviews_select_backend_only" ON reviews;

CREATE POLICY "reviews_select_backend_only" ON reviews
  FOR SELECT
  TO anon, authenticated
  USING (false);
