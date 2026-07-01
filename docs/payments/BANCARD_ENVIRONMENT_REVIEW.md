# Bancard Environment Review

## Estado general

Ambiente Bancard actual: STAGING consistente

## Resultado

Railway API + Bancard portal + Vercel B2C estan alineados en STAGING.

El E2E publico validado queda confirmado como flujo Bancard staging.

No queda clasificado como set productivo Bancard para cobros a clientes finales.

## Railway API

```text
BANCARD_BASE_URL: staging con :8888
BANCARD_PUBLIC_KEY: presente y corresponde a Staging Bancard
BANCARD_PRIVATE_KEY: presente
B2C_BASE_URL: https://tairet.com.py
EMAIL_ENABLED: true
EMAIL_FROM_ADDRESS: configurado
```

Nota:
No incluir valores completos de claves, private keys, secrets ni tokens.

## Portal Bancard

Las claves revisadas corresponden a la pestana Staging.

El flujo QA aprobado corresponde al ambiente Staging.

## Vercel B2C

```text
VITE_API_URL: presente
VITE_BANCARD_CHECKOUT_SCRIPT_URL: presente
Scope: Production and Preview
Script checkout: staging con :8888
```

## Verificacion posterior

Despues de agregar VITE_BANCARD_CHECKOUT_SCRIPT_URL, se hizo redeploy de B2C y se verifico nuevamente la status page publica.

URL verificada:

```text
https://tairet.com.py/#/payments/access/status?ref=acc_c2588734d0c9fa002f62ab743ad4adf7
```

Resultado:

```text
PASS
```

## Implicancia operativa

El sistema queda habilitado para QA, demos internas, pruebas staging de Bancard y validacion operativa del flujo.

No debe usarse aun para cobros finales a clientes hasta configurar y validar el set productivo Bancard.

## Requisito para produccion

Antes de cobrar a clientes finales, confirmar y validar:

* BANCARD_BASE_URL productivo.
* BANCARD_PUBLIC_KEY productiva.
* BANCARD_PRIVATE_KEY productiva.
* VITE_BANCARD_CHECKOUT_SCRIPT_URL productivo.
* B2C_BASE_URL=https://tairet.com.py.
* EMAIL_ENABLED=true.
* Redeploy API.
* Redeploy B2C.
* Compra productiva controlada.
* Confirmacion en portal Bancard produccion.
* Status paid.
* Email QR.
* Panel Pagadas.
* Validacion de entrada.

## Riesgo a evitar

No mezclar API productiva con script checkout staging.

No mezclar API staging con script checkout productivo.

El ambiente debe cambiarse de forma coordinada entre Railway API, Vercel B2C y portal Bancard.

## Estado de cierre

Pendiente 1 - Review de ambiente Bancard: PASS para STAGING.

Pendiente productivo: configurar y validar ambiente Bancard produccion antes de cobros finales.

## Fuera de alcance

* Cambio de credenciales Bancard.
* Cambio de staging a produccion.
* Compra productiva.
* Cambios de codigo.
* Cambios de API.
* Cambios de B2C.
* Cambios de panel.
* Cambios SQL.
* Gestion de stock desde panel.
* Gestion de tipos de entradas desde panel.

## Conclusion

El ambiente actual esta correctamente alineado para Bancard Staging.

El flujo publico E2E queda validado en staging.

El paso a produccion debe realizarse como un corte controlado de ambiente, no como un cambio parcial de variables.
