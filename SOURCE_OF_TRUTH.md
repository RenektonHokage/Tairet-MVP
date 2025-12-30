# SOURCE OF TRUTH — Tairet MVP (tairet-mono-2)

**Última actualización:** 2025-12-22  
**Monorepo:** PNPM workspace con backend Express+TS, panel Next.js 15, B2C Vite+React

---

## 1. ESTRUCTURA DEL REPO

### Directorios Top-Level

```
tairet-mono-2/
├── apps/
│   ├── web-b2c/          # Frontend B2C (Vite + React + TS + HashRouter)
│   └── web-next/          # Frontend Panel B2B (Next.js 15 App Router)
├── functions/
│   └── api/               # Backend Express + TypeScript
├── infra/
│   └── sql/               # Schema, RLS, Seed SQL
├── packages/
│   ├── ui/                # Componentes UI compartidos (Button, Card, cn)
│   └── types/             # Tipos TypeScript compartidos
├── scripts/
│   └── smoke.http         # Smoke tests (REST Client)
└── docs/
    └── docs/
        └── CHECKLIST_MVP_PANEL.md
```

**EVIDENCIA:** `package.json` raíz, `pnpm-workspace.yaml`

### Comandos para Levantar Local

```bash
# Backend API (Express)
pnpm -C functions/api dev
# → Puerto: 4000 (por defecto)

# Panel B2B (Next.js)
pnpm -C apps/web-next dev
# → Puerto: 3000 o 3001 (Next.js elige automáticamente)

# B2C (Vite)
pnpm -C apps/web-b2c dev
# → Puerto: 5173 (Vite default)

# Build completo
pnpm -r build

# Typecheck completo
pnpm -r typecheck
```

**EVIDENCIA:** `package.json` scripts en cada app

---

## 2. SUPABASE (Base de Datos)

### Archivos SQL en Repo

- **Schema:** `infra/sql/schema.sql`
- **RLS:** `infra/sql/rls.sql`
- **Seed:** `infra/sql/seed.sql`

**EVIDENCIA:** `infra/sql/` directory

### Tablas MVP (Relevantes)

#### `locals`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `name` TEXT NOT NULL
  - `slug` TEXT UNIQUE (ej: "mckharthys-bar", "morgan")
  - `type` TEXT NOT NULL CHECK (type IN ('bar', 'club')) ← **Diferenciación bar vs club**
  - `description`, `address`, `phone`, `whatsapp`, `email`
  - `ticket_price` DECIMAL(10, 2) NOT NULL DEFAULT 0
  - `created_at`, `updated_at` TIMESTAMPTZ

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `locals`)

#### `panel_users`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `auth_user_id` UUID NOT NULL UNIQUE (Supabase Auth UID)
  - `email` TEXT NOT NULL
  - `local_id` UUID NOT NULL REFERENCES locals(id)
  - `role` TEXT NOT NULL DEFAULT 'owner'
  - `created_at`, `updated_at` TIMESTAMPTZ

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `panel_users`)

#### `reservations`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `local_id` UUID NOT NULL REFERENCES locals(id)
  - `name` TEXT NOT NULL
  - `last_name` TEXT (opcional, agregado para alinearse con B2C)
  - `email` TEXT NOT NULL
  - `phone` TEXT NOT NULL
  - `date` TIMESTAMPTZ NOT NULL
  - `guests` INTEGER NOT NULL CHECK (guests > 0)
  - `status` TEXT NOT NULL DEFAULT 'en_revision' CHECK (status IN ('en_revision', 'confirmed', 'cancelled'))
  - `notes` TEXT (comentario del cliente)
  - `table_note` TEXT (nota interna del local, ej: "Mesa X / cerca ventana")
  - `created_at`, `updated_at` TIMESTAMPTZ

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `reservations`)

#### `promos`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `local_id` UUID NOT NULL REFERENCES locals(id)
  - `title` TEXT NOT NULL
  - `description` TEXT
  - `image_url` TEXT
  - `start_date`, `end_date` TIMESTAMPTZ
  - `created_at`, `updated_at` TIMESTAMPTZ

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `promos`)

#### `local_daily_ops`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `local_id` UUID NOT NULL REFERENCES locals(id)
  - `day` DATE NOT NULL (día local, sin hora)
  - `is_open` BOOLEAN NOT NULL DEFAULT true
  - `note` TEXT (nota corta del día, ej: "Halloween", "Privado")
  - `created_at`, `updated_at` TIMESTAMPTZ
  - **UNIQUE:** `(local_id, day)`

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `local_daily_ops`)

#### `orders`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `local_id` UUID NOT NULL REFERENCES locals(id)
  - `quantity` INTEGER NOT NULL CHECK (quantity > 0)
  - `total_amount` DECIMAL(10, 2) NOT NULL
  - `currency` TEXT NOT NULL DEFAULT 'PYG'
  - `status` TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled'))
  - `payment_method`, `transaction_id` TEXT
  - `used_at` TIMESTAMPTZ (check-in manual, MVP sin QR)
  - `customer_email`, `customer_name`, `customer_phone` TEXT
  - `created_at`, `updated_at` TIMESTAMPTZ

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `orders`)

#### `events_public`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `type` TEXT NOT NULL (ej: "promo_open", "profile_view")
  - `local_id` UUID REFERENCES locals(id)
  - `metadata` JSONB
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `events_public`)

#### `whatsapp_clicks`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `local_id` UUID NOT NULL REFERENCES locals(id)
  - `phone` TEXT
  - `metadata` JSONB
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `whatsapp_clicks`)

#### `profile_views`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `local_id` UUID NOT NULL REFERENCES locals(id)
  - `ip_address` TEXT
  - `user_agent` TEXT
  - `source` TEXT
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `profile_views`)

#### `payment_events`
- **Columnas clave:**
  - `id` UUID PRIMARY KEY
  - `order_id` UUID REFERENCES orders(id)
  - `transaction_id` TEXT NOT NULL UNIQUE (idempotencia)
  - `status` TEXT NOT NULL
  - `payload` JSONB
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

**EVIDENCIA:** `infra/sql/schema.sql` (tabla `payment_events`)

### Seed Data (MVP Locals)

**Mapeo slug → id → type (5 locales MVP):**

| Slug | UUID (id) | Type | Nombre |
|------|-----------|------|--------|
| `mckharthys-bar` | `550e8400-e29b-41d4-a716-446655440001` | `bar` | Mckharthys Bar |
| `killkenny-pub` | `550e8400-e29b-41d4-a716-446655440003` | `bar` | Killkenny Pub |
| `morgan` | `550e8400-e29b-41d4-a716-446655440004` | `club` | Morgan |
| `celavie` | `550e8400-e29b-41d4-a716-446655440005` | `club` | Celavie |
| `dlirio` | `550e8400-e29b-41d4-a716-446655440006` | `club` | DLirio |


**EVIDENCIA:** `infra/sql/seed.sql`, `apps/web-b2c/src/lib/mvpSlugs.ts`

### Promos en Seed

- **Mckharthys Bar:** 1 promo ("Promo de Prueba", UUID: `72dd49e1-2472-4f7c-9376-ef622af05daf`)
- **Morgan:** 3 promos (Ladies Night, Happy Hour, Student Night)
- **Celavie:** 3 promos (Ladies Night, Happy Hour, Student Night)
- **DLirio:** 3 promos (Bailongo - Sole Rössner, Tragos Fresh, La Fórmula Perfecta)

**EVIDENCIA:** `infra/sql/seed.sql` (promos para clubs MVP)

### RLS (Row Level Security)

**RLS Status por Tabla:**
- **RLS habilitado (true):** `events_public`, `locals`, `orders`, `promos`, `reservations`, `whatsapp_clicks`, `profile_views`, `local_daily_ops`
- **RLS deshabilitado (false):** `panel_users`

**Políticas por Tabla (según evidencia de `pg_policies`):**

- **`events_public`:**
  - `events_public_insert_public` (INSERT, público)
  - `events_public_select_by_local` (SELECT, filtrado por local)

- **`orders`:**
  - `orders_insert_by_local` (INSERT, validar local)
  - `orders_select_by_local` (SELECT, filtrado por local)

- **`promos`:**
  - `promos_select_by_local` (SELECT, filtrado por local)

- **`reservations`:**
  - `reservations_insert_public` (INSERT, público)
  - `reservations_select_by_local` (SELECT, filtrado por local)

**Nota:** Políticas actuales usan `USING (true)` (permiten todo). **PENDIENTE:** Ajustar políticas según `auth.uid()` cuando se implemente multi-tenant real.

**EVIDENCIA:** `infra/sql/rls.sql`, queries `pg_policies` en Supabase

### Orden de Ejecución SQL

1. `infra/sql/schema.sql` (crear tablas)
2. `infra/sql/rls.sql` (habilitar RLS y políticas)
3. `infra/sql/seed.sql` (insertar datos)
4. **Manual:** Crear usuario en Supabase Auth (Authentication > Users)
5. **Manual:** Insertar en `panel_users` con `auth_user_id` del paso 4

**EVIDENCIA:** `infra/sql/seed.sql` (comentarios sobre creación de usuario)

---

## 3. BACKEND API (functions/api)

### Entrypoint

- **Archivo:** `functions/api/src/server.ts`
- **Puerto:** 4000 (por defecto)
- **Framework:** Express + TypeScript

**EVIDENCIA:** `functions/api/src/server.ts`

### Middlewares (Orden de Aplicación)

1. `corsMiddleware` (CORS multi-origin)
2. `requestId` (request ID para logging)
3. `express.json()` (parse JSON body)
4. `errorHandler` (último, manejo de errores)

**EVIDENCIA:** `functions/api/src/server.ts:17-20, 46-47`

### CORS

- Soporta múltiples origins separados por coma (`FRONTEND_ORIGIN`)
- Defaults si `FRONTEND_ORIGIN` vacío: `localhost:3000, 3001, 5173` (+ 127.0.0.1 equivalents)
- Preflight OPTIONS responde `204`
- Headers: `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`, `Access-Control-Allow-Credentials: true`

**EVIDENCIA:** `functions/api/src/middlewares/cors.ts`

### Endpoints Públicos (Sin Auth)

#### `GET /public/locals/by-slug/:slug`
- **Propósito:** Resolver slug → local_id para B2C
- **Auth:** Ninguna
- **Validación:** Slug con Zod (min 1, max 100, regex `^[a-z0-9-]+$`)
- **Response 200:**
  ```json
  {
    "id": "uuid",
    "slug": "morgan",
    "name": "Morgan",
    "whatsapp": "+595983456789",
    "ticket_price": 50000,
    "type": "club"
  }
  ```
- **Response 404:** `{ "error": "LOCAL_NOT_FOUND" }`

**EVIDENCIA:** `functions/api/src/routes/public.ts:16-81`

### Endpoints de Tracking (Sin Auth)

#### `POST /events/profile_view`
- **Auth:** Ninguna
- **Payload (Zod):**
  ```typescript
  {
    local_id: string (UUID),
    ip_address?: string,
    user_agent?: string,
    source?: string
  }
  ```
- **Response:** `201 { ok: true }`
- **Tabla:** `profile_views`

**EVIDENCIA:** `functions/api/src/routes/events.ts:111-140`

#### `POST /events/whatsapp_click`
- **Auth:** Ninguna
- **Payload (Zod):**
  ```typescript
  {
    local_id: string (UUID),
    phone?: string,
    source?: string
  }
  ```
- **Response:** `201 { ok: true }`
- **Tabla:** `whatsapp_clicks`

**EVIDENCIA:** `functions/api/src/routes/events.ts:22-49`

#### `POST /events/promo_open`
- **Auth:** Ninguna
- **Payload (Zod):**
  ```typescript
  {
    promo_id: string (UUID),
    local_id: string (UUID),
    source?: string
  }
  ```
- **Response:** `201 { ok: true }`
- **Tabla:** `events_public` (type: "promo_open", metadata: { promo_id, source })

**EVIDENCIA:** `functions/api/src/routes/events.ts:75-109`

#### `GET /events/whatsapp_clicks/count`
- **Auth:** Ninguna
- **Query:** `?localId=uuid`
- **Response:** `200 { local_id: "uuid", count: number }`

**EVIDENCIA:** `functions/api/src/routes/events.ts:51-73`

### Endpoints de Reservas

#### `POST /reservations`
- **Auth:** Ninguna
- **Payload (Zod):**
  ```typescript
  {
    local_id: string (UUID),
    name: string,
    last_name?: string,
    email: string,
    phone: string,
    date: string (ISO datetime),
    guests: number,
    notes?: string,
    table_note?: string
  }
  ```
- **Response:** `201` (reserva creada con status: "en_revision")
- **Email:** Envía email de confirmación (fire-and-forget)

**EVIDENCIA:** `functions/api/src/routes/reservations.ts:12-52`

#### `PATCH /reservations/:id`
- **Auth:** Ninguna (público, pero debería ser panelAuth)
- **Payload (Zod):**
  ```typescript
  {
    status?: "confirmed" | "cancelled",
    table_note?: string | null
  }
  ```
- **Validación:** Solo se puede cambiar status si está en "en_revision"
- **Response:** `200` (reserva actualizada)
- **Email:** Si status → "confirmed", envía email de confirmación

**EVIDENCIA:** `functions/api/src/routes/reservations.ts:54-146`

#### `GET /locals/:id/reservations`
- **Auth:** `panelAuth` (Bearer token)
- **Multi-tenant:** Valida que `id` === `req.panelUser.localId`
- **Response:** `200` (array de reservas, limit 20, ordenadas por `created_at DESC`)

**EVIDENCIA:** `functions/api/src/routes/reservations.ts:148-190`

### Endpoints del Panel (Requieren `panelAuth`)

#### `GET /panel/me`
- **Auth:** `panelAuth`
- **Response:** `200 { local_id: "uuid", email: "string", role: "string" }`

**EVIDENCIA:** `functions/api/src/routes/panel.ts:10-21`

#### `GET /panel/calendar/month?month=YYYY-MM`
- **Auth:** `panelAuth`
- **Response:** `200` con días del mes con contadores:
  ```json
  {
    "local_id": "uuid",
    "month": "2024-12",
    "days": [
      {
        "day": "2024-12-01",
        "reservations_total": 3,
        "reservations_en_revision": 1,
        "reservations_confirmed": 2,
        "reservations_cancelled": 0,
        "orders_paid": 5,
        "promo_opens": 2,
        "is_open": true,
        "note": null
      }
    ]
  }
  ```

**EVIDENCIA:** `functions/api/src/routes/calendar.ts:14-205`

#### `GET /panel/calendar/day?day=YYYY-MM-DD`
- **Auth:** `panelAuth`
- **Response:** `200` con detalle del día:
  ```json
  {
    "local_id": "uuid",
    "day": "2024-12-01",
    "operation": { "is_open": true, "note": null },
    "reservations": [...],
    "orders_summary": { "count": 5, "total": 250000 }
  }
  ```

**EVIDENCIA:** `functions/api/src/routes/calendar.ts:207-310`

#### `PATCH /panel/calendar/day`
- **Auth:** `panelAuth`
- **Payload (Zod):**
  ```typescript
  {
    day: string (YYYY-MM-DD),
    is_open?: boolean,
    note?: string | null
  }
  ```
- **Response:** `200` (operación actualizada)
- **Tabla:** `local_daily_ops` (upsert por `local_id, day`)

**EVIDENCIA:** `functions/api/src/routes/calendar.ts:312-380`

#### `GET /activity`
- **Auth:** `panelAuth`
- **Query:** `?localId=uuid` (ignorado, usa `req.panelUser.localId`)
- **Response:** `200` (array de actividades: orders, reservations, whatsapp_clicks, promo_opens, profile_views)

**EVIDENCIA:** `functions/api/src/routes/activity.ts:30-281`

#### `GET /metrics/summary`
- **Auth:** `panelAuth`
- **Query:** `?from=ISO&to=ISO` (opcional, default: últimos 30 días)
- **Response:** `200` con KPIs:
  ```json
  {
    "local_id": "uuid",
    "range": { "from": "ISO", "to": "ISO" },
    "kpis": {
      "whatsapp_clicks": 10,
      "profile_views": 50,
      "reservations_total": 5,
      "reservations_en_revision": 2,
      "reservations_confirmed": 3,
      "reservations_cancelled": 0,
      "orders_total": 20,
      "tickets_sold": 40,
      "tickets_used": 10,
      "revenue_paid": 2000000,
      "top_promo": { "id": "uuid", "title": "Ladies Night", "view_count": 15 }
    }
  }
  ```

**EVIDENCIA:** `functions/api/src/routes/metrics.ts:15-240`

#### `GET /locals/:id/promos`
- **Auth:** `panelAuth`
- **Multi-tenant:** Valida que `id` === `req.panelUser.localId`
- **Response:** `200` (array de promos con `view_count` calculado desde `events_public`)

**EVIDENCIA:** `functions/api/src/routes/promos.ts:10-79`

#### `POST /locals/:id/promos`
- **Auth:** `panelAuth`
- **Multi-tenant:** Valida que `id` === `req.panelUser.localId`
- **Payload (Zod):**
  ```typescript
  {
    title: string,
    description?: string,
    image_url: string,
    start_date?: string (ISO),
    end_date?: string (ISO)
  }
  ```
- **Response:** `201` (promo creada)

**EVIDENCIA:** `functions/api/src/routes/promos.ts:81-130`

### Endpoints de Órdenes

#### `POST /orders`
- **Auth:** Ninguna
- **Payload (Zod):**
  ```typescript
  {
    local_id: string (UUID),
    quantity: number,
    total_amount: number,
    currency?: string (default: "PYG"),
    customer_email?: string,
    customer_name?: string,
    customer_phone?: string
  }
  ```
- **Response:** `201` (orden creada con status: "pending")

**EVIDENCIA:** `functions/api/src/routes/orders.ts:8-37`

#### `GET /orders/:id`
- **Auth:** Ninguna
- **Response:** `200` (orden completa)

**EVIDENCIA:** `functions/api/src/routes/orders.ts:39-50`

#### `PATCH /orders/:id/use`
- **Auth:** Ninguna (check-in manual)
- **Response:** `200` (orden actualizada con `used_at`)

**EVIDENCIA:** `functions/api/src/routes/orders.ts` (buscar "use")

### Middleware `panelAuth`

- **Archivo:** `functions/api/src/middlewares/panelAuth.ts`
- **Funcionamiento:**
  1. Lee `Authorization: Bearer <token>` del header
  2. Valida token con Supabase Auth (`supabase.auth.getUser()`)
  3. Busca usuario en `panel_users` por `auth_user_id`
  4. Adjunta `req.panelUser` con `{ userId, email, localId, role }`
- **Multi-tenant:** Todos los endpoints del panel usan `req.panelUser.localId` (nunca piden `localId` en query/body)

**EVIDENCIA:** `functions/api/src/middlewares/panelAuth.ts`

### Health Check

#### `GET /health`
- **Response:** `200 { ok: true }`

**EVIDENCIA:** `functions/api/src/server.ts:23-25`

---

## 4. FRONTEND PANEL B2B (apps/web-next)

### Stack

- **Framework:** Next.js 15 (App Router)
- **Auth:** Supabase Auth
- **Estado:** React hooks + TanStack Query (opcional)
- **UI:** Tailwind CSS + shadcn/ui

**EVIDENCIA:** `apps/web-next/package.json`, `apps/web-next/app/`

### Páginas Clave

#### `/panel/login`
- **Archivo:** `apps/web-next/app/panel/login/page.tsx`
- **Funcionalidad:** Login con Supabase Auth (email/password)
- **Post-login:** Redirige a `/panel`

**EVIDENCIA:** `apps/web-next/app/panel/login/`

#### `/panel`
- **Archivo:** `apps/web-next/app/panel/page.tsx`
- **Funcionalidad:**
  - Obtiene `localId` desde `/panel/me` (usando `getPanelUserInfo()`)
  - Muestra métricas: KPIs, reservas, promos, actividad
  - Permite editar `table_note` de reservas
  - Permite cambiar status de reservas (solo si `en_revision`)

**EVIDENCIA:** `apps/web-next/app/panel/page.tsx`

#### `/panel/calendar`
- **Archivo:** `apps/web-next/app/panel/calendar/page.tsx`
- **Funcionalidad:**
  - Vista mensual con días con actividad
  - Detalle diario: reservas, órdenes, operación (is_open/note)
  - Toggle abierto/cerrado por día
  - Notas por día

**EVIDENCIA:** `apps/web-next/app/panel/calendar/page.tsx`

### Multi-Tenant

- **Obtiene `localId`:** Desde `/panel/me` después de login
- **No pide `localId` manual:** Todos los requests usan `req.panelUser.localId` del backend
- **Auth:** Supabase Auth + `panel_users` table

**EVIDENCIA:** `apps/web-next/lib/panel.ts`, `apps/web-next/app/panel/page.tsx:22-24`

### Métricas Mostradas

- WhatsApp clicks
- Profile views
- Reservas (total, en_revision, confirmed, cancelled)
- Órdenes (total, tickets_sold, tickets_used, revenue_paid)
- Promo más vista (top_promo con view_count)

**EVIDENCIA:** `apps/web-next/app/panel/page.tsx:48-50`, `apps/web-next/lib/metrics.ts`

### Variables de Entorno

- `NEXT_PUBLIC_SUPABASE_URL` (requerido, excepto en CI)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (requerido, excepto en CI)
- `API_URL` (opcional, default: `http://localhost:4000`)

**EVIDENCIA:** `apps/web-next/lib/supabase.ts`, `apps/web-next/lib/api.ts`

---

## 5. FRONTEND B2C (apps/web-b2c)

### Stack

- **Framework:** Vite + React + TypeScript
- **Router:** HashRouter (`#/bar/:barId`, `#/club/:clubId`)
- **UI:** Tailwind CSS + shadcn/ui
- **Estado:** React hooks + TanStack Query

**EVIDENCIA:** `apps/web-b2c/src/App.tsx`, `apps/web-b2c/vite.config.ts`

### Rutas Principales

- `#/` → Landing (Index)
- `#/bar/:barId` → Perfil de bar (ej: `#/bar/mckharthys-bar`)
- `#/club/:clubId` → Perfil de club (ej: `#/club/morgan`)
- `#/reservar/:barId` → Formulario de reserva (solo bares)
- `#/zona/asuncion` → Listado de locales por zona
- `#/zona/san-bernardino` → Listado de locales por zona
- `#/zona/ciudad-del-este` → Listado de locales por zona
- `#/bares` → Listado de bares
- `#/discotecas` → Listado de clubs

**EVIDENCIA:** `apps/web-b2c/src/App.tsx:54-100`

### Slugs MVP

- **Bares:** `mckharthys-bar`, `killkenny-pub`
- **Clubs:** `morgan`, `celavie`, `dlirio`

**EVIDENCIA:** `apps/web-b2c/src/lib/mvpSlugs.ts`

### Utilidades

#### `slugify(name: string): string`
- Convierte nombre a slug consistente (lowercase, guiones, sin espacios)
- **Uso:** Generar slugs desde nombres de locales

**EVIDENCIA:** `apps/web-b2c/src/lib/slug.ts`

#### `getLocalBySlug(slug: string)`
- **Archivo:** `apps/web-b2c/src/lib/locals.ts`
- **Funcionalidad:** Llama `GET /public/locals/by-slug/:slug` para resolver `local_id` real
- **Uso:** En `BarProfile.tsx` y `ClubProfile.tsx` para obtener `localId` desde slug

**EVIDENCIA:** `apps/web-b2c/src/lib/locals.ts`

### Tracking (Fire-and-Forget)

#### `trackProfileView(localId, metadata?)`
- **Endpoint:** `POST /events/profile_view`
- **Dedupe:** `sessionStorage` con key `profile_view:${localId}` (una vez por sesión)
- **Uso:** En `BarProfile.tsx` y `ClubProfile.tsx` (hook `useProfileViewOnce`)

**EVIDENCIA:** `apps/web-b2c/src/lib/api.ts:16-30`, `apps/web-b2c/src/hooks/useProfileViewOnce.ts`

#### `trackWhatsappClick(localId, phone?, source?)`
- **Endpoint:** `POST /events/whatsapp_click`
- **Uso:** En botones "Reservar por WhatsApp" (bares y clubs)
- **Fire-and-forget:** No bloquea `window.open(wa.me/...)`

**EVIDENCIA:** `apps/web-b2c/src/lib/api.ts:32-50`

#### `trackPromoOpen(localId, promoId, source?)`
- **Endpoint:** `POST /events/promo_open`
- **Validación:** `promoId` debe ser UUID válido (si no, no envía request)
- **Dedupe:** `sessionStorage` con key `promo_open:${localId}:${promoId}`
- **Mapeo:** `getRealPromoId({ localSlug, title, fallbackId })` mapea título mock → UUID real
- **Uso:** En `BarPromotions.tsx` y `ClubPromotions.tsx`

**EVIDENCIA:** `apps/web-b2c/src/lib/api.ts:59-110`, `apps/web-b2c/src/lib/promoIdMap.ts`

### Reservas

#### Formulario de Reserva (`#/reservar/:barId`)
- **Archivo:** `apps/web-b2c/src/pages/ReservaForm.tsx`
- **Campos:** Nombre, Apellido, Email, Teléfono, Personas, Fecha, Horario, Comentario
- **Endpoint:** `POST /reservations`
- **Payload:** Combina Fecha + Horario en ISO datetime

**EVIDENCIA:** `apps/web-b2c/src/pages/ReservaForm.tsx`

### Sin Fallbacks Silenciosos

- Si slug no existe en DB → `404` (redirige a `/404`)
- Si slug no tiene mock data → `404`
- Si `type` no coincide (bar vs club) → `404`

**EVIDENCIA:** `apps/web-b2c/src/pages/BarProfile.tsx:69-108`, `apps/web-b2c/src/pages/ClubProfile.tsx:204-244`

### Variables de Entorno

- `VITE_API_URL` (opcional, default: `http://localhost:4000`)

**EVIDENCIA:** `apps/web-b2c/src/lib/api.ts:5`, `apps/web-b2c/src/constants.ts`

---

## 6. VARIABLES DE ENTORNO

### Backend (functions/api)

**Archivo:** `functions/api/.env.example` (NO ENCONTRADO - verificar manualmente)

**Variables requeridas:**
- `SUPABASE_URL` (requerido)
- `SUPABASE_SERVICE_ROLE` (requerido, puede ser `sb_secret_...`)
- `FRONTEND_ORIGIN` (opcional, lista separada por coma, ej: `http://localhost:3000,http://localhost:3001`)

**EVIDENCIA:** `functions/api/src/services/supabase.ts:3-4`, `functions/api/src/middlewares/cors.ts:7`

### Panel B2B (apps/web-next)

**Archivo:** `apps/web-next/.env.example` (NO ENCONTRADO - verificar manualmente)

**Variables requeridas:**
- `NEXT_PUBLIC_SUPABASE_URL` (requerido, excepto en CI, puede ser URL con `sb_publishable_...`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (requerido, excepto en CI, puede ser `sb_publishable_...`)
- `API_URL` (opcional, default: `http://localhost:4000`)

**EVIDENCIA:** `apps/web-next/lib/supabase.ts:11-12`, `apps/web-next/lib/api.ts`

### B2C (apps/web-b2c)

**Archivo:** `apps/web-b2c/.env.example` (NO ENCONTRADO - verificar manualmente)

**Variables requeridas:**
- `VITE_API_URL` (opcional, default: `http://localhost:4000`)

**EVIDENCIA:** `apps/web-b2c/src/lib/api.ts:5`

---

## 7. ESTADO ACTUAL vs PENDIENTES

### ✅ IMPLEMENTADO

#### Backend
- ✅ Endpoints públicos: `/public/locals/by-slug/:slug`
- ✅ Tracking: `profile_view`, `whatsapp_click`, `promo_open`
- ✅ Reservas: `POST /reservations`, `PATCH /reservations/:id`, `GET /locals/:id/reservations`
- ✅ Panel: `/panel/me`, `/panel/calendar/*`, `/activity`, `/metrics/summary`, `/locals/:id/promos`
- ✅ Multi-tenant: `panelAuth` middleware con `req.panelUser.localId`
- ✅ CORS multi-origin
- ✅ Validación Zod en todos los endpoints
- ✅ Email de reservas (fire-and-forget)

**EVIDENCIA:** `functions/api/src/routes/`, `functions/api/src/middlewares/panelAuth.ts`

#### Frontend Panel
- ✅ Login con Supabase Auth
- ✅ Dashboard con métricas y reservas
- ✅ Calendario mensual con operación diaria
- ✅ Edición de `table_note` en reservas
- ✅ Cambio de status de reservas

**EVIDENCIA:** `apps/web-next/app/panel/`

#### Frontend B2C
- ✅ Resolución slug → local_id vía API
- ✅ Tracking `profile_view` (dedupe por sesión)
- ✅ Tracking `whatsapp_click` (fire-and-forget)
- ✅ Tracking `promo_open` (dedupe por sesión, mapeo mock → UUID real)
- ✅ Formulario de reservas (bares)
- ✅ Sin fallbacks silenciosos (404 si no existe)
- ✅ Diferenciación bar vs club por `locals.type`

**EVIDENCIA:** `apps/web-b2c/src/pages/`, `apps/web-b2c/src/lib/`

#### Base de Datos
- ✅ Schema completo con todas las tablas MVP
- ✅ Seed con 5 locales MVP (2 bares, 3 clubs)
- ✅ Seed con promos reales (10 promos total)
- ✅ RLS habilitado (políticas pendientes de ajustar)

**EVIDENCIA:** `infra/sql/`

### ❌ NO IMPLEMENTADO / PENDIENTE

#### Panel por Tipo (Bar vs Club)
- ❌ UI gating: mostrar/ocultar secciones según `locals.type`
- ❌ Bares: mostrar reservas, ocultar tickets
- ❌ Clubs: mostrar tickets, ocultar reservas

**EVIDENCIA:** NO ENCONTRADO (no existe código que condicione UI por `type`)

#### Free Pass (Tickets Gratis)
- ❌ Endpoint para crear orden con `total_amount = 0`
- ❌ Envío de email con "ticket gratis" (sin QR, solo confirmación)
- ❌ Check-in manual desde panel (ya existe `PATCH /orders/:id/use`)

**EVIDENCIA:** NO ENCONTRADO (no existe lógica específica para free pass)

#### Pagos Reales
- ❌ Integración con Bancard
- ❌ Integración con Dinelco
- ❌ Callback de pago real (existe endpoint `/payments/callback` pero es mock)

**EVIDENCIA:** `functions/api/src/routes/payments.ts` (verificar si es mock)

#### QR Codes
- ❌ Generación de QR codes para tickets
- ❌ Escaneo de QR desde panel (check-in)
- ❌ Validación de QR (verificar que no se use dos veces)

**EVIDENCIA:** NO ENCONTRADO

#### Analytics Real (GA4 / PostHog)
- ❌ Instrumentación GA4 en B2C
- ❌ Instrumentación PostHog en B2C
- ❌ Eventos custom: `profile_view`, `whatsapp_click`, `promo_open`, `reservation_created`

**EVIDENCIA:** `apps/web-next/lib/posthog.ts` (existe pero verificar si está conectado)

#### Hardening
- ❌ Rate limiting (express-rate-limit)
- ❌ Helmet (security headers)
- ❌ Logging estructurado (Pino/Winston)
- ❌ Monitoreo (Sentry existe pero verificar configuración)

**EVIDENCIA:** `apps/web-next/lib/sentry.ts` (existe pero verificar)

#### RLS Políticas Reales
- ❌ Ajustar políticas RLS para usar `auth.uid()` y filtrar por `local_id` del usuario

**EVIDENCIA:** `infra/sql/rls.sql` (políticas marcadas como `USING (true)`)

---

## 8. CHECKLIST QA MANUAL

### Preparación

1. **Levantar servicios:**
   ```bash
   # Terminal 1: Backend
   pnpm -C functions/api dev
   
   # Terminal 2: Panel
   pnpm -C apps/web-next dev
   
   # Terminal 3: B2C
   pnpm -C apps/web-b2c dev
   ```

2. **Verificar Supabase:**
   - Ejecutar `infra/sql/schema.sql`
   - Ejecutar `infra/sql/rls.sql`
   - Ejecutar `infra/sql/seed.sql`
   - Crear usuario en Supabase Auth
   - Insertar en `panel_users`

### Requests Públicos (REST Client / curl)

#### Health Check
```http
GET http://localhost:4000/health
Expected: 200 { "ok": true }
```

#### Resolver Slug → Local
```http
GET http://localhost:4000/public/locals/by-slug/morgan
Expected: 200 { "id": "550e8400-e29b-41d4-a716-446655440004", "slug": "morgan", "type": "club", ... }

GET http://localhost:4000/public/locals/by-slug/local-inexistente
Expected: 404 { "error": "LOCAL_NOT_FOUND" }
```

#### Tracking
```http
POST http://localhost:4000/events/profile_view
Content-Type: application/json
{
  "local_id": "550e8400-e29b-41d4-a716-446655440004",
  "source": "b2c_web"
}
Expected: 201 { "ok": true }

POST http://localhost:4000/events/whatsapp_click
Content-Type: application/json
{
  "local_id": "550e8400-e29b-41d4-a716-446655440004",
  "phone": "+595983456789",
  "source": "club_table_intent"
}
Expected: 201 { "ok": true }

POST http://localhost:4000/events/promo_open
Content-Type: application/json
{
  "promo_id": "a1b2c3d4-e5f6-4789-a012-345678901234",
  "local_id": "550e8400-e29b-41d4-a716-446655440004",
  "source": "club_promo_card"
}
Expected: 201 { "ok": true }
```

#### Reservas
```http
POST http://localhost:4000/reservations
Content-Type: application/json
{
  "local_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Juan Pérez",
  "last_name": "González",
  "email": "juan@example.com",
  "phone": "+595981234567",
  "date": "2024-12-25T20:00:00Z",
  "guests": 4,
  "notes": "Mesa cerca de la ventana"
}
Expected: 201 (reserva creada con status: "en_revision")
```

### URLs B2C (Browser)

#### Perfiles de Locales
- `http://localhost:5173/#/bar/mckharthys-bar` → Debe renderizar perfil de bar
- `http://localhost:5173/#/club/morgan` → Debe renderizar perfil de club
- `http://localhost:5173/#/club/local-inexistente` → Debe redirigir a 404

#### Tracking en DevTools Network
1. Abrir `http://localhost:5173/#/club/morgan`
2. Verificar: `POST /events/profile_view` (status 201, solo una vez por recarga)
3. Click en "Reservar mesa" → Verificar: `POST /events/whatsapp_click` (status 201)
4. Click en promo "Ladies Night" → Verificar: `POST /events/promo_open` (status 201, con `promo_id` UUID real)
5. Click en la misma promo otra vez → NO debe aparecer otro request (dedupe)

#### Reservas
- `http://localhost:5173/#/reservar/mckharthys-bar` → Debe mostrar formulario
- Enviar reserva → Verificar en Network: `POST /reservations` (status 201)

### URLs Panel B2B (Browser)

#### Login
1. `http://localhost:3000/panel/login`
2. Login con usuario de Supabase Auth
3. Verificar redirección a `/panel`

#### Dashboard
1. `http://localhost:3000/panel`
2. Verificar: Métricas cargan (KPIs, reservas, promos)
3. Verificar: `GET /panel/me` en Network (status 200, con `local_id`)

#### Calendario
1. `http://localhost:3000/panel/calendar`
2. Verificar: Grid mensual con días con actividad
3. Click en un día → Verificar: Detalle del día (reservas, órdenes, operación)
4. Toggle "Abierto/Cerrado" → Verificar: `PATCH /panel/calendar/day` (status 200)
5. Agregar nota → Verificar: Persiste al recargar

#### Reservas
1. En `/panel`, sección "Reservas"
2. Verificar: Lista de reservas del local (solo del `local_id` del usuario)
3. Editar `table_note` → Verificar: `PATCH /reservations/:id` (status 200)
4. Cambiar status a "confirmed" → Verificar: Solo funciona si status es "en_revision"

### Validación Multi-Tenant

1. Login como usuario de `mckharthys-bar` (`local_id: 550e8400-e29b-41d4-a716-446655440001`)
2. Verificar: `/panel/me` devuelve `local_id: 550e8400-e29b-41d4-a716-446655440001`
3. Verificar: `/locals/550e8400-e29b-41d4-a716-446655440001/reservations` funciona
4. Verificar: `/locals/550e8400-e29b-41d4-a716-446655440004/reservations` devuelve 403 (Forbidden)

**EVIDENCIA:** `functions/api/src/middlewares/panelAuth.ts`, `functions/api/src/routes/reservations.ts:164-167`

---

## 9. MAPEO SLUG → LOCAL_ID (MVP)

| Slug | UUID (local_id) | Type | Nombre |
|------|----------------|------|--------|
| `mckharthys-bar` | `550e8400-e29b-41d4-a716-446655440001` | `bar` | Mckharthys Bar |
| `killkenny-pub` | `550e8400-e29b-41d4-a716-446655440003` | `bar` | Killkenny Pub |
| `morgan` | `550e8400-e29b-41d4-a716-446655440004` | `club` | Morgan |
| `celavie` | `550e8400-e29b-41d4-a716-446655440005` | `club` | Celavie |
| `dlirio` | `550e8400-e29b-41d4-a716-446655440006` | `club` | DLirio |

**EVIDENCIA:** `infra/sql/seed.sql` (locals MVP)

---

## 10. MAPEO PROMO MOCK → UUID REAL

**Archivo:** `apps/web-b2c/src/lib/promoIdMap.ts`

**Formato de key:** `${localSlug}:${title}`

| Key | UUID Real |
|-----|-----------|
| `morgan:Ladies Night` | `a1b2c3d4-e5f6-4789-a012-345678901234` |
| `morgan:Happy Hour` | `b2c3d4e5-f6a7-4890-b123-456789012345` |
| `morgan:Student Night` | `c3d4e5f6-a7b8-4901-c234-567890123456` |
| `celavie:Ladies Night` | `d4e5f6a7-b8c9-4012-d345-678901234567` |
| `celavie:Happy Hour` | `e5f6a7b8-c9d0-4123-e456-789012345678` |
| `celavie:Student Night` | `f6a7b8c9-d0e1-4234-f567-890123456789` |
| `dlirio:Bailongo - Sole Rössner` | `a7b8c9d0-e1f2-4345-a678-901234567890` |
| `dlirio:Tragos Fresh` | `b8c9d0e1-f2a3-4456-b789-012345678901` |
| `dlirio:La Fórmula Perfecta` | `c9d0e1f2-a3b4-4567-c890-123456789012` |

**EVIDENCIA:** `apps/web-b2c/src/lib/promoIdMap.ts`, `infra/sql/seed.sql` (promos)

---

## 11. NOTAS IMPORTANTES

### Diferenciación Bar vs Club

- **DB:** Columna `locals.type` con CHECK (`'bar'` | `'club'`)
- **Backend:** Endpoint `/public/locals/by-slug/:slug` devuelve `type`
- **B2C:** `BarProfile.tsx` valida `type === "bar"`, `ClubProfile.tsx` valida `type === "club"`
- **UI:** Bares muestran formulario de reservas, clubs muestran tickets/mesas

**EVIDENCIA:** `infra/sql/schema.sql` (locals.type), `functions/api/src/routes/public.ts`, `apps/web-b2c/src/pages/BarProfile.tsx`

### Tracking Fire-and-Forget

- Todos los tracking (`profile_view`, `whatsapp_click`, `promo_open`) son **fire-and-forget**
- No bloquean UI si fallan
- Dedupe por `sessionStorage` para `profile_view` y `promo_open`

**EVIDENCIA:** `apps/web-b2c/src/lib/api.ts`, `apps/web-b2c/src/hooks/useProfileViewOnce.ts`

### Multi-Tenant

- **Panel:** Usa `req.panelUser.localId` del middleware `panelAuth`
- **Nunca** se pide `localId` manual en query/body
- Validación: Endpoints validan que `path.localId === req.panelUser.localId`

**EVIDENCIA:** `functions/api/src/middlewares/panelAuth.ts`, `functions/api/src/routes/reservations.ts:164-167`

### CORS

- Soporta múltiples origins (separados por coma en `FRONTEND_ORIGIN`)
- Defaults: `localhost:3000, 3001, 5173` (+ 127.0.0.1)
- Preflight OPTIONS responde `204`

**EVIDENCIA:** `functions/api/src/middlewares/cors.ts`

---

## 12. ARCHIVOS CLAVE (REFERENCIA RÁPIDA)

### Backend
- `functions/api/src/server.ts` - Entrypoint Express
- `functions/api/src/middlewares/panelAuth.ts` - Auth multi-tenant
- `functions/api/src/middlewares/cors.ts` - CORS multi-origin
- `functions/api/src/routes/public.ts` - Endpoints públicos
- `functions/api/src/routes/events.ts` - Tracking
- `functions/api/src/routes/reservations.ts` - Reservas
- `functions/api/src/routes/panel.ts` - Panel endpoints
- `functions/api/src/routes/calendar.ts` - Calendario
- `functions/api/src/routes/activity.ts` - Actividad
- `functions/api/src/routes/metrics.ts` - Métricas

### Frontend Panel
- `apps/web-next/app/panel/page.tsx` - Dashboard
- `apps/web-next/app/panel/calendar/page.tsx` - Calendario
- `apps/web-next/app/panel/login/page.tsx` - Login
- `apps/web-next/lib/panel.ts` - Helpers API panel
- `apps/web-next/lib/supabase.ts` - Cliente Supabase

### Frontend B2C
- `apps/web-b2c/src/App.tsx` - Router y rutas
- `apps/web-b2c/src/pages/BarProfile.tsx` - Perfil bar
- `apps/web-b2c/src/pages/ClubProfile.tsx` - Perfil club
- `apps/web-b2c/src/pages/ReservaForm.tsx` - Formulario reserva
- `apps/web-b2c/src/lib/locals.ts` - Resolver slug → local_id
- `apps/web-b2c/src/lib/api.ts` - Tracking helpers
- `apps/web-b2c/src/lib/promoIdMap.ts` - Mapeo promo mock → UUID
- `apps/web-b2c/src/lib/mvpSlugs.ts` - Slugs MVP
- `apps/web-b2c/src/lib/slug.ts` - Utilidad slugify
- `apps/web-b2c/src/hooks/useProfileViewOnce.ts` - Hook tracking profile_view

### SQL
- `infra/sql/schema.sql` - Schema completo
- `infra/sql/rls.sql` - RLS policies
- `infra/sql/seed.sql` - Seed data MVP

### Tests
- `scripts/smoke.http` - Smoke tests (REST Client)

---

**FIN DEL DOCUMENTO**

