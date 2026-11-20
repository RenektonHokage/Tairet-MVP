# Discotecas · Estado al 20/11/2026

**Free Pass V1 pasó su ensayo controlado en producción el 20/11.** El club sintético se retiró del catálogo y el panel conservó la orden usada y su historial. Las entradas pagadas de Discotecas tienen un cierre distinto, con Bancard Staging.

## Free Pass · Producto, código y Git

`VERIFIED_REPOSITORY`. `c55bcc24532da1e11db2ebe3acfab56f3685a088` validó el total gratuito contra el catálogo, hizo atómico el consumo por QR o vía manual y mostró la credencial en el checkout. El perfil admite un club existente fuera de los mocks. En `orders`, una orden `free_pass` de total cero queda `paid` y su primer consumo persiste `used_at`. [Emisión](../../functions/api/src/routes/orders.ts) · [Check-in](../../functions/api/src/routes/panel.ts) · [Confirmación B2C](../../apps/web-b2c/src/components/shared/CheckoutBase.tsx)

`b5a23f4b4f1eb941ff7faff2f2e7fedebcfbfb83` añadió la retirada reversible del catálogo mediante `is_club_catalog_hidden`, por defecto `false`. El cambio afecta el descubrimiento y las lecturas públicas del club. Las órdenes y sus actividades se conservan. Ambos commits son parte de `main`. [Visibilidad pública](../../functions/api/src/services/localPublication.ts) · [Migración 052 de Discotecas](../../infra/sql/migrations/052_add_club_catalog_visibility.sql)

## Publicación y prueba de Free Pass

`VERIFIED_RUNTIME` **en producción, 20/11**, corrida `FPV1-20261119-15f9b70b`. El recibo final registra la 052 como `20261120154820`, con el hash del SQL de Git, la columna y la restricción verificadas. Para `b5a23f4`, la API figuraba `SUCCESS`, B2C y panel `READY` y las tres comprobaciones HTTP devolvieron 200.

| Paso observado | Resultado del cierre |
| --- | --- |
| Emisión | Club sintético visible durante la ventana. Una solicitud, HTTP 201, una orden gratuita de una unidad y QR mostrado en la confirmación. |
| Consumo | Se decodificó el PNG del QR y se introdujo su valor en la entrada manual del panel autenticado. Primer uso 200. El segundo intento devolvió 409 y el panel indicó «ya utilizado». |
| Retirada | Cero apariciones en listado, perfil y catálogo específico 404. Una orden conservada como usada, historial idéntico al de antes de la retirada y acceso del operador sintético deshabilitado. Los clubes preexistentes conservaron su visibilidad. |

En local ya se habían cubierto las carreras QR/QR, manual/manual y QR/manual. El ensayo en producción acreditó un único pase y su consumo. **Cámara física y entrega efectiva del correo quedaron fuera de ese cierre.** El uso con un club real o clientes reales permanece `UNKNOWN`. No se deduce actividad comercial de una orden sintética de importe cero.

El expediente **Verifica hallazgos de Free Pass** conserva `outputs/cierre-FPV1-20261119-15f9b70b.json` con SHA-256 `d59004754a537d981f8197a8e6255ace06adeec37e29879d710c37715f39eb22`. Éste es el cierre posterior a la 052. El archivo `ensayo-FPV1-20261119-15f9b70b.json` corresponde a la detención anterior a la retirada reversible. [Pruebas de aceptación](../../functions/api/tests/free-pass/acceptance.cjs) · [Pruebas de visibilidad](../../functions/api/tests/free-pass/catalog-visibility.cjs)

## Entradas pagadas de Discotecas

`VERIFIED_REPOSITORY`. El catálogo Access, el checkout pagado y la confirmación Bancard usan las órdenes y entradas de Access. El estado comercial del pago, la emisión, el correo y el primer uso se registran por separado. Las mesas derivadas a WhatsApp conservan su recorrido propio. [Invariantes de Access](../access-core/INVARIANTS.md)

`VERIFIED_RUNTIME` **histórico del 29/06/2026**, documentado en `8a6d0dc` para el producto `68e706f`. El E2E aprobado corresponde a **Discotecas, D'Lirio, `source_type=local`, Bancard Staging**. Con B2C local de QA, API Railway y panel desplegado, se observaron checkout, aprobación y callback, emisión, correo recibido con QR, validación en panel y estado final `used`. El recorrido B2C público y el scanner de entradas pagas tienen checkpoints propios. [E2E D'Lirio](../payments/ACCESS_CORE_BANCARD_E2E_CHECKPOINT.md) · [B2C público](../payments/ACCESS_CORE_PUBLIC_B2C_E2E_CHECKPOINT.md) · [Scanner pago](../payments/ACCESS_CORE_PAID_QR_SCANNER_CHECKPOINT.md)

La habilitación Bancard de producción, la operación con fondos reales y su validación comercial siguen `UNKNOWN` en estos expedientes. El ensayo Free Pass y el de [Events R5](../events/CURRENT_STATE.md) no cambian el cierre de D'Lirio. [Condiciones de cutover](../payments/BANCARD_PRODUCTION_CUTOVER_CHECKLIST.md)
