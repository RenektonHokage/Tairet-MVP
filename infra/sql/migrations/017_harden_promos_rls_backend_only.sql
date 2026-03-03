-- F7 CODE 02
-- Hardening mínimo del bloque promos.
-- Mantiene operativos los flows backend actuales (service_role con bypass de RLS)
-- y bloquea lectura SQL directa para anon/authenticated.

DROP POLICY IF EXISTS "promos_select_by_local" ON promos;
DROP POLICY IF EXISTS "promos_select_backend_only" ON promos;

CREATE POLICY "promos_select_backend_only" ON promos
  FOR SELECT
  TO anon, authenticated
  USING (false);
