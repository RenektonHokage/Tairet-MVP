# Ibiza Slice 1: modelo DB minimo y tenant model de eventos

## 1. Proposito

Este documento define la especificacion tecnica implementable del Slice 1 para el piloto Ibiza dentro de la vertical Eventos de Tairet.

El objetivo es bajar el plan de producto a un modelo minimo de base de datos, tenant model, constraints, indices, RLS/grants, contratos futuros y QA para pasar luego a CODE con una migracion DB minima sin dudas mayores.

Este documento es solo ASK / DOCS. No implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, panel UI, pagos ni cambios en `/payments/callback`.

## 2. Decisiones base

Decisiones que este slice mantiene:

- Ibiza es un evento independiente.
- Ibiza opera por `event_id`, no por `local_id`.
- No se crea un local falso llamado Ibiza.
- No se extiende `locals.type`.
- No se reutilizan `locals`, `orders`, `ticket_types` ni `panel_users` como modelo principal de Eventos.
- El pago externo por transferencia queda como `manual_transfer / confirmed_externally`.
- El checkout online futuro debe poder crear las mismas `event_order_entries`.
- Cada entrada/persona tiene QR propio.
- Check-in valida `event_order_entries`, no la orden completa.
- El panel de evento usa `event_panel_users`, no `panel_users` local-based.
- B2C publico de Ibiza queda fuera por ahora.
- `/payments/callback` queda fuera.

## 3. Fuentes revisadas

Documentos base revisados:

- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/panel/OPERATIONAL_ACTIVITY_LOG_PLAN.md`
- `docs/panel/ACTIVITY_ACTOR_LABEL_PLAN.md`
- `docs/panel/MANUAL_ENTRY_VALIDATION_FALLBACK.md`
- `docs/panel/PANEL_NEAR_REALTIME_AND_MULTI_DEVICE_SYNC_PLAN.md`
- `docs/security/SERVICE_ROLE_MINIMIZATION_PLAN.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/production/B7_FINAL_SMOKE_AND_GO_NO_GO.md`

Areas tecnicas revisadas:

- `functions/api/src/routes/panel.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/reservations.ts`
- `functions/api/src/routes/activity.ts`
- `functions/api/src/middlewares/panelAuth.ts`
- `functions/api/src/middlewares/requireRole.ts`
- `functions/api/src/services/weekendWindow.ts`
- `functions/api/src/services/operationalActivity.ts`
- `infra/sql/schema.sql`
- `infra/sql/rls.sql`
- `infra/sql/migrations/**`
- `infra/sql/README.md`
- contratos actuales del panel en `apps/web-next`.

## 4. Estado actual detectado

Hallazgos relevantes:

- `locals` modela bares/discotecas y tiene `type in ('bar', 'club')`.
- `panel_users` esta atado a `local_id` y `auth_user_id` es unico.
- `orders` esta atado a `local_id`, `checkin_token`, ventanas de discoteca y `ticket_types`.
- `ticket_types` esta atado a `local_id` y no cubre stock de evento.
- `operational_activity_events` esta atado a `local_id` y `entity_type in ('order', 'reservation')`.
- `panelAuth` adjunta `req.panelUser = { userId, email, localId, role }`.
- `requireRole` depende de `req.panelUser.role`.
- Exports actuales son owner-only, pero estan pensados para locales.
- Near realtime actual usa polling/refetch visible-only.
- `/payments/callback` sigue fuera del corte aprobado para pagos reales.

Acoplamientos a `local_id` que no deben arrastrarse a Eventos:

- tenant auth de panel;
- busqueda/listado de entradas;
- check-in;
- export;
- activity log;
- metricas/resumen;
- catalogo de tickets;
- ventanas de discoteca (`intended_date`, `valid_from`, `valid_to`) como sustituto de fecha real de evento.

## 5. Modelo DB recomendado

Crear tablas nuevas:

- `events`
- `event_ticket_types`
- `event_orders`
- `event_order_entries`
- `event_panel_users`

No usar `events_public` como tabla de eventos. `events_public` queda como tracking publico existente.

### 5.1 `events`

Entidad principal del evento.

Campos recomendados:

- `id uuid primary key`
- `title text not null`
- `slug text not null`
- `description text null`
- `starts_at timestamptz not null`
- `ends_at timestamptz null`
- `checkin_valid_from timestamptz not null`
- `checkin_valid_to timestamptz not null`
- `timezone text not null default 'America/Asuncion'`
- `location_name text not null`
- `address text null`
- `organizer_name text not null`
- `local_id uuid null references public.locals(id) on delete set null`
- `status text not null default 'draft'`
- `cover_image_url text null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints recomendados:

- `slug` unico.
- `title`, `slug`, `location_name`, `organizer_name` no vacios.
- `status in ('draft', 'published', 'paused', 'finished')`.
- `checkin_valid_from < checkin_valid_to`.
- `ends_at is null or ends_at >= starts_at`.
- `metadata` debe ser objeto JSON.

Notas:

- Ibiza tendra `local_id = null`.
- Evitar hard delete operativo de eventos con ordenes/entradas; preferir lifecycle por `status`.
- `price_amount` no vive en `events`; vive en `event_ticket_types`.

### 5.2 `event_ticket_types`

Tipos de entrada por evento.

Campos recomendados:

- `id uuid primary key`
- `event_id uuid not null references public.events(id) on delete restrict`
- `name text not null`
- `description text null`
- `price_amount bigint not null default 0`
- `currency text not null default 'PYG'`
- `stock integer not null`
- `active boolean not null default true`
- `sales_start timestamptz null`
- `sales_end timestamptz null`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints recomendados:

- `name` no vacio.
- `price_amount >= 0`.
- `stock >= 0`.
- `currency = 'PYG'` para el MVP Ibiza, o allowlist explicita si se decide multi-moneda.
- `sales_start is null or sales_end is null or sales_start < sales_end`.
- unique por `event_id + lower(name)`.

Notas:

- VIP: stock 200.
- General: stock 3000.
- `price_amount` puede quedar en `0` mientras el evento este en `draft`, pero debe cargarse antes de operar/publicar.
- No persistir `sold_count` al inicio salvo que se mantenga transaccionalmente.
- Emitidas/usadas deben calcularse desde `event_order_entries` validas.

### 5.3 `event_orders`

Operacion de compra/emision. En Ibiza representa la confirmacion manual de transferencia externa.

Campos recomendados:

- `id uuid primary key`
- `event_id uuid not null references public.events(id) on delete restrict`
- `source text not null`
- `payment_method text not null`
- `payment_status text not null`
- `created_by_auth_user_id uuid null`
- `buyer_name text not null`
- `buyer_last_name text not null`
- `buyer_email text not null`
- `buyer_phone text not null`
- `buyer_document text not null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints recomendados:

- `source in ('manual_issue', 'online_checkout')`.
- `payment_method in ('manual_transfer', 'bancard', 'dinelco', 'other')`.
- `payment_status in ('confirmed_externally', 'paid', 'cancelled', 'refunded', 'pending')`.
- buyer fields requeridos no vacios para el piloto.
- Para Ibiza manual: `source = 'manual_issue'`, `payment_method = 'manual_transfer'`, `payment_status = 'confirmed_externally'`.

Notas:

- `notes` puede existir en MVP, pero no debe copiarse a activity metadata ni exportarse sin decision explicita.
- `payment_status = 'pending'` puede existir para compatibilidad futura, pero no debe usarse en el piloto manual salvo que haya un flujo explicitamente definido.
- El flujo futuro online debe crear `event_orders` y `event_order_entries` con la misma unidad validable.

### 5.4 `event_order_entries`

Unidad validable por persona/entrada. Cada row tiene QR propio.

Campos recomendados:

- `id uuid primary key`
- `event_id uuid not null references public.events(id) on delete restrict`
- `event_order_id uuid not null references public.event_orders(id) on delete restrict`
- `event_ticket_type_id uuid not null references public.event_ticket_types(id) on delete restrict`
- `attendee_name text not null`
- `attendee_last_name text not null`
- `attendee_email text not null`
- `attendee_phone text not null`
- `attendee_document text not null`
- `status text not null default 'issued'`
- `checkin_status text not null default 'unused'`
- `checkin_token uuid not null unique`
- `used_at timestamptz null`
- `used_by_auth_user_id uuid null`
- `email_sent_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints recomendados:

- `status in ('issued', 'voided')`.
- `checkin_status in ('unused', 'used')`.
- `attendee_*` requeridos no vacios para el piloto.
- `used` requiere `used_at`.
- `unused` requiere `used_at null`.
- `used_by_auth_user_id is null` si `checkin_status = 'unused'`.
- `voided` no debe poder validarse.
- `event_id` debe coincidir logicamente con el `event_id` de `event_order_id` y `event_ticket_type_id`; si no se puede expresar con FK compuesta, validarlo en la funcion transaccional de emision/check-in.

Notas:

- Una orden puede agrupar varias entradas.
- El check-in valida `event_order_entries`, no `event_orders`.
- No usar QR grupal.
- No exponer `checkin_token` en export, activity metadata ni listados que no lo necesiten.

### 5.5 `event_panel_users`

Membresia operativa para panel de evento.

Campos recomendados:

- `id uuid primary key`
- `event_id uuid not null references public.events(id) on delete cascade`
- `auth_user_id uuid not null`
- `role text not null`
- `display_name text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints recomendados:

- unique `event_id + auth_user_id`.
- `role in ('owner', 'staff')`.
- `display_name is null or char_length(trim(display_name)) between 1 and 80`.

Notas:

- `auth_user_id` puede estar en multiples eventos.
- El mismo `auth_user_id` puede existir en `panel_users` local y `event_panel_users`.
- Actor label de eventos debe resolverse desde `event_panel_users.display_name`.

## 6. Indices minimos

Indices recomendados para Slice 1B:

- `events(slug)`
- `event_ticket_types(event_id)`
- `event_orders(event_id, created_at desc)`
- `event_order_entries(event_id, checkin_status)`
- `event_order_entries(event_id, event_ticket_type_id)`
- `event_order_entries(checkin_token)`
- `event_panel_users(event_id, auth_user_id)`
- `event_order_entries(event_id, attendee_email)`
- `event_order_entries(event_id, attendee_document)`

Indices adicionales a evaluar despues:

- `event_order_entries(event_id, created_at desc)`
- `event_order_entries(event_id, status, checkin_status)`
- `event_panel_users(auth_user_id)` si se agrega selector multi-evento.
- `event_ticket_types(event_id, active, sort_order)` para listados de configuracion.

## 7. RLS y grants recomendados

Para la migracion minima:

- habilitar RLS en las cinco tablas nuevas;
- revocar privilegios de `anon`;
- revocar privilegios de `authenticated`;
- no crear policies permisivas hasta disenar JWT/RLS/RPC por evento;
- mantener acceso por backend/API con service role como riesgo residual temporal inventariado;
- documentar que service role no es objetivo final de arquitectura.

No replicar `rls.sql` permisivo historico. Las migraciones recientes endurecen Data API para tablas sensibles y ese criterio debe mantenerse.

Para un futuro JWT/RLS/RPC:

- evaluar claims de evento o RPCs acotadas por `event_id`;
- no abrir Supabase Realtime directo sin revisar RLS/canales por tenant;
- no usar `event_panel_users` como tabla legible por cliente directo.

## 8. Stock y sobreventa

Objetivo:

- impedir emitir mas de 200 VIP;
- impedir emitir mas de 3000 General;
- soportar emision multiple;
- evitar carreras entre operadores.

Recomendacion:

- implementar emision mediante funcion SQL/RPC transaccional o transaccion backend con lock.
- bloquear la row de `event_ticket_types` correspondiente con `FOR UPDATE` o mecanismo equivalente.
- calcular `issued_count` desde `event_order_entries` no anuladas para ese `event_ticket_type_id`.
- validar `issued_count + requested_count <= stock`.
- insertar `event_order` y todas sus `event_order_entries` en la misma operacion.
- si cualquier insercion falla, rollback completo.

Reglas:

- Frontend puede mostrar stock restante como ayuda, pero no es seguridad.
- La proteccion real debe vivir en backend/DB.
- `sold_count` persistido no se recomienda al inicio salvo que se mantenga atomicamente.
- Anulaciones futuras (`voided`) deben definir si liberan stock o no antes de implementarse.

## 9. Tenant model y eventPanelAuth

No asumir que `panelAuth` sirve para eventos. `panelAuth` actual resuelve `panel_users` por `auth_user_id` y adjunta `localId`; eso es correcto para locales, no para Ibiza.

Recomendacion:

- crear `eventPanelAuth` en un slice futuro;
- crear `requireEventRole` o abstraccion equivalente;
- usar rutas con `eventId` en path;
- mantener `panelAuth` actual intacto para bares/discotecas.

Contexto que debe adjuntar `eventPanelAuth`:

- `eventId`
- `role`
- `authUserId`
- `displayName`

Determinacion de `event_id`:

- Recomendado para MVP: path param, por ejemplo `/panel/events/:eventId/...`.
- Header: no recomendado como fuente principal para MVP.
- Tenant selector futuro: posible, pero posterior.
- Subdominio/slug: no necesario para Ibiza.

Reglas de autorizacion:

- Buscar membresia en `event_panel_users` por `event_id + auth_user_id`.
- Owner/staff de local no accede automaticamente a eventos.
- Owner/staff de otro evento no accede a Ibiza.
- Export requiere rol `owner`.
- Staff puede emitir/validar solo si el contrato del endpoint lo permite.

## 10. Contratos futuros

Estos contratos son conceptuales y no se implementan en este documento.

### 10.1 Emision manual individual/multiple

Endpoint conceptual:

- `POST /panel/events/:eventId/orders/manual-issue`

Input conceptual:

- buyer: nombre, apellido, email, telefono, documento;
- entries: lista de asistentes con tipo de ticket y datos personales;
- payment: `manual_transfer / confirmed_externally`;
- notes opcional.

Output conceptual:

- `event_order.id`;
- lista de `event_order_entries`;
- estado de cada entry;
- QR o recurso seguro para mostrar/descargar en panel;
- resultado de envio de email si es sincrono, o estado `email_pending` si es async.

Reglas:

- crear una orden y N entries;
- descontar/proteger stock atomicamente;
- no crear entries si excede stock;
- email puede dispararse posterior o async;
- activity futuro registra emision y email enviado, sin PII innecesaria.

### 10.2 Check-in

Endpoint conceptual:

- `PATCH /panel/events/:eventId/checkin/:token`

Valida:

- token existe;
- entry pertenece al `eventId`;
- actor tiene membresia;
- evento esta dentro de ventana;
- entry no esta `voided`;
- entry no fue usada.

Estados:

- `valid`;
- `already_used`;
- `invalid`;
- `outside_window`;
- `voided`.

Reglas:

- no exponer token raw en logs, activity o export;
- actualizar `checkin_status = 'used'`, `used_at`, `used_by_auth_user_id`;
- intento duplicado debe ser respuesta controlada y registrar activity futura sanitizada.

### 10.3 Validacion manual

Endpoint conceptual:

- `PATCH /panel/events/:eventId/entries/:entryId/use`

Reglas:

- mismas validaciones que QR;
- no depende de `checkin_token`;
- registra actor panel;
- no distinguir QR/manual en metadata salvo decision futura explicita.

### 10.4 Busqueda manual

Endpoint conceptual:

- `GET /panel/events/:eventId/entries/search`

Filtros:

- email;
- documento;
- nombre/apellido;
- tipo de entrada;
- usada/no usada;
- status.

Reglas:

- siempre scoped por `event_id`;
- no aceptar `event_id` desde query como sustituto del path;
- no devolver entries de otro evento;
- devolver solo datos operativos necesarios para puerta.

### 10.5 Export

Endpoint conceptual:

- `GET /panel/events/:eventId/exports/entries.xlsx`

Reglas:

- owner-only;
- sin `checkin_token`;
- sin QR raw;
- sin IDs internos innecesarios;
- sin metadata cruda;
- incluir compradores/asistentes, tipo de entrada, estado de emision/pago externo, check-in, fecha de emision y fecha de validacion.

### 10.6 Activity

Activity log de eventos queda para slice futuro.

No asumir que `operational_activity_events` sirve sin cambios, porque hoy esta orientada a `local_id` y `entity_type = order | reservation`.

Eventos sugeridos:

- `event_entry_issued`
- `event_entry_email_sent`
- `event_entry_checked_in`
- `event_entry_already_used_attempt`
- `event_entry_voided`
- `event_entry_corrected`

Politica:

- actor label seguro desde `event_panel_users`;
- no PII innecesaria en metadata;
- no `checkin_token`;
- no QR raw;
- no notes crudas;
- no metodo QR/manual salvo decision futura explicita.

## 11. Estado Slice 1B - QA DB estructural y comportamiento PASS

Estado: **aplicada en Supabase con QA estructural PASS y QA de comportamiento PASS**.

Migracion aplicada:

- `infra/sql/migrations/027_create_event_pilot_tables.sql`

### QA estructural validado

Tablas creadas -> `PASS`:

- `event_order_entries`
- `event_orders`
- `event_panel_users`
- `event_ticket_types`
- `events`

RLS enabled -> `PASS`:

- `events`
- `event_ticket_types`
- `event_orders`
- `event_order_entries`
- `event_panel_users`

Constraints principales presentes -> `PASS`:

- textos no vacios;
- enums;
- ventanas;
- metadata object;
- precio/stock no negativos;
- snapshots monetarios;
- used/unused;
- used actor;
- voided no usado;
- roles;
- display_name;
- FKs;
- FKs compuestas.

Indices principales presentes -> `PASS`:

- `idx_events_slug_unique`
- `idx_event_ticket_types_event_id`
- `idx_event_ticket_types_event_lower_name_unique`
- `idx_event_orders_event_created`
- `idx_event_order_entries_event_checkin_status`
- `idx_event_order_entries_event_ticket_type`
- `idx_event_order_entries_checkin_token_unique`
- `idx_event_order_entries_event_attendee_email`
- `idx_event_order_entries_event_attendee_document`
- `idx_event_panel_users_event_auth_user_unique`

Grants directos a `anon`/`authenticated` -> `PASS`:

- Query de grants devolvio `0 rows`.

Alcance protegido -> `PASS`:

- no se inserto Ibiza;
- no se insertaron VIP/General;
- no se crearon owner/staff;
- no se tocaron endpoints;
- no se toco frontend;
- no se toco B2C;
- no se tocaron pagos ni `/payments/callback`.

### QA de comportamiento validado

Resultado en Supabase:

- `Success. No rows returned`

Interpretacion:

- el script no devolvia filas porque no tenia `SELECT` final;
- el script estaba disenado para lanzar `FAIL: ...` si alguna regla fallaba;
- como no hubo error, el QA de comportamiento se considera `PASS`;
- el script terminaba con `rollback`, por lo que no dejo datos persistidos.

Eventos -> `PASS`:

- insert valido de evento draft;
- rechazo de title vacio;
- rechazo de slug vacio;
- rechazo de status invalido;
- rechazo de ventana invalida;
- rechazo de metadata no object;
- rechazo de timezone vacio;
- unique slug normalizado con `lower(trim(slug))`.

Ticket types -> `PASS`:

- insert valido de VIP;
- insert valido de General;
- rechazo de name vacio;
- rechazo de stock negativo;
- rechazo de `price_amount` negativo;
- rechazo de currency distinta de `PYG`;
- rechazo de `sales_start >= sales_end`;
- unique ticket name normalizado con `lower(trim(name))`;
- mismo ticket name permitido en otro evento.

Event orders -> `PASS`:

- insert valido de `manual_issue / manual_transfer / confirmed_externally`;
- rechazo de source invalido;
- rechazo de payment_method invalido;
- rechazo de payment_status invalido;
- rechazo de total_amount negativo;
- rechazo de currency distinta de `PYG`;
- rechazo de buyer_email vacio;
- rechazo de buyer_document vacio.

Event order entries -> `PASS`:

- insert valido unused;
- rechazo de unit_price_amount negativo;
- rechazo de currency distinta de `PYG`;
- rechazo de used sin used_at;
- rechazo de used sin used_by_auth_user_id;
- rechazo de unused con used_at;
- rechazo de unused con used_by_auth_user_id;
- insert valido used con used_at y used_by_auth_user_id;
- rechazo de voided used;
- insert valido voided unused;
- rechazo de checkin_token duplicado;
- rechazo de entry con order de otro evento;
- rechazo de entry con ticket type de otro evento.

Event panel users -> `PASS`:

- insert valido owner;
- insert valido staff;
- rechazo de role invalido;
- rechazo de display_name vacio;
- rechazo de duplicado event_id + auth_user_id.

RLS/grants -> `PASS`:

- RLS enabled en las cinco tablas;
- grants directos a `anon`/`authenticated` siguen en `0 rows`.

### Proximo paso recomendado

Proximo paso recomendado:

- avanzar a Ibiza Slice 1C - Provisioning Ibiza.

Alcance recomendado de Slice 1C:

- crear evento Ibiza;
- crear ticket type VIP;
- crear ticket type General;
- crear event_panel_users owner/staff;
- no crear entradas;
- no crear event_orders;
- no crear event_order_entries;
- no crear endpoints;
- no tocar frontend;
- no tocar pagos;
- no tocar `/payments/callback`.

## 12. Roadmap tecnico ajustado

### Slice 1A - Documento tecnico

Estado: cerrado.

Se creo este documento y quedaron aprobadas las decisiones de DB, tenant, constraints, indices, stock y contratos futuros.

### Slice 1B - Migracion DB minima

Estado: aplicada en Supabase con QA estructural PASS y QA de comportamiento PASS.

Se crearon `events`, `event_ticket_types`, `event_orders`, `event_order_entries`, `event_panel_users`, constraints, indices, RLS enabled y grants revocados.

### Slice 1C - Provisioning Ibiza

Proximo paso recomendado. Crear Ibiza, VIP, General, stocks, precios configurables y usuarios owner/staff mediante seed o script controlado, sin crear entradas, ordenes, endpoints, frontend ni pagos.

### Slice 2 - eventPanelAuth / rutas protegidas

Crear middleware de evento y role guard sin tocar `panelAuth` local.

### Slice 3 - Endpoints de lectura/resumen/entradas

Lectura de evento, resumen, listado y busqueda de entries scoped por `event_id`.

### Slice 4 - Emision manual individual/multiple

Crear orden y entries con stock atomico.

### Slice 5 - Email QR + QR visible

Enviar QR por email y mostrar QR en panel para WhatsApp.

### Slice 6 - Check-in scanner/manual

Validar por `event_order_entry`, con QR y fallback manual.

### Slice 7 - Activity log de eventos

Agregar tabla/extension/helper de activity para eventos, con actor label y metadata sanitizada.

### Slice 8 - Export owner-only

Export de entries sin token ni metadata cruda.

### Slice 9 - Near realtime/polling

Polling/refetch visible-only para resumen, entradas, check-in e historial.

### Slice 10 - QA/hardening operativo

Pruebas de DB, auth, emision, stock, check-in, export, email y carga operativa.

## 13. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Mezclar `local_id` y `event_id` | fuga de datos o permisos incorrectos | tenant model por `event_id` y `eventPanelAuth` |
| Crear tablas sin constraints suficientes | datos invalidos dificiles de reparar | checks, FKs, unique e indices desde Slice 1B |
| Sobreventa por concurrencia | vender mas entradas que stock | emision atomica con lock/transaccion |
| QR grupal accidental | check-in ambiguo | `event_order_entries` como unidad validable |
| Export con tokens | exposicion sensible | no incluir `checkin_token` ni QR raw |
| Activity con PII | exposicion operativa innecesaria | metadata minima y sanitizada |
| Staff con export | acceso excesivo | export owner-only |
| Usar `panelAuth` indebidamente | evento queda atado a local | `eventPanelAuth` separado |
| Pagos futuros mal encajados | rehacer modelo | `source/payment_method/payment_status` compatibles |
| Email QR sin control de envio | soporte operativo dificil | `email_sent_at` y activity futura |
| Carga manual pesada | operacion lenta | emision multiple; evaluar CSV futuro |
| Hard delete de evento con entries | perdida historica | lifecycle por `status`; restrict en FKs |
| Migraciones sin rollback claro | riesgo operativo | migracion acotada y plan de rollback documental |

## 14. QA recomendado

DB:

- constraints de status/source/payment/check-in;
- `events.slug` unico;
- FKs correctas;
- token unico;
- indices creados;
- RLS enabled;
- anon/authenticated sin grants directos;
- evento con ordenes/entries no se borra accidentalmente.

Stock:

- emitir VIP individual;
- emitir General individual;
- emitir multiples VIP;
- emitir multiples General;
- impedir 201 VIP si stock VIP es 200;
- impedir 3001 General si stock General es 3000;
- dos operadores concurrentes no superan stock.

Auth:

- owner Ibiza accede;
- staff Ibiza accede;
- owner de otro evento no ve Ibiza;
- owner local no ve Ibiza sin membresia;
- staff no exporta.

Emision:

- crear orden manual;
- crear N entries;
- emision de 4 entradas genera 4 QRs;
- buyer y attendees quedan correctamente relacionados;
- `payment_method = manual_transfer`;
- `payment_status = confirmed_externally`.

Check-in:

- QR valido PASS;
- QR duplicado muestra ya usada;
- token invalido no filtra datos;
- fuera de ventana bloquea validacion;
- entry `voided` no valida;
- validacion manual respeta las mismas reglas.

Export:

- owner-only;
- no incluye `checkin_token`;
- no incluye QR raw;
- no incluye metadata cruda;
- incluye estados correctos.

Activity futuro:

- no PII innecesaria en metadata;
- no token;
- actor label seguro;
- intento duplicado queda registrado.

Email:

- QR enviado;
- `email_sent_at` actualizado;
- reenvio, si se implementa, queda registrado.

## 15. Fuera de alcance de este paso

Fuera de este ASK / DOCS:

- implementar codigo;
- crear migraciones;
- tocar SQL;
- tocar endpoints;
- tocar frontend;
- tocar B2C;
- tocar pagos;
- tocar `/payments/callback`;
- tocar runtime demo;
- tocar panel actual;
- tocar exports existentes;
- tocar service role;
- usar locals como eventos;
- extender `locals.type`;
- reutilizar `orders` sin decision tecnica separada;
- asumir que `panelAuth` sirve para eventos;
- abrir B2C publico de Ibiza.

## 16. Criterio de cierre

Este documento queda listo para pasar a CODE de migracion DB minima cuando esten aprobados:

- tablas nuevas;
- campos;
- constraints;
- indices;
- RLS/grants;
- tenant model;
- unidad validable;
- estrategia de stock;
- compatibilidad con pagos futuros;
- contratos futuros;
- QA.
