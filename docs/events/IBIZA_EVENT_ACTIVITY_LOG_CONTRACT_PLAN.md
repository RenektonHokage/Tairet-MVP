# Ibiza Slice 3E.4A: contrato de activity log operativo de Eventos

## 1. Proposito

Este documento define el contrato tecnico y de producto para un activity log operativo de entries de evento.

El objetivo es dejar listo el diseno para futuros slices CODE que registren acciones operativas de Eventos sin mezclar el modelo de eventos con el activity log local existente.

Este documento no implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, pagos, provisioning, runtime demo, exports ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo validado:

- Slice 3B.2: `POST /panel/events/:eventId/orders/manual-issue` implementado y QA runtime PASS completo.
- Slice 3C.2: `GET /panel/events/:eventId/entries` implementado y QA runtime PASS.
- Slice 3D.2: `GET /panel/events/:eventId/entries/:entryId/qr` implementado y QA runtime PASS.
- Slice 3D.3A: `POST /panel/events/:eventId/entries/:entryId/send-email` implementado y QA runtime PASS completo.
- Slice 3D.3B: email automatico post `manual-issue` implementado y QA runtime PASS completo.
- Slice 3E.2A: RPC `check_in_event_entry_by_token` aplicada y QA DB PASS completo.
- Slice 3E.2B: endpoint `PATCH /panel/events/:eventId/checkin/:token` implementado y QA runtime PASS completo.
- Slice 3E.3B: RPC `check_in_event_entry_manually` aplicada y QA DB PASS.
- Slice 3E.3C: endpoint `PATCH /panel/events/:eventId/entries/:entryId/use` implementado y QA runtime PASS completo.
- Slice 3E.4B: migracion 032 `event_activity_events` aplicada y QA DB PASS completo.
- Slice 3E.4C: helper `recordEventActivity` implementado y validado como helper aislado.
- Slice 3E.4F1: activity en `manual-issue` implementada, deployada y QA runtime PASS completo.
- Slice 3E.4F2: activity en emails manual/automatico bundle implementada, deployada y QA runtime PASS completo.
- Slice 3E.4G1: activity en check-in QR implementada, deployada y QA runtime PASS completo.

Modelo vigente:

- `event_orders` = orden comercial/backoffice.
- `event_order_items` = linea comercial vendida.
- `event_order_entries` = acceso individual / unidad QR / unidad de check-in.
- `operational_activity_events` existe para el panel local, no para Eventos.

## 3. Fuentes revisadas

Documentos revisados:

- `docs/events/IBIZA_EVENT_MANUAL_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_MANUAL_ISSUE_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`
- `docs/panel/OPERATIONAL_ACTIVITY_LOG_PLAN.md`
- `docs/panel/ACTIVITY_ACTOR_LABEL_PLAN.md`

Codigo y SQL revisados:

- `functions/api/src/services/operationalActivity.ts`
- `functions/api/src/routes/activity.ts`
- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/middlewares/eventPanelAuth.ts`
- `functions/api/src/middlewares/requireEventRole.ts`
- `infra/sql/schema.sql`
- `infra/sql/migrations/027_create_event_pilot_tables.sql`
- `infra/sql/migrations/028_add_event_packages_and_order_items.sql`
- `infra/sql/migrations/029_create_issue_event_manual_order_rpc.sql`
- `infra/sql/migrations/030_create_event_checkin_rpc.sql`
- `infra/sql/migrations/031_create_event_manual_checkin_rpc.sql`

Hallazgos relevantes:

- `operationalActivity.ts` esta acoplado a `localId` y a entidades locales `order` / `reservation`.
- `/activity` usa `panelAuth`, `requireRole` y `req.panelUser.localId`, no `eventPanelAuth`.
- La tabla local `operational_activity_events` tiene `local_id not null` y constraints de entidades locales.
- Los endpoints de Eventos usan `eventPanelAuth`, `requireEventRole` y `req.eventPanelUser.eventId`.
- Los contratos recientes de Eventos prohiben exponer `checkin_token`, QR payload, QR base64, `auth_user_id`, `local_id` y metadata cruda.

## 4. Decision de modelo

Decision:

- Crear una tabla nueva futura: `public.event_activity_events`.
- No reutilizar directamente `public.operational_activity_events` para Eventos.

Motivo:

- `operational_activity_events` esta modelada alrededor de `local_id`.
- `local_id` es obligatorio y referencia `public.locals`.
- `entity_type` esta limitado a `order` y `reservation`.
- El helper actual requiere `localId`.
- El endpoint local `/activity` esta tenant-scoped por local, no por evento.
- Extender esa tabla para Eventos obligaria a relajar constraints y mezclar tenants locales/eventos en una superficie sensible.

Patrones a reutilizar:

- helper best-effort;
- sanitizacion defensiva de metadata;
- actor label resuelto en lectura;
- no filtrar fallos de activity al flujo principal;
- lectura protegida por middleware de panel.

## 5. Tabla futura propuesta

Nombre recomendado:

- `public.event_activity_events`

Campos candidatos:

- `id uuid primary key default gen_random_uuid()`
- `event_id uuid not null references public.events(id) on delete cascade`
- `event_order_id uuid null`
- `event_order_item_id uuid null`
- `event_order_entry_id uuid null`
- `event_ticket_type_id uuid null`
- `entity_type text not null`
- `entity_id uuid null`
- `action text not null`
- `source text null`
- `actor_type text not null`
- `actor_auth_user_id uuid null`
- `actor_role text null`
- `actor_display_name text null`
- `message text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Notas:

- `event_id` es la columna tenant obligatoria.
- Las FKs compuestas con `event_id` permiten filtrar por entry, order, item y ticket sin depender solo de metadata y evitan vinculos cruzados entre eventos.
- `entity_type` y `entity_id` facilitan queries genericas.
- `source` debe ser columna propia controlada, no metadata libre. Esto permite filtrar y consultar activity por origen operativo sin depender de JSON, manteniendo `event_order_entries` sin campos de metodo.
- `actor_auth_user_id` puede existir internamente para auditoria, pero no debe exponerse en responses.
- `actor_display_name` puede guardarse como snapshot operativo o resolverse en lectura desde `event_panel_users`; si se guarda, debe venir de membership validada.

Valores iniciales para `entity_type`:

- `event_order`
- `event_order_entry`
- `event_email`
- `event_checkin`

Valores iniciales para `actor_type`:

- `event_panel_user`
- `system`

Valores iniciales para `actor_role`:

- `owner`
- `staff`
- `null` para `system`

Valores iniciales para `source`:

- `qr`
- `manual`
- `automatic_email`
- `manual_email`
- `system`

### Checks recomendados para la migracion 3E.4B

Checks de allowlist:

- `entity_type in ('event_order', 'event_order_entry', 'event_email', 'event_checkin')`
- `actor_type in ('event_panel_user', 'system')`
- `actor_role is null or actor_role in ('owner', 'staff')`
- `source is null or source in ('qr', 'manual', 'automatic_email', 'manual_email', 'system')`
- `action in ('event_order_manual_issued', 'event_entry_issued', 'event_entry_email_sent', 'event_entry_email_failed', 'event_entry_checked_in', 'event_entry_already_used_attempt', 'event_entry_outside_window_attempt', 'event_entry_voided_attempt', 'event_entry_invalid_token_attempt')`

Checks de forma:

- `char_length(trim(action)) > 0`
- `char_length(trim(message)) > 0`
- `jsonb_typeof(metadata) = 'object'`
- `actor_display_name is null or char_length(trim(actor_display_name)) between 1 and 80`

Reglas actor/source:

- Si `actor_type = 'system'`, entonces `actor_auth_user_id is null` y `actor_role is null`.
- Si `actor_type = 'event_panel_user'`, entonces `actor_auth_user_id is not null`, `actor_role is not null` y `actor_role in ('owner', 'staff')`.
- `source = 'system'` debe usarse para acciones generadas por sistema.
- `source = 'qr'` debe usarse para check-in QR.
- `source = 'manual'` debe usarse para fallback manual.
- `source = 'automatic_email'` y `source = 'manual_email'` deben usarse solo para activity de email.

Estos checks quedaron implementados en la migracion 032. El QA DB detecto que `actor_role in ('owner', 'staff')` con `actor_role = null` no bloqueaba la fila por semantica SQL de `CHECK`/`NULL`; se corrigio agregando `actor_role is not null` en la rama `actor_type = 'event_panel_user'`.

## 6. Acciones MVP

Acciones operativas iniciales:

- `event_order_manual_issued`
- `event_entry_issued`
- `event_entry_email_sent`
- `event_entry_email_failed`
- `event_entry_checked_in`
- `event_entry_already_used_attempt`
- `event_entry_outside_window_attempt`
- `event_entry_voided_attempt`
- `event_entry_invalid_token_attempt`

Reglas:

- Registrar acciones de valor operativo, no cada lectura.
- No registrar `GET /entries`.
- No registrar `GET /entries/:entryId/qr` en MVP salvo decision posterior; el acceso al QR puede ser ruidoso.
- No registrar payloads completos de request/response.
- No registrar datos que ya viven en tablas relacionales si no agregan valor operativo.

## 7. Decision QR vs manual

Decision:

- No agregar un campo nuevo en `event_order_entries` para distinguir check-in QR vs manual.
- Registrar el origen del intento en activity log, no en la entry.
- Guardar `source` como columna propia controlada de `event_activity_events`.
- No guardar el origen en `metadata.source`.

Valores permitidos para `source`:

- `qr`
- `manual`
- `automatic_email`
- `manual_email`
- `system`

Uso:

- `event_entry_checked_in` puede registrar `source = "qr"` o `source = "manual"`.
- `event_entry_already_used_attempt` puede registrar el source del intento.
- `event_entry_outside_window_attempt` puede registrar el source del intento.
- `event_entry_invalid_token_attempt` usa `source = "qr"` y no guarda el token.

Motivo:

- La entry solo necesita representar el estado final de check-in.
- La activity representa historia operativa y soporte.
- Esta decision evita cambiar la semantica de `event_order_entries`.
- `source` como columna permite filtros e indices por origen operativo sin consultar JSON.

## 8. Actor y actor label

Reglas para actores panel:

- Tomar actor desde `req.eventPanelUser.authUserId`.
- Tomar rol desde `req.eventPanelUser.role`.
- Resolver display label desde `event_panel_users.display_name` si existe.
- No usar `panel_users`.
- No usar `local_id`.

Reglas para actores sistema:

- Email automatico post `manual-issue` puede registrarse con `actor_type = "system"`.
- `actor_auth_user_id` debe ser `null` para acciones sistema.
- El trigger humano de una emision puede quedar representado por la orden y su activity de emision, no como PII dentro de metadata de email automatico.

Response futura:

- Exponer `actor_label`, no `actor_auth_user_id`.
- Para owner/staff, usar display name si existe.
- Fallback: `Owner`, `Staff` o `Sistema`.
- No exponer emails de staff como actor label salvo decision explicita posterior.

## 9. Entidades relacionadas

Cada activity debe incluir siempre:

- `event_id`
- `action`
- `created_at`

Segun accion:

- `event_order_manual_issued`: `event_order_id`, `entity_type = "event_order"`, `entity_id = event_order_id`.
- `event_entry_issued`: `event_order_id`, `event_order_item_id`, `event_order_entry_id`, `event_ticket_type_id`, `entity_type = "event_order_entry"`, `entity_id = event_order_entry_id`.
- `event_entry_email_sent`: `event_order_entry_id`, `event_order_id`, `event_ticket_type_id`, `entity_type = "event_email"`.
- `event_entry_email_failed`: `event_order_entry_id`, `event_order_id`, `event_ticket_type_id`, `entity_type = "event_email"`.
- `event_entry_checked_in`: `event_order_entry_id`, `event_order_id`, `event_ticket_type_id`, `entity_type = "event_checkin"`.
- `event_entry_invalid_token_attempt`: `event_order_entry_id = null`, `entity_type = "event_checkin"`, `entity_id = null`.

Reglas de joins:

- Toda lectura o escritura debe estar scoped por `event_id`.
- Joins con `event_orders`, `event_order_items`, `event_order_entries` y `event_ticket_types` deben alinear tambien `event_id`.
- No leer ni escribir activity de otro evento aunque se conozca un UUID de entidad.

## 10. Metadata permitida y prohibida

Metadata permitida:

- `reason_code`
- `previous_status`
- `next_status`
- `previous_checkin_status`
- `next_checkin_status`
- `email_status`
- `email_error_code`
- `entries_count`
- `sent_count`
- `failed_count`
- `skipped_count`
- `ticket_name`
- `sales_unit_type`
- `entries_per_unit`
- `currency`
- `total_amount`

Metadata prohibida:

- `checkin_token`
- QR payload
- QR base64
- URL cruda con token
- token escaneado
- request body completo
- response body completo
- headers completos
- IP/user-agent en MVP
- buyer email, phone o document
- attendee email, phone o document
- `actor_auth_user_id`
- `created_by_auth_user_id`
- `used_by_auth_user_id`
- `auth_user_id`
- `local_id`
- metadata cruda de DB
- stack traces
- respuesta cruda de Resend

Notas:

- La PII operativa ya puede verse en `GET /entries` bajo `eventPanelAuth`; no debe duplicarse en activity metadata.
- Si una UI necesita mostrar attendee o buyer, debe resolverlo por join seguro y no desde metadata.
- Si un caller envia `source` dentro de metadata, el helper futuro debe moverlo a la columna `source` o eliminarlo de metadata segun contrato.
- Metadata debe seguir siendo un objeto JSON chico y sanitizado.
- La sanitizacion debe eliminar claves prohibidas de forma defensiva aunque el caller se equivoque.

## 11. Endpoint futuro de lectura

Endpoint recomendado:

- `GET /panel/events/:eventId/activity`

Proteccion:

- `eventPanelAuth`
- `requireEventRole(["owner", "staff"])`

Query params iniciales:

- `entity_type`
- `entry_id`
- `order_id`
- `action`
- `page`
- `page_size`

Defaults:

- `page = 1`
- `page_size = 25`
- `page_size` maximo = `100`
- `sort = created_at_desc`

Response segura:

```json
{
  "items": [
    {
      "id": "uuid",
      "action": "event_entry_checked_in",
      "entity_type": "event_checkin",
      "entity": {
        "event_order_id": "uuid",
        "event_order_item_id": "uuid",
        "event_order_entry_id": "uuid",
        "event_ticket_type_id": "uuid"
      },
      "actor": {
        "type": "event_panel_user",
        "role": "staff",
        "label": "Staff Puerta 1"
      },
      "message": "Entrada marcada como usada",
      "source": "qr",
      "metadata": {
        "previous_checkin_status": "unused",
        "next_checkin_status": "used"
      },
      "created_at": "2026-06-04T12:00:00.000Z"
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

No incluir en response:

- `checkin_token`
- QR payload
- QR base64
- `actor_auth_user_id`
- `auth_user_id`
- `local_id`
- PII de buyer/attendee dentro de metadata
- `source` duplicado dentro de metadata
- metadata cruda

## 12. Integracion futura

Puntos de integracion recomendados:

- `manual-issue`: despues de RPC exitosa, registrar `event_order_manual_issued` y `event_entry_issued` best-effort.
- `send-email` por entry: despues de envio exitoso registrar `event_entry_email_sent`; si falla, registrar `event_entry_email_failed`.
- email automatico post `manual-issue`: registrar por entry enviada/fallida o un resumen controlado si se necesita limitar volumen.
- check-in QR: despues de respuesta de RPC registrar `event_entry_checked_in`, `event_entry_already_used_attempt`, `event_entry_outside_window_attempt`, `event_entry_voided_attempt` o `event_entry_invalid_token_attempt`.
- fallback manual: despues de respuesta de RPC registrar los mismos estados con `source = "manual"`.

Reglas:

- Activity se escribe desde TypeScript despues de conocer el resultado de la operacion principal.
- Fallo de activity no revierte emision, email ni check-in.
- No escribir activity dentro de las RPCs en el primer slice.
- No duplicar logica de stock, QR, email ni check-in en el helper de activity.

## 13. RLS, grants e indices

Reglas DB recomendadas:

- Habilitar RLS en `public.event_activity_events`.
- Revocar acceso a `public`, `anon` y `authenticated`.
- Permitir acceso operativo via backend con `service_role`.
- No exponer lectura directa por Data API al cliente.

Indices recomendados:

- `(event_id, created_at desc)`
- `(event_id, event_order_entry_id, created_at desc)`
- `(event_id, event_order_id, created_at desc)`
- `(event_id, action, created_at desc)`
- `(event_id, entity_type, created_at desc)`
- `(event_id, source, created_at desc)`

Volumen:

- Ibiza puede tener miles de entries.
- Email y check-in pueden generar multiples logs por entry.
- Mantener metadata pequena.
- Paginacion obligatoria en lectura.
- Retencion/purge queda fuera de MVP.

## 14. QA futuro

Casos minimos para futuros CODE:

- La tabla `event_activity_events` existe con `event_id` obligatorio.
- Grants no permiten `anon` ni `authenticated`.
- `source` acepta `qr`, `manual`, `automatic_email`, `manual_email` y `system`.
- `source` rechaza valores fuera de allowlist.
- `metadata` rechaza arrays/null como raiz si se implementa `jsonb_typeof(metadata) = 'object'`.
- `action` fuera de allowlist falla.
- `entity_type` fuera de allowlist falla.
- `actor_type` fuera de allowlist falla.
- `actor_type = system` con `actor_auth_user_id` no null falla.
- `actor_type = event_panel_user` sin `actor_auth_user_id` falla.
- `actor_type = event_panel_user` con `actor_role = null` falla.
- Owner/staff pueden generar activity desde endpoints protegidos.
- Usuario local sin membership de evento no genera ni lee activity de evento.
- `manual-issue` genera activity de emision sin exponer PII ni tokens.
- `send-email` exitoso genera `event_entry_email_sent`.
- Fallo de email genera `event_entry_email_failed` sin revertir email/manual-issue.
- Check-in QR valido genera `event_entry_checked_in` con `source = "qr"`.
- Fallback manual valido genera `event_entry_checked_in` con `source = "manual"`.
- Intento de QR ya usado genera `event_entry_already_used_attempt`.
- Intento fuera de ventana genera `event_entry_outside_window_attempt`.
- Entry voided genera `event_entry_voided_attempt`.
- Token invalido genera `event_entry_invalid_token_attempt` sin guardar token.
- Fallo de activity no revierte la operacion principal.
- Endpoint futuro `/activity` lista solo activity del evento autorizado.
- Response futura muestra `source` como campo propio y no dentro de metadata.
- Response futura no incluye `checkin_token`, QR payload, QR base64, `auth_user_id`, `local_id`, buyer PII ni attendee PII en metadata.
- No rompe `/summary`.
- No rompe `/ticket-types`.
- No rompe `/entries`.
- No rompe `manual-issue`.
- No rompe QR, email ni check-in.
- No rompe `/panel/me` ni `/panel/orders/summary` del panel local.

## 15. Estado Slice 3E.4B - migracion 032 aplicada y QA DB PASS

Estado: **aplicada en Supabase con QA DB PASS completo**.

Queda registrado:

- `public.event_activity_events` fue creada como tabla separada de `public.operational_activity_events`.
- `event_id` es el tenant scope obligatorio.
- `source` es columna propia controlada, no `metadata.source`.
- Las FKs quedan event-scoped y preservan `event_id`.
- RLS esta enabled.
- Grants directos quedan cerrados para `anon` y `authenticated`.
- `service_role` queda operativo para backend.
- Checks estrictos cubren `entity_type`, `action`, `source`, `actor_type`, `actor_role`, `message` y `metadata`.
- No existen columnas prohibidas para `checkin_token`, QR payload/base64, `local_id` ni PII sensible.
- El rollback del QA dejo 0 activity rows QA y 0 ordenes QA persistidas.

Hallazgo/fix validado:

- El QA detecto que `event_panel_user` con `actor_role = null` era aceptado por la semantica SQL de `CHECK` con resultado `unknown`.
- La migracion 032 fue corregida para exigir `actor_role is not null` en la rama `actor_type = 'event_panel_user'`.
- Despues del fix, el QA DB completo quedo PASS.

QA SQL fail-fast registrado:

- `service_role_can_insert`, `service_role_can_select`, `service_role_can_update` y `service_role_can_delete`.
- `idx_event_activity_events_ticket_type_created`.
- tabla existe, RLS enabled, grants cerrados, indices esperados y columnas prohibidas ausentes.
- insert panel actor valido e insert system valido.
- rechazos: invalid source/action/entity_type/actor_type, actor system invalido, actor panel invalido, metadata array/null, message vacio, action vacio y FK de entry invalida.
- rollback limpio.

## 16. Estado Slice 3E.4C - helper recordEventActivity aislado

Estado: **implementado y validado como helper aislado**.

Archivo creado:

- `functions/api/src/services/eventActivity.ts`

Helper creado:

- `recordEventActivity(input)`
- retorna `{ ok: true, id }` o `{ ok: false, error }`.

Tipos/contrato exportados:

- `EventActivitySource`
- `EventActivityAction`
- `EventActivityEntityType`
- actor panel/system
- input
- result

Metadata:

- sanitiza sin mutar el objeto original;
- elimina claves sensibles case-insensitive;
- limita tamano/profundidad;
- convierte metadata invalida en `{}`;
- elimina `source` de metadata porque `source` vive como columna propia.

Source y actor:

- `source` queda validado por allowlist: `qr`, `manual`, `automatic_email`, `manual_email`, `system`.
- actor panel requiere `authUserId` y role `owner | staff`.
- actor system rechaza `authUserId` y `role`.
- actor system guarda `actor_auth_user_id = null` y `actor_role = null`.

Best-effort:

- inserta con Supabase service-role en `public.event_activity_events`;
- captura errores;
- no lanza error por defecto;
- devuelve codigos estables;
- no debe romper la operacion principal cuando se integre.

No exposicion sensible:

- no guarda en metadata `checkin_token`, tokens, QR payload/base64/raw URL, request/response/headers/body, buyer/attendee PII, auth IDs, `local_id`, stack traces ni respuesta cruda de Resend.

No integracion todavia:

- no se importo ni llamo `recordEventActivity` desde endpoints;
- no se toco `panelEvents.ts`;
- no se toco `operationalActivity.ts`;
- no se toco activity local.

Validaciones:

- `pnpm -C functions/api typecheck`: PASS.
- `git diff --check`: PASS.
- chequeo adicional de whitespace del archivo nuevo: sin warnings.

Matiz:

- Este slice valida el helper a nivel estatico/contrato.
- La validacion funcional de inserts en operaciones vendra en Slice 3E.4D al integrarlo en endpoints concretos.
- Este comportamiento es esperado porque 3E.4C fue intencionalmente aislado.

## 17. Estado Slice 3E.4D / 3E.4F1 / 3E.4F2 - integracion operativa

Slice 3E.4D:

- Estado: **documentado**.
- Se creo `docs/events/IBIZA_EVENT_ACTIVITY_INTEGRATION_CONTRACT_PLAN.md`.
- Se definio la integracion de `recordEventActivity` en manual-issue, email, check-in QR y fallback manual, con metadata permitida por action, source controlado, best-effort, no PII y no tokens.

Slice 3E.4F1:

- Estado: **implementado, deployado y QA runtime PASS completo**.
- Se integro `recordEventActivity` unicamente en `POST /panel/events/:eventId/orders/manual-issue`.
- Se valido 1 activity `event_order_manual_issued` por orden y 1 activity `event_entry_issued` por cada entry emitida.
- Caso simple General Preventa 1 genero `1 + 1`.
- Caso package/Mesa VIP Preventa 1 genero `1 + 10`.
- `source = manual`, `actor_type = event_panel_user`, `actor_role = owner`.
- Metadata validada sin PII, tokens, QR payload/base64, request/response/headers, notes ni `local_id`.
- La response publica no expone errores internos de activity y `manual-issue` mantiene `201`.
- No se integro activity de email, check-in QR, fallback manual, read activity ni activity local.
- Regresiones principales y limpieza QA quedaron PASS.

Observacion operativa separada:

- El flujo automatico post `manual-issue` fue ajustado despues a email bundle por orden.
- QA runtime PASS: General 1 entry envio 1 email con 1 QR.
- QA runtime PASS: Mesa VIP 10 entries envio 1 solo email con 10 QR.
- El bloque no integro activity de email, check-in QR, fallback manual ni activity local.

Slice 3E.4F2:

- Estado: **implementado, deployado y QA runtime PASS completo**.
- Se integro `recordEventActivity` en email manual por entry.
- Se integro `recordEventActivity` en email automatico bundle post `manual-issue`.
- Email manual success registra `event_entry_email_sent` con `source = manual_email` y `delivery_mode = single_entry`.
- Email automatico bundle success registra `event_entry_email_sent` por entry cubierta con `source = automatic_email` y `delivery_mode = order_bundle`.
- General Preventa 1 genero `event_entry_email_sent / automatic_email / order_bundle = 1`.
- Reenvio manual de la misma entry genero `event_entry_email_sent / manual_email / single_entry = 1`.
- Mesa VIP Preventa 1 genero `event_entry_email_sent / automatic_email / order_bundle = 10`.
- Caso `>20` / 3 Mesas VIP / 30 entries no genero `event_entry_email_sent` ni `event_entry_email_failed` porque `email_delivery.status = skipped` y no hubo intento de envio.
- Metadata validada sin email crudo, phone, document, buyer, attendee, `checkin_token`, `qr_payload`, `qr_base64`, request, response, headers, `local_id` ni `source` duplicado.
- Activity previa de `manual-issue` siguio funcionando.
- No se integro activity de check-in QR, fallback manual, read activity ni activity local.
- Regresiones principales y limpieza QA quedaron PASS.

## 18. Estado Slice 3E.4G1 - activity en check-in QR

Estado: **implementado, deployado y QA runtime PASS completo**.

Se valido:

- `recordEventActivity` integrado en `PATCH /panel/events/:eventId/checkin/:token`;
- activity QR usa `source = qr`;
- `valid` genera `event_entry_checked_in` con `metadata.previous_checkin_status = unused` y `metadata.next_checkin_status = used`;
- segundo intento genera `event_entry_already_used_attempt` con `reason_code = already_used`;
- fuera de ventana genera `event_entry_outside_window_attempt` con `reason_code = outside_window` y no muta la entry;
- entry anulada genera `event_entry_voided_attempt` con `reason_code = voided`;
- UUID inexistente genera `event_entry_invalid_token_attempt` con `reason_code = invalid_token`;
- token malformado con actor autorizado genera `event_entry_invalid_token_attempt` con `reason_code = malformed_token`;
- requests sin auth o sin membership no generan activity nueva;
- `event_not_operable` no genera activity en MVP;
- metadata validada sin token crudo, `checkin_token`, URL raw, QR payload/base64, email, phone, document, buyer, attendee, `local_id` ni `source` duplicado;
- conteo final QA: checked_in `1`, already_used `1`, outside_window `2`, voided `1`, invalid_token_attempt `2`;
- regresiones principales y limpieza QA quedaron PASS.

No se integro activity de fallback manual, read activity ni activity local.

## 19. Roadmap recomendado

Siguiente secuencia:

- Slice 3E.4B: migracion DB `event_activity_events` aplicada y QA DB PASS.
- Slice 3E.4C: helper TS `recordEventActivity` implementado y validado como helper aislado.
- Slice 3E.4D: ASK/DOCS de integracion de activity en flujos de evento documentado.
- Slice 3E.4F1: activity en `manual-issue` implementado, deployado y QA runtime PASS.
- Slice 3D.3B ajuste bundle: email automatico post `manual-issue` opera como 1 email por orden y QA runtime PASS.
- Slice 3E.4F2: activity en email manual por entry y email automatico bundle implementada, deployada y QA runtime PASS.
- Slice 3E.4G1: activity en check-in QR implementada, deployada y QA runtime PASS.
- Slice 3E.4G2: integrar activity en fallback manual.
- Slice 3E.4E: endpoint read-only `GET /panel/events/:eventId/activity`.
- Slice posterior: UI de historial operativo.

Proximo paso recomendado:

- Slice 3E.4G2: activity en fallback manual.

Alcance futuro:

- integrar `recordEventActivity` en `PATCH /panel/events/:eventId/entries/:entryId/use`;
- `source = manual`;
- registrar valid, already_used, outside_window y voided;
- no registrar `event_not_operable` si no hay action especifica;
- no registrar `entry_not_found` porque no hay entity confiable;
- no guardar token, PII, QR payload ni metadata cruda;
- no tocar SQL/migraciones/frontend/pagos.

## 20. No-goals

Fuera de este contrato:

- modificar la DB fuera de la migracion 032 ya aplicada;
- integrar helper TS ahora;
- implementar endpoint `/activity` ahora;
- UI de historial;
- export;
- analytics;
- dashboard;
- activity para panel local;
- activity para pagos;
- activity para B2C publico;
- tracking avanzado de email;
- idempotencia de manual-issue;
- cola/background;
- cambios en QR;
- cambios en check-in;
- cambios en email;
- cambios en `/payments/callback`;
- guardar tokens o QR payloads.
