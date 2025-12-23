# AUDITORÍA SUPABASE NUEVO — tairet-mono-2

**Fecha:** 2025-01-XX  
**Objetivo:** Verificar requisitos exactos para configurar un nuevo proyecto Supabase sin romper funcionalidad existente.

---

## 1. INICIALIZACIÓN DE CLIENTES SUPABASE

### 1.1. Backend (Express + TS)

**Archivo:** `functions/api/src/services/supabase.ts`  
**Líneas:** 1-17

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE"
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

**Variables de entorno requeridas:**
- `SUPABASE_URL` (requerido, sin fallback)
- `SUPABASE_SERVICE_ROLE` (requerido, sin fallback)

**Uso del cliente:**
- Se usa `SUPABASE_SERVICE_ROLE` (service role key) para bypass de RLS
- El cliente se usa en múltiples rutas: `reservations.ts`, `metrics.ts`, `activity.ts`, `promos.ts`, `events.ts`, `payments.ts`, `orders.ts`
- También se usa en `panelAuth.ts` para validar tokens JWT con `supabase.auth.getUser(accessToken)`

**Evidencia de uso:**
- `functions/api/src/middlewares/panelAuth.ts:54` - `supabase.auth.getUser(accessToken)`
- `functions/api/src/routes/reservations.ts:16` - `supabase.from("reservations")`
- `functions/api/src/routes/metrics.ts:50` - `supabase.from("whatsapp_clicks")`
- Y otros 50+ usos en el código

### 1.2. Frontend (Next.js 15)

**Archivo:** `apps/web-next/lib/supabase.ts`  
**Líneas:** 1-34

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: ReturnType<typeof createClient>;

if (!supabaseUrl || !supabaseAnonKey) {
  // En CI, usar cliente dummy para que el build no falle
  if (process.env.CI === "true") {
    console.warn(
      "Supabase env vars missing in CI; using dummy client for build."
    );
    supabase = createClient("http://localhost:54321", "public-anon-key");
  } else {
    // Fuera de CI, lanzar error estricto
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
} else {
  // Variables presentes, crear cliente real
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
```

**Variables de entorno requeridas:**
- `NEXT_PUBLIC_SUPABASE_URL` (requerido fuera de CI, fallback dummy en CI)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (requerido fuera de CI, fallback dummy en CI)

**Uso del cliente:**
- `apps/web-next/app/panel/login/page.tsx:20` - `supabase.auth.signInWithPassword()`
- `apps/web-next/app/panel/page.tsx:58` - `supabase.auth.getSession()`
- `apps/web-next/lib/api.ts:22` - `supabase.auth.getSession()` para obtener access token

---

## 2. COMPATIBILIDAD CON sb_publishable / sb_secret

### 2.1. ¿El cliente usa Authorization header con la key?

**Respuesta:** NO. El cliente de `@supabase/supabase-js` NO usa el header `Authorization` para las API keys.

**Evidencia:**
- Las API keys (`SUPABASE_SERVICE_ROLE` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`) se pasan directamente al constructor `createClient(url, key)`
- El cliente internamente las usa para autenticar requests HTTP a la API de Supabase
- El header `Authorization` se usa SOLO para access tokens JWT (no para API keys)

**Evidencia de uso de Authorization header:**
- `apps/web-next/lib/api.ts:39` - `headers["Authorization"] = \`Bearer ${token}\``
- `functions/api/src/middlewares/panelAuth.ts:41` - `req.headers.authorization`
- El token JWT viene de `supabase.auth.getSession()` y se envía al backend para validación

### 2.2. Compatibilidad con sb_publishable / sb_secret

**Compatibilidad:** ✅ TOTAL

Los nuevos nombres de Supabase (`sb_publishable_...` y `sb_secret_...`) son simplemente strings que funcionan igual que los antiguos. El cliente `@supabase/supabase-js` no valida el formato del string, solo lo usa como header de autenticación.

**Mapeo:**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → puede ser `sb_publishable_...` (anon key del nuevo proyecto)
- `SUPABASE_SERVICE_ROLE` → puede ser `sb_secret_...` (service role key del nuevo proyecto)

**No requiere cambios de código**, solo actualizar las variables de entorno con los nuevos valores.

---

## 3. VARIABLES DE ENTORNO MÍNIMAS

### 3.1. Backend (`functions/api/.env`)

**Archivo de referencia:** No existe `.env.example`, pero las variables se leen en:
- `functions/api/src/services/supabase.ts:3-4`
- `functions/api/src/middlewares/cors.ts:3`

**Variables requeridas:**

```bash
# Supabase (REQUERIDO)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE=sb_secret_xxxxxxxxxxxxx

# CORS (opcional, default: http://localhost:3000)
FRONTEND_ORIGIN=http://localhost:3000
```

**Nota sobre CORS:**
- `functions/api/src/middlewares/cors.ts:3` - `const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";`
- Solo soporta UN origen (no array)
- Si Next.js corre en puerto 3001, actualizar `FRONTEND_ORIGIN=http://localhost:3001`

### 3.2. Frontend (`apps/web-next/.env`)

**Archivo de referencia:** No existe `.env.example`, pero las variables se leen en:
- `apps/web-next/lib/supabase.ts:11-12`

**Variables requeridas:**

```bash
# Supabase (REQUERIDO fuera de CI)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxx
```

**Nota sobre CI:**
- En CI (`process.env.CI === "true"`), si faltan estas vars, se crea un cliente dummy
- Fuera de CI, si faltan, se lanza error y el build falla

---

## 4. VALIDACIÓN SQL

### 4.1. Schema (`infra/sql/schema.sql`)

**Archivo:** `infra/sql/schema.sql`  
**Líneas:** 1-135

**Tablas definidas:**
1. ✅ `locals` (líneas 9-21) - Locales/venues
2. ✅ `promos` (líneas 24-34) - Promociones
3. ✅ `orders` (líneas 37-52) - Órdenes de entrada
4. ✅ `payment_events` (líneas 55-62) - Idempotencia de callbacks
5. ✅ `reservations` (líneas 65-79) - Reservas de bares (incluye `last_name` y `table_note`)
6. ✅ `events_public` (líneas 82-88) - Eventos públicos para tracking
7. ✅ `whatsapp_clicks` (líneas 91-97) - Clicks de WhatsApp
8. ✅ `profile_views` (líneas 100-107) - Vistas de perfil
9. ✅ `panel_users` (líneas 110-118) - Usuarios del panel B2B

**Tabla `panel_users` (crítica para Auth B2B):**
```sql
CREATE TABLE IF NOT EXISTS panel_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID NOT NULL UNIQUE, -- id del usuario en Supabase Auth
  email TEXT NOT NULL,
  local_id UUID NOT NULL REFERENCES locals(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Índices:** Todos los índices necesarios están definidos (líneas 120-134), incluyendo:
- `idx_panel_users_auth_user_id` (línea 132)
- `idx_panel_users_local_id` (línea 133)
- `idx_panel_users_email` (línea 134)

### 4.2. RLS (`infra/sql/rls.sql`)

**Archivo:** `infra/sql/rls.sql`  
**Líneas:** 1-71

**Estado:** RLS habilitado en todas las tablas, pero políticas son permisivas (`USING (true)`)  
**Nota:** Las políticas están marcadas como `TODO` y permiten acceso público. El backend usa `SUPABASE_SERVICE_ROLE` que bypassa RLS, así que esto no afecta la funcionalidad actual.

### 4.3. Seed (`infra/sql/seed.sql`)

**Archivo:** `infra/sql/seed.sql`  
**Líneas:** 1-78

**UUIDs de locales creados:**
- `550e8400-e29b-41d4-a716-446655440001` - "Bar Example 1" (línea 7)
- `550e8400-e29b-41d4-a716-446655440002` - "Club Example 2" (línea 17)

**Panel user:**
- El INSERT de `panel_users` está comentado (líneas 66-74)
- Requiere crear usuario en Supabase Auth primero y luego insertar con su `auth_user_id`

### 4.4. Orden de ejecución SQL

**Pasos exactos en SQL Editor de Supabase:**

1. **Ejecutar `infra/sql/schema.sql`**
   - Crea todas las tablas, índices y extensiones
   - **IMPORTANTE:** Ejecutar completo, no por partes

2. **Ejecutar `infra/sql/rls.sql`**
   - Habilita RLS en todas las tablas
   - Crea políticas (aunque sean permisivas por ahora)

3. **Ejecutar `infra/sql/seed.sql`**
   - Inserta 2 locales de prueba
   - Inserta 1 promo de ejemplo
   - Inserta 1 profile_view de ejemplo
   - **NO ejecuta** el INSERT de `panel_users` (está comentado)

4. **Crear usuario en Supabase Auth:**
   - Ir a Authentication > Users > Add user
   - Email: `panel@tairet.test` (o el que prefieras)
   - Password: (elegir una contraseña segura)
   - **Copiar el User UID** generado

5. **Insertar panel_user manualmente:**
   ```sql
   INSERT INTO panel_users (auth_user_id, email, local_id, role)
   VALUES
     (
       'REPLACE_WITH_AUTH_USER_ID', -- Reemplazar con el UUID del paso 4
       'panel@tairet.test',
       '550e8400-e29b-41d4-a716-446655440001', -- Local de prueba del seed
       'owner'
     )
   ON CONFLICT (auth_user_id) DO NOTHING;
   ```

---

## 5. CONFIGURACIÓN CORS

**Archivo:** `functions/api/src/middlewares/cors.ts`  
**Líneas:** 1-8

```typescript
import cors from "cors";

const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

export const corsMiddleware = cors({
  origin: frontendOrigin,
  credentials: true,
});
```

**Variables de entorno:**
- `FRONTEND_ORIGIN` (opcional, default: `http://localhost:3000`)

**Soporte de puertos:**
- ✅ Soporta `3000` (default)
- ✅ Soporta `3001` (si se setea `FRONTEND_ORIGIN=http://localhost:3001`)
- ⚠️ **NO soporta múltiples orígenes** (solo un string, no array)

**Uso en server:**
- `functions/api/src/server.ts:17` - `app.use(corsMiddleware);`

---

## 6. RESUMEN FINAL

### 6.1. Variables de entorno mínimas

#### Backend (`functions/api/.env`):
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE=sb_secret_xxxxxxxxxxxxx
FRONTEND_ORIGIN=http://localhost:3000
```

#### Frontend (`apps/web-next/.env`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxx
```

### 6.2. Orden de ejecución SQL

1. `infra/sql/schema.sql` (crear tablas)
2. `infra/sql/rls.sql` (habilitar RLS)
3. `infra/sql/seed.sql` (datos de prueba)
4. Crear usuario en Supabase Auth (Dashboard)
5. Insertar `panel_users` con el `auth_user_id` del paso 4

### 6.3. Archivos y líneas de referencia

| Concepto | Archivo | Líneas |
|----------|---------|--------|
| Backend Supabase client | `functions/api/src/services/supabase.ts` | 1-17 |
| Frontend Supabase client | `apps/web-next/lib/supabase.ts` | 1-34 |
| CORS config | `functions/api/src/middlewares/cors.ts` | 1-8 |
| Panel Auth middleware | `functions/api/src/middlewares/panelAuth.ts` | 34-89 |
| Schema SQL | `infra/sql/schema.sql` | 1-135 |
| RLS SQL | `infra/sql/rls.sql` | 1-71 |
| Seed SQL | `infra/sql/seed.sql` | 1-78 |

### 6.4. Compatibilidad con nuevos nombres de Supabase

✅ **Totalmente compatible** - Los nuevos nombres `sb_publishable_...` y `sb_secret_...` funcionan sin cambios de código. Solo actualizar las variables de entorno.

---

## 7. CHECKLIST DE CONFIGURACIÓN

- [ ] Crear proyecto nuevo en Supabase
- [ ] Copiar `Project URL` → `SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_URL`
- [ ] Copiar `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Copiar `service_role` key → `SUPABASE_SERVICE_ROLE`
- [ ] Ejecutar `infra/sql/schema.sql` en SQL Editor
- [ ] Ejecutar `infra/sql/rls.sql` en SQL Editor
- [ ] Ejecutar `infra/sql/seed.sql` en SQL Editor
- [ ] Crear usuario en Authentication > Users
- [ ] Insertar fila en `panel_users` con el `auth_user_id` del usuario
- [ ] Configurar `FRONTEND_ORIGIN` si Next.js corre en puerto diferente a 3000
- [ ] Probar login en `/panel/login` con el usuario creado

---

**Fin de auditoría**

