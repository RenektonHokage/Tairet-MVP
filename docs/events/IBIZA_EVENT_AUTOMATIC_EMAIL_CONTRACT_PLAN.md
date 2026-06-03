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
- Una Mesa VIP con 10 accesos genera 10 entries y, por lo tanto, hasta 10 emails.

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
- Si la emision manual devuelve datos creados, el endpoint intenta email para las entries creadas en esa respuesta.

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

Decision para el primer CODE:

- Usar best-effort sincrono controlado dentro del request `manual-issue`.
- Usar concurrencia limitada baja.
- No introducir cola/background en este slice porque no hay patron existente validado para Eventos.
- Dejar cola/background para import CSV, volumen alto o delivery tracking futuro.

Concurrencia recomendada:

- `max_concurrency = 3` envios simultaneos.
- No usar `Promise.all` sin limite para todas las entries.
- Procesar resultados por entry y acumular resumen.

## 6. Fallos parciales

Decision:

- Si un email falla, no se revierte la emision.
- Si algunos emails salen y otros fallan, `manual-issue` sigue siendo exitoso.
- El HTTP status sigue siendo `201` si order/items/entries fueron creados.
- La respuesta incluye `email_delivery` con estado y resultados por entry.
- Entries con email exitoso actualizan `email_sent_at`.
- Entries con email fallido quedan con `email_sent_at = null`, salvo que ya tuvieran un valor previo por otro envio.
- Staff puede usar `POST /panel/events/:eventId/entries/:entryId/send-email` como reenvio manual.

Estados de entrega:

- `sent`: todos los emails intentados fueron enviados correctamente.
- `partial_failed`: al menos uno enviado y al menos uno fallido.
- `failed`: se intento enviar y todos fallaron.
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
    "mode": "automatic_best_effort",
    "attempted": 1,
    "sent": 1,
    "failed": 0,
    "skipped": 0,
    "status": "sent",
    "reason": null,
    "results": [
      {
        "entry_id": "uuid",
        "to": "attendee@example.com",
        "status": "sent",
        "email_sent_at": "2026-06-01T20:14:03.488+00:00",
        "error_code": null
      }
    ]
  }
}
```

Ejemplo con fallo parcial:

```json
{
  "email_delivery": {
    "mode": "automatic_best_effort",
    "attempted": 2,
    "sent": 1,
    "failed": 1,
    "skipped": 0,
    "status": "partial_failed",
    "reason": null,
    "results": [
      {
        "entry_id": "uuid-1",
        "to": "ok@example.com",
        "status": "sent",
        "email_sent_at": "2026-06-01T20:14:03.488+00:00",
        "error_code": null
      },
      {
        "entry_id": "uuid-2",
        "to": "fail@example.com",
        "status": "failed",
        "email_sent_at": null,
        "error_code": "email_send_failed"
      }
    ]
  }
}
```

Ejemplo con envio omitido por limite:

```json
{
  "email_delivery": {
    "mode": "automatic_best_effort",
    "attempted": 0,
    "sent": 0,
    "failed": 0,
    "skipped": 25,
    "status": "skipped",
    "reason": "too_many_entries_for_sync_email",
    "results": []
  }
}
```

No incluir en `email_delivery`:

- `checkin_token`;
- QR payload;
- QR base64;
- attendee phone;
- buyer PII;
- `auth_user_id`;
- `local_id`;
- metadata cruda.

## 8. Codigos HTTP

Decision:

- Si la emision fue creada pero uno o mas emails fallaron, responder `201`.
- Los errores de email no convierten `manual-issue` en `500` si la emision fue creada.
- El estado de email se comunica en `email_delivery.status`.
- `500` queda reservado para fallo inesperado de emision/RPC o error estructural antes de crear datos.
- Si el envio automatico se omite por limite, responder `201` con `email_delivery.status = "skipped"`.

Mapeo:

- RPC/input/event/stock fallan antes de crear datos: mantener mapeo actual de `manual-issue`.
- Email total o parcialmente fallido despues de crear datos: `201` + `email_delivery.status`.
- Error recuperando contexto de email para una entry creada: contar como fallo de email de esa entry, no como fallo de emision.
- Error actualizando `email_sent_at` despues de un envio exitoso: contar como fallo operacional de delivery para esa entry y reportar `error_code = "email_update_failed"`; no revertir entry.

## 9. Reutilizacion definida

Reutilizar:

- `sendEventEntryQrEmail()` para template, subject, QR inline y adjunto.
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

- Mesa VIP genera 10 emails.
- Requests con muchas entries pueden tardar.
- Resend puede fallar o demorar.
- Sin cola/background, el request queda acoplado al tiempo de envio.

Decision inicial:

- Enviar automaticamente solo si `entries.length <= 20`.
- Si `entries.length > 20`, crear la emision y devolver `email_delivery.status = "skipped"`.
- `reason = "too_many_entries_for_sync_email"`.
- `skipped = entries.length`.
- Staff puede usar reenvio por entry mientras no exista cola/bulk sender.

Concurrencia:

- `max_concurrency = 3`.
- Mantener timeout global del request bajo observacion en QA.
- Si QA muestra latencia excesiva, no subir concurrencia sin medir.

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

- Se actualiza por cada entry enviada correctamente.
- Si se reenvia, se actualiza con un nuevo timestamp.
- Si falla un envio y `email_sent_at` era `null`, queda `null`.
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
- Response puede incluir `email_delivery.results[].to` porque es necesario para soporte de entrega.
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

- `manual-issue` de 1 General Preventa 1 crea 1 entry y envia 1 email automatico.
- Response `201` incluye `email_delivery.attempted = 1`, `sent = 1`, `failed = 0`, `status = "sent"`.
- Email recibido con QR visible.
- `email_sent_at` queda actualizado para la entry.
- `manual-issue` de 1 Mesa VIP Preventa 1 crea 10 entries y envia 10 emails, si `entries.length <= 20`.
- Response de Mesa VIP refleja `attempted = 10`, `sent = 10`, `status = "sent"` o `partial_failed` segun resultados reales.
- Request con mas de 20 entries crea la emision y devuelve `email_delivery.status = "skipped"`, `reason = "too_many_entries_for_sync_email"`.
- Fallo parcial de email no revierte order/items/entries.
- Entry con fallo mantiene `email_sent_at = null` si no tenia envio previo.
- Entry exitosa actualiza `email_sent_at`.
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
- Despues de RPC exitosa, intenta envio automatico de emails QR en modo `automatic_best_effort`.
- La respuesta `201` incluye `email_delivery`.
- Los fallos parciales de email no revierten la emision.
- El limite `entries.length > 20` omite envio automatico y devuelve `status = skipped`.
- `send-email` por entry sigue funcionando como fallback operativo.
- QR endpoint sigue funcionando.
- No se toca check-in, pagos ni `/payments/callback`.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente.
- Estado inicial limpio: `GET /panel/events/:eventId/entries` -> `200 OK`, `items = []`, `pagination.total = 0`.
- General Preventa 1: `201 Created`, `entries.length = 1`, `email_delivery.mode = automatic_best_effort`, `attempted = 1`, `sent = 1`, `failed = 0`, `skipped = 0`, `status = sent`, `reason = null`, `results.length = 1`, `results[0].status = sent`, `results[0].email_sent_at != null`.
- Email General recibido en Gmail con evento `Ibiza`, entrada `General Preventa 1`, asistente `QA Auto General` y QR visible.
- Response General sin `checkin_token`, `/events/checkin/`, base64, `attendee_phone`, buyer PII, `auth_user_id`, `local_id` ni metadata.
- Mesa VIP Preventa 1: `201 Created`, `entries.length = 10`, `attempted = 10`, `sent = 7`, `failed = 3`, `skipped = 0`, `status = partial_failed`, `reason = null`, `results.length = 10`.
- Mesa partial_failed validada como comportamiento esperado de `automatic_best_effort`: las 10 entries fueron creadas; 7 enviadas tienen `email_sent_at`; 3 fallidas quedaron con `error_code = email_send_failed`.
- Gmail recibio 7 correos de Mesa (`QA Mesa Auto 1`, `2`, `3`, `4`, `5`, `9`, `10`) y 1 correo General, 8 correos totales.
- Limite mayor a 20: 21 General Preventa 1 emitidas, `201 Created`, `entries.length = 21`, `email_delivery.status = skipped`, `reason = too_many_entries_for_sync_email`, `attempted = 0`, `sent = 0`, `failed = 0`, `skipped = 21`, `results = []`.
- Fallback manual: `POST /panel/events/:eventId/entries/:entryId/send-email` -> `200 OK`, `ok = true`, `email.status = sent`, `entry.email_sent_at != null`.
- QR endpoint: `GET /panel/events/:eventId/entries/:entryId/qr` -> `200 OK`, `Content-Type = image/png`.
- Errores previos siguen correctos: attendees incorrectos -> `400 invalid_attendees_count`; ticket inexistente -> `404 ticket_type_not_found`; owner local sin membership -> `403`; sin auth -> `401`; token invalido -> `401`; eventId invalido -> `400 Invalid eventId`; stock insuficiente -> `409 insufficient_stock`.
- Regresiones: `/summary`, `/ticket-types`, `/entries`, `/panel/me` local y `/panel/orders/summary` local respondieron `200 OK`.
- Consistencia antes de limpieza: 3 ordenes QA, 32 entries y `issued_commercial_amount = 6280000`.
- Limpieza QA: se limpiaron las ordenes QA; `/entries` volvio a `items = []`, `pagination.total = 0`, `pagination.total_pages = 0`; `/summary` volvio a `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`.

## 17. Proximo paso recomendado

Slice 3E.1 - ASK/DOCS: contrato de check-in de eventos.

Alcance sugerido:

- definir endpoint de check-in por QR/token opaco;
- definir validacion por `event_id`;
- definir ventana de check-in;
- definir respuesta para `valid`, `already_used`, `invalid`, `outside_window` y `voided`;
- definir relacion con scanner futuro;
- definir fallback manual futuro;
- no implementar todavia check-in;
- no tocar pagos ni `/payments/callback`.
