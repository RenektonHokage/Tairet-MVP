# Access Core Paid QR Scanner Checkpoint

## Estado general

Scanner QR para entradas pagas: PASS

## Objetivo validado

Permitir que owner/staff escaneen el QR de una entrada pagada desde /panel/checkin -> Entradas pagas, realicen lookup automático de la entrada y validen manualmente con confirmación explícita.

## Alcance implementado

* Scanner QR dentro de /panel/checkin -> Entradas pagas.
* Integración con el flujo pagado existente.
* Uso de @zxing/browser ya instalado en el proyecto.
* Parser existente para UUID, URL completa, hash route y path.
* Lookup automático después de escanear.
* Validación explícita mediante botón "Validar entrada".
* Fallback manual visible y funcional.
* Manejo de entrada válida.
* Manejo de entrada ya usada.
* Manejo de QR inválido/no correspondiente.
* Cleanup de cámara al detener, detectar QR válido, desmontar o cambiar de modo.

## Archivos principales

* apps/web-next/components/panel/AccessPaidQrScanner.tsx
* apps/web-next/components/panel/AccessPaidCheckinSection.tsx
* functions/api/src/middlewares/panelAuth.ts
* functions/api/src/services/accessCheckin.ts

## Flujo validado

/panel/checkin
-> Entradas pagas
-> Escanear QR
-> QR detectado
-> cámara/ZXing se detiene
-> lookup GET /panel/access/checkin/:token
-> datos seguros de la entrada
-> botón "Validar entrada"
-> POST /panel/access/checkin/:token/use
-> entrada marcada como usada

## Reglas operativas confirmadas

* El scanner no valida automáticamente.
* El POST de validación sigue detrás del botón "Validar entrada".
* El fallback manual sigue disponible.
* Owner y staff pueden usar check-in pagado.
* Tenant isolation queda en backend.
* No se expone token completo en UI/logs.
* No se loguea QR completo.

## QA manual realizado

* /panel/checkin carga: PASS
* Modo Entradas pagas carga: PASS
* Scanner visible: PASS
* Fallback manual visible: PASS
* QR pagado ya usado detectado: PASS
* QR pagado no usado detectado: PASS
* Lookup automático después de escaneo: PASS
* Validación automática no ocurre: PASS
* Botón "Validar entrada" requerido: PASS
* Validación con botón: PASS
* Input manual sigue funcionando: PASS
* Cámara se detiene durante lookup: PASS
* "Escanear otro" muestra "Abriendo cámara..." después de permiso concedido: PASS
* /panel/orders -> Pagadas sigue funcionando: PASS
* /panel/access sigue funcionando: PASS

## Performance observada

Búsqueda manual, mismo token:

* Primera búsqueda: ~1.53s total.
* Segunda búsqueda: ~770ms aprox.
* Tercera búsqueda: ~770ms aprox.

Scanner:

* Lookup después de escaneo: ~600-800ms aprox.

## Railway logs

No se observaron warnings lentos durante la medición posterior al patch.

Esto es consistente con el threshold backend de >1000ms si la parte server-side quedó por debajo de ese valor.

## Timing backend agregado

panelAuth:

* totalMs
* getUserMs
* panelUserMs

accessCheckin lookup:

* totalMs
* entryQueryMs
* orderQueryMs
* orderItemQueryMs

Regla:

* Los warnings se emiten solo para requests lentas superiores a 1000ms.
* Los logs no incluyen token completo, access token, QR, email ni PII.

## Optimización aplicada sin SQL

Después de obtener access_entries por checkin_token, access_orders y access_order_items se consultan en paralelo con Promise.all.

No se cambió el contrato del endpoint.

No se cambió el shape de respuesta.

No se tocó POST /use ni la RPC de validación.

## Observación UX pendiente

Si se escanea un QR de free pass/legacy dentro del modo Entradas pagas, hoy el sistema responde como entrada no encontrada para ese flujo.

Esto es seguro y no bloquea el scanner pagado, pero en UI/UX posterior conviene mostrar un mensaje más claro, por ejemplo:

"Este QR no corresponde a una entrada pagada. Probá en Check-in actual."

## Fuera de alcance

* Validación automática.
* Offline mode.
* App nativa.
* Múltiples puertas.
* Auditoría avanzada de puerta.
* Sonido/haptics.
* Rediseño completo de panel.
* Cambios B2C.
* Cambios Bancard.
* Cambios SQL.
* Cambios email.
* Cambios QR helper.
* Wallet / Mis entradas.

## Criterio de cierre

El scanner QR de entradas pagas queda operativo para el flujo staging actual. Permite lectura QR, lookup automático, validación explícita y fallback manual. La performance observada posterior al patch quedó en rango operativo para esta etapa.

## Pendientes posteriores

* Documentar o revisar performance si aparecen warnings lentos en Railway durante uso sostenido.
* Considerar RPC read-only solo si el lookup vuelve a superar 1-2s de forma sostenida.
* Mejorar mensajes UX para QR legacy/free pass escaneado en modo Entradas pagas.
* Iniciar auditoría UI/UX general del panel después de cerrar este checkpoint.
