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
- Producto comercial vendido no es lo mismo que unidad validable en puerta.
- `event_order_items` debe representar lineas comerciales cuando se vendan paquetes.
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

Modelo recomendado actualizado:

- `events`
- `event_ticket_types`
- `event_orders`
- `event_order_items`
- `event_order_entries`
- `event_panel_users`

No usar `events_public` como tabla de eventos. `events_public` queda como tracking publico existente.

Estado importante:

- La migracion 027 ya fue aplicada y validada con QA estructural PASS y QA de comportamiento PASS.
- La migracion 028 ya fue aplicada y validada con QA estructural PASS y QA de comportamiento PASS.
- La base DB de Eventos ya soporta `event_order_items`, `sales_unit_type`, `entries_per_unit` y el vinculo directo entre `event_order_entries` y `event_order_items`.
- Slice 1C ya fue aplicado y validado: Ibiza, 9 productos comerciales y `event_panel_users` owner/staff quedaron provisionados sin crear orders, order items, entries ni QRs.
- Slice 2A ya fue implementado, deployado y validado con QA runtime PASS: `eventPanelAuth`, `requireEventRole` y `GET /panel/events/:eventId/me`.
- Slice 2B ya fue implementado, deployado y validado con QA runtime PASS: `GET /panel/events/:eventId/summary` y `GET /panel/events/:eventId/ticket-types`.

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
- `sales_unit_type text not null default 'single_entry'`
- `entries_per_unit integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints recomendados:

- `name` no vacio.
- `price_amount >= 0`.
- `stock >= 0`.
- `currency = 'PYG'` para el MVP Ibiza, o allowlist explicita si se decide multi-moneda.
- `sales_start is null or sales_end is null or sales_start < sales_end`.
- unique por `event_id + lower(name)`.
- `sales_unit_type in ('single_entry', 'package')`.
- `entries_per_unit >= 1`.
- `sales_unit_type = 'single_entry'` implica `entries_per_unit = 1`.
- `sales_unit_type = 'package'` implica `entries_per_unit > 1`.

Notas:

- General/VIP individual usan `sales_unit_type = 'single_entry'` y `entries_per_unit = 1`.
- Mesas VIP usan `sales_unit_type = 'package'` y `entries_per_unit = 10`.
- `stock` mide unidades comerciales disponibles, no cantidad de QRs.
- `price_amount` mide el precio de la unidad comercial.
- `price_amount` puede quedar en `0` mientras el evento este en `draft`, pero debe cargarse antes de operar/publicar.
- No persistir `sold_count` al inicio salvo que se mantenga transaccionalmente.
- Productos vendidos deben calcularse desde `event_order_items`; accesos emitidos/usados deben calcularse desde `event_order_entries` validas.

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

### 5.4 `event_order_items`

Linea comercial dentro de una orden. Esta tabla fue agregada por la migracion 028.

Campos recomendados:

- `id uuid primary key`
- `event_id uuid not null references public.events(id) on delete restrict`
- `event_order_id uuid not null references public.event_orders(id) on delete restrict`
- `event_ticket_type_id uuid not null references public.event_ticket_types(id) on delete restrict`
- `quantity integer not null`
- `unit_price_amount bigint not null`
- `currency text not null default 'PYG'`
- `entries_per_unit integer not null`
- `total_amount bigint not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints recomendados:

- `quantity > 0`.
- `unit_price_amount >= 0`.
- `entries_per_unit >= 1`.
- `total_amount >= 0`.
- `total_amount = quantity * unit_price_amount`.
- `currency = 'PYG'` para el MVP Ibiza.
- `event_id` debe coincidir con el `event_id` de `event_order_id` y `event_ticket_type_id`.

Notas:

- Producto comercial vendido no es lo mismo que unidad validable en puerta.
- Una Mesa VIP vendida es una linea comercial con `quantity = 1` y `entries_per_unit = 10`.
- Esa linea debe generar 10 `event_order_entries`.
- Una venta de 4 General Preventa 2 es una linea con `quantity = 4` y `entries_per_unit = 1`, y debe generar 4 entries.
- Esta tabla prepara carrito/checkout online futuro, export comercial y metricas de paquetes/mesas vendidas.

### 5.5 `event_order_entries`

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
- `unit_price_amount bigint not null default 0`
- `currency text not null default 'PYG'`
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
- `unit_price_amount >= 0`.
- `currency = 'PYG'` para el MVP Ibiza.
- `event_id` debe coincidir logicamente con el `event_id` de `event_order_id` y `event_ticket_type_id`; si no se puede expresar con FK compuesta, validarlo en la funcion transaccional de emision/check-in.

Notas:

- Una orden puede agrupar varias entradas.
- Una linea comercial puede generar varias entradas.
- El check-in valida `event_order_entries`, no `event_orders`.
- No usar QR grupal.
- Para paquetes, crear `quantity * entries_per_unit` entries individuales.
- `unit_price_amount` puede guardar el precio equivalente por acceso; para Mesa VIP Preventa 1 seria `320000`.
- No exponer `checkin_token` en export, activity metadata ni listados que no lo necesiten.

### 5.6 `event_panel_users`

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

Indices agregados por migracion 028:

- `event_order_items(event_id, event_order_id)`
- `event_order_items(event_id, event_ticket_type_id)`
- `event_order_items(event_id, created_at desc)`
- `event_ticket_types(event_id, sales_unit_type)`

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

Migracion 028:

- habilitar RLS en `event_order_items`;
- revocar privilegios de `anon`;
- revocar privilegios de `authenticated`;
- no crear policies permisivas en este slice;
- mantener `event_order_items` accesible solo por backend/API hasta disenar policies o RPCs por evento.

## 8. Stock y sobreventa

Objetivo:

- impedir emitir mas de 2400 accesos General;
- impedir emitir mas de 600 accesos VIP individual;
- impedir vender mas de 20 Mesas VIP;
- impedir emitir mas de 200 accesos derivados de Mesas VIP;
- soportar emision multiple;
- evitar carreras entre operadores.

Recomendacion:

- implementar emision mediante funcion SQL/RPC transaccional o transaccion backend con lock.
- bloquear la row de `event_ticket_types` correspondiente con `FOR UPDATE` o mecanismo equivalente.
- calcular unidades comerciales vendidas desde `event_order_items` no anulados o vigentes para ese `event_ticket_type_id`.
- validar `commercial_units_sold + requested_quantity <= stock`.
- insertar `event_order`, sus `event_order_items` y todas sus `event_order_entries` en la misma operacion.
- generar `requested_quantity * entries_per_unit` entries por cada item.
- si cualquier insercion falla, rollback completo.

Reglas:

- Frontend puede mostrar stock restante como ayuda, pero no es seguridad.
- La proteccion real debe vivir en backend/DB.
- `sold_count` persistido no se recomienda al inicio salvo que se mantenga atomicamente.
- Anulaciones futuras (`voided`) deben definir si liberan stock o no antes de implementarse.
- Para paquetes, stock se descuenta por unidad comercial, no por QR.
- Para Mesa VIP Preventa 1: `quantity = 1` consume 1 mesa de stock y genera 10 QRs.

## 9. Tenant model y eventPanelAuth

No asumir que `panelAuth` sirve para eventos. `panelAuth` actual resuelve `panel_users` por `auth_user_id` y adjunta `localId`; eso es correcto para locales, no para Ibiza.

Recomendacion:

- mantener `eventPanelAuth` separado de `panelAuth`;
- mantener `requireEventRole` separado de `requireRole`;
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
- Slice 2A valido en runtime que `panel_users`/`local_id` no otorgan acceso a eventos.

## 10. Contratos futuros

Estos contratos son conceptuales y no se implementan en este documento.

### 10.1 Emision manual individual/multiple

Endpoint conceptual:

- `POST /panel/events/:eventId/orders/manual-issue`

Input conceptual:

- buyer: nombre, apellido, email, telefono, documento;
- items: lista de productos comerciales, cantidades y snapshot de precio;
- attendees: lista de asistentes requerida para generar los QRs individuales;
- payment: `manual_transfer / confirmed_externally`;
- notes opcional.

Output conceptual:

- `event_order.id`;
- lista de `event_order_items`;
- lista de `event_order_entries`;
- estado de cada entry;
- QR o recurso seguro para mostrar/descargar en panel;
- resultado de envio de email si es sincrono, o estado `email_pending` si es async.

Reglas:

- crear una orden y N entries;
- crear una orden, N items comerciales y M entries validables;
- para cada item, generar `quantity * entries_per_unit` entries;
- descontar/proteger stock atomicamente;
- descontar stock por unidad comercial;
- no crear entries si excede stock;
- email puede dispararse posterior o async;
- activity futuro registra emision y email enviado, sin PII innecesaria.

Ejemplos:

- `quantity = 4` de General Preventa 2 genera 4 entries.
- `quantity = 1` de Mesa VIP Preventa 1 genera 10 entries.
- `quantity = 2` de Mesa VIP Preventa 1 genera 20 entries.

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

### Estado Slice 1B.2 - Migracion 028 aplicada y validada

Estado: **aplicada en Supabase con QA estructural PASS y QA de comportamiento PASS**.

Migracion aplicada:

- `infra/sql/migrations/028_add_event_packages_and_order_items.sql`

La migracion mantiene la separacion:

- `event_ticket_types` = producto comercial configurable;
- `event_order_items` = linea comercial/snapshot de venta;
- `event_order_entries` = unidad validable/QR individual.

### QA estructural Slice 1B.2 validado

Columnas nuevas en `event_ticket_types` -> `PASS`:

- `sales_unit_type`: tipo `text`, nullable `NO`, default `'single_entry'`;
- `entries_per_unit`: tipo `integer`, nullable `NO`, default `1`.

Tabla `event_order_items` -> `PASS`:

- `public.event_order_items` creada.

Constraints nuevas presentes -> `PASS`:

- `event_ticket_types_sales_unit_type_chk`
- `event_ticket_types_entries_per_unit_positive_chk`
- `event_ticket_types_sales_unit_entries_chk`
- `event_order_items_order_event_fk`
- `event_order_items_ticket_type_event_fk`
- `event_order_items_entry_alignment_key`
- `event_order_items_ticket_name_non_empty_chk`
- `event_order_items_sales_unit_type_chk`
- `event_order_items_sales_unit_entries_chk`
- `event_order_items_quantity_positive_chk`
- `event_order_items_unit_price_non_negative_chk`
- `event_order_items_currency_chk`
- `event_order_items_entries_per_unit_positive_chk`
- `event_order_items_total_amount_non_negative_chk`
- `event_order_items_total_amount_consistency_chk`
- `event_order_entries_order_item_alignment_fk`

Indices presentes -> `PASS`:

- `idx_event_order_entries_event_order_item`
- `event_order_items_entry_alignment_key`
- `event_order_items_pkey`
- `idx_event_order_items_event_created`
- `idx_event_order_items_event_order`
- `idx_event_order_items_event_ticket_type`
- `idx_event_ticket_types_event_sales_unit`

RLS/grants -> `PASS`:

- `event_order_items` tiene RLS enabled;
- grants directos a `anon`/`authenticated` devolvieron `0 rows`.

### QA comportamiento Slice 1B.2 validado

Resultado en Supabase:

- `Success. No rows returned`

Interpretacion:

- el script usaba errores `FAIL: ...` para detectar comportamientos incorrectos;
- no devolvia filas por diseno;
- al no lanzar error, se considera `PASS`;
- el script terminaba con `rollback`, por lo que no dejo datos temporales persistidos.

Casos cubiertos -> `PASS`:

- `single_entry` valido;
- `package` valido;
- `sales_unit_type` invalido rechazado;
- `single_entry` con `entries_per_unit > 1` rechazado;
- `package` con `entries_per_unit = 1` rechazado;
- `event_order_items` validos para entrada y mesa;
- `quantity` invalida rechazada;
- `total_amount` inconsistente rechazado;
- snapshot package incoherente rechazado;
- order item con order de otro evento rechazado;
- order item con ticket type de otro evento rechazado;
- entry valida vinculada a order item;
- entry de mesa con precio equivalente por acceso;
- entry sin `event_order_item_id` rechazada;
- entry con item incompatible rechazada.

### Estado Slice 1C - Provisioning Ibiza aplicado y validado

Estado: **aplicado con QA principal PASS e idempotency PASS**.

Provisioning aplicado:

- `infra/sql/provisioning/ibiza_event_seed.sql`

Alcance provisionado:

- evento Ibiza;
- 9 `event_ticket_types`;
- `event_panel_users` owner/staff.

### QA auth users Slice 1C validado

Auth users requeridos -> `PASS`:

- `owner.ibiza@tairet.com.py`
- `staff1.ibiza@tairet.com.py`
- `staff2.ibiza@tairet.com.py`
- `staff3.ibiza@tairet.com.py`
- `staff4.ibiza@tairet.com.py`

Todos tienen `auth_user_id` no nulo.

### QA evento Slice 1C validado

Evento Ibiza -> `PASS`:

- `title = Ibiza`;
- `slug = ibiza`;
- `local_id = null`;
- `status = draft`;
- `organizer_name = Tahiel`;
- `timezone = America/Asuncion`;
- `location_name = Centro de Eventos de Mariscal López`;
- `starts_at`, `ends_at` y ventanas de check-in correctas considerando almacenamiento `timestamptz`/UTC.

### QA ticket types Slice 1C validado

Productos creados/asegurados -> `PASS`:

- General Preventa 1;
- General Preventa 2;
- General Precio Final;
- VIP Preventa 1;
- VIP Preventa 2;
- VIP Precio Final;
- Mesa VIP Preventa 1;
- Mesa VIP Preventa 2;
- Mesa VIP Precio Final.

Validaciones -> `PASS`:

- stocks correctos;
- precios correctos;
- `currency = PYG`;
- `active = true`;
- `sort_order` 1 a 9;
- General/VIP como `single_entry`;
- Mesas VIP como `package`;
- Mesas VIP con `entries_per_unit = 10`.

Totales -> `PASS`:

- `total_qr_accesses = 3200`;
- `total_commercial_amount = 750600000`.

### QA event_panel_users Slice 1C validado

Memberships -> `PASS`:

- 1 owner;
- 4 staff;
- roles correctos;
- `display_name` correcto;
- todos vinculados al evento `ibiza`.

### QA alcance protegido Slice 1C validado

Datos fuera de alcance -> `PASS`:

- `event_orders = 0`;
- `event_order_items = 0`;
- `event_order_entries = 0`.

Idempotency / re-ejecucion -> `PASS`:

- `events_count = 1`;
- `ticket_types_count = 9`;
- `panel_users_count = 5`;
- re-ejecutar provisioning no duplico evento, tickets ni memberships.

### Estado Slice 2A - eventPanelAuth deployado y QA runtime PASS

Estado: **implementado, fix de regex UUID aplicado, deployado y validado con QA runtime PASS**.

Backend implementado:

- `eventPanelAuth`;
- `requireEventRole`;
- `GET /panel/events/:eventId/me`.

Endpoint validado:

- `GET /panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/me`

Evento validado:

- `event.id = aed4cb4a-b297-4093-98e1-b3474f3b399c`;
- `event.slug = ibiza`;
- `event.title = Ibiza`;
- `event.status = draft`.

QA runtime -> `PASS`:

- `/health` respondio `200 OK` con body `{"ok":true}` y `x-request-id` presente;
- owner Ibiza respondio `200 OK`, `membership.role = owner` y `membership.display_name = Owner Ibiza`;
- staff Ibiza respondio `200 OK`, `membership.role = staff` y `membership.display_name = Staff Ibiza 1`;
- respuestas `200` no expusieron `auth_user_id`, email, token, `access_token`, `refresh_token`, `local_id`, orders, order items, entries ni `checkin_token`;
- request sin `Authorization` respondio `401` con `Missing or invalid Authorization header`;
- token invalido respondio `401` con `Invalid or expired token`;
- `/panel/events/not-a-uuid/me` respondio `400` con `Invalid eventId`;
- owner local de D'Lirio sin membership de evento respondio `403` con `User not authorized for event access`;
- evento inexistente `00000000-0000-4000-8000-000000000000` respondio `404` con `Event not found`;
- regresion panel local: `/panel/me` y `/panel/orders/summary` con owner local respondieron `200 OK`.

Tenant safety validado:

- `eventPanelAuth` valida membresia por `event_id + auth_user_id`;
- `requireEventRole` valida roles `owner | staff` por evento;
- `GET /panel/events/:eventId/me` queda como endpoint minimo protegido validado;
- `panel_users` y `local_id` no otorgan acceso a eventos;
- el panel local existente no se rompio.

### Estado Slice 2B - endpoints read-only deployados y QA runtime PASS

Estado: **implementado, deployado y validado con QA runtime PASS**.

Endpoints implementados:

- `GET /panel/events/:eventId/summary`;
- `GET /panel/events/:eventId/ticket-types`.

Ambos usan:

- `eventPanelAuth`;
- `requireEventRole(["owner", "staff"])`.

Evento validado:

- `event.id = aed4cb4a-b297-4093-98e1-b3474f3b399c`;
- `event.slug = ibiza`;
- `event.title = Ibiza`;
- `event.status = draft`.

QA runtime -> `PASS`:

- `/health` respondio `200 OK` con body `{"ok":true}` y `x-request-id` presente;
- `/summary` con owner Ibiza respondio `200 OK`;
- `/summary` con staff Ibiza respondio `200 OK`;
- `/ticket-types` con owner Ibiza respondio `200 OK`;
- `/ticket-types` con staff Ibiza respondio `200 OK`;
- `/summary` sin `Authorization` respondio `401`;
- `/ticket-types` sin `Authorization` respondio `401`;
- token invalido respondio `401` en ambos endpoints;
- `/panel/events/not-a-uuid/summary` y `/panel/events/not-a-uuid/ticket-types` respondieron `400 Invalid eventId`;
- owner local de D'Lirio sin membership de evento respondio `403` en ambos endpoints;
- evento inexistente `00000000-0000-4000-8000-000000000000` respondio `404 Event not found` en ambos endpoints;
- regresion panel local: `/panel/me` y `/panel/orders/summary` con owner local respondieron `200 OK`.

Cálculos validados en `/summary`:

- `catalog.ticket_type_count = 9`;
- `catalog.commercial_units_stock = 3020`;
- `catalog.potential_qr_accesses = 3200`;
- `catalog.potential_commercial_amount = 750600000`;
- `catalog.currency = PYG`;
- `operations.orders_count = 0`;
- `operations.order_items_count = 0`;
- `operations.entries_count = 0`;
- `operations.issued_commercial_amount = 0`.

Cálculos validados en `/ticket-types`:

- `items.length = 9`;
- `summary.ticket_type_count = 9`;
- `summary.potential_qr_accesses = 3200`;
- `summary.potential_commercial_amount = 750600000`;
- `summary.currency = PYG`;
- General Preventa 1: `stock = 900`, `potential_qr_accesses = 900`, `potential_commercial_amount = 126000000`;
- VIP Preventa 1: `stock = 200`, `potential_qr_accesses = 200`, `potential_commercial_amount = 70000000`;
- Mesa VIP Preventa 1: `stock = 6`, `sales_unit_type = package`, `entries_per_unit = 10`, `potential_qr_accesses = 60`, `potential_commercial_amount = 19200000`.

No exposicion sensible validada:

- `/summary` y `/ticket-types` no exponen `auth_user_id`, email, token, `access_token`, `refresh_token`, `checkin_token`, `local_id`, buyer PII, attendee PII ni metadata.

Tenant safety validado:

- ambos endpoints validan acceso por `event_id + auth_user_id`;
- owner/staff de Ibiza pueden acceder;
- usuarios locales sin membership de evento no acceden;
- `panel_users` y `local_id` no otorgan acceso a Eventos.

Alcance protegido:

- no se crean ni modifican datos operativos;
- no se crean orders, order items, entries, QRs, emails, activity ni exports.

### Estado Slice 3B.1 - RPC issue_event_manual_order aplicada y QA DB PASS

Slice 3B.1 queda registrado como aplicado y validado:

- migracion `029_create_issue_event_manual_order_rpc.sql` aplicada;
- RPC `public.issue_event_manual_order(uuid, uuid, jsonb, jsonb, text)` creada;
- RPC validada como motor transaccional para emision manual/backoffice de ordenes de evento;
- endpoint TS todavia no implementado.

Firma validada:

```sql
public.issue_event_manual_order(
  p_event_id uuid,
  p_actor_auth_user_id uuid,
  p_buyer jsonb,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
```

QA DB -> `PASS`:

- RPC encontrada como `issue_event_manual_order(uuid,uuid,jsonb,jsonb,text)`;
- `anon_can_execute = false`;
- `authenticated_can_execute = false`;
- `service_role_can_execute = true`;
- se ejecuto QA transaccional grande con `begin; ... rollback;`;
- resultado Supabase: `Success. No rows returned`;
- no hubo errores `FAIL`;
- despues del rollback, Ibiza quedo `slug = ibiza`, `title = Ibiza`, `status = draft`;
- limpieza validada: `qa_orders = 0`.

Comportamiento validado:

- permite emitir una orden manual General;
- permite emitir una Mesa/package generando la cantidad correcta de entries;
- bloquea cantidad invalida de asistentes;
- bloquea sobreventa por stock;
- bloquea ticket types de otro evento;
- bloquea actores sin membership del evento;
- bloquea eventos no operables;
- no expone `checkin_token`;
- no expone PII de asistentes;
- no expone `auth_user_id`;
- no expone `local_id`;
- no expone metadata cruda;
- no deja datos parciales ante errores;
- el rollback del QA dejo la base limpia.

### Estado Slice 3B.2 - endpoint manual-issue deployado y QA runtime PASS

Slice 3B.2 queda registrado como implementado, deployado y validado:

- endpoint `POST /panel/events/:eventId/orders/manual-issue` implementado;
- endpoint validado para `event_id = aed4cb4a-b297-4093-98e1-b3474f3b399c`;
- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- llama a RPC `issue_event_manual_order`;
- TypeScript valida input, protege tenant, llama RPC y mapea errores;
- RPC sigue siendo la fuente de stock y transaccion;
- no duplica logica transaccional/stock en TS;
- no se toco frontend;
- no se tocaron pagos ni `/payments/callback`.

QA runtime -> `PASS`:

- `/health` respondio `200 OK` con body `{"ok":true}` y `x-request-id` presente;
- pre-check `/summary`: `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`;
- pre-check General Preventa 1: `id = d89499b3-eb49-4b74-b8c8-48b2d5a55dbe`, `price_amount = 140000`, `stock = 900`, `sales_unit_type = single_entry`, `entries_per_unit = 1`;
- pre-check Mesa VIP Preventa 1: `id = 58234842-9956-4f63-8e30-cc8bcd60dda2`, `price_amount = 3200000`, `stock = 6`, `sales_unit_type = package`, `entries_per_unit = 10`;
- owner Ibiza emitio 1 General Preventa 1 con `201 Created`, `order.source = manual_issue`, `order.total_amount = 140000`, `payment_method = manual_transfer`, `payment_status = confirmed_externally`, `items.length = 1`, `entries.length = 1`, entry `issued/unused`, `qr_status = pending_qr_resource`;
- staff Ibiza emitio 1 Mesa VIP Preventa 1 con `201 Created`, `order.total_amount = 3200000`, `items.length = 1`, `entries.length = 10`, `sales_unit_type = package`, `entries_per_unit = 10`, `unit_price_amount` por entry = `320000`;
- post-summary despues de 3 ordenes QA: `orders_count = 3`, `order_items_count = 3`, `entries_count = 12`, `issued_commercial_amount = 3480000`;
- post-ticket-types: General Preventa 1 `issued_commercial_units = 2`, `issued_qr_accesses = 2`, `remaining_commercial_units = 898`;
- post-ticket-types: Mesa VIP Preventa 1 `issued_commercial_units = 1`, `issued_qr_accesses = 10`, `remaining_commercial_units = 5`;
- Mesa VIP con 9 attendees respondio `400` con `code = invalid_attendees_count`;
- ticket UUID valido inexistente/no perteneciente al evento respondio `404` con `code = ticket_type_not_found`;
- owner local de D'Lirio sin membership respondio `403 User not authorized for event access`;
- request sin `Authorization` respondio `401 Missing or invalid Authorization header`;
- token invalido respondio `401 Invalid or expired token`;
- `/panel/events/not-a-uuid/orders/manual-issue` respondio `400 Invalid eventId`;
- sobreventa Mesa VIP Preventa 1 `quantity = 6` con 60 attendees respondio `409` con `code = insufficient_stock`;
- despues del `409`, summary siguio en `orders_count = 3`, `order_items_count = 3`, `entries_count = 12`, `issued_commercial_amount = 3480000`;
- despues del `409`, ticket-types siguio en General Preventa 1 `issued = 2`, `remaining = 898`, y Mesa VIP Preventa 1 `issued = 1`, `remaining = 5`;
- SQL adicional valido `stock_qa_orders = 0`;
- evento inexistente `00000000-0000-4000-8000-000000000000` por POST respondio `404 Event not found`;
- regresion panel local: `/panel/me` y `/panel/orders/summary` con owner local respondieron `200 OK`.

No exposicion sensible validada en respuestas `201`:

- no aparece `checkin_token`;
- no aparece `buyer_email`;
- no aparece `buyer_phone`;
- no aparece `buyer_document`;
- no aparece `attendee_email`;
- no aparece `attendee_phone`;
- no aparece `auth_user_id`;
- no aparece `local_id`;
- no aparece metadata cruda;
- si aparecen `attendee.name`, `attendee.last_name` y `attendee.document`, permitido por contrato.

Limpieza QA validada:

- se identificaron 3 ordenes QA: `58ff3763-efc3-4a4b-888c-d08c362db17e`, `20c031f5-55e7-44f7-b139-50d2afa25385`, `acf7a539-6f8a-4c87-bad9-90f73323eec4`;
- todas estaban marcadas con `buyer_email = qa.slice3b2...`, `buyer_document = QA-SLICE-3B2...`, `notes = QA Slice 3B.2...`;
- despues de la limpieza, `/summary` volvio a `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`;
- General Preventa 1 volvio a `issued_commercial_units = 0`, `issued_qr_accesses = 0`, `remaining_commercial_units = 900`;
- Mesa VIP Preventa 1 volvio a `issued_commercial_units = 0`, `issued_qr_accesses = 0`, `remaining_commercial_units = 6`.

### Estado Slice 3C.2 - endpoint `/entries` deployado y QA runtime PASS

Slice 3C.2 queda registrado como implementado, deployado y validado:

- endpoint `GET /panel/events/:eventId/entries` implementado;
- endpoint validado para `event_id = aed4cb4a-b297-4093-98e1-b3474f3b399c`;
- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- lista entries emitidas por evento;
- permite busqueda, filtros y paginacion;
- devuelve `entry`, `attendee`, `buyer`, `order` e `item`;
- no expone `checkin_token`;
- no expone `auth_user_id`;
- no expone `local_id`;
- no expone metadata cruda;
- no crea ni modifica datos.

QA runtime -> `PASS`:

- `/health` respondio `200 OK` con body `{"ok":true}` y `x-request-id` presente;
- estado inicial sin entries: owner Ibiza recibio `200 OK`, `items = []`, `pagination.page = 1`, `pagination.page_size = 25`, `pagination.total = 0`, `pagination.total_pages = 0`;
- se creo una orden QA con `POST /panel/events/:eventId/orders/manual-issue`, `201 Created`, generando 1 entry `General Preventa 1`, `status = issued`, `checkin_status = unused`, `qr_status = pending_qr_resource`;
- owner Ibiza y staff Ibiza listaron `/entries` con `200 OK`, `pagination.total = 1`;
- la entry incluyo `entry`, `attendee`, `buyer`, `order` e `item` segun contrato;
- busquedas `q=QA-SLICE-3C2`, `q=qa.slice3c2.entries@example.com` y `q=Entry` encontraron la entry QA;
- filtros `ticket_type_id`, `status=issued` y `checkin_status=unused` respondieron `200 OK`;
- paginacion `page=1&page_size=1` respondio `200 OK`, `pagination.total = 1`, `pagination.total_pages = 1`;
- query params invalidos `status=bad`, `checkin_status=bad`, `page_size=101`, `q=a` y `unknown=1` respondieron `400` con `code = invalid_query`;
- sin `Authorization` respondio `401`;
- token invalido respondio `401`;
- owner local sin membership del evento respondio `403`;
- `/panel/events/not-a-uuid/entries` respondio `400 Invalid eventId`;
- evento inexistente `00000000-0000-4000-8000-000000000000` respondio `404 Event not found`;
- regresion: `/summary`, `/ticket-types`, `/panel/me` local y `/panel/orders/summary` local respondieron `200 OK`.

No exposicion sensible validada:

- no aparece `checkin_token`;
- no aparece `used_by_auth_user_id`;
- no aparece `created_by_auth_user_id`;
- no aparece `auth_user_id`;
- no aparece `local_id`;
- no aparece metadata cruda.

Limpieza QA validada:

- se limpio la orden QA del slice;
- despues de la limpieza, `GET /entries` volvio a `items = []`;
- `pagination.total = 0`;
- `pagination.total_pages = 0`;
- Ibiza quedo nuevamente sin ordenes emitidas.

### Estado Slice 3D.2 - QR visual PNG por entry deployado y QA runtime PASS

Slice 3D.2 queda registrado como implementado, deployado y validado:

- endpoint `GET /panel/events/:eventId/entries/:entryId/qr` implementado;
- endpoint validado para `event_id = aed4cb4a-b297-4093-98e1-b3474f3b399c`;
- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- valida `entryId` como UUID;
- busca la entry por `id + event_id`;
- genera QR visual PNG server-side;
- responde `image/png`;
- no devuelve JSON con `checkin_token`;
- no modifica datos;
- no implementa email;
- no implementa check-in.

QA runtime -> `PASS`:

- `/health` respondio `200 OK` con body `{"ok":true}` y `x-request-id` presente;
- estado inicial limpio: `GET /panel/events/:eventId/entries` respondio `200 OK`, `items = []`, `pagination.total = 0`, `pagination.total_pages = 0`;
- se creo una orden QA via `manual-issue`, `201 Created`, generando entry `b790e704-0c39-4d14-88e3-864a0975545d`, `ticket_name = General Preventa 1`, `status = issued`, `checkin_status = unused`, `qr_status = pending_qr_resource`;
- owner Ibiza obtuvo QR PNG con `200 OK`, `Content-Type = image/png`, `Cache-Control = no-store`, `X-Content-Type-Options = nosniff`, `Content-Disposition = inline; filename="tairet-event-entry-qr.png"`, `Content-Length = 3940`;
- archivo owner `qa-3d2-owner-qr.png` se abrio correctamente como QR;
- staff Ibiza obtuvo QR PNG con `200 OK`, `Content-Type = image/png`, `Content-Length = 3940`, archivo `qa-3d2-staff-qr.png`;
- `entryId` invalido respondio `400`, `code = invalid_entry_id`;
- entry inexistente respondio `404`, `code = entry_not_found`;
- owner local de D'Lirio sin membership respondio `403 User not authorized for event access`;
- sin `Authorization` respondio `401`;
- token invalido respondio `401`;
- `eventId` invalido respondio `400 Invalid eventId`;
- evento inexistente respondio `404 Event not found`;
- QR GET no modifico la entry: `/entries` confirmo `status = issued`, `checkin_status = unused`, `used_at = null`, `pagination.total = 1`;
- regresion: `/summary`, `/ticket-types`, `/entries`, `/panel/me` local y `/panel/orders/summary` local respondieron `200 OK`.

No exposicion sensible validada:

- respuesta exitosa es PNG, no JSON;
- no aparece `checkin_token`;
- no aparece `auth_user_id`;
- no aparece `local_id`;
- no aparece metadata cruda;
- no aparece email;
- no aparece phone;
- no aparece document;
- no aparece token como texto.

Limpieza QA validada:

- se limpio la orden QA del slice;
- despues de la limpieza, `/entries` volvio a `items = []`;
- `pagination.total = 0`;
- `pagination.total_pages = 0`;
- Ibiza quedo nuevamente sin ordenes emitidas.

### Estado Slice 3D.3A - send-email QR por entry deployado y QA runtime PASS

Slice 3D.3A queda registrado como implementado, deployado y validado:

- endpoint `POST /panel/events/:eventId/entries/:entryId/send-email` implementado;
- endpoint validado para `event_id = aed4cb4a-b297-4093-98e1-b3474f3b399c`;
- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- busca la entry por `id + event_id`;
- genera QR PNG internamente;
- envia email con Resend/`sendEmail`;
- actualiza `email_sent_at` solo si el envio termina correctamente;
- permite reenvio controlado por owner/staff;
- no expone `checkin_token`;
- no expone QR payload;
- no revierte ni borra order/item/entry si falla email;
- no implementa check-in;
- no toca pagos ni `/payments/callback`.

QA runtime -> `PASS`:

- `/health` respondio `200 OK` con body `{"ok":true}` y `x-request-id` presente;
- estado inicial limpio: `GET /panel/events/:eventId/entries` respondio `200 OK`, `items = []`, `pagination.total = 0`;
- se creo una entry QA via `manual-issue`, `201 Created`, entry `9b029baa-325d-4afb-8abb-6701ce8cf8de`, `ticket_name = General Preventa 1`, `status = issued`, `checkin_status = unused`, `qr_status = pending_qr_resource`;
- owner Ibiza envio email QR con `200 OK`, `ok = true`, `email.status = sent`, `email.to = mateoguex94@gmail.com`, `entry.email_sent_at = 2026-06-01T20:14:03.488+00:00`;
- email recibido en Gmail con `Tu entrada para Ibiza`, evento `Ibiza`, fecha `sabado, 1 de agosto de 2026, 09:00 p. m.`, lugar `Centro de Eventos de Mariscal Lopez`, entrada `General Preventa 1`, asistente `QA Email` y QR visible;
- staff Ibiza reenvio email QR con `200 OK`, `email.status = sent`, `entry.email_sent_at = 2026-06-01T20:15:08.593+00:00`;
- `entryId` invalido respondio `400`, `code = invalid_entry_id`;
- entry inexistente respondio `404`, `code = entry_not_found`;
- owner local de D'Lirio sin membership respondio `403 User not authorized for event access`;
- sin auth y token invalido respondieron `401`;
- `eventId` invalido respondio `400 Invalid eventId`;
- evento inexistente respondio `404 Event not found`;
- QR endpoint siguio operativo con `200 OK` y `Content-Type = image/png`;
- regresion: `/summary`, `/ticket-types`, `/entries`, `/panel/me` local y `/panel/orders/summary` local respondieron `200 OK`.

No exposicion sensible validada:

- email visible no contiene `checkin_token`;
- email visible no contiene `/events/checkin/<valor-opaco>`;
- email visible no contiene documento, telefono ni metadata;
- response no contiene `checkin_token`, QR payload, base64, `attendee_phone`, buyer PII, `auth_user_id`, `local_id` ni metadata;
- `email.to` aparece en response y queda permitido por contrato.

Fallo de email:

- no se forzo fallo de email en produccion para no tocar configuracion Resend ni provocar falsos errores operativos;
- estado: `N/A` justificado.

Limpieza QA validada:

- se limpio la orden QA del slice;
- despues de la limpieza, `/entries` volvio a `items = []`;
- `pagination.total = 0`;
- `pagination.total_pages = 0`;
- Ibiza quedo nuevamente sin ordenes emitidas.

### Estado Slice 3D.3B - email automatico post manual-issue deployado y QA runtime PASS

Slice 3D.3B queda registrado como implementado, deployado y validado:

- `POST /panel/events/:eventId/orders/manual-issue` ahora incluye `email_delivery`;
- despues de RPC exitosa intenta envio automatico de email QR por cada entry creada;
- usa modo `automatic_best_effort`;
- fallos parciales de email no revierten la emision;
- Mesa VIP con `partial_failed` queda validada como comportamiento esperado;
- limite mayor a 20 entries queda `skipped`;
- `send-email` manual sigue funcionando como fallback operativo;
- QR endpoint sigue funcionando;
- no implementa check-in;
- no toca pagos ni `/payments/callback`.

QA runtime -> `PASS`:

- `/health` respondio `200 OK` con body `{"ok":true}` y `x-request-id` presente;
- estado inicial limpio: `/entries` respondio `200 OK`, `items = []`, `pagination.total = 0`;
- General Preventa 1 respondio `201 Created`, `entries.length = 1`, `email_delivery.mode = automatic_best_effort`, `attempted = 1`, `sent = 1`, `failed = 0`, `skipped = 0`, `status = sent`, `reason = null`, `results.length = 1`, `results[0].status = sent`, `results[0].email_sent_at != null`;
- Email General recibido en Gmail con evento `Ibiza`, entrada `General Preventa 1`, asistente `QA Auto General` y QR visible;
- response General no expuso `checkin_token`, `/events/checkin/`, base64, `attendee_phone`, buyer PII, `auth_user_id`, `local_id` ni metadata;
- Mesa VIP Preventa 1 respondio `201 Created`, `entries.length = 10`, `attempted = 10`, `sent = 7`, `failed = 3`, `skipped = 0`, `status = partial_failed`, `reason = null`, `results.length = 10`;
- las 10 entries de Mesa fueron creadas; 7 enviadas tienen `email_sent_at`; 3 fallidas reportan `error_code = email_send_failed`;
- Gmail recibio 7 correos de Mesa (`QA Mesa Auto 1`, `2`, `3`, `4`, `5`, `9`, `10`) y 1 correo General, 8 correos totales;
- limite mayor a 20: 21 General Preventa 1 respondieron `201 Created`, `entries.length = 21`, `email_delivery.status = skipped`, `reason = too_many_entries_for_sync_email`, `attempted = 0`, `sent = 0`, `failed = 0`, `skipped = 21`, `results = []`;
- `send-email` fallback respondio `200 OK`, `ok = true`, `email.status = sent`, `entry.email_sent_at != null`;
- QR endpoint respondio `200 OK`, `Content-Type = image/png`;
- errores previos siguen correctos: attendees incorrectos `400 invalid_attendees_count`, ticket inexistente `404 ticket_type_not_found`, owner local sin membership `403`, sin auth `401`, token invalido `401`, eventId invalido `400 Invalid eventId`, stock insuficiente `409 insufficient_stock`;
- regresiones: `/summary`, `/ticket-types`, `/entries`, `/panel/me` local y `/panel/orders/summary` local respondieron `200 OK`.

Consistencia y limpieza QA:

- antes de limpieza se generaron 3 ordenes QA: General 1 entry / PYG 140000, Mesa 10 entries / PYG 3200000, Skipped 21 entries / PYG 2940000;
- summary reflejo `orders_count = 3`, `order_items_count = 3`, `entries_count = 32`, `issued_commercial_amount = 6280000`;
- se limpiaron las ordenes QA del slice;
- despues de la limpieza, `/entries` volvio a `items = []`, `pagination.total = 0`, `pagination.total_pages = 0`;
- `/summary` volvio a `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`.

### Estado Slice 3E.2A - RPC check-in QR aplicada y QA DB PASS

Slice 3E.2A queda registrado como implementado, aplicado y validado:

- migracion 030 aplicada;
- RPC `public.check_in_event_entry_by_token(uuid, uuid, text)` creada;
- firma validada: `check_in_event_entry_by_token(uuid,uuid,text)`;
- QA DB PASS completo;
- esta capa valida DB/RPC, no endpoint HTTP;
- endpoint TS queda pendiente para Slice 3E.2B.

QA DB registrado:

- funcion encontrada;
- grants correctos: anon/authenticated sin execute y `service_role` con execute;
- variables QA cargadas para Ibiza, General Preventa 1 y actor owner/staff;
- 4 entries QA creadas dentro de transaccion mediante `issue_event_manual_order`;
- ventana de check-in abierta temporalmente dentro de la transaccion;
- primer scan valido: `ok = true`, `status = valid`, `entry.checkin_status = used`, `entry.used_at != null`;
- mutacion DB validada: `checkin_status = used`, `used_at != null`, `used_by_auth_user_id = actor`;
- segundo scan secuencial: `status = already_used`;
- token UUID inexistente: `status = invalid`, `entry = null`, `attendee = null`;
- token malformado: `ok = false`, `error.code = invalid_input`;
- actor sin membership: `ok = false`, `error.code = forbidden`;
- entry usada + fuera de ventana: `already_used`, confirmando prioridad semantica sobre `outside_window`;
- entry unused + fuera de ventana: `outside_window`, sin mutar la entry;
- entry `voided` + fuera de ventana: `voided`, confirmando prioridad semantica sobre `outside_window`;
- evento no operable: `event_not_operable`, sin datos de entry/attendee;
- responses sin `checkin_token`, `auth_user_id`, `local_id`, metadata, email ni phone;
- rollback validado: `qa_3e2a_orders = 0`;
- Ibiza restaurado con `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Matiz operativo:

- el doble scan validado fue secuencial;
- la proteccion concurrente queda soportada por update condicional atomico;
- Slice 3E.2B debe validar por runtime, si es posible, dos requests rapidos/concurrentes.

### Estado Slice 3E.2B - endpoint check-in QR deployado y QA runtime PASS

Slice 3E.2B queda registrado como implementado, deployado y validado:

- endpoint `PATCH /panel/events/:eventId/checkin/:token` implementado;
- endpoint validado para Ibiza;
- QA runtime PASS completo;
- check-in QR backend de Eventos operativo para owner/staff;
- endpoint TS confirmado como adaptador fino sobre la RPC;
- logica critica de check-in sigue en DB/RPC;
- TypeScript no duplica ventana, status, doble uso ni mutacion de entry.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente;
- token malformado -> `400 invalid_checkin_token`;
- estado inicial limpio: `/entries` -> `items = []`, `pagination.total = 0`;
- Ibiza confirmado antes del QA con `status = draft` y ventana original;
- 4 entries QA creadas via `manual-issue`, inicialmente `issued/unused`, `used_at = null`, `used_by_auth_user_id = null`;
- tokens obtenidos solo por SQL controlado, sin exposicion por API;
- ventana temporal abierta para casos validos;
- owner Ibiza hizo check-in valido: `status = valid`, `entry.checkin_status = used`, `entry.used_at != null`;
- DB confirmo owner `used_by_auth_user_id = 253c667d-e2ab-4705-bd97-8621608ad8cc`;
- segundo scan del mismo token respondio `already_used` y mantuvo `used_at`;
- staff1 Ibiza hizo check-in valido: `status = valid`, `entry.checkin_status = used`;
- DB confirmo staff `used_by_auth_user_id = b26beb62-8263-49eb-a843-2b30683d7312`;
- UUID inexistente respondio `invalid`, `entry = null`, `attendee = null`;
- owner local sin membership `403`;
- sin auth `401`;
- token auth invalido `401`;
- eventId invalido `400`;
- evento inexistente `404`;
- outside window respondio `outside_window` y no muto la entry;
- entry `voided` fuera de ventana respondio `voided`;
- evento no operable respondio `event_not_operable`;
- query override fue bloqueado con `400`; code observado `invalid_checkin_token`;
- body override malicioso fue bloqueado con `400 invalid_checkin_input`;
- regresiones: `/summary`, `/ticket-types`, `/entries`, `/entries/:entryId/qr`, `/panel/me` local y `/panel/orders/summary` local siguieron en `200 OK`.

No exposicion sensible:

- responses sin `checkin_token`, `/events/checkin/`, QR/base64, buyer PII, `auth_user_id`, `local_id` ni metadata.

Limpieza y restauracion:

- ordenes/entries QA limpiadas;
- `/entries` volvio a `items = []`, `pagination.total = 0`;
- `/summary` volvio a cero en orders, items, entries, used, unused, voided e amount;
- Ibiza restaurado con `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Matiz:

- query override devolvio `invalid_checkin_token`; funcionalmente bloquea el request y no muta datos.
- Puede mejorarse a `invalid_checkin_input` en un hardening menor futuro si hace falta.

### Estado Slice 3E.3B - RPC fallback manual QA DB PASS

Slice 3E.3B queda registrado como implementado, aplicado y validado:

- migracion 031 aplicada;
- RPC `public.check_in_event_entry_manually(uuid, uuid, uuid)` creada;
- QA DB PASS;
- fuente de verdad DB/RPC para fallback manual por `event_order_entries.id`;
- endpoint TS implementado y QA runtime PASS en Slice 3E.3C.

QA DB registrado:

- funcion encontrada con firma `check_in_event_entry_manually(uuid,uuid,uuid)`;
- grants correctos: `anon_can_execute = false`, `authenticated_can_execute = false`, `service_role_can_execute = true`;
- todos los checks del script de QA dieron `true`;
- check-in manual valido muto entry a `checkin_status = used`, `used_at != null` y `used_by_auth_user_id = actor`;
- segundo intento respondio `already_used`;
- entry inexistente respondio `entry_not_found`;
- actor sin membership respondio `forbidden`;
- evento inexistente respondio `event_not_found`;
- entry `unused` fuera de ventana respondio `outside_window` sin mutar;
- entry `voided` fuera de ventana respondio `voided`;
- evento no operable respondio `event_not_operable`;
- responses sin `checkin_token`, `auth_user_id`, `local_id`, metadata sensible, email ni phone;
- rollback dejo 0 datos QA persistidos;
- Ibiza restaurado con `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Matiz:

- Este QA valida DB/RPC, no endpoint HTTP.
- TypeScript no debe duplicar logica de ventana, estado, doble uso ni mutacion de entry.
- Slice 3E.3C debe consumir la RPC como adaptador fino.

### Estado Slice 3E.3C - endpoint fallback manual QA runtime PASS

Slice 3E.3C queda registrado como implementado, deployado y validado:

- endpoint `PATCH /panel/events/:eventId/entries/:entryId/use` implementado;
- QA runtime PASS completo;
- fallback manual backend por `event_order_entry.id` operativo para owner/staff;
- endpoint TS actua como adaptador fino sobre `check_in_event_entry_manually`;
- no duplica logica de ventana, estado, mutacion ni concurrencia en TypeScript;
- no usa ni expone `checkin_token`;
- Ibiza quedo sin datos QA persistidos despues de limpieza.

QA runtime registrado:

- owner/staff Ibiza autorizados y owner local bloqueado para evento;
- sin auth y token auth invalido bloqueados;
- `entryId` invalido, entry inexistente, eventId invalido y evento inexistente controlados;
- check-in manual valido con owner y staff;
- DB confirmo `checkin_status = used`, `used_at != null` y actor correcto;
- doble intento respondio `already_used`;
- outside window respondio `outside_window` sin mutar DB;
- entry `voided` respondio `voided`;
- evento no operable respondio `event_not_operable`;
- query/body overrides rechazados con `invalid_manual_checkin_input`;
- responses sin `checkin_token`, QR/base64, email, phone, buyer, auth IDs, `local_id` ni metadata;
- regresiones OK;
- limpieza QA OK;
- Ibiza restaurado con `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Matiz:

- El QA creo entries via `manual-issue` y tambien valido que `email_delivery` automatico siguio funcionando: `attempted = 4`, `sent = 4`, `failed = 0`, `skipped = 0`.
- El foco del slice fue fallback manual.

### Proximo paso recomendado

Proximo paso recomendado:

- avanzar a Slice 3E.4D - ASK/DOCS de integracion de activity en flujos de evento.

Alcance recomendado de Slice 3E.4D:

- definir integracion en `manual-issue`;
- definir integracion en `send-email`;
- definir integracion en email automatico post manual-issue;
- definir integracion en check-in QR;
- definir integracion en fallback manual;
- definir metadata y `source` por accion;
- definir QA runtime por flujo;
- no implementar todavia hasta aprobar el contrato;
- no exponer tokens ni PII sensible;
- no tocar frontend;
- no exponer `checkin_token`;
- no tocar pagos;
- no tocar `/payments/callback`.

## 12. Roadmap tecnico ajustado

### Slice 1A - Documento tecnico

Estado: cerrado.

Se creo este documento y quedaron aprobadas las decisiones de DB, tenant, constraints, indices, stock y contratos futuros.

### Slice 1B - Migracion DB minima

Estado: aplicada en Supabase con QA estructural PASS y QA de comportamiento PASS.

Se crearon `events`, `event_ticket_types`, `event_orders`, `event_order_entries`, `event_panel_users`, constraints, indices, RLS enabled y grants revocados.

### Slice 1B.1 - Actualizacion docs por preventas, paquetes y order items

Estado: cerrado.

Se actualizo Eventos/Ibiza para reflejar:

- General/VIP por fases de preventa;
- Mesas VIP como paquetes de 10 accesos;
- `event_ticket_types` como productos comerciales;
- `event_order_items` como lineas comerciales;
- `event_order_entries` como unidades validables.

### Slice 1B.2 - Migracion 028 para paquetes/order items

Estado: aplicada en Supabase con QA estructural PASS y QA de comportamiento PASS.

Se completo:

- agregar `sales_unit_type` a `event_ticket_types`;
- agregar `entries_per_unit` a `event_ticket_types`;
- crear `event_order_items`;
- vincular `event_order_entries` con `event_order_items`;
- agregar constraints, indices, RLS enabled y grants revocados;
- no insertar Ibiza;
- no crear endpoints;
- no tocar frontend;
- no tocar pagos.

### Slice 1C - Provisioning Ibiza

Estado: aplicado con QA principal PASS e idempotency PASS.

Se creo/aseguro Ibiza, los 9 productos comerciales y usuarios owner/staff mediante `infra/sql/provisioning/ibiza_event_seed.sql`, sin crear entradas, ordenes, order items, QRs, endpoints, frontend ni pagos.

### Slice 2A - eventPanelAuth / rutas protegidas

Estado: implementado, deployado y QA runtime PASS.

Se completo:

- `eventPanelAuth`;
- `requireEventRole`;
- `GET /panel/events/:eventId/me`;
- fix de regex UUID para formato `8-4-4-4-12`;
- validacion de owner/staff Ibiza;
- validacion de usuario local sin acceso a evento;
- regresion de panel local.

### Slice 2B - Endpoints read-only de evento

Estado: implementado, deployado y QA runtime PASS.

Se completo:

- `GET /panel/events/:eventId/summary`;
- `GET /panel/events/:eventId/ticket-types`;
- validacion owner/staff Ibiza;
- bloqueo de usuario local sin membership;
- calculos de catalogo y operaciones;
- no exposicion sensible;
- regresion de panel local.

### Slice 3A - Diseno/contrato de emision manual

Estado: cerrado. Contrato de emision manual aprobado en `docs/events/IBIZA_MANUAL_ISSUE_CONTRACT_PLAN.md`.

Se definio endpoint futuro, input buyer + items + attendees, reglas de precios, creacion de order/items/entries, proteccion de stock, no exposicion de `checkin_token` y no-goals de email QR, check-in, export, activity, frontend y pagos.

### Slice 3B.1 - RPC transaccional issue_event_manual_order

Estado: migracion 029 aplicada y QA DB PASS.

Se completo:

- crear `public.issue_event_manual_order`;
- validar evento, actor, buyer, items, attendees, stock y precios;
- bloquear productos con `FOR UPDATE`;
- crear `event_order`, `event_order_items` y `event_order_entries` en una operacion atomica;
- devolver JSON seguro sin `checkin_token`;
- revocar ejecucion a `anon` y `authenticated`;
- dejar ejecucion solo para `service_role`.

### Slice 3B.2 - Endpoint TS manual issue

Estado: implementado, deployado y QA runtime PASS completo.

Se completo:

- crear `POST /panel/events/:eventId/orders/manual-issue`;
- usar `eventPanelAuth`;
- usar `requireEventRole(["owner", "staff"])`;
- validar input estricto en TS;
- rechazar campos prohibidos;
- llamar a `public.issue_event_manual_order`;
- mapear errores de RPC a HTTP;
- devolver `201` en exito;
- no exponer `checkin_token`;
- no crear logica paralela de stock en TS;
- validar escritura HTTP owner/staff;
- validar errores `401`, `403`, `400`, `404`, `409`;
- limpiar datos QA y dejar Ibiza nuevamente sin ordenes emitidas.

### Slice 3C - Lectura operativa de ordenes/entradas emitidas

Estado: contrato aprobado, endpoint implementado, deployado y QA runtime PASS.

Se completo:

- contrato Slice 3C.1 en `docs/events/IBIZA_EVENT_ENTRIES_READ_CONTRACT_PLAN.md`;
- endpoint `GET /panel/events/:eventId/entries`;
- listado/search de entries emitidas por evento;
- filtros por ticket type, `status` y `checkin_status`;
- paginacion y sort estable;
- proteccion `eventPanelAuth + requireEventRole(["owner", "staff"])`;
- no exposicion de `checkin_token`, `auth_user_id`, `local_id` ni metadata cruda;
- limpieza QA y regresiones PASS.

### Slice 3D.1 - Contrato de QR visual / recurso QR para entries

Estado: cerrado. Contrato QR delivery aprobado en `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`.

Se definio:

- QR visual asociado a `event_order_entry`;
- QR por entry, no por order;
- una mesa/package genera N QRs individuales;
- QR server-side en PNG;
- no exponer `checkin_token` crudo;
- WhatsApp manual como respaldo operativo;
- email QR como slice posterior.

### Slice 3D.2 - QR visual PNG por entry

Estado: implementado, deployado y QA runtime PASS.

Se completo:

- endpoint `GET /panel/events/:eventId/entries/:entryId/qr`;
- validacion `entryId` UUID;
- busqueda por `entry_id + event_id`;
- generacion PNG server-side;
- respuesta `image/png`;
- headers de seguridad/no cache;
- no exposicion de `checkin_token` en JSON/texto;
- no modificacion de datos;
- regresiones y limpieza QA PASS.

### Slice 3D.3A - Send-email QR por entry

Estado: implementado, deployado y QA runtime PASS completo.

Se completo:

- endpoint `POST /panel/events/:eventId/entries/:entryId/send-email`;
- envio/reenvio controlado por owner/staff;
- generacion interna de QR PNG;
- uso de Resend/`sendEmail`;
- actualizacion de `email_sent_at` solo en envio exitoso;
- no exposicion de `checkin_token`, QR payload, base64, `auth_user_id`, `local_id` ni metadata;
- email visible con evento, fecha, lugar, entrada, asistente y QR;
- regresiones y limpieza QA PASS.

### Slice 3D.3B - Email automatico post manual-issue

Estado: implementado, deployado y QA runtime PASS completo.

Se completo:

- `manual-issue` devuelve `email_delivery`;
- email automatico `automatic_best_effort` despues de RPC exitosa;
- General simple validado con `sent`;
- Mesa VIP validada con `partial_failed` sin revertir emision;
- limite mayor a 20 validado con `skipped`;
- fallback `send-email` y QR endpoint siguen funcionando;
- errores previos, regresiones y limpieza QA PASS.

### Slice 3E.1 - Contrato de check-in de Eventos

Estado: documentado y ajustado.

Se definio endpoint futuro de check-in por QR/token opaco, validacion por `event_id`, ventanas de check-in, respuestas operativas, hardening de token en path y fallback manual futuro.

### Slice 3E.2A - RPC SQL check-in QR

Estado: migracion 030 aplicada y QA DB PASS completo.

Se creo `check_in_event_entry_by_token(uuid,uuid,text)` como motor DB/RPC de check-in por token, con membership defensiva, ventana, estados semanticos, update condicional atomico, no exposicion sensible y rollback QA limpio.

### Slice 3E.2B - Endpoint TS check-in QR

Estado: implementado, deployado y QA runtime PASS completo.

Se creo `PATCH /panel/events/:eventId/checkin/:token` como adaptador fino sobre `check_in_event_entry_by_token`, con auth owner/staff, validacion de token/path, respuestas semanticas seguras, no exposicion sensible, regresiones OK y limpieza QA completa.

### Slice 3E.3A - Contrato fallback manual de check-in por entry

Estado: documentado.

Se definio el fallback manual por `event_order_entries.id`, sin `checkin_token`, con RPC SQL como fuente de verdad, sin activity ni distincion durable QR/manual.

### Slice 3E.3B - RPC SQL fallback manual de check-in

Estado: migracion 031 aplicada y QA DB PASS.

Se creo `check_in_event_entry_manually(uuid,uuid,uuid)` como motor DB/RPC de fallback manual por entry, con membership defensiva, ventana, estados semanticos, update condicional atomico, no exposicion sensible, rollback QA limpio e Ibiza restaurado a su estado/ventana original.

### Slice 3E.3C - Endpoint TS fallback manual de check-in por entry

Estado: implementado, deployado y QA runtime PASS completo.

Se creo `PATCH /panel/events/:eventId/entries/:entryId/use` como adaptador fino sobre `check_in_event_entry_manually`, con auth owner/staff, validacion de `entryId`, rechazo de query/body overrides, respuestas semanticas seguras, no exposicion sensible, regresiones OK y limpieza QA completa.

### Slice 3E.4A - Contrato activity log de Eventos

Estado: documentado.

Se definio crear `public.event_activity_events` como tabla separada de `operational_activity_events`, scoped por `event_id`, con `source` como columna propia, sin tokens, QR payloads, `local_id` ni PII sensible.

### Slice 3E.4B - DB event_activity_events

Estado: migracion 032 aplicada y QA DB PASS completo.

Se creo `public.event_activity_events` con FKs event-scoped, RLS enabled, grants cerrados para `anon`/`authenticated`, `service_role` operativo, checks estrictos y rollback QA limpio. El QA detecto que `event_panel_user` con `actor_role = null` era aceptado por semantica SQL de `CHECK`/`NULL`; se corrigio agregando `actor_role is not null` en `event_activity_events_actor_consistency_chk`.

### Slice 3E.4C - Helper TS recordEventActivity

Estado: implementado y validado como helper aislado.

Se creo `functions/api/src/services/eventActivity.ts` con `recordEventActivity(input)`, tipos exportados, validacion interna de `source`, actor panel/system, sanitizacion defensiva de metadata, insert best-effort con Supabase service-role y retorno estable `{ ok: true, id }` / `{ ok: false, error }`.

Queda registrado que no se integro en endpoints: no se toco `panelEvents.ts`, no se importo desde `manual-issue`, `send-email`, email automatico, check-in QR, fallback manual, `/entries`, QR PNG, summary ni ticket-types; tampoco se toco `operationalActivity.ts` ni activity local.

Validaciones: `pnpm -C functions/api typecheck` PASS, `git diff --check` PASS y chequeo adicional de whitespace del archivo nuevo sin warnings.

Matiz: 3E.4C valida el helper a nivel estatico/contrato; la validacion funcional de inserts en operaciones queda para Slice 3E.4D al integrarlo en flujos concretos.

Proximo paso recomendado: Slice 3E.4D - ASK/DOCS de integracion de activity en flujos de evento.

### Slice 3 - Endpoints de lectura/listado de entradas

Lectura de evento, resumen extendido, listado y busqueda de entries scoped por `event_id`.

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
| Mesa sin linea comercial | se pierden metricas de paquetes/mesas | 028 agrega `event_order_items`; QA de provisioning debe verificar items por producto |
| Entry sin item comercial | se pierde trazabilidad entre QR y paquete vendido | 028 agrega FK entry-item; emision debe crear entries con `event_order_item_id` |
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
- constraints de `sales_unit_type` y `entries_per_unit`;
- FK entre `event_order_entries` y `event_order_items`;
- FKs correctas;
- token unico;
- indices creados;
- RLS enabled;
- anon/authenticated sin grants directos;
- evento con ordenes/entries no se borra accidentalmente.

Stock:

- emitir General Preventa 1 individual;
- emitir VIP Preventa 1 individual;
- emitir multiples General/VIP;
- emitir 1 Mesa VIP y generar 10 QRs;
- emitir 2 Mesas VIP y generar 20 QRs;
- impedir superar stock comercial de cada fase;
- impedir superar 20 Mesas VIP comerciales;
- dos operadores concurrentes no superan stock.

Auth:

- owner Ibiza accede;
- staff Ibiza accede;
- owner de otro evento no ve Ibiza;
- owner local no ve Ibiza sin membresia;
- staff no exporta.

Emision:

- crear orden manual;
- crear `event_order_items`;
- crear N entries;
- emision de 4 entradas genera 4 QRs;
- emision de 1 Mesa VIP genera 10 QRs;
- `event_order_items.total_amount = quantity * unit_price_amount`;
- `event_order_entries` generadas respetan `entries_per_unit`;
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
- incluye producto comercial y tipo de acceso sin perder relacion con paquetes.

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

Este documento queda listo para pasar a Slice 3C - lectura operativa de ordenes/entradas emitidas cuando queden registrados:

- campos nuevos en `event_ticket_types`;
- tabla `event_order_items`;
- constraints;
- indices;
- RLS/grants;
- QA estructural PASS;
- QA de comportamiento PASS;
- provisioning Ibiza aplicado;
- QA principal Slice 1C PASS;
- idempotency Slice 1C PASS;
- Slice 2A implementado, deployado y QA runtime PASS;
- `eventPanelAuth` y `requireEventRole` validados;
- `GET /panel/events/:eventId/me` validado;
- tenant safety por `event_id + auth_user_id` validada;
- regresion de panel local validada;
- Slice 2B implementado, deployado y QA runtime PASS;
- `/summary` validado;
- `/ticket-types` validado;
- calculos de catalogo y operaciones validados;
- no exposicion sensible validada;
- Slice 3A contrato de emision manual aprobado;
- Slice 3B.1 migracion 029 aplicada;
- `issue_event_manual_order` creada;
- QA DB Slice 3B.1 PASS;
- permisos de RPC validados;
- rollback/limpieza QA validados;
- Slice 3B.2 endpoint TS manual issue implementado;
- Slice 3B.2 deployado;
- Slice 3B.2 QA runtime PASS completo;
- endpoint manual-issue validado como primera operacion HTTP de escritura para Eventos;
- RPC confirmada como fuente de stock/transaccion;
- limpieza QA Slice 3B.2 validada;
- regresion de panel local validada despues de manual issue;
- Slice 3D.2 QR visual PNG por entry implementado, deployado y QA runtime PASS;
- Slice 3D.3A send-email QR por entry implementado, deployado y QA runtime PASS completo;
- email QR con Resend/`sendEmail` validado para reenvio controlado por owner/staff;
- `email_sent_at` validado como marca de envio exitoso;
- Slice 3D.3B email automatico post manual-issue implementado, deployado y QA runtime PASS completo;
- `email_delivery` validado en `manual-issue`;
- Mesa VIP con `partial_failed` validada como comportamiento esperado;
- limite mayor a 20 entries validado como `skipped`;
- limpieza QA Slice 3D.3B validada;
- tenant model;
- unidad validable;
- estrategia de stock;
- compatibilidad con pagos futuros;
- contratos futuros;
- QA.
