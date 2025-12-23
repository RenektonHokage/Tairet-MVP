# RUNBOOK — Tairet MVP

**Propósito:** Guía rápida para levantar servicios y verificar que todo funciona.

---

## 1. LEVANTAR SERVICIOS

### Terminal 1: Backend API
```bash
cd functions/api
pnpm dev
# → Puerto: 4000
# → Verificar: http://localhost:4000/health debe responder { "ok": true }
```

### Terminal 2: Panel B2B
```bash
cd apps/web-next
pnpm dev
# → Puerto: 3000 o 3001 (Next.js elige automáticamente)
# → Verificar: http://localhost:3000/panel/login
```

### Terminal 3: B2C
```bash
cd apps/web-b2c
pnpm dev
# → Puerto: 5173 (Vite default)
# → Verificar: http://localhost:5173/#/
```

---

## 2. CONFIGURAR SUPABASE

### Orden de Ejecución SQL

Ejecutar en Supabase SQL Editor (en orden):

1. **Schema:**
   ```sql
   -- Copiar y pegar contenido de infra/sql/schema.sql
   ```

2. **RLS:**
   ```sql
   -- Copiar y pegar contenido de infra/sql/rls.sql
   ```

3. **Seed:**
   ```sql
   -- Copiar y pegar contenido de infra/sql/seed.sql
   ```

4. **Crear Usuario en Supabase Auth:**
   - Ir a Supabase Dashboard > Authentication > Users
   - Click "Add user" > "Create new user"
   - Email: `panel@tairet.test` (o el que prefieras)
   - Password: (elegir una contraseña segura)
   - **Copiar el User UID generado** (UUID)

5. **Insertar en `panel_users`:**
   ```sql
   INSERT INTO panel_users (auth_user_id, email, local_id, role)
   VALUES
     (
       'REPLACE_WITH_AUTH_USER_ID', -- Reemplazar con el UUID del paso 4
       'panel@tairet.test',
       '550e8400-e29b-41d4-a716-446655440001', -- mckharthys-bar
       'owner'
     )
   ON CONFLICT (auth_user_id) DO NOTHING;
   ```

---

## 3. VERIFICACIÓN SQL

### Query 1: Verificar Policies RLS
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('events_public', 'orders', 'promos', 'reservations', 'locals', 'panel_users')
ORDER BY tablename, policyname;
```

**Expected:** Ver policies listadas en SOURCE_OF_TRUTH.md (ej: `events_public_insert_public`, `orders_select_by_local`, etc.)

### Query 2: Verificar RLS Status
```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename IN ('events_public', 'orders', 'promos', 'reservations', 'locals', 'panel_users', 'whatsapp_clicks', 'profile_views', 'local_daily_ops')
ORDER BY tablename;
```

**Expected:**
- `rowsecurity = true`: `events_public`, `locals`, `orders`, `promos`, `reservations`, `whatsapp_clicks`, `profile_views`, `local_daily_ops`
- `rowsecurity = false`: `panel_users`

### Query 3: Verificar Locals MVP
```sql
SELECT id, slug, name, type, ticket_price
FROM locals
WHERE slug IN ('mckharthys-bar', 'killkenny-pub', 'morgan', 'celavie', 'dlirio')
ORDER BY slug;
```

**Expected:** 5 filas con `type` = 'bar' o 'club', `ticket_price` = 0 para bares, > 0 para clubs.

---

## 4. VERIFICACIÓN API

### Health Check
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:4000/health" -Method GET
# Expected: { "ok": true }
```

### Resolver Slug → Local
```bash
# PowerShell
Invoke-RestMethod -Uri "http://localhost:4000/public/locals/by-slug/morgan" -Method GET
# Expected: { "id": "550e8400-e29b-41d4-a716-446655440004", "slug": "morgan", "type": "club", ... }
```

### Tracking (Sin Auth)
```bash
# PowerShell - Profile View
$body = @{
  local_id = "550e8400-e29b-41d4-a716-446655440004"
  source = "b2c_web"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4000/events/profile_view" -Method POST -Body $body -ContentType "application/json"
# Expected: { "ok": true }
```

---

## 5. VERIFICACIÓN PANEL (Requiere Auth)

### Obtener Access Token

1. **Opción A: Desde Browser DevTools**
   - Abrir `http://localhost:3000/panel/login`
   - Hacer login
   - Abrir DevTools (F12) > Network
   - Ir a `/panel` o `/panel/me`
   - Buscar request `GET /panel/me`
   - En Headers > Request Headers, copiar valor de `Authorization: Bearer <token>`

2. **Opción B: Desde Console (Supabase)**
   - En DevTools Console (después de login):
   ```javascript
   (await supabase.auth.getSession()).data.session?.access_token
   ```

### Llamar Endpoint con Token

```powershell
# PowerShell - Obtener Métricas
$token = "REPLACE_WITH_ACCESS_TOKEN" # Reemplazar con token del paso anterior

$headers = @{
  "Authorization" = "Bearer $token"
  "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:4000/metrics/summary" -Method GET -Headers $headers
# Expected: { "local_id": "uuid", "range": {...}, "kpis": {...} }
```

### Verificar Multi-Tenant

```powershell
# Intentar acceder a otro local (debe fallar con 403)
$token = "REPLACE_WITH_ACCESS_TOKEN"
$headers = @{
  "Authorization" = "Bearer $token"
}

# Si tu local_id es 550e8400-e29b-41d4-a716-446655440001, intentar acceder a otro:
Invoke-RestMethod -Uri "http://localhost:4000/locals/550e8400-e29b-41d4-a716-446655440004/reservations" -Method GET -Headers $headers
# Expected: 403 { "error": "Forbidden: You can only access your own local's reservations" }
```

---

## 6. VERIFICACIÓN B2C (Browser)

### URLs de Prueba

1. **Perfil de Bar:**
   - `http://localhost:5173/#/bar/mckharthys-bar`
   - Verificar: Renderiza perfil, muestra formulario de reservas

2. **Perfil de Club:**
   - `http://localhost:5173/#/club/morgan`
   - Verificar: Renderiza perfil, muestra tickets/mesas (no reservas)

3. **Slug Inexistente:**
   - `http://localhost:5173/#/club/local-inexistente`
   - Verificar: Redirige a 404

### Tracking en DevTools Network

1. Abrir `http://localhost:5173/#/club/morgan`
2. Abrir DevTools (F12) > Network
3. Filtrar por "profile_view"
4. Verificar: `POST /events/profile_view` (status 201, solo una vez)
5. Click en "Reservar mesa" → Verificar: `POST /events/whatsapp_click` (status 201)
6. Click en promo "Ladies Night" → Verificar: `POST /events/promo_open` (status 201, con `promo_id` UUID real)
7. Click en la misma promo otra vez → Verificar: NO aparece otro request (dedupe)

---

## 7. TROUBLESHOOTING

### Error: "column type does not exist"
- **Causa:** `locals` table no tiene columna `type`
- **Solución:** Ejecutar `infra/sql/schema.sql` completo (no solo partes)

### Error: "RLS policy violation"
- **Causa:** RLS habilitado pero policies no creadas
- **Solución:** Ejecutar `infra/sql/rls.sql`

### Error: "LOCAL_NOT_FOUND" en B2C
- **Causa:** Slug no existe en DB o no tiene mock data
- **Solución:** Verificar que `seed.sql` se ejecutó correctamente y que el slug está en `mvpSlugs.ts`

### Error: CORS en API
- **Causa:** `FRONTEND_ORIGIN` no incluye el origin del frontend
- **Solución:** Agregar origin a `FRONTEND_ORIGIN` en `.env` del backend (ej: `http://localhost:5173`)

### Error: 401 Unauthorized en Panel
- **Causa:** Token expirado o inválido
- **Solución:** Hacer login nuevamente y copiar nuevo token

---

## 8. COMANDOS ÚTILES

### Build y Typecheck
```bash
# Desde raíz del repo
pnpm -r build      # Build todas las apps
pnpm -r typecheck # Typecheck todas las apps
```

### Limpiar y Reinstalar
```bash
# Desde raíz del repo
rm -rf node_modules **/node_modules
pnpm install
```

### Ver Logs del Backend
```bash
# El backend usa console.log/console.error
# Ver logs en la terminal donde corre `pnpm -C functions/api dev`
```

---

**FIN DEL RUNBOOK**


