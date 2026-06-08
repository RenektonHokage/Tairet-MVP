# Ibiza Slice 3E.4E: contrato endpoint read-only de activity

## 1. Proposito

Este documento define el contrato tecnico y operativo para exponer el activity log de Eventos mediante un endpoint read-only protegido:

- `GET /panel/events/:eventId/activity`

Este paso es solo ASK / DOCS. No implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, panel UI, pagos, activity local ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado validado antes de este contrato:

- Slice 3E.4B: `public.event_activity_events` creada y QA DB PASS completo.
- Slice 3E.4B: `event_id` es tenant obligatorio, `source` es columna propia, RLS esta enabled, grants cerrados para `anon`/`authenticated` y `service_role` operativo.
- Slice 3E.4B: la tabla no tiene columnas `local_id`, `checkin_token`, QR payload/base64 ni PII directa.
- Slice 3E.4C: helper `recordEventActivity` creado, best-effort, con source controlado, actor panel/system y sanitizacion de metadata.
- Slice 3E.4F1: activity en `manual-issue` QA PASS; registra `event_order_manual_issued` y `event_entry_issued`.
- Slice 3E.4F2: activity en emails QA PASS; registra `event_entry_email_sent` / `event_entry_email_failed` con `source = automatic_email` o `manual_email`; skipped `>20` no registra activity de email.
- Slice 3E.4G1: activity en check-in QR QA PASS; registra valid, already used, outside window, voided, invalid token y malformed token sin guardar token ni raw URL.
- Slice 3E.4G2: activity en fallback manual QA PASS; registra valid, already used, outside window y voided con `source = manual`; no registra `entry_not_found`, `invalid_entry_id`, overrides, `event_not_operable`, sin auth o sin membership.

## 3. Fuentes revisadas

Documentos revisados:

- `docs/events/IBIZA_EVENT_ACTIVITY_LOG_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_INTEGRATION_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_MANUAL_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`

Codigo y SQL revisados:

- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/services/eventActivity.ts`
- `functions/api/src/middlewares/eventPanelAuth.ts`
- `functions/api/src/middlewares/requireEventRole.ts`
- `functions/api/src/services/supabase.ts`
- `infra/sql/migrations/032_create_event_activity_events.sql`

## 4. Endpoint definido

Endpoint futuro:

- `GET /panel/events/:eventId/activity`

Proteccion:

- `eventPanelAuth`
- `requireEventRole(["owner", "staff"])`

Objetivo:

- listar historial operativo del evento;
- filtrar por action, source, entity type y relaciones principales;
- paginar resultados;
- devolver actor legible sin exponer auth IDs;
- devolver metadata sanitizada;
- no exponer PII, tokens ni payloads QR.

No se define `GET /activity` global ni activity local. Este endpoint pertenece solo al panel de Eventos y usa tenant por `event_id`.

## 5. Tenant safety

Reglas obligatorias:

- `event_id` se toma solo desde `req.eventPanelUser.eventId`.
- `eventId` del path es validado por `eventPanelAuth`.
- No aceptar `event_id` por query ni body.
- No aceptar `local_id` por query ni body.
- No usar `panel_users`.
- No usar `local_id`.
- Todas las queries filtran por `event_activity_events.event_id = req.eventPanelUser.eventId`.
- Owner/staff solo ven activity del evento donde tienen membership en `event_panel_users`.
- Usuario local sin membership de evento debe responder `403` desde middleware.
- Evento inexistente debe responder `404` desde middleware.
- `eventId` invalido debe responder `400` desde middleware.

## 6. Query params

Parametros soportados:

- `action`
  - opcional;
  - allowlist de `EVENT_ACTIVITY_ACTIONS`;
  - filtra por `event_activity_events.action`.
- `source`
  - opcional;
  - allowlist de `EVENT_ACTIVITY_SOURCES`;
  - filtra por `event_activity_events.source`.
- `entity_type`
  - opcional;
  - allowlist de `EVENT_ACTIVITY_ENTITY_TYPES`;
  - filtra por `event_activity_events.entity_type`.
- `event_order_id`
  - opcional;
  - UUID valido;
  - filtra por `event_activity_events.event_order_id`.
- `event_order_entry_id`
  - opcional;
  - UUID valido;
  - filtra por `event_activity_events.event_order_entry_id`.
- `event_ticket_type_id`
  - opcional;
  - UUID valido;
  - filtra por `event_activity_events.event_ticket_type_id`.
- `page`
  - opcional;
  - integer;
  - default `1`;
  - minimo `1`.
- `page_size`
  - opcional;
  - integer;
  - default `25`;
  - minimo `1`;
  - maximo `100`;
  - si `page_size > 100`, devolver `400 invalid_query`.
- `sort`
  - opcional;
  - default `created_at_desc`;
  - valores iniciales permitidos: `created_at_desc`, `created_at_asc`.

Parametros desconocidos:

- devolver `400 invalid_query`.

No aceptar:

- `event_id`
- `local_id`
- `auth_user_id`
- `actor_auth_user_id`
- `checkin_token`
- `metadata`
- `q`

Decision sobre busqueda textual:

- No incluir `q` en el primer corte.
- Motivo: para MVP operativo, filtros por IDs, action, source y entity type son suficientes; ademas evita busquedas amplias sobre mensajes/metadata.
- Si se necesita busqueda textual futura, debe ser otro slice con limites estrictos y revision de PII.

## 7. Allowlists

`action` permitidos:

- `event_order_manual_issued`
- `event_entry_issued`
- `event_entry_email_sent`
- `event_entry_email_failed`
- `event_entry_checked_in`
- `event_entry_already_used_attempt`
- `event_entry_outside_window_attempt`
- `event_entry_voided_attempt`
- `event_entry_invalid_token_attempt`

`source` permitidos:

- `qr`
- `manual`
- `automatic_email`
- `manual_email`
- `system`

`entity_type` permitidos:

- `event_order`
- `event_order_entry`
- `event_email`
- `event_checkin`

Estas allowlists deben mantenerse alineadas con `functions/api/src/services/eventActivity.ts` y `infra/sql/migrations/032_create_event_activity_events.sql`.

## 8. Response contract

Respuesta `200`:

```json
{
  "items": [
    {
      "id": "uuid",
      "created_at": "2026-06-08T10:00:00.000Z",
      "action": "event_entry_checked_in",
      "source": "manual",
      "entity_type": "event_checkin",
      "entity_id": "uuid",
      "message": "Entrada validada manualmente",
      "actor": {
        "type": "event_panel_user",
        "role": "owner",
        "label": "Owner Ibiza"
      },
      "relations": {
        "event_order_id": "uuid",
        "event_order_item_id": "uuid",
        "event_order_entry_id": "uuid",
        "event_ticket_type_id": "uuid"
      },
      "metadata": {
        "previous_checkin_status": "unused",
        "next_checkin_status": "used"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 1,
    "total_pages": 1
  }
}
```

Notas:

- `source` puede ser `null` si existiera una fila legacy/futura sin source, pero los flujos actuales validados escriben source controlado.
- `relations.*` puede ser `null` si la activity es event-level, por ejemplo intento de token invalido.
- `metadata` siempre debe ser objeto.
- `total_pages = 0` cuando `total = 0`.

## 9. Actor seguro

Campos expuestos:

- `actor.type`
- `actor.role`
- `actor.label`

Reglas de label:

- si `actor_type = system`, devolver `label = "Sistema"`;
- si `actor_display_name` existe y no esta vacio, usar `actor_display_name`;
- si no existe `actor_display_name`, usar fallback legible por rol:
  - `owner` -> `Owner`
  - `staff` -> `Staff`
- si no hay rol y no es system, usar `Usuario`.

No exponer:

- `actor_auth_user_id`
- `auth_user_id`
- `used_by_auth_user_id`
- `created_by_auth_user_id`
- IDs internos de usuarios en metadata.

## 10. Metadata segura

Aunque `recordEventActivity` ya sanitiza metadata antes de insertar, el endpoint debe aplicar una defensa adicional antes de responder.

Metadata permitida en respuesta:

- `reason_code`
- `previous_status`
- `next_status`
- `previous_checkin_status`
- `next_checkin_status`
- `email_status`
- `email_error_code`
- `delivery_mode`
- `email_attempts`
- `bundle_entries_count`
- `entries_count`
- `sent_count`
- `failed_count`
- `skipped_count`
- `ticket_name`
- `sales_unit_type`
- `entries_per_unit`
- `currency`
- `total_amount`

Metadata prohibida siempre:

- `checkin_token`
- `token`
- QR payload
- QR base64
- raw URL
- scanned URL
- request
- response
- headers
- body
- stack
- email crudo
- phone
- document
- buyer
- attendee
- `local_id`
- auth IDs
- `source` dentro de metadata
- metadata cruda anidada peligrosa
- respuesta cruda de Resend

Reglas:

- Si metadata no es objeto, responder `{}`.
- Si metadata contiene claves no permitidas, omitirlas.
- Si metadata contiene objetos/arrays anidados no necesarios para el contrato, omitirlos.
- No devolver metadata completa sin filtrado.

## 11. No exposicion de PII/tokens

El endpoint no debe hacer joins con buyer ni attendee.

No devolver:

- `buyer_name`
- `buyer_email`
- `buyer_phone`
- `buyer_document`
- `attendee_name`
- `attendee_email`
- `attendee_phone`
- `attendee_document`
- `checkin_token`
- QR payload
- QR base64
- raw/scanned URL
- `local_id`
- auth IDs

Si en futuro se quiere mostrar nombre de asistente o comprador en activity, debe ser otro slice con politica explicita de PII.

## 12. Consulta y enriquecimiento MVP

Decision MVP:

- Leer directamente `public.event_activity_events`.
- No hacer joins pesados.
- No hacer join a `event_order_entries` para traer asistente.
- No hacer join a `event_orders` para traer comprador.
- No hacer join a `auth.users`.
- No hacer join a locals.
- Devolver solo IDs relacionales ya guardados en activity.

Columnas a seleccionar:

- `id`
- `created_at`
- `action`
- `source`
- `entity_type`
- `entity_id`
- `message`
- `actor_type`
- `actor_role`
- `actor_display_name`
- `event_order_id`
- `event_order_item_id`
- `event_order_entry_id`
- `event_ticket_type_id`
- `metadata`

No seleccionar:

- `actor_auth_user_id`
- cualquier columna que no sea necesaria para el response.

## 13. Paginacion, orden y performance

Defaults:

- `page = 1`
- `page_size = 25`
- `sort = created_at_desc`

Limites:

- `page_size` maximo = `100`.
- `page_size > 100` devuelve `400 invalid_query`.
- `page < 1` devuelve `400 invalid_query`.

Orden estable:

- `created_at_desc`: `created_at desc`, `id desc`.
- `created_at_asc`: `created_at asc`, `id asc`.

Paginacion:

- `offset = (page - 1) * page_size`.
- `limit = page_size`.
- `total` cuenta activity rows despues de tenant scope y filtros.
- `total_pages = ceil(total / page_size)`.
- Si `total = 0`, devolver `total_pages = 0`.

Indices existentes a usar:

- `idx_event_activity_events_event_created` (`event_id`, `created_at desc`)
- `idx_event_activity_events_action_created` (`event_id`, `action`, `created_at desc`)
- `idx_event_activity_events_source_created` (`event_id`, `source`, `created_at desc`)
- `idx_event_activity_events_entity_type_created` (`event_id`, `entity_type`, `created_at desc`)
- `idx_event_activity_events_entry_created` (`event_id`, `event_order_entry_id`, `created_at desc`)
- `idx_event_activity_events_order_created` (`event_id`, `event_order_id`, `created_at desc`)
- `idx_event_activity_events_ticket_type_created` (`event_id`, `event_ticket_type_id`, `created_at desc`)

## 14. Errores HTTP

Mantener comportamiento de middlewares:

- `400`: `eventId` invalido desde `eventPanelAuth`.
- `401`: sin Authorization o token invalido.
- `403`: usuario sin membership o rol insuficiente.
- `404`: evento inexistente.

Errores propios del endpoint:

- `400 invalid_query`: query params invalidos, unknown query param, UUID invalido, allowlist invalida, paginacion invalida, `page_size > 100`.
- `500 activity_read_failed`: error inesperado de DB o error no controlado en lectura.

Formato recomendado:

```json
{
  "error": "Invalid query params",
  "code": "invalid_query"
}
```

No filtrar detalles SQL internos.

## 15. QA futuro para CODE

Casos minimos para Slice 3E.4E.2/3E.4E.3:

Sin activity:

- `GET /panel/events/:eventId/activity` con Ibiza limpio responde `200`.
- `items = []`.
- `pagination.total = 0`.
- `pagination.total_pages = 0`.

Fixtures:

- crear una emision simple con `manual-issue`;
- validar que aparecen `event_order_manual_issued` y `event_entry_issued`;
- enviar email manual y validar `event_entry_email_sent` con `source = manual_email`;
- generar check-in QR valid y validar `event_entry_checked_in` con `source = qr`;
- generar fallback manual already used/outside window si aplica y validar sources/actions esperadas.

Filtros:

- `action = event_entry_checked_in`;
- `source = qr`;
- `source = manual`;
- `source = automatic_email`;
- `source = manual_email`;
- `entity_type = event_checkin`;
- `event_order_entry_id`;
- `event_order_id`;
- `event_ticket_type_id`.

Paginacion:

- `page = 1`, `page_size = 1`;
- `total` y `total_pages` correctos;
- orden estable por `created_at` + `id`.

Query invalida:

- `action=bad` -> `400 invalid_query`;
- `source=bad` -> `400 invalid_query`;
- `entity_type=bad` -> `400 invalid_query`;
- `event_order_id=bad` -> `400 invalid_query`;
- `event_order_entry_id=bad` -> `400 invalid_query`;
- `event_ticket_type_id=bad` -> `400 invalid_query`;
- `page_size=101` -> `400 invalid_query`;
- `page=0` -> `400 invalid_query`;
- `unknown=1` -> `400 invalid_query`;
- `q=test` -> `400 invalid_query`.

Seguridad:

- response no incluye `actor_auth_user_id`;
- response no incluye `auth_user_id`;
- response no incluye `used_by_auth_user_id`;
- response no incluye `created_by_auth_user_id`;
- response no incluye `local_id`;
- response no incluye `checkin_token`;
- response no incluye QR payload/base64;
- response no incluye email/phone/document;
- response no incluye buyer/attendee PII;
- response no incluye `source` dentro de metadata;
- metadata queda filtrada por allowlist.

Tenant safety:

- owner Ibiza accede;
- staff Ibiza accede;
- owner local sin membership devuelve `403`;
- sin auth devuelve `401`;
- token invalido devuelve `401`;
- `eventId` invalido devuelve `400`;
- evento inexistente devuelve `404`;
- no hay leakage entre eventos.

Regresiones:

- `/summary` sigue OK;
- `/ticket-types` sigue OK;
- `/entries` sigue OK;
- `manual-issue` sigue OK;
- QR PNG sigue OK;
- `send-email` sigue OK;
- check-in QR sigue OK;
- fallback manual sigue OK;
- panel local sigue OK.

Limpieza:

- borrar fixtures QA;
- confirmar `GET /activity` vuelve a `items = []` si no habia activity previa;
- confirmar summary/entries vuelven al estado esperado.

## 16. Roadmap por slices

Slice 3E.4E.1:

- contrato read activity docs.
- Estado: este documento.

Slice 3E.4E.2:

- Estado: implementado y deployado.
- `GET /panel/events/:eventId/activity` creado.
- Schema estricto de query params creado.
- Usa `eventPanelAuth + requireEventRole(["owner", "staff"])`.
- Lee `event_activity_events` scoped por `req.eventPanelUser.eventId`.
- Devuelve actor seguro, relations y metadata filtrada.
- No hace joins con PII.

Slice 3E.4E.3:

- Estado: QA runtime PASS completo.
- Filtros, paginacion, seguridad, tenant safety, regresiones y limpieza validados.

Slice posterior:

- ASK / DOCS - UI de historial operativo en panel de eventos.

## 17. Estado Slice 3E.4E - endpoint read-only activity QA runtime PASS

Estado final: **implementado, deployado y QA runtime PASS completo**.

Endpoint validado:

- `GET /panel/events/:eventId/activity`
- Proteccion: `eventPanelAuth + requireEventRole(["owner", "staff"])`.
- Read-only.
- Lee `event_activity_events`.
- Usa tenant scope desde `req.eventPanelUser.eventId`.
- Devuelve filtros, paginacion, actor seguro y metadata filtrada.
- No expone PII, tokens, QR payload/base64, auth IDs ni `local_id`.

Preflight y estado inicial:

- Variables QA cargadas correctamente: API, `EVENT_ID`, `GENERAL_TICKET_ID`, `QA_EMAIL` y tokens owner Ibiza, staff Ibiza y owner local.
- `GET /health` respondio `200 OK`.
- `GET /panel/events/:eventId/me` con owner Ibiza respondio `200 OK`, `membership.role = owner`.
- `GET /panel/events/:eventId/me` con staff Ibiza respondio `200 OK`, `membership.role = staff`.
- `GET /panel/events/:eventId/entries` inicial respondio `items = []`, `pagination.total = 0`.
- `GET /panel/events/:eventId/activity` respondio `200 OK`.

Fixture controlado:

- Se creo fixture QA con `manual-issue`.
- `manual-issue` respondio `201 Created`.
- `entries.length = 2`.
- `email_delivery.mode = order_bundle`.
- `email_delivery.email_attempts = 1`.
- `email_delivery.attempted = 2`, `sent = 2`, `failed = 0`, `skipped = 0`, `status = sent`.
- `event_order_id = 6996b86f-c346-49d2-a967-99b75c0c4982`.
- `event_order_item_id = 6248c2be-258d-4420-9c0a-2b106bffbfdb`.
- Entries QA: `QA-3E4E-QR` y `QA-3E4E-MANUAL`.
- DB inicial de entries: `status = issued`, `checkin_status = unused`, `used_at = null`, `used_by_auth_user_id = null`.

Activity generada por fixture:

- Email manual por entry respondio `200 OK`, `email.status = sent`.
- Activity email manual: `event_entry_email_sent`, `source = manual_email`, `entity_type = event_email`, actor owner, message `Email de QR enviado`, metadata `email_status = sent`, `delivery_mode = single_entry`.
- Check-in QR valido respondio `200 OK`, `status = valid`, `entry.checkin_status = used`.
- Activity QR: `event_entry_checked_in`, `source = qr`, `entity_type = event_checkin`, actor owner, message `Entrada validada por QR`, metadata `previous_checkin_status = unused`, `next_checkin_status = used`.
- Fallback manual sobre entry ya usada respondio `200 OK`, `status = already_used`.
- Activity fallback manual: `event_entry_already_used_attempt`, `source = manual`, `entity_type = event_checkin`, actor owner, message `Intento manual sobre entrada ya usada`, metadata `reason_code = already_used`.

Resumen exacto del fixture:

- Se confirmaron 8 filas de activity.
- `event_order_manual_issued / manual / event_order = 1`.
- `event_entry_issued / manual / event_order_entry = 2`.
- `event_entry_email_sent / automatic_email / event_email = 2`.
- `event_entry_email_sent / manual_email / event_email = 1`.
- `event_entry_checked_in / qr / event_checkin = 1`.
- `event_entry_already_used_attempt / manual / event_checkin = 1`.

Lectura `/activity`:

- `GET /panel/events/:eventId/activity?event_order_id=<QA_ORDER_ID>&page=1&page_size=100` respondio `200 OK`.
- `pagination.page = 1`.
- `pagination.page_size = 100`.
- `pagination.total = 8`.
- `pagination.total_pages = 1`.
- `items.length = 8`.
- El endpoint devolvio las 8 filas esperadas del fixture.

Actor seguro:

- Rows de sistema: `actor.type = system`, `actor.role = null`, `actor.label = Sistema`.
- Rows de panel: `actor.type = event_panel_user`, `actor.role = owner`, `actor.label = Owner Ibiza`.
- No se expuso `actor_auth_user_id`, `auth_user_id`, `used_by_auth_user_id` ni `created_by_auth_user_id`.

Metadata segura:

- Metadata devuelta solo con claves permitidas: `reason_code`, `previous_checkin_status`, `next_checkin_status`, `email_status`, `delivery_mode`, `email_attempts`, `bundle_entries_count`, `entries_count`, `ticket_name`, `sales_unit_type`, `entries_per_unit`, `currency`, `total_amount`.
- No se detecto metadata cruda.
- No se detectaron objetos/arrays anidados no permitidos.
- No se duplico `source` dentro de metadata.

Seguridad de response completa:

- Response filtrada por orden QA sin `actor_auth_user_id`, `auth_user_id`, `used_by_auth_user_id`, `created_by_auth_user_id`, `local_id`, `checkin_token`, `qr_payload`, `qr_base64`, `raw_url`, `scanned_url`, buyer/attendee PII, email crudo, telefonos, documentos, request/response crudo, headers, stack ni `/events/checkin`.

Filtros, paginacion y orden:

- `source=manual` respondio `200 OK`, `pagination.total = 4`, solo source manual.
- `source=qr` respondio `200 OK`, `pagination.total = 1`, solo source qr.
- `source=automatic_email` respondio `200 OK`, `pagination.total = 2`, solo source automatic_email.
- `source=manual_email` respondio `200 OK`, `pagination.total = 1`, solo source manual_email.
- Filtros por action devolvieron solo rows con la action solicitada.
- Filtros por `entity_type` validaron `event_order`, `event_order_entry`, `event_email` y `event_checkin`.
- Filtros por `event_order_id`, `event_order_entry_id` y `event_ticket_type_id` quedaron scoped al fixture y evento.
- `page=1&page_size=1` devolvio `total = 8`, `total_pages = 8`, `items.length = 1`.
- `page=2&page_size=1` devolvio `total = 8`, `total_pages = 8`, `items.length = 1`.
- `sort=created_at_desc` devolvio primero la activity mas reciente del fixture.
- `sort=created_at_asc` devolvio primero la activity mas antigua del fixture.

Query invalida:

- Se validaron 17 casos con `HTTP 400` y `code = invalid_query`: `action=bad`, `source=bad`, `entity_type=bad`, `event_order_id=bad`, `event_order_entry_id=bad`, `event_ticket_type_id=bad`, `page=0`, `page_size=101`, `sort=bad`, `unknown=1`, `q=test`, `event_id`, `local_id`, `auth_user_id`, `actor_auth_user_id`, `checkin_token`, `metadata`.

Auth y tenant safety:

- Owner Ibiza y staff Ibiza acceden con `200 OK`.
- Sin Authorization devuelve `401`.
- Token invalido devuelve `401`.
- Owner local sin membership devuelve `403`.
- `eventId` invalido devuelve `400 Invalid eventId`.
- Evento inexistente con UUID valido devuelve `404 Event not found`.

Regresiones:

- `GET /panel/events/:eventId/summary` respondio `200 OK`.
- `GET /panel/events/:eventId/ticket-types` respondio `200 OK`.
- `GET /panel/events/:eventId/entries` respondio `200 OK`.
- `GET /panel/events/:eventId/entries/:entryId/qr` respondio `200 OK`, `Content-Type = image/png`.
- `GET /panel/events/:eventId/me` con staff Ibiza respondio `200 OK`.
- `GET /panel/me` con owner local respondio `200 OK`.
- `GET /panel/orders/summary` con owner local respondio `200 OK`.

Limpieza final:

- Se ejecuto limpieza de fixtures `QA-3E4E`.
- Verificacion por IDs exactos: `qa_order_remaining = 0`, `qa_item_remaining = 0`, `qa_entries_remaining = 0`, `qa_activity_remaining = 0`.
- Evento restaurado: `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.
- `GET /panel/events/:eventId/entries` volvio a `items = []`, `pagination.total = 0`.
- `GET /panel/events/:eventId/activity?event_order_id=<QA_ORDER_ID>` volvio a `items = []`, `pagination.total = 0`.
- `GET /panel/events/:eventId/summary` volvio a operaciones en cero.

Estado backend operativo:

- Activity log de Eventos queda cerrado a nivel backend operativo: generacion de activity, lectura segura, tenant safety, metadata segura y regresiones OK.

Proximo paso recomendado:

- ASK / DOCS - UI de historial operativo en panel de eventos.
- Definir si se muestra activity en vista general, historial dentro de entry o ambas por etapas.
- Definir columnas, labels, filtros UI, paginacion/lazy load y estados vacios.
- Mantener `GET /panel/events/:eventId/activity` como fuente read-only del historial.

## 18. No-goals

Fuera de este contrato:

- implementar codigo adicional;
- tocar endpoints existentes fuera de `/activity`;
- tocar SQL/migraciones;
- tocar frontend;
- tocar pagos;
- tocar `/payments/callback`;
- modificar `event_activity_events`;
- modificar `recordEventActivity`;
- agregar joins con PII;
- agregar export;
- agregar UI;
- agregar busqueda textual;
- agregar activity local;
- cambiar flujos de manual-issue, email, QR, check-in QR o fallback manual;
- hacer cola/background;
- agregar analytics avanzado.
