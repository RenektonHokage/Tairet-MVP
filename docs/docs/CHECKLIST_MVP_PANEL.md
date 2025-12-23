Perfecto, ya tenemos todo verde en GitHub y el monorepo sano 👌

Te dejo directamente el contenido para `docs/docs/CHECKLIST_MVP_PANEL.md` listo para **copiar y pegar**.

---

````md
# CHECKLIST – MVP Panel B2B Tairet

> **Objetivo:** Documentar el estado actual del panel B2B, qué hace, cómo levantarlo, cómo probarlo y qué cosas faltan.  
> **Ámbito:** Solo PANEL B2B (`/panel`), reservas de bares, auth B2B y métricas básicas del MVP.

---

## 1. Resumen rápido del Panel (estado actual)

El panel B2B de Tairet (ruta `/panel`) hoy permite:

- ✅ Login B2B por email/contraseña (Supabase Auth).
- ✅ Multi-tenant: cada usuario de panel está atado a **un solo local** vía tabla `panel_users`.
- ✅ KPIs básicos del local (desde `/metrics/summary`):
  - Clicks WhatsApp.
  - Reservas web (total + por estado).
  - Entradas vendidas / usadas.
  - Ingresos estimados por entradas.
  - Promo más vista.
- ✅ Reservas de bares:
  - Crear reservas vía `POST /reservations` (estado inicial `en_revision`).
  - Ver reservas en el panel.
  - Confirmar / cancelar reservas desde el panel (`PATCH /reservations/:id`).
  - Enviar email stub al crear y al confirmar.
- ✅ Promociones:
  - Crear promos (`POST /locals/:id/promos`).
  - Listar promos (`GET /locals/:id/promos`).
  - Registrar vistas de promo (`POST /events/promo_open`).
  - Mostrar “Promo más vista”.
- ✅ Actividad reciente:
  - Endpoint `/activity?localId=...` con últimas 5 acciones.
  - Bloque "Actividad reciente" en el panel.
- ✅ Calendario / Operación:
  - Vista mensual con días con actividad (reservas, ventas, promos).
  - Detalle diario con reservas, ventas y operación (abierto/cerrado + nota).
  - Toggle de estado diario (abierto/cerrado) y notas por día.
  - Endpoints: `GET /panel/calendar/month`, `GET /panel/calendar/day`, `PATCH /panel/calendar/day`.
- ✅ Autorización en API:
  - Endpoints del panel protegidos por middleware `panelAuth`.
  - Solo se puede consultar/operar el `local_id` asociado al usuario logueado.
- ✅ CI/CD:
  - `pnpm -r build` pasa.
  - `pnpm -r typecheck` pasa.
  - Workflows de GitHub no se caen por falta de env de Supabase (cliente “dummy” en CI).

**Fuera de scope (todavía):**

- ❌ PostHog/GA4 realmente instrumentados.
- ❌ Auth B2C (usuarios finales).
- ❌ Integración real con Bancard/Dinelco (hoy callbacks simulados).

---

## 2. Arquitectura rápida del Panel

### 2.1. Frontend

- App: `apps/web-next` (Next.js 15, App Router).
- Rutas relevantes:
  - `/panel/login` → login B2B.
  - `/panel` → panel principal del local.
- Tech:
  - TypeScript.
  - Tailwind CSS.
  - (shadcn/ui preparado pero con pocos componentes aún).
  - TanStack Query para fetch/cache.
- Helpers de panel (front):
  - `apps/web-next/lib/api.ts` → `apiGet`, `apiPost`, `apiPatch` (+ variantes con auth).
  - `apps/web-next/lib/panel.ts` → info de usuario del panel (`/panel/me`).
  - `apps/web-next/lib/metrics.ts` → `/metrics/summary`.
  - `apps/web-next/lib/activity.ts` → `/activity`.
  - `apps/web-next/lib/reservations.ts` → `/locals/:id/reservations` + `PATCH /reservations/:id`.
  - `apps/web-next/lib/promos.ts` → promos.
  - `apps/web-next/lib/whatsapp.ts` → clicks de WhatsApp.
- Supabase (front):
  - Cliente configurado en `apps/web-next/lib/supabase.ts`.
  - **En CI**, si faltan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `process.env.CI === "true"`, se crea un cliente “dummy” solo para permitir el build.

### 2.2. Backend

- App: `functions/api` (Express + TS).
- Cliente Supabase server-side: `functions/api/src/services/supabase.ts` (usa `SUPABASE_SERVICE_ROLE`).
- Middleware de auth panel:
  - `functions/api/src/middlewares/panelAuth.ts`.
  - Resuelve el usuario de panel y su `local_id`, y bloquea accesos a otros locales.
- Rutas relevantes del panel:
  - `GET /panel/me` → info del usuario de panel (email, local, rol).
  - `GET /metrics/summary` → KPIs del local.
  - `GET /activity` → últimas 5 acciones del local.
  - `GET /locals/:id/reservations` → reservas del local.
  - `PATCH /reservations/:id` → confirmar/cancelar.
  - `GET /locals/:id/promos` / `POST /locals/:id/promos`.

---

## 3. Base de datos (Supabase)

### 3.1. Tablas clave para el Panel

En `infra/sql/schema.sql`:

- `locals` → locales/venues (id, nombre, ticket_price, etc.).
- `reservations` → reservas de bares:
  - `status` ∈ `('en_revision', 'confirmed', 'cancelled')`.
  - `name` (requerido), `last_name` (opcional), `email`, `phone`, `date`, `guests`.
  - `notes` (opcional) → comentario del cliente.
  - `table_note` (opcional) → nota interna del local (ej: "Mesa X / cerca ventana").
- `orders` → órdenes de entradas (precio fijo por local).
- `payment_events` → idempotencia de callbacks de pago.
- `promos` → promos asociadas a un `local_id`.
- `events_public` → tracking eventos públicos (incluye `promo_open`).
- `whatsapp_clicks` → clicks registrados al botón de WhatsApp.
- `profile_views` → vistas de perfil del local.
- `panel_users` → **usuarios del panel B2B**:
  - `auth_user_id` → UUID de Supabase Auth (tabla Users).
  - `email`, `local_id`, `role`.
- `local_daily_ops` → **operación diaria del local**:
  - `local_id`, `day` (DATE), `is_open` (boolean), `note` (text).
  - Unique constraint: `(local_id, day)`.

### 3.2. Setup inicial de Supabase (orden exacto)

**Pasos en SQL Editor de Supabase:**

1. **Ejecutar `infra/sql/schema.sql`** - Crea todas las tablas, índices y extensiones
2. **Ejecutar `infra/sql/rls.sql`** - Habilita RLS y crea políticas
3. **Ejecutar `infra/sql/seed.sql`** - Inserta datos de prueba (2 locales, 1 promo)
4. **Crear usuario en Supabase Auth:**
   - Ir a Authentication > Users > Add user
   - Email: `panel@tairet.test` (o el que prefieras)
   - Password: (elegir una contraseña segura)
   - **Copiar el User UID** generado
5. **Insertar panel_user:**
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

### 3.3. Variables de entorno de Supabase

**Frontend (`apps/web-next/.env`):**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxxxxxxx
```

**Backend (`functions/api/.env`):**
```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE=sb_secret_xxxxxxxxxxxxx
FRONTEND_ORIGIN=http://localhost:3000,http://localhost:3001
```

**Notas:**
- Las llaves pueden tener formato nuevo (`sb_publishable_...` / `sb_secret_...`) o formato antiguo. Ambos funcionan.
- `FRONTEND_ORIGIN` soporta múltiples orígenes separados por comas. Si está vacío, por defecto permite `http://localhost:3000` y `http://localhost:3001`.
- Esto resuelve problemas de CORS cuando Next.js corre en puerto 3000 o 3001.

> 💡 Si se borra el usuario en Auth o cambia el local, hay que actualizar también la fila en `panel_users`.

---

## 4. Auth B2B + Multi-tenant

### 4.1. Flujo de login

1. El usuario entra a `/panel/login`.
2. Ingresa `email` + `password`.
3. Se autentica contra Supabase Auth.
4. Una vez logueado, el front llama al backend para:

   * Obtener `/panel/me`.
   * Cargar métricas, reservas, promos y actividad del `local_id` asociado.

### 4.2. Multi-tenant en API

* Todas las rutas del panel usan `panelAuth`:

  * `GET /metrics/summary`
  * `GET /activity`
  * `GET /locals/:id/reservations`
  * `GET /locals/:id/promos`
  * `POST /locals/:id/promos`
  * (y otras relacionadas con panel)
* Regla básica:

  * El `local_id` del path o del query **debe coincidir** con el `local_id` del usuario de `panel_users`.
  * Si no coincide, la API devuelve error (no se permite ver los datos de otro local).

---

## 5. Reservas de Bares (MVP completado)

### 5.1. Crear una reserva (B2C / pruebas)

Endpoint:

```http
POST /reservations
Content-Type: application/json
```

Body:

```json
{
  "local_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "Juan",
  "last_name": "Pérez",
  "email": "juan@example.com",
  "phone": "+595981234567",
  "date": "2024-12-25T20:00:00Z",
  "guests": 4,
  "notes": "Mesa cerca de la ventana"
}
```

Nota: `last_name` y `table_note` son opcionales. `table_note` puede ser actualizado por el local desde el panel.

Comportamiento:

* Crea reserva con `status: "en_revision"`.
* Rellena `created_at` y `updated_at`.
* Llama al stub `sendReservationReceivedEmail` (no manda email real, pero deja la pieza lista).

### 5.2. Ver reservas en el panel

* En `/panel`, sección **"Reservas (Bares)"**:

  * Muestra columnas: Nombre, Apellido, Fecha, Personas, Estado, Notas Cliente, Mesa/Nota Interna, Creado, Acciones.
  * Ahora ya **no se ingresa `localId` a mano**: se usa el local del usuario de panel.
  * **Edición de `table_note`**: Cada fila tiene un botón de edición (✏️) que permite actualizar la nota interna del local (ej: "Mesa 5 / cerca ventana"). Esta nota es independiente del estado de la reserva y puede editarse en cualquier momento.

Internamente usa:

* `GET /locals/:id/reservations` (protegido por `panelAuth`).

### 5.3. Confirmar / cancelar reservas desde el panel

Nuevo endpoint:

```http
PATCH /reservations/:id
Content-Type: application/json
```

Body:

```json
{ "status": "confirmed" }
```

o

```json
{ "status": "cancelled" }
```

o para actualizar solo la nota interna:

```json
{ "table_note": "Mesa 5 / cerca ventana" }
```

o ambos:

```json
{
  "status": "confirmed",
  "table_note": "Mesa 3 / terraza"
}
```

Reglas de negocio:

* **Actualización de `status`**:
  * Solo permite cambiar desde `"en_revision"` → `"confirmed"` o `"cancelled"`.
  * Si la reserva ya fue procesada (estado actual `confirmed` o `cancelled`) → `400` con:
    * `error: "La reserva ya fue procesada"`
    * `currentStatus: ...`
* **Actualización de `table_note`**:
  * Puede actualizarse independientemente del estado de la reserva (incluso si ya está `confirmed` o `cancelled`).
  * Permite valores `string` o `null`.
* Actualiza `updated_at` en ambos casos.
* Si `status === "confirmed"`:
  * Llama a `sendReservationConfirmedEmail` (stub).

En el panel:

* Para reservas con `status: "en_revision"`:

  * Se muestran botones:

    * **Confirmar**
    * **Cancelar**
* Una vez actualizada:

  * Cambia el badge de estado (verde/rojo).
  * Desaparecen los botones de acción.

---

## 6. Métricas y Actividad reciente

### 6.1. `/metrics/summary`

Devuelve KPIs básicos del local:

* `whatsapp_clicks`
* `profile_views`
* `reservations_total`
* `reservations_en_revision`
* `reservations_confirmed`
* `reservations_cancelled`
* `orders_total`
* `tickets_sold`
* `tickets_used`
* `revenue_paid`
* `top_promo` (id, título, view_count)

En el panel:

* Bloque **“KPIs del Local”** consume estos datos.
* **Nota:** Se limpiaron KPIs duplicadas y placeholders viejos; ahora se usa solo este endpoint como fuente.

### 6.2. `/activity`

Devuelve:

* Máx. 5 últimos eventos mezclados:

  * creación/actualización de reservas,
  * órdenes pagadas/usadas,
  * whatsapp_click,
  * promo_open,
  * profile_view, etc.

En el panel:

* Bloque **“Actividad Reciente”** muestra la lista con tipo, label y timestamp.

---

## 7. Integración Supabase en CI (evitar builds rotos)

### Problema original

* En GitHub Actions, `next build` fallaba al prerender `/panel` por:

  > Missing Supabase environment variables:
  > `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`

* En local no pasaba porque las variables estaban definidas en `.env`.

### Solución implementada

En `apps/web-next/lib/supabase.ts`:

* Si **NO** estamos en CI (`process.env.CI !== "true"`) y faltan las env de Supabase:

  * Se lanza error → evita que el desarrollador se olvide de configurar el entorno.
* Si **SÍ** estamos en CI (`process.env.CI === "true"`) y faltan las env:

  * Se crea un **cliente Supabase “dummy”** con URL/KEY de placeholder.
  * Se loguea un `console.warn` explicando que es modo dummy.
  * El objetivo es **permitir que el build pase** sin conectarse a un Supabase real.

Esto:

* Arregla el pipeline de GitHub (ya no falla en `/panel` por envs).
* No afecta el comportamiento en desarrollo local ni en producción real (donde **sí** hay `.env` con valores reales).

---

## 8. Scripts importantes (monorepo)

Para recordar rápidamente qué corre qué:

### 8.1. En root (`tairet-mono-2/`)

* **Build completo:**

  ```bash
  pnpm -r build
  ```

* **Typecheck completo:**

  ```bash
  pnpm -r typecheck
  ```

### 8.2. backend (`functions/api`)

* Dev:

  ```bash
  pnpm -C functions/api dev
  ```

* Build:

  ```bash
  pnpm -C functions/api build
  ```

### 8.3. frontend panel (`apps/web-next`)

* Dev:

  ```bash
  pnpm -C apps/web-next dev
  # Abre en http://localhost:3000
  ```

* Build:

  ```bash
  pnpm -C apps/web-next build
  ```

* Typecheck solo frontend:

  ```bash
  pnpm -C apps/web-next typecheck
  # Usa: tsc --noEmit
  ```

---

## 9. Cómo probar el panel end-to-end (resumen rápido)

1. **Supabase** (ver sección 3.2 para orden exacto)
   - Ejecutar SQL en orden: `schema.sql` → `rls.sql` → `seed.sql`
   - Crear usuario Auth `panel@tairet.test`
   - Insertar fila en `panel_users` con su `auth_user_id` y `local_id`

2. **Variables de entorno**
   - Configurar `apps/web-next/.env` con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Configurar `functions/api/.env` con `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE` y `FRONTEND_ORIGIN`

3. **Backend**
   ```bash
   pnpm -C functions/api dev
   # Backend en http://localhost:4000
   ```

4. **Frontend**
   ```bash
   pnpm -C apps/web-next dev
   # Panel en http://localhost:3000/panel (o 3001 si 3000 está ocupado)
   ```

5. **Login**
   - Ir a `/panel/login`
   - Email: `panel@tairet.test`
   - Password: la que configuraste en Supabase

6. **Probar con REST Client**
   - Abrir `scripts/smoke.http` en VS Code
   - Instalar extensión "REST Client" si no está instalada
   - Para requests autenticados, obtener access token:
     - Hacer login en `/panel/login` desde el navegador
     - Abrir DevTools (F12) > Console
     - Ejecutar: `(await supabase.auth.getSession()).data.session?.access_token`
     - Copiar el token y reemplazar `{{accessToken}}` en `smoke.http`

7. **Crear una reserva de prueba**
   - Usar `scripts/smoke.http` o PowerShell con `Invoke-RestMethod` para hacer `POST /reservations`
   - Verificar que aparezca en la tabla de "Reservas (Bares)"

8. **Confirmar / cancelar**
   - En el panel, usar los botones **Confirmar** / **Cancelar**
   - Ver el cambio de estado en la tabla
   - Ver cambios reflejados en `/metrics/summary` y `/activity`

9. **Probar Calendario / Operación**
   - Ir a `/panel/calendar` desde el panel principal
   - Ver calendario mensual con días con actividad
   - Click en un día para ver detalle (reservas, ventas, operación)
   - Cambiar estado (abierto/cerrado) y agregar nota del día
   - Verificar que los cambios persisten al recargar

---

## 10. Calendario / Operación (MVP completado)

### 10.1. Vista mensual

Endpoint: `GET /panel/calendar/month?month=YYYY-MM`

Devuelve un array de días del mes con:
- Contadores de actividad: `reservations_total`, `reservations_en_revision`, `reservations_confirmed`, `reservations_cancelled`, `orders_paid`, `promo_opens`
- Estado de operación: `is_open` (default: `true` si no hay fila), `note` (opcional)

En el panel:
- Grid calendario 7x6 (lunes a domingo)
- Cada día muestra: número, badge de actividad (R: reservas, V: ventas), icono de estado (✅/🚫), indicador de nota (📝)
- Click en un día abre el panel de detalle

### 10.2. Detalle diario

Endpoint: `GET /panel/calendar/day?day=YYYY-MM-DD`

Devuelve:
- `operation`: `is_open`, `note`
- `reservations`: lista de reservas del día (máx. 10)
- `orders_summary`: `count`, `total` (PYG)

En el panel:
- Toggle para cambiar `is_open`
- Textarea para `note` (máx. 200 caracteres)
- Lista de reservas del día
- Resumen de ventas (órdenes pagadas)

### 10.3. Actualizar operación diaria

Endpoint: `PATCH /panel/calendar/day`

Body:
```json
{
  "day": "YYYY-MM-DD",
  "is_open": true/false,  // opcional
  "note": "..."           // opcional, puede ser null
}
```

Comportamiento:
- Upsert en tabla `local_daily_ops` por `(local_id, day)`
- Puede actualizar solo `is_open`, solo `note`, o ambos
- Si no existe fila, la crea; si existe, la actualiza

---

## 11. Integración B2C → API real (MVP completado)

### 11.1. Tracking de eventos

El frontend B2C (`apps/web-b2c`) está conectado a los endpoints reales de tracking:

**1. Profile View (`POST /events/profile_view`)**
- Se dispara automáticamente al abrir un perfil de local (bar/club)
- Usa `useProfileViewOnce(localId)` hook para garantizar 1 solo evento por sesión/local
- Key de sessionStorage: `profile_view:${localId}`
- Payload: `{ local_id, source: "b2c_web", user_agent, ip_address? }`

**2. WhatsApp Click (`POST /events/whatsapp_click`)**
- Se dispara al hacer click en botón "WhatsApp" en `BarReservation`
- Fire-and-forget: no bloquea `window.open()` si falla
- Payload: `{ local_id, phone?, source: "b2c_web" }`

**3. Promo Open (`POST /events/promo_open`)**
- Se dispara al hacer click en una promo en `BarPromotions` o `ClubPromotions`
- Fire-and-forget: no bloquea UI si falla
- Payload: `{ promo_id, local_id, source: "b2c_web" }`

### 11.2. Reservas web

El formulario de reservas (`/reservar/:barId`) está conectado a `POST /reservations`:

- Campos enviados: `local_id`, `name`, `last_name`, `email`, `phone`, `date` (ISO-8601), `guests`, `notes`
- Manejo de estados: loading, success (toast), error (toast)
- La fecha se combina de `date` + `time` del formulario y se convierte a ISO-8601
- Las reservas aparecen en el panel del local con `status: "en_revision"`

### 11.3. Configuración

**Variables de entorno (`apps/web-b2c/.env`):**
```bash
VITE_API_URL=http://localhost:4000
```

Si no se define, usa `http://localhost:4000` por defecto.

**Nota:** Actualmente los componentes usan `local_id` hardcodeado (`550e8400-e29b-41d4-a716-446655440001`). En el futuro, esto debería obtenerse desde:
- API de locales basado en `barId`/`clubId`
- Contexto de la aplicación
- Parámetros de ruta

### 11.4. Cómo probar

1. **Levantar servicios:**
   ```bash
   # Terminal 1: Backend
   pnpm -C functions/api dev
   
   # Terminal 2: Frontend B2C
   pnpm -C apps/web-b2c dev
   ```

2. **Probar profile_view:**
   - Ir a `/bar/:barId` o `/club/:clubId`
   - Abrir DevTools > Network
   - Verificar que se envía `POST /events/profile_view` exactamente 1 vez
   - Recargar la página: no debe enviarse de nuevo (sessionStorage)

3. **Probar whatsapp_click:**
   - En el perfil del local, hacer click en botón "WhatsApp"
   - Verificar en Network que se envía `POST /events/whatsapp_click`
   - Verificar que WhatsApp se abre normalmente (aunque el request falle)

4. **Probar promo_open:**
   - En el perfil del local, hacer click en una promo
   - Verificar en Network que se envía `POST /events/promo_open`

5. **Probar reservas:**
   - Ir a `/reservar/:barId`
   - Completar el formulario y enviar
   - Verificar que aparece toast de éxito
   - Verificar en el panel (`/panel`) que la reserva aparece con `status: "en_revision"`

---

## 12. TODO / Próximos pasos deseados (solo lista, no implementado aún)

* [ ] Obtener `local_id` dinámicamente desde API en lugar de hardcodeado
* [ ] Activar tracking real con **PostHog** (product analytics).
* [ ] Activar tracking con **GA4** (marketing).
* [ ] Integrar pasarelas reales **Bancard / Dinelco** en lugar del flujo simulado.
* [ ] Auth B2C para usuarios finales (reservas + compras con cuenta).

---

> **Nota final:**
> Siempre que se haga un cambio importante en el panel (auth, reservas, métricas, integración externa), actualizar este archivo para que funcione como “mapa mental” del estado del MVP B2B.

```

---

Cuando lo pegues en `docs/docs/CHECKLIST_MVP_PANEL.md`, con eso ya tenés:

- Un mapa claro de **qué hace** el panel hoy.
- Cómo levantarlo y probarlo.
- Qué hacks metimos (Supabase dummy en CI).
- Y una lista de TODOs para el futuro.

Si querés, después podemos hacer otro doc similar para **MVP backend completo** o para la **integración con Lovable**.
::contentReference[oaicite:0]{index=0}
```
