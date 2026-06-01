# Ibiza Slice 3C.1: contrato de lectura operativa de entradas emitidas

## 1. Proposito

Este documento define el contrato tecnico y de producto para los endpoints read-only de lectura operativa de entradas emitidas del evento Ibiza.

El objetivo es dejar listo el diseno para un futuro slice CODE que permita listar, buscar y revisar entradas emitidas antes de avanzar a QR visual, email QR, check-in, export o frontend.

Este documento no implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, panel UI, pagos ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo validado:

- Slice 1B: migracion 027 aplicada y validada.
- Slice 1B.2: migracion 028 aplicada y validada; `event_order_items` creado y `event_order_entries` vinculado a items.
- Slice 1C: provisioning Ibiza aplicado y validado con 9 productos comerciales y owner/staff en `event_panel_users`.
- Slice 2A: `eventPanelAuth`, `requireEventRole` y `/me` con QA runtime PASS.
- Slice 2B: `/summary` y `/ticket-types` con QA runtime PASS.
- Slice 3B.1: RPC `issue_event_manual_order` creada y QA DB PASS.
- Slice 3B.2: `POST /panel/events/:eventId/orders/manual-issue` implementado, deployado y QA runtime PASS completo.
- La limpieza QA de Slice 3B.2 dejo Ibiza sin ordenes emitidas.

Modelo vigente:

- `event_orders` = orden comercial/backoffice.
- `event_order_items` = linea comercial vendida y snapshot de producto.
- `event_order_entries` = acceso individual, QR/check-in futuro y unidad operativa.

## 3. Endpoint principal

Endpoint recomendado para el primer CODE de lectura:

- `GET /panel/events/:eventId/entries`

Proteccion:

- `eventPanelAuth`
- `requireEventRole(["owner", "staff"])`

Objetivo:

- listar entries emitidas por evento;
- buscar por datos de attendee y, si se hace join con order, buyer;
- filtrar por producto comercial;
- filtrar por `status` y `checkin_status`;
- devolver datos suficientes para soporte operativo;
- mantener response segura sin `checkin_token`.

## 4. Endpoint opcional evaluado

Endpoint evaluado:

- `GET /panel/events/:eventId/orders`

Decision:

- No incluirlo en el primer CODE de Slice 3C.
- Priorizar `/entries` porque `event_order_entries` es la unidad validable, la futura unidad QR y la futura unidad de check-in.
- `GET /orders` puede quedar para un slice posterior si soporte necesita navegar por orden antes que por entrada.

Motivo:

- El panel operativo necesita encontrar una persona/entrada rapidamente por documento, email, nombre, ticket type o estado.
- Una vista centrada en entries puede incluir resumen minimo de order e item sin crear un endpoint adicional.

## 5. Query params de `/entries`

Parametros soportados:

- `q`
  - string opcional.
  - `trim`.
  - minimo 2 caracteres si viene presente.
  - maximo 100 caracteres.
  - si `q.trim().length === 1`, devolver `400`.
  - busca por `attendee_name`, `attendee_last_name`, `attendee_email`, `attendee_document`.
  - si se une con `event_orders`, tambien puede buscar `buyer_email`, `buyer_document`, `buyer_name`, `buyer_last_name`.
- `ticket_type_id`
  - UUID opcional.
  - filtra por `event_order_entries.event_ticket_type_id`.
- `status`
  - opcional.
  - valores permitidos: `issued`, `voided`.
- `checkin_status`
  - opcional.
  - valores permitidos: `unused`, `used`.
- `page`
  - entero opcional.
  - default: `1`.
  - minimo: `1`.
- `page_size`
  - entero opcional.
  - default: `25`.
  - minimo: `1`.
  - maximo: `100`.
  - si `page_size > 100`, devolver `400`.
- `sort`
  - opcional.
  - default: `created_at_desc`.
  - valores iniciales permitidos: `created_at_desc`, `created_at_asc`.

Reglas:

- parametros desconocidos deben rechazarse con `400` si se usa schema strict.
- `q` de 1 caracter debe rechazarse con `400` para evitar busquedas demasiado amplias.
- `event_id` no se acepta por query.
- `local_id` no se acepta por query.
- `auth_user_id` no se acepta por query.
- filtros invalidos devuelven `400`.
- `page_size > 100` debe rechazarse con `400`; no normalizar a `100`.
- ordenamiento estable: `created_at` mas `id` como desempate.

## 6. Response contract de `/entries`

Respuesta `200`:

```json
{
  "items": [
    {
      "entry": {
        "id": "uuid",
        "event_order_id": "uuid",
        "event_order_item_id": "uuid",
        "ticket_type_id": "uuid",
        "ticket_name": "General Preventa 1",
        "sales_unit_type": "single_entry",
        "status": "issued",
        "checkin_status": "unused",
        "unit_price_amount": 140000,
        "currency": "PYG",
        "created_at": "2026-05-31T00:00:00.000Z",
        "used_at": null
      },
      "attendee": {
        "name": "string",
        "last_name": "string",
        "email": "string",
        "phone": "string",
        "document": "string"
      },
      "buyer": {
        "name": "string",
        "last_name": "string",
        "email": "string",
        "phone": "string",
        "document": "string"
      },
      "order": {
        "id": "uuid",
        "total_amount": 140000,
        "currency": "PYG",
        "source": "manual_issue",
        "payment_method": "manual_transfer",
        "payment_status": "confirmed_externally",
        "created_at": "2026-05-31T00:00:00.000Z"
      },
      "item": {
        "id": "uuid",
        "quantity": 1,
        "entries_per_unit": 1,
        "total_amount": 140000
      }
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total": 1,
    "total_pages": 1
  }
}
```

Notas de origen de datos:

- `entry.id`, `status`, `checkin_status`, `unit_price_amount`, `currency`, `created_at`, `used_at`, attendee fields y FKs vienen de `event_order_entries`.
- `ticket_name`, `sales_unit_type`, `quantity`, `entries_per_unit` y `item.total_amount` vienen de `event_order_items`.
- buyer fields, `source`, `payment_method`, `payment_status`, `order.total_amount` y `order.created_at` vienen de `event_orders`.

No incluir:

- `checkin_token`;
- QR raw;
- `used_by_auth_user_id`;
- `created_by_auth_user_id`;
- `auth_user_id`;
- `local_id`;
- raw metadata;
- datos de otros eventos.

## 7. Decision sobre PII

Decision:

- En `manual-issue` response se ocultaron email y telefono de attendee para reducir exposicion en la operacion de escritura.
- En lectura operativa, owner/staff necesitan ver `attendee.email`, `attendee.phone`, `attendee.document`, buyer email/telefono/documento y nombres para busqueda, verificacion y soporte.
- Por eso `/entries` puede devolver PII operativa, pero solo bajo `eventPanelAuth + requireEventRole(["owner", "staff"])`.

Restricciones:

- No exponer PII en endpoints publicos.
- No exponer PII en endpoints B2C.
- No incluir PII en activity metadata futura salvo decision explicita.
- Export tendra reglas separadas y deberia ser owner-only.
- Logs de backend no deben registrar filas completas ni payloads con PII.

## 8. Tenant safety

Reglas obligatorias:

- Todos los endpoints usan `eventPanelAuth`.
- Roles permitidos para lectura operativa: `owner` y `staff`.
- `event_id` se toma solo desde path.
- La query usa `req.eventPanelUser.eventId` como fuente de verdad.
- No aceptar `event_id` desde query o body.
- No usar `panel_users`.
- No usar `local_id`.
- Todas las queries filtran por `event_id = req.eventPanelUser.eventId`.
- Joins con `event_orders` y `event_order_items` deben alinear tambien `event_id`.
- Usuario local sin membership de evento debe devolver `403`.
- Evento inexistente debe devolver `404`.
- `eventId` invalido debe devolver `400`.

## 9. Paginacion y limites

Defaults:

- `page = 1`
- `page_size = 25`
- `sort = created_at_desc`

Limites:

- `page_size` maximo = `100`.
- `q` maximo = `100` caracteres.
- `q` minimo = `2` caracteres si viene presente.
- `q.trim().length === 1` devuelve `400`.
- `page_size > 100` devuelve `400`.

Response:

- `items`
- `pagination.page`
- `pagination.page_size`
- `pagination.total`
- `pagination.total_pages`

Reglas de conteo:

- `total` cuenta entries despues de aplicar tenant scope, filtros y busqueda.
- `total_pages = ceil(total / page_size)`.
- Si no hay resultados, devolver `items: []` y `total: 0`.

## 10. Errores esperados

Errores del futuro endpoint:

- `400`: query params invalidos, `ticket_type_id` invalido, `status` invalido, `checkin_status` invalido, paginacion invalida.
- `401`: sin auth o token invalido.
- `403`: sin membership de evento o rol insuficiente.
- `404`: evento inexistente.
- `500`: error DB inesperado.

Formato recomendado:

```json
{
  "error": "Mensaje estable",
  "code": "machine_readable_code"
}
```

Codigos sugeridos:

- `invalid_query`
- `unauthorized`
- `forbidden`
- `event_not_found`
- `entries_read_failed`

## 11. No-goals

Fuera de este contrato y del primer CODE read-only:

- QR visual;
- email QR;
- check-in;
- validacion manual;
- export;
- activity log;
- frontend/panel UI;
- pagos online;
- `/payments/callback`;
- B2C publico;
- edicion/correccion;
- anulacion/void;
- import CSV;
- cambios al flujo `manual-issue`;
- cambios al panel local.

## 12. QA futuro

Casos minimos para el CODE posterior:

- owner Ibiza lista entries.
- staff Ibiza lista entries.
- sin auth devuelve `401`.
- token invalido devuelve `401`.
- owner local sin membership devuelve `403`.
- `eventId` invalido devuelve `400`.
- evento inexistente devuelve `404`.
- busqueda por documento encuentra entry.
- busqueda por email encuentra entry.
- busqueda por nombre/apellido encuentra entry.
- filtro por `ticket_type_id` funciona.
- filtro por `status = issued` funciona.
- filtro por `checkin_status = unused` funciona.
- paginacion default devuelve `page = 1` y `page_size = 25`.
- `page_size > 100` devuelve `400`.
- `q` de 1 caracter devuelve `400`.
- sort `created_at_desc` es estable.
- response no incluye `checkin_token`.
- response no incluye `auth_user_id`.
- response no incluye `local_id`.
- response no incluye metadata cruda.
- no rompe `/summary`.
- no rompe `/ticket-types`.
- no rompe `manual-issue`.
- no rompe `/panel/me` ni `/panel/orders/summary` del panel local.

## 13. Estado Slice 3C.2: endpoint `/entries` QA runtime PASS

Estado final:

- Slice 3C.1: contrato de lectura operativa aprobado.
- Slice 3C.2: endpoint `GET /panel/events/:eventId/entries` implementado.
- Slice 3C.2: deployado.
- Slice 3C.2: QA runtime PASS.
- Lectura operativa de entries lista como base para QR visual, check-in, export y activity futuros.
- Ibiza quedo nuevamente sin ordenes emitidas despues de la limpieza QA.

Endpoint validado:

- `GET /panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/entries`

Comportamiento validado:

- usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- lista entries emitidas por evento;
- permite busqueda, filtros y paginacion;
- devuelve `entry`, `attendee`, `buyer`, `order` e `item`;
- no expone `checkin_token`;
- no expone `auth_user_id`;
- no expone `local_id`;
- no expone metadata cruda;
- no crea ni modifica datos.

QA runtime registrado:

- `/health` -> `200 OK`, body `{"ok":true}`, `x-request-id` presente.
- Estado inicial sin entries: owner Ibiza recibio `200 OK`, `items = []`, `pagination.page = 1`, `pagination.page_size = 25`, `pagination.total = 0`, `pagination.total_pages = 0`.
- Emision QA: se creo una orden QA con `POST /panel/events/:eventId/orders/manual-issue`, `201 Created`, generando 1 entry `General Preventa 1`, `status = issued`, `checkin_status = unused`, `qr_status = pending_qr_resource`.
- Listado owner/staff: owner Ibiza y staff Ibiza recibieron `200 OK`, `pagination.total = 1`, con `entry`, `attendee`, `buyer`, `order` e `item` segun contrato.
- Busquedas: `q=QA-SLICE-3C2`, `q=qa.slice3c2.entries@example.com` y `q=Entry` encontraron la entry QA.
- Filtros validos: `ticket_type_id`, `status=issued` y `checkin_status=unused` respondieron `200 OK`.
- Paginacion: `page=1&page_size=1` respondio `200 OK`, `pagination.page = 1`, `pagination.page_size = 1`, `pagination.total = 1`, `pagination.total_pages = 1`.
- Query params invalidos: `status=bad`, `checkin_status=bad`, `page_size=101`, `q=a` y `unknown=1` respondieron `400` con `code = invalid_query`.
- Auth/permisos: sin `Authorization` -> `401`, token invalido -> `401`, owner local sin membership del evento -> `403`.
- `eventId` invalido: `/panel/events/not-a-uuid/entries` -> `400 Invalid eventId`.
- Evento inexistente: `/panel/events/00000000-0000-4000-8000-000000000000/entries` -> `404 Event not found`.

No exposicion sensible validada:

- no aparece `checkin_token`;
- no aparece `used_by_auth_user_id`;
- no aparece `created_by_auth_user_id`;
- no aparece `auth_user_id`;
- no aparece `local_id`;
- no aparece metadata cruda.

Regresiones validadas:

- `GET /panel/events/:eventId/summary` -> `200 OK`;
- `GET /panel/events/:eventId/ticket-types` -> `200 OK`;
- `GET /panel/me` con owner local -> `200 OK`;
- `GET /panel/orders/summary` con owner local -> `200 OK`.

Limpieza QA:

- se limpio la orden QA del slice;
- despues de la limpieza, `GET /entries` volvio a `items = []`;
- `pagination.total = 0`;
- `pagination.total_pages = 0`.

## 14. Proximo paso recomendado

Slice 3D.1 - contrato de QR visual / recurso QR para entries.

Alcance sugerido:

- definir como obtener o mostrar QR por entry;
- decidir si el endpoint devuelve imagen/base64, SVG, PNG o URL/recurso seguro;
- definir si se usa `entry.id` como identificador publico o si se requiere recurso firmado;
- no exponer `checkin_token` raw;
- preparar compatibilidad con WhatsApp y email QR;
- sin check-in todavia;
- sin frontend todavia;
- sin pagos;
- sin `/payments/callback`.
