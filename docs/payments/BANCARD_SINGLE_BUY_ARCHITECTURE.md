# Arquitectura Bancard Single Buy para Tairet

## 1. Estado del documento

Estado: pre-implementacion / diseno, actualizado con decisiones de producto.

Este documento define el contrato interno de arquitectura para incorporar Bancard vPOS 2.0 Single Buy, tambien llamado pago ocasional, como checkout principal para venta de entradas en Tairet.

No implementa codigo, SQL, migraciones, endpoints, frontend, dependencias ni cambios runtime. Todas las reglas de este documento deben aprobarse antes de iniciar implementacion funcional.

El documento todavia no esta aprobado para implementacion tecnica. Antes de migraciones o codigo debe resolverse un ASK especifico sobre el modelo comun para discotecas/locales permanentes y eventos independientes.

Supuesto operativo para este corte:

- Tairet no tiene pagos reales activos.
- Tairet no tiene locales activos en produccion.
- Tairet no tiene eventos activos en produccion.
- Tairet no tiene clientes activos que dependan de contratos de pago previos.

Por eso este documento puede fijar reglas antes de construir la primera integracion real sin necesidad de compatibilidad comercial con pagos existentes.

## 2. Documentacion relacionada revisada

Este contrato referencia documentacion existente del repo para mantener coherencia con Eventos, B2C, panel, operacion y arquitectura general:

- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`: define Eventos como vertical propia y no como local falso.
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`: define el modelo tecnico minimo de eventos, la separacion frente a `orders` y que `/payments/callback` queda fuera del corte aprobado.
- `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`: referencia futura para entrega, recuperacion y experiencia de entradas QR.
- `docs/events/IBIZA_EVENT_CHECKIN_SCANNER_CONTRACT_PLAN.md`: referencia para validacion de entradas, estados de uso y scanner.
- `docs/events/IBIZA_EVENT_ACTIVITY_LOG_CONTRACT_PLAN.md`: referencia para auditoria operativa de eventos.
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`: referencia para entrega automatica por email.
- `docs/architecture/SYSTEM_ARCHITECTURE_OVERVIEW.md`: mapa de capas actuales de Tairet.
- `docs/architecture/FUNCTIONAL_FLOWS_E2E.md`: base para QA funcional end-to-end.
- `docs/production/ROLLBACK_BACKUP_AND_RECOVERY_RUNBOOK.md`: referencia operativa para recuperacion.
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`: referencia para readiness antes de produccion.

## 3. Objetivo

El objetivo es usar Bancard Single Buy como checkout principal para tickets pagos de Tairet en dos verticales:

- entradas para discotecas/locales permanentes;
- entradas para eventos independientes.

La arquitectura debe garantizar:

- seguridad de claves y callbacks;
- trazabilidad completa de intentos de pago;
- idempotencia en transiciones criticas;
- control de stock sin sobreventa;
- recuperacion ante callbacks perdidos, usuarios que abandonan la pantalla o fallas de email;
- emision de QR solo despues de confirmacion valida;
- conciliacion operativa y estados manuales cuando exista inconsistencia;
- separacion clara entre origen comercial, intento de pago, entrada emitida y fecha de acceso/validez.

## 4. Alcance del primer slice

El primer slice cubre:

- Bancard Single Buy.
- Checkout embebido por iframe.
- Creacion de intento de pago.
- Confirmacion server-to-server desde Bancard.
- Pantalla de estado para el comprador.
- Reserva temporal de stock antes de abrir Bancard.
- Emision de QR despues de confirmacion aprobada.
- Envio de email como proceso separado del pago.
- Consulta/reconciliacion de pagos pendientes.
- Rollback operativo cuando corresponde.
- Auditoria de eventos operativos y payloads relevantes.
- Contrato comun para ventas de discotecas/locales permanentes y eventos independientes.
- Snapshot de precio por item al momento de compra.

El slice debe ser suficiente para vender entradas con control de stock y trazabilidad sin depender de procesos manuales para el camino feliz.

## 5. Fuera de alcance

Queda fuera del primer slice:

- token payment;
- registro o tokenizacion de tarjetas;
- Zimple;
- preautorizaciones;
- factura electronica;
- promociones Bancard por entidad o BIN;
- mesas o productos con consumo variable;
- politica comercial de reembolsos;
- almacenamiento de datos sensibles de tarjeta;
- panel completo de conciliacion financiera;
- implementacion de reportes contables definitivos;
- eventos multi-fecha o festivales;
- recuperacion publica tipo "Mis entradas" en el primer slice;
- confirmacion automatica del modelo final de base de datos;
- free pass procesado por Bancard.

La ausencia de estos puntos no debe bloquear Single Buy, pero el diseno no debe cerrar puertas para agregarlos luego.

## 6. Verticales de negocio

Las verticales objetivo son:

- entradas de discotecas/locales permanentes;
- entradas de eventos independientes.

### 6.1 Discotecas/locales permanentes

Las discotecas son locales permanentes dentro de Tairet. Son perfiles estaticos que quedan disponibles en la plataforma.

El usuario puede entrar al perfil de una discoteca, verificar si el local opera en una fecha determinada y comprar una entrada para esa fecha operativa especifica.

Ejemplo conceptual:

- Local: Ibiza.
- Fecha elegida: 18/07/2026.
- Tipo de entrada: General o Fastpass.
- Validez: QR valido solo para esa fecha elegida.

La entrada de discoteca debe entenderse como:

- local/perfil permanente;
- tipo de entrada global del local;
- fecha operativa elegida por el usuario;
- QR valido solo para esa fecha.

El documento usa `intended_date`, `access_date` o "fecha de acceso/validez" como concepto. El nombre exacto del campo debe confirmarse en un ASK tecnico posterior al repo.

### 6.2 Eventos independientes

Los eventos son independientes de las discotecas/locales permanentes.

Un evento:

- tiene una fecha unica en el alcance actual;
- no depende del calendario operativo de un local;
- no pertenece obligatoriamente a una discoteca;
- puede realizarse en cualquier lugar;
- si una discoteca organiza un evento, debe gestionarse desde un panel/flujo de eventos separado del panel normal del local.

Ejemplo conceptual:

- Evento: Tomas Mazza.
- Fecha: 1 de agosto.
- Lugar: una discoteca, salon u otro venue.
- Panel: evento independiente.

No se deben documentar ni implementar eventos como simples extensiones de discotecas. Para el alcance actual, Tairet considera eventos single-date. Festivales o eventos multi-fecha son otro alcance futuro.

### 6.3 Core comun

Ambas verticales deben compartir un core de ticketing/pagos:

- orden comercial;
- items comprados;
- intento de pago;
- reserva temporal de stock;
- confirmacion del proveedor;
- emision de entradas/QR;
- conciliacion;
- rollback operativo;
- auditoria;
- origen de la venta.

Las diferencias entre verticales deben quedar fuera del core de pago:

- entidad comercial origen;
- perfil B2C y presentacion de checkout;
- asociacion con organizador, evento o local;
- reglas de stock propias;
- reportes y paneles de operacion;
- copy y experiencia visual del frontend.

Conceptos sugeridos para el modelo comun:

- orden vendible / ticket order / access order;
- items comprados;
- intento de pago;
- entradas/QR emitidas;
- auditoria;
- origen de venta;
- `source_type`: `discoteca` o `event`;
- `source_id`: `local_id` o `event_id`;
- `access_date`, `intended_date` o fecha de acceso/validez;
- `payment_attempts` generico o equivalente;
- `order_entries` / entries validables.

En el estado actual del repo, Eventos ya aparece como una vertical separada de locales, pero el checkout B2C historico y `orders` estan mas ligados a bares/discotecas. La abstraccion deseada es un core de pagos por orden vendible, no por `local_id` ni exclusivamente por `event_id`.

Decision de arquitectura pendiente: definir si se crea una entidad generica tipo `ticket_orders` / `access_orders`, si se adapta `event_orders`, o si se implementa otra abstraccion equivalente. Este documento no define SQL definitivo.

## 7. Principios no negociables

- El frontend nunca confirma un pago.
- `return_url` y `cancel_url` son solo UX; no son fuente de verdad.
- Las entradas y QR se emiten solo despues de confirmacion valida o conciliacion aprobada.
- La private key de Bancard vive solo en backend.
- Toda transicion critica debe ser idempotente.
- El pago aprobado no depende del envio de email.
- El stock se reserva atomicamente antes de abrir Bancard.
- Callbacks duplicados no pueden emitir entradas duplicadas.
- Payloads inconsistentes deben terminar en `manual_review`.
- No se almacena PAN, CVV, datos sensibles de tarjeta ni informacion que convierta a Tairet en custodio de datos de tarjeta.
- Toda operacion automatica de rollback debe dejar auditoria.
- Una entrada usada bloquea rollback automatico.
- Una orden solo puede tener un intento Bancard activo a la vez.
- Free pass no crea intento Bancard.
- El dinero interno no se maneja con floats.
- El precio se snapshotea al momento de compra.

## 8. Modelo conceptual

El modelo recomendado para entradas pagas debe apoyarse en un core comun de ordenes vendibles. El repo ya tiene entidades de Eventos (`event_orders`, `event_order_items`, `event_order_entries`, `event_activity_events`) y pueden servir como referencia, pero Bancard no debe asumir que toda venta es un evento.

Entidades conceptuales deseadas:

- orden vendible / ticket order / access order;
- items de orden;
- payment attempts;
- entries emitidas y validables;
- activity/audit events;
- origen de venta (`source_type`, `source_id`);
- fecha de acceso/validez (`access_date`, `intended_date` o equivalente).

No se recomienda reutilizar `orders` legacy como base directa del primer pago real de entradas porque ese flujo observable esta acoplado a:

- `local_id`;
- free pass / ordenes historicas;
- `checkin_token` generado temprano;
- ventana operativa de discoteca;
- `ticket_types` asociados a local;
- callback de pagos generico o mockeado.

Para pagos reales de entradas, el orden correcto es separar:

- compra comercial;
- intento de pago;
- unidad emitible;
- unidad validable;
- estado de email;
- auditoria;
- origen comercial;
- fecha de acceso/validez.

Esto evita emitir QR antes de confirmar pago y permite tener varios intentos sobre una misma orden sin duplicar entradas.

El modelo tecnico final queda pendiente de un ASK especifico al repo. Si actualmente algun flujo usa `intended_date`, `event_date`, `access_date` u otro campo, este documento solo fija el concepto de "fecha de acceso/validez".

## 9. `payment_attempts` conceptual

La entidad `payment_attempts`, `event_payment_attempts` o equivalente debe representar un intento concreto contra Bancard. No se define SQL definitivo en este documento.

Campos conceptuales recomendados:

| Campo | Proposito |
| --- | --- |
| `id` | Identificador interno del intento. |
| `order_id` | Orden vendible asociada. El nombre final puede variar. |
| `provider` | Proveedor de pago, inicialmente `bancard`. |
| `flow` | Flujo usado, inicialmente `single_buy`. |
| `shop_process_id` | Identificador enviado a Bancard; debe ser unico y apto para Bancard. |
| `bancard_process_id` | `process_id` devuelto por Bancard para abrir iframe. |
| `amount_gs` | Monto interno entero/bigint en guaranies. |
| `amount` | Monto exacto formateado para Bancard, por ejemplo `"50000.00"`. |
| `currency` | Moneda, inicialmente `PYG`. |
| `status` | Estado del intento. |
| `request_payload` | Payload enviado a Bancard, sin secretos. |
| `response_payload` | Respuesta inicial de Bancard, sin secretos. |
| `confirm_payload` | Payload recibido en confirmacion, sin datos sensibles. |
| `last_query_payload` | Ultima respuesta de consulta/conciliacion. |
| `rollback_payload` | Respuesta de rollback operativo si aplica. |
| `created_at` | Fecha de creacion. |
| `updated_at` | Fecha de ultima actualizacion. |
| `expires_at` | Vencimiento de reserva/intento. |
| `confirmed_at` | Fecha de confirmacion aprobada si existe. |
| `manual_review_reason` | Motivo de revision manual si aplica. |

`shop_process_id` no debe derivarse directamente de un UUID textual. Bancard espera un identificador numerico apto para el comercio; el diseno debe generar un numero unico, trazable y con longitud compatible.

No se deben usar floats para dinero. El monto interno debe guardarse como entero/bigint en guaranies y convertirse a string decimal con dos decimales solo para el payload Bancard.

Ejemplo:

- monto interno: `amount_gs = 50000`;
- payload Bancard: `amount = "50000.00"`.

## 10. Estados recomendados

Los estados deben estar separados por entidad. Mezclar estados de orden, intento, entrada, check-in y email genera reglas ambiguas y bugs de recuperacion.

### 10.1 Orden

Estados:

- `pending_payment`;
- `paid`;
- `cancelled`;
- `expired`;
- `manual_review`;
- futuro `refunded`.

La orden representa la compra comercial. No debe cargar detalles internos del proveedor.

### 10.2 Intento Bancard

Estados:

- `created`;
- `payment_initiated`;
- `pending_confirmation`;
- `approved`;
- `rejected`;
- `expired`;
- `rollback_requested`;
- `rollback_success`;
- `rollback_failed`;
- `manual_review`.

El intento representa la relacion con Bancard. Una orden puede tener mas de un intento si el comprador reintenta pago.

### 10.3 Entrada

Estados:

- `issued`;
- `voided`.

La entrada existe solo despues de pago aprobado. `voided` invalida la entrada sin borrar auditoria.

### 10.4 Check-in

Estados:

- `unused`;
- `used`.

El check-in mide acceso, no pago. Una entrada `used` no debe ser anulada automaticamente por rollback operativo.

### 10.5 Email

Estados:

- `not_sent`;
- `sent`;
- `failed`.

El email es entrega/notificacion. No define si el pago esta aprobado ni si la entrada existe.

## 11. Flujo end-to-end aprobado

Secuencia aprobada para el camino feliz y sus ramas basicas:

1. El usuario elige una discoteca/local o un evento en B2C.
2. Si es discoteca/local, el usuario elige fecha operativa de acceso/validez.
3. Si es evento, el evento ya define su fecha unica para el alcance actual.
4. El usuario elige uno o mas tipos de entrada si el modelo tecnico lo permite.
5. El backend valida origen, disponibilidad, precio, moneda, fecha de acceso/validez y datos minimos de comprador.
6. El backend snapshotea nombre/precio de cada item.
7. El backend crea una orden `pending_payment`.
8. El backend reserva stock atomicamente para todos los items.
9. El backend crea un intento Bancard con `shop_process_id` unico.
10. El backend llama a `single_buy`.
11. Bancard devuelve `process_id`.
12. El frontend recibe solo lo necesario para abrir el iframe.
13. El usuario paga, cancela o abandona.
14. Bancard envia confirmacion server-to-server.
15. El backend valida token/hash, `shop_process_id`, monto, moneda y estado.
16. Si la confirmacion es valida y aprobada, el backend marca el intento `approved`.
17. El backend marca la orden `paid`.
18. El backend emite entradas/QR exactamente una vez, una por unidad comprada.
19. El backend registra auditoria.
20. El backend dispara o agenda envio de email.
21. El frontend consulta estado por referencia publica segura.
22. Si no llega confirmacion, un proceso de conciliacion consulta a Bancard.
23. Si existe inconsistencia, se abre `manual_review`.
24. Si corresponde, se solicita rollback operativo.

Compras con multiples tipos de entrada son un objetivo deseable si el modelo tecnico lo soporta sin riesgo.

Ejemplo:

- 2 General;
- 1 Fastpass;
- un solo pago Bancard por el total;
- tres QR emitidos luego de confirmacion.

Reglas para multiples items:

- la reserva de stock debe ser atomica para todos los items;
- si un item no tiene stock suficiente, no se reserva ninguno;
- no debe existir reserva parcial antes de llamar a Bancard;
- un intento Bancard cobra el total de la orden;
- cada unidad comprada genera su propia entrada/QR.

La viabilidad exacta de multiples items debe confirmarse en el ASK tecnico al repo.

## 12. Reserva temporal de stock

El timer visual del frontend no es suficiente para proteger stock. La reserva debe vivir en base de datos.

Reglas iniciales:

- Duracion inicial recomendada: 10 minutos.
- La reserva se crea antes de llamar a Bancard.
- La reserva debe ser atomica por tipo de entrada o unidad de stock.
- El conteo de disponibilidad debe considerar ventas pagadas y ordenes pendientes no expiradas.
- La reserva se libera cuando la orden expira, se cancela o el intento es rechazado.
- Si existe intento Bancard iniciado, antes de liberar stock se debe consultar o reconciliar estado.
- No se debe liberar stock solo porque el frontend cerro la pestana.
- Si existe intento Bancard iniciado y el estado queda ambiguo, no se libera stock automaticamente.
- Preferencia inicial: conservar stock bloqueado hasta resolucion manual o reconciliacion final.

Riesgo principal: sin reserva atomica, dos compradores pueden comprar el ultimo cupo de forma simultanea.

### 12.1 Stock de discotecas/locales permanentes

Las entradas de discoteca son globales en el panel del local.

Ejemplos:

- General.
- Fastpass.

Reglas:

- tipo de entrada = global por local;
- precio = definido por tipo de entrada;
- compra = se emite para una fecha operativa especifica;
- cupo/stock, si existe, se controla por fecha + tipo de entrada;
- el precio debe snapshotearse en la orden al momento de compra.

El precio no cambia por dia. Si el local quiere otro precio, debe activar o crear otro tipo de entrada.

El stock puede variar por fecha sin convertir cada fecha en un tipo de entrada nuevo.

Ejemplo:

- Jueves: General cupo 200, Fastpass cupo 50.
- Viernes: General cupo 300, Fastpass cupo 80.

### 12.2 Precio snapshot

El monto de la orden no debe depender del precio actual del tipo de entrada despues de la compra.

Cada item de orden debe guardar conceptualmente:

- `ticket_type_id`;
- nombre snapshot;
- precio unitario snapshot;
- cantidad;
- subtotal.

Esto aplica tanto para discotecas/locales permanentes como para eventos independientes.

### 12.3 Fecha cerrada con entradas vendidas

Si un local intenta marcar como cerrado un dia que ya tiene entradas vendidas o emitidas, el sistema no debe permitir el cierre directo por owner/local.

Regla inicial:

- owner/local no puede cerrar libremente una fecha con entradas pagadas/emitidas;
- admin Tairet debe resolver manualmente;
- posibles resoluciones futuras: mantener fecha, reprogramar entradas, anular, contactar compradores o resolver soporte;
- si se cambia fecha, debe existir auditoria e historial.

Cambiar la fecha de una entrada no debe ser automatico ni silencioso.

Si en el futuro se reprograma una entrada, se debe conservar:

- fecha original;
- nueva fecha;
- motivo;
- actor/admin;
- timestamp;
- registro de notificacion al comprador si aplica.

### 12.4 Free pass

Free pass sigue fuera de Bancard.

Reglas:

- una entrada con precio 0 no debe crear intento Bancard;
- no se debe enviar `amount: "0.00"` a Bancard para free pass;
- free pass puede generar QR;
- free pass debe tener check-in y auditoria cuando el modelo final lo permita;
- free pass y entradas pagas tienen cupos separados;
- free pass no debe consumir cupo de entradas pagas, salvo cambio explicito de producto en el futuro.

### 12.5 Reintentos de pago

Reglas:

- una orden solo puede tener un intento Bancard activo a la vez;
- si un intento fue rechazado y la orden no expiro, puede crearse otro intento;
- si la orden expiro, no se revive: se crea una orden nueva;
- si un intento esta `pending_confirmation`, no se crea otro intento hasta consultar/reconciliar;
- se deben evitar dos iframes activos para la misma orden.

## 13. Bancard Single Buy

Estado sobre Access Core:

- diseno locked;
- SQL support Slice 6 PASS estructural;
- tabla `access_checkout_idempotency_keys` implementada;
- sequence `bancard_shop_process_id_seq` implementada;
- funcion `public.next_bancard_shop_process_id()` implementada;
- endpoint backend init checkout `POST /payments/access/bancard/single-buy` implementado;
- backend endpoint init checkout: PASS estatico;
- callback queda en slice separado.

El endpoint implementado:

- usar `provider = 'bancard'`;
- usar `provider_operation = 'single_buy'`;
- validar body con schema estricto;
- aplicar quantity limits;
- usar `access_checkout_idempotency_keys`;
- calcular `request_hash` SHA-256 sobre payload normalizado;
- llamar RPC `public.create_access_paid_checkout`;
- llamar RPC `public.next_bancard_shop_process_id()`;
- guardar `shop_process_id` en `payment_attempts.provider_attempt_ref`;
- armar payload Bancard `single_buy`;
- llamar Bancard Single Buy;
- guardar `request_payload` y `response_payload` sanitizados;
- devolver datos minimos para iframe.

Fuera de alcance del runtime inicial:

- callback;
- query/reconciliacion;
- emision de `access_entries`;
- QR;
- email;
- frontend final;
- panel manual review;
- rollback operativo;
- free pass;
- adapters legacy;
- seeds.

SQL support disponible antes del endpoint:

- tabla `access_checkout_idempotency_keys`;
- sequence `bancard_shop_process_id_seq`;
- funcion `public.next_bancard_shop_process_id()`;
- RLS enabled;
- grants/revokes cerrados;
- sin policies publicas.

`access_checkout_idempotency_keys` guarda idempotency publica de checkout Access Core:

- `id`;
- `provider`;
- `provider_operation`;
- `idempotency_key`;
- `request_hash`;
- `status`;
- `order_id`;
- `payment_attempt_id`;
- `response_payload`;
- `error_payload`;
- `last_error`;
- `locked_until`;
- `expires_at`;
- `completed_at`;
- `failed_at`;
- `created_at`;
- `updated_at`.

Reglas estructurales:

- unicidad logica `(provider, provider_operation, idempotency_key)`;
- `request_hash` debe ser SHA-256 lowercase hex;
- `provider` y `provider_operation` deben estar lowercase y sin espacios externos;
- `idempotency_key` debe estar trimmed;
- estados: `processing`, `succeeded`, `failed`, `manual_review`, `expired`;
- `processing` requiere `locked_until`;
- `order_id` y `payment_attempt_id` deben ser ambos null o ambos non-null;
- la FK compuesta valida que `payment_attempt_id` pertenezca al mismo `order_id`;
- `response_payload` y `error_payload` deben guardarse sanitizados;
- no se guardan secrets, token Bancard, datos de tarjeta ni headers completos.

Reglas de idempotency:

- misma key + mismo hash + success devuelve respuesta guardada;
- misma key + mismo hash + error terminal devuelve error guardado si corresponde;
- misma key + hash distinto devuelve `409 idempotency_conflict`;
- key en proceso y `locked_until > now()` devuelve `409 checkout_in_progress`;
- key vencida o lock vencido requiere regla explicita en backend.

Quantity limits:

- maximo `10` por item;
- maximo `20` unidades comerciales totales por checkout;
- maximo `10` ticket types distintos;
- error normalizado `quantity_limit_exceeded`.

`shop_process_id`:

- se guarda en `payment_attempts.provider_attempt_ref`;
- se genera con `public.next_bancard_shop_process_id()`;
- la funcion usa sequence global simple `bancard_shop_process_id_seq`;
- la sequence usa rango `1..999999999`, `no cycle`, `cache 1`;
- formato inicial: `YYMMDD` + sequence left-padded a 9 digitos;
- ejemplo: `260616000000001`;
- la funcion devuelve texto numerico de 15 digitos;
- el execute queda solo para `service_role`;
- debe ser numerico y compatible con Bancard;
- antes de produccion se debe confirmar en staging longitud/tipo exacto aceptado;
- ante colision, reintentar apoyandose en el unique parcial existente de `payment_attempts(provider, provider_operation, provider_attempt_ref)`.

Nota de alcance:

- Slice 6 es PASS estructural.
- El endpoint backend init checkout esta implementado como PASS estatico.
- El endpoint inicia `single_buy`, pero no confirma pagos.
- Todavia faltan staging Bancard, callback, query/reconciliacion, emision de entries/QR/email, frontend iframe/status y validacion productiva.

Endpoint Bancard:

- `POST {environment}/vpos/api/0.3/single_buy`
- Produccion: `https://vpos.infonet.com.py`
- Staging: `https://vpos.infonet.com.py:8888`

Token Single Buy:

- `md5(private_key + shop_process_id + amount + currency)`

Formulas documentales por operacion:

- Single Buy: `md5(private_key + shop_process_id + amount + currency)`
- Confirmacion: `md5(private_key + shop_process_id + "confirm" + amount + currency)`
- Consulta: `md5(private_key + shop_process_id + "get_confirmation")`
- Rollback: `md5(private_key + shop_process_id + "rollback" + "0.00")`

Reglas de formato:

- `amount` debe enviarse como string decimal con dos decimales y punto.
- Ejemplo: `"50000.00"`.
- Moneda inicial: `PYG`.
- El monto confirmado debe coincidir exactamente con el monto del intento.
- El monto interno no debe guardarse como float; debe usarse entero/bigint en guaranies.

Campos que Tairet debe enviar en el primer slice:

- `public_key`;
- `operation.token`;
- `operation.shop_process_id`;
- `operation.amount`;
- `operation.currency`;
- `operation.description`;
- `operation.return_url`;
- `operation.cancel_url`.

Campos omitidos en el endpoint implementado:

- `confirmation_url`;
- `additional_data`;
- `extra_response_attributes`.

La URL de confirmacion de Bancard se configura en el portal de comercio Bancard. No debe documentarse ni implementarse como campo enviado a `single_buy`. Puede existir una variable interna `BANCARD_CONFIRM_URL`, pero su uso es configuracion/operacion, no payload de `single_buy`.

`additional_data` no debe enviarse por defecto. No debe usarse para metadata interna de Tairet ni para datos del comprador. Solo puede usarse si Bancard confirma una promocion, convenio o caso especifico que requiera ese campo.

Campos que no deben entrar en el primer slice:

- private key;
- token al frontend;
- datos de tarjeta;
- datos para tokenizacion;
- BIN/entity promos;
- datos de factura electronica;
- informacion sensible del comprador que no sea necesaria para pago.

`description` tiene limite corto segun Bancard y debe mantenerse breve. No debe usarse como fuente de conciliacion. Ejemplos seguros:

- `Ticket Tairet`
- `Tairet Ticket`

Se deben almacenar `request_payload` y `response_payload` utiles para auditoria, excluyendo private key, token y cualquier dato sensible.

Flujo runtime:

1. Validar config/env.
2. Validar body.
3. Validar idempotency.
4. Validar quantity limits.
5. Llamar RPC `create_access_paid_checkout`.
6. Si la RPC devuelve `ok:false`, no llamar Bancard.
7. Generar `shop_process_id`.
8. Actualizar `payment_attempts.provider_attempt_ref`.
9. Guardar `request_payload` sanitizado antes de llamar Bancard.
10. Calcular token `md5(private_key + shop_process_id + amount + currency)`.
11. Llamar `POST {BANCARD_BASE_URL}/vpos/api/0.3/single_buy`.
12. Guardar `response_payload` sanitizado.
13. Si respuesta contiene `status = success` y `process_id`, pasar attempt a `provider_ready`.
14. Devolver datos minimos para iframe.

Validacion estatica del endpoint backend:

- `git diff --check`: PASS;
- `pnpm -C functions/api typecheck`: PASS;
- lint no aplicable por falta de config ESLint en `functions/api`;
- revision estatica final: PASS;
- High original de idempotency resuelto;
- falla pre-Bancard de `assignShopProcessId` resuelta con respuesta conservadora;
- no se persiste token/private key;
- no se devuelve token/private key;
- no se devuelve `order_id` ni `payment_attempt_id`;
- no reutiliza `/payments/callback` legacy;
- no usa `payment_events` en Access Core Bancard init.

Transiciones de `payment_attempts`:

- `created -> provider_ready` si Bancard devuelve `status = success` y `process_id`;
- `created -> technical_error` si falla antes de enviar request o hay error local/config;
- `created -> manual_review` si hay timeout o ambiguedad despues de enviar request;
- `rejected` solo si Bancard confirma rechazo definitivo de operacion inicial.

Stock ante falla:

- si RPC falla, no hay orden/reserva/attempt;
- si falla antes de llamar Bancard, no debe quedar provider iniciado;
- si falla despues de llamar Bancard o hay timeout, pasar a `manual_review` y retener stock con `manual_hold` si el CODE lo soporta;
- no liberar stock automaticamente en estados ambiguos.

## 14. Iframe Bancard

El endpoint backend ya devuelve `process_id` y datos publicos minimos para levantar el iframe de Bancard. La integracion frontend del iframe sigue pendiente.

Reglas:

- El frontend no recibe private key.
- El frontend no calcula tokens.
- El frontend no manipula datos de tarjeta.
- El frontend muestra timer basado en `expires_at`.
- El frontend puede mostrar estados intermedios, pero no aprobar pagos.
- Cualquier accion posterior al iframe debe consultar backend.

## 15. Confirmacion server-to-server

Endpoint recomendado en Tairet:

- `POST /payments/bancard/confirm`

No se recomienda reutilizar `/payments/callback` as-is porque el flujo actual es generico/mock y no expresa el contrato especifico de Bancard, idempotencia, validaciones de monto/moneda ni reglas de emision de entradas.

El handler de confirmacion debe:

- validar hash/token de Bancard;
- ubicar el intento por `shop_process_id`;
- validar proveedor y flujo;
- validar monto exacto;
- validar moneda exacta;
- validar estado/codigo de respuesta;
- guardar `confirm_payload` sin datos sensibles;
- responder rapido a Bancard;
- ser idempotente ante duplicados;
- no emitir QR si hay mismatch;
- mover a `manual_review` si hay datos inconsistentes.

Confirmaciones duplicadas de un pago ya aprobado deben devolver respuesta exitosa sin reemitir entradas ni reenviar efectos irreversibles.

Tairet solo considera pago aprobado si se cumplen todas estas condiciones:

- token/hash valido;
- `shop_process_id` existe;
- monto coincide;
- moneda coincide con `PYG`;
- respuesta Bancard indica aprobacion;
- `response_code` es aprobado segun contrato Bancard, inicialmente `00`.

Cualquier mismatch debe:

- evitar emision de QR;
- guardar payload;
- mover a `manual_review` o rechazo segun caso.

## 16. Pantalla de resultado

`return_url` muestra estado, no confirma pago.

`cancel_url` permite cancelar, reintentar o volver al checkout solo si la orden sigue valida.

La pantalla de resultado debe consultar backend por una referencia publica segura, no por identificadores internos sensibles.

Estados visibles recomendados:

- verificando pago;
- pago aprobado;
- pago rechazado;
- tiempo agotado;
- cancelado;
- revision manual.

Si el usuario vuelve desde Bancard antes de que llegue el callback, la pantalla debe quedar en "verificando" y hacer polling controlado.

## 17. Reconciliacion y query

Casos que requieren consulta/reconciliacion:

- intento `payment_initiated` sin callback;
- intento `pending_confirmation` sin cierre;
- usuario cierra pestana;
- usuario vuelve antes del callback;
- backend no estaba disponible al recibir confirmacion;
- timeout de reserva;
- payload duplicado o conflictivo.

Regla inicial:

- Consultar intentos `payment_initiated` o `pending_confirmation` luego de 1 a 2 minutos si no hay confirmacion.
- Consultar nuevamente antes de expirar una orden con intento Bancard iniciado.
- Al llegar al vencimiento de 10 minutos, hacer query final antes de liberar stock.
- Si Bancard confirma aprobado, cerrar como `approved` e iniciar emision de entradas.
- Si Bancard confirma rechazado o inexistente, liberar stock segun reglas.
- Si Bancard responde ambiguo o no disponible, mover a `manual_review` o mantener pendiente segun ventana operativa aprobada.

Si existe intento Bancard iniciado y el estado queda ambiguo:

- no se debe liberar stock automaticamente;
- se debe mover a `manual_review` o mantener bloqueado segun regla operativa;
- preferencia inicial: conservar stock bloqueado hasta resolucion manual o reconciliacion final.

Esto evita vender dos veces el mismo cupo.

La infraestructura exacta de cron, worker o job queue queda pendiente para un slice posterior.

## 18. Rollback operativo

Rollback operativo no es una politica comercial de refund. Es una herramienta tecnica para corregir una operacion abandonada o inconsistente antes de que Tairet emita valor final.

Rollback puede aplicar cuando:

- el pago fue iniciado pero no finalizado;
- la orden expiro sin pago confirmado;
- existe mismatch detectado antes de emitir entradas;
- el proceso quedo en estado intermedio sin entrega de QR;
- Bancard permite revertir la operacion bajo su contrato operativo.

Debe abrirse `manual_review` cuando:

- ya se emitio una entrada;
- una entrada fue usada;
- el monto no coincide;
- la moneda no coincide;
- hay callbacks duplicados con datos conflictivos;
- el rollback falla;
- Bancard query y callback no coinciden.

No se permite rollback automatico de una entrada usada.

Todo rollback debe registrar payload, resultado, actor/proceso y motivo.

## 19. QR y entradas

Reglas:

- Las entradas se crean solo despues de intento `approved`.
- La emision debe ser idempotente por orden.
- Un callback duplicado no puede crear entradas duplicadas.
- Cada entrada debe tener QR propio.
- La entrada emitida arranca como `issued`.
- El check-in arranca como `unused`.
- Si el email falla, la orden sigue `paid` y la entrada sigue `issued`.
- Una entrada `used` bloquea anulacion automatica y rollback automatico.
- Para discotecas/locales permanentes, el QR es valido solo para la fecha de acceso/validez elegida.
- Para eventos independientes, el QR es valido para la fecha unica del evento en el alcance actual.

La emision de entradas debe poder reconstruirse o verificarse por auditoria sin depender de que el email haya salido correctamente.

## 20. Email y recuperacion

El email es un canal de entrega, no la fuente de verdad del pago.

No habra "Mis entradas" publico en el primer slice. La recuperacion sera interna por soporte/admin Tairet.

Reglas:

- Pago aprobado y email enviado son estados separados.
- Si falla el email, la orden permanece `paid`.
- Si falla el email, las entradas permanecen `issued`.
- Debe existir mecanismo interno de recuperacion o reenvio.
- Debe registrarse `email_sent_at` o equivalente.
- Debe registrarse error de envio cuando aplique.
- Soporte/admin Tairet debe poder buscar orden, verificar comprador, verificar estado y reenviar entrada/QR.

La pantalla de resultado debe permitir que el comprador vea estado aprobado aunque el email tarde o falle.

## 21. Factura electronica futura

Factura electronica queda fuera del primer slice.

Para no bloquearla a futuro, la arquitectura debe mantener buyer data limpio y separable del payload de Bancard.

Datos probablemente faltantes para factura:

- RUC o documento validado;
- razon social o nombre legal;
- email de facturacion;
- direccion si aplica;
- tipo de contribuyente si aplica;
- reglas de validacion tributaria;
- vinculacion entre pago, comprobante y asiento contable.

No se debe enviar informacion de facturacion a Bancard en el primer slice salvo que sea estrictamente requerida por Bancard para el pago.

Se requiere un documento contable/legal separado antes de implementar factura electronica.

## 22. Seguridad y secretos

Variables sugeridas:

- revisar nombres existentes antes de CODE;
- `BANCARD_PUBLIC_KEY`;
- `BANCARD_PRIVATE_KEY`;
- `BANCARD_ENVIRONMENT`;
- `BANCARD_BASE_URL`;
- `B2C_BASE_URL`;
- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE`;
- `BANCARD_CONFIRM_URL`.

Reglas:

- `BANCARD_PRIVATE_KEY` solo backend.
- `BANCARD_CONFIRM_URL` queda para configuracion/callback futuro, no como payload de `single_buy`.
- Ninguna clave privada debe usar prefijo `VITE_` o `NEXT_PUBLIC_`.
- No se loguea private key.
- No se loguean datos sensibles de tarjeta.
- No se persisten datos de tarjeta.
- El token/hash se calcula en backend.
- El backend debe validar origen logico por token/hash, no solo IP.
- Se guarda solo metadata necesaria para auditoria, soporte y conciliacion.

### 22.1 Portal Bancard, TLS y URL de confirmacion

Reglas:

- La URL de confirmacion debe ser publica, HTTPS y compatible con TLS 1.2.
- La URL de confirmacion debe configurarse en el portal de comercios Bancard.
- Tairet ya cuenta con acceso al portal Bancard y claves staging.
- Falta confirmar/configurar la URL de confirmacion.
- Durante QA se deben revisar trazas en portal Bancard.
- No se debe asumir produccion hasta completar checklist Bancard.

### 22.2 Visibilidad de datos Bancard

Solo admin Tairet puede ver detalles tecnicos Bancard.

Owner/local/staff no deben ver:

- `request_payload`;
- `response_payload`;
- `confirm_payload`;
- `rollback_payload`;
- tokens/hashes;
- errores tecnicos internos del proveedor;
- notas internas de `manual_review`.

Owner/local/staff pueden ver estados comerciales:

- pagado;
- pendiente;
- rechazado;
- entrada emitida;
- usada/no usada;
- cancelada/anulada si aplica.

## 23. Observabilidad y auditoria

Eventos minimos recomendados:

- `order_created`;
- `stock_reserved`;
- `single_buy_requested`;
- `single_buy_created`;
- `iframe_opened` si aplica;
- `confirm_received`;
- `payment_approved`;
- `payment_rejected`;
- `entries_issued`;
- `email_sent`;
- `email_failed`;
- `confirmation_queried`;
- `rollback_requested`;
- `rollback_success`;
- `rollback_failed`;
- `manual_review_opened`.

Cada evento debe incluir:

- entidad afectada;
- estado anterior;
- estado nuevo;
- actor o proceso;
- timestamp;
- motivo si aplica;
- payload del proveedor solo cuando sea necesario y sanitizado.

Los payloads de Bancard deben tratarse como evidencia operativa, no como logs publicos.

## 24. Riesgos conocidos

Riesgos que el diseno debe prevenir:

- sobreventa por falta de reserva atomica;
- callbacks duplicados;
- confiar en `return_url`;
- perdida de confirmacion;
- emision duplicada de QR;
- email fallido despues de pago aprobado;
- rollback sobre entrada usada;
- auditoria insuficiente;
- estados mezclados entre orden, pago, entrada, check-in y email;
- usar UUID textual como `shop_process_id`;
- errores de formato de monto;
- secretos expuestos al frontend;
- mezclar verticales sin contrato comun;
- liberar stock sin consultar Bancard cuando existe intento iniciado;
- aceptar callback con monto, moneda o identificador inconsistente;
- crear dos intentos activos para la misma orden;
- procesar free pass por Bancard;
- usar floats para dinero;
- depender del precio actual del tipo de entrada despues de la compra;
- cerrar una fecha con entradas pagadas/emitidas sin resolucion admin;
- exponer payloads tecnicos Bancard a owner/local/staff;
- usar `additional_data` como metadata interna;
- guardar token/private key en payload tecnico;
- crear doble orden por retry sin idempotency;
- crear doble iframe por retry o race;
- recibir callback antes de persistir `provider_attempt_ref`;
- dejar stock bloqueado indefinidamente por falla operativa;
- liberar stock en estado ambiguo post-Bancard;
- colisionar `shop_process_id`;
- asumir que `description` sirve para conciliacion;
- tratar eventos como extension simple de discotecas;
- tratar discotecas como eventos single-date.

## 25. Checklist QA antes de produccion

Escenarios minimos:

- pago aprobado;
- tarjeta rechazada;
- usuario cancela;
- usuario abandona iframe;
- callback duplicado;
- callback con monto incorrecto;
- callback con moneda incorrecta;
- frontend vuelve por `return_url` antes del callback;
- email falla;
- orden expira;
- reconciliacion aprueba un pago pendiente;
- reconciliacion rechaza o expira un pago pendiente;
- rollback exitoso;
- rollback fallido;
- entrada ya usada;
- stock agotado;
- dos compradores compiten por el ultimo cupo;
- Bancard staging no disponible;
- backend recibe confirmacion tarde;
- payload de Bancard incompleto o inesperado;
- free pass genera QR sin intento Bancard;
- dos iframes intentan abrirse para la misma orden;
- intento `pending_confirmation` bloquea reintento hasta query;
- local intenta cerrar fecha con entradas pagadas/emitidas;
- compra con multiples tipos de entrada reserva todo o nada;
- precio de tipo de entrada cambia despues de compra y la orden mantiene snapshot;
- owner/local/staff no puede ver payload tecnico Bancard;
- URL de confirmacion publica HTTPS/TLS 1.2 configurada en portal Bancard;
- trazas revisadas en portal Bancard staging;
- `additional_data` omitido por defecto;
- `extra_response_attributes` omitido en el endpoint implementado;
- `confirmation_url` no enviado en payload `single_buy`.

Ningun escenario debe producir QR duplicado, stock negativo o pago aprobado sin auditoria.

## 26. Preguntas abiertas

Decisiones ya fijadas por este documento:

- discotecas/locales permanentes y eventos independientes son verticales conceptualmente distintas;
- eventos del alcance actual son single-date;
- free pass queda fuera de Bancard;
- solo admin Tairet ve detalle tecnico Bancard.
- runtime inicial usa `POST /payments/access/bancard/single-buy`;
- backend endpoint init checkout esta implementado como PASS estatico;
- runtime inicial consume Access Core con `provider = 'bancard'` y `provider_operation = 'single_buy'`;
- SQL support Slice 6 ya implemento `access_checkout_idempotency_keys`, `bancard_shop_process_id_seq` y `public.next_bancard_shop_process_id()`;
- `shop_process_id` se guarda en `payment_attempts.provider_attempt_ref`;
- formato inicial de `shop_process_id`: `YYMMDD` + sequence left-padded a 9 digitos;
- quantity limits iniciales: `10` por item, `20` unidades totales, `10` ticket types distintos.

Preguntas que siguen abiertas:

- Modelo DB final para core comun de ticketing/pagos.
- Nombre exacto de campos para fecha de acceso/validez (`intended_date`, `access_date` u otro).
- Si se crea `ticket_orders` / `access_orders` generico o se adapta `event_orders`.
- Duracion final de reserva: confirmar si 10 minutos es suficiente para produccion.
- Regla exacta de liberacion de stock cuando Bancard esta ambiguo.
- Reglas avanzadas de reprogramacion de fechas.
- Reglas de rollback para entradas emitidas pero no usadas.
- Politica futura de refund comercial.
- Diseno de factura electronica.
- Infraestructura final de reconciliacion: cron, worker, queue o job interno.
- Retencion de payloads del proveedor.
- Longitud/tipo exacto aceptado por Bancard staging para `shop_process_id`.

## 27. Orden futuro de implementacion

Orden recomendado de slices:

1. Documento y aprobacion de arquitectura.
2. ASK tecnico de modelo comun discotecas/eventos.
3. Modelo de base para ordenes vendibles, items, entries e intentos de pago.
4. Reserva temporal de stock por origen, fecha de acceso y tipo de entrada.
5. RPC `public.create_access_paid_checkout`.
6. SQL support para `access_checkout_idempotency_keys`, `bancard_shop_process_id_seq` y `next_bancard_shop_process_id()` aplicado en Slice 6.
7. Endpoint backend `POST /payments/access/bancard/single-buy` implementado como PASS estatico.
8. ASK / PLAN MODE ONLY - Bancard confirm callback sobre Access Core.
9. Callback especifico `POST /payments/bancard/confirm`.
10. Emision idempotente de entries/QR/email.
11. Iframe Bancard en B2C.
12. Pantalla de estado.
13. Recuperacion/reenvio interno por admin Tairet.
14. Reconciliacion/query.
15. Rollback operativo.
16. Panel y observabilidad.
17. Factura electronica futura.
18. Token payment futuro.

Ningun slice posterior debe debilitar los principios no negociables de este documento.
