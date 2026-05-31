# Ibiza Slice 3A: contrato de emision manual de entradas

## 1. Proposito

Este documento define el contrato tecnico y de producto para la futura emision manual de entradas del evento Ibiza.

El objetivo es dejar listo el diseno para un futuro slice CODE que implemente:

- `POST /panel/events/:eventId/orders/manual-issue`

Este documento no implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, panel UI, pagos ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo validado:

- Slice 1B: migracion 027 aplicada y validada.
- Slice 1B.2: migracion 028 aplicada y validada.
- Slice 1C: provisioning Ibiza aplicado y validado.
- Slice 2A: `eventPanelAuth`, `requireEventRole` y `/me` implementados, deployados y QA runtime PASS.
- Slice 2B: `/summary` y `/ticket-types` implementados, deployados y QA runtime PASS.

Modelo vigente:

- `event_ticket_types` = producto comercial configurable.
- `event_order_items` = linea comercial vendida.
- `event_order_entries` = acceso individual / QR validable.

Evento Ibiza:

- `event_id = aed4cb4a-b297-4093-98e1-b3474f3b399c`
- `slug = ibiza`
- `status = draft`
- 9 productos comerciales provisionados.
- 1 owner y 4 staff en `event_panel_users`.

## 3. Endpoint futuro

Endpoint:

- `POST /panel/events/:eventId/orders/manual-issue`

Proteccion:

- `eventPanelAuth`
- `requireEventRole(["owner", "staff"])`

Reglas de tenant:

- `event_id` se toma solo desde el path.
- No aceptar `event_id` desde body o query.
- No usar `panel_users`.
- No usar `local_id` para autorizar Eventos.
- Owner/staff de local no tienen acceso automatico a Eventos.

Decision de roles:

- Owner y staff pueden emitir entradas para Ibiza.
- Riesgo aceptado: staff puede crear entradas.
- Mitigacion obligatoria: toda emision debe guardar `created_by_auth_user_id` en `event_orders`.
- El activity log futuro debe poder resolver quien emitio cada entrada desde ese actor.

Estados de evento:

- `draft` permite emision manual.
- `published` permite emision manual.
- `paused` bloquea emision con `409`.
- `finished` bloquea emision con `409`.

## 4. Input contract

Body esperado:

```json
{
  "buyer": {
    "name": "string",
    "last_name": "string",
    "email": "string",
    "phone": "string",
    "document": "string"
  },
  "items": [
    {
      "ticket_type_id": "uuid",
      "quantity": 1,
      "attendees": [
        {
          "name": "string",
          "last_name": "string",
          "email": "string",
          "phone": "string",
          "document": "string"
        }
      ]
    }
  ],
  "notes": "string opcional"
}
```

Campos requeridos:

- `buyer.name`
- `buyer.last_name`
- `buyer.email`
- `buyer.phone`
- `buyer.document`
- `items`
- `items[].ticket_type_id`
- `items[].quantity`
- `items[].attendees`
- `items[].attendees[].name`
- `items[].attendees[].last_name`
- `items[].attendees[].email`
- `items[].attendees[].phone`
- `items[].attendees[].document`

Campos que no se aceptan desde cliente como fuente de verdad:

- `price_amount`
- `unit_price_amount`
- `total_amount`
- `currency`
- `source`
- `payment_method`
- `payment_status`
- `ticket_name`
- `entries_per_unit`
- `sales_unit_type`
- `checkin_token`
- `status`
- `checkin_status`
- `event_order_item_id`

## 5. Validaciones

Validaciones de request:

- `eventId` debe ser UUID valido.
- Usuario debe tener membership del evento.
- Rol debe ser `owner` o `staff`.
- `buyer` debe existir.
- `items` debe ser array no vacio.
- Cada `quantity` debe ser entero `> 0`.
- No permitir `ticket_type_id` duplicado dentro del mismo request; el cliente debe agrupar cantidades por producto.
- Campos obligatorios no pueden venir vacios despues de `trim`.
- Email de buyer y attendees debe tener formato valido basico.

Validaciones de catalogo:

- Cada `ticket_type_id` debe existir.
- Cada ticket type debe pertenecer al `event_id` del path.
- Cada ticket type debe tener `active = true`.
- `currency` del ticket type debe ser `PYG`.
- `sales_unit_type` debe ser `single_entry` o `package`.
- `entries_per_unit` debe cumplir los checks de DB.

Validaciones de attendees:

- Para cada item: `expected_attendees_count = quantity * event_ticket_types.entries_per_unit`.
- `attendees.length` debe coincidir exactamente con `expected_attendees_count`.
- Si falta un attendee o sobra un attendee, responder `400`.

Ejemplos:

- 2 General Preventa 1 -> `quantity = 2`, `entries_per_unit = 1`, 2 attendees, 2 entries.
- 4 VIP Preventa 2 -> `quantity = 4`, `entries_per_unit = 1`, 4 attendees, 4 entries.
- 1 Mesa VIP Preventa 1 -> `quantity = 1`, `entries_per_unit = 10`, 10 attendees, 10 entries.
- 2 Mesa VIP Preventa 1 -> `quantity = 2`, `entries_per_unit = 10`, 20 attendees, 20 entries.

## 6. Reglas de precios y snapshots

La fuente de verdad de precios es la DB, no el cliente.

Para `event_orders`:

- `source = manual_issue`
- `payment_method = manual_transfer`
- `payment_status = confirmed_externally`
- `created_by_auth_user_id = req.eventPanelUser.authUserId`
- `total_amount = sum(event_order_items.total_amount)`
- `currency = PYG`
- buyer fields se copian desde input validado.
- `notes` es opcional.

Para `event_order_items`:

- `ticket_name = event_ticket_types.name`
- `sales_unit_type = event_ticket_types.sales_unit_type`
- `entries_per_unit = event_ticket_types.entries_per_unit`
- `unit_price_amount = event_ticket_types.price_amount`
- `currency = PYG`
- `quantity = input.items[].quantity`
- `total_amount = quantity * unit_price_amount`

Para `event_order_entries`:

- una entry = un QR/acceso individual;
- `event_order_item_id` debe apuntar al item comercial que genero la entry;
- `event_order_id` y `event_ticket_type_id` deben coincidir con el item;
- `status = issued`;
- `checkin_status = unused`;
- `currency = PYG`;
- attendee fields se copian desde input validado;
- `checkin_token` se genera internamente por DB;
- `email_sent_at = null`;
- `used_at = null`;
- `used_by_auth_user_id = null`.

Precio equivalente por acceso:

- `single_entry`: `event_order_entries.unit_price_amount = event_ticket_types.price_amount`.
- `package`: `event_order_entries.unit_price_amount = event_ticket_types.price_amount / event_ticket_types.entries_per_unit`.
- Si la division no es exacta, rechazar con `409`.

Para Ibiza, las divisiones de paquetes son exactas:

- `3200000 / 10 = 320000`
- `3800000 / 10 = 380000`
- `4500000 / 10 = 450000`

## 7. Stock atomico

Decision para el primer CODE de emision manual:

- Preferir una funcion SQL/RPC transaccional o mecanismo equivalente que garantice lock y rollback completo.
- No implementar como multiples operaciones sueltas desde Supabase JS si no quedan dentro de una transaccion real.

Reglas:

- Stock mide unidades comerciales, no QRs.
- General Preventa 1 stock 900 = 900 entradas.
- Mesa VIP Preventa 1 stock 6 = 6 mesas, no 60 QRs.
- Validar stock por `event_ticket_type_id`.
- `issued_commercial_units = sum(event_order_items.quantity)` por ticket type.
- `issued_commercial_units + requested_quantity <= event_ticket_types.stock`.

Operacion atomica recomendada:

1. Validar evento y estado operativo.
2. Validar usuario via `eventPanelAuth`.
3. Bloquear filas afectadas de `event_ticket_types` con `FOR UPDATE` o equivalente.
4. Calcular `issued_commercial_units` por ticket type.
5. Validar stock suficiente.
6. Crear `event_order`.
7. Crear `event_order_items`.
8. Crear `event_order_entries`.
9. Confirmar transaccion.
10. Rollback completo si falla cualquier paso.

Anulaciones:

- En el primer CODE no se implementa `void`.
- No definir todavia si una anulacion futura libera stock.

## 8. Output contract

Respuesta futura `201`:

```json
{
  "order": {
    "id": "uuid",
    "total_amount": 140000,
    "currency": "PYG",
    "source": "manual_issue",
    "payment_method": "manual_transfer",
    "payment_status": "confirmed_externally"
  },
  "items": [
    {
      "id": "uuid",
      "ticket_type_id": "uuid",
      "ticket_name": "General Preventa 1",
      "sales_unit_type": "single_entry",
      "quantity": 1,
      "entries_per_unit": 1,
      "unit_price_amount": 140000,
      "total_amount": 140000,
      "currency": "PYG"
    }
  ],
  "entries": [
    {
      "id": "uuid",
      "event_order_item_id": "uuid",
      "ticket_type_id": "uuid",
      "ticket_name": "General Preventa 1",
      "attendee": {
        "name": "string",
        "last_name": "string",
        "document": "string"
      },
      "status": "issued",
      "checkin_status": "unused",
      "unit_price_amount": 140000,
      "currency": "PYG",
      "qr_status": "pending_qr_resource"
    }
  ]
}
```

No incluir en la respuesta:

- `checkin_token`
- QR raw
- buyer phone
- buyer document salvo que se apruebe explicitamente
- buyer email
- attendee email
- attendee phone
- metadata cruda
- `auth_user_id`
- datos de otros eventos

QR bridge:

- El endpoint crea internamente `checkin_token` por cada `event_order_entry`.
- No devuelve `checkin_token` raw.
- No devuelve QR visual todavia.
- Un slice posterior podra usar `entry.id` para generar o mostrar QR de forma segura para email o WhatsApp.
- Esto separa "entrada emitida" de "QR visual listo para enviar".

## 9. Errores esperados

Codigos del futuro endpoint:

- `400`: input invalido, campos obligatorios vacios, email invalido, `quantity` invalido, attendees incompletos, cantidad de attendees incorrecta.
- `401`: sin auth o token invalido.
- `403`: sin membership de evento o rol insuficiente.
- `404`: evento inexistente o `ticket_type_id` inexistente/no perteneciente al evento.
- `409`: stock insuficiente, division de paquete no exacta, evento `paused` o `finished`.
- `500`: error inesperado.

Formato recomendado:

```json
{
  "error": "Mensaje estable",
  "code": "machine_readable_code"
}
```

Codigos sugeridos:

- `invalid_input`
- `invalid_attendees_count`
- `invalid_quantity`
- `unauthorized`
- `forbidden`
- `event_not_found`
- `ticket_type_not_found`
- `event_not_operable`
- `insufficient_stock`
- `non_divisible_package_price`
- `manual_issue_failed`

## 10. No-goals

Fuera de este documento y del primer CODE posterior:

- email QR;
- check-in;
- export;
- activity log;
- frontend/panel UI;
- pagos online;
- `/payments/callback`;
- B2C publico;
- import CSV;
- edicion/correccion de entradas;
- anulacion/void;
- reenvio de QR;
- cambios al panel de bares/discotecas;
- cambios a `panelAuth`;
- cambios a `orders` local-based.

## 11. Riesgos

Riesgos principales:

- sobreventa por concurrencia;
- mismatch entre `event_order_items` y `event_order_entries`;
- generar menos o mas QRs que attendees;
- aceptar precio o total desde cliente;
- exponer `checkin_token`;
- crear datos parciales;
- staff emitiendo sin trazabilidad;
- paquetes con precio no divisible;
- mezclar ticket types de otro evento;
- emitir en evento `paused` o `finished`;
- futuras pasarelas mal encajadas si no se conserva `source/payment_method/payment_status`.

Mitigaciones:

- usar RPC/transaccion atomica;
- guardar `created_by_auth_user_id`;
- derivar precios y snapshots desde DB;
- validar attendees exactos;
- no devolver tokens raw;
- mantener `event_order_entries` como unidad validable;
- mantener `event_order_items` como fuente de unidades comerciales vendidas.

## 12. QA futuro

Casos minimos para el CODE posterior:

- emitir 1 General Preventa 1 -> 1 order item, 1 entry.
- emitir 4 VIP Preventa 2 -> 1 order item, 4 entries.
- emitir 1 Mesa VIP Preventa 1 -> 1 order item, 10 entries.
- emitir 2 Mesas VIP Preventa 1 -> 1 order item, 20 entries.
- stock baja por unidades comerciales.
- stock insuficiente devuelve `409`.
- attendees incompletos devuelven `400`.
- attendees de mas devuelven `400`.
- ticket de otro evento devuelve `404`.
- usuario sin membership devuelve `403`.
- owner local sin membership devuelve `403`.
- staff puede emitir y queda trazado con `created_by_auth_user_id`.
- evento `paused` devuelve `409`.
- evento `finished` devuelve `409`.
- fallo en cualquier attendee no deja datos parciales.
- response no expone `checkin_token`.
- response no expone email/telefono de attendees.
- `/summary` refleja `orders_count`, `order_items_count`, `entries_count` e `issued_commercial_amount`.
- `/ticket-types` refleja `issued_commercial_units`, `issued_qr_accesses` y `remaining_commercial_units`.

## 13. Assumptions

- Para Ibiza, `owner` y `staff` pueden emitir.
- `notes` queda permitido, pero no debe copiarse a activity/export sin decision futura.
- Ibiza usa solo `PYG`.
- Evento `draft` y `published` permiten emision manual.
- Evento `paused` y `finished` bloquean emision con `409`.
- La generacion visual/envio de QR se disena en slice posterior.
- El primer CODE de emision no implementa anulacion ni correccion.

## 14. Estado Slice 3B.1: RPC transaccional aplicada y QA DB PASS

Estado registrado:

- Slice 3A: contrato de emision manual aprobado.
- Slice 3B.1: migracion `029_create_issue_event_manual_order_rpc.sql` aplicada.
- Slice 3B.1: RPC `public.issue_event_manual_order` creada.
- Slice 3B.1: QA DB PASS.
- Endpoint TS todavia no implementado.

RPC creada:

```sql
public.issue_event_manual_order(
  p_event_id uuid,
  p_actor_auth_user_id uuid,
  p_buyer jsonb,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
```

QA DB validado:

- RPC encontrada: `issue_event_manual_order(uuid,uuid,jsonb,jsonb,text)`.
- Permisos validados:
  - `anon_can_execute = false`
  - `authenticated_can_execute = false`
  - `service_role_can_execute = true`
- Se ejecuto QA transaccional grande con `begin; ... rollback;`.
- Resultado Supabase: `Success. No rows returned`.
- No hubo errores `FAIL`.

Comportamiento validado:

- La RPC permite emitir una orden manual General.
- La RPC permite emitir una Mesa/package generando la cantidad correcta de entries.
- Bloquea cantidad invalida de asistentes.
- Bloquea sobreventa por stock.
- Bloquea ticket types de otro evento.
- Bloquea actores sin membership del evento.
- Bloquea eventos no operables.
- No expone `checkin_token`.
- No expone PII de asistentes.
- No expone `auth_user_id`.
- No expone `local_id`.
- No expone metadata cruda.
- No deja datos parciales ante errores.

Limpieza/rollback validado:

- El QA termino con rollback.
- Ibiza quedo `slug = ibiza`, `title = Ibiza`, `status = draft`.
- `qa_orders = 0`.
- No quedaron ordenes QA persistidas.

Proximo paso recomendado:

- Slice 3B.2 - Endpoint TS manual issue.

Alcance sugerido:

- crear `POST /panel/events/:eventId/orders/manual-issue`;
- usar `eventPanelAuth`;
- usar `requireEventRole(["owner", "staff"])`;
- validar input estricto;
- rechazar campos prohibidos;
- llamar a `public.issue_event_manual_order`;
- mapear errores de RPC a HTTP;
- devolver `201` en exito;
- no exponer `checkin_token`;
- no crear logica paralela de stock en TS;
- no tocar pagos;
- no tocar `/payments/callback`;
- no tocar frontend.

## 15. Estado Slice 3B.2: endpoint manual-issue QA runtime PASS

Estado registrado:

- Slice 3B.2: endpoint TS implementado.
- Slice 3B.2: deployado.
- Slice 3B.2: QA runtime PASS completo.
- Endpoint `manual-issue` validado como primera operacion HTTP de escritura para Eventos.
- RPC `issue_event_manual_order` sigue siendo la fuente de stock/transaccion.
- TypeScript solo valida input, protege tenant, llama RPC y mapea errores.
- No se toco frontend.
- No se tocaron pagos ni `/payments/callback`.

Endpoint validado:

- `POST /panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/orders/manual-issue`

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente.
- Pre-check summary: `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`.
- Pre-check General Preventa 1: `id = d89499b3-eb49-4b74-b8c8-48b2d5a55dbe`, `price_amount = 140000`, `stock = 900`, `sales_unit_type = single_entry`, `entries_per_unit = 1`.
- Pre-check Mesa VIP Preventa 1: `id = 58234842-9956-4f63-8e30-cc8bcd60dda2`, `price_amount = 3200000`, `stock = 6`, `sales_unit_type = package`, `entries_per_unit = 10`.
- Owner Ibiza emitio 1 General Preventa 1 con `201 Created`, `order.source = manual_issue`, `order.total_amount = 140000`, `payment_method = manual_transfer`, `payment_status = confirmed_externally`, `items.length = 1`, `entries.length = 1`, entry `issued/unused`, `qr_status = pending_qr_resource`.
- Staff Ibiza emitio 1 Mesa VIP Preventa 1 con `201 Created`, `order.total_amount = 3200000`, `items.length = 1`, `entries.length = 10`, `sales_unit_type = package`, `entries_per_unit = 10`, `unit_price_amount` por entry = `320000`.
- Post-summary despues de 3 ordenes QA: `orders_count = 3`, `order_items_count = 3`, `entries_count = 12`, `issued_commercial_amount = 3480000`.
- Calculo observado: General `140000` + Mesa `3200000` + General repetida `140000` = `3480000`.
- Post-ticket-types General Preventa 1: `issued_commercial_units = 2`, `issued_qr_accesses = 2`, `remaining_commercial_units = 898`.
- Post-ticket-types Mesa VIP Preventa 1: `issued_commercial_units = 1`, `issued_qr_accesses = 10`, `remaining_commercial_units = 5`.

Errores HTTP validados:

- Mesa VIP Preventa 1 con `quantity = 1` y 9 attendees -> `400 Bad Request`, `code = invalid_attendees_count`.
- Ticket UUID valido inexistente/no perteneciente al evento -> `404 Not Found`, `code = ticket_type_not_found`.
- Owner local de D'Lirio sin membership de evento -> `403 Forbidden`, body `User not authorized for event access`.
- Request sin `Authorization` -> `401 Unauthorized`, body `Missing or invalid Authorization header`.
- `Authorization: Bearer token-invalido` -> `401 Unauthorized`, body `Invalid or expired token`.
- `/panel/events/not-a-uuid/orders/manual-issue` -> `400 Bad Request`, body `Invalid eventId`.
- Mesa VIP Preventa 1 con stock restante 5 y request `quantity = 6` con 60 attendees -> `409 Conflict`, `code = insufficient_stock`.
- Evento inexistente `00000000-0000-4000-8000-000000000000` por POST -> `404 Not Found`, body `Event not found`.

Stock insuficiente sin datos parciales:

- despues del `409`, summary seguia en `orders_count = 3`, `order_items_count = 3`, `entries_count = 12`, `issued_commercial_amount = 3480000`;
- ticket-types seguia en General Preventa 1 `issued = 2`, `remaining = 898`, y Mesa VIP Preventa 1 `issued = 1`, `remaining = 5`;
- SQL adicional valido `stock_qa_orders = 0`.

No exposicion sensible validada:

- no aparece `checkin_token`;
- no aparece `buyer_email`;
- no aparece `buyer_phone`;
- no aparece `buyer_document`;
- no aparece `attendee_email`;
- no aparece `attendee_phone`;
- no aparece `auth_user_id`;
- no aparece `local_id`;
- no aparece metadata cruda;
- si aparece `attendee.name`, `attendee.last_name` y `attendee.document`, permitido por contrato.

Limpieza QA validada:

- preview de ordenes QA mostro 3 registros marcados: `58ff3763-efc3-4a4b-888c-d08c362db17e`, `20c031f5-55e7-44f7-b139-50d2afa25385`, `acf7a539-6f8a-4c87-bad9-90f73323eec4`;
- todas tenian `buyer_email = qa.slice3b2...`, `buyer_document = QA-SLICE-3B2...`, `notes = QA Slice 3B.2...`;
- despues de la limpieza, summary volvio a `orders_count = 0`, `order_items_count = 0`, `entries_count = 0`, `issued_commercial_amount = 0`;
- General Preventa 1 volvio a `issued_commercial_units = 0`, `issued_qr_accesses = 0`, `remaining_commercial_units = 900`;
- Mesa VIP Preventa 1 volvio a `issued_commercial_units = 0`, `issued_qr_accesses = 0`, `remaining_commercial_units = 6`.

Regresion panel local:

- `/panel/me` con owner local -> `200 OK`;
- `/panel/orders/summary` con owner local -> `200 OK`.

Proximo paso recomendado:

- Slice 3C - lectura operativa de ordenes/entradas emitidas de evento.

Alcance sugerido:

- endpoint read-only para listar/search entries emitidas;
- filtros por ticket type, `checkin_status`, `status`, email/documento/nombre;
- protegido con `eventPanelAuth + requireEventRole(["owner", "staff"])`;
- sin QR visual todavia;
- sin email QR;
- sin check-in;
- sin export;
- sin activity;
- sin frontend;
- sin pagos.
