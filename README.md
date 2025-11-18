# Tairet Mono-2

Monorepo PNPM para el MVP de Tairet - Sistema de gestión de eventos y reservas.

## Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + TanStack Query + react-hook-form + zod
- **Backend**: Express + TypeScript
- **Base de datos**: Supabase (PostgreSQL con RLS)
- **Analytics**: PostHog (producto) + GA4 (marketing)
- **Observabilidad**: Sentry
- **Zona horaria**: America/Asuncion
- **Moneda**: PYG

## MVP

El MVP incluye las siguientes piezas:

1. **Gestión de locales** - Crear y gestionar locales/venues
2. **Promociones** - Sistema de promos con imágenes y fechas
3. **Reservas (bares)** - Reservas con estado "en_revision"
4. **Venta de entradas** - Órdenes con precio fijo por local
5. **Check-in manual** - Marcar entradas como usadas (sin QR en MVP)
6. **Métricas básicas** - KPIs: vistas, clics WhatsApp, reservas, ventas
7. **Tracking de eventos** - PostHog para eventos de producto
8. **Emails** - Confirmación de reservas y compras (stub)
9. **Panel B2B** - Dashboard con KPIs para locales
10. **Landing B2C** - Página pública para usuarios finales

## Estructura del Monorepo

```
tairet-mono-2/
├── apps/
│   └── web-next/          # Frontend Next.js
├── functions/
│   └── api/               # Backend Express
├── packages/
│   ├── types/             # Tipos compartidos (Zod schemas)
│   └── ui/                # Componentes UI compartidos
├── infra/
│   └── sql/               # Schema, RLS y seed SQL para Supabase
└── .devcontainer/         # DevContainer para VS Code
```

## Quick Start (Stage)

### Prerequisitos

- Node.js 18+
- pnpm 10+
- Supabase (proyecto configurado)

### Setup inicial

1. **Variables de entorno**:
   - Copiar `apps/web-next/.env.example` → `apps/web-next/.env` y completar variables
   - Copiar `functions/api/.env.example` → `functions/api/.env` y completar variables

2. **Base de datos Supabase**:
   - Ejecutar `infra/sql/schema.sql` (crear tablas)
   - Ejecutar `infra/sql/rls.sql` (configurar RLS)
   - Ejecutar `infra/sql/seed.sql` (datos de prueba, opcional)

3. **Instalar dependencias**:
   ```bash
   pnpm install
   ```

### Desarrollo

#### Frontend (Next.js)

```bash
pnpm -C apps/web-next dev
```

El frontend estará disponible en `http://localhost:3000`

#### Backend (Express)

```bash
pnpm -C functions/api dev
```

El backend estará disponible en `http://localhost:4000`

### Build

```bash
# Build todos los paquetes
pnpm build

# Build específico
pnpm -C apps/web-next build
pnpm -C functions/api build
```

## Variables de Entorno

Copia los archivos `.env.example` y completa con tus valores:

- **Frontend**: `apps/web-next/.env.example` → `apps/web-next/.env`
- **Backend**: `functions/api/.env.example` → `functions/api/.env`

Ver los archivos `.env.example` para la lista completa de variables requeridas.

## Setup de Supabase

1. Crear proyecto en Supabase
2. Ejecutar scripts SQL en orden:
   - `infra/sql/schema.sql` - Crear tablas
   - `infra/sql/rls.sql` - Configurar RLS
   - `infra/sql/seed.sql` - Datos de prueba (opcional)

## Convenciones

### Commits

Usar [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` Nueva funcionalidad
- `fix:` Corrección de bug
- `docs:` Documentación
- `refactor:` Refactorización
- `chore:` Tareas de mantenimiento

### Rutas

- **B2C (público)**: `/app/page.tsx` (home pública)
- **B2B (panel)**: `/app/panel/*` (panel de gestión)

### Tipos

- Usar tipos de `@tairet/types` cuando sea posible
- Validar con Zod en backend y formularios

### Feature Flags

Usar `lib/flags.ts` en frontend para ocultar módulos no-MVP.

### Reglas del Proyecto

Ver `.cursor/rules.yaml` para reglas detalladas:
- No inventar APIs ni tablas
- Máximo 400 líneas por archivo
- RLS multi-tenant estricto
- Idempotencia en callbacks de pago
- Sin QR en MVP (check-in manual)

## Scripts Disponibles

```bash
# Raíz
pnpm build          # Build todos los paquetes
pnpm lint           # Lint todos los paquetes
pnpm typecheck      # Typecheck todos los paquetes

# Frontend
pnpm -C apps/web-next dev
pnpm -C apps/web-next build

# Backend
pnpm -C functions/api dev
pnpm -C functions/api build
```

## DevContainer

El proyecto incluye un DevContainer para VS Code:
1. Abrir en VS Code
2. Reabrir en contenedor
3. El contenedor configura automáticamente Node.js 22 y pnpm 10

## Testing con REST Client

El proyecto incluye un archivo `scripts/smoke.http` con requests de prueba compatibles con la extensión **REST Client** de VS Code.

### Cómo usar

1. **Instalar la extensión REST Client** (si no está instalada):
   - Abrir VS Code
   - Ir a Extensiones (Ctrl+Shift+X)
   - Buscar "REST Client" por Huachao Mao
   - Instalar

2. **Abrir el archivo**:
   - Abrir `scripts/smoke.http` en VS Code

3. **Ejecutar requests**:
   - Asegúrate de que el frontend y backend estén corriendo
   - Haz clic en "Send Request" que aparece arriba de cada request
   - O usa el atajo `Ctrl+Alt+R` (Windows/Linux) o `Cmd+Alt+R` (Mac)

El archivo incluye requests para:
- Healthcheck del backend (`GET /health`)
- Landing pública del frontend (`GET /`)
- Panel B2B del frontend (`GET /panel`)
- Endpoints de órdenes y pagos

## API Endpoints

### Orders

#### POST /orders
Crea una nueva orden de entrada.

**Body:**
```json
{
  "local_id": "uuid",
  "quantity": 2,
  "total_amount": 100000,
  "currency": "PYG",
  "customer_email": "email@example.com",
  "customer_name": "Nombre",
  "customer_phone": "+595981234567"
}
```

**Respuesta:** Orden creada con `id`, `status: "pending"`, `created_at`, etc.

#### GET /orders/:id
Obtiene una orden por ID (para debug).

**Respuesta:** Objeto de orden completo.

#### PATCH /orders/:id/use
Marca una orden como usada (check-in manual). Solo funciona si:
- `status = "paid"`
- `used_at IS NULL`

**Respuesta:** Orden actualizada con `used_at` actualizado.

**Errores:**
- `400`: Orden no está pagada o ya fue usada
- `404`: Orden no encontrada

### Payments

#### POST /payments/callback
Endpoint idempotente para recibir callbacks de Bancard/Dinelco.

**Body:**
```json
{
  "event_id": "txn_unique_id",
  "order_id": "uuid",
  "status": "approved"
}
```

**Nota:** `event_id` es el `transaction_id` único usado para idempotencia. Si el mismo `event_id` se envía múltiples veces, el endpoint retorna `200 OK` con `idempotent: true` sin efectos secundarios.

**Respuesta:**
```json
{
  "idempotent": false,
  "eventId": "uuid",
  "message": "Payment event processed"
}
```

Si el evento ya fue procesado:
```json
{
  "idempotent": true,
  "message": "Event already processed"
}
```

**Comportamiento:**
- Inserta en `payment_events` con `transaction_id` único
- Si `status = "approved"` o `"paid"`, actualiza la orden relacionada a `status = "paid"`
- Si el `event_id` ya existe, retorna idempotente sin efectos

### Reservas Bares (MVP)

#### POST /reservations
Crea una nueva reserva para un bar/restaurante.

**Body:**
```json
{
  "local_id": "uuid",
  "name": "Nombre del cliente",
  "email": "email@example.com",
  "phone": "+595981234567",
  "date": "2024-12-25T20:00:00Z",
  "guests": 4,
  "notes": "Mesa cerca de la ventana"
}
```

**Respuesta:** Reserva creada con `id`, `status: "en_revision"`, `created_at`, etc.

**Comportamiento:**
- Crea la reserva con estado `"en_revision"` (requiere confirmación manual)
- Envía email de confirmación recibida (stub)

#### GET /locals/:id/reservations
Lista las reservas de un local específico.

**Respuesta:** Array de reservas ordenadas por `created_at` DESC (máximo 20).

**Campos retornados:** `id`, `name`, `date`, `guests`, `status`, `created_at`

**Nota:** El panel en `/panel` permite ver las últimas reservas ingresando el `local_id`.

#### PATCH /reservations/:id
Actualiza el estado de una reserva.

**Body:**
```json
{
  "status": "confirmed"
}
```
o
```json
{
  "status": "cancelled"
}
```

**Comportamiento:**
- Solo permite cambiar estado desde `"en_revision"` a `"confirmed"` o `"cancelled"`.
- Si la reserva ya fue procesada (status es `"confirmed"` o `"cancelled"`), retorna error 400.
- Cuando se confirma (`status: "confirmed"`), envía email de confirmación usando `sendReservationConfirmedEmail`.
- Cuando se cancela (`status: "cancelled"`), no se envía email.
- Actualiza el campo `updated_at` automáticamente.

**Respuesta:** Reserva actualizada con los mismos campos que `GET /locals/:id/reservations`.

**Nota:** `sendReservationReceivedEmail` se usa al crear la reserva (POST). `sendReservationConfirmedEmail` se usa solo cuando se confirma la reserva (PATCH).

### WhatsApp Clicks (MVP)

#### POST /events/whatsapp_click
Guarda la intención de contacto por WhatsApp.

**Body:**
```json
{
  "local_id": "uuid",
  "phone": "+595981234567",
  "source": "landing_boliche"
}
```

**Respuesta:**
```json
{
  "ok": true
}
```

#### GET /events/whatsapp_clicks/count?localId={uuid}
Devuelve la cantidad de clics registrados para un local específico.

**Respuesta:**
```json
{
  "local_id": "uuid",
  "count": 12
}
```

**Nota:** El panel en `/panel` permite consultar los clics por `local_id`.

### Promos (MVP)

#### GET /locals/:id/promos
Lista las promos del local junto con su contador de vistas.

**Respuesta:**
```json
[
  {
    "id": "uuid",
    "title": "2x1 en tragos",
    "view_count": 12,
    "start_date": "2025-01-10T21:00:00Z",
    "end_date": "2025-01-11T03:00:00Z"
  }
]
```

#### POST /locals/:id/promos
Crea una nueva promo informativa para el local.

**Body:**
```json
{
  "title": "2x1 en tragos",
  "description": "Solo viernes",
  "image_url": "https://example.com/promo.jpg",
  "start_date": "2025-01-10T21:00:00Z",
  "end_date": "2025-01-11T03:00:00Z"
}
```

#### POST /events/promo_open
Registra una vista/clic de la promo.

**Body:**
```json
{
  "promo_id": "uuid",
  "local_id": "uuid",
  "source": "panel"
}
```

**Nota:** El panel en `/panel` identifica la "Promo más vista" usando `view_count`.

### Metrics Summary (MVP)

#### GET /metrics/summary
Devuelve KPIs principales del local para un rango de fechas.

**Parámetros:** `localId` (obligatorio), `from` y `to` (opcionales, ISO string).

**Respuesta:**
```json
{
  "local_id": "uuid",
  "range": {
    "from": "2025-01-01T00:00:00.000Z",
    "to": "2025-01-31T23:59:59.999Z"
  },
  "kpis": {
    "whatsapp_clicks": 10,
    "profile_views": 5,
    "reservations_total": 8,
    "reservations_en_revision": 3,
    "reservations_confirmed": 4,
    "reservations_cancelled": 1,
    "orders_total": 6,
    "tickets_sold": 20,
    "tickets_used": 15,
    "revenue_paid": 150000,
    "top_promo": {
      "id": "promo-uuid",
      "title": "2x1 en tragos",
      "view_count": 12
    }
  }
}
```

**Nota:** El panel en `/panel` permite consultar estos KPIs ingresando el `local_id`.

### Actividad reciente (MVP)

#### GET /activity
Devuelve las últimas cinco acciones registradas para un local.

**Parámetros:** `localId` (obligatorio).

**Respuesta:**
```json
{
  "local_id": "uuid",
  "items": [
    {
      "type": "order_paid",
      "label": "Orden pagada (PYG 100000)",
      "timestamp": "2025-01-12T03:15:00.000Z",
      "meta": {
        "order_id": "uuid",
        "amount": 100000
      }
    }
  ]
}
```

**Nota:** En `/panel` se puede consultar esta información en el bloque "Actividad Reciente".

### Integración front público (Lovable / externo)

Cualquier landing externa (incluida la de Lovable) puede enviar eventos a la API para alimentar KPIs y actividad del panel:

- **POST `/events/profile_view`** – Registrar una visita al perfil. El campo `source` es opcional y aceptado.
- **POST `/events/whatsapp_click`** – Cuando el usuario hace clic en el botón de WhatsApp.
- **POST `/events/promo_open`** – Cuando abre una promo específica.
- **POST `/reservations`** – Para crear reservas desde un formulario público de bares.

Ejemplo básico con `fetch` desde cualquier frontend:

```ts
await fetch("http://localhost:4000/events/profile_view", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    local_id: "<uuid-del-local>",
    source: "lovable_landing",
    ip_address: "1.2.3.4",
    user_agent: window.navigator.userAgent
  }),
});
```

> No es necesario usar Next.js: cualquier sitio puede invocar estos endpoints. Los datos impactan en `/metrics/summary` (KPIs del panel) y `/activity` (historial de eventos), además de las métricas de promos y clics de WhatsApp.

## Licencia

Privado

