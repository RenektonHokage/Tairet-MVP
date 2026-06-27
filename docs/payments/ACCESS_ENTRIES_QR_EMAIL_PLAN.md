# Access Entries + QR + Email Plan

## 1. Contexto cerrado

Bancard Access Core ya tiene estos hitos cerrados:

- Init Bancard Single Buy: PASS.
- Backend confirm callback Bancard: PASS.
- RPC `public.confirm_bancard_access_payment(...)`: PASS.
- Approved flow staging: PASS.
- Callback duplicado/idempotencia: PASS.
- Sanitizacion callback: PASS.
- Endpoint publico de estado: PASS.
- Pantalla B2C de estado: PASS.
- Fix tecnico del 404 post-pago: PASS.
- Slice 9A emision idempotente de `access_entries`: PASS.
- Slice 9B QR/token interno `accessQr.ts`: PASS.
- Slice 9C email post-pago: PASS tecnico.
- Slice 9E.1 check-in read-only panel local: PASS funcional post-deploy.
- Slice 9E.2 check-in mark used transaccional local: PASS funcional post-deploy.
- Slice 9E.3 panel UI `Entradas pagas`: PASS funcional post-deploy.

Antes de Slice 9A, el bloque empezaba desde una orden aprobada por Bancard y cerrada por Access Core:

- `payment_attempts.status = 'approved'`;
- `access_orders.status = 'paid'`;
- `access_stock_reservations.status = 'consumed'`;
- `access_entries_count = 0`.

Despues de Slice 9A, un pago aprobado emite `access_entries` automaticamente y de forma idempotente. Slice 9B agrego helper interno de QR/token, Slice 9C agrego email post-pago, Slice 9E.1 agrego validacion read-only panel por token, Slice 9E.2 agrego marcado transaccional de uso y Slice 9E.3 agrego UI panel `Entradas pagas` dentro de `/panel/checkin`. B2C route publica del QR, status extendido, reenvio administrativo, rejected end-to-end, query/reconciliacion y panel/manual review siguen pendientes.

## 2. Objetivo del bloque

El objetivo completo del bloque es:

- emitir `access_entries` para ordenes pagadas;
- generar tokens/QR para cada entry;
- enviar email post-pago al comprador;
- preparar la base para check-in futuro.

No se debe implementar todo junto. Este bloque debe dividirse en slices pequenos para validar primero la fuente de verdad de entradas, despues QR, despues email, despues exposicion segura en status page y finalmente check-in.

## 3. Principios de diseno

- El frontend no emite entradas.
- El frontend no confirma pagos.
- El callback server-to-server de Bancard sigue siendo la fuente de verdad para pagos aprobados.
- La emision de entries debe ser idempotente.
- Un retry de callback o backend no debe duplicar entries.
- El email no debe revertir pagos ni entries emitidas.
- El QR debe usar un token opaco.
- No exponer IDs internos como `order_id`, `order_item_id`, `entry_id` o `payment_attempt_id`.
- No exponer buyer data innecesaria.
- No loguear tokens completos.
- No guardar ni propagar datos de tarjeta, token Bancard ni private key.
- No mezclar Access Core con tablas legacy/event salvo analisis explicito.
- La fuente de verdad de acceso validable debe ser `access_entries`, no email ni frontend.

## 4. Estado actual del esquema

### Tablas involucradas

Tablas Access Core ya existentes:

- `access_orders`;
- `access_order_items`;
- `access_entries`;
- `access_stock_reservations`;
- `payment_attempts`.

### `access_orders`

Columnas relevantes confirmadas:

- `id`;
- `public_ref`;
- `source_type`;
- `local_id`;
- `event_id`;
- `access_date`;
- `buyer_name`;
- `buyer_last_name`;
- `buyer_email`;
- `buyer_phone`;
- `buyer_document`;
- `amount_gs`;
- `currency`;
- `payment_required`;
- `status`;
- `expires_at`;
- `paid_at`;
- `cancelled_at`;
- `expired_at`;
- `manual_review_reason`;
- `created_at`;
- `updated_at`.

Constraints y defaults relevantes:

- `id uuid primary key default gen_random_uuid()`;
- `public_ref` no adivinable con prefijo `acc_` y unique;
- `currency = 'PYG'`;
- `status in ('pending_payment', 'paid', 'cancelled', 'expired', 'manual_review')`;
- consistencia `source_type` con `local_id` o `event_id`;
- buyer fields no vacios.

### `access_order_items`

Columnas relevantes confirmadas:

- `id`;
- `order_id`;
- `access_ticket_type_id`;
- `name_snapshot`;
- `payment_kind`;
- `unit_price_gs`;
- `currency`;
- `quantity`;
- `entries_per_unit`;
- `subtotal_gs`;
- `created_at`.

Constraints relevantes:

- unique `(order_id, access_ticket_type_id)`;
- unique de alineacion `(id, order_id, access_ticket_type_id)`;
- `quantity > 0`;
- `entries_per_unit > 0`;
- `subtotal_gs = unit_price_gs * quantity`;
- `currency = 'PYG'`.

Regla ya cerrada: `entries_per_unit` no multiplica stock. Solo afecta la emision posterior de `access_entries`.

### `access_entries`

Columnas relevantes confirmadas:

- `id`;
- `order_id`;
- `order_item_id`;
- `access_ticket_type_id`;
- `unit_index`;
- `checkin_token uuid not null default gen_random_uuid()`;
- `attendee_name`;
- `attendee_last_name`;
- `attendee_email`;
- `attendee_phone`;
- `attendee_document`;
- `status`;
- `checkin_status`;
- `access_date`;
- `used_at`;
- `used_by`;
- `voided_at`;
- `void_reason`;
- `email_status`;
- `email_sent_at`;
- `created_at`;
- `updated_at`.

Constraints relevantes:

- foreign key de alineacion con `access_order_items`;
- foreign key de alineacion de `order_id` y `access_date` con `access_orders`;
- unique `checkin_token`;
- unique `(order_item_id, unit_index)`;
- `unit_index > 0`;
- attendee fields no vacios;
- `status in ('issued', 'voided')`;
- `checkin_status in ('unused', 'used')`;
- `email_status in ('not_sent', 'sent', 'failed')`;
- `email_status = 'sent'` requiere `email_sent_at`.

Defaults relevantes:

- `checkin_token` se genera en DB con `gen_random_uuid()`;
- `status = 'issued'`;
- `checkin_status = 'unused'`;
- `email_status = 'not_sent'`;
- `created_at = now()`;
- `updated_at = now()`.

### Servicios existentes

Servicios reutilizables como referencia:

- `functions/api/src/services/emails.ts` expone `sendEmail()` con Resend y soporte de attachments.
- `functions/api/src/services/eventEmails.ts` implementa emails con QR para `event_order_entries`.
- `functions/api/src/services/eventQr.ts` genera QR para entries de eventos.
- `functions/api/src/services/emails.ts` tambien contiene un email legacy de orden con QR unico.

Estos servicios son referencia tecnica, pero no deben usarse como implementacion directa de Access Core sin adaptar nombres, tablas, payloads y seguridad.

Pendiente para slices futuros:

- endpoint o RPC de check-in especifico para `access_entries`;
- contrato publico seguro para ver o recuperar entradas;
- estrategia de reenvio administrativo.

## 5. Slices propuestos

### Slice 9A - Emision idempotente de `access_entries` sin email ni QR publico - PASS

Objetivo:

- crear `access_entries` para ordenes `paid`;
- emitir exactamente `quantity * entries_per_unit` entries por item;
- garantizar idempotencia por `(order_item_id, unit_index)`;
- completar faltantes si hubo emision parcial;
- integrar la emision despues de un confirm approved.

Fuera de alcance:

- email;
- QR visible;
- status page extendida;
- check-in;
- panel;
- reenvio;
- tablas legacy/event.

Validaciones:

- primera ejecucion crea entries;
- segunda ejecucion no duplica;
- callback duplicado no duplica;
- `count(entries) = sum(quantity * entries_per_unit)`;
- orden sigue `paid`;
- payment attempt sigue `approved`;
- stock sigue `consumed`.

Implementacion PASS:

- migracion `infra/sql/migrations/040_access_core_slice_9_issue_entries.sql`;
- RPC `public.issue_access_entries_for_paid_order(p_order_id uuid, p_payment_attempt_id uuid)`;
- backend integrado en `functions/api/src/services/bancardConfirm.ts`;
- despues de Confirm RPC `approved`, backend llama la RPC de emision;
- la Confirm RPC existente no fue modificada.

Evidencia staging:

- `shop_process_id = 260623000000004`;
- `public_ref = acc_b95579d85d962fca3bdc5f7f3ec92f0c`;
- primer callback aprobado post-deploy: `entriesInserted = 1`, `entriesTotal = 1`, `entriesIdempotent = false`;
- replay duplicado: `entriesInserted = 0`, `entriesTotal = 1`, `entriesIdempotent = true`;
- SQL final: order `paid`, payment attempt `approved`, stock `consumed`, `access_entries_count = 1`;
- duplicados por `order_item_id + unit_index`: `0 rows`.

Seguridad validada:

- la RPC no retorna `checkin_token`;
- backend no loguea tokens completos;
- backend no loguea buyer data;
- backend no loguea payload Bancard completo;
- no se envio email;
- no se expuso QR publico;
- no se implemento check-in.

### Slice 9B - QR/token interno para entries - PASS

Objetivo:

- definir payload QR;
- usar `access_entries.checkin_token` como token opaco;
- crear helper Access Core de QR;
- no exponer IDs internos.

Implementacion PASS:

- servicio `functions/api/src/services/accessQr.ts`;
- payload QR interno: `${B2C_BASE_URL}/#/access/checkin/<checkin_token>`;
- fallback conservador de base URL: `https://tairet.com.py`;
- QR PNG generado con `qrcode`;
- no consulta DB;
- no loguea `checkin_token`;
- no expone QR por endpoint publico;
- no modifica status page;
- no implementa check-in.

Fuera de alcance:

- check-in completo;
- panel;
- email post-pago, cubierto despues por Slice 9C;
- publicacion de QR en status page sin contrato seguro.

### Slice 9C - Email post-pago - PASS tecnico

Objetivo:

- enviar email al buyer con entradas emitidas;
- manejar multiples entries en un mismo email;
- marcar `email_status` y `email_sent_at`;
- asegurar que una falla de email no rompe pago ni entries.

Implementacion PASS:

- servicio `functions/api/src/services/accessEmails.ts`;
- integracion en `functions/api/src/services/bancardConfirm.ts`;
- logging seguro ajustado en `functions/api/src/services/emails.ts`;
- usa `sendEmail()` y `generateAccessEntryQrPng()`;
- no usa `eventQr.ts`;
- no usa `eventEmails.ts`;
- no usa `payment_events`;
- no toca SQL/migraciones;
- no toca frontend/status page;
- no implementa check-in;
- no crea endpoint publico de QR.

Flujo validado:

- Confirm RPC devuelve `approved`;
- `issue_access_entries_for_paid_order(...)` devuelve `ok: true` y `status = 'issued'`;
- backend intenta email post-pago;
- claim idempotente `access_entries.email_status: not_sent -> failed`;
- si email sale bien, `failed -> sent` y `email_sent_at` queda no nulo;
- si email falla, queda `failed`;
- la falla de email no revierte pago, stock ni entries;
- la falla de email no rompe callback Bancard.

Idempotencia validada:

- callback duplicado despues de `sent` no reenvia;
- devuelve `skipped_already_sent`;
- `entriesClaimed = 0`;
- `entriesSent = 0`;
- `email_status` permanece `sent`;
- `email_sent_at` permanece no nulo.

Evidencia staging principal:

- `public_ref = acc_b95579d85d962fca3bdc5f7f3ec92f0c`;
- `shop_process_id = 260623000000004`;
- replay controlado post-deploy respondio HTTP 200 `{ "status": "success" }`;
- logs seguros de Resend: `provider = resend`, `recipientCount = 1`, `hasSubject = true`, `subjectLength = 32`, `attachmentCount = 1`, `emailEnabled = true`;
- logs Access Core: `emailStatus = sent`, `entriesClaimed = 1`, `entriesSent = 1`;
- SQL: `email_status = 'sent'`, `count = 1`, `with_sent_at = 1`;
- integridad: order `paid`, payment attempt `approved`, `provider_response_code = '00'`, stock `consumed`, `access_entries_count = 1`.

Evidencia callback duplicado despues de `sent`:

- HTTP 200 `{ "status": "success" }`;
- `entriesInserted = 0`;
- `entriesTotal = 1`;
- `entriesIdempotent = true`;
- `rpcStatus = approved`;
- `idempotent = true`;
- `manualReview = false`;
- `emailStatus = skipped_already_sent`;
- `entriesClaimed = 0`;
- `entriesSent = 0`;
- SQL final: `email_status = 'sent'`, `count = 1`, `with_sent_at = 1`.

Logging seguro:

- `sendEmail()` no loguea destinatario completo;
- `sendEmail()` no loguea subject completo;
- logs usan `recipientCount`, `hasSubject`, `subjectLength`, `attachmentCount`, `emailEnabled`, `provider` y `errorCode`;
- no se loguea `checkin_token`;
- no se loguea buyer email completo;
- no se loguea buyer document;
- no se loguea payload Bancard completo;
- no se loguea token Bancard;
- no se loguea private key;
- no se loguean datos de tarjeta ni CVV.

Aclaracion:

- Slice 9C valida envio tecnico por backend/Resend y estado DB `sent`;
- la recepcion final en inbox del comprador queda como verificacion manual opcional si se quiere evidencia visible;
- el QR del email usa la URL futura `/#/access/checkin/<checkin_token>`;
- la validacion read-only panel por token ya existe en Slice 9E.1;
- marcar uso transaccional por panel local ya existe en Slice 9E.2.

Fuera de alcance:

- reenvio avanzado;
- panel de soporte;
- refunds;
- facturacion;
- cambios de estado de pago.

### Slice 9D - Status page extendida

Objetivo:

- mostrar estado adicional seguro de entrega;
- opcionalmente mostrar mensaje de envio de entradas;
- permitir que el comprador entienda si el pago esta confirmado aunque email tarde o falle.

Regla de seguridad:

- no exponer QR solo con `public_ref` hasta tener un contrato seguro de recuperacion.

### Slice 9E - Check-in Access Core

Objetivo:

- validar `checkin_token`;
- marcar uso;
- evitar doble uso;
- aplicar permisos de operador/panel;
- separar check-in Access Core de check-in legacy/event.

Fuera de alcance inicial:

- rollback de entradas usadas;
- panel manual review completo;
- reglas avanzadas de cierre de fecha.

#### Slice 9E.1 - Validacion read-only panel local - PASS funcional post-deploy

Objetivo:

- validar `access_entries` por `checkin_token`;
- permitir que staff/owner vea estado seguro de una entrada;
- confirmar tenant local antes de devolver datos;
- no marcar uso automaticamente.

Implementacion PASS:

- endpoint `GET /panel/access/checkin/:token`;
- montaje `/panel/access/checkin/:token`;
- auth `panelAuth` + `requireRole(["owner", "staff"])`;
- scope read-only;
- scope local-only;
- scope panel-only;
- archivos `functions/api/src/schemas/accessCheckin.ts`, `functions/api/src/services/accessCheckin.ts`, `functions/api/src/routes/panelAccess.ts` y `functions/api/src/routes/panel.ts`.

Contrato:

- token UUID invalido devuelve HTTP 400 con `code = 'invalid_checkin_token'`;
- token valido carga `access_entries`, `access_orders` y `access_order_items`;
- `source_type = 'local'` es requerido en este slice;
- `access_orders.local_id` debe coincidir con `req.panelUser.localId`;
- token inexistente, tenant mismatch y source no local devuelven respuesta segura;
- no bloquea por `access_date`, solo agrega `date_warning`.

Estados de negocio:

- `valid`: order `paid`, entry `issued`, check-in `unused`;
- `already_used`: entry `issued`, check-in `used`;
- `voided`: entry `voided`;
- `not_paid`: order no `paid`;
- `not_valid_status`: combinacion no soportada.

Respuesta segura:

- puede devolver `status`, `entry.status`, `entry.checkin_status`, `entry.access_date`, `entry.unit_index`, `entry.ticket_name`, `attendee.name`, `attendee.last_name`, `order.public_ref` y `warnings`;
- no devuelve `checkin_token` completo;
- no devuelve `entry_id`, `order_id`, `order_item_id` ni `payment_attempt_id`;
- no devuelve buyer email, buyer phone ni buyer document;
- no devuelve payload Bancard, datos de tarjeta, CVV, private key ni secretos.

Validacion post-deploy:

- `GET /panel/access/checkin/not-a-uuid` con auth valido devolvio HTTP 400 `{ "error": "Invalid check-in token", "code": "invalid_checkin_token" }`;
- token valido `issued/unused` devolvio HTTP 200 con `status = 'valid'`, `entry.status = 'issued'`, `entry.checkin_status = 'unused'`, `entry.access_date = '2026-08-01'`, `entry.unit_index = 1`, `entry.ticket_name = 'Entrada Staging Bancard'`, `order.public_ref = 'acc_b95579d85d962fca3bdc5f7f3ec92f0c'` y `warnings = ['date_warning']`;
- SQL posterior al GET confirmo `status = 'issued'`, `checkin_status = 'unused'`, `used_at = null` y `used_by = null`;
- logs runtime usaron `path = '/panel/access/checkin/:token'` y `tokenHash`;
- no aparecio el token completo en path ni logs.

Fuera de alcance de 9E.1:

- marcar `checkin_status = 'used'`;
- setear `used_at` o `used_by`;
- UI panel para escaneo;
- B2C route publica del QR;
- soporte `source_type = 'event'`.

#### Slice 9E.2 - Mark used transaccional panel local - PASS funcional post-deploy

Objetivo:

- marcar una `access_entry` como usada por `checkin_token`;
- exigir staff/owner autenticado del panel;
- validar tenant local antes de mutar;
- impedir doble uso;
- mantener la operacion atomica en DB.

Implementacion PASS:

- migracion `infra/sql/migrations/041_access_core_slice_9e_checkin.sql`;
- RPC `public.check_in_access_entry_by_token(uuid, uuid, uuid)`;
- endpoint `POST /panel/access/checkin/:token/use`;
- auth `panelAuth` + `requireRole(["owner", "staff"])`;
- scope panel-only;
- scope local-only;
- mutacion transaccional en DB;
- archivos backend `functions/api/src/services/accessCheckin.ts` y `functions/api/src/routes/panelAccess.ts`.

RPC y seguridad:

- `security definer`;
- `search_path = public, pg_temp`;
- execute solo para `service_role`;
- sin execute para `public`, `anon` ni `authenticated`;
- valida actor panel en DB contra `panel_users.auth_user_id`, `panel_users.local_id` y role `owner` o `staff`;
- `used_by` guarda el Supabase Auth user id del usuario panel;
- token inexistente, tenant mismatch y `source_type <> 'local'` devuelven `entry_not_found` seguro;
- no expone existencia cross-tenant.

Operacion transaccional:

- usa `FOR UPDATE` sobre `access_entries`;
- actualiza solo si `status = 'issued'`, `checkin_status = 'unused'`, `used_at is null` y `used_by is null`;
- setea `checkin_status = 'used'`, `used_at = now()` y `used_by = p_actor_auth_user_id`;
- entry `unused` con `used_at` o `used_by` ya seteados devuelve `not_valid_status` y no muta;
- segundo uso devuelve `already_used`;
- no pisa `used_at` ni `used_by` en reintentos.

Estados de negocio:

- `used`: uso aplicado correctamente;
- `already_used`: entry ya estaba usada;
- `voided`: entry anulada;
- `not_paid`: order no `paid`;
- `not_valid_status`: combinacion no soportada o inconsistente;
- `entry_not_found`: token inexistente, tenant mismatch o source no local;
- `forbidden`: actor panel invalido o sin permiso;
- `invalid_request`: parametros invalidos.

Respuesta segura:

- puede devolver `status`, `entry.status`, `entry.checkin_status`, `entry.used_at`, `entry.access_date`, `entry.unit_index`, `entry.ticket_name`, `attendee.name`, `attendee.last_name`, `order.public_ref` y `warnings`;
- no devuelve `checkin_token` completo;
- no devuelve `entry_id`, `order_id`, `order_item_id` ni `payment_attempt_id`;
- no devuelve buyer email, buyer phone ni buyer document;
- no devuelve payload Bancard, datos de tarjeta, CVV, private key ni secretos.

Validacion post-deploy:

- health API devolvio HTTP 200 `{ "ok": true }`;
- SQL pre-check confirmo order `paid`, source `local`, entry `issued/unused`, `used_at = null`, `used_by = null`, `access_date = '2026-08-01'` y ticket `Entrada Staging Bancard`;
- primer POST devolvio HTTP 200 con `status = 'used'`, `entry.status = 'issued'`, `entry.checkin_status = 'used'`, `used_at` no nulo, `order.public_ref = 'acc_b95579d85d962fca3bdc5f7f3ec92f0c'` y `warnings = ['date_warning']`;
- SQL posterior al primer POST confirmo `checkin_status = 'used'`, `used_at` no nulo y `used_by` no nulo;
- segundo POST del mismo token devolvio HTTP 200 con `status = 'already_used'`;
- SQL posterior al segundo POST confirmo que `used_at` y `used_by` no cambiaron;
- GET read-only posterior devolvio HTTP 200 con `status = 'already_used'`.

Aclaracion:

- se valido flujo principal `unused -> used`;
- se valido idempotencia secuencial con segundo POST;
- no se ejecuto prueba manual de dos POST estrictamente simultaneos;
- la RPC fue revisada con `FOR UPDATE`, update condicional y fallback para resolver concurrencia en DB.

Logging seguro:

- runtime usa path sanitizado `/panel/access/checkin/:token/use`;
- logs usan `tokenHash`, `publicRef`, `sourceType`, `localId`, `status`, `checkinStatus`, `panelUserId`, `role`, `errorCode` y `usedAt`;
- no se loguea `checkin_token` completo;
- no se loguean IDs internos, buyer email, buyer phone, buyer document, payload Bancard, datos de tarjeta, CVV, private key ni secretos.

Fuera de alcance de 9E.2:

- UI panel para entradas pagas;
- B2C route publica/minima del QR;
- soporte `source_type = 'event'`;
- status page extendida;
- reenvio administrativo;
- legacy/event check-in.

#### Slice 9E.3 - Panel UI para check-in de entradas pagas - PASS funcional post-deploy

Objetivo:

- integrar validacion de entradas pagas/Bancard dentro del panel existente `/panel/checkin`;
- mantener disponible el flujo anterior de check-in/free pass;
- no crear una pantalla aislada;
- no tocar backend ni SQL.

Archivos funcionales:

- `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`;
- `apps/web-next/components/panel/AccessPaidCheckinSection.tsx`;
- `apps/web-next/lib/accessCheckin.ts`.

Funcionalidad implementada:

- modo visible `Entradas pagas` dentro de `/panel/checkin`;
- modo legacy/free pass queda como default;
- parser local para UUID puro, URL completa del QR, hash/path `/#/access/checkin/<token>` y path `/access/checkin/<token>`;
- input invalido muestra `Código no válido` sin request backend;
- `Buscar entrada` llama `GET /panel/access/checkin/:token`;
- `Validar entrada` llama `POST /panel/access/checkin/:token/use`;
- el POST solo ocurre con click explicito;
- no hay POST automatico al pegar, buscar o renderizar;
- no se agrego camara/scanner para entradas pagas;
- al cambiar a `Entradas pagas`, se detiene la camara legacy;
- logs legacy que exponian token completo fueron sanitizados.

Estados cubiertos:

- `valid`;
- `used`;
- `already_used`;
- `voided`;
- `not_paid`;
- `not_valid_status`;
- 404 generico como entrada no encontrada/no perteneciente al local;
- `date_warning` como advertencia no bloqueante.

Seguridad y privacidad:

- no muestra el `checkin_token` completo;
- no guarda token en `localStorage` ni `sessionStorage`;
- no coloca token en query params;
- no manda token a analytics;
- no muestra IDs internos;
- no muestra buyer email, buyer phone, buyer document, payload Bancard, datos de tarjeta, CVV, private key ni secretos;
- no toca backend, SQL, email, QR helper, Bancard ni B2C.

QA:

- typecheck: PASS;
- `git diff --check`: PASS;
- input invalido: PASS, sin request backend;
- token usado: PASS, devuelve `already_used`;
- URL completa/hash/path: PASS, parser extrae token;
- legacy check-in: PASS, sigue disponible;
- entrada nueva `unused`: PASS;
- GET inicial: PASS, devuelve entrada valida;
- boton `Validar entrada`: PASS, aparece habilitado para `valid`;
- POST `/panel/access/checkin/:token/use`: PASS desde UI con status 200;
- UI posterior al POST: PASS, muestra `Entrada validada correctamente` y estado `used`;
- reconsulta del mismo token: PASS, devuelve `already_used`;
- no se observo POST indebido para `already_used`;
- QA post-deploy: PASS.

Fuera de alcance de 9E.3:

- scanner/camara para entradas pagas;
- modo puerta rapido;
- listado nuevo de entradas;
- "Mis entradas";
- cuentas B2C;
- reenvio de email;
- soporte `source_type = 'event'`;
- cambios backend;
- cambios SQL/migraciones;
- cambios Bancard;
- cambios B2C.

## 6. Recomendacion de orden

Slice 9A, Slice 9B, Slice 9C, Slice 9E.1, Slice 9E.2 y Slice 9E.3 ya fueron implementados y validados como PASS en su alcance.

Motivos por los que se implemento primero:

- reduce riesgo;
- desbloquea la fuente de verdad `access_entries`;
- prueba idempotencia antes de QR/email;
- no mezcla transporte email ni frontend;
- permitio validar contra una orden staging pagada;
- mantiene separada la Confirm RPC existente.

Siguiente recomendacion: no avanzar directamente a B2C route o reenvio sin plan. Los siguientes bloques deben decidirse conscientemente entre Slice 9E.4 B2C route publica del QR, Slice 9D status page extendida y reenvio administrativo.

## 7. Diseno aplicado Slice 9A

### RPC sugerida

Se creo una RPC nueva, separada de la Confirm RPC existente:

- `public.issue_access_entries_for_paid_order(...)`.

No se modifico `public.confirm_bancard_access_payment(...)`.

### Parametros sugeridos

Parametros candidatos:

- `p_order_id uuid`;
- `p_payment_attempt_id uuid`;
- `p_actor text default 'bancard_confirm'` o equivalente interno si se decide registrar contexto.

El objetivo es que backend pueda llamar la RPC despues de recibir `order_id` y `payment_attempt_id` desde la Confirm RPC.

### Validaciones

La RPC debe validar:

- la orden existe;
- `access_orders.status = 'paid'`;
- el payment attempt existe;
- `payment_attempts.order_id = access_orders.id`;
- `payment_attempts.status = 'approved'`;
- `payment_attempts.provider = 'bancard'`;
- `payment_attempts.provider_operation = 'single_buy'`;
- existen items para la orden;
- las reservas de la orden estan `consumed`;
- no hay mismatch entre items y reservations;
- no emitir para `manual_review`, `cancelled`, `expired` o intentos no aprobados.

### Insercion idempotente

Para cada `access_order_items`:

- calcular `expected_entries = quantity * entries_per_unit`;
- generar `unit_index` de `1` a `expected_entries`;
- insertar rows faltantes en `access_entries`;
- copiar buyer fields de `access_orders` a attendee fields iniciales;
- usar `access_date` de `access_orders`;
- usar `access_ticket_type_id` y `order_item_id` del item;
- dejar defaults DB para `checkin_token`, `status`, `checkin_status`, `email_status`.

La idempotencia debe apoyarse en:

- unique `(order_item_id, unit_index)`;
- `ON CONFLICT DO NOTHING` o logica equivalente;
- conteo final contra expected total.

### Retorno esperado

Retorno JSON sugerido:

- `ok`;
- `status`;
- `order_id`;
- `public_ref`;
- `expected_entries`;
- `existing_entries`;
- `inserted_entries`;
- `total_entries`;
- `idempotent`;
- `error` si aplica.

No devolver:

- `checkin_token`;
- IDs internos innecesarios al cliente;
- buyer data completa.

### Integracion backend

En backend, despues de `confirm_bancard_access_payment(...)`:

- si RPC confirm devuelve `ok: true` y `status = 'approved'`, llamar `issue_access_entries_for_paid_order(...)`;
- si devuelve `rejected` o `manual_review`, no emitir entries;
- si la emision falla, no enviar email y responder de forma conservadora segun el diseno CODE del slice;
- callback duplicado aprobado debe volver a llamar emision y obtener resultado idempotente.

### Manejo de errores

Errores esperados:

- orden no encontrada;
- payment attempt no encontrado;
- orden no paid;
- attempt no approved;
- stock no consumed;
- items faltantes;
- mismatch operativo;
- error interno.

Si hay emision parcial previa, la RPC debe completar faltantes o devolver error controlado si la consistencia no se puede reconstruir.

### Logs permitidos

Permitido loguear:

- `public_ref`;
- conteos;
- status RPC;
- error code;
- `payment_attempt_id` solo en logs internos si ya se usa como correlacion.

No loguear:

- `checkin_token` completo;
- buyer document;
- payload Bancard completo;
- token Bancard;
- private key;
- datos de tarjeta.

## 8. Validacion por slice

### Slice 9A

Pruebas SQL:

- orden `paid` con stock `consumed` emite entries;
- segunda ejecucion no duplica;
- emision parcial se completa;
- `count(access_entries) = sum(quantity * entries_per_unit)`;
- cada entry queda `issued`, `unused`, `not_sent`.

Pruebas backend:

- callback approved llama emision;
- callback duplicate approved no duplica;
- rejected/manual_review no emite.

Pruebas de seguridad:

- no se devuelven `checkin_token` ni IDs internos al callback response;
- logs sin tokens completos.

Comandos esperados:

- `git diff --check`;
- `pnpm -C functions/api typecheck`;
- SQL smoke tests en Supabase staging si aplica.

Evidencia:

- diff;
- salida de typecheck;
- queries con counts antes/despues;
- `git status --short`.

### Slice 9B

Pruebas:

- QR contiene solo token opaco o URL con token opaco;
- no contiene IDs internos;
- QR generado por cada entry;
- helper no depende de tablas event/legacy.

Evidencia:

- sample QR payload sanitizado;
- revision estatica de logs;
- typecheck.

### Slice 9C

Pruebas:

- email se envia con todas las entries de la orden;
- multiples entries generan bundle correcto;
- fallo de email marca `email_status = 'failed'`;
- pago y entries no se revierten;
- envio exitoso marca `email_status = 'sent'` y `email_sent_at`.

Evidencia:

- logs sin token completo;
- logs Resend seguros sin destinatario completo ni subject completo;
- queries de `email_status`;
- `email_status = 'sent'`;
- `email_sent_at` no nulo;
- callback duplicado despues de `sent` devuelve `skipped_already_sent` sin reenvio.

### Slice 9D

Pruebas:

- status page sigue mostrando pago confirmado;
- estado de entrega no expone QR indebidamente;
- `public_ref` no permite ver tokens completos;
- estados `not_sent`, `sent`, `failed` se comunican con copy seguro.

Evidencia:

- API response sanitizada;
- screenshot B2C;
- revision de no IDs internos.

### Slice 9E

Pruebas:

- token no UUID devuelve 400 sin revelar token completo;
- token valido `issued/unused` devuelve `valid`;
- GET read-only no muta `status`, `checkin_status`, `used_at` ni `used_by`;
- token usado devuelve `already_used`;
- POST use marca `checkin_status = 'used'`, setea `used_at` y preserva `used_by` en reintentos;
- token invalido/inexistente no revela datos;
- operador sin permiso no puede hacer check-in;
- entry voided no se puede usar.

Evidencia:

- SQL de entry antes/despues para confirmar read-only o uso, segun sub-slice;
- logs sin token completo;
- pruebas de permisos.

## 9. Riesgos

| Riesgo | Mitigacion |
| --- | --- |
| Orden `paid` sin entries si falla emision | Slice 9A con RPC idempotente y retry por backend/callback duplicado. |
| Emision parcial | RPC completa faltantes por `(order_item_id, unit_index)` y valida count final. |
| Callback retry | La emision debe ser idempotente y no depender de estado temporal del request. |
| Email enviado pero DB no actualizado | Email queda separado; registrar `email_status`, permitir reenvio futuro. |
| QR expuesto por link demasiado permisivo | No mostrar QR solo con `public_ref`; usar contrato seguro posterior. |
| Tokens en logs | Prohibir logs de `checkin_token` completo y revisar estaticamente. |
| Mezcla legacy/event con Access Core | Crear servicios/RPC Access Core propios; usar legacy/event solo como referencia. |
| Entries duplicadas por `entries_per_unit` mal calculado | Usar `quantity * entries_per_unit` desde snapshot de `access_order_items`. |
| Email failure bloquea pago | Email nunca revierte `paid`, `approved` ni `issued`. |
| Check-in antes de contrato de permisos | 9E.1 fue read-only y 9E.2 marca uso transaccional con auth staff/owner. |

## 10. Fuera de alcance

Fuera de alcance de este bloque maestro o de Slice 9A inicial:

- refunds;
- reconciliacion Bancard;
- panel manual review;
- check-in completo hasta Slice 9E;
- QR visible en status page hasta contrato seguro;
- emision free pass si no se decide incluirla explicitamente;
- rediseño de tablas;
- cambios a Confirm RPC existente salvo necesidad demostrada;
- cambios a `/payments/callback` legacy;
- `payment_events`;
- adapters legacy/event;
- facturacion.

## 11. Prompt recomendado para el proximo ASK

```text
ASK / PLAN MODE ONLY — Access Core Slice 9E.4 B2C route minima para QR

Contexto:
Slice 9A, Slice 9B, Slice 9C, Slice 9E.1, Slice 9E.2 y Slice 9E.3 ya quedaron PASS:
- payment_attempts.status = approved
- access_orders.status = paid
- access_stock_reservations.status = consumed
- access_entries emitidas de forma idempotente
- QR interno generado por helper Access Core
- email post-pago validado tecnicamente
- callback duplicado no duplica entries ni reenvia email si ya esta sent
- GET /panel/access/checkin/:token valida read-only por token con auth panel local
- el GET no muta checkin_status, used_at ni used_by
- POST /panel/access/checkin/:token/use marca uso transaccional con auth panel local
- segundo POST devuelve already_used y no cambia used_at ni used_by
- /panel/checkin ya tiene modo Entradas pagas para buscar y validar entradas pagas

Objetivo:
Disenar el siguiente bloque sin implementar todavia:
- B2C route minima para el destino del QR;
- copy que no prometa validacion automatica;
- sin exponer token completo en UI/logs;
- sin consultar backend publico salvo contrato explicito;
- mantener source_type event fuera o disenarlo explicitamente;
- reglas para no exponer IDs internos;
- reglas para no exponer ni loguear tokens completos;
- no tocar legacy/event tables.

Validacion:
- `git diff --check`;
- typecheck del paquete que se toque;
- no tokens completos en logs;
- no commit.
```
