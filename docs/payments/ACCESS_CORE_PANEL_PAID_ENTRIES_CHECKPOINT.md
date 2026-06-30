# Access Core Panel Paid Entries Checkpoint

## Estado general

```text
Slice 10B Panel Entradas pagadas: PASS
```

## Objetivo validado

```text
/panel/orders ahora permite operar dos vistas:
- Free pass: flujo legacy basado en orders.
- Pagadas: entradas Access Core basadas en access_orders + access_entries.
```

La pestana Pagadas permite listar entradas pagadas y validarlas manualmente por
`entry_id` sin exponer `checkin_token`.

## Endpoints agregados

```text
GET /panel/access/entries
POST /panel/access/entries/:entryId/use
```

## Seguridad

- Ambos endpoints usan `panelAuth`.
- Ambos endpoints requieren `owner` o `staff`.
- Tenant isolation por `req.panelUser.localId` contra `access_orders.local_id`.
- No se devuelve `checkin_token`.
- No se muestra `checkin_token` en UI.
- No se devuelve ni muestra email, telefono, documento, QR, payload Bancard ni secretos.
- La validacion manual usa update condicionado/atomico para evitar doble uso.

## UI validada

`/panel/orders`:

- Tab Free pass.
- Tab Pagadas.
- Free pass legacy intacto.
- Pagadas muestra referencia, entrada, asistente, unidad, fecha, monto, estado de pago, estado de entrada, check-in, email y accion.
- Entrada unused muestra boton Validar manualmente.
- Entrada used muestra estado usada / ya usada.
- CTA general Validar desde Check-in apunta a `/panel/checkin`.

## QA ejecutado

```text
Fecha QA: 2026-06-30
Local: dlirio / Boliche
Ticket: Entrada Staging Bancard
Monto: 10000 PYG
public_ref QA: acc_478e8bdf2c6e579d6d67f8fb27213a47
access_date: 2026-06-30
```

No se incluyen `entry_id`, `used_by`, `checkin_token`, email, telefono,
documento, QR, tarjetas ni secretos.

## Evidencia resumida

Antes de validar manualmente:

```text
order_status = paid
entry_status = issued
checkin_status = unused
used_at = null
email_status = sent
```

Despues de validar manualmente:

```text
order_status = paid
entry_status = issued
checkin_status = used
used_at = no null
used_by = no null
email_status = sent
```

## Checklist PASS

```text
/panel/orders carga: PASS
Tabs Free pass / Pagadas: PASS
Free pass legacy intacto: PASS
Pagadas lista entrada Access Core usada: PASS
Pagadas lista entrada Access Core unused: PASS
Filtros fecha/estado/busqueda: PASS
Sin token/PII/QR visible: PASS
Boton Validar manualmente solo para unused: PASS
Modal/confirmacion antes de validar: PASS
Validacion manual: PASS
DB post-validacion used: PASS
```

## Observacion tecnica

```text
El listado evita un cap fijo tipo range(0, 9999). Para evitar ambiguedad PostgREST por multiples FKs, se uso recoleccion interna exhaustiva de ordenes elegibles y paginacion final sobre entradas filtradas.

Esto prioriza correctitud para el estado actual. Para volumen alto, la mejora recomendada es una RPC/view paginada con tenant filtering directo en DB.
```

## Fuera de alcance

```text
- Gestion de tipos de entradas.
- Stock por fecha.
- Edicion de precios.
- Export de pagadas.
- QR visible.
- Wallet / Mis entradas.
- Cambios en B2C.
- Cambios en email.
- Cambios en Bancard.
- Cambios SQL.
```

## Conclusion

```text
Slice 10B queda validado: el panel ahora lista entradas pagadas Access Core y permite validacion manual desde /panel/orders sin exponer tokens ni datos sensibles, manteniendo separado e intacto el flujo Free pass legacy.
```
