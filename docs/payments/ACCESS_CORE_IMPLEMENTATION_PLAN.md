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
| 2 | `access_orders`, `access_order_items`, `access_entries` | pending design | Pendiente | No | No tocado |
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

## 6. Riesgos y notas

Notas:

- No se hicieron pruebas de inserts contra constraints en DB descartable.
- Esto no bloquea el avance porque la estructura fue validada por catalogos de Postgres.
- Las pruebas de comportamiento quedan para slices con API/RPC o QA DB posterior.
- `docs/events/IBIZA_EVENT_PANEL_OPERATIONAL_READINESS_PLAN.md`, si aparece en git status, es ajeno a este slice y no debe mezclarse en el commit del Access Core Slice 1.

Riesgos:

- Las policies finas owner/staff/admin quedan para slices posteriores.
- Todavia no existe API que consuma `access_ticket_types`.
- Todavia no existe adapter desde `ticket_types` ni `event_ticket_types`.
- Todavia no existe flujo de seed/provisioning del primer admin Tairet.
- La validacion de comportamiento real depende de pruebas futuras con API/RPC o base descartable.

## 7. Siguiente paso recomendado

Siguiente paso recomendado:

ASK / DESIGN ONLY para Slice 2:

- `access_orders`;
- `access_order_items`;
- `access_entries`;
- estrategia de `public_ref`;
- status checks;
- constraints;
- indices;
- relacion con `access_ticket_types`;
- sin stock todavia;
- sin `payment_attempts` todavia;
- sin Bancard todavia.

Slice 2 debe mantenerse como diseno antes de crear migraciones nuevas.
