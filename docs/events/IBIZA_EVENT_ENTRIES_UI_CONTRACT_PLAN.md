# Ibiza Entries UI: contrato de seccion Entradas en panel de eventos

## 1. Proposito

Este documento define el contrato UI/UX y tecnico para la seccion `Entradas` del panel de eventos.

El objetivo es preparar un futuro slice CODE que permita a owner/staff listar entradas emitidas, buscar, filtrar, revisar estado operativo, abrir el QR PNG y reenviar email QR por entry desde `EventPanelShell`.

Este paso es solo ASK / DOCS. No implementa codigo runtime, frontend, backend, SQL, migraciones, endpoints, pagos, B2C, activity local ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Backend Eventos ya esta QA PASS:

- `GET /panel/events/:eventId/entries`
- `GET /panel/events/:eventId/entries/:entryId/qr`
- `POST /panel/events/:eventId/entries/:entryId/send-email`
- `PATCH /panel/events/:eventId/entries/:entryId/use`
- `GET /panel/events/:eventId/activity`

Frontend Eventos cerrado:

- Shell-B: `getEventPanelMe` y tipos de contexto.
- Shell-C: `EventPanelShell`, `EventPanelNav` y layout propio.
- Shell-D: QA visual/manual PASS completo.
- UI-B: `getEventActivity` y tipos.
- UI-C: `EventActivitySection`.
- Activity ya vive dentro del shell de evento.
- Entries-B: cliente/tipos frontend `eventEntries.ts` PASS tecnico.
- Entries-C: ruta `Entradas`, nav y listado read-only implementados con QA frontend/manual PASS.

Reglas vigentes del panel de eventos:

- usa `EventPanelShell`;
- usa `EventPanelNav`;
- no usa `PanelProvider` local;
- no usa `SidebarNav` local;
- no usa `/panel/me`;
- no usa `local_id`.

## 3. Fuentes revisadas

Documentos revisados:

- `docs/events/IBIZA_EVENT_PANEL_SHELL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_UI_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_UI_INTEGRATION_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_MANUAL_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`

Frontend revisado sin modificar codigo:

- `apps/web-next/app/panel/events/[eventId]/layout.tsx`
- `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`
- `apps/web-next/components/panel/EventPanelShell.tsx`
- `apps/web-next/components/panel/EventPanelNav.tsx`
- `apps/web-next/components/panel/EventActivitySection.tsx`
- `apps/web-next/lib/eventPanel.ts`
- `apps/web-next/lib/eventActivity.ts`
- `apps/web-next/lib/api.ts`
- `apps/web-next/components/panel/ui`
- `apps/web-next/components/panel/ui/DataTable.tsx`
- `apps/web-next/components/panel/ui/Badge.tsx`
- `apps/web-next/components/panel/ui/EmptyState.tsx`
- `apps/web-next/components/panel/ui/Card.tsx`
- `apps/web-next/components/panel/ui/Toolbar.tsx`
- `apps/web-next/app/panel/(authenticated)/orders`
- `apps/web-next/app/panel/(authenticated)/checkin`
- `apps/web-next/app/panel/(authenticated)/reservations`
- `apps/web-next/components/panel/views`

Backend revisado solo para contrato:

- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/schemas/eventEntriesRead.ts`
- `functions/api/src/services/eventEmails.ts`
- `functions/api/src/services/eventQr.ts`

## 4. Discovery backend de entries

Endpoint:

- `GET /panel/events/:eventId/entries`

Proteccion:

- `eventPanelAuth`
- `requireEventRole(["owner", "staff"])`

Query params soportados por schema strict:

- `q`
  - trim;
  - minimo 2 caracteres si viene;
  - maximo 100;
  - `q` de 1 caracter devuelve `400 invalid_query`.
- `ticket_type_id`
  - UUID.
- `status`
  - `issued`;
  - `voided`.
- `checkin_status`
  - `unused`;
  - `used`.
- `page`
  - entero positivo;
  - default `1`.
- `page_size`
  - entero positivo;
  - default `25`;
  - maximo `100`;
  - `page_size > 100` devuelve `400 invalid_query`.
- `sort`
  - `created_at_desc`;
  - `created_at_asc`;
  - default `created_at_desc`.

Busqueda `q`:

- busca en `event_order_entries` por:
  - `attendee_name`;
  - `attendee_last_name`;
  - `attendee_email`;
  - `attendee_document`.
- busca en `event_orders` por:
  - `buyer_name`;
  - `buyer_last_name`;
  - `buyer_email`;
  - `buyer_document`.
- si encuentra ordenes, vuelve a entries por `event_order_id`.

Ordenamiento:

- default `created_at desc`;
- desempate por `id`;
- `created_at_asc` usa `created_at asc` e `id asc`.

Paginacion backend:

- `offset = (page - 1) * page_size`;
- response incluye `items` y `pagination`;
- si no hay resultados: `total = 0`, `total_pages = 0`.

## 5. Response actual de `/entries`

Cada item devuelve:

- `entry`
- `attendee`
- `buyer`
- `order`
- `item`

Campos actuales de `entry`:

- `id`
- `event_order_id`
- `event_order_item_id`
- `ticket_type_id`
- `ticket_name`
- `sales_unit_type`
- `status`
- `checkin_status`
- `unit_price_amount`
- `currency`
- `created_at`
- `used_at`

Campos actuales de `attendee`:

- `name`
- `last_name`
- `email`
- `phone`
- `document`

Campos actuales de `buyer`:

- `name`
- `last_name`
- `email`
- `phone`
- `document`

Campos actuales de `order`:

- `id`
- `total_amount`
- `currency`
- `source`
- `payment_method`
- `payment_status`
- `created_at`

Campos actuales de `item`:

- `id`
- `quantity`
- `entries_per_unit`
- `total_amount`

Campos que no existen actualmente en response de `/entries`:

- `email_sent_at`;
- `qr_status`;
- `checkin_token`;
- QR payload;
- QR base64;
- metadata cruda;
- auth IDs;
- `local_id`.

Decision para UI:

- El MVP no debe prometer estado real de email en la lista si el backend no devuelve `email_sent_at`.
- Despues de reenviar email, la UI puede mostrar feedback local de la accion y/o refetch, pero la lista no tendra un campo persistente de email hasta que exista contrato backend que lo exponga.
- QR se trata como accion disponible por endpoint, no como `qr_status` listado.

## 6. Endpoints de acciones por entry

### Ver QR

Endpoint:

- `GET /panel/events/:eventId/entries/:entryId/qr`

Contrato actual:

- protegido por `eventPanelAuth + requireEventRole(["owner", "staff"])`;
- valida `entryId` UUID;
- busca entry por `event_id + entry_id`;
- requiere `entry.status = issued`;
- devuelve `image/png`;
- headers:
  - `Content-Type: image/png`;
  - `Cache-Control: no-store`;
  - `X-Content-Type-Options: nosniff`;
  - `Content-Disposition: inline; filename="tairet-event-entry-qr.png"`;
- no devuelve JSON con token;
- no expone `checkin_token` textual.

Errores relevantes:

- `400 invalid_entry_id`;
- `404 entry_not_found`;
- `409 entry_not_issuable`;
- `500 qr_generation_failed`.

### Reenviar email QR

Endpoint:

- `POST /panel/events/:eventId/entries/:entryId/send-email`

Contrato actual success:

```json
{
  "ok": true,
  "entry": {
    "id": "uuid",
    "email_sent_at": "ISO string"
  },
  "email": {
    "to": "attendee@example.com",
    "status": "sent"
  }
}
```

Errores relevantes:

- `400 invalid_entry_id`;
- `404 entry_not_found`;
- `409 entry_not_issuable`;
- `409 attendee_email_unavailable`;
- `502 email_send_failed`;
- `500 email_update_failed`;
- `500 event_entry_email_failed`.

Decision UI:

- Mostrar loading por row.
- En success mostrar feedback `Email reenviado.`.
- No mostrar `email.to` en tabla como dato persistente.
- Si se muestra `email.to` en feedback, que sea minimo y temporal; preferencia MVP: no mostrarlo.
- Refetch opcional, sabiendo que `/entries` no trae `email_sent_at`.

### Validar manualmente

Endpoint existente:

- `PATCH /panel/events/:eventId/entries/:entryId/use`

Decision MVP:

- No incluir `Validar` en la primera UI de Entradas.

Motivo:

- Es una accion de puerta, irreversible en la practica operativa y mas riesgosa desde una lista general.
- Debe vivir en Check-in UI o en una accion separada con confirmacion explicita posterior.

## 7. Decision PII para UI

El backend permite PII operativa para owner/staff en `/entries`.

Decision de UI MVP:

- Mostrar en tabla/card:
  - attendee name;
  - attendee last_name;
  - attendee document si es necesario para soporte/puerta;
  - ticket_name;
  - status;
  - checkin_status;
  - used_at si aplica;
  - order.created_at;
  - order.payment_status/source si ayuda a soporte.
- Ocultar por defecto en la vista principal:
  - attendee phone;
  - buyer phone;
  - buyer document;
  - buyer email;
  - buyer full PII.
- Usar `attendee.email` solo si se decide que soporte lo necesita en el listado; recomendacion inicial: no mostrarlo en columnas principales y dejarlo para busqueda.
- No mostrar `buyer` PII en el MVP inicial salvo nombre/email si se agrega un panel de detalle posterior.

Regla:

- Que el endpoint devuelva PII permitida no implica que la UI deba mostrarla toda.
- La tabla principal debe ser operativa y minimizada.

## 8. Ubicacion y navegacion

Ruta recomendada:

- `/panel/events/[eventId]/entries`

La seccion debe vivir dentro de:

- `EventPanelShell`.

`EventPanelNav` futuro:

- agregar `Entradas` solo cuando exista la ruta real `/panel/events/[eventId]/entries`;
- mantener `Actividad`;
- no crear links a `Check-in`, `Summary`, `Settings` ni rutas vacias falsas.

Orden sugerido de nav:

- `Entradas`
- `Actividad`

Motivo:

- `Entradas` sera la primera seccion operativa diaria;
- `Actividad` queda como historial.

## 9. Objetivo operativo de Entradas

La pantalla debe resolver:

- staff encuentra una entrada emitida;
- verifica si esta emitida/anulada;
- verifica si esta usada o pendiente;
- abre QR PNG para asistencia operativa o envio manual por WhatsApp;
- reenvia email QR por entry;
- identifica ticket type y asistente dentro de lo permitido;
- prepara base para futuras acciones de soporte.

No debe ser:

- CRM completo;
- export;
- edicion/anulacion;
- import CSV;
- analytics;
- pantalla de venta/emision manual;
- reemplazo del scanner de check-in;
- historial por entry.

## 10. Estructura visual recomendada

Opciones evaluadas:

- Tabla desktop + cards mobile.
- Lista/cards compactas en todas las vistas.
- `DataTable` existente.

Decision recomendada:

- Desktop: tabla/lista hibrida con columnas operativas y acciones por row.
- Mobile: cards compactas por entry.
- Reutilizar patrones del panel actual.
- No crear sistema visual nuevo.

Componentes reutilizables:

- `PageHeader`
- `Badge`
- `Card`
- `DataTable`
- `EmptyState`
- `Toolbar`
- `panelUi`
- `cn`

Implementacion sugerida:

- Si `DataTable` alcanza para desktop, usarlo para columnas y row actions.
- Para mobile, ocultar tabla desktop y renderizar cards compactas.
- Mantener filtros en un bloque tipo `Toolbar`/surface blanca con borde.
- Seguir patron de `EventActivitySection`: estado local, `Cargar mas`, dedupe por id y feedback controlado.

## 11. Campos visibles recomendados

Columnas/campos desktop:

- Asistente:
  - `attendee.name`;
  - `attendee.last_name`;
  - `attendee.document`.
- Ticket:
  - `entry.ticket_name`;
  - `entry.sales_unit_type` si ayuda;
  - `item.entries_per_unit` para package/mesa si ayuda.
- Estado:
  - `entry.status`;
  - `entry.checkin_status`;
  - `entry.used_at` si aplica.
- Orden:
  - `order.created_at`;
  - `order.payment_status`;
  - `order.source`.
- Acciones:
  - `Ver QR`;
  - `Reenviar email`.

Cards mobile:

- nombre/apellido del asistente;
- documento;
- ticket_name;
- badges de `status` y `checkin_status`;
- fecha de emision;
- acciones `Ver QR` y `Reenviar email`.

No mostrar en MVP principal:

- buyer phone;
- buyer document;
- attendee phone;
- metadata cruda;
- IDs relacionales como texto principal;
- QR/token/raw URL.

## 12. Labels y badges

Labels sugeridos:

- `status = issued`: `Emitida`.
- `status = voided`: `Anulada`.
- `checkin_status = unused`: `No usada`.
- `checkin_status = used`: `Usada`.
- `payment_status = confirmed_externally`: `Confirmada externamente`.
- `source = manual_issue`: `Emision manual`.
- `sales_unit_type = single_entry`: `Entrada`.
- `sales_unit_type = package`: `Paquete/Mesa`.

Badges sugeridos:

- `issued`: `success`.
- `voided`: `danger`.
- `unused`: `neutral`.
- `used`: `warn` o `success` segun criterio visual; recomendacion inicial: `success` para usada y `neutral` para no usada.
- payment/source: `neutral`.

## 13. Acciones MVP

### Ver QR

UX recomendada:

- boton por row/card;
- abrir modal con imagen QR;
- el modal carga el PNG desde endpoint protegido;
- mostrar loading y error controlado;
- no mostrar token, payload ni raw URL;
- no copiar URL interna;
- no persistir QR base64 en estado mas alla de lo necesario si se usa blob.

Implementacion futura posible:

- helper `getEventEntryQrUrl(eventId, entryId)` que construya path relativo para fetch autenticado o descarga controlada;
- si el navegador necesita headers auth, preferir fetch blob con `getAuthHeaders` o helper dedicado, no `<img src>` directo sin auth.

### Reenviar email

UX recomendada:

- boton por row/card;
- loading por row;
- deshabilitar mientras envia;
- success notice: `Email reenviado.`;
- error notice: `No se pudo reenviar el email.`;
- si response trae `entry.email_sent_at`, guardarlo como estado temporal o refetch cuando el backend liste ese campo.

No hacer:

- no mostrar respuesta cruda de Resend;
- no mostrar stack;
- no mostrar token;
- no mostrar QR payload/base64;
- no loggear response completa.

### Validar manualmente

Decision:

- fuera del MVP de Entradas.
- queda para Check-in UI o slice separado con confirmacion.

## 14. Filtros UI

Filtros MVP:

- busqueda `q`;
- `status`;
- `checkin_status`;
- `ticket_type_id`;
- `page/page_size`;
- `sort` default `created_at_desc`.

UX recomendada:

- input de busqueda visible;
- select/chips para `status`;
- select/chips para `checkin_status`;
- selector de ticket type si se usa `GET /panel/events/:eventId/ticket-types`;
- resetear page a `1` al cambiar filtros;
- deshabilitar filtros durante carga inicial si ayuda a evitar condiciones de carrera.

Ticket types:

- endpoint `GET /panel/events/:eventId/ticket-types` ya existe y esta QA PASS.
- Si el primer CODE quiere mantener alcance chico, puede omitir selector de ticket type y agregarlo en Entries-C2.
- Recomendacion: incluir selector si el helper/tipos se mantienen acotados; Ibiza tiene productos comerciales claros y el filtro es operativo.

Reglas backend que la UI debe respetar:

- no enviar `q` de 1 caracter;
- no enviar `page_size > 100`;
- no enviar params desconocidos;
- no enviar `event_id`, `local_id`, auth IDs, token ni metadata.

## 15. Paginacion y carga

Defaults:

- `page = 1`;
- `page_size = 25`;
- `sort = created_at_desc`.

Decision UX:

- usar `Cargar mas`, igual que `EventActivitySection`;
- dedupe por `entry.id` al concatenar;
- `hasMore = page < total_pages`;
- cambio de filtros resetea items, page y total_pages;
- si `total = 0`, mostrar empty state.

No recomendado en MVP:

- paginador numerico complejo;
- infinite scroll automatico;
- auto refresh.

## 16. Estados UI

Loading:

- skeleton/table placeholders en desktop;
- skeleton cards en mobile.

Empty:

- titulo: `Todavia no hay entradas emitidas.`
- descripcion: `Cuando se emitan entradas para este evento, apareceran aca.`

Error listado:

- mensaje: `No se pudieron cargar las entradas.`
- accion: `Reintentar`.

QR loading:

- `Cargando QR...`

QR error:

- `No se pudo cargar el QR.`

Reenvio email loading:

- loading por row/card;
- boton deshabilitado.

Reenvio email success:

- `Email reenviado.`

Reenvio email error:

- `No se pudo reenviar el email.`

## 17. Seguridad y no exposicion

La UI no debe mostrar:

- `checkin_token`;
- QR payload;
- QR base64;
- raw URL;
- `auth_user_id`;
- `used_by_auth_user_id`;
- `created_by_auth_user_id`;
- `local_id`;
- metadata cruda;
- request/response crudo;
- headers;
- stack;
- token;
- URLs internas de validacion;
- buyer phone/document;
- attendee phone salvo decision explicita posterior.

La UI no debe:

- hacer fetch extra a buyer/attendee fuera de endpoints de evento;
- loggear response completa;
- construir URLs de QR manualmente con tokens;
- copiar payload QR;
- aceptar `event_id` por query;
- usar `local_id`;
- hardcodear Ibiza `eventId`.

La UI debe:

- tomar `eventId` solo desde params/layout;
- usar helpers autenticados;
- usar `encodeURIComponent`;
- mostrar errores controlados;
- mantener EventPanelShell separado del panel local.

## 18. API client y tipos futuros

Crear futuro archivo:

- `apps/web-next/lib/eventEntries.ts`

Tipos sugeridos:

- `EventEntryStatus = "issued" | "voided"`.
- `EventEntryCheckinStatus = "unused" | "used"`.
- `EventEntrySalesUnitType = "single_entry" | "package" | (string & {})`.
- `EventEntry`
- `EventEntryAttendee`
- `EventEntryBuyer`
- `EventEntryOrder`
- `EventEntryItem`
- `EventEntryListItem`
- `EventEntriesPagination`
- `EventEntriesResponse`
- `GetEventEntriesInput`
- `SendEventEntryEmailInput`
- `SendEventEntryEmailResponse`
- `EventEntryQrInput`

Helpers sugeridos:

- `getEventEntries(input)`;
- `sendEventEntryQrEmail(input)`;
- `getEventEntryQrBlob(input)` o `getEventEntryQrObjectUrl(input)`;
- opcional `getEventEntryQrPath(eventId, entryId)` solo si no requiere auth header para la estrategia elegida.

Reglas de cliente:

- usar `apiGetWithAuth` para JSON listados;
- usar `apiPostWithAuth` para resend;
- usar `getAuthHeaders` + fetch blob para QR si se necesita header `Authorization`;
- construir query con `URLSearchParams`;
- mapear camelCase a snake_case:
  - `ticketTypeId` -> `ticket_type_id`;
  - `checkinStatus` -> `checkin_status`;
  - `pageSize` -> `page_size`.
- no enviar undefined/null/empty string;
- no enviar `event_id`;
- no enviar `local_id`;
- no enviar auth IDs;
- no enviar token ni metadata.

## 19. Estado Entries-B - cliente/tipos frontend

Estado: **PASS tecnico**.

Entries-B implemento:

- archivo `apps/web-next/lib/eventEntries.ts`;
- tipos TypeScript para status, check-in status, sales unit type, sort, entry, attendee, buyer, order, item, list item, pagination, response e inputs;
- `getEventEntries(input)`;
- `sendEventEntryQrEmail(input)`;
- `getEventEntryQrBlob(input)`;
- labels/constants;
- badge helpers;
- sin UI visible;
- sin ruta `/entries`;
- sin update de `EventPanelNav`;
- sin backend, SQL, pagos ni flujos operativos modificados.

Discovery frontend/API registrado:

- `apiGetWithAuth` y `apiPostWithAuth` son helpers JSON;
- `getAuthHeaders` existe;
- `apiGetWithAuth` no sirve para blob;
- `getEventActivity` usa `URLSearchParams` como patron;
- QR PNG requiere fetch autenticado;
- `getEventEntryQrBlob` usa `getAuthHeaders` y fetch autenticado.

Tipos creados:

- `EventEntryStatus`;
- `EventEntryCheckinStatus`;
- `EventEntrySalesUnitType`;
- `EventEntriesSort`;
- `EventEntry`;
- `EventEntryAttendee`;
- `EventEntryBuyer`;
- `EventEntryOrder`;
- `EventEntryItem`;
- `EventEntryListItem`;
- `EventEntriesPagination`;
- `EventEntriesResponse`;
- `GetEventEntriesInput`;
- `SendEventEntryQrEmailInput`;
- `SendEventEntryQrEmailResponse`;
- `EventEntryQrInput`.

`getEventEntries(input)`:

- requiere `eventId`;
- aplica `trim` y `encodeURIComponent`;
- usa path `/panel/events/:eventId/entries`;
- usa `URLSearchParams`;
- mapea `ticketTypeId` a `ticket_type_id`;
- mapea `checkinStatus` a `checkin_status`;
- mapea `pageSize` a `page_size`;
- no envia undefined, null ni empty string;
- no envia `q` vacio;
- no envia `q` de 1 caracter;
- no envia `event_id`, `local_id`, auth IDs, token ni metadata;
- usa `apiGetWithAuth`.

`sendEventEntryQrEmail(input)`:

- requiere `eventId` y `entryId`;
- aplica `trim` y `encodeURIComponent`;
- llama `POST /panel/events/:eventId/entries/:entryId/send-email`;
- usa `apiPostWithAuth`;
- no envia email manual desde cliente;
- no envia token;
- no envia `event_id` ni `local_id`;
- no loggea response completa.

`getEventEntryQrBlob(input)`:

- usa `getAuthHeaders`;
- usa fetch autenticado;
- carga `GET /panel/events/:eventId/entries/:entryId/qr`;
- valida `Content-Type: image/png`;
- devuelve `Blob`;
- no convierte a base64;
- no construye payload de validacion;
- no expone token;
- no loggea response completa.

Seguridad registrada:

- no construye ni envia `event_id`;
- no usa `local_id`;
- no usa auth IDs;
- no usa token;
- no usa metadata;
- no usa QR payload/base64;
- no usa raw validation URL;
- no hace fetch extra a buyer/attendee;
- no hardcodea Ibiza `eventId`;
- no usa `localStorage`;
- no toca panel local;
- no toca runtime demo.

Validaciones registradas:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente porque `next lint` abrio configuracion interactiva de ESLint y no existe config no interactiva.
- Lint no se trata como FAIL del slice.

Estado final:

- Entries-B PASS tecnico.
- Capa frontend de Entries lista.
- Cliente/tipos usados como base de Entries-C.
- QR helper autenticado usado por Entries-D.
- Sin validacion visual porque no hay UI visible en este slice.

## 20. Estado Entries-C - ruta Entradas y listado read-only

Estado: **implementado y QA frontend/manual PASS**.

Entries-C implemento:

- ruta `/panel/events/[eventId]/entries`;
- `EventPanelNav` actualizado con link `Entradas`;
- `EventEntriesSection` implementado;
- listado read-only de entradas emitidas;
- fetch con `getEventEntries`;
- filtros `q`, `status`, `checkin_status` y `sort`;
- `q` de 1 caracter no se envia al backend;
- paginacion con `Cargar mas`;
- dedupe por `entry.id`;
- desktop con tabla compacta;
- mobile con cards;
- loading, empty, error y retry;
- sin acciones QR/email/check-in manual todavia;
- sin cambios backend, SQL, pagos ni flujos operativos.

Archivos del slice:

- `apps/web-next/app/panel/events/[eventId]/entries/page.tsx`;
- `apps/web-next/components/panel/EventEntriesSection.tsx`;
- `apps/web-next/components/panel/EventPanelNav.tsx`.

QA frontend/manual registrado como PASS:

- `/panel/events/:eventId/entries` carga correctamente dentro de `EventPanelShell`;
- no usa `PanelProvider` local, `/panel/me` ni `local_id`;
- `EventPanelNav` muestra `Entradas` y `Actividad`;
- `Entradas` queda activa en `/entries`;
- `Actividad` sigue funcionando desde la nav;
- no se agregaron rutas futuras vacias como Check-in, Summary o Settings;
- owner Ibiza y staff Ibiza pueden ver la seccion `Entradas`;
- owner local sin membership no ve datos del evento;
- sin auth/token invalido no accede a datos;
- errores se manejan sin crashear la UI;
- evento sin entries muestra empty state correcto;
- entries existentes se muestran con asistente, documento si corresponde, ticket, status, check-in status y fecha/orden si corresponde;
- busqueda `q` funciona con 2+ caracteres;
- `q` de 1 caracter no dispara error backend;
- filtros `status`, `checkin_status` y `sort` funcionan;
- `Cargar mas` funciona, no duplica entries y se oculta cuando no hay mas paginas;
- cambio de filtros resetea page/items correctamente;
- desktop queda usable con tabla compacta, columnas legibles y sin scroll horizontal raro;
- mobile queda usable con cards legibles, filtros sin romper layout y boton `Cargar mas` accesible;
- `Actividad`, panel local y runtime demo siguen funcionando.

Seguridad visual validada:

- no se detecto exposicion de `checkin_token`;
- no se detecto QR payload, QR base64 ni raw URL;
- no se detecto `auth_user_id`, `used_by_auth_user_id`, `created_by_auth_user_id` ni `local_id`;
- no se detecto metadata cruda, request/response crudo, headers, stack ni token;
- no se mostro buyer phone, buyer document, buyer email, attendee phone ni attendee email.

Validaciones tecnicas registradas:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente porque `next lint` abrio configuracion interactiva de ESLint y no existe config no interactiva.
- Lint no se trata como FAIL del slice.

Estado final:

- Entries-C implementado.
- Ruta `Entradas` operativa dentro del panel de eventos.
- Listado read-only de entries operativo.
- Filtros y paginacion operativos.
- Seguridad visual validada.
- Base usada por Entries-D.

## 21. Estado Entries-D/E - acciones QR/email y QA frontend

Estado: **Entries-D implementado y Entries-E QA frontend/manual PASS**.

Entries-D implemento:

- boton `Ver QR` por row/card;
- QR cargado mediante `getEventEntryQrBlob`;
- QR mostrado en modal;
- loading/error controlado de QR;
- cleanup de object URL al cerrar, cambiar QR y desmontar;
- boton `Reenviar email` por row/card;
- reenvio mediante `sendEventEntryQrEmail`;
- loading/success/error por entry;
- feedback `Email reenviado.`;
- no se muestra `email.to` como dato persistente;
- no se agrego `Validar manual`;
- no se toco backend, SQL, migraciones, endpoints, pagos ni flujos operativos.

Fixture QA validado:

- se crearon 2 entradas QA para Ibiza mediante `manual-issue`;
- response API `201 Created`;
- `entries.length = 2`;
- `email_delivery.mode = order_bundle`;
- `email_delivery.status = sent`;
- `email_delivery.sent = 2`;
- `order.id = 2a9b2904-2d78-4372-937b-75ee019840fe`;
- `item.id = 55cae0fa-962b-45be-98df-157e68e4d68f`;
- entry QR `dd5ec250-eeb9-42fa-bae6-6d3c0ddeddb8`;
- entry Email `d2b8d0c0-ef26-4923-b8b4-ab3c12aac753`.

QA listado/filtros:

- `/panel/events/:eventId/entries?q=QA-ENTRIES-UI` respondio `200 OK`;
- `pagination.total = 2`;
- contiene `QA-ENTRIES-UI-QR`;
- contiene `QA-ENTRIES-UI-EMAIL`;
- busqueda por `QA-ENTRIES-UI-QR` PASS;
- busqueda por `QA-ENTRIES-UI-EMAIL` PASS;
- filtro de estado PASS;
- filtro de check-in PASS;
- orden PASS;
- no se duplican rows.

QA owner/staff/sin sesion:

- owner Ibiza carga la ruta correctamente dentro de `EventPanelShell`;
- `EventPanelNav` muestra `Entradas` y `Actividad`;
- `Entradas` queda activa;
- se muestran las 2 entradas QA;
- no hay error de panel local;
- staff Ibiza puede entrar, ver entries, abrir QR y reenviar email;
- sin sesion, el panel solicita iniciar sesion y no muestra datos del evento ni permite usar acciones.

QA `Ver QR`:

- el boton `Ver QR` aparece por entry;
- abre modal;
- el modal muestra titulo `QR de entrada`, ticket, asistente e imagen QR PNG visible;
- cerrar modal funciona;
- no queda imagen visible despues de cerrar;
- abrir QR de otra entry funciona;
- no queda estado visual anterior.

QA `Reenviar email`:

- `Reenviar email` aparece por entry;
- el reenvio funciona;
- feedback mostrado: `Email reenviado. 09/06/2026, 03:58 p. m.`;
- el feedback queda controlado en UI;
- no se muestra response cruda;
- no se muestra `email.to` persistente.

Validar manual ausente:

- no aparece accion `Validar`;
- no aparece accion `Usar entrada`;
- no aparece accion `Marcar usada`;
- no aparece accion `Validar manual`;
- no aparece `Check-in` como accion operativa.

Seguridad visual validada:

- no se observo `checkin_token`;
- no se observo QR payload;
- no se observo QR base64;
- no se observo raw URL ni `/events/checkin`;
- no se observaron auth IDs, `used_by_auth_user_id`, `created_by_auth_user_id` ni `local_id`;
- no se observo metadata cruda, request/response crudo, stack ni headers;
- no se observo buyer phone, buyer document, attendee phone ni `email.to` persistente.

Regresiones y limpieza:

- la ruta directa de Actividad carga correctamente: `/panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/activity`;
- `EventPanelNav` mantiene `Entradas` y `Actividad`;
- se eliminaron los datos QA;
- verificacion final por IDs: `qa_order_remaining = 0`, `qa_item_remaining = 0`, `qa_entries_remaining = 0`, `qa_activity_remaining = 0`.

Validaciones tecnicas registradas:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente por configuracion interactiva de ESLint.
- Lint queda registrado como N/A por tooling, no como FAIL.

Estado final:

- Entries-D implementado.
- Entries-E QA frontend/manual PASS.
- acciones QR/email operativas dentro de `Entradas`.
- owner/staff Ibiza pueden ver, filtrar/listar, abrir QR PNG autenticado desde modal, cerrar/cambiar QR sin estado visual incorrecto y reenviar email QR por entry.
- `Validar manual` queda fuera de `Entradas`.
- seguridad visual validada.
- datos QA limpiados.

## 22. Roadmap por slices

Entries-A:

- Este ASK/DOCS.
- Estado: documentado.

Entries-B:

- Crear cliente/tipos frontend para entries, send-email y QR.
- No crear UI visible si se quiere validar helper aislado.
- Estado: implementado y PASS tecnico.

Entries-C:

- Crear ruta `/panel/events/[eventId]/entries`.
- Agregar `Entradas` a `EventPanelNav` solo cuando exista la ruta.
- Pantalla read-only con listado, filtros y paginacion.
- Scope recomendado: listado read-only, filtros `q/status/checkin_status/sort`, paginacion `Cargar mas`, desktop/mobile, empty/loading/error/retry.
- Sin `Ver QR`.
- Sin `Reenviar email`.
- Sin `Validar manual`.
- Sin cambios backend.
- Estado: implementado y QA frontend/manual PASS.

Entries-D:

- Agregar acciones `Ver QR` y `Reenviar email`.
- Modal QR seguro.
- Feedback de email por row.
- Usar `getEventEntryQrBlob` para cargar QR PNG autenticado.
- Usar `sendEventEntryQrEmail` para reenvio.
- Mantener fuera `Validar manual`.
- Estado: implementado.

Entries-E:

- QA visual/manual completo.
- Owner/staff, tenant safety, mobile/desktop, no exposicion y regresiones.
- Estado: QA frontend/manual PASS.

Entries-F futuro:

- historial por entry o enlace a Activity filtrada por `event_order_entry_id`.

Check-in UI futuro:

- pantalla separada para validacion QR/manual en puerta.

## 23. QA futuro

Casos minimos:

- owner Ibiza ve lista de entries.
- staff Ibiza ve lista de entries.
- owner local sin membership no accede.
- sin auth/token invalido no accede.
- evento sin entries muestra empty state.
- entries existentes se muestran.
- busqueda `q` funciona.
- `q` de 1 caracter no se envia o muestra validacion cliente.
- filtros `status`, `checkin_status` y `ticket_type_id` funcionan.
- paginacion con `Cargar mas` funciona.
- cambio de filtros resetea page.
- desktop muestra tabla/lista hibrida usable.
- mobile muestra cards usables.
- `Ver QR` carga PNG.
- QR no expone token, payload ni raw URL.
- `Reenviar email` funciona y muestra feedback.
- error de reenvio muestra mensaje controlado.
- no se muestran `checkin_token`, QR payload/base64, auth IDs, `local_id` ni metadata cruda.
- no se muestra buyer phone/document en MVP.
- no se rompe `Actividad`.
- no se rompe panel local.
- no se rompe runtime demo.

Estado ya cubierto por Entries-C:

- owner/staff Ibiza ven lista/read-only de entries;
- owner local sin membership, sin auth y token invalido no acceden a datos;
- empty/listado, busqueda, filtros visibles, paginacion, desktop/mobile y seguridad visual quedaron en PASS.

Estado ya cubierto por Entries-D/E:

- acciones `Ver QR` y `Reenviar email` operativas;
- QR modal con PNG autenticado, cierre y cambio de entry validado;
- reenvio email por entry validado con feedback controlado;
- `Validar manual` ausente;
- owner/staff Ibiza validados;
- sin sesion no ve datos;
- datos QA limpiados.

Validaciones tecnicas futuras:

- `pnpm -C apps/web-next typecheck`.
- `git diff --check`.
- `pnpm -C apps/web-next lint` solo si tooling deja de ser interactivo; si no, N/A/no concluyente.

## 24. No-goals

Fuera de este contrato y del primer CODE:

- implementar codigo;
- tocar frontend runtime;
- tocar backend;
- tocar SQL/migraciones;
- tocar endpoints;
- tocar pagos;
- tocar `/payments/callback`;
- tocar B2C;
- tocar activity local;
- tocar panel local;
- tocar runtime demo;
- agregar `Validar manual` en esta UI;
- crear Check-in UI;
- crear Summary UI;
- crear Settings UI;
- crear export;
- crear import CSV;
- crear edicion/anulacion;
- crear historial por entry;
- crear busqueda backend nueva;
- cambiar contratos backend ya validados;
- configurar ESLint.

## 25. Estado final del contrato

Estado: documentado.

Decision principal:

- construir `Entradas` como primera seccion operativa posterior a Activity;
- ruta futura `/panel/events/[eventId]/entries`;
- vivir dentro de `EventPanelShell`;
- agregar nav `Entradas` solo cuando exista la ruta;
- usar listado `/entries`, QR PNG por entry y resend email por entry;
- no incluir validacion manual en MVP;
- minimizar PII visible aunque el endpoint la permita;
- mantener seguridad visual y tenant safety del panel de eventos.
- Entries-B dejo cliente/tipos usados por Entries-C y QR blob autenticado usado por Entries-D.
- Entries-C deja ruta/listado read-only `Entradas` operativo, con QA frontend/manual PASS.
- Entries-D/E dejan acciones QR/email operativas en `Entradas`, con QA frontend/manual PASS y datos QA limpiados.
- Proximo paso recomendado: ASK/DOCS para Check-in UI como siguiente seccion operativa del `EventPanelShell`.
