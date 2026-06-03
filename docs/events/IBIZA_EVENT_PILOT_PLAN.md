# Ibiza Event Pilot: primer evento puntual de Tairet

## 1. Propósito

Este documento aterriza la vertical **Eventos puntuales** al primer piloto concreto: **Ibiza**.

El piloto debe validar que Tairet puede operar un evento independiente con panel propio reducido, emisión manual de entradas, QR individual por asistente, envío automático por email, soporte para envío por WhatsApp, check-in, historial operativo, export owner-only y métricas simples.

Este paso es solo documentación. No implementa código, SQL, migraciones, endpoints, frontend, B2C, pagos ni cambios en `/payments/callback`.

## 2. Alcance del piloto Ibiza

Datos del evento:

- Nombre: Ibiza.
- Fecha: sábado 1 de agosto de 2026.
- Inicio: 20:00, hora local.
- Cierre estimado: madrugada, hora final pendiente.
- Lugar: Centro de Eventos de Mariscal López.
- Organizador: Tahiel.
- Evento independiente: sí.
- Asociado a bar/discoteca: no.
- B2C público del evento: no por ahora.
- Panel propio reducido: sí.
- Venta: externa por WhatsApp + transferencia.
- Pasarela de pago integrada: fuera de alcance.
- Mesas VIP: dentro del piloto como paquetes comerciales de 10 accesos, sin seating map.

Capacidad comercial actualizada:

- General: 2.400 accesos QR.
- VIP individual: 600 accesos QR.
- Mesas VIP: 20 mesas x 10 accesos = 200 accesos QR.
- Total máximo: 3.200 accesos QR.

Productos comerciales:

- 9 productos/ticket types: 3 fases General, 3 fases VIP y 3 fases Mesa VIP.
- General/VIP individual se venden como `single_entry` con `entries_per_unit = 1`.
- Mesa VIP se vende como `package` con `entries_per_unit = 10`.
- Los precios deben quedar como campos configurables/editables.

Operación esperada:

- 2 o 3 personas usarán el panel.
- Se necesita check-in en puerta.
- Se necesita QR individual.
- Se necesita export de compradores/asistentes.
- No se venderá por otro sistema.
- El plazo de implementación depende de Tairet.

### Distribución comercial actualizada

General: 2.400 entradas/accesos en total.

| Producto | Stock comercial | Accesos por unidad | Precio |
| --- | ---: | ---: | ---: |
| General Preventa 1 | 900 | 1 | 140000 PYG |
| General Preventa 2 | 1000 | 1 | 180000 PYG |
| General Precio Final | 500 | 1 | 220000 PYG |

VIP individual: 600 entradas/accesos en total.

| Producto | Stock comercial | Accesos por unidad | Precio |
| --- | ---: | ---: | ---: |
| VIP Preventa 1 | 200 | 1 | 350000 PYG |
| VIP Preventa 2 | 250 | 1 | 440000 PYG |
| VIP Precio Final | 150 | 1 | 520000 PYG |

Mesas VIP: 20 mesas en total. Cada mesa se vende como paquete de 10 accesos.

| Producto | Stock comercial | Accesos por unidad | Precio comercial | Precio equivalente por acceso |
| --- | ---: | ---: | ---: | ---: |
| Mesa VIP Preventa 1 | 6 | 10 | 3200000 PYG | 320000 PYG |
| Mesa VIP Preventa 2 | 8 | 10 | 3800000 PYG | 380000 PYG |
| Mesa VIP Precio Final | 6 | 10 | 4500000 PYG | 450000 PYG |

Totales:

- General: 2.400 accesos QR.
- VIP individual: 600 accesos QR.
- Mesas VIP: 200 accesos QR.
- Total accesos QR: 3.200.
- Total máximo comercial estimado General: 416000000 PYG.
- Total máximo comercial estimado VIP: 258000000 PYG.
- Total máximo comercial estimado Mesas VIP: 76600000 PYG.
- Total máximo comercial estimado: 750600000 PYG.

## 3. Decisiones de producto documentadas

Decisiones para Ibiza:

- Ibiza debe tratarse como evento independiente.
- Ibiza debe operar por `event_id`, no por `local_id`.
- No se debe crear un local falso llamado Ibiza.
- No se debe extender `locals.type` para resolver este piloto.
- El pago externo por transferencia debe modelarse como flujo manual temporal.
- El flujo manual no debe bloquear un futuro checkout online.
- Cada entrada/persona debe tener QR propio.
- Producto comercial vendido no es lo mismo que unidad validable en puerta.
- Mesas VIP deben modelarse como paquetes comerciales que generan QRs individuales.
- El panel debe ser reducido y enfocado en evento.
- El B2C público del evento queda fuera por ahora.
- La pasarela de pago queda fuera de este piloto.
- Tairet no valida dinero en este piloto; el organizador confirma el pago fuera de Tairet.
- Tairet emite QR solo cuando el organizador confirma manualmente que corresponde emitir la entrada.

## 4. Ventanas y fechas

Separar explícitamente estas ventanas:

- `starts_at`: 2026-08-01 20:00, hora local.
- `ends_at`: madrugada, pendiente de hora final.
- `checkin_valid_from`: 2026-08-01 18:00, hora local.
- `checkin_valid_to`: 2026-08-02 06:00, hora local.
- `sales_start`: pendiente.
- `sales_end`: pendiente.

Reglas:

- No usar una ventana artificial de un mes como `intended_date`.
- No falsear la fecha del evento para encajar en flujos de discoteca.
- Si el evento cambia de fecha, se deben actualizar `starts_at`, `ends_at`, `checkin_valid_from`, `checkin_valid_to`, `sales_start` y `sales_end` según corresponda.

## 5. Flujo operativo documentado

Flujo manual del piloto:

1. Cliente escribe por WhatsApp al organizador.
2. Cliente indica producto comercial y cantidad: General, VIP o Mesa VIP por fase de preventa.
3. Cliente transfiere fuera de Tairet.
4. Cliente envía comprobante y datos de asistentes al organizador.
5. Organizador confirma el pago fuera de Tairet.
6. Organizador entra al panel de evento de Tairet.
7. Organizador emite una entrada individual o varias entradas.
8. Tairet genera un QR por cada entrada/persona.
9. Tairet envía automáticamente cada QR por email.
10. El panel muestra el QR para copiar/descargar/enviar por WhatsApp.
11. El día del evento, staff valida QR en puerta.
12. Si hay problema, staff busca por email/documento.
13. Historial registra emisión, email enviado, validación e intentos duplicados.
14. Owner exporta compradores, check-ins y pendientes.

Datos iniciales por asistente:

- nombre;
- apellido;
- email;
- teléfono;
- documento.

Decisión inicial:

- Pedir los cinco datos para mejorar búsqueda, identificación y soporte en puerta.
- Si hay mucha fricción del público, evaluar volver teléfono o documento opcional en un slice posterior.

Compra de varias entradas:

- Una persona puede comprar varias entradas.
- Si compra 4 entradas, se deben cargar los datos de 4 asistentes.
- Se deben generar 4 QRs.
- No se recomienda QR grupal para este piloto.

Compra de mesas:

- Una Mesa VIP se vende como una unidad comercial.
- Cada Mesa VIP genera 10 accesos/QRs individuales.
- Si compra 2 Mesas VIP, se deben generar 20 `event_order_entries`.
- No se debe modelar una mesa como 10 entradas sueltas sin vínculo comercial.
- El vínculo comercial debe vivir en `event_order_items`.

## 6. Modelo recomendado para el piloto

Recomendación principal:

- `events`
- `event_ticket_types`
- `event_orders`
- `event_order_items`
- `event_order_entries`
- `event_panel_users`

### `events`

Representa Ibiza como evento independiente.

Campos conceptuales para Ibiza:

- `id`
- `title`: Ibiza
- `slug`
- `description`
- `starts_at`
- `ends_at`
- `checkin_valid_from`
- `checkin_valid_to`
- `location_name`: Centro de Eventos de Mariscal López
- `address`
- `organizer_name`: Tahiel
- `local_id`: null
- `status`: `draft | published | paused | finished`
- `created_at`
- `updated_at`

### `event_ticket_types`

Representa los productos comerciales vendidos.

Tipos actualizados para Ibiza:

- General Preventa 1.
- General Preventa 2.
- General Precio Final.
- VIP Preventa 1.
- VIP Preventa 2.
- VIP Precio Final.
- Mesa VIP Preventa 1.
- Mesa VIP Preventa 2.
- Mesa VIP Precio Final.

Campos conceptuales:

- `id`
- `event_id`
- `name`
- `description`
- `price`
- `currency`
- `stock`
- `active`
- `sales_start`
- `sales_end`
- `sales_unit_type`: `single_entry | package`
- `entries_per_unit`
- `created_at`
- `updated_at`

Reglas:

- Stock y precios deben ser configurables.
- `stock` mide unidades comerciales, no QRs.
- `price` mide el precio de la unidad comercial.
- `single_entry` implica `entries_per_unit = 1`.
- `package` implica `entries_per_unit > 1`.
- Para Mesas VIP, `stock` mide mesas y `entries_per_unit = 10`.
- El backend/DB debe impedir superar stock comercial.
- No depender del frontend para evitar sobreventa.
- `sold_count` solo debe persistirse si se mantiene transaccionalmente; si no, calcular desde entradas emitidas válidas.

### `event_orders`

Representa la operación de emisión/compra manual.

Uso en Ibiza:

- Agrupa una emisión manual.
- Puede incluir una o varias entradas.
- Puede representar la confirmación externa de transferencia.
- No debe almacenar comprobante en el piloto.

Campos conceptuales:

- `id`
- `event_id`
- `source`: `manual_issue`
- `payment_method`: `manual_transfer`
- `payment_status`: `confirmed_externally`
- `created_by`: panel user
- `buyer_name`
- `buyer_last_name`
- `buyer_email`
- `buyer_phone`
- `buyer_document`
- `notes` opcional y sanitizable
- `created_at`
- `updated_at`

### `event_order_items`

Representa cada línea comercial dentro de una orden.

Ejemplos:

- 1 Mesa VIP Preventa 1.
- 4 General Preventa 2.
- 2 VIP Precio Final.

Campos conceptuales:

- `id`
- `event_id`
- `event_order_id`
- `event_ticket_type_id`
- `quantity`
- `unit_price_amount`
- `currency`
- `entries_per_unit`
- `total_amount`
- `created_at`
- `updated_at`

Reglas:

- Producto comercial vendido no es lo mismo que unidad validable.
- `event_order_items` conserva el snapshot comercial de lo vendido.
- `total_amount = quantity * unit_price_amount`.
- Las mesas deben quedar vinculadas a su línea comercial.
- Para 1 Mesa VIP Preventa 1: `quantity = 1`, `entries_per_unit = 10`, `total_amount = 3200000`.
- Para 4 General Preventa 2: `quantity = 4`, `entries_per_unit = 1`, `total_amount = 720000`.

### `event_order_entries`

Representa cada entrada/QR individual. Es la unidad validable.

Punto clave:

- Una orden puede agrupar varias entradas.
- Una línea comercial puede generar una o varias entradas.
- El check-in debe validar entradas individuales.
- Cada `event_order_entry` debe tener su propio QR.

Campos conceptuales:

- `id`
- `event_id`
- `event_order_id`
- `event_ticket_type_id`
- `attendee_name`
- `attendee_last_name`
- `attendee_email`
- `attendee_phone`
- `attendee_document`
- `status`: `issued | voided`
- `checkin_status`: `unused | used`
- `checkin_token`
- `used_at`
- `used_by`
- `email_sent_at`
- `created_at`
- `updated_at`

Reglas:

- Preferir un QR por persona para mejor control de puerta.
- No usar QR grupal en el piloto.
- Validar por `event_order_entry`, no por orden completa.
- Para entradas individuales, `quantity 4` genera 4 entries.
- Para mesas, `quantity 1` genera 10 entries y `quantity 2` genera 20 entries.
- `unit_price_amount` en entries puede guardar el precio equivalente por acceso.
- No exponer `checkin_token` en export ni activity metadata.

### `event_panel_users`

Representa usuarios operativos del panel de Ibiza.

Campos conceptuales:

- `id`
- `event_id`
- `auth_user_id`
- `role`: `owner | staff`
- `display_name`
- `created_at`
- `updated_at`

Reglas:

- `owner` puede exportar.
- `staff` puede emitir/validar si se decide permitirlo operativamente.
- `staff` no debe exportar si se mantiene política owner-only.
- Organizador es concepto de negocio; owner/staff son permisos operativos.

## 7. Decisiones técnicas evaluadas

### `event_orders` vs extender `orders`

Recomendación para Ibiza: usar `event_orders` y `event_order_entries`.

Motivo:

- `orders` actual está acoplado a `local_id`.
- Ibiza no tiene local asociado.
- La ventana de evento no debe falsearse como `intended_date`.
- El check-in debe operar por entrada/persona.
- La separación reduce riesgo de contaminar flujos de bares/discotecas.

La extensión de `orders` puede reevaluarse en un slice técnico futuro si se generaliza correctamente para eventos.

### `event_order_entries` como unidad validable

Recomendación: sí.

Motivo:

- Evita ambigüedad con compras múltiples.
- Permite QR individual.
- Permite check-in preciso por persona.
- Simplifica búsqueda y soporte en puerta.

### `event_panel_users` vs adaptar `panel_users`

Recomendación para Ibiza: `event_panel_users`.

Motivo:

- `panel_users` actual está ligado a `local_id`.
- Un usuario puede operar locales y eventos.
- El piloto debe validar tenant por `event_id`.

### Activity log propio vs extender `operational_activity_events`

Recomendación preliminar: preferir activity de evento o extensión explícita con `event_id` en slice propio.

Para Ibiza, el contrato debe quedar listo para eventos como:

- `event_entry_issued`
- `event_entry_email_sent`
- `event_entry_checked_in`
- `event_entry_already_used_attempt`
- `event_entry_voided`, si se agrega anulación
- `event_entry_corrected`, si se agrega corrección

No asumir que `operational_activity_events` actual sirve sin cambios, porque hoy está atado a `local_id` y a `entity_type = order | reservation`.

### Emisión individual vs emisión múltiple

Recomendación: implementar ambas.

- Emisión individual para casos simples y correcciones.
- Emisión múltiple para reducir fricción operativa con ventas de varias entradas.

Futuro posible:

- Import CSV si la carga manual de 3200 entradas resulta pesada.

### Teléfono/documento obligatorios u opcionales

Decisión inicial:

- Nombre, apellido, email, teléfono y documento obligatorios.

Decisión futura:

- Evaluar si teléfono o documento pasan a opcionales según fricción real.

## 8. Compatibilidad con pago online futuro

El flujo manual debe evolucionar sin cambiar la lógica de entrada, QR, check-in, historial ni export.

Hoy, piloto manual:

- `source = manual_issue`
- `payment_method = manual_transfer`
- `payment_status = confirmed_externally`
- `created_by = panel_user`

Futuro con pasarela:

- `source = online_checkout`
- `payment_method = bancard | dinelco | otro futuro`
- `payment_status = paid`
- `created_by = system/customer flow`

Principio:

- La forma de pago crea la orden.
- La línea comercial queda en `event_order_items`.
- La entrada individual sigue siendo `event_order_entry`.
- El QR y check-in funcionan igual.
- El historial y export funcionan igual.

Esto evita que el piloto manual sea un callejón sin salida.

## 9. Panel reducido propuesto

### Inicio

Debe mostrar:

- total emitidas;
- VIP emitidas;
- General emitidas;
- Mesas VIP vendidas;
- accesos generados por mesas;
- usadas/check-ins;
- pendientes;
- stock restante;
- porcentaje validado;
- estado del evento.

### Entradas

Debe permitir:

- emitir entrada;
- emitir varias entradas;
- buscar por nombre/email/documento;
- filtrar por producto/tipo General/VIP/Mesa VIP;
- filtrar por usada/no usada;
- ver QR;
- reenviar email;
- copiar/descargar QR;
- validar manualmente;
- ver historial por entrada.

### Check-in

Debe incluir:

- scanner QR;
- resultado claro PASS;
- estado ya usada;
- estado inválida;
- estado fuera de ventana;
- contador operativo.

### Historial

Debe mostrar:

- actividad por entrada;
- eventos operativos;
- actor visible;
- metadata sanitizada;
- sin PII innecesaria;
- sin token.

### Export

Debe ser:

- owner-only;
- compradores/asistentes;
- tipo de entrada;
- estado;
- fecha emisión;
- fecha validación;
- usada/no usada;
- sin `checkin_token`.

### Perfil/configuración del evento

Debe permitir configurar:

- nombre;
- fecha;
- ubicación;
- organizer;
- tipos de entrada;
- stock;
- precios;
- paquetes y accesos por unidad;
- ventana de validación.

## 10. Email QR, WhatsApp y export

### Email QR

El QR debe salir desde Tairet automáticamente al email de cada asistente.

El email debe incluir:

- nombre del evento;
- fecha;
- lugar;
- tipo de entrada;
- QR;
- instrucciones simples.

Reglas:

- No exponer token raw si no hace falta.
- Un fallback con código o link seguro solo debe agregarse si existe un patrón validado.
- Registrar `event_entry_email_sent` en historial cuando aplique.

### WhatsApp

El panel debe mostrar el QR para que el organizador pueda:

- copiarlo;
- descargarlo;
- enviarlo manualmente por WhatsApp al cliente.

WhatsApp no reemplaza el email automático; es canal operativo complementario.

### Export

Campos candidatos:

- nombre;
- apellido;
- email;
- teléfono;
- documento;
- producto comercial;
- tipo de acceso;
- estado de emisión/pago externo;
- estado de check-in;
- fecha de emisión;
- fecha de validación.

No incluir:

- `checkin_token`;
- QR raw;
- IDs internos innecesarios;
- metadata cruda.

## 11. Activity log

Eventos sugeridos:

- `event_entry_issued`
- `event_entry_email_sent`
- `event_entry_checked_in`
- `event_entry_already_used_attempt`
- `event_entry_voided`, si se agrega anulación
- `event_entry_corrected`, si se agrega corrección

Política:

- No PII innecesaria en metadata.
- No `checkin_token`.
- No QR raw.
- No guardar método QR/manual salvo decisión futura explícita.
- Actor label seguro.
- Actor de panel con rol `owner` o `staff`.

Historial mínimo por entrada:

- cuándo se emitió;
- quién la emitió;
- si se envió email;
- cuándo se validó;
- quién validó;
- intentos duplicados.

## 12. Fricciones y decisiones pendientes

### Carga manual de 3200 entradas

Riesgo:

- Cargar manualmente muchas entradas puede ser pesado.

Mitigación inicial:

- Emisión múltiple.

Futuro posible:

- Import CSV.

### Datos obligatorios

Riesgo:

- Pedir todos los datos puede generar fricción.

Decisión inicial:

- Pedir nombre, apellido, email, teléfono y documento.

Decisión futura:

- Evaluar si teléfono o documento pasan a opcionales.

### Staff de puerta

Riesgo:

- 2 o 3 validadores puede ser justo para 3200 personas si hay pico fuerte.

Recomendación:

- Considerar 3 o 4 validadores.
- Mantener búsqueda manual lista.
- Mantener validación manual lista.

### Pago externo

Riesgo:

- Sin pasarela, Tairet no valida dinero.

Decisión:

- El organizador asume confirmación de pago externo.
- Tairet emite QR solo cuando el organizador confirma.

### Stock y precios

Riesgo:

- Stock/precios pueden cambiar.

Decisión:

- Deben ser configurables.
- Debe existir protección contra sobreventa.
- Stock se descuenta por unidades comerciales, no por cantidad de QRs.

### Mesas como paquetes

Riesgo:

- Tratar una Mesa VIP como 10 entradas sueltas perdería métricas comerciales de mesas vendidas.

Decisión:

- Modelar Mesa VIP como producto comercial `package`.
- Generar 10 QRs individuales por mesa.
- Mantener vínculo comercial con `event_order_items`.

### QR por persona

Riesgo:

- Es más operable en puerta, pero exige datos por asistente.

Decisión:

- Mantener QR por persona como recomendación inicial.

## 13. Roadmap técnico por slices

### Slice 0 - Documento piloto Ibiza

Crear este documento con alcance, decisiones, modelo, flujo operativo, riesgos, QA y no-goals.

### Slice 1 - Decisión técnica de entidades

Cerrar `event_orders`, `event_order_entries`, `event_panel_users`, activity y tenant checks por `event_id`.

### Slice 2 - DB mínima para evento Ibiza

Estado: Slice 1B aplicado y validado para base mínima.

### Slice 2.1 - Ajuste preventas, paquetes y order items

Estado: aplicado y validado en Slice 1B.2 / migración 028.

Se agrego soporte DB para:

- agregar `sales_unit_type` a `event_ticket_types`;
- agregar `entries_per_unit` a `event_ticket_types`;
- crear `event_order_items`;
- vincular `event_order_entries` con `event_order_items`;
- mantener `event_order_entries` como unidad validable.

### Slice 3 - Provisioning Ibiza

Estado: aplicado y validado.

Se creo/aseguro evento Ibiza, 9 productos/ticket types y `event_panel_users` owner/staff, sin crear orders, order items, entries ni QRs.

QA registrado:

- auth users requeridos existen;
- evento Ibiza correcto;
- 9 productos con stocks, precios, `sales_unit_type` y `entries_per_unit` correctos;
- total de accesos potenciales = 3200;
- total comercial estimado = 750600000 PYG;
- 1 owner y 4 staff vinculados al evento;
- `event_orders = 0`;
- `event_order_items = 0`;
- `event_order_entries = 0`;
- re-ejecucion no duplica evento, tickets ni memberships.

### Slice 2A - eventPanelAuth, requireEventRole y endpoint protegido mínimo

Estado: implementado, fix de regex UUID aplicado, deployado y QA runtime PASS.

Se implemento:

- `eventPanelAuth`;
- `requireEventRole`;
- `GET /panel/events/:eventId/me`.

Endpoint validado:

- `GET /panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/me`

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}` y `x-request-id` presente;
- owner Ibiza -> `200 OK`, `event.slug = ibiza`, `membership.role = owner`, `membership.display_name = Owner Ibiza`;
- staff Ibiza -> `200 OK`, `event.slug = ibiza`, `membership.role = staff`, `membership.display_name = Staff Ibiza 1`;
- respuestas `200` sin `auth_user_id`, email, token, `access_token`, `refresh_token`, `local_id`, orders, order items, entries ni `checkin_token`;
- sin `Authorization` -> `401`;
- token invalido -> `401`;
- `not-a-uuid` -> `400 Invalid eventId`;
- owner local de D'Lirio sin membership de evento -> `403 User not authorized for event access`;
- evento inexistente con UUID valido -> `404 Event not found`;
- regresion panel local: `/panel/me` y `/panel/orders/summary` con owner local -> `200 OK`.

Tenant safety registrado:

- `eventPanelAuth` valida membresia por `event_id + auth_user_id`;
- `requireEventRole` valida roles `owner | staff` por evento;
- `panel_users` y `local_id` no otorgan acceso a eventos;
- panel local existente no se rompio.

### Slice 2B - endpoints read-only de evento

Estado: implementado, deployado y QA runtime PASS.

Endpoints implementados:

- `GET /panel/events/:eventId/summary`;
- `GET /panel/events/:eventId/ticket-types`.

Ambos usan:

- `eventPanelAuth`;
- `requireEventRole(["owner", "staff"])`.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}` y `x-request-id` presente;
- `/summary` owner Ibiza -> `200 OK`;
- `/summary` staff Ibiza -> `200 OK`;
- `/ticket-types` owner Ibiza -> `200 OK`;
- `/ticket-types` staff Ibiza -> `200 OK`;
- sin `Authorization` -> `401` en ambos endpoints;
- token invalido -> `401` en ambos endpoints;
- `not-a-uuid` -> `400 Invalid eventId` en ambos endpoints;
- owner local de D'Lirio sin membership de evento -> `403` en ambos endpoints;
- evento inexistente con UUID valido -> `404 Event not found` en ambos endpoints;
- regresion panel local: `/panel/me` y `/panel/orders/summary` con owner local -> `200 OK`.

Cálculos registrados:

- `catalog.ticket_type_count = 9`;
- `catalog.commercial_units_stock = 3020`;
- `catalog.potential_qr_accesses = 3200`;
- `catalog.potential_commercial_amount = 750600000`;
- `catalog.currency = PYG`;
- `operations.orders_count = 0`;
- `operations.order_items_count = 0`;
- `operations.entries_count = 0`;
- `operations.issued_commercial_amount = 0`;
- General Preventa 1: `stock = 900`, `potential_qr_accesses = 900`, `potential_commercial_amount = 126000000`;
- VIP Preventa 1: `stock = 200`, `potential_qr_accesses = 200`, `potential_commercial_amount = 70000000`;
- Mesa VIP Preventa 1: `stock = 6`, `sales_unit_type = package`, `entries_per_unit = 10`, `potential_qr_accesses = 60`, `potential_commercial_amount = 19200000`.

No exposicion sensible registrada:

- `/summary` y `/ticket-types` no exponen `auth_user_id`, email, token, `access_token`, `refresh_token`, `checkin_token`, `local_id`, buyer PII, attendee PII ni metadata.

Tenant safety registrado:

- owner/staff de Ibiza pueden acceder;
- usuarios locales sin membership no acceden;
- `panel_users` y `local_id` no otorgan acceso a Eventos.

Alcance protegido:

- no se crean ni modifican datos operativos;
- no se crean orders, order items, entries, QRs, emails, activity ni exports.

### Slice 3A - contrato de emision manual

Estado: cerrado.

Se creo `docs/events/IBIZA_MANUAL_ISSUE_CONTRACT_PLAN.md` y quedo definido:

- endpoint futuro `POST /panel/events/:eventId/orders/manual-issue`;
- input buyer + items + attendees;
- reglas de precios y snapshots;
- stock por unidades comerciales;
- QR/acceso individual por `event_order_entry`;
- no exposicion de `checkin_token`;
- no-goals de email QR, check-in, export, activity, frontend, pagos y `/payments/callback`.

### Slice 3B.1 - RPC issue_event_manual_order

Estado: migracion 029 aplicada y QA DB PASS.

Se creo la RPC:

- `public.issue_event_manual_order(uuid, uuid, jsonb, jsonb, text)`

QA DB registrado:

- RPC encontrada;
- `anon_can_execute = false`;
- `authenticated_can_execute = false`;
- `service_role_can_execute = true`;
- QA transaccional grande ejecutado con `begin; ... rollback;`;
- resultado `Success. No rows returned`;
- sin errores `FAIL`;
- Ibiza quedo `slug = ibiza`, `title = Ibiza`, `status = draft`;
- `qa_orders = 0`.

Comportamiento validado:

- emision manual General;
- emision Mesa/package con cantidad correcta de entries;
- bloqueo de attendees invalidos;
- bloqueo de sobreventa;
- bloqueo de ticket type de otro evento;
- bloqueo de actor sin membership;
- bloqueo de evento no operable;
- no exposicion de `checkin_token`, PII de asistentes, `auth_user_id`, `local_id` ni metadata cruda;
- rollback limpio sin datos parciales.

### Slice 3B.2 - endpoint manual-issue

Estado: implementado, deployado y QA runtime PASS completo.

Endpoint validado:

- `POST /panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/orders/manual-issue`

Se valido que:

- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- llama a RPC `issue_event_manual_order`;
- crea `event_orders`, `event_order_items` y `event_order_entries`;
- no duplica logica transaccional/stock en TS;
- devuelve respuesta segura sin `checkin_token` ni PII sensible no permitida.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente;
- pre-check summary en cero: `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`;
- owner Ibiza emitio 1 General Preventa 1 con `201 Created`, `order.total_amount = 140000`, `items.length = 1`, `entries.length = 1`;
- staff Ibiza emitio 1 Mesa VIP Preventa 1 con `201 Created`, `order.total_amount = 3200000`, `items.length = 1`, `entries.length = 10`, `unit_price_amount` por entry = `320000`;
- despues de 3 ordenes QA, summary mostro `orders_count = 3`, `order_items_count = 3`, `entries_count = 12`, `issued_commercial_amount = 3480000`;
- General Preventa 1 mostro `issued_commercial_units = 2`, `issued_qr_accesses = 2`, `remaining_commercial_units = 898`;
- Mesa VIP Preventa 1 mostro `issued_commercial_units = 1`, `issued_qr_accesses = 10`, `remaining_commercial_units = 5`;
- Mesa con 9 attendees -> `400 invalid_attendees_count`;
- ticket inexistente/no perteneciente -> `404 ticket_type_not_found`;
- owner local de D'Lirio sin membership -> `403`;
- sin auth -> `401`;
- token invalido -> `401`;
- eventId invalido -> `400 Invalid eventId`;
- stock insuficiente -> `409 insufficient_stock`;
- evento inexistente -> `404 Event not found`;
- `/panel/me` y `/panel/orders/summary` local siguieron en `200 OK`.

No exposicion sensible registrada:

- respuestas `201` no exponen `checkin_token`, buyer email/phone/document, attendee email/phone, `auth_user_id`, `local_id` ni metadata;
- `attendee.name`, `attendee.last_name` y `attendee.document` aparecen y quedan permitidos por contrato.

Limpieza QA registrada:

- se limpiaron las 3 ordenes QA marcadas;
- summary volvio a `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`;
- General Preventa 1 volvio a `issued_commercial_units = 0`, `issued_qr_accesses = 0`, `remaining_commercial_units = 900`;
- Mesa VIP Preventa 1 volvio a `issued_commercial_units = 0`, `issued_qr_accesses = 0`, `remaining_commercial_units = 6`.

### Slice 3C.2 - endpoint `/entries`

Estado: implementado, deployado y QA runtime PASS.

Endpoint validado:

- `GET /panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/entries`

Se valido que:

- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- lista entries emitidas por evento;
- permite busqueda, filtros y paginacion;
- devuelve `entry`, `attendee`, `buyer`, `order` e `item`;
- no expone `checkin_token`, `auth_user_id`, `local_id` ni metadata cruda;
- no crea ni modifica datos.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente;
- estado inicial sin entries: owner Ibiza recibio `200 OK`, `items = []`, `pagination.total = 0`, `pagination.total_pages = 0`;
- se creo una orden QA via `manual-issue`, `201 Created`, con 1 entry `General Preventa 1`, `issued/unused`, `qr_status = pending_qr_resource`;
- owner Ibiza y staff Ibiza listaron `/entries` con `200 OK`, `pagination.total = 1`;
- busquedas `q=QA-SLICE-3C2`, `q=qa.slice3c2.entries@example.com` y `q=Entry` encontraron la entry QA;
- filtros `ticket_type_id`, `status=issued` y `checkin_status=unused` respondieron `200 OK`;
- `page=1&page_size=1` respondio `200 OK`, `pagination.total = 1`, `pagination.total_pages = 1`;
- query params invalidos `status=bad`, `checkin_status=bad`, `page_size=101`, `q=a` y `unknown=1` respondieron `400 invalid_query`;
- sin auth -> `401`;
- token invalido -> `401`;
- owner local sin membership del evento -> `403`;
- eventId invalido -> `400 Invalid eventId`;
- evento inexistente -> `404 Event not found`;
- `/summary`, `/ticket-types`, `/panel/me` local y `/panel/orders/summary` local siguieron en `200 OK`.

No exposicion sensible registrada:

- no aparece `checkin_token`;
- no aparece `used_by_auth_user_id`;
- no aparece `created_by_auth_user_id`;
- no aparece `auth_user_id`;
- no aparece `local_id`;
- no aparece metadata cruda.

Limpieza QA registrada:

- se limpio la orden QA del slice;
- `/entries` volvio a `items = []`;
- `pagination.total = 0`;
- `pagination.total_pages = 0`;
- Ibiza quedo nuevamente sin ordenes emitidas.

### Slice 3D.2 - endpoint QR visual PNG por entry

Estado: implementado, deployado y QA runtime PASS.

Endpoint validado:

- `GET /panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/entries/:entryId/qr`

Se valido que:

- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- valida `entryId` como UUID;
- busca la entry por `id + event_id`;
- genera QR visual PNG server-side;
- responde `image/png`;
- no devuelve JSON con `checkin_token`;
- no modifica datos;
- no implementa email;
- no implementa check-in.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente;
- estado inicial limpio: `/entries` -> `200 OK`, `items = []`, `pagination.total = 0`, `pagination.total_pages = 0`;
- se creo una orden QA via `manual-issue`, `201 Created`, con entry `b790e704-0c39-4d14-88e3-864a0975545d`, `General Preventa 1`, `issued/unused`, `qr_status = pending_qr_resource`;
- owner Ibiza obtuvo QR PNG con `200 OK`, `Content-Type = image/png`, `Cache-Control = no-store`, `X-Content-Type-Options = nosniff`, `Content-Disposition = inline; filename="tairet-event-entry-qr.png"`, `Content-Length = 3940`;
- archivo `qa-3d2-owner-qr.png` se abrio correctamente como QR;
- staff Ibiza obtuvo QR PNG con `200 OK`, `Content-Type = image/png`, `Content-Length = 3940`, archivo `qa-3d2-staff-qr.png`;
- `entryId` invalido -> `400 invalid_entry_id`;
- entry inexistente -> `404 entry_not_found`;
- owner local de D'Lirio sin membership -> `403`;
- sin auth -> `401`;
- token invalido -> `401`;
- eventId invalido -> `400 Invalid eventId`;
- evento inexistente -> `404 Event not found`;
- QR GET no modifico la entry: `status = issued`, `checkin_status = unused`, `used_at = null`, `pagination.total = 1`;
- `/summary`, `/ticket-types`, `/entries`, `/panel/me` local y `/panel/orders/summary` local siguieron en `200 OK`.

No exposicion sensible registrada:

- respuesta exitosa es PNG, no JSON;
- no aparece `checkin_token`;
- no aparece `auth_user_id`;
- no aparece `local_id`;
- no aparece metadata cruda;
- no aparece email, phone, document ni token como texto.

Limpieza QA registrada:

- se limpio la orden QA del slice;
- `/entries` volvio a `items = []`;
- `pagination.total = 0`;
- `pagination.total_pages = 0`;
- Ibiza quedo nuevamente sin ordenes emitidas.

### Slice 3D.3A - send-email QR por entry

Estado: implementado, deployado y QA runtime PASS completo.

Endpoint validado:

- `POST /panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/entries/:entryId/send-email`

Se valido que:

- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- busca la entry por `id + event_id`;
- genera QR PNG internamente;
- envia email con Resend/`sendEmail`;
- actualiza `email_sent_at` solo si el envio termina correctamente;
- no expone `checkin_token`;
- no expone QR payload;
- no revierte order/item/entry si falla email;
- no implementa check-in;
- no toca pagos ni `/payments/callback`.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente;
- estado inicial limpio: `/entries` -> `200 OK`, `items = []`, `pagination.total = 0`;
- se creo una entry QA via `manual-issue`, `201 Created`, con entry `9b029baa-325d-4afb-8abb-6701ce8cf8de`, `General Preventa 1`, `issued/unused`, `qr_status = pending_qr_resource`;
- owner Ibiza envio email QR con `200 OK`, `ok = true`, `email.status = sent`, `email.to = mateoguex94@gmail.com`, `entry.email_sent_at = 2026-06-01T20:14:03.488+00:00`;
- email recibido en Gmail con evento `Ibiza`, fecha `sabado, 1 de agosto de 2026, 09:00 p. m.`, lugar `Centro de Eventos de Mariscal Lopez`, entrada `General Preventa 1`, asistente `QA Email` y QR visible;
- staff Ibiza reenvio email QR con `200 OK`, `email.status = sent`, `entry.email_sent_at = 2026-06-01T20:15:08.593+00:00`;
- `entryId` invalido -> `400 invalid_entry_id`;
- entry inexistente -> `404 entry_not_found`;
- owner local de D'Lirio sin membership -> `403`;
- sin auth -> `401`;
- token invalido -> `401`;
- eventId invalido -> `400 Invalid eventId`;
- evento inexistente -> `404 Event not found`;
- QR endpoint siguio funcionando con `200 OK` y `Content-Type = image/png`;
- `/summary`, `/ticket-types`, `/entries`, `/panel/me` local y `/panel/orders/summary` local siguieron en `200 OK`.

No exposicion sensible registrada:

- email visible sin `checkin_token`, `/events/checkin/<valor-opaco>`, documento, telefono ni metadata;
- response sin `checkin_token`, QR payload, base64, `attendee_phone`, buyer PII, `auth_user_id`, `local_id` ni metadata;
- `email.to` aparece en response y queda permitido por contrato.

Fallo de email:

- no se forzo fallo de email en produccion para no tocar configuracion Resend ni provocar falsos errores operativos;
- estado: `N/A` justificado.

Limpieza QA registrada:

- se limpio la orden QA del slice;
- `/entries` volvio a `items = []`;
- `pagination.total = 0`;
- `pagination.total_pages = 0`;
- Ibiza quedo nuevamente sin ordenes emitidas.

### Slice 3D.3B - email automatico post manual-issue

Estado: implementado, deployado y QA runtime PASS completo.

Se valido que:

- `manual-issue` emite entries correctamente;
- despues de RPC exitosa intenta emails QR en modo `automatic_best_effort`;
- response `201` incluye `email_delivery`;
- email automatico simple funciona;
- Mesa VIP maneja `partial_failed` sin revertir emision;
- limite mayor a 20 entries queda `skipped`;
- `send-email` manual sigue funcionando como fallback;
- QR endpoint sigue funcionando;
- errores previos y regresiones siguen correctos.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente;
- estado inicial limpio: `/entries` -> `200 OK`, `items = []`, `pagination.total = 0`;
- General Preventa 1: `201 Created`, `entries.length = 1`, `email_delivery.attempted = 1`, `sent = 1`, `failed = 0`, `skipped = 0`, `status = sent`, `reason = null`, `results.length = 1`, `results[0].status = sent`, `results[0].email_sent_at != null`;
- email General recibido en Gmail con evento `Ibiza`, entrada `General Preventa 1`, asistente `QA Auto General` y QR visible;
- Mesa VIP Preventa 1: `201 Created`, `entries.length = 10`, `attempted = 10`, `sent = 7`, `failed = 3`, `skipped = 0`, `status = partial_failed`, `reason = null`, `results.length = 10`;
- `partial_failed` de Mesa validado como comportamiento esperado: las 10 entries fueron creadas, 7 enviadas tienen `email_sent_at`, 3 fallidas reportan `email_send_failed`;
- Gmail recibio 7 correos de Mesa (`QA Mesa Auto 1`, `2`, `3`, `4`, `5`, `9`, `10`) y 1 correo General;
- limite mayor a 20: 21 General Preventa 1 respondieron `201 Created`, `entries.length = 21`, `email_delivery.status = skipped`, `reason = too_many_entries_for_sync_email`, `attempted = 0`, `sent = 0`, `failed = 0`, `skipped = 21`, `results = []`;
- fallback `send-email` por entry -> `200 OK`, `ok = true`, `email.status = sent`, `entry.email_sent_at != null`;
- QR endpoint -> `200 OK`, `Content-Type = image/png`;
- errores previos: attendees incorrectos `400 invalid_attendees_count`, ticket inexistente `404 ticket_type_not_found`, owner local sin membership `403`, sin auth `401`, token invalido `401`, eventId invalido `400 Invalid eventId`, stock insuficiente `409 insufficient_stock`;
- regresiones: `/summary`, `/ticket-types`, `/entries`, `/panel/me` local y `/panel/orders/summary` local siguieron en `200 OK`.

No exposicion sensible registrada:

- response sin `checkin_token`, `/events/checkin/`, base64, `attendee_phone`, buyer PII, `auth_user_id`, `local_id` ni metadata.

Consistencia y limpieza QA registrada:

- antes de limpieza se generaron 3 ordenes QA: General 1 entry / PYG 140000, Mesa 10 entries / PYG 3200000, Skipped 21 entries / PYG 2940000;
- summary reflejo `orders_count = 3`, `order_items_count = 3`, `entries_count = 32`, `issued_commercial_amount = 6280000`;
- se limpiaron las ordenes QA del slice;
- `/entries` volvio a `items = []`, `pagination.total = 0`, `pagination.total_pages = 0`;
- `/summary` volvio a `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`.

### Slice 3E.2A - RPC SQL check-in QR

Estado: implementado, aplicado y QA DB PASS completo.

Se valido que:

- la funcion `check_in_event_entry_by_token(uuid,uuid,text)` existe;
- los grants quedan cerrados para anon/authenticated y abiertos solo para `service_role`;
- valida membership owner/staff en `event_panel_users`;
- valida token UUID valido/invalido;
- usa `events.checkin_valid_from` y `events.checkin_valid_to`;
- respeta `draft/published` como operables para QA/control interno;
- bloquea eventos no operables con `event_not_operable`;
- marca entries como usadas con update condicional atomico;
- devuelve estados semanticos seguros;
- no expone `checkin_token`, `auth_user_id`, `local_id`, metadata, email ni phone.

QA DB registrado:

- 4 entries QA creadas dentro de transaccion mediante `issue_event_manual_order`;
- primer scan valido respondio `valid` y muto la entry a `used`;
- segundo scan secuencial respondio `already_used`;
- token UUID inexistente respondio `invalid`;
- token malformado respondio `invalid_input`;
- actor sin membership respondio `forbidden`;
- entry usada + fuera de ventana respondio `already_used`;
- entry unused + fuera de ventana respondio `outside_window` y no muto la entry;
- entry `voided` + fuera de ventana respondio `voided`;
- evento no operable respondio `event_not_operable`;
- rollback limpio: `qa_3e2a_orders = 0`;
- Ibiza quedo restaurado con `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Matiz:

- este QA valida DB/RPC, no endpoint HTTP;
- el doble scan validado fue secuencial;
- la carrera concurrente queda soportada por el update condicional atomico, pero Slice 3E.2B debe validarla en runtime si es posible.

Proximo paso tecnico recomendado: Slice 3E.2B - endpoint TS check-in QR.

Alcance sugerido:

- crear `PATCH /panel/events/:eventId/checkin/:token`;
- usar `eventPanelAuth`;
- usar `requireEventRole(["owner", "staff"])`;
- validar token/path;
- llamar RPC `check_in_event_entry_by_token`;
- devolver estados semanticos seguros;
- no duplicar logica de check-in en TS;
- no exponer `checkin_token`;
- sin pagos;
- sin `/payments/callback`.

### Slice 4 - Panel reducido: Inicio + Entradas

Agregar vistas operativas para resumen, listado, filtros, búsqueda y detalle de entrada.

### Slice 5 - Emisión manual individual/múltiple

Permitir emitir una o varias entradas, descontar stock y crear QRs individuales.

### Slice 6 - Email QR + QR visible para WhatsApp

Enviar email automático y mostrar QR en panel para copiar/descargar/enviar por WhatsApp.

### Slice 7 - Check-in scanner + validación manual

Implementar scanner, estados claros y validación manual por entrada.

### Slice 8 - Historial por entrada + actor label

Registrar eventos operativos y mostrar actor label seguro.

### Slice 9 - Export owner-only

Agregar export de compradores/asistentes, check-ins y pendientes sin tokens ni metadata cruda.

### Slice 10 - Near realtime/polling

Agregar polling/refetch visible-only para Entradas, Check-in, Inicio e Historial.

### Slice 11 - Hardening/QA operativo

Validar permisos, ventanas, sobreventa, tokens, email, export y carga operativa.

### Slice 12 - Documentación de operación del evento

Crear guía para owner/staff: emitir, reenviar QR, validar, buscar y exportar.

## 14. QA recomendado

Casos mínimos:

- Crear entrada VIP.
- Crear entrada General.
- Crear producto Mesa VIP.
- Emitir varias entradas.
- Emitir 1 Mesa VIP y generar 10 QRs.
- Emitir 2 Mesas VIP y generar 20 QRs.
- Stock decrementa.
- No permite superar stock.
- Email se envía.
- QR visible en panel.
- QR válido check-in PASS.
- QR duplicado muestra ya usada.
- Búsqueda por email/documento.
- Validación manual.
- Export owner-only.
- Staff no exporta si se mantiene esa política.
- Otro usuario/evento no ve entradas.
- Ventana 2026-08-01 18:00 -> 2026-08-02 06:00.
- Fuera de ventana bloquea validación.
- No se expone `checkin_token` en export.
- No se expone PII innecesaria en activity metadata.

QA operativo adicional:

- Emisión múltiple de 4 entradas genera 4 QRs.
- Emisión de paquetes respeta `entries_per_unit`.
- `event_order_items` conserva cantidad, precio comercial y total vendido.
- `event_order_entries` conserva QRs individuales para puerta.
- Cada QR valida una sola persona.
- Reenvío de email queda registrado.
- Intento duplicado queda registrado.
- Export incluye usada/no usada.
- Counters de Inicio reflejan emisión y check-ins.

## 15. No-goals del piloto

Fuera del piloto Ibiza:

- Pagos online.
- `/payments/callback`.
- Comprobantes subidos al panel.
- B2C público del evento.
- Marketplace de eventos.
- Seating map.
- Mesas complejas fuera del modelo de paquete simple.
- Cupones.
- Promociones.
- Liquidaciones/payouts.
- Reportes por staff.
- Múltiples organizadores complejos.
- Permisos avanzados.
- CRM.
- Seating map.
- Cambios al panel de bares/discotecas.
- Cambios en configs.
- Cambios en runtime demo.
- Cambios en assets.
- Cambios en service role.
- Cambios en Sentry.
- Cambios en exports existentes.

Notas:
Nota 1 — CSV import como posible acelerador
Si el volumen de carga manual supera la capacidad operativa del organizador, evaluar un slice de import CSV controlado para event_order_entries, con validación previa, preview de errores y límite por lote.

Nota 2 — Stock concurrente
La emisión manual debe proteger stock VIP/General en backend/DB con operación atómica. No alcanza validar stock solo en frontend.

Nota 3 — Email deliverability
Antes de operar Ibiza, validar envío de emails con QR en volumen controlado, revisar errores, rebotes y tiempos de entrega.
