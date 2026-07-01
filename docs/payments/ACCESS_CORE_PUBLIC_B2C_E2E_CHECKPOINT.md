# Access Core Public B2C E2E Checkpoint

## Estado general

```text
Bancard / Access Core E2E publico: PASS
```

## Objetivo validado

```text
Validar el flujo completo de compra pagada desde el dominio publico https://tairet.com.py, incluyendo retorno visual, status publico, email QR, QR/link publico, panel Pagadas y validacion de entrada.
```

## Flujo validado

```text
https://tairet.com.py
-> perfil discoteca
-> checkout pagado
-> iframe Bancard
-> pago aprobado
-> retorno visual publico
-> status paid en tairet.com.py
-> email con QR
-> QR/link publico abre sin NotFound
-> panel /orders Pagadas muestra la entrada
-> validacion manual desde panel
-> DB confirma used
```

## Ambiente validado

```text
Dominio B2C: https://tairet.com.py
B2C branch/base: main
Landing temporal publica: activa
Rutas Access/Bancard preservadas: si
```

Rutas publicas verificadas:

```text
https://tairet.com.py/#/
https://tairet.com.py/#/payments/access/status?ref=acc_6ed14db15a2e3a69812db1cae2d409dd
https://tairet.com.py/#/access/checkin/:token
```

No incluir token completo.

## Fecha y stock

```text
access_date: 2026-07-01
stock_mode: unlimited
capacity: null
```

## Evidencia principal

```text
public_ref QA: acc_c2588734d0c9fa002f62ab743ad4adf7
amount_gs: 10000
currency: PYG
```

No incluir:

```text
checkin_token
email del comprador
telefono
documento
QR
tarjetas
secrets
private keys
payload completo Bancard
```

## Logs Railway confirmados

```text
Bancard confirm callback processed
responseCode = 00
rpcStatus = approved
manualReview = false
shopProcessId = 260630000000007
```

```text
Access Core entries issued after Bancard confirm
entriesInserted = 1
entriesTotal = 1
entriesIdempotent = false
```

```text
Access Core entries email handled after Bancard confirm
entriesClaimed = 1
entriesSent = 1
emailStatus = sent
```

```text
Email sent successfully
provider = resend
recipientCount = 1
attachmentCount = 1
emailEnabled = true
```

## DB final

```text
order_status = paid
paid_at_set = true
amount_gs = 10000
currency = PYG
payment_attempt_status = approved
provider_status = S
provider_response_code = 00
payment_confirmed_at_set = true
entry_status = issued
checkin_status = used
used_at_set = true
email_status = sent
entries_count = 1
```

## Checklist PASS

```text
B2C publico: PASS
Landing temporal publica: PASS
Rutas Access/Bancard preservadas: PASS
Compra desde tairet.com.py: PASS
Iframe Bancard: PASS
Pago aprobado: PASS
Callback Bancard: PASS
Status publico paid: PASS
Email QR: PASS
QR/link publico sin NotFound: PASS
Panel /orders Pagadas: PASS
Validacion manual: PASS
DB final used: PASS
```

## Observacion de ambiente

```text
Este checkpoint valida el flujo publico en el ambiente Bancard actualmente configurado. Si el ambiente actual es staging, antes de cobrar a clientes finales se debe confirmar el set productivo de Bancard: base URL, public key, private key y script checkout.
```

## Fuera de alcance

```text
Cambio de credenciales Bancard.
Cambio de ambiente staging a produccion.
Gestion de stock desde panel.
Gestion de tipos de entradas desde panel.
QR visible en B2C.
Wallet / Mis entradas.
Cuenta de comprador.
Cambios de API.
Cambios de panel.
Cambios SQL.
```

## Conclusion

```text
El bloqueo de B2C publico queda resuelto. tairet.com.py sirve la landing temporal sin romper las rutas Access/Bancard, y el flujo de compra pagada queda validado de punta a punta desde dominio publico hasta validacion de entrada en panel.
```
