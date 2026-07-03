# Access Core Ticket Availability Rules Plan

## Estado

Plan aprobado para diseño.
No implementado todavía.

## Alcance

Aplica al panel de discotecas y al flujo de entradas pagas Access Core.
No aplica al panel de bares.
No toca Bancard producción.
No toca checkout público en la primera fase.
No toca métricas ni calendario.

## Decisión principal

Usar un modelo híbrido:

- Reglas y excepciones como fuente durable de configuración.
- `access_stock_limits` como stock efectivo materializado para mantener funcionando el checkout actual.
- No consultar reglas directamente desde checkout en la primera fase.

## Problema del modelo actual

`access_stock_limits` funciona como stock efectivo por fecha, pero no como configuración principal.

Limitaciones:

- no expresa intención comercial;
- no modela "viernes 50, sábado 80" como una regla editable;
- no conserva rangos;
- no modela excepciones claramente;
- obliga a cargar o editar por fecha;
- dificulta una UI clara para dueños de discoteca.

## Modelo actual relevante

- `access_ticket_types`: catálogo de tipos de entrada. Define origen local/evento, nombre, descripción, precio, moneda, `payment_kind`, cantidad de accesos por unidad, estado activo y orden.
- `access_stock_limits`: stock efectivo por tipo de entrada y fecha de acceso. Es la tabla que el checkout actual consulta para saber si una entrada está configurada y si tiene stock.
- `access_stock_reservations`: bloqueos de stock generados por órdenes. Cuenta reservas pendientes no expiradas, consumos y holds manuales para evitar sobreventa.
- `access_orders`: orden Access Core con fecha de acceso, comprador, monto, estado de pago y vencimiento.
- `access_order_items`: snapshot de los tipos de entrada comprados dentro de una orden.
- `access_entries`: unidades emitidas después de pago aprobado, con token de check-in y estado de uso.
- `/public/locals/by-slug/:slug/access-catalog`: catálogo público de entradas pagas activas para checkout B2C.
- `create_access_paid_checkout`: RPC transaccional que valida tickets pagados, exige stock configurado en `access_stock_limits`, calcula disponibilidad y crea reservas.

## Modelo durable propuesto

### `access_ticket_availability_rules`

Campos propuestos:

- `id uuid primary key`
- `access_ticket_type_id uuid not null`
- `source_type text not null`
- `local_id uuid null`
- `event_id uuid null`
- `name text null`
- `valid_from date not null`
- `valid_to date not null`
- `active boolean not null default true`
- `deleted_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `valid_from <= valid_to`
- `source_type` compatible con `local_id` / `event_id`
- FK a `access_ticket_types`
- evitar reglas activas ambiguas en backend inicialmente

Índices:

- por `local_id`, `access_ticket_type_id`, `active`, `valid_from`, `valid_to`, `deleted_at`

### `access_ticket_availability_rule_weekdays`

Campos propuestos:

- `id uuid primary key`
- `rule_id uuid not null`
- `iso_weekday integer not null`
- `stock_mode text not null`
- `capacity integer null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `iso_weekday between 1 and 7`
- `stock_mode in ('limited', 'unlimited')`
- `limited` exige `capacity > 0`
- `unlimited` exige `capacity null`
- `unique(rule_id, iso_weekday)`

### `access_ticket_availability_exceptions`

Campos propuestos:

- `id uuid primary key`
- `access_ticket_type_id uuid not null`
- `source_type text not null`
- `local_id uuid null`
- `event_id uuid null`
- `access_date date not null`
- `exception_mode text not null`
- `capacity integer null`
- `reason text null`
- `active boolean not null default true`
- `deleted_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`exception_mode`:

- `closed`
- `limited`
- `unlimited`

Constraints:

- `source_type` compatible con `local_id` / `event_id`
- `limited` exige `capacity > 0`
- `unlimited` exige `capacity null`
- `closed` no debe requerir `capacity`
- una excepción activa por ticket+fecha

## RLS y grants

- Habilitar RLS en tablas nuevas.
- Revocar acceso de `anon` / `authenticated`.
- Usar acceso vía API panel.
- Mutaciones owner-only.
- Staff read-only o sin acceso a configuración en la primera fase.
- No exponer tablas nuevas directamente al cliente.

## Materialización

Al guardar reglas/excepciones:

1. Validar reglas.
2. Validar excepciones.
3. Expandir fechas afectadas.
4. Calcular stock efectivo por fecha.
5. Verificar bloqueados existentes.
6. Rechazar si una capacidad nueva es menor a vendidos/reservados.
7. Upsert batch hacia `access_stock_limits`.
8. Responder resumen.

La materialización debe ser idempotente.

## Semántica de excepciones

- `closed`: evita nuevas ventas en una fecha puntual.
- `limited`: reemplaza la capacidad efectiva de esa fecha.
- `unlimited`: reemplaza la fecha como stock ilimitado.
- Las excepciones tienen prioridad sobre reglas.
- Nunca deben invalidar entradas ya vendidas.
- Nunca deben reducir capacidad por debajo de vendidos/reservados.

Nota abierta:
Verificar cómo representar `closed` en `access_stock_limits` sin romper constraints actuales. Opciones:

- permitir `capacity = 0` para stock efectivo cerrado;
- agregar modo efectivo `closed`;
- mantener `closed` solo en reglas y ajustar checkout más adelante;
- usar `stock_unconfigured` como bloqueo temporal, aunque no es UX ideal.

Recomendación preliminar:

No decidir la representación final de `closed` hasta revisar constraints actuales de `access_stock_limits` y `create_access_paid_checkout`.

La migración no debe asumir `capacity = 0` si el modelo actual exige `capacity > 0` para stock limitado.

## Endpoints propuestos

- `GET /panel/access/config`
- `PUT /panel/access/ticket-types/:id/availability`
- `POST /panel/access/ticket-types/:id/availability/materialize` opcional
- `POST/PATCH/DELETE /panel/access/ticket-types/:id/availability/exceptions/:exceptionId` opcional

Reglas:

- owner-only para mutaciones.
- tenant isolation por `req.panelUser.localId`.
- no tocar checkout público en primera fase.

## UI target

Primera fase:

- cards por entrada;
- estado activa/inactiva;
- precio;
- resumen de disponibilidad;
- entrada seleccionada;
- regla principal o reglas no solapadas;
- capacidad distinta por noche;
- excepciones por fecha;
- desactivar con confirmación;
- sin ventas avanzadas.

Futuro:

- ventas por entrada;
- ocupación por noche;
- ingresos por entrada;
- exportación;
- tendencia.

## Qué hacer con Slice 2A

Estado actual:

- El prototipo Slice 2A quedó guardado en stash como referencia técnica:
  "wip slice 2a range prototype before availability rules".
- No forma parte del estado productivo ni debe commitearse como API final.

- No commitear UI actual de "Aplicar por rango" como final.
- No tomar `/stock-limits/range` como API final de producto.
- Conservar ideas:
  - expansión de fechas;
  - ISO weekdays;
  - validación de fecha civil;
  - cálculo de bloqueados;
  - batch upsert;
  - `capacity_below_reserved`.
- Reutilizar esa lógica dentro del materializador durable.

## Fases recomendadas

### Fase 0 — Documentación y decisión

Crear este documento y cerrar decisión.

### Fase 1 — Diseño SQL

Preparar migración para reglas, weekdays y excepciones.
Review antes de aplicar.
No ejecutar migración sin aprobación.

### Fase 2 — Backend availability

Implementar endpoints owner-only y materializador.
Mantener checkout intacto.

### Fase 3 — UI Entradas target

Rediseñar `/panel/access` con cards, reglas y excepciones.
No incluir ventas avanzadas todavía.

### Fase 4 — QA Access Core

Validar:

- regla viernes 50/sábado 80;
- excepción `closed`;
- excepción `limited`;
- excepción `unlimited`;
- capacidad menor a vendidos/reservados;
- checkout sigue usando `access_stock_limits`;
- staff no muta.

### Fase 5 — Ventas por entrada

Implementar analytics específicos de la entrada seleccionada sin pisar Métricas globales.

## Riesgos

- reglas solapadas;
- inconsistencias de materialización;
- `closed` sin representación clara en stock efectivo;
- rollback;
- RLS/grants;
- owner/staff;
- rangos grandes;
- checkout público;
- futuras métricas.

## Criterio de avance

No implementar UI final hasta tener definido el modelo durable.
No tocar checkout hasta que la materialización esté probada.
No mezclar ventas por entrada en el primer slice.