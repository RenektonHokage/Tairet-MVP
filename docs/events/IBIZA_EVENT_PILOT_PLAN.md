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
- Mesas: fuera de alcance; solo tickets.

Capacidad/stock inicial:

- VIP: 200.
- General: 3000.
- Total estimado: 3200.

Precios:

- VIP: pendiente.
- General: pendiente.
- Ambos deben quedar como campos configurables/editables.

Operación esperada:

- 2 o 3 personas usarán el panel.
- Se necesita check-in en puerta.
- Se necesita QR individual.
- Se necesita export de compradores/asistentes.
- No se venderá por otro sistema.
- El plazo de implementación depende de Tairet.

## 3. Decisiones de producto documentadas

Decisiones para Ibiza:

- Ibiza debe tratarse como evento independiente.
- Ibiza debe operar por `event_id`, no por `local_id`.
- No se debe crear un local falso llamado Ibiza.
- No se debe extender `locals.type` para resolver este piloto.
- El pago externo por transferencia debe modelarse como flujo manual temporal.
- El flujo manual no debe bloquear un futuro checkout online.
- Cada entrada/persona debe tener QR propio.
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
2. Cliente indica tipo y cantidad de entradas.
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

## 6. Modelo recomendado para el piloto

Recomendación principal:

- `events`
- `event_ticket_types`
- `event_orders`
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

Representa los tipos de entrada.

Tipos iniciales:

- VIP, stock 200, precio pendiente.
- General, stock 3000, precio pendiente.

Campos conceptuales:

- `id`
- `event_id`
- `name`
- `description`
- `price`
- `stock`
- `active`
- `sales_start`
- `sales_end`
- `created_at`
- `updated_at`

Reglas:

- Stock y precios deben ser configurables.
- El backend/DB debe impedir superar stock.
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

### `event_order_entries`

Representa cada entrada/QR individual. Es la unidad validable.

Punto clave:

- Una orden puede agrupar varias entradas.
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
- filtrar por tipo VIP/General;
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
- tipo de entrada;
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

Crear modelo mínimo de eventos, tipos de entrada, órdenes, entradas validables y membresías.

### Slice 3 - Provisioning Ibiza

Crear evento Ibiza, tickets VIP/General, stocks, precios configurables y usuarios owner/staff.

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
- Emitir varias entradas.
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
- Mesas.
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