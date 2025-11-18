# Informe de Auditoría Técnica - Verificación de Afirmaciones

**Fecha:** 2025-01-XX  
**Auditor:** Auto (Cursor AI)  
**Repo:** `tairet-mono-2`

---

## Tabla de Verificación de Afirmaciones

| # | Afirmación | Estado | Evidencia |
|---|------------|--------|-----------|
| **1. Stack Base** |
| 1.1 | Frontend en `apps/web-next` usa Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui (mínimo), TanStack Query, react-hook-form + zod, y `lib/flags.ts` | 🟡 PARCIAL | `apps/web-next/package.json`: Next.js 15.0.3, TypeScript, Tailwind, TanStack Query, react-hook-form, zod ✅. `apps/web-next/lib/flags.ts` existe ✅. `apps/web-next/tailwind.config.ts:13` menciona "Placeholder para shadcn/ui" pero `components/ui/` solo tiene `.gitkeep` ❌. README.md menciona shadcn/ui pero no hay componentes reales. |
| 1.2 | Backend en `functions/api` usa Express (no Fastify), TypeScript, cliente Supabase | ✅ VERDADERO | `functions/api/package.json`: `"express": "^4.21.0"` ✅, TypeScript ✅, `"@supabase/supabase-js": "^2.45.0"` ✅. `functions/api/src/server.ts:1` importa `express` ✅. |
| 1.3 | No se usa Fastify en ningún lado | ✅ VERDADERO | Búsqueda en repo: solo aparece en `pnpm-lock.yaml` como dependencia transitiva de `@opentelemetry/instrumentation-fastify` (no se usa directamente). No hay imports ni código que use Fastify. |
| **2. Panel actual en `/panel`** |
| 2.1 | Panel B2B montado en ruta `/panel` dentro de `apps/web-next` (App Router) | ✅ VERDADERO | `apps/web-next/app/panel/page.tsx` existe ✅. `apps/web-next/app/panel/layout.tsx` existe ✅. README.md línea 130 confirma `/app/panel/*` ✅. |
| 2.2 | Panel muestra KPIs (WhatsApp clicks, Reservas web, Entradas vendidas/usadas, Ingresos) y secciones: Probar órdenes, Reservas (Bares), Promos, Actividad reciente | 🟡 PARCIAL | `apps/web-next/app/panel/page.tsx`: KPIs en líneas 268-302 muestran placeholders con "TODO: Conectar con métricas/API/orders" ❌. Sección "Probar Órdenes" líneas 304-359 ✅. "Reservas (Bares)" líneas 451-547 ✅. "Promos" líneas 596-700 ✅. "Actividad Reciente" líneas 702-763 ✅. KPIs reales vienen de `/metrics/summary` líneas 361-449 ✅. |
| **3. Calendario / Operación** |
| 3.1 | No existe endpoint `/calendar`, `/schedule` ni módulos `Calendar`, `Schedule`, `Operacion` | ✅ VERDADERO | Búsqueda en repo: no hay rutas `/calendar` o `/schedule` en `functions/api/src/server.ts` ✅. No hay componentes con nombres `Calendar`, `Schedule`, `Operacion` en `apps/web-next` ✅. |
| 3.2 | No hay pantalla específica de calendario en `apps/web-next` | ✅ VERDADERO | No existe `apps/web-next/app/calendar/` ni `apps/web-next/app/schedule/` ✅. Solo se puede derivar de `/metrics/summary` o `/activity` (no es pantalla dedicada). |
| **4. Promociones** |
| 4.1 | Backend tiene `GET /locals/:id/promos`, `POST /locals/:id/promos`, `POST /events/promo_open` | ✅ VERDADERO | `functions/api/src/routes/promos.ts:10` → `GET /:id/promos` ✅. `functions/api/src/routes/promos.ts:72` → `POST /:id/promos` ✅. `functions/api/src/routes/events.ts:75` → `POST /events/promo_open` ✅. Montados en `functions/api/src/server.ts:34` y `:37` ✅. |
| 4.2 | Schema SQL tiene tabla `promos` y forma de contar vistas (usando `events_public` o `view_count`) | ✅ VERDADERO | `infra/sql/schema.sql:23-34` → tabla `promos` ✅. `infra/sql/schema.sql:79-86` → tabla `events_public` con `type: "promo_open"` ✅. `functions/api/src/routes/promos.ts:34-61` calcula `view_count` desde `events_public` ✅. |
| 4.3 | `GET /metrics/summary` incluye `top_promo` | ✅ VERDADERO | `functions/api/src/routes/metrics.ts:192-202` calcula `top_promo` ✅. Línea 221 retorna `top_promo: topPromo` ✅. |
| 4.4 | Panel `/panel` muestra lista de promos y "Promo más vista" | ✅ VERDADERO | `apps/web-next/app/panel/page.tsx:596-700` → sección "Promos" con tabla ✅. Líneas 195-201 calculan `topPromo` desde `promos` ✅. Líneas 680-698 muestran "Promo más vista" ✅. También en KPIs líneas 437-444 ✅. |
| **5. Reservas – Discotecas (WhatsApp)** |
| 5.1 | No existe endpoint `POST /club_reservations` | ✅ VERDADERO | Búsqueda en repo: no existe `club_reservations` ni `clubReservations` ✅. `functions/api/src/server.ts` no monta ruta `/club_reservations` ✅. |
| 5.2 | Evento WhatsApp se registra con `POST /events/whatsapp_click` que acepta `local_id`, `phone?`, `source?` | ✅ VERDADERO | `functions/api/src/routes/events.ts:22-49` → `POST /events/whatsapp_click` ✅. `functions/api/src/schemas/whatsapp.ts` valida `local_id` (UUID), `phone?`, `source?` ✅. |
| 5.3 | Métricas de clicks WhatsApp se reflejan en `/metrics/summary` y/o panel | ✅ VERDADERO | `functions/api/src/routes/metrics.ts:42-47` cuenta `whatsapp_clicks` ✅. Línea 211 retorna `whatsapp_clicks` ✅. `apps/web-next/app/panel/page.tsx:400-404` muestra `whatsapp_clicks` en KPIs ✅. |
| **6. Reservas – Bares (Formulario web)** |
| 6.1 | Existe `POST /reservations` que valida `local_id`, `name`, `email`, `phone`, `date`, `guests`, `notes?` e inserta con `status: "en_revision"` | ✅ VERDADERO | `functions/api/src/routes/reservations.ts:9-48` → `POST /reservations` ✅. `functions/api/src/schemas/reservations.ts` valida todos los campos ✅. Línea 23 inserta con `status: "en_revision"` ✅. |
| 6.2 | Existe `GET /locals/:id/reservations` que lista reservas del local | ✅ VERDADERO | `functions/api/src/routes/reservations.ts:53-82` → `GET /:id/reservations` ✅. Montado en `functions/api/src/server.ts:33` como `/locals/:id/reservations` ✅. |
| 6.3 | Panel `/panel` tiene sección "Reservas (Bares)" que muestra `name`, `date`, `guests`, `status`, `created_at` | ✅ VERDADERO | `apps/web-next/app/panel/page.tsx:451-547` → sección "Reservas (Bares)" ✅. Tabla líneas 488-539 muestra todas las columnas mencionadas ✅. |
| 6.4 | No existe `PATCH /reservations/:id` para cambiar status (o no está usado desde panel) | ✅ VERDADERO | Búsqueda en repo: no existe `PATCH /reservations/:id` en `functions/api/src/routes/reservations.ts` ✅. Panel no tiene botones para confirmar/cancelar reservas ✅. |
| 6.5 | Existe stub `sendReservationReceivedEmail` usado al crear reserva, y stub `sendReservationConfirmedEmail` que no se llama | ✅ VERDADERO | `functions/api/src/services/emails.ts:17-32` → `sendReservationReceivedEmail` (stub) ✅. Líneas 34-49 → `sendReservationConfirmedEmail` (stub) ✅. `functions/api/src/routes/reservations.ts:35-42` llama `sendReservationReceivedEmail` ✅. `sendReservationConfirmedEmail` no se llama desde ningún lugar ✅. |
| **7. Entradas (Checkout Lite + Check-in manual)** |
| 7.1 | Existen endpoints `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/use`, `POST /payments/callback` | ✅ VERDADERO | `functions/api/src/routes/orders.ts:9` → `POST /orders` ✅. Línea 40 → `GET /orders/:id` ✅. Línea 62 → `PATCH /orders/:id/use` ✅. `functions/api/src/routes/payments.ts:11` → `POST /payments/callback` ✅. |
| 7.2 | `POST /payments/callback` es idempotente usando tabla `payment_events` con `transaction_id` único | ✅ VERDADERO | `functions/api/src/routes/payments.ts:23-35` verifica si `event_id` ya existe ✅. Línea 51 maneja constraint único (23505) ✅. `infra/sql/schema.sql:54-62` → tabla `payment_events` con `transaction_id TEXT NOT NULL UNIQUE` ✅. |
| 7.3 | `PATCH /orders/:id/use` actualiza `used_at` y solo permite órdenes pagadas y no usadas | ✅ VERDADERO | `functions/api/src/routes/orders.ts:77-89` valida `status === "paid"` y `used_at === null` ✅. Línea 94 actualiza `used_at` ✅. |
| 7.4 | Panel tiene "Probar Órdenes" y KPIs de entradas vendidas/usadas/ingresos desde `/metrics/summary` | 🟡 PARCIAL | `apps/web-next/app/panel/page.tsx:304-359` → "Probar Órdenes" ✅. KPIs líneas 283-301 muestran placeholders "TODO: Conectar con orders" ❌. Pero líneas 415-428 muestran KPIs reales desde `/metrics/summary` con `tickets_sold`, `tickets_used`, `revenue_paid` ✅. |
| 7.5 | No existe integración real con SDKs de Bancard/Dinelco (solo simulado) | ✅ VERDADERO | `functions/api/src/routes/payments.ts` no importa librerías de Bancard/Dinelco ✅. Solo acepta callbacks genéricos con `event_id`, `order_id`, `status` ✅. README.md línea 241 dice "Endpoint idempotente para recibir callbacks" (simulado) ✅. |
| **8. Reportes & Analítica** |
| 8.1 | `GET /metrics/summary` devuelve campos: `whatsapp_clicks`, `profile_views`, `reservations_total`, `reservations_en_revision`, `reservations_confirmed`, `reservations_cancelled`, `orders_total`, `tickets_sold`, `tickets_used`, `revenue_paid`, `top_promo` | ✅ VERDADERO | `functions/api/src/routes/metrics.ts:210-222` retorna todos los campos mencionados ✅. Coincide con README.md líneas 404-420 ✅. |
| 8.2 | `GET /activity?localId=` devuelve máximo 5 últimos eventos mezclados | ✅ VERDADERO | `functions/api/src/routes/activity.ts:29` → `GET /activity` ✅. Línea 267 retorna `items.slice(0, 5)` ✅. Agrega órdenes, reservas, clicks, promo_open, profile_views ✅. |
| 8.3 | Panel usa `/metrics/summary` para KPIs y `/activity` para "Actividad reciente" | ✅ VERDADERO | `apps/web-next/app/panel/page.tsx:151-171` → `handleLoadMetrics` llama `/metrics/summary` ✅. Líneas 173-193 → `handleLoadActivity` llama `/activity` ✅. Líneas 361-449 muestran KPIs ✅. Líneas 702-763 muestran actividad ✅. |
| 8.4 | PostHog/GA4: confirmar si hay código real que envíe eventos | 🟡 PARCIAL | `apps/web-next/lib/posthog.ts` existe con `initPostHog()` y `trackEvent()` ✅. Pero no se ve uso real en `apps/web-next/app/panel/page.tsx` ❌. Solo hay helpers, no eventos enviados. GA4 no se encuentra en el código ❌. |
| **9. Acceso y seguridad (Auth / multi-tenant)** |
| 9.1 | No hay rutas `/auth` implementadas ni integración real de Supabase Auth en panel | ✅ VERDADERO | Búsqueda en `functions/api/src`: no hay carpeta `routes/auth.ts` ni rutas `/auth` ✅. `apps/web-next/app/panel/page.tsx` no tiene checks de autenticación ✅. |
| 9.2 | Panel se puede cargar sin login; `local_id` se pasa manualmente desde UI | ✅ VERDADERO | `apps/web-next/app/panel/page.tsx` tiene inputs para `localId` (líneas 20, 367, 456, etc.) ✅. No hay middleware de auth ni redirecciones ✅. |
| 9.3 | RLS configurado en DB pero API no vincula usuario autenticado con `local_id` | ✅ VERDADERO | `infra/sql/rls.sql` tiene políticas RLS ✅. Pero `functions/api/src/services/supabase.ts` usa `SUPABASE_SERVICE_ROLE` (bypass RLS) ✅. No hay código que vincule `auth.uid()` con `local_id` ✅. |
| **10. QR antifraude** |
| 10.1 | No existe endpoint `/orders/validate` o `/validate/:ticketId` para QR | ✅ VERDADERO | Búsqueda en repo: no existe ruta `/validate` en `functions/api/src/routes/orders.ts` ✅. No hay código relacionado con QR ✅. |
| 10.2 | Único mecanismo de check-in es `used_at` y `PATCH /orders/:id/use` | ✅ VERDADERO | `functions/api/src/routes/orders.ts:61` comentario dice "check-in manual sin QR en MVP" ✅. Solo actualiza `used_at` ✅. README.md línea 148 dice "Sin QR en MVP (check-in manual)" ✅. |

---

## Resumen de Riesgos e Incoherencias

### 1. **shadcn/ui - Configuración Incompleta**
- **Problema:** README.md y `tailwind.config.ts` mencionan shadcn/ui, pero `components/ui/` solo tiene `.gitkeep` (vacío).
- **Riesgo:** Bajo. Es solo un placeholder, no afecta funcionalidad actual.
- **Recomendación:** Actualizar README.md para indicar que shadcn/ui está "preparado pero sin componentes instalados" o instalar componentes básicos.

### 2. **KPIs en Panel - Placeholders vs. Datos Reales**
- **Problema:** `apps/web-next/app/panel/page.tsx` líneas 268-302 muestran KPIs con "TODO: Conectar con métricas/API/orders", pero líneas 361-449 ya muestran KPIs reales desde `/metrics/summary`.
- **Riesgo:** Medio. Confusión para desarrolladores. Los placeholders superiores no se usan.
- **Recomendación:** Eliminar los placeholders de líneas 268-302 o conectarlos con `/metrics/summary`.

### 3. **PostHog - Helpers sin Uso**
- **Problema:** `apps/web-next/lib/posthog.ts` tiene helpers pero no se usan en el panel.
- **Riesgo:** Bajo. No afecta funcionalidad, pero no se está trackeando.
- **Recomendación:** Agregar eventos de PostHog en acciones clave del panel o documentar que está preparado pero no activo.

### 4. **Email de Reserva Confirmada - Stub No Usado**
- **Problema:** `sendReservationConfirmedEmail` existe pero no se llama desde ningún flujo.
- **Riesgo:** Bajo. Coherente con MVP (no hay endpoint para confirmar reservas).
- **Recomendación:** Documentar que el stub está listo para cuando se implemente `PATCH /reservations/:id`.

### 5. **RLS vs. Service Role**
- **Problema:** RLS está configurado en DB pero el backend usa `SUPABASE_SERVICE_ROLE` (bypass).
- **Riesgo:** Medio. RLS no se está aplicando realmente.
- **Recomendación:** Documentar que RLS está preparado para cuando se implemente autenticación real, o usar `SUPABASE_ANON_KEY` con políticas RLS activas.

---

## Fuente de Verdad Recomendada

**Código real > README.md**

- El código es la fuente de verdad más confiable.
- README.md tiene algunas discrepancias menores (shadcn/ui, PostHog activo).
- Recomendación: Actualizar README.md para reflejar el estado real del código.

---

## Ajustes Sugeridos

### 1. README.md
- Línea 7: Cambiar "shadcn/ui" por "shadcn/ui (preparado, sin componentes instalados)".
- Línea 25: Aclarar que PostHog tiene helpers pero no está activo en el panel.

### 2. apps/web-next/app/panel/page.tsx
- Eliminar o conectar los placeholders de KPIs (líneas 268-302).
- Agregar comentario indicando que KPIs reales están en líneas 361-449.

### 3. functions/api/src/services/emails.ts
- Agregar comentario en `sendReservationConfirmedEmail` indicando que se usará cuando exista `PATCH /reservations/:id`.

---

**Fin del Informe**

