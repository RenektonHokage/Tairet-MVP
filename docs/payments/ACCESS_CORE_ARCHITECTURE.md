# Arquitectura del Core Access para Tairet

## 1. Estado del documento

Estado: pre-implementacion / diseno.

Este documento define el contrato de arquitectura del core comun `access_*` para ventas de acceso, ticketing, QR, stock, pagos y auditoria en Tairet.

No implementa codigo, SQL aplicable final, migraciones, endpoints, frontend, dependencias ni cambios runtime.

El objetivo es separar el modelo comun de acceso del contrato especifico de Bancard. Bancard vPOS 2.0 Single Buy sera un consumidor de este core mediante `payment_attempts`, pero el core no depende exclusivamente de Bancard ni de un proveedor de pago especifico.

Supuesto operativo para este corte:

- Tairet no tiene pagos reales activos.
- Tairet no tiene locales activos en produccion.
- Tairet no tiene eventos activos en produccion.
- Tairet no tiene clientes activos que dependan de contratos de pago previos.

Por eso este documento puede corregir la arquitectura antes de implementar pagos reales.

## 2. Objetivo del core

El core `access_*` debe servir para:

- discotecas/locales permanentes;
- eventos independientes single-date en el alcance actual;
- entradas pagas;
- free pass;
- stock y reservas temporales;
- emision de entries/QR;
- check-in;
- intentos de pago;
- recuperacion interna;
- conciliacion;
- rollback operativo;
- auditoria.

El core no debe reutilizar `orders` legacy para pagos reales ni forzar discotecas/locales permanentes dentro de `event_orders`.

## 3. Naming aprobado

Nombres principales:

- `platform_admin_users`;
- `access_ticket_types`;
- `access_orders`;
- `access_order_items`;
- `access_entries`;
- `access_stock_limits`;
- `access_stock_reservations`;
- `payment_attempts`;
- `access_activity_events`.

Se adopta `access_*` en vez de `ticket_*` porque el dominio real es el derecho de acceso validable por QR. Una venta puede representar una entrada paga, free pass, paquete o futuro producto de acceso. La palabra `ticket` describe el producto comercial, pero `access` describe mejor la unidad operativa que se valida en puerta.

`payment_attempts` queda sin prefijo `access_` porque representa relacion con proveedores de pago y puede extenderse a otros flujos sin acoplar el nombre a una sola vertical.

## 4. Origen de venta

El origen se representa con:

- `source_type = local | event`;
- `local_id uuid null`;
- `event_id uuid null`.

Reglas:

- si `source_type = 'local'`, `local_id` es obligatorio y `event_id` debe ser null;
- si `source_type = 'event'`, `event_id` es obligatorio y `local_id` debe ser null.

Se prefieren columnas separadas nullable sobre polimorfismo puro `source_id` porque PostgreSQL puede mantener integridad referencial real con `locals` y `events`. `source_type` conserva legibilidad, facilita queries y evita joins ambiguos.

## 5. Discotecas/locales permanentes

Las discotecas/locales permanentes son perfiles estaticos dentro de Tairet.

Reglas:

- el usuario compra una entrada para una fecha operativa elegida;
- la entrada es valida solo para esa fecha;
- los tipos de entrada son globales por local;
- ejemplos: General, Fastpass, Free Pass;
- el precio no cambia por dia;
- si el local quiere otro precio, debe crear o activar otro tipo de entrada;
- el stock puede ser opcional por fecha y tipo de entrada;
- el stock puede variar en fechas especiales;
- si hay entradas vendidas o emitidas para una fecha, owner/local no puede cerrar esa fecha libremente;
- el cierre de una fecha con entradas vendidas pasa a resolucion de admin Tairet.

Las discotecas no deben representarse como eventos falsos. Una discoteca vende acceso a una fecha operativa de un local permanente.

## 6. Eventos independientes

Los eventos independientes:

- no dependen del calendario operativo de un local;
- tienen una fecha unica en el alcance actual;
- pueden tener venue libre;
- pueden ocurrir en una discoteca, salon u otro lugar;
- si una discoteca organiza un evento, usa flujo y panel de eventos;
- no se gestionan desde el panel normal del local;
- no deben usarse como extension simple de discotecas.

Eventos multi-fecha, festivales y abonos quedan fuera del alcance inicial.

## 7. Catalogo comun

`access_ticket_types` sera el catalogo comun nuevo para entradas pagas y free pass.

`ticket_types` y `event_ticket_types` pueden quedar como tablas legacy o adapters temporales durante transicion, pero no deben ser referencias polimorficas permanentes para el nuevo checkout.

Objetivos de `access_ticket_types`:

- unificar entradas pagas y free pass;
- unificar stock;
- unificar QR y check-in;
- unificar pagos;
- unificar panel;
- unificar email y recuperacion;
- reducir deuda entre discotecas y eventos.

Campos conceptuales:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador interno. |
| `source_type` | `text` | `local` o `event`. |
| `local_id` | `uuid null` | Local asociado si aplica. |
| `event_id` | `uuid null` | Evento asociado si aplica. |
| `name` | `text` | Nombre visible del tipo de entrada. |
| `description` | `text null` | Beneficios o descripcion. |
| `price_gs` | `bigint` | Precio interno en guaranies. |
| `currency` | `text` | Moneda, inicialmente `PYG`. |
| `payment_kind` | `text` | `paid` o `free_pass`. |
| `entries_per_unit` | `integer` | Cantidad de entries por unidad comercial. |
| `active` | `boolean` | Si puede venderse. |
| `sort_order` | `integer` | Orden de visualizacion. |
| `created_at` | `timestamptz` | Creacion. |
| `updated_at` | `timestamptz` | Ultima actualizacion. |

Constraints conceptuales:

- `source_type in ('local', 'event')`;
- coherencia entre `source_type`, `local_id` y `event_id`;
- `price_gs >= 0`;
- `currency = 'PYG'` en el primer corte;
- `payment_kind in ('paid', 'free_pass')`;
- `payment_kind = 'free_pass'` requiere `price_gs = 0`;
- `payment_kind = 'paid'` requiere `price_gs > 0`;
- `entries_per_unit > 0`.

## 8. Free pass

Free pass convive con el core `access_*`.

Reglas:

- puede crear `access_orders`;
- puede crear `access_order_items`;
- puede crear `access_entries`;
- puede generar QR;
- puede tener check-in;
- debe dejar auditoria;
- no crea `payment_attempts`;
- no se envia a Bancard;
- no debe enviarse `amount = "0.00"` a Bancard;
- free pass y entradas pagas tienen cupos separados;
- `payment_kind = 'free_pass'` identifica el tipo de entrada.

La convivencia en el core evita mantener dos sistemas de QR/check-in para accesos reales.

## 9. Multi-item

La base y la API deben soportar multiples items por orden.

La UI inicial puede limitarse a un solo tipo de entrada por orden si se decide reducir riesgo, pero el modelo no debe impedir compras como:

- 2 General;
- 1 Fastpass;
- un solo intento de pago;
- tres entries/QR despues de confirmacion.

Reglas:

- la reserva de stock debe ser atomica para todos los items;
- si un item no tiene stock suficiente, no se reserva ninguno;
- no se llama a Bancard si falla la reserva;
- un intento de pago cobra el total de la orden;
- cada unidad comprada genera una `access_entry`;
- la emision debe ser idempotente por item y unidad.

## 10. Dinero y snapshots

No se usan floats para dinero interno.

Reglas:

- montos internos como `bigint` en guaranies;
- moneda inicial `PYG`;
- `access_orders.amount_gs` guarda total de la orden;
- `access_order_items` guarda snapshot;
- cambios posteriores de precio en `access_ticket_types` no alteran ordenes existentes.

Campos snapshot en `access_order_items`:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador de linea. |
| `order_id` | `uuid` | Orden asociada. |
| `access_ticket_type_id` | `uuid` | Tipo comprado. |
| `name_snapshot` | `text` | Nombre al momento de compra. |
| `unit_price_gs` | `bigint` | Precio unitario al comprar. |
| `quantity` | `integer` | Cantidad comercial. |
| `entries_per_unit` | `integer` | Entries por unidad. |
| `subtotal_gs` | `bigint` | `unit_price_gs * quantity`. |
| `created_at` | `timestamptz` | Creacion. |

Constraints conceptuales:

- `unit_price_gs >= 0`;
- `quantity > 0`;
- `entries_per_unit > 0`;
- `subtotal_gs = unit_price_gs * quantity`.

## 11. Orden comercial

`access_orders` representa la compra comercial, no el detalle interno del proveedor de pago.

Campos conceptuales:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador interno. |
| `public_ref` | `text` | Referencia publica segura. |
| `source_type` | `text` | `local` o `event`. |
| `local_id` | `uuid null` | Local si aplica. |
| `event_id` | `uuid null` | Evento si aplica. |
| `access_date` | `date` | Fecha de validez/acceso. |
| `buyer_name` | `text` | Nombre comprador. |
| `buyer_last_name` | `text` | Apellido comprador. |
| `buyer_email` | `text` | Email comprador. |
| `buyer_phone` | `text` | Telefono comprador. |
| `buyer_document` | `text` | Cedula/documento. |
| `amount_gs` | `bigint` | Total interno en guaranies. |
| `currency` | `text` | Moneda. |
| `status` | `text` | Estado comercial. |
| `expires_at` | `timestamptz null` | Vencimiento de orden/reserva. |
| `paid_at` | `timestamptz null` | Fecha de pago aprobado. |
| `cancelled_at` | `timestamptz null` | Cancelacion. |
| `expired_at` | `timestamptz null` | Expiracion. |
| `manual_review_reason` | `text null` | Motivo de revision. |
| `created_at` | `timestamptz` | Creacion. |
| `updated_at` | `timestamptz` | Ultima actualizacion. |

`public_ref` no debe exponer IDs internos sensibles. El comprador consulta estado mediante endpoint controlado por backend, no por SELECT directo a tablas.

## 12. Stock

`access_stock_limits` define cupos por tipo de entrada y fecha.

Reglas:

- `stock_mode = 'unlimited'` significa sin limite configurado;
- `stock_mode = 'limited'` con `capacity = 0` significa cupo cero;
- para discotecas, el stock es por `access_ticket_type_id + access_date`;
- para eventos single-date, tambien se usa `access_date` para evitar reglas especiales;
- free pass y entradas pagas pueden tener cupos separados porque son ticket types distintos;
- la disponibilidad considera pagadas/emitidas y reservas activas no expiradas.

Campos conceptuales de `access_stock_limits`:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador. |
| `access_ticket_type_id` | `uuid` | Tipo de entrada. |
| `source_type` | `text` | `local` o `event`. |
| `local_id` | `uuid null` | Local si aplica. |
| `event_id` | `uuid null` | Evento si aplica. |
| `access_date` | `date` | Fecha del cupo. |
| `stock_mode` | `text` | `unlimited` o `limited`. |
| `capacity` | `integer null` | Cupo cuando es limitado. |
| `created_at` | `timestamptz` | Creacion. |
| `updated_at` | `timestamptz` | Ultima actualizacion. |

Constraints conceptuales:

- coherencia de source;
- `stock_mode in ('unlimited', 'limited')`;
- si `stock_mode = 'unlimited'`, `capacity is null`;
- si `stock_mode = 'limited'`, `capacity >= 0`;
- unique conceptual por `access_ticket_type_id + access_date`.

## 13. Reserva temporal

`access_stock_reservations` maneja reservas temporales.

Reglas:

- duracion inicial recomendada: 10 minutos;
- la reserva se crea antes de llamar a Bancard;
- reserva multi-item todo-o-nada;
- si falla stock en un item, no se reserva ningun item;
- si Bancard queda ambiguo, no se libera automaticamente;
- estado ambiguo pasa a `manual_hold` y/o la orden pasa a `manual_review`;
- liberar stock requiere certeza operacional o resolucion admin.

Campos conceptuales:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador. |
| `order_id` | `uuid` | Orden asociada. |
| `order_item_id` | `uuid` | Item asociado. |
| `access_ticket_type_id` | `uuid` | Tipo reservado. |
| `source_type` | `text` | `local` o `event`. |
| `local_id` | `uuid null` | Local si aplica. |
| `event_id` | `uuid null` | Evento si aplica. |
| `access_date` | `date` | Fecha reservada. |
| `quantity` | `integer` | Cantidad reservada. |
| `status` | `text` | Estado de reserva. |
| `expires_at` | `timestamptz` | Vencimiento. |
| `created_at` | `timestamptz` | Creacion. |
| `released_at` | `timestamptz null` | Liberacion. |

Estados recomendados:

- `reserved`;
- `consumed`;
- `released`;
- `expired`;
- `manual_hold`.

## 14. Entries, QR y check-in

`access_entries` representa la unidad validable por QR.

Reglas:

- cada entry tiene `checkin_token`;
- se usa `checkin_token` por continuidad con el repo;
- el QR puede codificar una URL que contiene ese token;
- la entry nace solo despues de pago aprobado o free pass confirmado;
- la entry arranca `issued`;
- el check-in arranca `unused`;
- una entry usada no puede anularse automaticamente;
- la emision debe ser idempotente por `(order_item_id, unit_index)`;
- callback duplicado no puede emitir QR duplicado.

Campos conceptuales:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador. |
| `order_id` | `uuid` | Orden asociada. |
| `order_item_id` | `uuid` | Linea asociada. |
| `unit_index` | `integer` | Indice idempotente dentro del item. |
| `checkin_token` | `uuid` | Token unico para QR/check-in. |
| `status` | `text` | `issued` o `voided`. |
| `checkin_status` | `text` | `unused` o `used`. |
| `access_date` | `date` | Fecha de validez. |
| `used_at` | `timestamptz null` | Uso. |
| `used_by` | `uuid null` | Actor que valido. |
| `voided_at` | `timestamptz null` | Anulacion. |
| `void_reason` | `text null` | Motivo. |
| `email_status` | `text` | Estado de envio. |
| `email_sent_at` | `timestamptz null` | Fecha de envio. |
| `created_at` | `timestamptz` | Creacion. |

Constraints conceptuales:

- unique `checkin_token`;
- unique `(order_item_id, unit_index)`;
- `unit_index > 0`;
- `status in ('issued', 'voided')`;
- `checkin_status in ('unused', 'used')`;
- entry `used` requiere `used_at`;
- entry `unused` no debe tener `used_at`;
- entry `voided` no puede estar usada.

## 15. Payment attempts

`payment_attempts` representa intentos contra proveedores de pago.

Reglas:

- es generico, no `access_payment_attempts`;
- soporta Bancard y futuros proveedores;
- una orden puede tener mas de un intento historico;
- una orden solo puede tener un intento Bancard activo a la vez;
- si un intento esta `pending_confirmation`, no se crea otro hasta query/reconciliacion;
- payloads tecnicos son visibles solo para admin Tairet;
- owner/local/staff solo ven estados comerciales.

Campos conceptuales:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador. |
| `order_id` | `uuid` | Orden asociada. |
| `provider` | `text` | Proveedor, inicialmente `bancard`. |
| `flow` | `text` | Flujo, inicialmente `single_buy`. |
| `shop_process_id` | `bigint` | Identificador numerico para Bancard. |
| `provider_process_id` | `text null` | ID devuelto por proveedor. |
| `amount_gs` | `bigint` | Monto interno. |
| `bancard_amount` | `text` | Monto para Bancard, ej. `"50000.00"`. |
| `currency` | `text` | Moneda. |
| `status` | `text` | Estado del intento. |
| `request_payload` | `jsonb null` | Payload inicial sanitizado. |
| `response_payload` | `jsonb null` | Respuesta inicial sanitizada. |
| `confirm_payload` | `jsonb null` | Confirmacion sanitizada. |
| `last_query_payload` | `jsonb null` | Ultima query sanitizada. |
| `rollback_payload` | `jsonb null` | Rollback sanitizado. |
| `expires_at` | `timestamptz null` | Vencimiento. |
| `confirmed_at` | `timestamptz null` | Confirmacion aprobada. |
| `manual_review_reason` | `text null` | Motivo de revision. |
| `created_at` | `timestamptz` | Creacion. |
| `updated_at` | `timestamptz` | Ultima actualizacion. |

`shop_process_id` debe generarse con una estrategia numerica unica, compatible con longitud Bancard y trazable hacia `payment_attempts`.

## 16. Admin Tairet

`platform_admin_users` modela admin/soporte de Tairet separado de owner/local/staff.

Reglas:

- no se asume que owner/local/staff son admin Tairet;
- admin Tairet puede ver payloads tecnicos Bancard;
- admin Tairet puede operar `manual_review`;
- soporte/admin Tairet puede reenviar entradas/QR internamente;
- owner/local/staff no ven `request_payload`, `response_payload`, `confirm_payload`, `rollback_payload`, tokens/hashes ni notas internas de manual review.

Campos conceptuales:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador. |
| `auth_user_id` | `uuid` | Usuario Supabase. |
| `email` | `text` | Email de referencia. |
| `role` | `text` | `admin` o `support`. |
| `active` | `boolean` | Habilitado. |
| `created_at` | `timestamptz` | Creacion. |
| `updated_at` | `timestamptz` | Ultima actualizacion. |

## 17. Estados recomendados

Usar `text CHECK` en vez de enums PostgreSQL para mantener consistencia con el repo y permitir ajustes con menor friccion durante el diseno.

### 17.1 `access_orders`

- `pending_payment`;
- `paid`;
- `cancelled`;
- `expired`;
- `manual_review`;
- futuro `refunded`.

### 17.2 `payment_attempts`

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

### 17.3 `access_stock_reservations`

- `reserved`;
- `consumed`;
- `released`;
- `expired`;
- `manual_hold`.

### 17.4 `access_entries`

- `issued`;
- `voided`.

### 17.5 Check-in

- `unused`;
- `used`.

### 17.6 Email

- `not_sent`;
- `sent`;
- `failed`.

## 18. Constraints e indices conceptuales

Constraints minimas:

- coherencia `source_type`, `local_id`, `event_id`;
- dinero interno en `bigint`;
- `price_gs >= 0`;
- `amount_gs >= 0`;
- `unit_price_gs >= 0`;
- `quantity > 0`;
- `entries_per_unit > 0`;
- `subtotal_gs = unit_price_gs * quantity`;
- unique `access_orders.public_ref`;
- unique `access_entries.checkin_token`;
- unique `(access_entries.order_item_id, access_entries.unit_index)`;
- unique `payment_attempts.shop_process_id`;
- unique parcial para intento activo por orden/proveedor/flujo.

Indices recomendados:

- `access_orders(public_ref)`;
- `access_orders(lower(buyer_email))`;
- `access_orders(source_type, local_id, access_date, status)`;
- `access_orders(source_type, event_id, access_date, status)`;
- `access_ticket_types(source_type, local_id, active, sort_order)`;
- `access_ticket_types(source_type, event_id, active, sort_order)`;
- `access_stock_limits(access_ticket_type_id, access_date)`;
- `access_stock_reservations(access_ticket_type_id, access_date, status, expires_at)`;
- `access_stock_reservations(order_id)`;
- `payment_attempts(shop_process_id)`;
- `payment_attempts(order_id, status)`;
- `payment_attempts(provider, flow, status, expires_at)`;
- `access_entries(checkin_token)`;
- `access_entries(order_id)`;
- `access_entries(order_item_id)`;
- `access_entries(access_date, status, checkin_status)`;
- `access_activity_events(order_id, created_at desc)`;
- `access_activity_events(entity_type, entity_id, created_at desc)`.

## 19. RPC futura: crear orden y reservar stock

RPC conceptual:

- `create_access_order_with_reservation`

No se define SQL definitivo en este documento.

Input conceptual:

- `source_type`;
- `local_id` o `event_id`;
- `access_date`;
- buyer fields;
- `items`;
- TTL de reserva, default 10 minutos.

Validaciones:

- source coherente;
- local abierto si source es `local`;
- evento disponible si source es `event`;
- buyer fields minimos;
- items no vacios;
- ticket types activos;
- ticket types pertenecen al source;
- moneda `PYG`;
- cantidades positivas;
- items repetidos se agregan por ticket type.

Transaccion:

1. Ordenar locks por `access_ticket_type_id`.
2. Bloquear filas relevantes con `FOR UPDATE`.
3. Calcular disponibilidad.
4. Crear `access_order`.
5. Crear `access_order_items`.
6. Crear `access_stock_reservations`.
7. Retornar orden y vencimiento.

Disponibilidad:

- si stock es `unlimited`, no falla por capacidad;
- si stock es `limited`, disponibilidad = `capacity - emitidas/pagadas - reservas activas no expiradas - manual_hold`;
- si cualquier item no alcanza, abortar toda la transaccion.

Errores conceptuales:

- `invalid_source`;
- `local_closed`;
- `event_not_available`;
- `ticket_type_inactive`;
- `invalid_quantity`;
- `currency_mismatch`;
- `insufficient_stock`.

## 20. RPC futura: emitir entries idempotentes

RPC conceptual:

- `issue_access_entries_for_paid_order`

No se define SQL definitivo en este documento.

Input conceptual:

- `order_id`;
- actor/proceso;
- motivo opcional.

Validaciones:

- orden existe;
- orden esta `paid`;
- no esta `manual_review`;
- si corresponde, existe intento de pago aprobado;
- items existen;
- no emitir si hay mismatch operativo.

Idempotencia:

- para cada item, crear `quantity * entries_per_unit` rows en `access_entries`;
- cada row usa `unit_index`;
- unique `(order_item_id, unit_index)` evita duplicados;
- si el callback llega duplicado, retorna entries existentes.

Efectos:

- reservas pasan a `consumed`;
- entries nacen `issued` y `unused`;
- se registra `entries_issued` en activity;
- email queda separado y no forma parte de la transaccion de pago.

## 21. Bloqueo de cierre de fecha

Flujo futuro conceptual:

- owner/local intenta cerrar `access_date`;
- backend consulta core `access_*`;
- si existen ordenes pagadas, entries emitidas o reservas activas/manual_hold para ese local y fecha, se bloquea el cierre directo;
- admin Tairet resuelve manualmente.

Debe considerarse bloqueo si existen:

- `access_orders.status in ('paid', 'manual_review')`;
- `access_entries.status = 'issued'`;
- `access_stock_reservations.status in ('reserved', 'manual_hold')`.

La resolucion admin puede incluir:

- mantener fecha;
- reprogramar;
- anular entradas no usadas;
- contactar compradores;
- registrar auditoria;
- reenviar entradas si aplica.

Cambiar una fecha no debe ser automatico ni silencioso.

## 22. RLS y visibilidad

Contrato conceptual:

- service role ejecuta callbacks, jobs y RPCs;
- admin Tairet tiene acceso completo;
- owner/local/staff ve solo estados comerciales de su local;
- staff/event owner ve solo estados comerciales de su evento;
- comprador publico no accede directo a tablas;
- comprador publico consulta estado por endpoint limitado usando `public_ref`;
- payloads Bancard solo salen por vistas o serializers admin;
- payloads tecnicos no aparecen en DTO owner/local/staff;
- activity publica/comercial debe estar sanitizada.

Se recomienda separar:

- vistas comerciales para panel owner/staff;
- vistas admin para soporte Tairet;
- serializers publicos de estado.

## 23. Relacion con Bancard

Bancard se apoya en:

- `access_orders`;
- `access_order_items`;
- `access_stock_reservations`;
- `payment_attempts`;
- `access_entries`;
- `access_activity_events`.

Flujo conceptual:

1. Backend crea orden y reserva stock.
2. Backend crea `payment_attempts` para Bancard.
3. Backend llama a Single Buy.
4. Frontend abre iframe con datos publicos minimos.
5. Bancard confirma server-to-server.
6. Backend valida hash, monto, moneda, `shop_process_id` y `response_code`.
7. Backend marca intento `approved`.
8. Backend marca orden `paid`.
9. Backend emite entries de forma idempotente.
10. Email se dispara aparte.
11. Query/reconciliacion opera sobre `payment_attempts`.
12. Rollback operativo registra payload y activity.

Factura electronica, token payment, promociones Bancard por entidad/BIN y otros flujos quedan futuros.

## 24. Relacion con modelos actuales

`orders` legacy:

- queda fuera de pagos reales con Bancard;
- puede seguir existiendo para historico o pre-relanzamiento;
- no debe ser base del nuevo checkout pago;
- no debe emitir QR de pago antes de confirmacion.

`event_orders`:

- puede quedar como piloto/manual temporal;
- no debe forzarse para discotecas;
- puede migrarse gradualmente al core `access_*`;
- sus patrones de `event_order_items`, `event_order_entries`, QR y check-in son referencias utiles.

`ticket_types`:

- queda como catalogo legacy de locales durante transicion;
- debe migrarse o adaptarse hacia `access_ticket_types`.

`event_ticket_types`:

- queda como catalogo legacy de eventos durante transicion;
- debe migrarse o adaptarse hacia `access_ticket_types`.

Endpoints legacy que no deben usarse para pagos reales:

- `/payments/callback`;
- `POST /orders` como checkout pago;
- recuperacion publica legacy de ordenes;
- cualquier flujo que dependa de `checkin_token` creado antes de pago confirmado.

## 25. Auditoria

`access_activity_events` registra eventos operativos del core.

Eventos recomendados:

- `order_created`;
- `stock_reserved`;
- `stock_released`;
- `stock_manual_hold`;
- `payment_attempt_created`;
- `single_buy_requested`;
- `single_buy_created`;
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
- `manual_review_opened`;
- `manual_review_resolved`;
- `entry_checked_in`;
- `entry_already_used_attempt`;
- `entry_voided`.

Campos conceptuales:

| Campo | Tipo PostgreSQL recomendado | Proposito |
| --- | --- | --- |
| `id` | `uuid` | Identificador. |
| `entity_type` | `text` | Entidad afectada. |
| `entity_id` | `uuid` | ID entidad. |
| `order_id` | `uuid null` | Orden relacionada. |
| `actor_type` | `text` | `system`, `customer`, `panel_user`, `platform_admin`, `provider`. |
| `actor_id` | `uuid null` | Actor si aplica. |
| `event_type` | `text` | Tipo de evento. |
| `previous_status` | `text null` | Estado anterior. |
| `new_status` | `text null` | Estado nuevo. |
| `reason` | `text null` | Motivo. |
| `payload` | `jsonb` | Metadata sanitizada. |
| `created_at` | `timestamptz` | Fecha. |

Payloads tecnicos completos del proveedor viven en `payment_attempts`, no en activity publica/comercial.

## 26. Reconciliacion, expiracion y rollback

La infraestructura concreta de cron, worker o job queda para otro slice.

Contrato:

- jobs consultan `access_orders`, `access_stock_reservations` y `payment_attempts`;
- una orden pendiente sin intento iniciado puede expirar y liberar stock;
- una orden con intento Bancard iniciado requiere query antes de liberar;
- si Bancard confirma aprobado, se marca orden pagada y se emiten entries;
- si Bancard confirma rechazo o inexistencia segura, se libera stock;
- si Bancard queda ambiguo, se abre `manual_review` y/o reserva `manual_hold`;
- rollback operativo no es politica comercial de refund;
- entry usada bloquea rollback automatico.

## 27. Factura y flujos futuros

El core no debe bloquear factura electronica futura.

Reglas:

- buyer fields se guardan separados del payload Bancard;
- billing fields pueden agregarse luego sin modificar `payment_attempts`;
- relacion pago-comprobante puede modelarse en tabla futura;
- no se envia billing a Bancard en el primer slice salvo requerimiento formal del proveedor.

Flujos futuros compatibles:

- token payment;
- otros proveedores;
- reembolsos comerciales;
- factura electronica;
- recuperacion publica tipo "Mis entradas";
- eventos multi-fecha con extension posterior.

## 28. Riesgos conocidos

Riesgos:

- migracion grande;
- duplicacion temporal con `event_*`;
- adapters mantenidos demasiado tiempo;
- RLS mal disenada;
- exposicion accidental de payloads tecnicos;
- ambiguedad de stock ante Bancard pendiente;
- performance del calculo de disponibilidad;
- free pass mezclado con entradas pagas;
- admin Tairet inexistente en el modelo actual;
- B2C actual limitado a free pass;
- cierre de fecha sin guard operativo si no se implementa RPC;
- drift entre catalogos legacy y `access_ticket_types`.

Mitigaciones:

- implementar por slices;
- usar views/serializers separados;
- definir deadline de migracion de adapters;
- mantener payloads tecnicos solo en rutas admin;
- usar reservas `manual_hold` para estados ambiguos;
- agregar indices antes de activar pagos;
- validar RLS en entorno real antes de produccion.

## 29. Orden posterior recomendado

Orden recomendado de slices:

1. `platform_admin_users`.
2. `access_ticket_types`.
3. `access_orders`, `access_order_items`, `access_entries`.
4. `access_stock_limits`, `access_stock_reservations`.
5. `payment_attempts`.
6. `access_activity_events`.
7. RLS y views seguras.
8. RPC de reserva atomica.
9. RPC de emision idempotente.
10. Adapters/catalog.
11. API create access order.
12. Bancard Single Buy.
13. Iframe Bancard.
14. Callback Bancard.
15. Pantalla de estado.
16. Admin/support.
17. Reconciliacion/query.
18. Rollback operativo.

Ningun slice posterior debe debilitar la separacion entre orden comercial, intento de pago, entry validable, check-in, email y auditoria.

## 30. Preguntas abiertas

- Si `access_ticket_types` reemplaza catalogos legacy desde el primer slice o entra con adapters temporales.
- Duracion final de reservas en produccion.
- Retencion final de payloads tecnicos del proveedor.
- Infraestructura final de reconciliacion: cron, worker, queue o job interno.
- Reglas avanzadas de reprogramacion de fecha.
- Politica comercial futura de refunds.
- Modelo final de factura electronica.

Estas preguntas no cambian la decision principal: el nuevo checkout pago debe nacer sobre el core `access_*`.
