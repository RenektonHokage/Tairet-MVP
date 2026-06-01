# Ibiza Slice 3D.1: contrato de QR visual, email automatico y entrega por WhatsApp

## 1. Proposito

Este documento define el contrato tecnico y de producto para generar, mostrar y entregar el QR asociado a cada entrada emitida del evento Ibiza.

Este paso es solo ASK / DOCS. No implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, pagos ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo validado:

- Slice 1B: migracion 027 aplicada y validada.
- Slice 1B.2: migracion 028 aplicada y validada, con `event_order_items` y vinculo hacia `event_order_entries`.
- Slice 1C: provisioning Ibiza aplicado y validado con 9 productos comerciales y owner/staff en `event_panel_users`.
- Slice 2A: `eventPanelAuth`, `requireEventRole` y `/me` con QA runtime PASS.
- Slice 2B: `/summary` y `/ticket-types` con QA runtime PASS.
- Slice 3A: contrato de emision manual aprobado.
- Slice 3B.1: RPC `issue_event_manual_order` creada y QA DB PASS.
- Slice 3B.2: `POST /panel/events/:eventId/orders/manual-issue` implementado y QA runtime PASS completo.
- Slice 3C.1: contrato de lectura operativa de entries aprobado.
- Slice 3C.2: `GET /panel/events/:eventId/entries` implementado y QA runtime PASS.

Modelo vigente:

- `event_orders` = orden comercial/backoffice.
- `event_order_items` = linea comercial vendida.
- `event_order_entries` = acceso individual y unidad futura de QR/check-in.
- `event_order_entries.checkin_token` existe en DB, pero no debe exponerse como texto crudo en endpoints JSON, exports, logs ni activity metadata.

## 3. Discovery de flujo existente

Piezas existentes reutilizables:

- `functions/api/src/services/emails.ts`
  - usa `Resend`;
  - tiene helper `sendEmail`;
  - usa `qrcode` con `QRCode.toBuffer`;
  - genera PNG base64 para adjunto e imagen inline CID;
  - tiene `renderEmailShell` reusable como patron visual;
  - tiene `sendOrderConfirmationEmail` para ordenes locales.
- `functions/api/src/routes/orders.ts`
  - crea orden local/free pass;
  - envia email best-effort despues de crear la orden;
  - si falla el email, no revierte la orden.
- `functions/api/src/routes/panel.ts`
  - check-in local por `checkin_token`;
  - valida tenant local antes de usar la orden;
  - registra activity con metadata sanitizada.
- `functions/api/src/services/operationalActivity.ts`
  - ya filtra claves sensibles como `checkin_token`, `token`, email, phone, document y nombres.
- `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`
  - usa scanner QR con `@zxing/browser`.
- `apps/web-b2c/src/components/shared/CheckoutBase.tsx`
  - usa `QRCodeSVG` para mostrar QR local en cliente.

Patrones que NO deben copiarse tal cual para Eventos:

- El flujo local/free pass devuelve `checkin_token` en JSON de `POST /orders`.
- El panel local muestra/copia `checkin_token` crudo.
- El email local incluye token texto como fallback.
- La busqueda local de ordenes puede devolver `checkin_token`.

Decision: Eventos puede reutilizar generacion QR, Resend, email best-effort, scanner y sanitizacion de metadata, pero no debe reutilizar el patron de exponer `checkin_token` crudo al usuario o al panel.

## 4. Concepto central

Reglas de producto:

- Cada `event_order_entry` tiene un QR visual asociado.
- El QR pertenece a la entry, no a la order completa.
- Una Mesa/package con 10 accesos genera 10 entries y, por lo tanto, 10 QRs individuales.
- Email y WhatsApp son canales de entrega, no modelos distintos de QR.
- WhatsApp es respaldo operativo manual, no canal principal del sistema.
- La entrada puede estar emitida aunque el QR visual o email todavia no haya sido entregado.

## 5. Contenido del QR

Opciones evaluadas:

- `checkin_token` directo.
- URL de validacion con token.
- payload interno firmado.
- referencia publica de entry mas token.
- recurso QR generado desde backend sin revelar payload en JSON.

Decision recomendada para Ibiza:

- El QR visual debe ser generado server-side desde un valor de validacion opaco.
- El endpoint de QR no debe devolver el valor de validacion como string JSON.
- Para el primer CODE, el valor interno puede ser `event_order_entries.checkin_token` siempre que:
  - solo viaje dentro del QR visual;
  - no se muestre como texto;
  - no se devuelva en JSON;
  - no se incluya en export;
  - no se incluya en logs;
  - no se incluya en activity metadata.
- Preferencia de payload dentro del QR: URL de validacion, no token desnudo.

Formato recomendado de payload QR:

```text
https://tairet.com.py/events/checkin/<opaque-validation-value>
```

Notas:

- `<opaque-validation-value>` puede mapear inicialmente a `checkin_token`.
- El futuro scanner de Eventos debe poder parsear la URL y extraer el valor opaco.
- Si se decide usar token directo por compatibilidad inicial, debe quedar limitado al QR visual y nunca aparecer como texto visible o JSON.
- El QR no debe incluir PII de comprador/asistente.

## 6. QR visual / recurso QR

Formatos evaluados:

- PNG.
- SVG.
- data URL.
- endpoint que devuelve imagen.
- endpoint que devuelve payload para que frontend renderice QR.

Decision recomendada:

- Primer CODE: endpoint protegido que devuelve imagen PNG.
- No devolver data URL ni payload QR en JSON.
- Usar `QRCode.toBuffer` del paquete `qrcode`, ya disponible en API.
- Usar `Content-Type: image/png`.
- Usar headers anti-cache por defecto para el primer corte, salvo que se defina cache segura por entry.

Endpoint futuro principal:

- `GET /panel/events/:eventId/entries/:entryId/qr`

Proteccion:

- `eventPanelAuth`
- `requireEventRole(["owner", "staff"])`

Respuesta exitosa:

- `200 OK`
- body binario PNG.
- `Content-Type: image/png`
- no JSON con token.

Errores esperados:

- `400` para `entryId` invalido.
- `401` sin auth o token invalido.
- `403` sin membership del evento.
- `404` entry inexistente o no perteneciente al evento.
- `500` error inesperado generando QR.

Uso:

- mostrar QR en panel;
- descargar imagen PNG;
- copiar imagen si el navegador/UI lo permite;
- adjuntar/embeber en email.

## 7. Email automatico

Decision de producto:

- El canal principal debe ser email automatico al asistente.
- El email debe enviarse por entry, porque cada entry tiene QR propio.
- Si una Mesa VIP genera 10 entries, se deben poder enviar 10 QRs individuales.

Momento recomendado:

- Slice 3D.2 crea solo QR visual/recurso QR.
- Slice 3D.3 decide e implementa email.
- Para el primer envio automatico, puede dispararse despues de `manual-issue`, pero fuera de la transaccion/RPC.

Reglas de fallo:

- Si falla el email, no revertir la entry.
- Si falla el email, no borrar order/item/entry.
- Mantener QR disponible en panel para envio manual por WhatsApp.
- Registrar fallo de forma controlada solo cuando exista activity/event tracking de Eventos.
- `event_order_entries.email_sent_at` se actualiza solo si el envio fue correcto.
- Si no hay envio todavia o falla el envio, `email_sent_at` queda `null`.

Contenido minimo del email:

- nombre del evento;
- fecha/hora;
- lugar;
- tipo de entrada;
- nombre del asistente;
- QR visual;
- instruccion simple para presentar el QR en puerta.

No incluir:

- `checkin_token` como texto;
- PII innecesaria;
- metadata cruda;
- datos de otros asistentes.

Reutilizacion:

- Reutilizar `sendEmail`, Resend y adjuntos inline de `services/emails.ts`.
- Crear template especifico de Eventos; no usar `sendOrderConfirmationEmail` local tal cual porque actualmente incluye token texto como fallback.

## 8. WhatsApp manual como respaldo operativo

Decision:

- Staff puede ver/descargar/copiar el QR desde el panel.
- Staff puede enviar manualmente el PNG por WhatsApp al cliente si el email falla o el cliente lo solicita.
- WhatsApp no reemplaza email automatico.
- No integrar WhatsApp API en este slice.
- No guardar conversacion de WhatsApp.
- No marcar canal WhatsApp como entrega oficial todavia.

Contrato operativo:

- El panel debe mostrar un QR visual por entry.
- La accion de descarga/copia debe operar sobre imagen, no sobre `checkin_token` crudo.
- Si se registra activity futura, registrar accion operacional sin token ni PII sensible.

## 9. Seguridad / no exposicion

Reglas obligatorias:

- No exponer `checkin_token` en JSON.
- No exponer `checkin_token` en exports.
- No exponer `checkin_token` en activity metadata.
- No loggear payloads con token.
- No devolver QR de entries de otro evento.
- Todo endpoint de panel usa `eventPanelAuth`.
- Owner/staff de local no acceden a eventos sin membership.
- QR publico no debe revelar PII.
- No incluir buyer/attendee PII dentro del QR.
- El QR debe estar scopeado a una `event_order_entry`.
- El endpoint de QR debe filtrar por `event_id = req.eventPanelUser.eventId`.
- Joins deben alinear `event_id`, `event_order_id`, `event_order_item_id` y `event_ticket_type_id` cuando corresponda.

Logging:

- Loggear `entryId`, `eventId`, request id y error controlado.
- No loggear token, attendee email, phone, document ni buyer PII.

## 10. Relacion con check-in futuro

Este slice no implementa check-in.

El QR debe ser compatible con un futuro endpoint de check-in de Eventos.

El futuro check-in debe validar:

- token/valor opaco valido;
- `event_id` correcto;
- ventana de validacion del evento;
- `event_order_entries.status = issued`;
- `event_order_entries.checkin_status = unused`;
- bloqueo de duplicados;
- actor autorizado del evento;
- respuesta segura para puerta.

El futuro scanner puede reutilizar el patron de `@zxing/browser`, pero debe llamar endpoint de Eventos, no endpoint local `/panel/checkin/:token`.

## 11. Relacion con activity futuro

Eventos futuros posibles:

- `event_entry_qr_generated`
- `event_entry_email_sent`
- `event_entry_email_failed`
- `event_entry_qr_viewed_from_panel`
- `event_entry_qr_downloaded`

No implementar activity en este bloque.

Si se implementa despues:

- metadata sin token;
- metadata sin PII;
- actor seguro desde `eventPanelAuth`;
- entity type futuro separado para Eventos, no mezclar con `local_id`.

## 12. Reutilizacion definida

Reutilizar:

- `qrcode` server-side con `QRCode.toBuffer`.
- `sendEmail` y cliente `Resend`.
- patron de adjunto PNG inline CID.
- patron best-effort de email: falla email no revierte datos.
- `email_sent_at` como marca de envio exitoso.
- sanitizacion de metadata de `operationalActivity`, ampliada o replicada para Eventos si se implementa activity.
- scanner QR con `@zxing/browser` como referencia futura.

No reutilizar tal cual:

- `sendOrderConfirmationEmail`, porque incluye `checkinToken` visible como texto.
- response de `POST /orders`, porque devuelve `checkin_token`.
- panel local de ordenes que muestra/copia `checkin_token`.
- endpoint local `/panel/checkin/:token`, porque esta acoplado a `orders.local_id`.
- flujos B2C de free pass que muestran token crudo.

## 13. Roadmap por slices

### Slice 3D.1 - Contrato QR delivery

Este documento ASK / DOCS.

### Slice 3D.2 - QR visual / recurso QR para entry

Alcance:

- endpoint `GET /panel/events/:eventId/entries/:entryId/qr`;
- protegido con `eventPanelAuth + requireEventRole(["owner", "staff"])`;
- devuelve PNG;
- genera QR server-side;
- no devuelve `checkin_token` en JSON;
- no email todavia;
- no check-in todavia;
- no frontend todavia.

### Slice 3D.3 - Email QR

Alcance a decidir antes del CODE:

- email automatico post `manual-issue`; o
- endpoint controlado de envio/reenvio por entry.

Reglas:

- actualizar `email_sent_at` solo si Resend confirma envio;
- fallo de email no revierte la entry;
- email contiene evento, fecha, lugar, ticket, asistente y QR;
- no incluir token texto.

### Slice 3D.4 - Soporte operativo WhatsApp

Alcance:

- descargar/copiar QR desde panel/backend;
- WhatsApp manual como respaldo;
- sin WhatsApp API;
- sin tracking avanzado de entrega.

### Slice 3E - Check-in scanner/manual de Eventos

Alcance futuro:

- scanner QR de Eventos;
- validacion de entry;
- ventana de check-in;
- bloqueo de duplicados;
- fallback manual si se aprueba.

## 14. No-goals

Fuera de este documento y del primer CODE posterior:

- check-in;
- validacion manual;
- export;
- activity log;
- frontend/panel UI completo;
- B2C publico;
- pagos online;
- `/payments/callback`;
- WhatsApp API;
- import CSV;
- anulacion/void;
- edicion/correccion de entradas;
- multiples envios complejos;
- tracking avanzado de entregas.

## 15. QA futuro

QR visual:

- owner Ibiza obtiene QR de entry propia.
- staff Ibiza obtiene QR de entry propia.
- owner local sin membership recibe `403`.
- entry de otro evento queda bloqueada.
- entry inexistente devuelve `404`.
- respuesta no incluye `checkin_token` en JSON.
- respuesta es `image/png`.
- QR se puede descargar/mostrar.
- QR no incluye PII visible.
- QR escaneado produce valor compatible con check-in futuro.

Email:

- emision manual genera email por entry si se decide automatico.
- `email_sent_at` se actualiza solo si envio correcto.
- fallo de email no revierte entry.
- reenvio controlado si se implementa.
- email contiene evento, fecha, lugar, tipo de entrada, asistente y QR.
- email no contiene `checkin_token` como texto.
- no rompe `manual-issue`.

WhatsApp:

- staff puede obtener QR visual para enviarlo manualmente.
- no se integra WhatsApp API.
- no se expone token crudo.
- descarga/copia trabaja sobre imagen/recurso, no string token.

Regresiones:

- `/summary` sigue funcionando.
- `/ticket-types` sigue funcionando.
- `/entries` sigue funcionando.
- `manual-issue` sigue funcionando.
- panel local no se rompe.

## 16. Proximo paso recomendado

Slice 3D.2 - QR visual / recurso QR para entry:

- implementar `GET /panel/events/:eventId/entries/:entryId/qr`;
- generar PNG server-side;
- proteger con `eventPanelAuth + requireEventRole(["owner", "staff"])`;
- validar tenant por `event_id`;
- no devolver JSON con token;
- no tocar email, WhatsApp API, check-in, export, activity, frontend ni pagos.
