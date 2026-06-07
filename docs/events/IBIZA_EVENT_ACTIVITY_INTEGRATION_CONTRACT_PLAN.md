# Ibiza Slice 3E.4D: contrato de integracion de activity en flujos operativos

## 1. Proposito

Este documento define el contrato para integrar `recordEventActivity` en los flujos operativos de Eventos antes de implementar codigo.

Este paso es solo ASK / DOCS. No implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, pagos, activity local ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo:

- Slice 3E.4A: contrato de activity log operativo creado.
- Slice 3E.4B: migracion 032 aplicada, `public.event_activity_events` creada y QA DB PASS completo.
- Slice 3E.4C: helper `recordEventActivity` creado en `functions/api/src/services/eventActivity.ts`, aislado y con typecheck PASS.
- `source` es columna propia controlada, no `metadata.source`.
- Activity de Eventos queda separada de `operational_activity_events`.
- Activity se escribe desde TypeScript en modo best-effort.
- Fallo de activity no revierte emision, email ni check-in.
- No se guardan tokens, QR payloads, raw URL, PII sensible, `local_id` ni metadata cruda.

Flujos existentes a integrar en slices posteriores:

- `POST /panel/events/:eventId/orders/manual-issue`
- `POST /panel/events/:eventId/entries/:entryId/send-email`
- email automatico post `manual-issue`
- `PATCH /panel/events/:eventId/checkin/:token`
- `PATCH /panel/events/:eventId/entries/:entryId/use`

Flujos que no deben registrar activity en MVP:

- `GET /panel/events/:eventId/entries`
- `GET /panel/events/:eventId/entries/:entryId/qr`
- `GET /panel/events/:eventId/summary`
- `GET /panel/events/:eventId/ticket-types`

## 3. Fuentes revisadas

Documentos revisados:

- `docs/events/IBIZA_EVENT_ACTIVITY_LOG_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_MANUAL_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_MANUAL_ISSUE_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`

Codigo y SQL revisados:

- `functions/api/src/services/eventActivity.ts`
- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/services/eventEmails.ts`
- `functions/api/src/services/eventQr.ts`
- `functions/api/src/services/supabase.ts`
- `functions/api/src/middlewares/eventPanelAuth.ts`
- `functions/api/src/middlewares/requireEventRole.ts`
- `infra/sql/migrations/032_create_event_activity_events.sql`

## 4. Principio general de integracion

Reglas obligatorias:

- Llamar `recordEventActivity` desde TypeScript despues de conocer el resultado de la operacion principal.
- No escribir activity dentro de RPCs en este bloque.
- No duplicar logica de emision, email ni check-in dentro del helper.
- No modificar RPCs para este slice.
- No cambiar el HTTP status por fallo de activity.
- No incluir errores de activity en response publica del endpoint en MVP.
- No hacer retry ni cola/background en MVP.
- No guardar tokens, QR payload, raw URL, request/response crudos ni PII sensible.

Best-effort:

- Si `recordEventActivity` devuelve `{ ok: false }`, el endpoint mantiene su respuesta original.
- El error se puede loggear de forma controlada con `eventId`, `action`, `entityType`, `source` y codigo estable.
- No loggear metadata cruda ni datos PII.

Actor:

- Acciones ejecutadas por owner/staff usan `actor.type = "event_panel_user"`.
- El actor panel sale de `req.eventPanelUser.authUserId`, `req.eventPanelUser.role` y `req.eventPanelUser.displayName`.
- Acciones automaticas del sistema usan `actor.type = "system"`.

## 5. Integracion manual-issue

Endpoint:

- `POST /panel/events/:eventId/orders/manual-issue`

Momento:

- Despues de que la RPC `issue_event_manual_order` devuelve `ok: true`.
- Registrar activity de emision antes o despues del envio automatico es aceptable, pero siempre despues de crear order/items/entries.
- Fallo de activity no afecta el `201`.

Decision MVP:

- Registrar `event_order_manual_issued` una vez por orden.
- Registrar `event_entry_issued` por cada entry emitida.
- Para Ibiza, el volumen esperado de hasta miles de entries es aceptable por los indices y paginacion, pero se debe evitar duplicar logs dentro del mismo request.

Activity de orden:

- `action`: `event_order_manual_issued`
- `entityType`: `event_order`
- `entityId`: `order.id`
- `eventOrderId`: `order.id`
- `source`: `manual`
- `actor`: `event_panel_user`
- `message`: `Orden manual emitida`
- metadata permitida:
  - `entries_count`
  - `total_amount`
  - `currency`
  - `ticket_name` solo si hay un unico tipo o resumen controlado

Activity por entry:

- `action`: `event_entry_issued`
- `entityType`: `event_order_entry`
- `entityId`: `entry.id`
- `eventOrderId`: `order.id`
- `eventOrderItemId`: `entry.event_order_item_id`
- `eventOrderEntryId`: `entry.id`
- `eventTicketTypeId`: `entry.ticket_type_id`
- `source`: `manual`
- `actor`: `event_panel_user`
- `message`: `Entrada emitida`
- metadata permitida:
  - `ticket_name`
  - `sales_unit_type`
  - `entries_per_unit`
  - `currency`
  - `total_amount` si representa linea/order y no PII

No guardar:

- buyer email/phone/document;
- attendee email/phone/document;
- attendee name;
- notes;
- `checkin_token`;
- response completa de la RPC.

## 6. Integracion email manual por entry

Endpoint:

- `POST /panel/events/:eventId/entries/:entryId/send-email`

Momento:

- Despues de `sendEventEntryQrEmailForEntry`.
- Registrar success o failure segun `deliveryResult`.
- Si el endpoint devuelve `404 entry_not_found`, no registrar activity porque no hay entity confiable.

Exito:

- `action`: `event_entry_email_sent`
- `entityType`: `event_email`
- `entityId`: `entry.id`
- `eventOrderEntryId`: `entry.id`
- `eventOrderId`: usar contexto si esta disponible por lookup ligero.
- `eventTicketTypeId`: usar contexto si esta disponible por lookup ligero.
- `source`: `manual_email`
- `actor`: `event_panel_user`
- `message`: `Email de QR enviado`
- metadata:
  - `email_status = sent`

Fallo:

- `action`: `event_entry_email_failed`
- `entityType`: `event_email`
- `entityId`: `entry.id`
- `eventOrderEntryId`: `entry.id`
- `source`: `manual_email`
- `actor`: `event_panel_user`
- `message`: `Fallo al enviar email de QR`
- metadata:
  - `email_status = failed`
  - `email_error_code` estable

No guardar:

- email del destinatario;
- respuesta cruda de Resend;
- QR payload;
- QR base64;
- stack trace;
- datos del attendee.

## 7. Integracion email automatico post manual-issue

Flujo:

- `manual-issue` crea entries y luego intenta envio automatico via `buildManualIssueEmailDelivery`.

Decision MVP:

- El email automatico post `manual-issue` usa `email_delivery.mode = order_bundle`.
- Activity debe reflejar entries cubiertas por el bundle.
- Registrar activity por cada entry cubierta con resultado `sent` o `failed` si se quiere historial por entry.
- No registrar `skipped` por limite en MVP porque no existe action especifica y `event_entry_email_failed` seria semanticamente imprecisa.
- Si producto necesita historial de skipped, crear action nueva futura, por ejemplo `event_entry_email_skipped`, mediante migracion/allowlist posterior.
- No agregar nuevas actions en este micro-ajuste.
- Usar la allowlist existente.

Exito por entry:

- `action`: `event_entry_email_sent`
- `entityType`: `event_email`
- `entityId`: `entry.id`
- `eventOrderId`: `order.id`
- `eventOrderEntryId`: `entry.id`
- `eventOrderItemId`: completar desde entry si esta disponible o lookup ligero.
- `eventTicketTypeId`: completar desde entry si esta disponible o lookup ligero.
- `source`: `automatic_email`
- `actor`: `system`
- `message`: `Email automatico de QR enviado`
- metadata:
  - `email_status = sent`
  - `delivery_mode = order_bundle`
  - `email_attempts = 1`
  - `bundle_entries_count`

Fallo por entry:

- `action`: `event_entry_email_failed`
- `entityType`: `event_email`
- `entityId`: `entry.id`
- `source`: `automatic_email`
- `actor`: `system`
- `message`: `Fallo al enviar email automatico de QR`
- metadata:
  - `email_status = failed`
  - `email_error_code`
  - `delivery_mode = order_bundle`
  - `email_attempts = 1`
  - `bundle_entries_count`

Skipped por limite:

- No registrar activity en MVP.
- La respuesta `email_delivery.status = "skipped"` sigue siendo fuente operativa inmediata para el request.
- No generar un log por cada entry omitida para evitar ruido.
- Para skip por `entries.length > 20`, no registrar activity en MVP salvo decision posterior.
- No guardar destinatario, token, QR payload, raw provider response, telefono, documento ni metadata cruda.

## 8. Integracion check-in QR

Endpoint:

- `PATCH /panel/events/:eventId/checkin/:token`

Momento:

- Despues de la respuesta RPC `check_in_event_entry_by_token`.
- Nunca guardar token, raw URL ni payload escaneado.
- Para `status = invalid`, registrar event-level activity sin entity.

Status `valid`:

- `action`: `event_entry_checked_in`
- `entityType`: `event_checkin`
- `entityId`: `entry.id`
- `eventOrderEntryId`: `entry.id`
- `source`: `qr`
- `actor`: `event_panel_user`
- `message`: `Entrada validada`
- metadata:
  - `previous_checkin_status = unused`
  - `next_checkin_status = used`

Status `already_used`:

- `action`: `event_entry_already_used_attempt`
- `entityType`: `event_checkin`
- `entityId`: `entry.id`
- `eventOrderEntryId`: `entry.id`
- `source`: `qr`
- `actor`: `event_panel_user`
- `message`: `Intento de validar entrada ya usada`
- metadata:
  - `reason_code = already_used`

Status `outside_window`:

- `action`: `event_entry_outside_window_attempt`
- `source`: `qr`
- `message`: `Intento de validar entrada fuera de ventana`
- metadata:
  - `reason_code = outside_window`

Status `voided`:

- `action`: `event_entry_voided_attempt`
- `source`: `qr`
- `message`: `Intento de validar entrada anulada`
- metadata:
  - `reason_code = voided`

Status `invalid`:

- `action`: `event_entry_invalid_token_attempt`
- `entityType`: `event_checkin`
- `entityId`: `null`
- `eventOrderEntryId`: `null`
- `source`: `qr`
- `actor`: `event_panel_user`
- `message`: `Intento de validar token invalido`
- metadata:
  - `reason_code = invalid_token`

Status `event_not_operable`:

- No registrar activity en MVP.
- Motivo: no existe action especifica y `outside_window` no describe correctamente el estado.
- Si se necesita registrar, crear action futura `event_entry_event_not_operable_attempt` con migracion/allowlist posterior.

Status `not_valid_status`:

- No registrar en MVP salvo que se mapee explicitamente a action futura.
- Motivo: la allowlist actual no tiene action especifica y no se debe sobrecargar `voided`.

## 9. Integracion fallback manual

Endpoint:

- `PATCH /panel/events/:eventId/entries/:entryId/use`

Momento:

- Despues de la respuesta RPC `check_in_event_entry_manually`.
- No guardar body/query overrides ni IDs invalidos.

Status `valid`:

- `action`: `event_entry_checked_in`
- `entityType`: `event_checkin`
- `entityId`: `entry.id`
- `eventOrderEntryId`: `entry.id`
- `source`: `manual`
- `actor`: `event_panel_user`
- `message`: `Entrada validada manualmente`
- metadata:
  - `previous_checkin_status = unused`
  - `next_checkin_status = used`

Status `already_used`:

- `action`: `event_entry_already_used_attempt`
- `source`: `manual`
- `message`: `Intento manual de validar entrada ya usada`
- metadata:
  - `reason_code = already_used`

Status `outside_window`:

- `action`: `event_entry_outside_window_attempt`
- `source`: `manual`
- `message`: `Intento manual de validar entrada fuera de ventana`
- metadata:
  - `reason_code = outside_window`

Status `voided`:

- `action`: `event_entry_voided_attempt`
- `source`: `manual`
- `message`: `Intento manual de validar entrada anulada`
- metadata:
  - `reason_code = voided`

Error `entry_not_found`:

- No registrar activity en MVP.
- Motivo: no hay entity confiable y no conviene persistir IDs invalidos.

Status `event_not_operable`:

- No registrar en MVP por falta de action especifica.

Status `not_valid_status`:

- No registrar en MVP salvo action futura.

## 10. Lookup adicional

Decision:

- No modificar RPCs en este bloque.
- Crear, en el CODE posterior, un helper TS interno de lookup liviano si el flujo necesita completar `event_order_id`, `event_order_item_id`, `event_ticket_type_id` o `ticket_name`.
- El lookup debe filtrar por `event_id + entry_id`.
- Si el lookup falla, no debe romper la operacion principal.

Regla por flujo:

- `manual-issue`: usar los IDs ya devueltos por RPC (`order`, `items`, `entries`).
- email manual: hacer lookup liviano por `event_id + entry_id` para completar order/ticket context si el delivery result no lo trae.
- email automatico bundle: usar order id de `manual-issue`, entry ids del result y lookup solo si falta item/ticket para completar activity por entry cubierta.
- check-in QR/manual: usar `result.entry.id` y lookup liviano si se quiere completar order/item/ticket.
- invalid token / entry_not_found: no hacer lookup.

Si el lookup falla:

- Para status con `entry.id`, registrar activity minima con `eventOrderEntryId` si es confiable.
- Si no hay `entry.id`, no registrar activity salvo `invalid_token` event-level.
- No exponer error de lookup al cliente.

## 11. Metadata por accion

Metadata permitida por accion:

| Action | Metadata permitida |
| --- | --- |
| `event_order_manual_issued` | `entries_count`, `total_amount`, `currency`, `ticket_name` controlado |
| `event_entry_issued` | `ticket_name`, `sales_unit_type`, `entries_per_unit`, `currency`, `total_amount` |
| `event_entry_email_sent` | `email_status = sent`, `delivery_mode = order_bundle` cuando sea automatico, `email_attempts`, `bundle_entries_count` |
| `event_entry_email_failed` | `email_status = failed`, `email_error_code`, `delivery_mode = order_bundle` cuando sea automatico, `email_attempts`, `bundle_entries_count` |
| `event_entry_checked_in` | `previous_checkin_status`, `next_checkin_status` |
| `event_entry_already_used_attempt` | `reason_code = already_used` |
| `event_entry_outside_window_attempt` | `reason_code = outside_window` |
| `event_entry_voided_attempt` | `reason_code = voided` |
| `event_entry_invalid_token_attempt` | `reason_code = invalid_token` |

Prohibido siempre:

- `checkin_token`
- token
- QR payload/base64
- raw URL
- request body
- response body
- headers
- email del comprador/asistente
- telefono
- documento
- actor auth user id dentro de metadata
- `local_id`
- metadata cruda
- stack trace
- respuesta cruda de Resend
- `source` dentro de metadata

## 12. Best-effort y errores

Reglas:

- `recordEventActivity` nunca debe cambiar la respuesta original del endpoint.
- No cambiar status HTTP por fallo de activity.
- No incluir errores de activity en response publica.
- Loggear solo error controlado sin metadata cruda ni PII.
- No reintentos en MVP.
- No cola/background en MVP.
- No ejecutar activity dentro de la transaccion/RPC principal.

## 13. Idempotencia y duplicados

Decision:

- Activity no es idempotente en este bloque.
- Si un endpoint se llama dos veces, puede generar dos logs de intento.
- Esto es aceptable para historial operativo.
- No agregar unique constraints de activity ahora.
- Evitar logs duplicados dentro del mismo request.

Ejemplos:

- Segundo check-in de una entry usada debe registrar `event_entry_already_used_attempt`, no duplicar `event_entry_checked_in`.
- Reenvio manual exitoso de email puede registrar otro `event_entry_email_sent`.
- Reintento de `manual-issue` que crea otra orden genera otro set de activity porque la operacion principal creo datos nuevos.

## 14. QA futuro

Manual-issue:

- crea order/items/entries;
- genera `event_order_manual_issued`;
- genera `event_entry_issued`;
- metadata no contiene PII/tokens;
- fallo simulado de activity no revierte emision.

Email manual:

- exito genera `event_entry_email_sent` con `source = manual_email`;
- fallo genera `event_entry_email_failed`;
- no guarda destinatario ni Resend raw response;
- fallo de activity no cambia respuesta de email.

Email automatico:

- success del bundle genera `event_entry_email_sent` por entry cubierta con `source = automatic_email`;
- failure del bundle genera `event_entry_email_failed` por entry cubierta con `source = automatic_email`;
- metadata incluye `delivery_mode = order_bundle`, `email_attempts = 1` y `bundle_entries_count`;
- skipped no genera activity en MVP;
- `email_delivery` mantiene su comportamiento actual.

Check-in QR:

- `valid` genera `event_entry_checked_in` con `source = qr`;
- `already_used` genera `event_entry_already_used_attempt`;
- `outside_window` genera `event_entry_outside_window_attempt`;
- `voided` genera `event_entry_voided_attempt`;
- `invalid` genera `event_entry_invalid_token_attempt` sin token;
- no rompe check-in ni mutacion atomica.

Fallback manual:

- `valid` genera `event_entry_checked_in` con `source = manual`;
- `already_used`, `outside_window` y `voided` generan attempts;
- `entry_not_found` no genera activity;
- no rompe fallback.

Regresiones:

- `/summary` sigue OK.
- `/entries` sigue OK.
- `/ticket-types` sigue OK.
- QR PNG sigue OK.
- `send-email` sigue OK.
- `manual-issue` sigue OK.
- panel local sigue OK.

## 15. Roadmap por slices

Slice 3E.4D:

- ASK/DOCS completado. Contrato de integracion de activity en flujos operativos documentado.

Slice 3E.4F1:

- Implementado, deployado y QA runtime PASS completo.
- Activity en `manual-issue` operativo.
- Registra `event_order_manual_issued` por orden y `event_entry_issued` por entry.
- No integra activity de email, check-in QR, fallback manual ni read activity.

Slice 3E.4F2:

- Implementado, deployado y QA runtime PASS completo.
- Activity en email manual por entry operativo.
- Activity en email automatico bundle operativo.
- No integra activity de check-in QR, fallback manual ni read activity.

Slice 3E.4G1:

- integrar activity en check-in QR.

Slice 3E.4G2:

- integrar activity en fallback manual.

Slice 3E.4E:

- endpoint read-only `GET /panel/events/:eventId/activity`.

Nota:

- El orden puede ajustarse. Es valido crear lectura `/activity` antes de integrar todos los flujos si se quiere QA incremental, pero este contrato recomienda integrar primero los flujos que generan datos.

## 16. Estado Slice 3E.4F1 - activity en manual-issue QA runtime PASS

Estado: **implementado, deployado y QA runtime PASS completo**.

Alcance implementado:

- `recordEventActivity` se integro unicamente en `POST /panel/events/:eventId/orders/manual-issue`.
- La integracion es best-effort.
- No cambia la respuesta publica.
- No cambia el status HTTP.
- No modifica `email_delivery`.
- No agrega errores internos de activity en la response.
- No registra activity de email, check-in QR, fallback manual, read activity ni activity local.

QA runtime registrado como PASS:

- Owner Ibiza: `GET /panel/events/:eventId/me` respondio `200 OK`, `membership.role = owner`, `display_name = Owner Ibiza`.
- Owner local D'Lirio: `GET /panel/me` respondio `200 OK`.
- `GET /health` respondio `200 OK` con body `{"ok":true}`.
- Estado inicial: `GET /panel/events/:eventId/entries` respondio `200 OK`, `items = []`, `pagination.total = 0`.
- Emision simple General Preventa 1: `manual-issue` respondio `201 Created`, `items.length = 1`, `entries.length = 1`, `order.source = manual_issue`, `payment_status = confirmed_externally`.
- En la emision simple, `email_delivery.attempted = 1`, `sent = 1`, `failed = 0`, `status = sent`.
- La response publica no incluyo `activity_error`, `internal_activity_error`, `recordEventActivity`, `stack`, `SQL` ni `sql`.

Activity por orden simple:

- Se creo 1 row `event_order_manual_issued`.
- `entity_type = event_order`.
- `entity_id = order.id`.
- `event_order_id = order.id`.
- `event_order_entry_id = null`.
- `action = event_order_manual_issued`.
- `source = manual`.
- `actor_type = event_panel_user`.
- `actor_role = owner`.
- `actor_display_name = Owner Ibiza`.
- `message = Orden manual emitida`.
- metadata: `currency = PYG`, `ticket_name = General Preventa 1`, `total_amount = 140000`, `entries_count = 1`.

Activity por entry simple:

- Se creo 1 row `event_entry_issued`.
- `entity_type = event_order_entry`.
- `entity_id = entry.id`.
- `event_order_entry_id = entry.id`.
- `event_order_item_id = item.id`.
- `event_ticket_type_id = General Preventa 1`.
- `event_order_id = order.id`.
- `action = event_entry_issued`.
- `source = manual`.
- `actor_type = event_panel_user`.
- `actor_role = owner`.
- `message = Entrada emitida`.
- metadata: `currency = PYG`, `ticket_name = General Preventa 1`, `total_amount = 140000`, `sales_unit_type = single_entry`, `entries_per_unit = 1`.

Conteos exactos simple:

- `event_order_manual_issued = 1`.
- `event_entry_issued = 1`.

Metadata simple segura:

- No se detecto `email`, `phone`, `document`, `buyer`, `attendee`, `notes`, `checkin_token`, `qr_payload`, `qr_base64`, `request`, `response`, `headers` ni `local_id`.

Emision package Mesa VIP Preventa 1:

- `manual-issue` respondio `201 Created`.
- `items.length = 1`.
- `entries.length = 10`.
- `sales_unit_type = package`.
- `entries_per_unit = 10`.
- `order.source = manual_issue`.
- `payment_status = confirmed_externally`.

Conteos exactos package:

- `event_order_manual_issued = 1`.
- `event_entry_issued = 10`.

Metadata package segura:

- No se detecto `email`, `phone`, `document`, `buyer`, `attendee`, `notes`, `checkin_token`, `qr_payload`, `qr_base64`, `request`, `response`, `headers` ni `local_id`.

No integracion fuera de manual-issue:

- Para estas ordenes QA no se registraron `event_entry_email_sent`, `event_entry_email_failed`, `event_entry_checked_in`, `event_entry_already_used_attempt`, `event_entry_outside_window_attempt`, `event_entry_voided_attempt` ni `event_entry_invalid_token_attempt`.

Regresiones principales:

- `GET /panel/events/:eventId/summary` respondio `200 OK`.
- `GET /panel/events/:eventId/ticket-types` respondio `200 OK`.
- `GET /panel/events/:eventId/entries` respondio `200 OK`.
- `GET /panel/me` con owner local respondio `200 OK`.
- `GET /panel/orders/summary` con owner local respondio `200 OK`.

Limpieza QA:

- Se limpio activity primero y luego orders/items/entries QA.
- `qa_activity_remaining = 0`.
- `qa_orders_remaining = 0`.
- `GET /panel/events/:eventId/entries` volvio a `items = []`, `pagination.total = 0`.
- `GET /panel/events/:eventId/summary` volvio a operaciones en cero: `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `used_entries_count = 0`, `unused_entries_count = 0`, `voided_entries_count = 0`, `issued_commercial_amount = 0`.

Comportamiento validado:

- `manual-issue` sigue respondiendo `201`.
- La response publica no expone errores internos de activity.
- Se registra 1 activity `event_order_manual_issued` por orden.
- Se registra 1 activity `event_entry_issued` por cada entry emitida.
- Caso simple genera `1 + 1`.
- Caso package/Mesa VIP genera `1 + 10`.
- `source = manual`.
- `actor_type = event_panel_user`.
- `actor_role = owner`.
- Metadata sin PII, tokens, QR payload/base64, request/response/headers ni `local_id`.
- No se registran logs de email/check-in/fallback en este slice.
- Regresiones principales OK.
- Limpieza QA OK.

Estado posterior del email automatico bundle:

- El flujo post `manual-issue` fue ajustado a `email_delivery.mode = order_bundle`.
- QA runtime PASS: General 1 entry envio 1 email con 1 QR.
- QA runtime PASS: Mesa VIP 10 entries envio 1 solo email con 10 QR.
- `email_delivery.email_attempts = 1` cuando se intento enviar.
- `email_delivery.attempted`, `sent`, `failed` y `skipped` miden entries cubiertas.
- Caso `>20 entries` quedo `skipped` con `reason = too_many_entries_for_order_bundle_email`.
- `email_sent_at` se actualiza en todas las entries cuando el bundle sale OK.
- La activity de email se integro despues en Slice 3E.4F2.

Proximo paso recomendado:

- Slice 3E.4G1: activity en check-in QR.
- Integrar `recordEventActivity` en `PATCH /panel/events/:eventId/checkin/:token`.
- `source = qr`.
- Registrar `valid`, `already_used`, `outside_window`, `voided` e invalid token.
- No guardar token, raw URL, QR payload ni PII.
- No tocar fallback manual todavia.

## 17. Estado Slice 3E.4F2 - activity en emails QA runtime PASS

Estado: **implementado, deployado y QA runtime PASS completo**.

Alcance implementado:

- `recordEventActivity` se integro en email manual por entry: `POST /panel/events/:eventId/entries/:entryId/send-email`.
- `recordEventActivity` se integro en email automatico bundle post `manual-issue`.
- Email manual registra `event_entry_email_sent` / `event_entry_email_failed` con `source = manual_email`.
- Email automatico bundle registra `event_entry_email_sent` / `event_entry_email_failed` por entry cubierta con `source = automatic_email`.
- `skipped >20` no registra activity de email en MVP porque no hubo intento de envio.
- No se integro activity de check-in QR, fallback manual, read activity ni activity local.

QA runtime registrado como PASS:

- `GET /health` -> `200 OK`, body `{"ok":true}`.
- `GET /panel/events/:eventId/me` con owner Ibiza -> `200 OK`, `membership.role = owner`.
- Limpieza preventiva del marcador `QA-3E4F2R` -> `qa_3e4f2r_orders = 0`.

Email automatico simple:

- `POST /panel/events/:eventId/orders/manual-issue` -> `201 Created`.
- `entries.length = 1`.
- `email_delivery.mode = order_bundle`.
- `email_delivery.email_attempts = 1`.
- `email_delivery.attempted = 1`.
- `email_delivery.sent = 1`.
- `email_delivery.failed = 0`.
- `email_delivery.skipped = 0`.
- `email_delivery.status = sent`.
- Activity generado: `event_order_manual_issued / manual = 1`.
- Activity generado: `event_entry_issued / manual = 1`.
- Activity generado: `event_entry_email_sent / automatic_email / order_bundle = 1`.

Detalle de activity automatico simple:

- `action = event_entry_email_sent`.
- `source = automatic_email`.
- `entity_type = event_email`.
- `entity_id = entry.id`.
- `event_order_id = order.id`.
- `event_order_item_id = item.id`.
- `event_order_entry_id = entry.id`.
- `event_ticket_type_id = ticket_type.id`.
- `actor_type = system`.
- `actor_role = null`.
- `message = Email automatico de QR enviado`.
- Metadata: `ticket_name = General Preventa 1`.
- Metadata: `email_status = sent`.
- Metadata: `delivery_mode = order_bundle`.
- Metadata: `email_attempts = 1`.
- Metadata: `bundle_entries_count = 1`.

Email manual por entry:

- `POST /panel/events/:eventId/entries/:entryId/send-email` -> `200 OK`.
- `ok = true`.
- `email.status = sent`.
- Activity validado para la misma entry: `event_entry_email_sent / automatic_email / order_bundle = 1`.
- Activity validado para la misma entry: `event_entry_email_sent / manual_email / single_entry = 1`.

Mesa VIP:

- `manual-issue` con 1 Mesa VIP Preventa 1 -> `201 Created`.
- `entries.length = 10`.
- `email_delivery.mode = order_bundle`.
- `email_delivery.email_attempts = 1`.
- `email_delivery.attempted = 10`.
- `email_delivery.sent = 10`.
- `email_delivery.failed = 0`.
- `email_delivery.skipped = 0`.
- `email_delivery.status = sent`.
- Activity generado: `event_order_manual_issued / manual = 1`.
- Activity generado: `event_entry_issued / manual = 10`.
- Activity generado: `event_entry_email_sent / automatic_email / order_bundle = 10`.

Skip mayor a 20:

- `manual-issue` con 3 Mesas VIP = 30 entries -> `201 Created`.
- `entries.length = 30`.
- `email_delivery.mode = order_bundle`.
- `email_delivery.email_attempts = 0`.
- `email_delivery.attempted = 0`.
- `email_delivery.sent = 0`.
- `email_delivery.failed = 0`.
- `email_delivery.skipped = 30`.
- `email_delivery.status = skipped`.
- `email_delivery.reason = too_many_entries_for_order_bundle_email`.
- Activity generado: `event_order_manual_issued / manual = 1`.
- Activity generado: `event_entry_issued / manual = 30`.
- No se genero `event_entry_email_sent`.
- No se genero `event_entry_email_failed`.
- Nota: para `>20`, no hubo intento de envio; por eso skipped no genera activity de email en MVP. La response `email_delivery` es la fuente operativa inmediata.

Metadata segura:

- El scan de metadata devolvio 0 rows.
- No se detecto email crudo, phone, document, buyer, attendee, `checkin_token`, `qr_payload`, `qr_base64`, request, response, headers, `local_id` ni `source` duplicado dentro de metadata.

Regresiones:

- `GET /panel/events/:eventId/summary` -> `200 OK`.
- `GET /panel/events/:eventId/ticket-types` -> `200 OK`.
- `GET /panel/events/:eventId/entries` -> `200 OK`.
- `GET /panel/events/:eventId/entries/:entryId/qr` -> `200 OK`, `Content-Type = image/png`.
- `GET /panel/me` con owner local -> `200 OK`.
- `GET /panel/orders/summary` con owner local -> `200 OK`.

Limpieza QA:

- Se limpiaron registros QA del marcador `QA-3E4F2R`.
- `qa_activity_remaining = 0`.
- `qa_orders_remaining = 0`.
- `GET /panel/events/:eventId/entries` -> `items = []`, `pagination.total = 0`.
- `GET /panel/events/:eventId/summary` -> operaciones en cero: `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `used_entries_count = 0`, `unused_entries_count = 0`, `voided_entries_count = 0`, `issued_commercial_amount = 0`.

Comportamiento validado:

- Email automatico bundle registra `event_entry_email_sent` con `source = automatic_email`.
- Email manual por entry registra `event_entry_email_sent` con `source = manual_email`.
- Mesa VIP registra 10 activity rows de email, una por entry cubierta por el bundle.
- `>20` no registra activity de email porque no hubo intento de envio.
- Metadata queda sanitizada.
- `email_delivery` mantiene el contrato esperado.
- Activity previa de `manual-issue` sigue funcionando.
- QR PNG sigue funcionando.
- Panel local no se rompio.
- Limpieza QA quedo en cero.

## 18. No-goals

Fuera de este documento:

- implementar codigo;
- tocar endpoints;
- tocar SQL/migraciones;
- crear endpoint `/activity`;
- frontend/UI;
- pagos;
- `/payments/callback`;
- activity local;
- analytics avanzado;
- cola/background;
- retencion/purge;
- idempotencia avanzada;
- guardar tokens;
- guardar PII;
- modificar RPCs salvo necesidad fuerte posterior.
