# Ibiza Activity UI: contrato de historial operativo en panel de eventos

## 1. Proposito

Este documento define el contrato de UI para mostrar el historial operativo de Eventos en el panel.

El backend ya expone y valido:

- `GET /panel/events/:eventId/activity`

Este paso es solo ASK / DOCS. No implementa codigo runtime, backend, endpoints, SQL, migraciones, frontend, pagos ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado backend validado:

- `public.event_activity_events` existe y esta separada de `operational_activity_events`.
- `recordEventActivity` existe y registra activity de Eventos en modo best-effort.
- Activity ya esta integrada en `manual-issue`, email automatico, email manual, check-in QR y fallback manual.
- `GET /panel/events/:eventId/activity` es read-only, protegido por `eventPanelAuth + requireEventRole(["owner", "staff"])`.
- El endpoint filtra por `req.eventPanelUser.eventId`.
- El endpoint soporta filtros por `action`, `source`, `entity_type`, `event_order_id`, `event_order_entry_id` y `event_ticket_type_id`.
- El endpoint pagina con `page`, `page_size`, `total` y `total_pages`.
- La response no expone PII, tokens, QR payload/base64, auth IDs ni `local_id`.
- UI-B implemento la base frontend read-only en `apps/web-next/lib/eventActivity.ts`.
- UI-B no implemento pantalla visible, rutas, navegacion ni componentes UI.
- UI-B dejo la base lista para UI-C.

Activity cubierta:

- `event_order_manual_issued`
- `event_entry_issued`
- `event_entry_email_sent`
- `event_entry_email_failed`
- `event_entry_checked_in`
- `event_entry_already_used_attempt`
- `event_entry_outside_window_attempt`
- `event_entry_voided_attempt`
- `event_entry_invalid_token_attempt`

Sources:

- `manual`
- `qr`
- `automatic_email`
- `manual_email`
- `system`

## 3. Fuentes revisadas

Documentos revisados:

- `docs/events/IBIZA_EVENT_ACTIVITY_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_LOG_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_INTEGRATION_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_MANUAL_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`

Frontend/panel revisado sin modificar:

- `apps/web-next/app/panel`
- `apps/web-next/app/panel/(authenticated)`
- `apps/web-next/components/panel`
- `apps/web-next/components/panel/OperationalActivityHistory.tsx`
- `apps/web-next/components/panel/SidebarNav.tsx`
- `apps/web-next/components/panel/ui/Badge.tsx`
- `apps/web-next/components/panel/ui/DataTable.tsx`
- `apps/web-next/components/panel/ui/EmptyState.tsx`
- `apps/web-next/lib/activity.ts`
- `apps/web-next/lib/api.ts`

Hallazgos:

- Existe UI de activity local por entidad (`OperationalActivityHistory`), pero no una UI especifica de Eventos.
- Existen helpers API con auth (`apiGetWithAuth`) y `queryClient` en `apps/web-next/lib/api.ts`.
- No se encontro carpeta `apps/web-next/hooks`.
- Existen componentes reutilizables `Badge`, `DataTable` y `EmptyState`.
- El panel actual usa estados simples de loading, empty, error y retry.

## 4. Ubicacion UI recomendada

Decision MVP:

- Crear una vista o seccion general `Actividad` dentro del futuro panel de evento.
- La vista lista cronologicamente todo el historial operativo del evento.
- No asumir una ruta final exacta hasta que exista la estructura frontend de panel de eventos.

Ubicacion conceptual:

- Panel de evento -> `Actividad`

Decision posterior:

- Agregar historial filtrado dentro de una entry si el flujo operativo lo pide.
- Ese historial usaria `event_order_entry_id` como filtro interno.

Justificacion:

- El endpoint actual ya lista activity global por evento.
- La vista general permite ver emision, emails, check-ins e intentos en un solo lugar.
- Reduce complejidad inicial y evita crear navegacion por entry antes de que exista una pantalla estable de detalle.

## 5. Objetivo operativo

La pantalla debe ayudar a owner/staff a responder rapidamente:

- que paso recientemente en el evento;
- si una orden manual fue emitida;
- si una entrada fue emitida;
- si el QR fue enviado por email;
- si un email fallo;
- si una entrada fue validada;
- si hubo intentos duplicados;
- si hubo intentos fuera de ventana;
- si hubo intentos sobre entradas anuladas;
- si hubo intentos con QR invalido.

La pantalla no debe ser:

- CRM;
- auditoria legal completa;
- analytics avanzado;
- export;
- visor de PII;
- herramienta de debug con IDs internos como texto principal.

## 6. Estructura visual recomendada

Mobile/operacion:

- Lista o timeline compacta.
- Cada item ocupa una fila/card compacta.
- Prioridad visual: fecha, accion, mensaje y fuente.

Desktop:

- Lista con filtros superiores o tabla/lista hibrida.
- Usar patrones existentes del panel: `Badge`, `DataTable`, `EmptyState` y estados de retry.
- Evitar cards pesadas por row si la cantidad de activity crece.

Campos visibles por row:

- fecha/hora;
- label humano de `action`;
- badge de `source`;
- actor label;
- `message`;
- `ticket_name` si viene permitido en metadata;
- estado/reason si viene permitido en metadata;
- relacion operativa opcional, por ejemplo "Entrada" u "Orden", sin mostrar UUID como texto principal.

Campos que no deben ser texto principal:

- `event_order_id`;
- `event_order_item_id`;
- `event_order_entry_id`;
- `event_ticket_type_id`;
- `entity_id`.

Esos IDs pueden usarse internamente para links futuros, pero no deben ser el contenido principal para staff.

## 7. Labels humanos

Actions:

| action | label |
| --- | --- |
| `event_order_manual_issued` | `Orden manual emitida` |
| `event_entry_issued` | `Entrada emitida` |
| `event_entry_email_sent` | `Email de QR enviado` |
| `event_entry_email_failed` | `Fallo al enviar email de QR` |
| `event_entry_checked_in` | `Entrada validada` |
| `event_entry_already_used_attempt` | `Intento sobre entrada ya usada` |
| `event_entry_outside_window_attempt` | `Intento fuera de ventana` |
| `event_entry_voided_attempt` | `Intento sobre entrada anulada` |
| `event_entry_invalid_token_attempt` | `Intento con QR invalido` |

Sources:

| source | label |
| --- | --- |
| `manual` | `Manual` |
| `qr` | `QR` |
| `automatic_email` | `Email automatico` |
| `manual_email` | `Email manual` |
| `system` | `Sistema` |

Entity types:

| entity_type | label |
| --- | --- |
| `event_order` | `Orden` |
| `event_order_entry` | `Entrada` |
| `event_email` | `Email` |
| `event_checkin` | `Check-in` |

Actor:

- `system` -> `Sistema`
- `event_panel_user` + `actor_display_name` -> usar display name si viene.
- `event_panel_user` + `actor_role = owner` -> `Owner`
- `event_panel_user` + `actor_role = staff` -> `Staff`
- fallback seguro -> `Panel`

## 8. Categorias y badges

Usar solo variantes existentes del panel si se implementa con `Badge`:

- `neutral`
- `success`
- `warn`
- `danger`

Agrupacion visual recomendada:

| categoria | actions | variante sugerida |
| --- | --- | --- |
| Emision | `event_order_manual_issued`, `event_entry_issued` | `neutral` |
| Email exitoso | `event_entry_email_sent` | `success` |
| Email fallido | `event_entry_email_failed` | `danger` |
| Check-in valido | `event_entry_checked_in` | `success` |
| Intento/rechazo | `event_entry_already_used_attempt`, `event_entry_outside_window_attempt`, `event_entry_voided_attempt`, `event_entry_invalid_token_attempt` | `warn` |
| Sistema | source `system` | `neutral` |

No crear un sistema visual nuevo en este slice.

## 9. Filtros UI

Filtros backend disponibles:

- `action`
- `source`
- `entity_type`
- `event_order_id`
- `event_order_entry_id`
- `event_ticket_type_id`
- `page`
- `page_size`
- `sort`

MVP visible para staff/owner:

- filtro por tipo de actividad/categoria;
- filtro por source;
- boton `Cargar mas` o paginacion simple.

Filtros avanzados o contextuales:

- `action` puede aparecer como filtro avanzado si la UI necesita precision.
- `entity_type` puede aparecer como filtro avanzado si hay suficiente volumen.
- `event_order_entry_id` se usa internamente al entrar desde una entry.
- `event_order_id` se usa internamente al entrar desde una orden.
- `event_ticket_type_id` se usa desde filtros de producto si el panel ya tiene selector de ticket type.

No incluir:

- busqueda textual `q`, porque el endpoint MVP no la soporta;
- inputs visibles para pegar UUIDs;
- filtros por `event_id`, `local_id`, `auth_user_id`, token o metadata.

## 10. Navegacion con entries

Vista general:

- Si una row tiene `event_order_entry_id`, en el futuro puede mostrar accion secundaria `Ver entrada`.
- Solo agregar esa accion si ya existe una ruta o modal confiable de detalle de entry.
- Si no existe, dejar el link fuera del MVP.

Vista por entry futura:

- Usar el mismo endpoint con filtro interno `event_order_entry_id`.
- Mostrar el historial de esa entry como bloque secundario en la pantalla/modal de detalle.
- No crear esa vista en el primer slice UI si no existe el detalle de entry.

## 11. Estados UI

Titulo:

- `Actividad`

Subtitulo:

- `Historial operativo del evento.`

Empty state:

- Titulo: `Todavia no hay actividad registrada para este evento.`
- Subtexto: `Cuando se emitan entradas, se envien QR o se validen accesos, apareceran aca.`

Loading:

- Usar skeleton o spinner segun el patron del panel donde se implemente.
- Para tabla, usar skeleton rows como `DataTable`.
- Para lista, usar placeholders compactos.

Error:

- Mensaje: `No se pudo cargar la actividad.`
- Accion: `Reintentar`

Forbidden/auth:

- Manejar con el patron global existente del panel.
- No mostrar detalles de permisos internos.

## 12. Paginacion y carga progresiva

Backend:

- `page`
- `page_size`
- `total`
- `total_pages`

Decision MVP:

- Usar `page_size = 25`.
- Usar boton `Cargar mas` para operacion diaria o paginacion simple si el contenedor ya usa tablas.
- Evitar infinite scroll en MVP.

Reglas:

- `Cargar mas` incrementa `page` y concatena items.
- Al cambiar filtros, volver a `page = 1` y reemplazar items.
- Deshabilitar `Cargar mas` mientras hay request en vuelo.
- Ocultar `Cargar mas` si `page >= total_pages` o `total_pages = 0`.
- Si el endpoint devuelve `items = []`, mostrar empty state.

## 13. Seguridad y no exposicion

La UI no debe mostrar ni construir:

- `actor_auth_user_id`;
- auth IDs;
- `local_id`;
- `checkin_token`;
- token;
- QR payload;
- QR base64;
- raw URL;
- email crudo;
- telefono;
- documento;
- buyer PII;
- attendee PII;
- metadata cruda;
- request/response crudo.

Reglas:

- Consumir solo lo que devuelve `GET /panel/events/:eventId/activity`.
- No hacer fetch adicional para enriquecer con buyer/attendee.
- No guardar response completa en logs de browser.
- No mostrar `metadata` como JSON.
- Solo renderizar keys permitidas y conocidas de metadata.
- Si aparece una key desconocida, ignorarla.

## 14. API client y hook futuro

Cliente implementado en UI-B:

- `apps/web-next/lib/eventActivity.ts`
- `getEventActivity(input)`
- Usar `apiGetWithAuth`.
- Construir query params con `URLSearchParams`.
- No agregar un cliente para activity local ni reutilizar `/panel/activity/entity` para Eventos.

Input:

```ts
type GetEventActivityInput = {
  eventId: string;
  action?: string;
  source?: string;
  entityType?: string;
  eventOrderId?: string;
  eventOrderEntryId?: string;
  eventTicketTypeId?: string;
  page?: number;
  pageSize?: number;
  sort?: "created_at_desc" | "created_at_asc";
};
```

Response esperada:

```ts
type EventActivityResponse = {
  items: EventActivityItem[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
};
```

Discovery validado en UI-B:

- `apiGetWithAuth(path)` recibe path relativo y arma la URL con `getApiBase`.
- `URLSearchParams` es el patron usado para query params.
- `lib/activity.ts` quedo intacto para activity local.
- `Badge` soporta variantes `neutral`, `success`, `warn` y `danger`.
- No existe `apps/web-next/hooks`.
- El repo exporta tipos desde modulos en `apps/web-next/lib`.

Cliente `getEventActivity`:

- valida `eventId` no vacio;
- usa `encodeURIComponent` para el path;
- construye `/panel/events/:eventId/activity`;
- mapea `entityType` -> `entity_type`;
- mapea `eventOrderId` -> `event_order_id`;
- mapea `eventOrderEntryId` -> `event_order_entry_id`;
- mapea `eventTicketTypeId` -> `event_ticket_type_id`;
- mapea `pageSize` -> `page_size`;
- usa `apiGetWithAuth`;
- no envia `undefined`, `null` ni empty string;
- no incluye `q`, `event_id`, `local_id`, auth IDs, tokens, metadata ni PII;
- no hace fetch extra a buyer/attendee.

Hook futuro:

- `useEventActivity` puede envolver `getEventActivity` si el panel adopta ese patron.
- Como no existe `apps/web-next/hooks`, el primer slice puede crear solo cliente API y estado local en el componente.
- Si se usa React Query, alinear keys por `eventId + filters + page`.

## 15. Estado UI-B

Estado: implementado y validado tecnicamente.

Archivo creado:

- `apps/web-next/lib/eventActivity.ts`

Se implemento:

- tipos TS para actions, sources, entity types, sort, actor, relations, metadata allowlist, item, pagination, response e input de `getEventActivity`;
- cliente `getEventActivity`;
- labels/constants para actions, sources, entity types y categorias;
- helpers puros para labels, category y badge variant;
- metadata tipada por allowlist conocida, sin helper para renderizar metadata cruda.

Seguridad:

- no expone ni construye `actor_auth_user_id`, auth IDs, `local_id`, `checkin_token`, token, QR payload/base64, raw URL, email crudo, phone, document, buyer, attendee ni metadata cruda;
- consume solo lo que devuelve backend;
- no hace joins ni fetches extra.

Validaciones:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente: `next lint` abrio configuracion interactiva de ESLint y no existe config en el proyecto. No fue un error detectado del slice.

No se toco:

- UI visible;
- rutas;
- navegacion;
- backend;
- SQL/migraciones;
- pagos;
- `/payments/callback`;
- activity local;
- flujos de `manual-issue`, email, check-in QR ni fallback manual.

## 16. Roadmap por slices

Slice UI-A:

- Contrato UI docs.

Slice UI-B:

- Tipos TS y cliente read-only `getEventActivity`.
- Estado: implementado, typecheck PASS y `git diff --check` PASS.

Slice UI-C:

- Pantalla/seccion `Actividad` en panel de eventos.
- Lista/timeline o tabla/lista hibrida.
- Filtros MVP por categoria/source.
- `page_size = 25`.
- Boton `Cargar mas`.
- Empty/loading/error/retry.
- Sin historial por entry todavia.
- Sin PII, tokens ni metadata cruda.
- No tocar backend salvo gap explicito.

Slice UI-D:

- QA frontend/manual con fixtures o datos runtime controlados.
- Verificar responsive y no exposicion.

Slice posterior:

- Historial filtrado dentro de una entry.
- Enlaces desde activity hacia entry/orden si existen rutas confiables.
- Filtros avanzados.
- Export solo si se define un contrato especifico posterior.

## 17. QA futuro UI

Casos minimos:

- Evento sin activity muestra empty state correcto.
- Evento con activity muestra rows.
- Labels de actions coinciden con el contrato.
- Labels de source coinciden con el contrato.
- Actor label muestra `Sistema`, display name, `Owner` o `Staff` segun corresponda.
- Filtro por source funciona.
- Filtro por tipo/categoria funciona.
- Cambio de filtro resetea a `page = 1`.
- `Cargar mas` agrega resultados sin duplicar rows.
- Error state muestra `No se pudo cargar la actividad.` y `Reintentar`.
- Loading state no genera layout roto.
- Responsive mobile muestra lista compacta legible.
- Desktop muestra filtros y lista/tabla sin overflow incoherente.
- No aparecen tokens, QR payload/base64, raw URL, PII, auth IDs, `local_id` ni metadata cruda.
- No se hacen fetches adicionales a buyer/attendee.
- Owner/staff pueden ver activity.
- Sin auth/token invalido se maneja con patron existente.
- Usuario sin membership no ve activity.
- No rompe panel local.
- No rompe vistas existentes de orders, check-in, summary ni ticket-types.

## 18. No-goals

Fuera de este contrato:

- implementar codigo;
- tocar backend;
- tocar endpoints;
- tocar SQL/migraciones;
- tocar frontend;
- tocar pagos;
- tocar `/payments/callback`;
- agregar busqueda textual;
- agregar export;
- agregar joins con PII;
- crear endpoint nuevo;
- cambiar flujos de emision/email/check-in;
- crear UI de entry detail;
- integrar activity local;
- mostrar metadata cruda.

Nota: No crear ruta final de Activity si todavía no está clara la estructura del panel de eventos. 
