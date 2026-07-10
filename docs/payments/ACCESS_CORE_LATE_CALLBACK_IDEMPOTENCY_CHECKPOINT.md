# Access Core — Late Callback Idempotency Checkpoint

## 1. Estado

- Slice 1: cerrado.
- Migration aplicada: `044_access_core_late_callback_idempotency.sql`.
- Fecha del checkpoint: 2026-07-10.
- Proyecto Supabase: `Tairet-DB`.
- Project ref: `omteyctmrgahavgfaodw`.

El proyecto indicado fue el destino autorizado para el QA controlado. Esto no
define por si solo un contrato formal de produccion o staging.

## 2. Root cause corregida

Antes de migration 044:

1. una reserva `reserved` vencida podia pasar a `manual_hold`;
2. un callback aprobado duplicado podia consumir ese `manual_hold` sin recalcular
   capacidad;
3. callback y checkout no compartian el lock de `access_stock_limits` y podian
   competir por el ultimo cupo.

Migration 044 reemplazo esa secuencia por una transicion atomica de pago, orden y
stock bajo locks explicitos.

## 3. Semantica final

### Aprobado con capacidad

- `payment_attempts.status = 'approved'`;
- `access_orders.status = 'paid'`;
- reservas propias `consumed`;
- emision posterior e idempotente de `access_entries`.

La confirmacion no emite entries ni invoca `issue_access_entries_for_paid_order`.

### Aprobado sin capacidad

- `payment_attempts.status = 'approved'`;
- `payment_attempts.last_error = 'approved_but_unfulfilled'`;
- datos del proveedor y `confirmed_at` persistidos;
- `access_orders.status = 'manual_review'`;
- reservas propias `expired` si vencieron o `released` si seguian vigentes, con
  `released_at`;
- cero entries.

`approved_but_unfulfilled` es terminal para callbacks duplicados: no vuelve a
comprobar capacidad, no autoaprueba y no cambia reservas.

### `manual_review` generico

Un `manual_review` generico es terminal para callbacks posteriores. No cambia
attempt a `approved`, order a `paid`, ni las reservas; conserva `last_error`,
razones de revision y timestamps.

La unica reconciliacion automatica admitida es el tuple legacy de callback tardio:
orden e intento en `manual_review`, todas las reservas propias en `manual_hold`,
razon `stock_reservation_expired`, callback aprobado y payload valido. Recalcula
capacidad una vez y termina como `approved`/`paid`/`consumed` o
`approved_but_unfulfilled`.

## 4. Locks y capacidad

Orden de locks:

1. `access_orders`;
2. `payment_attempts`;
3. `access_stock_limits`, por `access_ticket_type_id` y `access_date`;
4. reservas propias, por `access_ticket_type_id`, `access_date` e `id`.

Formula evaluada despues de adquirir los locks:

```text
other_blocked = stock bloqueado por otras ordenes
own_quantity  = reservas de la orden actual, agregadas exactamente una vez

limited:   other_blocked + own_quantity <= capacity
unlimited: siempre cabe
```

`other_blocked` excluye la orden actual y cuenta `consumed`, `manual_hold` y
`reserved` vigente.

## 5. Invariantes preservadas

- una orden `paid` nunca retrocede;
- no hay sobreventa ni doble consumo;
- no hay doble emision por `(order_item_id, unit_index)`;
- un fallo de emision no revierte el pago;
- entries se emiten despues y de forma idempotente;
- email y QR quedan fuera de la transaccion de confirmacion.

## 6. QA runtime

El QA principal cubrio nueve escenarios:

1. aprobacion normal;
2. duplicado normal;
3. callback tardio con capacidad;
4. callback tardio sin capacidad;
5. duplicado `approved_but_unfulfilled`;
6. dos callbacks concurrentes de la misma orden;
7. dos ordenes tardias por el ultimo cupo;
8. callback tardio contra checkout;
9. callback contra cambio de availability.

El addendum cubrio `amount_mismatch` y `provider_transaction_conflict`. Ambos
permanecieron en `manual_review` ante un callback posterior valido, conservando
razones, timestamps y reservas, sin entries.

| Control | Resultado |
| --- | ---: |
| `capacity_violations` | 0 |
| `paid_without_approved_attempt` | 0 |
| `paid_without_all_consumed` | 0 |
| `unfulfilled_with_entries` | 0 |
| `duplicate_entry_keys` | 0 |

La limpieza final confirmo cero residuos de fixtures sinteticos.

## 7. Limitaciones

- no se probo red ni token real de Bancard;
- no se probo la politica externa de retries;
- no se probo email ni QR externo;
- no se forzo un deadlock.

Estas limitaciones no invalidan el cierre de la maquina de estados interna.

## 8. Pendiente operativo separado

Queda por definir la resolucion de ordenes `manual_review`: aprobar manualmente,
liberar, rechazar, reembolsar o entregar una alternativa. Esa politica no se
resuelve aqui ni forma parte del cierre de Slice 1.
