# Access Core / Bancard E2E Checkpoint

## Estado general

```text
E2E tecnico-operativo Access Core/Bancard: PASS
```

Flujo validado:

```text
B2C checkout pago
-> Bancard iframe
-> pago aprobado
-> callback Bancard
-> access_entries emitidas
-> email con QR
-> panel check-in Entradas pagas
-> validacion used
```

## Commit validado

```text
Commit: 68e706f feat(b2c): add paid access Bancard checkout
```

## Ambiente

```text
API: https://tairetapi-production.up.railway.app
B2C: local apuntando a API Railway para QA
Panel: https://tairet-mvp-web-next.vercel.app/panel/checkin
Local probado: dlirio
Ticket probado: Entrada Staging Bancard
Access date usada: 2026-06-29
```

No se documentan datos personales del comprador.

## Datos staging relevantes

```text
local_id: 550e8400-e29b-41d4-a716-446655440006
access_ticket_type_id: 76b06f19-8dce-4d73-a4aa-270ad44e38c0
public_ref QA: acc_6ed14db15a2e3a69812db1cae2d409dd
shop_process_id QA: 260629000000005
amount_gs: 10000
currency: PYG
```

No se incluye `checkin_token` completo, email del comprador, telefono, documento, tarjetas de prueba ni QR adjunto.

## Checklist PASS

```text
Deploy API Railway: PASS
GET /health: PASS
GET /public/locals/by-slug/dlirio/access-catalog: PASS
Access catalog usa access_ticket_types: PASS
Stock staging 2026-06-29: PASS
B2C muestra ticket pago Access Core: PASS
B2C paid usa access_ticket_type_id: PASS
B2C paid no usa ticket_types.id: PASS
B2C paid no llama /orders: PASS
Free pass legacy mantiene /orders: PASS
POST /payments/access/bancard/single-buy: PASS
Bancard iframe: PASS
Pago Bancard aprobado: PASS
Callback /payments/bancard/confirm: PASS
Status API paid: PASS
Access entries emitidas: PASS
Email enviado: PASS
Gmail recibido con QR: PASS
Panel lookup Entradas pagas: PASS
Panel validacion: PASS
Estado final used: PASS
```

## Evidencia principal

Status API:

```json
{
  "ok": true,
  "order": {
    "ref": "acc_6ed14db15a2e3a69812db1cae2d409dd",
    "status": "paid",
    "source_type": "local",
    "access_date": "2026-06-29",
    "amount_gs": 10000,
    "currency": "PYG"
  }
}
```

Railway logs observados:

```text
Bancard confirm callback processed
rpcStatus = approved
responseCode = 00
manualReview = false

Access Core entries issued after Bancard confirm
entriesInserted = 1
entriesTotal = 1

Access Core entries email handled after Bancard confirm
emailStatus = sent
entriesSent = 1

Email sent successfully
attachmentCount = 1
recipientCount = 1
```

Panel:

```text
Primer lookup:
status = valid
entry status = issued
checkin status = unused

Despues de validar:
status = used
entry status = issued
checkin status = used
```

## Separacion importante: panel/orders vs Entradas pagas

Las entradas pagas Access Core no aparecen en `/panel/orders` porque pertenecen al modelo nuevo:

```text
access_orders + access_entries
```

El listado `/panel/orders` corresponde al flujo anterior/legacy basado en `orders`.

La validacion de entradas pagas Bancard se hace desde:

```text
/panel/checkin -> Entradas pagas
```

usando el QR/token emitido por email.

Esto no debe marcarse como bug.

## Limitacion conocida

```text
Return visual post-pago en tairet.com.py: N/A temporal / FAIL conocido.
```

Motivo:

```text
tairet.com.py sirve una branch temporal publica durante este QA.
Bancard puede retornar a una ruta que esa branch no reconoce.
```

Esto no afecto el callback, pago, status API, email ni check-in.

Para go-live, `B2C_BASE_URL` debe apuntar a una B2C que sirva:

```text
/#/payments/access/status
/#/access/checkin/:token
```

## Fuera de alcance del checkpoint

- Wallet / Mis entradas.
- QR visible en B2C.
- Cuenta de comprador B2C.
- Listado Access Core dentro de `/panel/orders`.
- Automatizacion de stock por fecha.
- Correccion del dominio publico temporal.

## Conclusion

```text
El flujo tecnico-operativo Access Core/Bancard queda validado de punta a punta para compra pagada, emision de entrada, email QR y validacion en panel.

El unico bloqueo pendiente para go-live no es del flujo Bancard/Access Core, sino de ambiente/dominio: B2C_BASE_URL debe apuntar a la B2C correcta cuando se retire la branch temporal publica.
```
