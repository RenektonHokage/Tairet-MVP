# Bancard Production Cutover Checklist

## Estado inicial

* Ambiente actual: Bancard STAGING consistente.
* E2E publico staging: PASS.
* Dominio B2C: https://tairet.com.py.
* B2C_BASE_URL esperado: https://tairet.com.py.
* Email habilitado.
* Panel Pagadas validado.
* QR/link publico validado.

## Objetivo del corte

Pasar de Bancard staging a Bancard produccion de forma coordinada entre:

* Railway API.
* Vercel B2C.
* Portal Bancard.
* QA operativo Tairet.

## Precondiciones obligatorias

* Credenciales productivas Bancard recibidas y confirmadas en portal.
* Base URL productiva Bancard confirmada.
* Script checkout productivo confirmado.
* Acceso a Railway.
* Acceso a Vercel.
* Acceso a Portal Bancard produccion.
* Acceso a Supabase para verificacion.
* Acceso a panel Tairet.
* Email operativo.
* Local/ticket de prueba productivo definido.
* Monto de prueba controlado definido.
* Ventana horaria de corte definida.
* Responsable de ejecutar cambios definido.
* Responsable de validar pago definido.

## Variables Railway API

Listar y cambiar sin registrar valores sensibles:

* BANCARD_BASE_URL: cambiar de staging con :8888 a productivo.
* BANCARD_PUBLIC_KEY: cambiar a productiva.
* BANCARD_PRIVATE_KEY: cambiar a productiva.
* B2C_BASE_URL: mantener https://tairet.com.py.
* EMAIL_ENABLED: mantener true.
* EMAIL_FROM_ADDRESS: confirmar configurado.

No incluir claves completas.

## Variables Vercel B2C

Listar y cambiar sin registrar valores sensibles:

* VITE_API_URL: confirmar Railway API correcta.
* VITE_BANCARD_CHECKOUT_SCRIPT_URL: cambiar de staging con :8888 a script productivo.
* Scope: Production.
* Confirmar si Preview debe seguir staging o productivo segun decision operativa.

## Orden de ejecucion

1. Confirmar estado staging actual.
2. Pausar pruebas staging activas.
3. Cambiar variables Railway API.
4. Redeploy Railway API.
5. Verificar /health.
6. Cambiar variables Vercel B2C.
7. Redeploy Vercel B2C.
8. Verificar landing publica.
9. Verificar status route publica.
10. Verificar checkin route publica.
11. Ejecutar compra productiva controlada.
12. Confirmar portal Bancard produccion.
13. Confirmar callback en logs Railway.
14. Confirmar status paid.
15. Confirmar email QR.
16. Confirmar panel Pagadas.
17. Validar entrada.
18. Confirmar DB final.

## Smoke previo a compra

URLs:

```text
https://tairet.com.py/#/
https://tairet.com.py/#/payments/access/status?ref=REF_EXISTENTE
https://tairet.com.py/#/access/checkin/:token
```

Esperado:

* No NotFound.
* Landing carga.
* Status page carga.
* Check-in landing carga de forma controlada.

## Compra productiva controlada

Validar:

* Compra desde https://tairet.com.py.
* Ticket/monto controlado.
* Iframe Bancard productivo.
* Pago aprobado.
* Retorno visual publico.
* Status paid.
* Email QR.
* QR/link publico sin NotFound.
* Panel /orders -> Pagadas.
* Validacion manual o QR.

No incluir tarjeta ni datos del comprador.

## Logs esperados

Validar sin registrar payload completo:

* Bancard confirm callback processed.
* responseCode aprobado segun produccion Bancard.
* rpcStatus approved o equivalente productivo.
* Access Core entries issued.
* Email sent successfully.

## DB esperada

* order_status = paid.
* paid_at_set = true.
* payment_attempt_status = approved.
* provider_response_code aprobado.
* entry_status = issued.
* checkin_status = unused antes de validar.
* email_status = sent.
* checkin_status = used despues de validar.
* used_at_set = true.

## Criterio GO

GO si:

* API health PASS.
* B2C publico PASS.
* Compra productiva controlada PASS.
* Portal Bancard produccion confirma operacion.
* Callback PASS.
* Status paid PASS.
* Email QR PASS.
* Panel Pagadas PASS.
* Validacion PASS.
* DB final PASS.
* No hay mezcla staging/produccion.

## Criterio NO-GO

NO-GO si:

* Iframe no carga.
* Callback no llega.
* Pago aprobado en portal pero status no queda paid.
* No se emite access_entry.
* No llega email QR.
* QR/link publico rompe.
* Panel no muestra entrada.
* Hay evidencia de mezcla staging/produccion.
* Hay errores 5xx en API.

## Rollback

Rollback controlado:

1. Restaurar Railway API a variables staging previas.
2. Redeploy Railway API.
3. Restaurar Vercel B2C a script staging previo.
4. Redeploy Vercel B2C.
5. Verificar status page staging.
6. Hacer smoke staging si corresponde.
7. Documentar motivo del rollback.

No incluir valores completos de variables.

## Fuera de alcance

* Implementar nuevas features.
* Cambios de codigo.
* Gestion de tipos de entradas.
* Gestion de stock desde panel.
* Wallet / Mis entradas.
* QR visible en B2C.
* Cambios SQL.
* Cambios en email templates.
* Cambios en panel.

## Resultado esperado del documento

El documento debe servir como checklist operativo para ejecutar el corte productivo de Bancard sin improvisacion y sin mezclar ambientes.
