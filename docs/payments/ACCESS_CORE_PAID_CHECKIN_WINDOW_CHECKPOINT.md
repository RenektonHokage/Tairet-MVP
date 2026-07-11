# Access Core paid check-in operational window checkpoint

Fecha: 2026-07-11

## 1. Estado

Access Core Slice 2 queda cerrado.

- Migration aplicada: `045_access_core_paid_checkin_operational_window`.
- Migration history: `20260711062758`.
- Proyecto Supabase: `Tairet-DB`.
- Project ref: `omteyctmrgahavgfaodw`.
- Backend y SQL: commit `eb8d031 fix(access): enforce paid check-in operational window`.
- Panel: commit `5c6c4e8 feat(panel): show paid check-in window states`.

El cierre cubre la maquina de estados interna, ambos endpoints autenticados, la
representacion de rechazos temporales en el panel y la limpieza de los fixtures de
QA. La comprobacion visual de los estados exitosos `valid`, `used` y
`already_used` queda como seguimiento no bloqueante; su logica, persistencia e
idempotencia ya tuvieron PASS funcional autenticado.

## 2. Defecto corregido

Antes de Slice 2:

- una entrada paga podia marcarse como usada fuera de su ventana operativa;
- `date_warning` era solo informativo y no bloqueaba la mutacion;
- `POST /panel/access/entries/:entryId/use` ejecutaba un `UPDATE` directo sobre
  `access_entries` y eludia la RPC autoritativa usada por token.

El resultado era una diferencia de autoridad entre endpoints y una regla temporal
dependiente de capas no transaccionales.

## 3. Regla temporal canonica

Para una entrada con `access_date = D`:

- la ventana comienza en `D 18:00:00`, inclusive;
- la ventana termina en `D+1 06:00:00`, exclusive;
- antes del inicio, el resultado es `too_early`;
- en el limite final o despues, el resultado es `expired_window`;
- dentro del intervalo, la entrada puede avanzar a `used` si cumple los demas
  invariantes.

La autoridad temporal esta en SQL y usa UTC-03 explicito. No depende del timezone
de la sesion PostgreSQL, del backend ni del navegador. `used_at` sigue almacenando
el instante real como `timestamptz`; UTC-03 se usa para decidir la ventana civil,
no para degradar el timestamp persistido.

## 4. Decision tecnica de timezone

El PostgreSQL administrado observado tenia tzdata desactualizado para
`America/Asuncion` respecto de la regla paraguaya de UTC-03 permanente posterior a
marzo de 2025. Por eso migration 045 calcula la hora civil presente y futura como:

```text
(decision_at AT TIME ZONE 'UTC') - interval '3 hours'
```

Esta es la politica canonica actual para entradas presentes y futuras. No afirma
compatibilidad historica completa con todas las reglas anteriores de Paraguay. Un
cambio legal futuro de huso horario requiere una nueva migration; no debe
reinterpretarse silenciosamente la funcion ya aplicada.

## 5. Atomicidad y orden de decision

`public.check_in_access_entry_by_token(uuid, uuid, uuid)` mantiene la mutacion
autoritaria:

1. valida al actor `owner` o `staff` del local;
2. localiza y bloquea la `access_entry` con `FOR UPDATE`;
3. captura una sola vez `decision_at` mediante `clock_timestamp()` despues del
   lock;
4. resuelve primero los estados persistentes, incluido `already_used`;
5. rechaza `too_early` o `expired_window` antes de cualquier `UPDATE`;
6. si la entrada es valida, usa el mismo `decision_at` como `used_at`;
7. el update condicional permite exactamente un ganador concurrente.

El orden `already_used` antes de la evaluacion temporal conserva la idempotencia:
una entrada ya usada no cambia de resultado porque el reloj avance fuera de su
ventana, y sus timestamps no se sobrescriben.

## 6. Endpoints y tenant isolation

Ambos endpoints de uso convergen en la misma RPC:

- `POST /panel/access/checkin/:token/use`;
- `POST /panel/access/entries/:entryId/use`.

El endpoint por `entryId` ya no ejecuta un `UPDATE` directo. Primero hace lookup
tenant-scoped por `source_type = 'local'` y `local_id`; solo despues de confirmar
esa pertenencia lee `checkin_token` y delega en la RPC. Una entrada de otro local
se presenta como `entry_not_found`, sin revelar su existencia.

## 7. Contratos de respuesta

Los estados de negocio vigentes son:

- `too_early`;
- `expired_window`;
- `used`;
- `already_used`;
- `voided`;
- `not_paid`;
- `not_valid_status`.

El endpoint por token conserva HTTP 200 para estados de negocio. El endpoint por
`entryId` traduce conflictos de negocio a HTTP 409. Errores de validacion,
autorizacion o inexistencia mantienen sus contratos separados.

## 8. UI operativa

En `/panel/checkin`, el modo `Entradas pagas`:

- muestra `Esta entrada todavía no está habilitada` para `too_early`;
- muestra `La ventana de validación ya finalizó` para `expired_window`;
- no ofrece `Validar entrada` en ninguno de esos estados;
- no muestra `date_warning` ni un fallback tecnico para esos rechazos.

En `/panel/orders`, las acciones sobre entradas pagas usan mensajes especificos:

- `Esta entrada podrá validarse desde las 18:00 de la fecha indicada.`;
- `La ventana de validación de esta entrada finalizó a las 06:00.`.

Los rechazos no presentan un falso estado usado ni timestamps locales nuevos.

## 9. QA ejecutado

### QA funcional autenticado

PASS para:

- `too_early` por token y por `entryId`;
- `expired_window` por token y por `entryId`;
- transicion `valid -> used`;
- segundo intento `already_used` sin cambiar timestamps;
- actor `owner`;
- actor `staff`;
- dos usos concurrentes con exactamente un `used`;
- `voided`;
- `not_paid`;
- tenant isolation con `entry_not_found` para otro local;
- cero mutaciones fuera de ventana.

Las comprobaciones de invariantes no encontraron violaciones. El cleanup elimino
los fixtures de negocio y Auth; los readbacks finales confirmaron cero residuos.

### QA visual autenticado

PASS para:

- scanner `too_early`;
- scanner `expired_window`;
- ausencia del boton de validacion en ambos rechazos;
- mensajes especificos de `/panel/orders` para ambos rechazos;
- ausencia de `date_warning`;
- ausencia de fallback tecnico y de falso estado usado.

La comprobacion visual de `valid`, `used` y `already_used` en scanner y Orders no
pudo ejecutarse dentro de la franja horaria del QA. Queda pendiente no bloqueante:
la logica, persistencia, repeticion y concurrencia de esos estados ya dieron PASS
funcional en runtime.

## 10. Invariantes preservados

- Una entrada paga no puede usarse antes de `D 18:00` ni desde `D+1 06:00`.
- Un rechazo temporal no cambia `checkin_status`, `used_at` ni `used_by`.
- Una entrada no se usa dos veces.
- `used` exige una orden `paid`.
- Otro tenant no puede consultar ni usar la entrada.
- El check-in pago solo muta por la RPC autoritativa.
- `used_at` y `used_by` no cambian en reintentos `already_used`.
- Free Pass conserva su flujo separado.

## 11. Limitaciones y pendientes separados

- Falta la confirmacion visual autenticada de `valid`, `used` y `already_used` en
  scanner y Orders; es no bloqueante para este cierre.
- Un cambio legal futuro de timezone requiere una nueva migration.
- Free Pass queda fuera de Slice 2.
- Este cierre no modifica ni combina fulfillment, emision de entries, email o QR.
- La confirmacion de pago y la emision idempotente siguen siendo procesos
  separados del check-in.

