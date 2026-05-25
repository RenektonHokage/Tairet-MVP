# Operational Activity Log Plan

## 1. Proposito

Este documento planifica un activity log operativo para el panel de Tairet, enfocado en entradas/free pass, check-ins y reservas.

El objetivo es dar trazabilidad simple y util: que el local pueda entender que paso con una entrada o reserva, cuando ocurrio y quien ejecuto la accion cuando aplica.

Este plan no implementa codigo. Define el alcance y el roadmap para pasar a slices posteriores.

No es un CRM, no es auditoria completa del panel y no registra trazabilidad durable QR/manual. Para este bloque alcanza con registrar `entrada validada`, sin distinguir si fue por scanner QR o validacion manual.

## 2. Alcance

Incluido:

- entradas/free pass;
- check-ins;
- validacion manual desde Entradas;
- reservas;
- historial operativo por registro;
- eventos acotados y filtrados por `local_id`;
- actor panel cuando la accion viene del panel.

No incluido:

- CRM;
- auditoria completa;
- reportes por staff;
- metricas avanzadas;
- export de activity;
- metodo QR/manual;
- paid flows;
- `/payments/callback`.

Este plan aplica al corte `free_pass only`.

## 3. Problema operativo que resuelve

El activity log debe responder preguntas operativas como:

- cuando se creo una entrada;
- cuando se valido una entrada;
- si hubo intento de validacion duplicada;
- cuando se creo una reserva;
- quien confirmo o cancelo una reserva desde el panel;
- si se actualizo la nota interna de una mesa;
- que paso antes de un reclamo de cliente o de una duda en puerta.

El objetivo es reducir incertidumbre operativa sin registrar ruido de UI.

No se deben registrar:

- busquedas;
- clicks visuales;
- refresh/polling;
- apertura de pantallas;
- intentos visuales sin cambio operativo.

## 4. Estado actual detectado

Discovery confirmado por repo:

- existe `GET /activity`;
- `GET /activity` requiere `panelAuth` y `requireRole(["owner", "staff"])`;
- `GET /activity` ignora el `localId` del query y usa `req.panelUser.localId`;
- `GET /activity` construye una timeline agregada y derivada desde:
  - `orders`;
  - `reservations`;
  - `payment_events`;
  - `whatsapp_clicks`;
  - `events_public`;
  - `promos`;
  - `profile_views`;
- `GET /activity` no usa una tabla persistente de eventos operativos por entidad;
- no se encontro una tabla dedicada de activity/audit/history para historial por entrada o reserva;
- `panelAuth` expone `req.panelUser.userId`, `req.panelUser.email`, `req.panelUser.localId` y `req.panelUser.role`;
- `panelAuth` alcanza para registrar actor panel sin depender de `panel_users.id`;
- `POST /orders` y `POST /reservations` son acciones publicas sin actor panel;
- `PATCH /panel/orders/:id/use` y `PATCH /panel/checkin/:token` actualizan `orders.used_at`;
- `PATCH /panel/reservations/:id` actualiza `status` o `table_note`;
- el schema visible tiene `orders`, `reservations`, `panel_users`, `events_public`, `payment_events`, tracking y tablas operativas, pero no una tabla de historial operativo dedicada.

Lectura:

- `GET /activity` sirve hoy como widget/timeline agregada del panel;
- `GET /activity` no debe tratarse como historial durable por registro;
- para el MVP de activity log operativo conviene crear un modelo nuevo y acotado;
- el activity log nuevo no debe reemplazar `GET /activity` hasta validar contrato y UI.

Fuentes revisadas en discovery:

- `docs/production/FREE_PASS_RELEASE_CANDIDATE.md`;
- `docs/production/ROLLBACK_BACKUP_AND_RECOVERY_RUNBOOK.md`;
- `docs/security/SERVICE_ROLE_MINIMIZATION_PLAN.md`;
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`;
- `docs/panel/MANUAL_ENTRY_VALIDATION_FALLBACK.md`;
- `docs/panel/PANEL_NEAR_REALTIME_AND_MULTI_DEVICE_SYNC_PLAN.md`;
- `docs/production/B7_FINAL_SMOKE_AND_GO_NO_GO.md`;
- `functions/api/src/routes/activity.ts`;
- `functions/api/src/routes/panel.ts`;
- `functions/api/src/routes/orders.ts`;
- `functions/api/src/routes/reservations.ts`;
- `functions/api/src/middlewares/panelAuth.ts`;
- `functions/api/src/middlewares/requireRole.ts`;
- `infra/sql/schema.sql`;
- `infra/sql/rls.sql`;
- `infra/sql/migrations/**`;
- `apps/web-next/lib/activity.ts`;
- `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`;
- `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`;
- `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`;
- `apps/web-next/components/panel/views/ReservationsView.tsx`.

## 5. Eventos MVP propuestos

| Event type | Entidad | Disparador | Actor | Metadata minima | Prioridad | Slice |
| --- | --- | --- | --- | --- | --- | --- |
| `order_created` | `order` | `POST /orders` exitoso | `customer` | `status`, `quantity`, `intended_date` si aplica | Alta | Slice 2 |
| `order_checked_in` | `order` | `PATCH /panel/orders/:id/use` exitoso o `PATCH /panel/checkin/:token` exitoso | `panel_user` | `status`, `used_at` | Alta | Slice 2 |
| `order_already_used_attempt` | `order` | Intento sobre orden existente, del tenant correcto y con `used_at` previo | `panel_user` | `used_at` previo | Media | Slice 2 |
| `reservation_created` | `reservation` | `POST /reservations` exitoso | `customer` | `status`, `guests`, fecha operacional si aplica | Alta | Slice 3 |
| `reservation_confirmed` | `reservation` | `PATCH /panel/reservations/:id` cambia a `confirmed` | `panel_user` | `status` | Alta | Slice 3 |
| `reservation_cancelled` | `reservation` | `PATCH /panel/reservations/:id` cambia a `cancelled` | `panel_user` | `status` | Alta | Slice 3 |
| `reservation_table_note_updated` | `reservation` | `PATCH /panel/reservations/:id` actualiza `table_note` | `panel_user` | indicador booleano de nota actualizada | Media | Slice 3 |

Reglas:

- no registrar `checkin_token`;
- no registrar email, telefono, documento, nombre completo ni nota interna por defecto;
- no registrar metodo QR/manual;
- no registrar busquedas, clicks, refreshes ni polling;
- no registrar token invalido sin orden encontrada;
- no registrar intentos duplicados que no puedan vincularse a una entidad del tenant correcto.

## 6. Modelo de evento recomendado

Recomendacion: crear una tabla nueva, por ejemplo `operational_activity_events`, y un helper backend pequeno.

Campos conceptuales:

```ts
{
  id,
  local_id,
  entity_type: "order" | "reservation",
  entity_id,
  event_type,
  actor_type: "panel_user" | "customer" | "system",
  actor_user_id,
  actor_role,
  message,
  metadata,
  created_at
}
```

Politica de datos:

- `local_id` es obligatorio;
- `entity_type` y `entity_id` son obligatorios para historial por registro;
- `actor_user_id` se completa con `req.panelUser.userId` cuando la accion viene del panel;
- `actor_role` se completa con `req.panelUser.role` cuando aplica;
- acciones publicas usan `actor_type = "customer"`;
- procesos sin actor claro usan `actor_type = "system"`;
- `metadata` debe ser minima y no debe contener PII innecesaria;
- no guardar `checkin_token`;
- no guardar `table_note` completo;
- no guardar metodo QR/manual en este bloque.

Helper recomendado:

- `recordOperationalActivity(input)`;
- best-effort: si falla el insert del evento, no debe romper la operacion core;
- debe loguear errores con `requestId` si esta disponible;
- debe recibir `local_id` ya validado por el flujo de negocio;
- debe usarse despues de que la accion principal se complete correctamente, salvo intentos duplicados ya usados, que son errores operativos controlados.

Indices recomendados:

- `(local_id, entity_type, entity_id, created_at desc)`;
- `(local_id, created_at desc)`;
- `(local_id, event_type, created_at desc)` si se usa vista general futura.

RLS/grants:

- tabla backend-only para `anon` y `authenticated`;
- lectura/escritura desde backend con service role mientras siga el modelo actual;
- no exponer Data API directa;
- mantener tenant enforcement en endpoints backend.

## 7. Roadmap por slices

### Slice 0 - Discovery/documentacion

Estado de este documento.

Resultado esperado:

- plan cerrado;
- decisiones de alcance explicitadas;
- eventos MVP definidos;
- riesgos y QA definidos.

### Slice 1 - Modelo/helper de activity

Objetivo:

- agregar tabla dedicada e indices;
- aplicar RLS/grants backend-only;
- crear helper backend `recordOperationalActivity(...)`.

Reglas:

- migracion pequena;
- no tocar UI;
- no tocar paid flows;
- no cambiar contratos existentes;
- helper best-effort para no romper flujos core.

Estado: `Implementado y validado`.

Archivos creados en Slice 1:

- `infra/sql/migrations/025_create_operational_activity_events.sql`;
- `functions/api/src/services/operationalActivity.ts`.

Que se creo:

- tabla `public.operational_activity_events`;
- primary key `operational_activity_events_pkey`;
- indices:
  - `idx_operational_activity_events_entity`;
  - `idx_operational_activity_events_local_created`;
  - `idx_operational_activity_events_type_created`;
- RLS activado;
- acceso directo de `anon` y `authenticated` revocado;
- helper backend `recordOperationalActivity(...)`.

Campos de la tabla:

- `id`;
- `local_id`;
- `entity_type`;
- `entity_id`;
- `event_type`;
- `actor_type`;
- `actor_user_id`;
- `actor_role`;
- `message`;
- `metadata`;
- `created_at`.

Checks y constraints:

- `entity_type in ('order', 'reservation')`;
- `actor_type in ('panel_user', 'customer', 'system')`;
- `actor_role is null or actor_role in ('owner', 'staff')`;
- `event_type` no vacio;
- `message` no vacio;
- `local_id references public.locals(id) on delete cascade`.

Validacion tecnica ejecutada:

- `pnpm -C functions/api typecheck` -> `OK`;
- `git diff --check` -> `OK`.

Validacion DB ejecutada:

- `table_exists` -> `operational_activity_events`;
- indices esperados presentes;
- primary key index `operational_activity_events_pkey` presente;
- RLS `relrowsecurity` -> `true`;
- grants para `anon` y `authenticated` -> `0 rows`;
- sin policies publicas.

Comportamiento del helper:

- `recordOperationalActivity(...)` inserta eventos en `operational_activity_events`;
- opera en modo best-effort;
- no lanza error al caller si falla el insert;
- loguea warning controlado;
- acepta `requestId` opcional;
- normaliza/sanitiza metadata minima;
- no debe usarse para guardar `checkin_token` ni PII sensible por defecto.

Alcance cerrado:

- no se conectaron eventos todavia;
- no se tocaron rutas de `orders`, `reservations` ni check-in;
- no se toco UI;
- no se toco `GET /activity` actual;
- no se tocaron paid flows ni `/payments/callback`;
- Slice 1 deja la base persistente y helper best-effort listo para Slice 2.

### Slice 2 - Eventos de Entradas/check-in

Objetivo:

- registrar `order_created`;
- registrar `order_checked_in`;
- registrar `order_already_used_attempt`.

Rutas candidatas:

- `POST /orders`;
- `PATCH /panel/orders/:id/use`;
- `PATCH /panel/checkin/:token`.

Reglas:

- no registrar `checkin_token`;
- no distinguir QR/manual;
- no registrar token invalido sin entidad;
- no cambiar reglas del scanner ni validacion manual;
- no romper near realtime de Entradas.

Estado: `Implementado y validado en runtime`.

Archivos de codigo modificados en Slice 2:

- `functions/api/src/routes/orders.ts`;
- `functions/api/src/routes/panel.ts`.

Eventos conectados:

- `order_created`;
- `order_checked_in`;
- `order_already_used_attempt`.

Rutas que registran eventos:

- `POST /orders` registra `order_created` despues de crear una orden/free pass exitosamente;
- `PATCH /panel/orders/:id/use` registra `order_checked_in` al validar manualmente desde Entradas;
- `PATCH /panel/orders/:id/use` registra `order_already_used_attempt` si la orden ya estaba usada;
- `PATCH /panel/checkin/:token` registra `order_checked_in` al validar por scanner/token;
- `PATCH /panel/checkin/:token` registra `order_already_used_attempt` si la orden ya estaba usada;
- token invalido o inexistente no crea evento.

Metadata final:

- `order_created`: `status`, `quantity`, `intended_date`, `payment_method`;
- `order_checked_in`: `status`, `used_at`;
- `order_already_used_attempt`: `status`, `used_at`.

Datos que no se guardan:

- `checkin_token`;
- email;
- telefono;
- documento;
- nombre;
- apellido;
- datos completos de cliente;
- metodo QR/manual;
- `checkin_method`;
- `checkin_source`;
- `used_method`.

QA runtime ejecutado:

- Entrada A, validacion manual desde Entradas:
  - orden creada -> `order_created` registrado correctamente;
  - `actor_type = customer`;
  - `message = Entrada creada`;
  - metadata contiene `status`, `quantity`, `intended_date`, `payment_method`;
  - validacion manual desde Entradas -> `PASS`;
  - `order_checked_in` registrado correctamente;
  - `actor_type = panel_user`;
  - `actor_role = owner`;
  - `message = Entrada validada`;
  - metadata contiene `status`, `used_at`;
  - reintento manual por `PATCH /panel/orders/:id/use` -> `409 Conflict`;
  - response `Order already used` con `usedAt` presente;
  - `order_already_used_attempt` registrado correctamente;
  - `message = Intento de validacion duplicado`;
  - metadata contiene `status`, `used_at`.
- Entrada B, validacion por scanner/token:
  - orden creada -> `order_created` registrado correctamente;
  - `actor_type = customer`;
  - `message = Entrada creada`;
  - metadata contiene `status`, `quantity`, `intended_date`, `payment_method`;
  - `PATCH /panel/checkin/:token` -> `200 OK`;
  - success payload mantiene `id`, `status`, `used_at`, `customer_name`, `customer_last_name` y `customer_document`;
  - success payload no incluye `local_id`;
  - `order_checked_in` registrado correctamente;
  - `actor_type = panel_user`;
  - `actor_role = owner`;
  - `message = Entrada validada`;
  - metadata contiene `status`, `used_at`;
  - reintento con el mismo token -> `409 Conflict`;
  - response `Order already used` con `usedAt` presente;
  - `order_already_used_attempt` registrado correctamente;
  - `message = Intento de validacion duplicado`;
  - metadata contiene `status`, `used_at`.
- Token invalido:
  - token inventado devuelve error controlado;
  - query posterior en `operational_activity_events` devuelve `0 rows`;
  - token invalido no crea evento -> `PASS`.
- Metadata sensible:
  - `has_checkin_token = false`;
  - `has_email = false`;
  - `has_phone = false`;
  - `has_document = false`;
  - `has_name = false`;
  - `has_last_name = false`;
  - `has_checkin_method = false`;
  - `has_checkin_source = false`;
  - `has_used_method = false`;
  - no se guarda PII en metadata;
  - no se guarda `checkin_token` en metadata;
  - no se registra distincion QR/manual en metadata.
- Smoke final:
  - `/health` -> `PASS`;
  - `x-request-id` presente -> `PASS`;
  - `GET /panel/orders/search` sigue funcionando -> `PASS`;
  - near realtime de Entradas sigue funcionando -> `PASS`;
  - `PATCH /panel/orders/:id/use` funciona -> `PASS`;
  - `PATCH /panel/checkin/:token` funciona -> `PASS`.

Alcance cerrado:

- no se conectaron eventos de Reservas todavia;
- no se creo UI de historial;
- no se modifico `GET /activity` actual;
- no se tocaron paid flows ni `/payments/callback`;
- no existe trazabilidad QR/manual.

Siguiente paso recomendado al cierre de Slice 2, ya ejecutado en Slice 3:

- Slice 3 - Eventos de Reservas:
  - `reservation_created`;
  - `reservation_confirmed`;
  - `reservation_cancelled`;
  - `reservation_table_note_updated`.

### Slice 3 - Eventos de Reservas

Objetivo:

- registrar `reservation_created`;
- registrar `reservation_confirmed`;
- registrar `reservation_cancelled`;
- registrar `reservation_table_note_updated`.

Rutas implementadas:

- `POST /reservations`;
- `PATCH /panel/reservations/:id`.

Reglas:

- no guardar contenido de `table_note`;
- no guardar PII comercial en metadata;
- no cambiar emails ni reglas de estado;
- no romper near realtime de Reservas.

Estado: `Implementado y validado en runtime`.

Archivos de codigo modificados en Slice 3:

- `functions/api/src/routes/reservations.ts`;
- `functions/api/src/routes/panel.ts`.

Eventos conectados:

- `reservation_created`;
- `reservation_confirmed`;
- `reservation_cancelled`;
- `reservation_table_note_updated`.

Rutas que registran eventos:

- `POST /reservations` registra `reservation_created` despues de crear una reserva exitosamente;
- `PATCH /panel/reservations/:id` registra `reservation_confirmed` cuando cambia estado a `confirmed`;
- `PATCH /panel/reservations/:id` registra `reservation_cancelled` cuando cambia estado a `cancelled`;
- `PATCH /panel/reservations/:id` registra `reservation_table_note_updated` cuando se actualiza `table_note`.

Metadata final:

- `reservation_created`: `status`, `guests`, `date`;
- `reservation_confirmed`: `status`;
- `reservation_cancelled`: `status`;
- `reservation_table_note_updated`: `table_note_updated: true`.

Datos que no se guardan:

- `name`;
- `last_name`;
- `email`;
- `phone`;
- `document`;
- `customer_name`;
- `customer_email`;
- `customer_phone`;
- `notes`;
- `table_note`;
- contenido de nota interna;
- datos completos del cliente.

QA runtime ejecutado:

- Reserva A, creacion, confirmacion y nota interna:
  - `reservation_created` -> `PASS`;
  - `actor_type = customer`;
  - `message = Reserva creada`;
  - metadata contiene `date`, `guests`, `status`;
  - `reservation_confirmed` -> `PASS`;
  - `actor_type = panel_user`;
  - `actor_role = owner`;
  - `message = Reserva confirmada`;
  - metadata contiene `status = confirmed`;
  - `reservation_table_note_updated` -> `PASS`;
  - `actor_type = panel_user`;
  - `actor_role = owner`;
  - `message = Nota interna actualizada`;
  - metadata contiene `table_note_updated = true`.
- Metadata sensible de Reserva A:
  - `has_name = false`;
  - `has_last_name = false`;
  - `has_email = false`;
  - `has_phone = false`;
  - `has_document = false`;
  - `has_customer_name = false`;
  - `has_customer_email = false`;
  - `has_customer_phone = false`;
  - `has_notes = false`;
  - `has_table_note = false`.
- Observacion de Reserva A:
  - un segundo cambio efectivo de nota interna genero un segundo evento `reservation_table_note_updated`;
  - esto no es fail porque hubo un cambio efectivo de nota;
  - guardar exactamente la misma nota sin cambios queda `N/A / no validado` porque la UI no expone claramente ese flujo sin cambio relevante.
- Reserva B, creacion y cancelacion:
  - `reservation_created` -> `PASS`;
  - `actor_type = customer`;
  - `message = Reserva creada`;
  - metadata contiene `date`, `guests`, `status`;
  - `reservation_cancelled` -> `PASS`;
  - `actor_type = panel_user`;
  - `actor_role = owner`;
  - `message = Reserva cancelada`;
  - metadata contiene `status = cancelled`.
- Metadata sensible de Reserva B:
  - `has_name = false`;
  - `has_last_name = false`;
  - `has_email = false`;
  - `has_phone = false`;
  - `has_document = false`;
  - `has_customer_name = false`;
  - `has_customer_email = false`;
  - `has_customer_phone = false`;
  - `has_notes = false`;
  - `has_table_note = false`.
- Smoke final:
  - `/health` -> `200 OK`;
  - body `{"ok":true}`;
  - `x-request-id` presente;
  - confirmar reserva desde panel -> `PASS`;
  - editar nota interna desde panel -> `PASS`;
  - cancelar reserva desde panel -> `PASS`;
  - listado de reservas operativo durante las pruebas -> `PASS`.

Alcance cerrado:

- no se tocaron Entradas/check-in;
- no se creo UI de historial;
- no se modifico `GET /activity` actual;
- no se tocaron paid flows ni `/payments/callback`;
- no se tocaron SQL/RLS/migraciones;
- no se guardo PII sensible ni contenido de `table_note` en metadata.

Estado actualizado del roadmap:

- Slice 1 - Modelo/helper backend: implementado y validado;
- Slice 2 - Eventos de Entradas/check-in: implementado y validado;
- Slice 3 - Eventos de Reservas: implementado y validado;
- Slice 4A - Endpoint historial por entidad: implementado y validado;
- Slice 4B - UI historial por registro: implementado y validado;
- Slice 5 - Vista "Ultimas acciones": posterior/opcional.

Siguiente paso recomendado:

- Slice 4B - UI historial por registro, sin reemplazar `GET /activity` actual y sin cargar historiales de todas las cards por defecto.

### Slice 4 - UI historial por registro

Objetivo:

- mostrar historial dentro de una entrada o reserva especifica.

#### Slice 4A - Endpoint historial por entidad

Estado: `Implementado y validado en runtime`.

Endpoint:

```http
GET /panel/activity/entity?entity_type=order|reservation&entity_id=<uuid>
```

Contrato de respuesta:

```json
{
  "items": [
    {
      "id": "...",
      "entity_type": "order|reservation",
      "entity_id": "...",
      "event_type": "...",
      "actor_type": "panel_user|customer|system",
      "actor_role": "owner|staff|null",
      "message": "...",
      "metadata": {},
      "created_at": "..."
    }
  ]
}
```

Controles:

- `panelAuth`;
- `requireRole(["owner", "staff"])`;
- `entity_type` requerido y validado como `order | reservation`;
- `entity_id` requerido y validado como UUID;
- filtro obligatorio por `local_id = req.panelUser.localId`;
- no acepta `local_id` por query;
- entidad sin eventos devuelve `200` con `items: []`.

Campos y datos no expuestos:

- `local_id`;
- `actor_user_id`;
- `checkin_token`;
- emails;
- telefonos;
- documentos;
- nombres;
- apellidos;
- `notes`;
- `table_note`;
- payment data;
- datos completos de cliente.

Metadata:

- se devuelve filtrada por claves permitidas por `event_type`;
- no se exponen claves sensibles aunque existieran por error en metadata.

QA runtime ejecutado:

- Owner correcto de Dlirio:
  - `GET /panel/me` confirmo `role = owner`, `local_id = 550e8400-e29b-41d4-a716-446655440006`, `slug = dlirio`, `type = club`;
  - `ORDER_ID d8c5eea2-c284-4a8c-9b6f-81a9a5842b90` -> `200 OK`;
  - eventos devueltos: `order_created`, `order_checked_in`, `order_already_used_attempt`;
  - `ORDER_ID 59864b03-ded8-4a94-a53c-3848c757df05` -> `200 OK`;
  - eventos devueltos: `order_created`, `order_checked_in`, `order_already_used_attempt`.
- Tenant isolation:
  - token de Mckharthys Bar consultando orden de Dlirio Club devolvio `200` con `items: []`;
  - no expuso eventos de otro tenant.
- Campos sensibles en ordenes:
  - scan sensible sin resultados;
  - no aparece `local_id`;
  - no aparece `actor_user_id`;
  - no aparece `checkin_token`;
  - no aparecen `customer_email`, `customer_phone`, `customer_document`, `customer_name`, `customer_last_name`;
  - no aparecen `checkin_method`, `checkin_source` ni `used_method`.
- Reservas:
  - owner consulto historial de `RESERVATION_ID d40edf43-975e-41e8-9675-94480b69071b` -> `PASS`;
  - response `200 OK`;
  - eventos devueltos: `reservation_created`, `reservation_confirmed`, `reservation_table_note_updated`;
  - staff del mismo local pudo consultar historial de reserva -> `PASS`;
  - staff order history en Dlirio queda `N/A no blocker`, porque el rol staff fue validado en el mismo endpoint para reservas del mismo tenant y ordenes quedaron validadas con owner del tenant correcto.
- Campos sensibles en reservas:
  - scan sensible sin resultados;
  - no aparece `local_id`;
  - no aparece `actor_user_id`;
  - no aparece PII;
  - no aparecen `notes` ni `table_note`.
- Seguridad y errores:
  - sin auth -> `401` y no devuelve eventos;
  - `entity_type` invalido -> `400 Invalid entity_type`;
  - `entity_id` invalido -> `400 Invalid entity_id`;
  - parametros faltantes -> `400`;
  - UUID valido sin eventos -> `200` con `items: []`.
- Regresiones cercanas:
  - `GET /activity` actual sigue funcionando -> `PASS`;
  - `/health` -> `200 OK`;
  - body `{"ok":true}`;
  - `x-request-id` presente.

Alcance cerrado:

- no se creo UI de historial;
- no se reemplazo `GET /activity` actual;
- no se creo vista "Ultimas acciones";
- no se tocaron eventos nuevos de escritura;
- no se tocaron paid flows ni `/payments/callback`.

Estado actualizado del roadmap:

- Slice 1 - Modelo/helper backend: implementado y validado;
- Slice 2 - Eventos de Entradas/check-in: implementado y validado;
- Slice 3 - Eventos de Reservas: implementado y validado;
- Slice 4A - Endpoint historial por entidad: implementado y validado;
- Slice 4B - UI historial por registro: proximo paso recomendado;
- Slice 5 - Vista "Ultimas acciones": posterior/opcional.

#### Slice 4B - UI historial por registro

Objetivo:

- mostrar historial dentro de una entrada o reserva especifica usando el endpoint validado de Slice 4A.

Estado: `Implementado y validado en runtime`.

Archivos de codigo modificados en Slice 4B:

- `apps/web-next/lib/activity.ts`;
- `apps/web-next/components/panel/OperationalActivityHistory.tsx`;
- `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`;
- `apps/web-next/components/panel/views/ReservationCard.tsx`;
- `apps/web-next/components/panel/views/ReservationsView.tsx`;
- `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`.

Donde aparece:

- Entradas: historial dentro de cada card de entrada;
- Reservas: historial dentro de cada card/reserva.

Funcionamiento:

- el historial esta cerrado por defecto;
- usa lazy-load y consulta `GET /panel/activity/entity` solo al abrir;
- reutiliza datos ya cargados mientras el bloque sigue montado;
- permite `Actualizar historial`;
- no hace polling de historial;
- no carga historiales de todas las cards por defecto.

Datos visibles en UI:

- fecha/hora;
- `message`;
- actor legible:
  - Cliente;
  - Sistema;
  - Owner;
  - Staff;
  - Panel como fallback.

Datos que no se muestran:

- metadata cruda;
- PII;
- `checkin_token`;
- `table_note`;
- `notes`;
- `actor_user_id`;
- `local_id`;
- metodo QR/manual.

Bug corregido:

- el historial quedaba en `Cargando historial...` aunque el endpoint respondia `200 OK` con `items`;
- causa encontrada: `mountedRef.current` podia quedar en `false` por cleanup/remount de React Strict Mode en desarrollo;
- fix aplicado: `OperationalActivityHistory` vuelve a setear `mountedRef.current = true` al montar;
- `getPanelEntityActivity(...)` normaliza la respuesta para devolver siempre `{ items: [...] }`, usando `[]` si no viene un array.

QA runtime ejecutado:

- Historial en Reservas renderiza eventos correctamente -> `PASS`;
- Historial en Entradas renderiza eventos correctamente -> `PASS`;
- loading infinito corregido -> `PASS`;
- lazy-load -> `PASS`:
  - no llama `/panel/activity/entity` antes de abrir Historial;
  - llama al endpoint recien al abrir el bloque;
- cerrar y volver a abrir Historial -> `PASS`;
- boton `Actualizar historial` -> `PASS`;
- historial no muestra metadata cruda ni datos sensibles -> `PASS`:
  - no muestra PII;
  - no muestra `checkin_token`;
  - no muestra `table_note`;
  - no muestra `notes`;
  - no muestra `actor_user_id`;
  - no muestra `local_id`;
  - no muestra metodo QR/manual;
- empty state -> `PASS`;
- Reservas/listado sigue funcionando -> `PASS`;
- Entradas/listado sigue funcionando -> `PASS`;
- near realtime sigue funcionando -> `PASS`;
- edicion de `table_note` sigue funcionando -> `PASS`;
- `pnpm -C apps/web-next typecheck` -> `PASS`;
- `git diff --check` -> `PASS`.

N/A operativo menor:

- error state no se valido en runtime;
- queda como `N/A operativo menor/no bloqueante` porque el flujo principal, empty state, lazy-load y render de eventos quedaron validados.

Alcance cerrado:

- no se toco backend;
- no se tocaron SQL/RLS/migraciones;
- no se tocaron endpoints;
- no se tocaron paid flows ni `/payments/callback`;
- no se creo vista "Ultimas acciones";
- no se reemplazo `GET /activity` actual;
- no se convirtio en CRM ni auditoria completa.

Estado actualizado del roadmap:

- Slice 1 - Modelo/helper backend: implementado y validado;
- Slice 2 - Eventos de Entradas/check-in: implementado y validado;
- Slice 3 - Eventos de Reservas: implementado y validado;
- Slice 4A - Endpoint historial por entidad: implementado y validado;
- Slice 4B - UI historial por registro: implementado y validado;
- Slice 5 - Vista "Ultimas acciones": posterior/opcional.

Siguiente paso recomendado:

- cerrar el MVP de activity log operativo por registro;
- no abrir Slice 5 salvo necesidad operativa concreta;
- si se continua, Slice 5 debe ser opcional y separado.

Reglas UI:

- cargar historial lazy-load al abrir/expandir;
- no cargar historiales de todas las cards por defecto;
- mostrar mensaje, fecha/hora y actor si aplica;
- no mezclar con refresh/polling de listados.

### Slice 5 - Vista "Ultimas acciones"

Objetivo:

- vista o widget general de acciones recientes.

Reglas:

- opcional y posterior;
- reutilizar la tabla nueva;
- no reemplazar `GET /activity` actual hasta validar contrato/UI;
- evitar ruido y exceso de eventos.

## 8. UI propuesta

Primer UI recomendado: historial por registro, no vista global.

Entradas:

- agregar una accion o seccion colapsable `Historial`;
- mostrar eventos relevantes:
  - `Entrada creada`;
  - `Entrada validada`;
  - `Intento de validacion duplicado`;
- no mostrar si fue QR o manual;
- no mostrar `checkin_token`;
- no mostrar PII del comprador dentro del evento.

Reservas:

- agregar seccion `Historial` en card/detalle;
- mostrar eventos:
  - `Reserva creada`;
  - `Reserva confirmada`;
  - `Reserva cancelada`;
  - `Nota interna actualizada`;
- no mostrar el contenido de `table_note`;
- mostrar actor panel cuando aplique.

Copy recomendado:

- `Entrada creada`;
- `Entrada validada`;
- `Intento de validacion duplicado`;
- `Reserva creada`;
- `Reserva confirmada`;
- `Reserva cancelada`;
- `Nota interna actualizada`.

Vista general futura:

- `Ultimas acciones`;
- maxima prioridad despues de validar historial por registro;
- puede mostrar los ultimos eventos por local;
- no debe convertirse en CRM ni reporte avanzado.

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| PII innecesaria | Exposicion de datos sensibles | Metadata minima; no guardar tokens, emails, telefonos, documentos, nombres completos ni notas internas por defecto. |
| Tenant isolation incorrecta | Un local podria ver eventos de otro | `local_id` obligatorio en writes y reads; endpoints panel filtran por `req.panelUser.localId`. |
| Ruido operacional | Historial poco util | Registrar solo cambios operativos, no clicks, busquedas, refreshes ni aperturas. |
| Actor no disponible | Evento ambiguo | Usar `customer` o `system`; no inventar staff. |
| Duplicados | Timeline confusa | Event types claros; best-effort sin idempotencia compleja en MVP salvo ruido real. |
| Performance | Queries lentas en panel | Indices por local, entidad y `created_at`; lazy-load por registro. |
| Migracion | Riesgo DB | Slice separado con backup/checklist y QA API/DB. |
| Mezcla con `GET /activity` | Romper widget existente | Mantener `GET /activity` actual; no reemplazarlo en MVP. |
| Metodo QR/manual | Reabrir decision de trazabilidad | Mantener fuera de alcance; registrar solo `Entrada validada`. |

## 10. QA recomendado

QA por Slice 1:

- migracion aplicada en entorno controlado;
- tabla existe;
- indices existen;
- grants/RLS backend-only verificados;
- helper inserta evento minimo;
- fallo del helper no rompe flujo de prueba.

QA por Slice 2:

- crear entrada y verificar `order_created`;
- validar entrada manualmente y verificar `order_checked_in`;
- validar entrada por scanner y verificar `order_checked_in`;
- intentar validar entrada ya usada y verificar `order_already_used_attempt`;
- token invalido no crea evento sin entidad;
- historial no expone `checkin_token`;
- `PATCH /panel/checkin/:token` sigue funcionando;
- `PATCH /panel/orders/:id/use` sigue funcionando;
- `GET /panel/orders/search` sigue funcionando;
- near realtime de Entradas no se rompe.

QA por Slice 3:

- crear reserva y verificar `reservation_created`;
- confirmar reserva y verificar `reservation_confirmed`;
- cancelar reserva y verificar `reservation_cancelled`;
- editar `table_note` y verificar `reservation_table_note_updated`;
- el evento de nota no contiene la nota interna;
- `POST /reservations` sigue funcionando;
- `PATCH /panel/reservations/:id` sigue funcionando;
- near realtime de Reservas no se rompe.

QA por Slice 4:

- owner ve historial de su local;
- staff ve historial de su local;
- otro tenant no puede ver historial;
- UUID invalido devuelve error controlado;
- entidad inexistente devuelve respuesta controlada;
- historial no expone email, telefono, documento, `checkin_token` ni `table_note`;
- UI carga historial bajo demanda;
- UI no dispara requests por todas las cards;
- `/health` 200;
- `x-request-id` presente.

QA transversal:

- `GET /activity` existente no se rompe;
- Activity/Metrics/Dashboard siguen cargando;
- no se tocan paid flows;
- `/payments/callback` sigue fuera del corte;
- Sentry captura errores si aparecen.

## 11. Fuera de alcance

Fuera de este bloque:

- paid flows;
- `/payments/callback`;
- CRM;
- auditoria completa;
- reportes por staff;
- metricas avanzadas;
- export de activity;
- metodo QR/manual;
- `checkin_method`;
- `checkin_source`;
- `used_method`;
- cambios de scanner;
- cambios de reservas fuera de activity;
- cambios B2C UI;
- cambios a near realtime;
- reemplazo de `GET /activity` actual;
- WebSocket/SSE/Supabase Realtime.

## 12. Decisiones futuras

Evaluar despues del MVP:

- distinguir QR/manual si aparece necesidad real de auditoria;
- ultimas 10 validaciones en dashboard;
- intentos duplicados por rango horario;
- activity global consolidada;
- reportes operativos por staff;
- export de activity;
- integracion con Sentry/logs para troubleshooting;
- auditoria mas completa con cambios de catalogo, promos o perfil;
- retencion de eventos;
- politica de purga;
- endpoint o widget para `Ultimas acciones`.
