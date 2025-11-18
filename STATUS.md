# Estado del Repositorio Tairet Mono-2

Última revisión: 2024

## 1. Variables de Entorno

### ⚠️ FALTA_ENV_FRONT
**Archivo**: `apps/web-next/.env` no existe

**Variables mínimas requeridas**:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### ⚠️ FALTA_ENV_API
**Archivo**: `functions/api/.env` no existe

**Variables mínimas requeridas**:
```
PORT=4000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE=
RESEND_API_KEY=
POSTHOG_KEY=
POSTHOG_HOST=https://us.i.posthog.com
FRONTEND_ORIGIN=http://localhost:3000
```

**Acción**: Copiar desde `.env.example` a `.env` y completar valores.

---

## 2. Rutas Frontend (Next.js App Router)

### ✅ Rutas confirmadas

| Ruta | Archivo | Estado |
|------|---------|--------|
| `/` | `app/page.tsx` | ✅ OK - Landing pública |
| `/panel` | `app/panel/page.tsx` | ✅ OK - Dashboard B2B |

### ✅ Verificación de referencias
- ❌ No se encontraron referencias a `(public)` o `(panel)` en el código
- ✅ Estructura normalizada: rutas directas sin grupos de rutas

---

## 3. Rutas Backend (Express API)

### ✅ Healthcheck
- `GET /health` → `{ ok: true }` ✅ Confirmado

### ✅ Rutas montadas en `server.ts`

| Prefijo | Router | Endpoints |
|---------|--------|-----------|
| `/orders` | `ordersRouter` | `POST /`, `GET /:id`, `PATCH /:id/use` |
| `/payments` | `paymentsRouter` | `POST /callback` |
| `/reservations` | `reservationsRouter` | `POST /` |
| `/locals` | `localsReservationsRouter` | `GET /:id/reservations` |
| `/locals` | `promosRouter` | `GET /:id/promos`, `POST /:id/promos` |
| `/metrics` | `metricsRouter` | `GET /summary?localId&from&to` |
| `/events` | `eventsRouter` | `POST /whatsapp_click` |

### ✅ Middlewares ordenados
1. `corsMiddleware` (CORS con FRONTEND_ORIGIN)
2. `requestId` (Request ID tracking)
3. `express.json()` (JSON parsing)
4. Error handler (último)

---

## 4. TODOs por Archivo

### Frontend

#### `apps/web-next/app/panel/page.tsx` (6 TODOs)
- Conectar WhatsApp clicks con métricas
- Conectar Reservas web con API
- Conectar Entradas vendidas con orders
- Conectar Entradas usadas con orders (used_at)
- Sumar de orders pagadas para Ingresos estimados
- Listar eventos recientes

#### `apps/web-next/lib/sentry.ts` (2 TODOs)
- Configurar Sentry
- Inicializar Sentry con DSN desde env

### Backend - Rutas

#### `functions/api/src/routes/orders.ts` (9 TODOs)
- Validar con `createOrderSchema`
- Crear orden en Supabase
- Retornar orden creada
- Obtener orden desde Supabase
- Validar acceso (RLS)
- Verificar que order existe y está pagada
- Verificar que `used_at` es null
- Actualizar `used_at` con timestamp actual
- Retornar orden actualizada

#### `functions/api/src/routes/payments.ts` (4 TODOs)
- Validar firma/callback
- Verificar idempotencia (tabla payment_events)
- Actualizar order con estado de pago
- Retornar confirmación

#### `functions/api/src/routes/reservations.ts` (4 TODOs)
- Validar con `createReservationSchema`
- Crear reserva en Supabase con estado 'en_revision'
- Enviar email de confirmación (stub)
- Listar reservas del local (con RLS)

#### `functions/api/src/routes/promos.ts` (3 TODOs)
- Listar promos del local (con RLS)
- Validar con `promoUpsertSchema`
- Crear/editar promo (imagen + fechas informativas)

#### `functions/api/src/routes/metrics.ts` (2 TODOs)
- Agregar métricas desde Supabase (vistas/clics/reservas/ventas)
- Retornar MetricsSummary

#### `functions/api/src/routes/events.ts` (3 TODOs)
- Validar `localId` y `phone`
- Registrar evento en Supabase (tabla `events_public` o `whatsapp_clicks`)
- Enviar a PostHog si está configurado

### Backend - Servicios

#### `functions/api/src/services/payments.ts` (5 TODOs)
- Verificar idempotencia usando `payment_events`
- Validar firma si aplica
- Actualizar order con estado de pago
- Enviar email de confirmación si aprobado
- Actualizar order

#### `functions/api/src/services/emails.ts` (4 TODOs)
- Implementar con Resend o SendGrid
- Template de reserva recibida
- Template de reserva confirmada
- Template de compra confirmada (sin QR en MVP)

### Backend - Schemas

#### `functions/api/src/schemas/orders.ts` (1 TODO)
- Agregar campos según schema.sql

#### `functions/api/src/schemas/reservations.ts` (1 TODO)
- Agregar campos según schema.sql

#### `functions/api/src/schemas/promos.ts` (1 TODO)
- Agregar campos según schema.sql

### Backend - Middlewares

#### `functions/api/src/middlewares/error.ts` (1 TODO)
- Usar logger

### Infraestructura SQL

#### `infra/sql/rls.sql` (9 TODOs)
- Ajustar según sistema de autenticación (Supabase Auth)
- Filtrar promos por `local_id` según usuario autenticado
- Filtrar orders por `local_id` según usuario autenticado
- Validar `local_id` según usuario en INSERT orders
- Filtrar reservations por `local_id` según usuario autenticado
- Filtrar events_public por `local_id` según usuario autenticado
- Filtrar whatsapp_clicks por `local_id` según usuario autenticado
- Filtrar profile_views por `local_id` según usuario autenticado
- Ajustar políticas según sistema de autenticación Supabase

#### `infra/sql/seed.sql` (1 TODO)
- Agregar más datos de prueba según necesidades

---

## 5. Variables de Entorno Requeridas

### Frontend (`apps/web-next/.env`)
```
NEXT_PUBLIC_SUPABASE_URL=          # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Clave anónima de Supabase
NEXT_PUBLIC_POSTHOG_KEY=           # API key de PostHog (opcional)
NEXT_PUBLIC_POSTHOG_HOST=         # Host de PostHog (default: https://us.i.posthog.com)
NEXT_PUBLIC_GA_MEASUREMENT_ID=     # ID de medición de GA4 (opcional)
NEXT_PUBLIC_SITE_URL=              # URL del sitio (default: http://localhost:3000)
```

### Backend (`functions/api/.env`)
```
PORT=                              # Puerto del servidor (default: 4000)
SUPABASE_URL=                      # URL del proyecto Supabase
SUPABASE_SERVICE_ROLE=             # Service role key de Supabase (privilegiada)
RESEND_API_KEY=                    # API key de Resend para emails (opcional)
POSTHOG_KEY=                       # API key de PostHog (opcional)
POSTHOG_HOST=                      # Host de PostHog (default: https://us.i.posthog.com)
FRONTEND_ORIGIN=                   # Origen permitido para CORS (default: http://localhost:3000)
```

---

## 6. Próximos Pasos Sugeridos

### Prioridad Alta

1. **Crear archivos `.env`**
   - Copiar `apps/web-next/.env.example` → `apps/web-next/.env`
   - Copiar `functions/api/.env.example` → `functions/api/.env`
   - Completar con valores reales de Supabase

2. **Setup de Supabase**
   - Ejecutar `infra/sql/schema.sql` (crear tablas)
   - Ejecutar `infra/sql/rls.sql` (configurar RLS)
   - Ejecutar `infra/sql/seed.sql` (datos de prueba, opcional)

3. **Implementar endpoints básicos**
   - `POST /orders` - Crear orden con validación Zod
   - `GET /orders/:id` - Obtener orden desde Supabase
   - `POST /reservations` - Crear reserva con validación

4. **Conectar frontend con backend**
   - Implementar fetchers en `lib/api.ts` para cada endpoint
   - Usar TanStack Query en `app/panel/page.tsx` para cargar métricas
   - Mostrar estados de loading/error en el dashboard

### Prioridad Media

5. **Implementar callbacks de pago**
   - Completar `POST /payments/callback` con idempotencia
   - Validar firma del callback (Bancard/Dinelco)
   - Actualizar estado de órdenes

6. **Implementar check-in manual**
   - Completar `PATCH /orders/:id/use`
   - Validar que la orden está pagada y no usada
   - Actualizar `used_at` en Supabase

7. **Configurar emails**
   - Implementar servicio de emails con Resend o SendGrid
   - Crear templates para reservas y compras
   - Enviar emails de confirmación

8. **Configurar RLS en Supabase**
   - Ajustar políticas según sistema de autenticación
   - Implementar filtros por `local_id` según usuario autenticado

### Prioridad Baja

9. **Configurar Sentry**
   - Completar `lib/sentry.ts` en frontend
   - Configurar DSN en variables de entorno
   - Agregar tracking de errores en backend

10. **Agregar más datos de prueba**
    - Completar `infra/sql/seed.sql` con más locales y datos

11. **Implementar métricas avanzadas**
    - Completar `GET /metrics/summary` con agregaciones reales
    - Mostrar gráficos en el dashboard

---

## Resumen de Estado

- ✅ **Estructura**: Monorepo configurado correctamente
- ✅ **Rutas Frontend**: Normalizadas y funcionando
- ✅ **Rutas Backend**: Montadas correctamente con healthcheck
- ⚠️ **Variables de entorno**: Faltan archivos `.env` (usar `.env.example`)
- ⚠️ **Implementación**: 47 TODOs pendientes en código
- ⚠️ **RLS**: 9 TODOs pendientes en políticas SQL

**Estado general**: ✅ Estructura lista, ⚠️ Implementación pendiente

