# Access Core Implementation Plan

## 1. Estado general

Estado: tracking de implementacion por slices.

El core comun `access_*` queda aprobado como direccion arquitectonica para ventas de acceso, ticketing, QR, stock, pagos y auditoria en Tairet.

Reglas de direccion:

- Bancard todavia no esta implementado.
- `orders` legacy no se usara para pagos reales.
- `event_orders` puede quedar como modelo temporal, piloto o manual para Eventos existentes.
- El nuevo checkout pago debe nacer sobre `access_*`.
- Bancard sera consumidor del core mediante `payment_attempts`, pero el core no depende exclusivamente de Bancard.

## 2. Tabla de slices

| Slice | Alcance | Estado | Migration | Aplicado en Supabase | Runtime/backend/frontend |
| --- | --- | --- | --- | --- | --- |
| 1 | `platform_admin_users`, `access_ticket_types` | PASS | `infra/sql/migrations/033_access_core_slice_1.sql` | Si | No tocado |
| 2 | `access_orders`, `access_order_items`, `access_entries` | PASS | `infra/sql/migrations/034_access_core_slice_2.sql` | Si | No tocado |
| 3 | `access_stock_limits`, `access_stock_reservations` | pending design | Pendiente | No | No tocado |
| 4 | `payment_attempts` | pending design | Pendiente | No | No tocado |
| 5 | RPC de reserva atomica | pending design | Pendiente | No | No tocado |
| 6 | RPC de emision idempotente | pending design | Pendiente | No | No tocado |
| 7 | Bancard Single Buy | pending | Pendiente | No | No tocado |
| 8 | Callback Bancard | pending | Pendiente | No | No tocado |
| 9 | Pantalla de estado | pending | Pendiente | No | No tocado |
| 10 | Admin/support y manual review | pending | Pendiente | No | No tocado |
| 11 | Reconciliacion/query | pending | Pendiente | No | No tocado |
| 12 | Rollback operativo | pending | Pendiente | No | No tocado |

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

## 9. Riesgos y notas

Notas:

- No se hicieron pruebas de inserts contra constraints en DB descartable.
- Slice 2 fue aplicado como estructura base en Supabase, pero todavia no tiene API/RPC que lo consuma.
- Las pruebas de comportamiento quedan para slices con API/RPC o QA DB posterior.
- `docs/events/IBIZA_EVENT_PANEL_OPERATIONAL_READINESS_PLAN.md`, si aparece en git status, es ajeno a este slice y no debe mezclarse en el commit del Access Core Slice 1.

Riesgos:

- Las policies finas owner/staff/admin quedan para slices posteriores.
- Todavia no existe API que consuma `access_ticket_types`.
- Todavia no existe API que consuma `access_orders`, `access_order_items` ni `access_entries`.
- Todavia no existe adapter desde `ticket_types` ni `event_ticket_types`.
- Todavia no existe flujo de seed/provisioning del primer admin Tairet.
- La validacion de comportamiento real depende de pruebas futuras con API/RPC o base descartable.

Pendientes principales:

- Slice 3: `access_stock_limits` y `access_stock_reservations`.
- Slice 4: `payment_attempts`.
- Slice 5: RPC de reserva atomica.
- Slice 6: RPC de emision idempotente.
- Luego Bancard Single Buy, callback, pantalla de estado, reconciliacion y rollback operativo.

## 10. Siguiente paso recomendado

Siguiente paso recomendado:

ASK / DESIGN ONLY para Slice 3:

- `access_stock_limits`;
- `access_stock_reservations`;
- stock explicito;
- unlimited explicito;
- `stock_unconfigured`;
- limited capacity `0`;
- reservas `reserved`, `consumed`, `released`, `expired`, `manual_hold`;
- sin `payment_attempts` todavia;
- sin Bancard todavia;
- sin RPC todavia, salvo diseno conceptual si hace falta.
