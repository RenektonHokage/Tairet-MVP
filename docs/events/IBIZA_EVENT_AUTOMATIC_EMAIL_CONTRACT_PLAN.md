# Ibiza Slice 3D.3B: contrato de email automatico post manual-issue

## 1. Proposito

Este documento define el contrato tecnico y de producto para conectar el envio automatico de email QR despues de una emision manual exitosa de entradas del evento Ibiza.

El objetivo es dejar listo el diseno para un futuro slice CODE que modifique:

- `POST /panel/events/:eventId/orders/manual-issue`

Este documento no implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, pagos, check-in ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo validado:

- Slice 3B.2: `POST /panel/events/:eventId/orders/manual-issue` implementado y QA runtime PASS completo.
- Slice 3C.2: `GET /panel/events/:eventId/entries` implementado y QA runtime PASS.
- Slice 3D.2: `GET /panel/events/:eventId/entries/:entryId/qr` implementado y QA runtime PASS.
- Slice 3D.3A: `POST /panel/events/:eventId/entries/:entryId/send-email` implementado y QA runtime PASS completo.

Modelo vigente:

- `event_orders` = orden comercial/backoffice.
- `event_order_items` = linea comercial vendida.
- `event_order_entries` = acceso individual / unidad QR.
- Cada `event_order_entry` tiene su propio QR.
- Una Mesa VIP con 10 accesos genera 10 entries y un email bundle con hasta 10 QR.

## 3. Archivos revisados

Documentos:

- `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`
- `docs/events/IBIZA_MANUAL_ISSUE_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`

Codigo:

- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/services/eventEmails.ts`
- `functions/api/src/services/eventQr.ts`
- `functions/api/src/services/emails.ts`
- `functions/api/src/services/supabase.ts`
- `functions/api/src/middlewares/eventPanelAuth.ts`
- `functions/api/src/middlewares/requireEventRole.ts`

Hallazgos:

- `manual-issue` ya llama la RPC `issue_event_manual_order` y devuelve `201` con `order`, `items` y `entries`.
- `send-email` por entry ya reutiliza `sendEventEntryQrEmail()` y actualiza `email_sent_at` solo despues de envio correcto.
- El envio automatico post `manual-issue` usa email bundle por orden.
- `generateEventEntryQrPng()` centraliza el payload QR de Eventos.
- `sendEmail()` usa Resend o stub si `EMAIL_ENABLED !== "true"` o falta API key.
- El flujo local de `orders.ts` tiene patron best-effort: fallo de email no revierte la orden.
- No se encontro una cola/background job especifica para este flujo en los archivos revisados.

## 4. Momento de envio

Decision:

- El envio automatico ocurre despues de que la RPC `issue_event_manual_order` termina correctamente.
- El envio ocurre fuera de la transaccion DB de creacion de order/items/entries.
- Nunca se intenta enviar email antes de crear order/items/entries.
- Si la RPC falla o devuelve `ok: false`, no se intenta email.
- Si la emision manual devuelve datos creados, el endpoint intenta un email bundle para la orden creada.

Motivo:

- La RPC sigue siendo la fuente atomica para stock y persistencia.
- Email es un efecto externo y no debe formar parte de la transaccion DB.
- Un fallo de Resend no debe invalidar una entrada ya emitida.

## 5. Estrategia de envio

Opciones evaluadas:

- envio sincrono dentro del request `manual-issue`;
- envio best-effort con concurrencia limitada;
- envio async/background;
- cola futura.

Decision vigente:

- Usar un email automatico por orden (`mode = order_bundle`).
- El destinatario principal es el comprador/responsable de la orden.
- El email incluye todos los QR individuales de la orden.
- Una orden con 1 entry envia 1 email con 1 QR.
- Una Mesa VIP/package con 10 entries envia 1 email con 10 QR.
- Las entries siguen siendo unidades individuales para QR/check-in.
- No introducir cola/background en este slice porque no hay patron existente validado para Eventos.
- Dejar cola/background para import CSV, volumen alto o delivery tracking futuro.

Intentos:

- `email_attempts = 1` cuando se intenta enviar el bundle.
- `attempted`, `sent`, `failed` y `skipped` miden entries cubiertas por el bundle, no emails enviados.
- `send-email` manual por entry sigue funcionando como fallback puntual.

## 6. Fallos parciales

Decision:

- Si falla el email bundle, no se revierte la emision.
- Si el bundle falla, ninguna entry nueva se marca como enviada por ese intento.
- El HTTP status sigue siendo `201` si order/items/entries fueron creados.
- La respuesta incluye `email_delivery` con estado por entries cubiertas.
- Si el bundle se envia correctamente, todas las entries incluidas actualizan `email_sent_at`.
- Si el email fue enviado pero falla el update de `email_sent_at`, se reporta un codigo diferenciado como `email_sent_but_update_failed`.
- Staff puede usar `POST /panel/events/:eventId/entries/:entryId/send-email` como reenvio manual puntual.

Estados de entrega:

- `sent`: el email bundle fue enviado y todas las entries cubiertas quedaron marcadas.
- `partial_failed`: reservado para casos excepcionales como update parcial/inconsistencia defensiva.
- `failed`: se intento enviar el bundle y fallo el envio o la preparacion del contexto.
- `skipped`: no se intento envio automatico por una regla operativa.

## 7. Response contract de manual-issue

La respuesta exitosa de `manual-issue` sigue siendo `201` y conserva:

- `order`
- `items`
- `entries`

Se agrega `email_delivery`:

```json
{
  "order": {},
  "items": [],
  "entries": [],
  "email_delivery": {
    "mode": "order_bundle",
    "email_attempts": 1,
    "attempted": 1,
    "sent": 1,
    "failed": 0,
    "skipped": 0,
    "status": "sent",
    "reason": null,
    "results": [
      {
        "entry_id": "uuid",
        "status": "sent",
        "email_sent_at": "2026-06-01T20:14:03.488+00:00",
        "error_code": null
      }
    ]
  }
}
```

Ejemplo Mesa VIP/package con 10 QR en un solo email:

```json
{
  "email_delivery": {
    "mode": "order_bundle",
    "email_attempts": 1,
    "attempted": 10,
    "sent": 10,
    "failed": 0,
    "skipped": 0,
    "status": "sent",
    "reason": null,
    "results": [
      {
        "entry_id": "uuid-1",
        "status": "sent",
        "email_sent_at": "2026-06-01T20:14:03.488+00:00",
        "error_code": null
      },
      {
        "entry_id": "uuid-10",
        "status": "sent",
        "email_sent_at": "2026-06-01T20:14:03.488+00:00",
        "error_code": null
      }
    ]
  }
}
```

Ejemplo con envio omitido por limite:

```json
{
  "email_delivery": {
    "mode": "order_bundle",
    "email_attempts": 0,
    "attempted": 0,
    "sent": 0,
    "failed": 0,
    "skipped": 25,
    "status": "skipped",
    "reason": "too_many_entries_for_order_bundle_email",
    "results": [
      {
        "entry_id": "uuid",
        "status": "skipped",
        "email_sent_at": null,
        "error_code": "too_many_entries_for_order_bundle_email"
      }
    ]
  }
}
```

Semantica:

- `email_attempts` mide cantidad de emails enviados o intentados.
- `attempted`, `sent`, `failed` y `skipped` miden entries cubiertas.
- En `skipped`, `attempted = 0` significa que no se intento enviar ningun email.
- `skipped` representa entries omitidas por regla de limite.
- `partial_failed` queda reservado para casos excepcionales como update parcial/inconsistencia defensiva, no para el caso normal de Mesa VIP.

No incluir en `email_delivery`:

- `checkin_token`;
- QR payload;
- QR base64;
- email del destinatario;
- attendee phone;
- buyer PII;
- `auth_user_id`;
- `local_id`;
- metadata cruda.

## 8. Codigos HTTP

Decision:

- Si la emision fue creada pero el email bundle fallo, responder `201`.
- Los errores de email no convierten `manual-issue` en `500` si la emision fue creada.
- El estado de email se comunica en `email_delivery.status`.
- `500` queda reservado para fallo inesperado de emision/RPC o error estructural antes de crear datos.
- Si el envio automatico se omite por limite, responder `201` con `email_delivery.status = "skipped"`.

Mapeo:

- RPC/input/event/stock fallan antes de crear datos: mantener mapeo actual de `manual-issue`.
- Email bundle fallido despues de crear datos: `201` + `email_delivery.status`.
- Error recuperando contexto del bundle: contar como fallo de email de las entries cubiertas, no como fallo de emision.
- Error actualizando `email_sent_at` despues de un envio exitoso: reportar codigo diferenciado como `email_sent_but_update_failed`; no revertir entries.

## 9. Reutilizacion definida

Reutilizar:

- `sendEventOrderQrBundleEmail()` para template, subject, QR inline y adjuntos del bundle.
- `sendEventEntryQrEmail()` se mantiene intacto para reenvio manual por entry.
- `generateEventEntryQrPng()` para QR PNG y payload QR de Eventos.
- `sendEmail()` y Resend como transporte.
- La misma regla de no token texto validada en Slice 3D.3A.
- `send-email` por entry como reenvio manual/controlado.

No duplicar:

- template de email QR;
- logica QR;
- payload QR;
- inserciones de order/items/entries;
- logica de stock o transaccion;
- exposicion de tokens.

## 10. Limites y performance

Riesgos:

- Mesa VIP genera 10 QR en un solo email.
- Requests con muchas entries pueden tardar.
- Resend puede fallar o demorar.
- Sin cola/background, el request queda acoplado al tiempo de envio.

Decision inicial:

- Enviar automaticamente solo si `entries.length <= 20`.
- Si `entries.length > 20`, crear la emision y devolver `email_delivery.status = "skipped"`.
- `reason = "too_many_entries_for_order_bundle_email"`.
- `email_attempts = 0`.
- `attempted = 0`.
- `skipped = entries.length`.
- Staff puede usar reenvio por entry mientras no exista cola/bulk sender.

Performance:

- El bundle intenta 1 solo email por orden.
- Genera un QR PNG por entry incluida.
- Mantener timeout global del request bajo observacion en QA.
- Si QA muestra latencia excesiva, disenar cola/background antes de aumentar alcance sin medir.

Decision futura:

- Para import CSV, ventas masivas o muchas Mesas VIP en un solo request, disenar cola/background job.

## 11. Idempotencia y reenvios

Decision:

- `manual-issue` crea nuevas entries; por defecto intenta email para esas nuevas entries.
- Si el cliente reintenta `manual-issue` y crea otra orden, ese es un problema de idempotencia de emision, no de email.
- No resolver idempotencia completa de `manual-issue` en este slice.
- No bloquear reenvio si `email_sent_at` ya existe.
- `send-email` por entry sigue permitiendo reenvio posterior.

`email_sent_at`:

- Si el bundle se envia correctamente, se actualiza en todas las entries incluidas.
- Si falla el envio del bundle, ninguna entry se marca como enviada por ese intento.
- Si el email fue enviado pero falla el update de `email_sent_at`, se debe conservar un codigo diferenciado como `email_sent_but_update_failed` o equivalente.
- Si se reenvia manualmente por entry, se actualiza con un nuevo timestamp para esa entry.
- Si falla un reenvio y `email_sent_at` tenia valor previo, se conserva el valor previo.
- No borrar timestamps por fallos posteriores.

## 12. Seguridad y no exposicion

Reglas obligatorias:

- No exponer `checkin_token`.
- No devolver QR payload.
- No devolver QR base64.
- No loggear token, payload QR ni QR base64.
- No incluir token como texto en email.
- No incluir documento ni telefono en email visible.
- No incluir metadata cruda.
- No incluir buyer PII en `email_delivery`.
- No incluir destinatario en `email_delivery.results[]`.
- No aceptar override de email, token, QR payload, ticket o attendee desde cliente.
- `event_id` sigue viniendo solo del path y `req.eventPanelUser.eventId`.
- No usar `panel_users`.
- No usar `local_id`.

Logging:

- Loggear `eventId`, `orderId`, `entryId`, request id y `error_code`.
- No loggear `checkin_token`, payload QR, QR base64, phone, document ni buyer PII.
- Si `sendEmail()` loguea `to` por patron existente, no agregar PII adicional en la ruta.

## 13. Relacion con WhatsApp manual

Decision:

- Si email automatico falla, staff puede usar `GET /panel/events/:eventId/entries/:entryId/qr` para obtener el PNG.
- Staff puede enviar ese PNG manualmente por WhatsApp.
- WhatsApp sigue siendo respaldo operativo manual.
- No integrar WhatsApp API.
- No registrar delivery WhatsApp en este slice.
- No exponer `checkin_token` para WhatsApp; operar sobre imagen/recurso QR.

## 14. QA futuro para CODE

Casos minimos:

- `manual-issue` de 1 General Preventa 1 crea 1 entry y envia 1 email bundle con 1 QR.
- Response `201` incluye `email_delivery.mode = order_bundle`, `email_attempts = 1`, `attempted = 1`, `sent = 1`, `failed = 0`, `skipped = 0`, `status = "sent"`.
- Email recibido con QR visible.
- `email_sent_at` queda actualizado para la entry.
- `manual-issue` de 1 Mesa VIP Preventa 1 crea 10 entries y envia 1 email bundle con 10 QR, si `entries.length <= 20`.
- Response de Mesa VIP refleja `email_attempts = 1`, `attempted = 10`, `sent = 10`, `failed = 0`, `skipped = 0`, `status = "sent"`.
- Request con mas de 20 entries crea la emision y devuelve `email_delivery.status = "skipped"`, `reason = "too_many_entries_for_order_bundle_email"`.
- Fallo de email bundle no revierte order/items/entries.
- Si falla el bundle, las entries mantienen `email_sent_at = null` si no tenian envio previo.
- Si el bundle sale OK, todas las entries incluidas actualizan `email_sent_at`.
- `send-email` por entry sigue funcionando como reenvio.
- Response no expone `checkin_token`, QR payload, QR base64, attendee phone, buyer PII, `auth_user_id`, `local_id` ni metadata.
- Email visible no expone token, documento, telefono ni metadata.
- `/summary`, `/ticket-types` y `/entries` reflejan la emision.
- `GET /entries/:entryId/qr` sigue funcionando.
- Owner/staff Ibiza pueden emitir y disparar email automatico.
- Owner local sin membership sigue devolviendo `403`.
- Sin auth y token invalido siguen devolviendo `401`.
- Regresion panel local: `/panel/me` y `/panel/orders/summary` siguen en `200 OK`.
- Limpieza QA borra ordenes QA y confirma `/entries` vacio si no habia otras emisiones.

QA de fallo de email:

- Si se puede simular sin tocar produccion, validar `email_delivery.status = "failed"` o `partial_failed`.
- Si no se puede simular de forma segura, registrar `N/A` justificado y validar al menos que el codigo no revierte entradas ante excepcion en helper en entorno controlado.

## 15. No-goals

Fuera de este contrato y del primer CODE posterior:

- check-in;
- validacion manual;
- export;
- activity log;
- frontend/panel UI;
- B2C publico;
- pagos online;
- `/payments/callback`;
- WhatsApp API;
- import CSV;
- cola/background si no existe patron;
- idempotencia completa de `manual-issue`;
- anulacion/void;
- edicion/correccion de entradas;
- tracking avanzado de delivery;
- bulk email sender;
- retry automatico programado.

## 16. Estado Slice 3D.3B - email automatico post manual-issue QA runtime PASS

Estado: implementado, deployado y QA runtime PASS completo.

Se completo:

- `POST /panel/events/:eventId/orders/manual-issue` mantiene la RPC como fuente de creacion atomica.
- Despues de RPC exitosa, intenta un email bundle por orden en modo `order_bundle`.
- Una orden con 1 entry envia 1 email con 1 QR.
- Una Mesa VIP/package con 10 entries envia 1 email con 10 QR.
- La respuesta `201` incluye `email_delivery`.
- `email_delivery.email_attempts` mide emails intentados.
- `email_delivery.attempted`, `sent`, `failed` y `skipped` miden entries cubiertas.
- Si el bundle sale OK, `email_sent_at` se actualiza en todas las entries incluidas.
- Si falla el envio del bundle, ninguna entry se marca como enviada por ese intento.
- El limite `entries.length > 20` omite envio automatico y devuelve `status = skipped`.
- `send-email` por entry sigue funcionando como fallback operativo.
- QR endpoint sigue funcionando.
- Activity de email no se integro en este bloque.
- No se toca check-in, pagos ni `/payments/callback`.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente.
- `/panel/events/:eventId/me` con owner Ibiza -> `200 OK`, `membership.role = owner`.
- Estado inicial limpio: `GET /panel/events/:eventId/entries` -> `200 OK`, `items = []`, `pagination.total = 0`.
- General Preventa 1: `manual-issue` -> `201 Created`, `items.length = 1`, `entries.length = 1`, `email_delivery.mode = order_bundle`, `email_delivery.email_attempts = 1`, `attempted = 1`, `sent = 1`, `failed = 0`, `skipped = 0`, `status = sent`.
- DB General: entry QA quedo con `email_sent_at != null`.
- Gmail General: llego 1 email con 1 QR.
- Response General sin `checkin_token`, QR payload/base64, auth IDs, `local_id`, metadata, stack ni SQL.
- Mesa VIP Preventa 1: `manual-issue` -> `201 Created`, `items.length = 1`, `entries.length = 10`, `sales_unit_type = package`, `entries_per_unit = 10`, `email_delivery.mode = order_bundle`, `email_delivery.email_attempts = 1`, `attempted = 10`, `sent = 10`, `failed = 0`, `skipped = 0`, `status = sent`.
- DB Mesa: `entries_count = 10`, `entries_with_email_sent_at = 10`.
- Gmail Mesa: llego 1 solo email con 10 QR; no llegaron 10 correos separados.
- No hubo `partial_failed` en el caso Mesa VIP OK.
- Limite mayor a 20: 3 Mesas VIP / 30 entries emitidas, `201 Created`, `email_delivery.mode = order_bundle`, `email_delivery.email_attempts = 0`, `sent = 0`, `failed = 0`, `skipped = 30`, `status = skipped`, `reason = too_many_entries_for_order_bundle_email`.
- DB skip: `entries_count = 30`, `entries_with_email_sent_at = 0`.
- Fallback manual: `POST /panel/events/:eventId/entries/:entryId/send-email` -> `200 OK`, `ok = true`, `email.status = sent`, `entry.email_sent_at != null`.
- QR endpoint: `GET /panel/events/:eventId/entries/:entryId/qr` -> `200 OK`, `Content-Type = image/png`, `Cache-Control = no-store`, `X-Content-Type-Options = nosniff`.
- Activity de `manual-issue` siguio funcionando: `event_order_manual_issued = 3`, `event_entry_issued = 41`.
- En este bloque no se registro activity de email/check-in/fallback: `event_entry_email_sent = 0`, `event_entry_email_failed = 0`, `event_entry_checked_in = 0`, `event_entry_already_used_attempt = 0`, `event_entry_outside_window_attempt = 0`, `event_entry_voided_attempt = 0`, `event_entry_invalid_token_attempt = 0`.
- Posteriormente, Slice 3E.4F2 integro activity de email manual y email automatico bundle con QA runtime PASS completo.
- Errores previos siguen correctos: attendees incorrectos -> `400 invalid_attendees_count`; ticket inexistente -> `404 ticket_type_not_found`; owner local sin membership -> `403`; sin auth -> `401`; token invalido -> `401`; eventId invalido -> `400 Invalid eventId`; stock insuficiente -> `409 insufficient_stock`.
- Regresiones: `/summary`, `/ticket-types`, `/entries`, `/panel/me` local y `/panel/orders/summary` local respondieron `200 OK`.
- Limpieza QA: `qa_activity_remaining = 0`; `/entries` volvio a `items = []`, `pagination.total = 0`; `/summary` volvio a operaciones en cero.

## 17. Proximo paso recomendado

Slice 3E.4G1 - activity en check-in QR.

Alcance sugerido:

- integrar `recordEventActivity` en `PATCH /panel/events/:eventId/checkin/:token`;
- `source = qr`;
- registrar valid, already_used, outside_window, voided e invalid token;
- no guardar token, raw URL, QR payload ni PII;
- no tocar fallback manual todavia;
- no tocar pagos ni `/payments/callback`.

## 18. Estado Slice 3E.4F2 - activity en emails QA runtime PASS

Estado: implementado, deployado y QA runtime PASS completo.

Se valido:

- Email automatico bundle simple genero `event_entry_email_sent / automatic_email / order_bundle = 1`.
- Email manual por entry genero `event_entry_email_sent / manual_email / single_entry = 1`.
- Mesa VIP 10 entries genero `event_entry_email_sent / automatic_email / order_bundle = 10`.
- Caso `>20` / 30 entries quedo `email_delivery.status = skipped` y no genero activity de email porque no hubo intento de envio.
- Metadata de activity de email no contiene PII, tokens, QR payload/base64, request, response, headers, `local_id` ni `source` duplicado.
- Activity previa de `manual-issue` siguio funcionando.
- QR PNG, summary, ticket-types, entries y panel local siguieron OK.
- Limpieza QA dejo activity y ordenes QA en cero.
