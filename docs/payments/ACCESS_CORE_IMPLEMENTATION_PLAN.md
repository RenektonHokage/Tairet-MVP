# Access Core Implementation Plan

## 1. Estado general

Estado: tracking de implementacion por slices.

El core comun `access_*` queda aprobado como direccion arquitectonica para ventas de acceso, ticketing, QR, stock, pagos y auditoria en Tairet.

Reglas de direccion:

- Bancard Access Core ya tiene PASS staging para flujo aprobado: init checkout, Confirm RPC, callback backend, cierre de orden, consumo de stock, emision idempotente de `access_entries`, helper QR interno, email post-pago, endpoint publico de estado, pantalla B2C de estado post-pago, lookup panel read-only y marcado transaccional de uso local. Siguen pendientes UI panel, B2C route publica del QR, status extendido, reenvio administrativo, query/reconciliacion, rejected end-to-end, validacion final en `tairet.com.py` y panel/manual review.
- `orders` legacy no se usara para pagos reales.
- `event_orders` puede quedar como modelo temporal, piloto o manual para Eventos existentes.
- El nuevo checkout pago debe nacer sobre `access_*`.
- Bancard sera consumidor del core mediante `payment_attempts`, pero el core no depende exclusivamente de Bancard.

## 2. Tabla de slices

| Slice | Alcance | Estado | Migration | Aplicado en Supabase | Runtime/backend/frontend |
| --- | --- | --- | --- | --- | --- |
| 1 | `platform_admin_users`, `access_ticket_types` | PASS | `infra/sql/migrations/033_access_core_slice_1.sql` | Si | No tocado |
| 2 | `access_orders`, `access_order_items`, `access_entries` | PASS | `infra/sql/migrations/034_access_core_slice_2.sql` | Si | No tocado |
| 3 | `access_stock_limits`, `access_stock_reservations` | PASS | `infra/sql/migrations/035_access_core_slice_3.sql` | Si | No tocado |
| 4 | `payment_attempts` | PASS | `infra/sql/migrations/036_access_core_slice_4.sql` | Si | No tocado |
| 5 | RPC `create_access_paid_checkout` | PASS | `infra/sql/migrations/037_access_core_slice_5.sql` | Si | No tocado |
| 6 | SQL support Bancard runtime: `access_checkout_idempotency_keys`, `bancard_shop_process_id_seq`, `next_bancard_shop_process_id()` | PASS | `infra/sql/migrations/038_access_core_slice_6.sql` | Si | No tocado |
| 7 | Endpoint backend `POST /payments/access/bancard/single-buy` | PASS estatico | No aplica | No | Backend implementado; staging approved flow PASS; frontend pendiente |
| 8 | Bancard confirm RPC transaccional | PASS aplicado | `infra/sql/migrations/039_access_core_slice_8.sql` | Si | No backend/frontend |
| 9 | Backend callback Bancard `POST /payments/bancard/confirm` | PASS estatico | No aplica | No | Backend implementado; staging approved callback PASS |
| 9A | Emision idempotente de `access_entries` post-pago | PASS | `infra/sql/migrations/040_access_core_slice_9_issue_entries.sql` | Si | Backend integrado despues de Confirm RPC `approved`; sin email/QR |
| 9B | QR/token interno para entries | PASS | No aplica | No | Helper `accessQr.ts`; sin endpoint publico/status/check-in |
| 9C | Email post-pago | PASS tecnico | No aplica | No | Backend envia bundle con QR por entry; no revierte pago/stock/entries |
| 9E.1 | Check-in Access Core read-only panel local | PASS funcional post-deploy | No aplica | No | Endpoint `GET /panel/access/checkin/:token`; read-only/local-only |
| 9E.2 | Check-in Access Core mark used transaccional local | PASS funcional post-deploy | `infra/sql/migrations/041_access_core_slice_9e_checkin.sql` | Si | Endpoint `POST /panel/access/checkin/:token/use`; panel/local-only |
| 10 | Status extendido/UI panel/B2C route/reenvio post-entries | pending design | Pendiente | No | 9E.3 UI panel, 9E.4 B2C route y reenvio pendientes |
| 11 | API publica de estado por `public_ref` + pantalla B2C status | PASS estatico | No aplica | No | Backend/frontend implementado; dominio final pendiente |
| 12 | Admin/support y manual review | pending | Pendiente | No | No tocado |
| 13 | Reconciliacion/query | pending | Pendiente | No | No tocado |
| 14 | Rollback operativo | pending | Pendiente | No | No tocado |

### 2.1 Estado Bancard Access Core

Estado actualizado despues del PASS staging aprobado:

- Backend init Single Buy `POST /payments/access/bancard/single-buy`: PASS estatico.
- Confirm RPC `public.confirm_bancard_access_payment(...)`: PASS aplicado.
- Backend confirm callback `POST /payments/bancard/confirm`: PASS estatico.
- Staging approved flow init -> callback -> orden paid -> stock consumed: PASS.
- Callback duplicado/idempotencia sobre pago aprobado: PASS.
- API publica `GET /payments/access/status?ref=acc_...`: PASS estatico.
- Pantalla B2C `/#/payments/access/status?ref=acc_...`: PASS estatico.
- Fix tecnico del 404 post-pago mediante HashRouter/status page: PASS.
- Validacion local B2C contra Railway mostrando pago `paid`: PASS.
- Slice 9A `public.issue_access_entries_for_paid_order(...)`: PASS.
- Nuevo pago Bancard aprobado crea `access_entries` automaticamente despues de Confirm RPC `approved`: PASS.
- Callback duplicado no duplica `access_entries`: PASS.
- Slice 9B helper QR/token interno `accessQr.ts`: PASS.
- Slice 9C email post-pago: PASS tecnico.
- Callback duplicado despues de email `sent` no reenvia y devuelve `skipped_already_sent`: PASS.
- Slice 9E.1 check-in read-only panel local `GET /panel/access/checkin/:token`: PASS funcional post-deploy.
- Slice 9E.2 check-in mark used transaccional local `POST /panel/access/checkin/:token/use`: PASS funcional post-deploy.
- Primer POST marca `checkin_status = 'used'`, setea `used_at` y guarda `used_by` como Supabase Auth user id: PASS.
- Segundo POST del mismo token devuelve `already_used` y no cambia `used_at` ni `used_by`: PASS.
- Status extendido/UI panel/B2C route/reenvio administrativo: pendiente.
- Validacion final en `tairet.com.py`: pendiente hasta que el dominio sirva el B2C definitivo.
- Nuevo pago Bancard post-fix para validar redirect completo a `/#/payments/access/status`: pendiente.
- Query/reconciliacion: pendiente.
- Caso rejected end-to-end: pendiente.
- Panel manual review: pendiente.

## 3. Slice 1 - Resultado

Slice 1 creo unicamente:

- `platform_admin_users`;
- `access_ticket_types`.

Slice 1 no creo:

- `access_orders`;
- `access_order_items`;
- `access_entries`;
- `access_stock_limits`;
- `access_stock_reservations`;
- `payment_attempts`;
- `access_activity_events`;
- RPCs;
- endpoints;
- frontend;
- backend runtime;
- seeds.

## 4. Slice 1 - Validacion Supabase

### 4.1 Pre-check

Evidencias registradas antes de aplicar la migracion:

- `locals` existe.
- `events` existe.
- `platform_admin_users` no existia antes.
- `access_ticket_types` no existia antes.
- `service_role` existe.

### 4.2 Aplicacion

Resultado:

- Migracion `033_access_core_slice_1.sql` ejecutada con PASS en Supabase SQL Editor.

### 4.3 Post-check

Evidencias registradas despues de aplicar la migracion:

- `platform_admin_users` existe.
- `access_ticket_types` existe.

### 4.4 Constraints confirmadas

Constraints confirmadas para `access_ticket_types`:

- source type `local | event`;
- source consistency `local_id` / `event_id`;
- FK a `locals` con `ON DELETE RESTRICT`;
- FK a `events` con `ON DELETE RESTRICT`;
- name no vacio;
- `price_gs >= 0`;
- currency `PYG`;
- payment kind `paid | free_pass`;
- `free_pass` exige `price_gs = 0`;
- `paid` exige `price_gs > 0`;
- `entries_per_unit > 0`.

Constraints confirmadas para `platform_admin_users`:

- role `admin | support`;
- email no vacio;
- `auth_user_id` unique.

### 4.5 Indices confirmados

Indices confirmados para `platform_admin_users`:

- unique `lower(trim(email))`;
- `active, role`.

Indices confirmados para `access_ticket_types`:

- local active sort;
- event active sort;
- unique active name por local;
- unique active name por event.

### 4.6 RLS y grants

RLS:

- RLS enabled en `platform_admin_users`.
- RLS enabled en `access_ticket_types`.

Grants:

- `service_role` tiene permisos.
- `anon` no aparece con permisos directos.
- `authenticated` no aparece con permisos directos.

## 5. Decisiones cerradas en Slice 1

Decisiones cerradas:

- `platform_admin_users` no tiene FK a `auth.users`.
- El primer admin Tairet no se seedeara en migracion.
- El primer admin Tairet se cargara luego por operacion segura, manual o provisioning fuera del repo.
- `access_ticket_types` usa `ON DELETE RESTRICT`.
- No se permiten dos ticket types activos con el mismo nombre dentro del mismo local/event.
- Historicos inactivos pueden conservar nombres repetidos.
- Free pass entra al core access.
- Free pass no va a Bancard.
- `payment_attempts` futuro usara `provider_amount_text`, no `bancard_amount`.

## 6. Slice 2 - Resultado

Slice 2 creo unicamente:

- `access_orders`;
- `access_order_items`;
- `access_entries`.

Slice 2 no creo:

- `access_stock_limits`;
- `access_stock_reservations`;
- `payment_attempts`;
- `access_activity_events`;
- RPCs;
- endpoints;
- frontend;
- backend runtime;
- Bancard;
- seeds;
- adapters.

Slice 2 es PASS estructural. No representa checkout funcional todavia.

## 7. Slice 2 - Validacion Supabase

### 7.1 Pre-check

Evidencias registradas antes de aplicar la migracion:

- `locals` existe.
- `events` existe.
- `access_ticket_types` existe.
- `access_orders` no existia antes.
- `access_order_items` no existia antes.
- `access_entries` no existia antes.
- `service_role` existe.

### 7.2 Aplicacion

Resultado:

- Migracion `034_access_core_slice_2.sql` ejecutada con PASS en Supabase SQL Editor.

### 7.3 Post-check

Evidencias registradas despues de aplicar la migracion:

- `access_orders` existe.
- `access_order_items` existe.
- `access_entries` existe.

### 7.4 Constraints confirmadas

Constraints confirmadas:

- `access_orders_public_ref_unique`;
- `access_orders_id_access_date_unique`;
- `access_orders_source_consistency_chk`;
- `access_orders_payment_required_amount_chk`;
- `access_order_items_order_ticket_type_unique`;
- `access_order_items_entry_alignment_unique`;
- `access_order_items_payment_kind_price_chk`;
- `access_order_items_subtotal_gs_chk`;
- `access_entries_order_item_alignment_fk`;
- `access_entries_order_access_date_alignment_fk`;
- `access_entries_checkin_token_unique`;
- `access_entries_order_item_unit_index_unique`;
- `access_entries_checkin_used_at_chk`;
- `access_entries_voided_not_used_chk`;
- `access_entries_voided_at_chk`;
- `access_entries_email_sent_at_chk`.

### 7.5 Indices confirmados

Indices confirmados:

- public_ref;
- buyer_email;
- local/date/status;
- event/date/status;
- status/expires_at;
- order items por order_id;
- order items por access_ticket_type_id;
- entries por checkin_token;
- entries por order_id;
- entries por order_item_id;
- entries por ticket type/date;
- entries por access_date/status/checkin;
- entries por attendee_email.

### 7.6 RLS, grants y policies

RLS:

- RLS enabled en `access_orders`.
- RLS enabled en `access_order_items`.
- RLS enabled en `access_entries`.

Grants:

- `service_role` tiene permisos.
- `anon` no aparece con permisos directos.
- `authenticated` no aparece con permisos directos.

Policies:

- `pg_policies` no devolvio rows para estas tablas.
- Esto es esperado en este slice porque las tablas quedan cerradas y seran operadas por backend/service role.

## 8. Decisiones cerradas en Slice 2

Decisiones cerradas:

- `access_orders` tendra `payment_required boolean not null default true`.
- `payment_required = true` representa ordenes que requieren pago.
- `payment_required = false` representa free pass o accesos sin Bancard.
- Free pass puro usa `amount_gs = 0`.
- Free pass puro puede quedar `status = 'paid'` como acceso confirmado sin pago monetario.
- `access_order_items` tendra snapshot `payment_kind text not null`.
- `payment_kind in ('paid', 'free_pass')`.
- `payment_kind = 'free_pass'` exige `unit_price_gs = 0`.
- `payment_kind = 'paid'` exige `unit_price_gs > 0`.
- `access_entries` tendra campos `attendee_name`, `attendee_last_name`, `attendee_email`, `attendee_phone` y `attendee_document`.
- Si la UI inicial no recolecta datos por entry, la emision puede copiar los datos del comprador.
- `public_ref` usara formato recomendado `acc_` + `encode(gen_random_bytes(16), 'hex')`.
- `public_ref` debe ser no adivinable, apto para URL, no derivado de `id` y unico.
- Slice 2 no incluye `refunded` en el CHECK inicial de `access_orders.status`.
- `access_order_items` debe agregar items repetidos por `access_ticket_type_id`.
- Se recomienda unique `(order_id, access_ticket_type_id)`.

## 9. Slice 3 - Resultado

Slice 3 creo unicamente:

- `access_stock_limits`;
- `access_stock_reservations`.

Slice 3 tambien agrego support unique constraints en:

- `access_ticket_types(id, local_id)`;
- `access_ticket_types(id, event_id)`;
- `access_orders(id, local_id)`;
- `access_orders(id, event_id)`;
- `access_order_items(id, quantity)`.

Slice 3 no creo:

- `payment_attempts`;
- `access_activity_events`;
- RPCs;
- endpoints;
- backend runtime;
- frontend;
- Bancard;
- callback;
- reconciliation jobs;
- rollback;
- seeds;
- adapters.

Slice 3 es PASS estructural. Todavia no representa checkout funcional.

## 10. Slice 3 - Validacion Supabase

### 10.1 Pre-check

Evidencias registradas antes de aplicar la migracion:

- tablas base Slice 1 y Slice 2 existian;
- `access_stock_limits` no existia antes;
- `access_stock_reservations` no existia antes;
- `service_role` existia;
- support constraints no existian antes o eran idempotentes.

### 10.2 Aplicacion

Resultado:

- Migracion `035_access_core_slice_3.sql` ejecutada con PASS en Supabase SQL Editor.

### 10.3 Post-check

Evidencias registradas despues de aplicar la migracion:

- `access_stock_limits` existe.
- `access_stock_reservations` existe.

### 10.4 Constraints confirmadas

Constraints confirmadas:

- `access_ticket_types_id_local_id_unique`;
- `access_ticket_types_id_event_id_unique`;
- `access_orders_id_local_id_unique`;
- `access_orders_id_event_id_unique`;
- `access_order_items_id_quantity_unique`;
- `access_stock_limits_ticket_type_date_unique`;
- `access_stock_limits_ticket_type_local_alignment_fk`;
- `access_stock_limits_ticket_type_event_alignment_fk`;
- `access_stock_limits_source_consistency_chk`;
- `access_stock_limits_stock_mode_chk`;
- `access_stock_limits_capacity_chk`;
- `access_stock_reservations_order_item_unique`;
- `access_stock_reservations_order_item_alignment_fk`;
- `access_stock_reservations_order_access_date_alignment_fk`;
- `access_stock_reservations_order_local_alignment_fk`;
- `access_stock_reservations_order_event_alignment_fk`;
- `access_stock_reservations_ticket_type_local_alignment_fk`;
- `access_stock_reservations_ticket_type_event_alignment_fk`;
- `access_stock_reservations_stock_limit_alignment_fk`;
- `access_stock_reservations_order_item_quantity_fk`;
- `access_stock_reservations_source_consistency_chk`;
- `access_stock_reservations_quantity_positive_chk`;
- `access_stock_reservations_status_chk`;
- `access_stock_reservations_released_at_chk`;
- `access_stock_reservations_expires_at_chk`.

### 10.5 Indices confirmados

Indices confirmados:

- stock limits por ticket/date;
- stock limits por local/date;
- stock limits por event/date;
- reservations por ticket/date/status/expires;
- reservations por order_id;
- reservations por order_item_id unique;
- reservations por status/expires_at;
- reservations por local/date/status;
- reservations por event/date/status.

### 10.6 RLS, grants y policies

RLS:

- RLS enabled en `access_stock_limits`.
- RLS enabled en `access_stock_reservations`.

Grants:

- `service_role` tiene permisos.
- `anon` no aparece con permisos directos.
- `authenticated` no aparece con permisos directos.

Policies:

- `pg_policies` no devolvio rows para estas tablas.
- Esto es esperado porque las tablas quedan cerradas y seran operadas por backend/service role.

## 11. Decisiones cerradas en Slice 3

Decisiones cerradas:

- `access_stock_limits.capacity` mide unidades comerciales vendibles del `access_ticket_type`.
- `access_stock_reservations.quantity` mide unidades comerciales reservadas.
- Stock no cuenta entries/personas.
- `entries_per_unit` no multiplica stock; solo afecta la emision posterior de `access_entries`.
- Aforo/personas queda como concepto futuro separado si hace falta.
- Ausencia de `access_stock_limits` significa `stock_unconfigured` o no vendible.
- `stock_mode = 'unlimited'` debe existir explicitamente.
- `stock_mode = 'limited'` con `capacity = 0` significa cupo cero.
- Hay una reservation por `order_item_id`.
- Reservation debe apuntar a un stock limit existente por `(access_ticket_type_id, access_date)`.
- Reservation quantity debe coincidir con `access_order_items.quantity`.
- `manual_hold` bloquea disponibilidad.
- `consumed` bloquea disponibilidad como stock confirmado.
- `reserved` bloquea solo si `expires_at > now()`.
- `released` y `expired` no bloquean disponibilidad.
- `released_at` representa el momento en que la reserva dejo de bloquear stock, incluso si el motivo fue expiracion.

## 12. Slice 4 - Resultado

Slice 4 creo unicamente:

- `payment_attempts`.

Slice 4 tambien agrego support unique constraint en:

- `access_orders(id, amount_gs, currency)`.

Slice 4 no creo:

- Bancard runtime;
- iframe;
- endpoints;
- callback;
- query/reconciliacion;
- rollback;
- RPCs;
- `access_activity_events`;
- `payment_events`;
- backend runtime;
- frontend;
- seeds;
- adapters.

Slice 4 es PASS estructural. Todavia no representa integracion Bancard funcional.

## 13. Slice 4 - Validacion Supabase

### 13.1 Pre-check

Evidencias registradas antes de aplicar la migracion:

- `access_orders` existia.
- `payment_attempts` no existia antes.
- `service_role` existia.
- support constraint `access_orders_id_amount_currency_unique` no existia antes o era idempotente.

### 13.2 Aplicacion

Resultado:

- Migracion `036_access_core_slice_4.sql` ejecutada con PASS en Supabase SQL Editor.

### 13.3 Post-check

Evidencias registradas despues de aplicar la migracion:

- `payment_attempts` existe.

### 13.4 Constraints confirmadas

Constraints confirmadas:

- `access_orders_id_amount_currency_unique`;
- `payment_attempts_order_attempt_number_unique`;
- `payment_attempts_order_access_date_alignment_fk`;
- `payment_attempts_order_local_alignment_fk`;
- `payment_attempts_order_event_alignment_fk`;
- `payment_attempts_order_amount_currency_alignment_fk`;
- `payment_attempts_source_consistency_chk`;
- `payment_attempts_attempt_number_positive_chk`;
- `payment_attempts_provider_non_empty_chk`;
- `payment_attempts_provider_operation_non_empty_chk`;
- `payment_attempts_provider_attempt_ref_non_empty_chk`;
- `payment_attempts_provider_transaction_id_non_empty_chk`;
- `payment_attempts_provider_status_non_empty_chk`;
- `payment_attempts_provider_response_code_non_empty_chk`;
- `payment_attempts_amount_gs_positive_chk`;
- `payment_attempts_currency_chk`;
- `payment_attempts_provider_amount_text_non_empty_chk`;
- `payment_attempts_status_chk`;
- `payment_attempts_expires_at_chk`.

### 13.5 Indices confirmados

Indices confirmados:

- `payment_attempts_order_attempt_number_unique`;
- `idx_payment_attempts_provider_attempt_ref_unique`;
- `idx_payment_attempts_provider_transaction_unique`;
- `idx_payment_attempts_blocking_provider_operation_unique`;
- `idx_payment_attempts_order_id`;
- `idx_payment_attempts_provider_operation_status`;
- `idx_payment_attempts_status_expires_at`;
- `idx_payment_attempts_created_at_desc`;
- `idx_payment_attempts_local_access_date_status`;
- `idx_payment_attempts_event_access_date_status`.

### 13.6 RLS, grants y policies

RLS:

- RLS enabled en `payment_attempts`.

Grants:

- `service_role` tiene permisos.
- `anon` no aparece con permisos directos.
- `authenticated` no aparece con permisos directos.

Policies:

- `pg_policies` no devolvio rows para `payment_attempts`.
- Esto es esperado porque la tabla queda cerrada y sera operada por backend/service role.

## 14. Decisiones cerradas en Slice 4

Decisiones cerradas:

- `payment_attempts` es tabla generica de intentos de pago.
- No tiene prefijo `access_` porque puede servir para distintos flows/proveedores.
- Referencia `access_orders`, no `access_stock_reservations`.
- La relacion con reservations se resuelve por `order_id`.
- Una orden puede tener multiples attempts historicos.
- Se evita mas de un attempt bloqueante por `order_id + provider + provider_operation`.
- Estados bloqueantes: `created`, `provider_ready`, `pending_confirmation`, `approved`, `manual_review`.
- Estados que permiten retry posterior: `rejected`, `cancelled`, `expired`, `technical_error`.
- `manual_review` representa ambiguedad y no debe liberar stock automaticamente.
- `approved` tambien bloquea nuevos attempts del mismo provider/operation para evitar doble cobro.
- `amount_gs` es monto interno en bigint.
- `amount_gs > 0`, por lo tanto free pass no crea payment attempt.
- `currency = 'PYG'`.
- `provider_amount_text` guarda la representacion enviada/recibida por el provider.
- No usar `bancard_amount`.
- Bancard usara `provider = 'bancard'` cuando se implemente runtime.
- Bancard `shop_process_id` puede mapearse a `provider_attempt_ref`.
- `provider_transaction_id` queda para transaction/reference del provider cuando exista.
- `request_payload`, `response_payload`, `callback_payload` son payloads tecnicos y deben quedar cerrados por RLS/service_role.
- `return_url` no confirma pago.
- Callback/query/reconciliacion quedan para slices posteriores.
- `expires_at`, si existe, debe ser posterior a `created_at`.

## 15. Slice 5 - Resultado

Slice 5 creo unicamente:

- RPC `public.create_access_paid_checkout`.

La RPC crea atomicamente:

- `access_orders`;
- `access_order_items`;
- `access_stock_reservations`;
- `payment_attempts` inicial.

La RPC:

- usa `FOR UPDATE` sobre `access_stock_limits`;
- valida stock explicito;
- rechaza `free_pass`;
- no genera `provider_attempt_ref`;
- no llama a Bancard;
- no emite `access_entries`.

Slice 5 no creo:

- Bancard runtime;
- iframe;
- endpoints;
- callback;
- query/reconciliacion;
- `access_entries`;
- QR;
- email;
- rollback;
- backend runtime;
- frontend;
- adapters;
- seeds;
- `access_activity_events`;
- `payment_events`;
- nuevas tablas.

Slice 5 es PASS estructural. Todavia no representa integracion Bancard funcional.

## 16. Slice 5 - Validacion Supabase

### 16.1 Pre-check

Evidencias registradas antes de aplicar la migracion:

- funcion `create_access_paid_checkout` no existia antes o era reemplazable.
- columnas minimas usadas por la RPC existian.
- prechecks pasaron con resultado esperado.

### 16.2 Aplicacion

Resultado:

- Migracion `037_access_core_slice_5.sql` ejecutada con PASS en Supabase SQL Editor.

### 16.3 Post-check

Evidencias registradas despues de aplicar la migracion:

- funcion registrada con firma `create_access_paid_checkout(text,uuid,uuid,date,jsonb,jsonb,text,text,integer)`.
- `security_definer = true`.
- routine registrada como `FUNCTION` en schema `public`.

Grants:

- `postgres` tiene `EXECUTE`.
- `service_role` tiene `EXECUTE`.
- `anon` no aparece con `EXECUTE`.
- `authenticated` no aparece con `EXECUTE`.

## 17. Decisiones cerradas en Slice 5

Decisiones cerradas:

- Slice 5 es paid checkout only.
- La RPC soporta multi-item desde el inicio.
- La orden se crea con `payment_required = true`.
- La orden inicia `status = 'pending_payment'`.
- Cada reserva inicia `status = 'reserved'`.
- El payment attempt inicial inicia `status = 'created'` y `attempt_number = 1`.
- Free pass queda fuera de Slice 5 y requiere una operacion separada.
- No se mezcla paid y free pass en una misma orden.
- `provider_attempt_ref` queda null en Slice 5.
- Bancard `shop_process_id` queda para el slice de Bancard runtime.
- `provider_amount_text` se calcula internamente desde `amount_gs`.
- La RPC ignora reservas vencidas con `expires_at <= now()` al calcular disponibilidad.
- La RPC no actualiza reservas vencidas a `expired`.
- Stock limited calcula disponibilidad como `capacity - consumed - manual_hold - reserved vigente`.
- No cuenta `access_entries` para disponibilidad.
- No cuenta reservas `released`.
- No cuenta reservas `expired`.
- Antes de exponer checkout publico, el endpoint/backend debe agregar limite maximo de `quantity`.
- Antes de exponer checkout publico, el endpoint/backend debe implementar idempotency key para evitar ordenes duplicadas por retry/timeout del cliente.

## 18. Slice 6 - Resultado

Slice 6 es PASS estructural.

La migracion `infra/sql/migrations/038_access_core_slice_6.sql` creo:

- `access_checkout_idempotency_keys`;
- `bancard_shop_process_id_seq`;
- funcion `public.next_bancard_shop_process_id()`.

Tambien agrego el support unique:

- `payment_attempts_id_order_id_unique` sobre `payment_attempts(id, order_id)`.

Slice 6 no creo:

- endpoint backend;
- llamada HTTP a Bancard;
- callback;
- query/reconciliacion;
- emision de `access_entries`;
- QR;
- email;
- frontend;
- adapters legacy;
- seeds;
- runtime Bancard.

Nota de alcance:

- Slice 6 es PASS estructural.
- Slice 6 no representa integracion funcional con Bancard todavia.
- Todavia no existe endpoint runtime ni llamada HTTP a Bancard.

## 19. Slice 6 - Validacion Supabase

Pre-check:

- `payment_attempts` existia.
- `access_checkout_idempotency_keys` no existia.
- `bancard_shop_process_id_seq` no existia.
- `next_bancard_shop_process_id()` no existia.
- `payment_attempts_id_order_id_unique` no existia o era idempotente.

Aplicacion:

- migration `038_access_core_slice_6.sql` ejecutada con exito en Supabase SQL Editor.

Post-check:

- `access_checkout_idempotency_keys` existe.
- `bancard_shop_process_id_seq` existe.
- `public.next_bancard_shop_process_id()` existe.
- `public.next_bancard_shop_process_id()` esta creada como `security definer`.

Constraints confirmadas:

- `payment_attempts_id_order_id_unique`
- `access_checkout_idempotency_provider_operation_key_unique`
- `access_checkout_idempotency_payment_attempt_order_fk`
- `access_checkout_idempotency_provider_length_chk`
- `access_checkout_idempotency_provider_normalized_chk`
- `access_checkout_idempotency_provider_operation_length_chk`
- `access_checkout_idempotency_provider_operation_normalized_chk`
- `access_checkout_idempotency_key_length_chk`
- `access_checkout_idempotency_key_trimmed_chk`
- `access_checkout_idempotency_request_hash_chk`
- `access_checkout_idempotency_status_chk`
- `access_checkout_idempotency_expires_at_chk`
- `access_checkout_idempotency_locked_until_chk`
- `access_checkout_idempotency_processing_lock_chk`
- `access_checkout_idempotency_completed_at_chk`
- `access_checkout_idempotency_failed_at_chk`
- `access_checkout_idempotency_last_error_length_chk`
- `access_checkout_idempotency_order_attempt_pair_chk`

Indices confirmados:

- unique provider/operation/idempotency key por constraint;
- `idx_access_checkout_idempotency_status_locked_until`;
- `idx_access_checkout_idempotency_expires_at`;
- `idx_access_checkout_idempotency_order_id`;
- `idx_access_checkout_idempotency_payment_attempt_id`;
- `idx_access_checkout_idempotency_created_at_desc`.

RLS, policies y grants:

- RLS enabled en `access_checkout_idempotency_keys`.
- `pg_policies` no devolvio rows para `access_checkout_idempotency_keys`.
- Esto es esperado: la tabla queda cerrada y operada por backend/service role.
- `postgres` y `service_role` tienen permisos sobre la tabla.
- `anon` y `authenticated` no aparecen con permisos directos sobre la tabla.

Sequence:

- `bancard_shop_process_id_seq` existe.
- Tipo `bigint`.
- `minvalue = 1`.
- `maxvalue = 999999999`.
- `increment = 1`.
- `no cycle`.
- `cache = 1`.
- `service_role` tiene `USAGE` y `SELECT`.
- `anon` y `authenticated` no tienen `USAGE`.

Function:

- `public.next_bancard_shop_process_id()` existe.
- La funcion es `security definer`.
- `postgres` y `service_role` tienen `EXECUTE`.
- `anon` y `authenticated` no tienen `EXECUTE`.

## 20. Decisiones cerradas en Slice 6

Decisiones cerradas:

- `access_checkout_idempotency_keys` guarda idempotency publica de checkout Access Core.
- La unicidad logica es `(provider, provider_operation, idempotency_key)`.
- `request_hash` es SHA-256 lowercase hex.
- `provider` y `provider_operation` deben estar lowercase y sin espacios externos.
- `idempotency_key` debe estar trimmed, sin forzar lowercase.
- Estados de idempotency: `processing`, `succeeded`, `failed`, `manual_review`, `expired`.
- `processing` requiere `locked_until`.
- `order_id` y `payment_attempt_id` deben ser ambos null o ambos non-null.
- La FK compuesta valida que `payment_attempt_id` pertenezca al mismo `order_id`.
- `response_payload` y `error_payload` deben guardarse sanitizados.
- No se guardan secrets, token Bancard, datos de tarjeta ni headers completos.
- `bancard_shop_process_id_seq` es una sequence global simple.
- La sequence usa rango `1..999999999`, `no cycle`, `cache 1`.
- `next_bancard_shop_process_id()` devuelve texto numerico de 15 digitos.
- El formato inicial es `YYMMDD` + sequence left-padded a 9 digitos.
- El execute de la funcion queda solo para `service_role`.
- La longitud/tipo exacto aceptado por Bancard debe confirmarse en staging.

## 21. Bancard Single Buy endpoint - PASS estatico

Estado documental:

- PASS estatico;
- SQL support aplicado como PASS estructural en Slice 6;
- endpoint backend implementado;
- SQL nuevo: No;
- frontend no tocado;
- callback backend implementado como PASS estatico;
- entries post-pago cubiertas por Slice 9A;
- QR interno y email post-pago cubiertos por Slice 9B y Slice 9C;
- staging Bancard approved flow PASS.

Endpoint implementado:

- `POST /payments/access/bancard/single-buy`.

Scope del endpoint:

- endpoint especifico Bancard;
- internamente usa `provider = 'bancard'`;
- internamente usa `provider_operation = 'single_buy'`;
- valida body con schema estricto;
- aplica quantity limits;
- usa `access_checkout_idempotency_keys`;
- calcula `request_hash` SHA-256 sobre payload normalizado;
- llama RPC `public.create_access_paid_checkout`;
- llama RPC `public.next_bancard_shop_process_id()`;
- guarda `shop_process_id` en `payment_attempts.provider_attempt_ref`;
- arma payload Bancard `single_buy`;
- llama Bancard Single Buy;
- guarda `request_payload` y `response_payload` sanitizados;
- devuelve datos minimos para iframe.

Fuera de alcance:

- callback;
- query/reconciliacion;
- emision de `access_entries`;
- status extendido;
- check-in;
- reenvio administrativo;
- frontend final;
- panel manual review;
- rollback operativo;
- free pass;
- adapters legacy;
- seeds.

SQL support disponible antes del endpoint:

- tabla `access_checkout_idempotency_keys`;
- sequence `bancard_shop_process_id_seq`;
- funcion `public.next_bancard_shop_process_id()`;
- RLS enabled;
- grants/revokes cerrados;
- sin policies publicas.

Tabla `access_checkout_idempotency_keys`:

- `id`;
- `provider`;
- `provider_operation`;
- `idempotency_key`;
- `request_hash`;
- `status`;
- `order_id`;
- `payment_attempt_id`;
- `response_payload`;
- `error_payload`;
- `last_error`;
- `locked_until`;
- `expires_at`;
- `completed_at`;
- `failed_at`;
- `created_at`;
- `updated_at`.

Unique requerido:

- `(provider, provider_operation, idempotency_key)`.

Reglas de idempotency:

- misma key + mismo hash + success devuelve respuesta guardada;
- misma key + mismo hash + error terminal devuelve error guardado si corresponde;
- misma key + hash distinto devuelve `409 idempotency_conflict`;
- key en proceso y `locked_until > now()` devuelve `409 checkout_in_progress`;
- key vencida o lock vencido requiere regla explicita en backend.

Quantity limits antes de llamar la RPC:

- maximo `10` por item;
- maximo `20` unidades comerciales totales por checkout;
- maximo `10` ticket types distintos;
- error normalizado `quantity_limit_exceeded`.

`shop_process_id`:

- se guarda en `payment_attempts.provider_attempt_ref`;
- se genera con `public.next_bancard_shop_process_id()`;
- la funcion usa sequence global simple `bancard_shop_process_id_seq`;
- la sequence usa rango `1..999999999`, `no cycle`, `cache 1`;
- formato inicial: `YYMMDD` + sequence left-padded a 9 digitos;
- ejemplo: `260616000000001`;
- la funcion devuelve texto numerico de 15 digitos;
- el execute queda solo para `service_role`;
- debe ser numerico y compatible con Bancard;
- antes de produccion se debe confirmar en staging longitud/tipo exacto aceptado;
- ante colision, reintentar apoyandose en el unique parcial existente de `payment_attempts(provider, provider_operation, provider_attempt_ref)`.

Flujo runtime:

1. Validar config/env.
2. Validar body.
3. Validar idempotency.
4. Validar quantity limits.
5. Llamar RPC `create_access_paid_checkout`.
6. Si la RPC devuelve `ok:false`, no llamar Bancard.
7. Generar `shop_process_id`.
8. Actualizar `payment_attempts.provider_attempt_ref`.
9. Guardar `request_payload` sanitizado antes de llamar Bancard.
10. Calcular token `md5(private_key + shop_process_id + amount + currency)`.
11. Llamar `POST {BANCARD_BASE_URL}/vpos/api/0.3/single_buy`.
12. Guardar `response_payload` sanitizado.
13. Si respuesta contiene `status = success` y `process_id`, pasar attempt a `provider_ready`.
14. Devolver datos minimos para iframe.

### 21.1 Staging approved flow - PASS

Validacion staging aprobada para Access Core Bancard:

- Datos manuales Access Core usados: local `Boliche` / `dlirio`, `source_type = 'local'`, ticket pago `Entrada Staging Bancard`, `price_gs = 10000`, `access_date = 2026-08-01`, stock limitado con capacidad `5`.
- Init staging creo `access_orders.status = 'pending_payment'`, un `access_order_items`, una reserva `access_stock_reservations.status = 'reserved'` y un `payment_attempts.status = 'provider_ready'`.
- Bancard aprobo la operacion staging con `response_code = '00'`.
- El callback llego a `POST /payments/bancard/confirm`.
- Backend valido el callback, sanitizo payload y llamo `public.confirm_bancard_access_payment(...)`.
- La RPC cerro `payment_attempts.status = 'approved'`, `access_orders.status = 'paid'` y `access_stock_reservations.status = 'consumed'`.
- Slice 9A posterior emitio `access_entries` idempotentes para pagos aprobados.
- El callback duplicado del mismo pago respondio HTTP 200 `{ "status": "success" }`, registro `idempotent = true` y mantuvo estables pago, orden y stock sin abrir `manual_review`.
- No se documentan tokens, tarjetas, CVV, vencimientos, claves Bancard ni payload completo del callback.

### 21.2 Fix post-pago status - PASS estatico

Se corrigio el 404 post-pago / retorno usuario con:

- endpoint publico `GET /payments/access/status?ref=acc_...`;
- pantalla B2C `/#/payments/access/status?ref=acc_...`;
- `return_url` Bancard compatible con HashRouter: `${B2C_BASE_URL}/#/payments/access/status?ref=${public_ref}`;
- `cancel_url` Bancard compatible con HashRouter: `${B2C_BASE_URL}/#/payments/access/status?ref=${public_ref}&cancelled=1`.

Validacion local contra Railway:

- la pantalla mostro `Pago confirmado.`;
- datos visibles: lugar `Boliche`, fecha `01 de agosto de 2026`, monto `Gs. 10.000`;
- API Railway respondio `ok: true`;
- `order.status = 'paid'`;
- `venue_name = 'Boliche'`;
- `amount_gs = 10000`;
- `currency = 'PYG'`.

La respuesta publica no expone:

- `order_id`;
- `payment_attempt_id`;
- `local_id`;
- `event_id`;
- buyer data;
- payloads Bancard;
- token;
- datos internos.

Alcance:

- el callback server-to-server sigue siendo la fuente de verdad del pago;
- `return_url` y `cancel_url` son UX;
- el frontend no aprueba pagos;
- si backend devuelve `paid`, la pantalla muestra pago confirmado;
- si backend devuelve `pending_payment`, la pantalla muestra verificacion y puede hacer polling;
- si `pending_payment` esta vencido, el endpoint puede devolver `expired` sin mutar DB;
- este bloque no genera `access_entries`, QR ni email.

Pendientes post-fix:

- validacion final en `tairet.com.py` cuando el dominio sirva el B2C definitivo y no la landing temporal;
- nuevo pago Bancard post-fix para validar redirect completo desde Bancard hacia `/#/payments/access/status`.

Payload Bancard implementado:

- enviar `public_key`;
- enviar `operation.token`;
- enviar `operation.shop_process_id`;
- enviar `operation.amount`;
- enviar `operation.currency`;
- enviar `operation.description`;
- enviar `operation.return_url`;
- enviar `operation.cancel_url`.

No enviar:

- private key;
- token al frontend;
- datos de tarjeta;
- datos sensibles;
- `additional_data`;
- `extra_response_attributes`;
- `confirmation_url` dentro del payload `single_buy`.

Env/config implementado:

- `BANCARD_PUBLIC_KEY`;
- `BANCARD_PRIVATE_KEY`;
- `BANCARD_ENVIRONMENT`;
- `BANCARD_BASE_URL`;
- `B2C_BASE_URL`;
- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE`;
- `BANCARD_CONFIRM_URL` queda para configuracion/callback futuro, no como payload de `single_buy`.

Transiciones de `payment_attempts`:

- `created -> provider_ready` si Bancard devuelve `status = success` y `process_id`;
- `created -> technical_error` si falla antes de enviar request o hay error local/config;
- `created -> manual_review` si hay timeout o ambiguedad despues de enviar request;
- `rejected` solo si Bancard confirma rechazo definitivo de operacion inicial.

Validacion estatica del endpoint:

- `git diff --check`: PASS;
- `pnpm -C functions/api typecheck`: PASS;
- lint no aplicable por falta de config ESLint en `functions/api`;
- revision estatica: PASS;
- High original de idempotency resuelto: no se devuelve iframe si `succeeded` no queda cerrado;
- falla pre-Bancard de `assignShopProcessId` resuelta con respuesta conservadora;
- no token/private key en logs, payloads persistidos ni response publica;
- no `order_id` ni `payment_attempt_id` en response publica;
- no `confirmation_url`, `additional_data` ni `extra_response_attributes`;
- no reutiliza `/payments/callback` legacy;
- no usa `payment_events` en el flujo Access Core.

### 21.3 Nota operativa CORS/env

El API usa allowlist por `FRONTEND_ORIGIN`.

Reglas:

- el valor debe ser una lista de origins separados por coma;
- no debe incluir `FRONTEND_ORIGIN=` dentro del valor;
- origins productivos requeridos: `https://tairet.com.py` y `https://www.tairet.com.py` si aplica;
- origins locales solo para debug: `http://localhost:5173` y `http://127.0.0.1:5173` si se usa ese host.

Hallazgo validado:

- el 403 local fue de CORS/env;
- no fue un problema de Bancard;
- no fue un problema del endpoint publico de estado.

Stock ante falla:

- si RPC falla, no hay orden/reserva/attempt;
- si falla antes de llamar Bancard, no debe quedar provider iniciado;
- si falla despues de llamar Bancard o hay timeout, pasar a `manual_review` y retener stock con `manual_hold` si el CODE lo soporta;
- no liberar stock automaticamente en estados ambiguos.

Callback separado:

- RPC SQL de cierre transaccional aplicada en Slice 8;
- endpoint backend posterior: `POST /payments/bancard/confirm`;
- no reutilizar `/payments/callback` legacy;
- confirmar por `shop_process_id`;
- validar monto, moneda, status y token;
- no emitir entradas en caso de mismatch;
- mover inconsistencias a `manual_review`.

Riesgos especificos:

- retry sin idempotency;
- doble orden;
- doble iframe;
- Bancard responde pero DB update falla;
- callback llega antes de guardar `provider_attempt_ref`;
- stock bloqueado por fallas;
- liberar stock ambiguo;
- token/secret guardado en payload;
- `shop_process_id` colisiona;
- `return_url` usado como confirmacion.

## 22. Slice 8 - Bancard confirm RPC transaccional - PASS aplicado

Estado:

- PASS aplicado;
- migration `infra/sql/migrations/039_access_core_slice_8.sql`;
- funcion `public.confirm_bancard_access_payment(...)`;
- backend callback implementado como PASS estatico;
- no frontend;
- no entries/QR/email;
- no `payment_events`.

Responsabilidad:

- cerrar transaccionalmente callbacks Bancard ya validados por backend;
- actualizar `payment_attempts`;
- actualizar `access_orders`;
- actualizar `access_stock_reservations`;
- manejar `approved`, `rejected`, `manual_review` e idempotencia terminal;
- devolver JSON normalizado para el backend futuro.

Fuera de alcance:

- endpoint backend;
- validacion token/private key;
- emision de `access_entries`;
- QR;
- email;
- frontend;
- query/reconciliacion;
- panel manual review.

Validaciones de la RPC:

- lookup por `provider = 'bancard'`, `provider_operation = 'single_buy'` y `provider_attempt_ref = shop_process_id`;
- `amount` coincide con `payment_attempts.provider_amount_text`;
- `amount` coincide con `payment_attempts.amount_gs::text || '.00'`;
- `currency` coincide con `payment_attempts.currency`;
- approved solo con `response_code = '00'`;
- rejected con `response_code <> '00'`;
- stock consumible solo si esta en `manual_hold` o `reserved` vigente;
- `reserved` vencido pasa a `manual_review`;
- no consume stock ya `consumed`;
- no libera stock ya `consumed`;
- callbacks duplicados `approved`/`rejected` son idempotentes solo si order y stock estan consistentes.

Post-checks aplicados en Supabase:

- funcion existe;
- `security_definer = true`;
- `search_path = public, pg_temp`;
- `service_role_execute = true`;
- `anon_execute = false`;
- `authenticated_execute = false`;
- smoke test `shop_process_id` vacio: `invalid_request`;
- smoke test `shop_process_id` inexistente: `payment_attempt_not_found`;
- routine privileges: solo `postgres` y `service_role` con EXECUTE.

La RPC no conoce private key, no calcula token, no valida firma Bancard y no emite entries/QR/email. El backend `POST /payments/bancard/confirm` valida token con `BANCARD_PRIVATE_KEY`, sanitiza payload y llama esta RPC.

## 23. Backend Bancard Confirm callback - PASS estatico

Estado:

- PASS estatico;
- endpoint `POST /payments/bancard/confirm`;
- SQL nuevo: No;
- frontend no tocado;
- entries post-pago cubiertas por Slice 9A;
- QR interno cubierto por Slice 9B;
- email post-pago cubierto por Slice 9C;
- staging Bancard approved flow PASS;
- no `payment_events`;
- sin cambios funcionales en `/payments/callback` legacy.

Responsabilidad:

- recibir callback Bancard;
- validar payload minimo;
- validar token con `BANCARD_PRIVATE_KEY`;
- sanitizar payload;
- llamar RPC `public.confirm_bancard_access_payment(...)`;
- responder a Bancard.

Archivos implementados:

- `functions/api/src/routes/payments.ts`;
- `functions/api/src/schemas/bancardConfirm.ts`;
- `functions/api/src/services/bancardConfirm.ts`.

Fuera de alcance del callback base:

- QR;
- email;
- frontend;
- query/reconciliacion;
- staging end-to-end;
- refunds;
- panel manual review.

Reglas de seguridad:

- token Bancard: `md5(private_key + shop_process_id + "confirm" + amount + currency)`;
- no loguear token recibido;
- no loguear token calculado;
- no persistir token;
- no devolver token;
- no guardar `security_information` completa;
- no guardar `billing_response`;
- no usar IP allowlist en este slice;
- la seguridad principal es token Bancard.

Payload persistido:

- `shop_process_id`;
- `amount`;
- `currency`;
- `response_code`;
- `response`;
- `response_details`;
- `extended_response_description`;
- `iva_amount`;
- `authorization_number`;
- `ticket_number`;
- `response_description`;
- `received_at`.

Response mapping:

- payload invalido: HTTP 400 `{ "status": "error" }`;
- config faltante: HTTP 500 `{ "status": "error" }`;
- token invalido: HTTP 401 `{ "status": "error" }`;
- RPC `approved`, `rejected` o `manual_review`: HTTP 200 `{ "status": "success" }`;
- RPC `invalid_request`: HTTP 400 `{ "status": "error" }`;
- RPC `payment_attempt_not_found`: HTTP 409 `{ "status": "error" }`;
- error Supabase/RPC inesperado: HTTP 500 `{ "status": "error" }`.

Validacion estatica antes del commit:

- `git diff --check`: PASS;
- `pnpm -C functions/api typecheck`: PASS;
- lint no aplicable por falta de config ESLint en `functions/api`;
- review estatica: PASS;
- no SQL/migraciones;
- no frontend;
- no dependencies;
- no QR/email en el callback base antes de Slice 9B/9C;
- no `payment_events`;
- no cambios funcionales en `/payments/callback` legacy.

### 23.1 Slice 9A - Access entries post-pago - PASS

Estado:

- PASS completo;
- migracion `infra/sql/migrations/040_access_core_slice_9_issue_entries.sql`;
- RPC `public.issue_access_entries_for_paid_order(p_order_id uuid, p_payment_attempt_id uuid)`;
- backend integrado en `functions/api/src/services/bancardConfirm.ts`;
- no se modifico la Confirm RPC existente.

Comportamiento:

- `paid + approved + consumed` llama `issue_access_entries_for_paid_order`;
- la cantidad emitida es `quantity * entries_per_unit`;
- la idempotencia usa unique `(order_item_id, unit_index)`;
- estado inicial de entries: `status = 'issued'`;
- estado inicial de check-in: `checkin_status = 'unused'`;
- estado inicial de email: `email_status = 'not_sent'`;
- `checkin_token` lo genera DB;
- el email post-pago queda cubierto por Slice 9C;
- el QR interno queda cubierto por Slice 9B;
- no se expone QR por status page todavia.

### 23.2 Slice 9B - QR/token interno - PASS

Estado:

- PASS;
- servicio `functions/api/src/services/accessQr.ts`;
- usa `access_entries.checkin_token` como token opaco;
- payload interno: `${B2C_BASE_URL}/#/access/checkin/<checkin_token>`;
- fallback base URL: `https://tairet.com.py`;
- genera PNG con `qrcode`;
- no consulta DB;
- no expone endpoint publico;
- no modifica status page;
- no implementa check-in;
- no loguea `checkin_token`.

Seguridad:

- no incluye `entry_id`;
- no incluye `order_id`;
- no incluye `order_item_id`;
- no incluye `payment_attempt_id`;
- no incluye buyer data;
- no incluye monto;
- no incluye datos Bancard;
- no incluye secretos.

### 23.3 Slice 9C - Email post-pago - PASS tecnico

Estado:

- PASS tecnico;
- servicio `functions/api/src/services/accessEmails.ts`;
- integracion en `functions/api/src/services/bancardConfirm.ts`;
- logging seguro ajustado en `functions/api/src/services/emails.ts`;
- usa `sendEmail()`;
- usa `generateAccessEntryQrPng()`;
- no usa `eventQr.ts`;
- no usa `eventEmails.ts`;
- no usa `payment_events`;
- no modifica SQL/migraciones;
- no modifica frontend/status page;
- no implementa check-in;
- no crea endpoint publico de QR.

Flujo:

- Confirm RPC devuelve `approved`;
- `issue_access_entries_for_paid_order(...)` devuelve `ok: true` y `status = 'issued'`;
- backend intenta email post-pago;
- claim idempotente `access_entries.email_status: not_sent -> failed`;
- si email sale bien, `failed -> sent` y `email_sent_at` queda no nulo;
- si email falla, queda `failed`;
- la falla de email no revierte pago, stock ni entries;
- la falla de email no rompe callback Bancard.

Idempotencia:

- callback duplicado despues de `sent` no reenvia;
- devuelve `skipped_already_sent`;
- `entriesClaimed = 0`;
- `entriesSent = 0`;
- `email_status` permanece `sent`;
- `email_sent_at` permanece no nulo.

Evidencia staging:

- `public_ref = acc_b95579d85d962fca3bdc5f7f3ec92f0c`;
- `shop_process_id = 260623000000004`;
- replay controlado post-deploy respondio HTTP 200 `{ "status": "success" }`;
- logs seguros de Resend: `provider = resend`, `recipientCount = 1`, `hasSubject = true`, `subjectLength = 32`, `attachmentCount = 1`, `emailEnabled = true`;
- logs Access Core: `emailStatus = sent`, `entriesClaimed = 1`, `entriesSent = 1`;
- SQL: `email_status = 'sent'`, `count = 1`, `with_sent_at = 1`;
- integridad: order `paid`, payment attempt `approved`, `provider_response_code = '00'`, stock `consumed`, `access_entries_count = 1`;
- replay duplicado despues de `sent`: `emailStatus = skipped_already_sent`, `entriesClaimed = 0`, `entriesSent = 0`.

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
- la validacion read-only por token ya esta implementada en Slice 9E.1;
- marcar uso transaccional por panel local ya esta implementado en Slice 9E.2.

Evidencia staging:

- `shop_process_id = 260623000000004`;
- `public_ref = acc_b95579d85d962fca3bdc5f7f3ec92f0c`;
- primer callback aprobado: `entriesInserted = 1`, `entriesTotal = 1`, `entriesIdempotent = false`;
- replay duplicado: `entriesInserted = 0`, `entriesTotal = 1`, `entriesIdempotent = true`;
- SQL final: order `paid`, payment attempt `approved`, stock `consumed`, `access_entries_count = 1`;
- duplicados por `order_item_id + unit_index`: `0 rows`.

Seguridad:

- la RPC no retorna `checkin_token`;
- no se loguean tokens completos;
- no se loguea buyer data;
- no se loguea payload Bancard completo;
- el frontend no emite entries;
- payment/order/stock no se cambian indebidamente.

### 23.4 Slice 9E.1 - Check-in read-only panel local - PASS funcional post-deploy

Estado:

- PASS funcional post-deploy;
- endpoint `GET /panel/access/checkin/:token`;
- montaje `/panel/access/checkin/:token`;
- auth `panelAuth` + `requireRole(["owner", "staff"])`;
- scope read-only, local-only y panel-only;
- no SQL/migraciones;
- no frontend/B2C/status page;
- no email;
- no QR helper;
- no cambios en Bancard;
- no reutiliza check-in legacy/event.

Archivos implementados:

- `functions/api/src/schemas/accessCheckin.ts`;
- `functions/api/src/services/accessCheckin.ts`;
- `functions/api/src/routes/panelAccess.ts`;
- `functions/api/src/routes/panel.ts`.

Contrato:

- valida `checkin_token` como UUID;
- trim/lowercase del token recibido;
- token no UUID devuelve HTTP 400 con `code = 'invalid_checkin_token'`;
- busca `access_entries`, `access_orders` y `access_order_items`;
- soporta inicialmente solo `source_type = 'local'`;
- valida tenant con `access_orders.local_id = req.panelUser.localId`;
- token inexistente, tenant mismatch y `source_type <> 'local'` devuelven respuesta segura sin revelar existencia;
- no marca uso automaticamente.

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

Validacion previa:

- `pnpm -C functions/api typecheck`: PASS;
- `git diff --check`: PASS;
- review pre-commit: PASS sin hallazgos High, Medium ni Low bloqueantes.

Validacion post-deploy:

- `GET /panel/access/checkin/not-a-uuid` con auth valido devolvio HTTP 400 `{ "error": "Invalid check-in token", "code": "invalid_checkin_token" }`;
- `GET /panel/access/checkin/<checkin_token>` para entry `issued/unused` devolvio HTTP 200 con `status = 'valid'`;
- respuesta valida incluyo `entry.status = 'issued'`, `entry.checkin_status = 'unused'`, `entry.access_date = '2026-08-01'`, `entry.unit_index = 1`, `entry.ticket_name = 'Entrada Staging Bancard'`, `order.public_ref = 'acc_b95579d85d962fca3bdc5f7f3ec92f0c'` y `warnings = ['date_warning']`;
- `date_warning` es esperado porque `access_date` no coincide con la fecha actual;
- 9E.1 no bloquea por fecha, solo advierte.

Confirmacion read-only por SQL posterior al GET:

- `status = 'issued'`;
- `checkin_status = 'unused'`;
- `used_at = null`;
- `used_by = null`.

Logging seguro runtime:

- `panelAuth` loguea `path = '/panel/access/checkin/:token'`, no el token completo;
- token invalido loguea `message = 'Invalid access check-in token'`, `errorCode = 'invalid_checkin_token'` y `tokenHash`;
- lookup valido loguea `message = 'Access check-in lookup successful'`, `tokenHash`, `publicRef`, `sourceType = 'local'`, `status = 'valid'` y `checkinStatus = 'unused'`;
- no se loguea `checkin_token` completo;
- no se loguean buyer email, buyer phone, buyer document, payload Bancard, datos de tarjeta, CVV, private key ni secretos.

Pendientes de check-in:

- UI panel para escanear o pegar token;
- B2C route publica del QR;
- soporte `source_type = 'event'`;
- validaciones futuras: token inexistente, tenant mismatch, already_used, voided, not_paid y source event/no soportado.

### 23.5 Slice 9E.2 - Check-in mark used transaccional local - PASS funcional post-deploy

Estado:

- PASS funcional post-deploy;
- migracion `infra/sql/migrations/041_access_core_slice_9e_checkin.sql`;
- RPC `public.check_in_access_entry_by_token(uuid, uuid, uuid)`;
- endpoint `POST /panel/access/checkin/:token/use`;
- auth `panelAuth` + `requireRole(["owner", "staff"])`;
- scope panel-only, local-only y mutacion transaccional en DB;
- sin frontend;
- sin B2C route;
- sin tocar email;
- sin tocar QR helper;
- sin tocar Bancard callback;
- sin reutilizar check-in legacy/event.

Archivos implementados:

- `functions/api/src/services/accessCheckin.ts`;
- `functions/api/src/routes/panelAccess.ts`.

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
- solo marca uso si la entry esta `status = 'issued'`, `checkin_status = 'unused'`, `used_at is null` y `used_by is null`;
- setea `checkin_status = 'used'`, `used_at = now()` y `used_by = p_actor_auth_user_id`;
- si una entry `unused` ya tiene `used_at` o `used_by`, devuelve `not_valid_status` y no muta;
- si otro request ya gano el uso, devuelve `already_used`;
- no pisa `used_at` ni `used_by` en reintentos.

Estados de negocio:

- `used`: uso aplicado correctamente;
- `already_used`: entry `issued` ya estaba usada o el request llego despues de otro uso;
- `voided`: entry anulada;
- `not_paid`: orden no esta `paid`;
- `not_valid_status`: combinacion no soportada o inconsistente;
- `entry_not_found`: token inexistente, tenant mismatch o source no local;
- `forbidden`: actor panel invalido o sin permiso;
- `invalid_request`: parametros invalidos.

Validacion post-deploy:

- `GET /health` devolvio HTTP 200 `{ "ok": true }`;
- SQL pre-check confirmo order `paid`, source `local`, entry `issued/unused`, `used_at = null`, `used_by = null`, `access_date = '2026-08-01'` y ticket `Entrada Staging Bancard`;
- primer `POST /panel/access/checkin/<checkin_token>/use` devolvio HTTP 200 con `status = 'used'`, `entry.checkin_status = 'used'`, `used_at` no nulo, `order.public_ref = 'acc_b95579d85d962fca3bdc5f7f3ec92f0c'` y `warnings = ['date_warning']`;
- SQL posterior al primer POST confirmo `checkin_status = 'used'`, `used_at` no nulo y `used_by` no nulo;
- segundo POST del mismo token devolvio HTTP 200 con `status = 'already_used'`;
- SQL posterior al segundo POST confirmo que `used_at` y `used_by` no cambiaron;
- GET read-only posterior devolvio HTTP 200 con `status = 'already_used'`.

Aclaracion de concurrencia:

- se valido flujo principal `unused -> used`;
- se valido idempotencia secuencial con segundo POST;
- no se ejecuto prueba manual de dos POST estrictamente simultaneos;
- la RPC fue revisada con `FOR UPDATE`, update condicional y fallback para resolver concurrencia en DB.

Logging seguro runtime:

- `panelAuth` loguea `path = '/panel/access/checkin/:token/use'`, no el token completo;
- primer POST loguea `message = 'Access check-in use completed'`, `status = 'used'`, `checkinStatus = 'used'`, `usedAt` y `tokenHash`;
- segundo POST loguea `status = 'already_used'`, `checkinStatus = 'used'`, el mismo `usedAt` y `tokenHash`;
- no se loguea `checkin_token` completo;
- no se loguean `entry_id`, `order_id`, `order_item_id`, `payment_attempt_id`, buyer email, buyer phone, buyer document, payload Bancard, datos de tarjeta, CVV, private key ni secretos.

Pendientes de check-in:

- Slice 9E.3: UI panel para escanear o pegar token;
- Slice 9E.4: B2C route publica/minima del QR;
- soporte `source_type = 'event'`;
- validaciones futuras adicionales: token inexistente, tenant mismatch, entry voided, order not paid, source event/no soportado y concurrencia estrictamente simultanea si se quiere evidencia adicional.

## 24. Riesgos y notas

Notas:

- No se hicieron pruebas de inserts contra constraints en DB descartable.
- Slice 2 fue aplicado como estructura base en Supabase, pero todavia no tiene API/RPC que lo consuma.
- Slice 3 fue aplicado como estructura base en Supabase, pero todavia no tiene API/RPC que lo consuma.
- Slice 4 fue aplicado como estructura base en Supabase, pero todavia no tiene runtime Bancard ni API/RPC que lo consuma.
- Slice 5 fue aplicado como estructura base en Supabase y ya tiene endpoint backend init checkout que lo consume.
- Slice 6 fue aplicado como estructura base en Supabase y ya tiene endpoint backend init checkout que consume idempotency y `next_bancard_shop_process_id()`.
- Slice 8 fue aplicado en Supabase y cierra callbacks Bancard validados por backend mediante RPC transaccional.
- El endpoint backend `POST /payments/bancard/confirm` ya existe como PASS estatico y llama la RPC despues de validar token.
- Staging Bancard approved flow ya tiene PASS para init, callback aprobado, cierre de orden y consumo de stock.
- Callback duplicado sobre pago aprobado ya tiene PASS idempotente.
- Slice 9E.2 fue aplicado en staging y marca uso de `access_entries` por token con auth panel local de forma transaccional.
- Las pruebas de comportamiento quedan para slices con API/RPC o QA DB posterior.
- `docs/events/IBIZA_EVENT_PANEL_OPERATIONAL_READINESS_PLAN.md`, si aparece en git status, es ajeno a este slice y no debe mezclarse en el commit del Access Core Slice 1.

Riesgos:

- Las policies finas owner/staff/admin quedan para slices posteriores.
- Todavia no existe API que consuma `access_ticket_types`.
- Access Core ya consume `access_orders`, `access_order_items` y `access_entries` en checkout, confirmacion y Slice 9A; todavia falta exposicion publica segura de entries/QR.
- Todavia no existe API que consuma `access_stock_limits` ni `access_stock_reservations`.
- El endpoint backend init checkout ya consume `payment_attempts` para iniciar Bancard, pero no confirma pagos.
- El endpoint backend init checkout ya invoca `create_access_paid_checkout`, usa `access_checkout_idempotency_keys` y aplica limites maximos de `quantity`.
- El endpoint backend confirm ya recibe callbacks Bancard, valida token, sanitiza payload e invoca `confirm_bancard_access_payment(...)`.
- El core de pago aprobado ya cierra `payment_attempts`, `access_orders` y `access_stock_reservations`; Slice 9A emite `access_entries` idempotentes despues de `approved`.
- Todavia no existe adapter desde `ticket_types` ni `event_ticket_types`.
- Todavia no existe flujo de seed/provisioning del primer admin Tairet.
- La validacion de comportamiento real depende de pruebas futuras con API/RPC o base descartable.

Pendientes principales:

- Validacion final en `tairet.com.py` cuando el dominio sirva el B2C definitivo.
- Nuevo pago Bancard post-fix para validar redirect completo desde Bancard hacia `/#/payments/access/status`.
- Extender status page con estado seguro de entrega.
- UI panel para escanear o pegar token.
- B2C route publica del QR.
- Soporte `source_type = 'event'` para check-in Access Core.
- Reenvio administrativo.
- Query/reconciliacion.
- Caso rejected end-to-end.
- Panel/manual review.
- Rollback operativo.

## 25. Siguiente paso recomendado

Siguiente paso recomendado:

ASK / PLAN MODE ONLY - ACCESS CORE SLICE 9E.3 UI PANEL CHECK-IN O SLICE 9E.4 B2C ROUTE PUBLICA DEL QR.

Ese proximo paso debe disenar:

- si el panel escanea QR o permite pegar token;
- como consumir `GET /panel/access/checkin/:token` y `POST /panel/access/checkin/:token/use` sin exponer tokens completos en logs;
- si se agrega una B2C route minima solo para redirigir/mostrar estado controlado del QR;
- contrato de no exponer IDs internos ni tokens completos en logs;
- reglas para no permitir reenvio automatico sin decision explicita.

No marcar status extendido, UI panel, B2C route ni reenvio administrativo como implementados hasta que esos bloques tengan PASS propio.
