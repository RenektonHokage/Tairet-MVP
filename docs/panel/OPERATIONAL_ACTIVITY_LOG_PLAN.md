# Operational Activity Log Plan

## 1. Proposito

Este documento planifica un activity log operativo para el panel de Tairet, enfocado en entradas/free pass, check-ins y reservas.

El objetivo es dar trazabilidad simple y util: que el local pueda entender que paso con una entrada o reserva, cuando ocurrio y quien ejecuto la accion cuando aplica.

Este plan no implementa codigo. Define el alcance y el roadmap para pasar a slices posteriores.

No es un CRM, no es auditoria completa del panel y no registra trazabilidad durable QR/manual. Para este bloque alcanza con registrar `entrada validada`, sin distinguir si fue por scanner QR o validacion manual.

## 2. Alcance

Incluido:

- entradas/free pass;
- check-ins;
- validacion manual desde Entradas;
- reservas;
- historial operativo por registro;
- eventos acotados y filtrados por `local_id`;
- actor panel cuando la accion viene del panel.

No incluido:

- CRM;
- auditoria completa;
- reportes por staff;
- metricas avanzadas;
- export de activity;
- metodo QR/manual;
- paid flows;
- `/payments/callback`.

Este plan aplica al corte `free_pass only`.

## 3. Problema operativo que resuelve

El activity log debe responder preguntas operativas como:

- cuando se creo una entrada;
- cuando se valido una entrada;
- si hubo intento de validacion duplicada;
- cuando se creo una reserva;
- quien confirmo o cancelo una reserva desde el panel;
- si se actualizo la nota interna de una mesa;
- que paso antes de un reclamo de cliente o de una duda en puerta.

El objetivo es reducir incertidumbre operativa sin registrar ruido de UI.

No se deben registrar:

- busquedas;
- clicks visuales;
- refresh/polling;
- apertura de pantallas;
- intentos visuales sin cambio operativo.

## 4. Estado actual detectado

Discovery confirmado por repo:

- existe `GET /activity`;
- `GET /activity` requiere `panelAuth` y `requireRole(["owner", "staff"])`;
- `GET /activity` ignora el `localId` del query y usa `req.panelUser.localId`;
- `GET /activity` construye una timeline agregada y derivada desde:
  - `orders`;
  - `reservations`;
  - `payment_events`;
  - `whatsapp_clicks`;
  - `events_public`;
  - `promos`;
  - `profile_views`;
- `GET /activity` no usa una tabla persistente de eventos operativos por entidad;
- no se encontro una tabla dedicada de activity/audit/history para historial por entrada o reserva;
- `panelAuth` expone `req.panelUser.userId`, `req.panelUser.email`, `req.panelUser.localId` y `req.panelUser.role`;
- `panelAuth` alcanza para registrar actor panel sin depender de `panel_users.id`;
- `POST /orders` y `POST /reservations` son acciones publicas sin actor panel;
- `PATCH /panel/orders/:id/use` y `PATCH /panel/checkin/:token` actualizan `orders.used_at`;
- `PATCH /panel/reservations/:id` actualiza `status` o `table_note`;
- el schema visible tiene `orders`, `reservations`, `panel_users`, `events_public`, `payment_events`, tracking y tablas operativas, pero no una tabla de historial operativo dedicada.

Lectura:

- `GET /activity` sirve hoy como widget/timeline agregada del panel;
- `GET /activity` no debe tratarse como historial durable por registro;
- para el MVP de activity log operativo conviene crear un modelo nuevo y acotado;
- el activity log nuevo no debe reemplazar `GET /activity` hasta validar contrato y UI.

Fuentes revisadas en discovery:

- `docs/production/FREE_PASS_RELEASE_CANDIDATE.md`;
- `docs/production/ROLLBACK_BACKUP_AND_RECOVERY_RUNBOOK.md`;
- `docs/security/SERVICE_ROLE_MINIMIZATION_PLAN.md`;
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`;
- `docs/panel/MANUAL_ENTRY_VALIDATION_FALLBACK.md`;
- `docs/panel/PANEL_NEAR_REALTIME_AND_MULTI_DEVICE_SYNC_PLAN.md`;
- `docs/production/B7_FINAL_SMOKE_AND_GO_NO_GO.md`;
- `functions/api/src/routes/activity.ts`;
- `functions/api/src/routes/panel.ts`;
- `functions/api/src/routes/orders.ts`;
- `functions/api/src/routes/reservations.ts`;
- `functions/api/src/middlewares/panelAuth.ts`;
- `functions/api/src/middlewares/requireRole.ts`;
- `infra/sql/schema.sql`;
- `infra/sql/rls.sql`;
- `infra/sql/migrations/**`;
- `apps/web-next/lib/activity.ts`;
- `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`;
- `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`;
- `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`;
- `apps/web-next/components/panel/views/ReservationsView.tsx`.

## 5. Eventos MVP propuestos

| Event type | Entidad | Disparador | Actor | Metadata minima | Prioridad | Slice |
| --- | --- | --- | --- | --- | --- | --- |
| `order_created` | `order` | `POST /orders` exitoso | `customer` | `status`, `quantity`, `intended_date` si aplica | Alta | Slice 2 |
| `order_checked_in` | `order` | `PATCH /panel/orders/:id/use` exitoso o `PATCH /panel/checkin/:token` exitoso | `panel_user` | `status`, `used_at` | Alta | Slice 2 |
| `order_already_used_attempt` | `order` | Intento sobre orden existente, del tenant correcto y con `used_at` previo | `panel_user` | `used_at` previo | Media | Slice 2 |
| `reservation_created` | `reservation` | `POST /reservations` exitoso | `customer` | `status`, `guests`, fecha operacional si aplica | Alta | Slice 3 |
| `reservation_confirmed` | `reservation` | `PATCH /panel/reservations/:id` cambia a `confirmed` | `panel_user` | `status` | Alta | Slice 3 |
| `reservation_cancelled` | `reservation` | `PATCH /panel/reservations/:id` cambia a `cancelled` | `panel_user` | `status` | Alta | Slice 3 |
| `reservation_table_note_updated` | `reservation` | `PATCH /panel/reservations/:id` actualiza `table_note` | `panel_user` | indicador booleano de nota actualizada | Media | Slice 3 |

Reglas:

- no registrar `checkin_token`;
- no registrar email, telefono, documento, nombre completo ni nota interna por defecto;
- no registrar metodo QR/manual;
- no registrar busquedas, clicks, refreshes ni polling;
- no registrar token invalido sin orden encontrada;
- no registrar intentos duplicados que no puedan vincularse a una entidad del tenant correcto.

## 6. Modelo de evento recomendado

Recomendacion: crear una tabla nueva, por ejemplo `operational_activity_events`, y un helper backend pequeno.

Campos conceptuales:

```ts
{
  id,
  local_id,
  entity_type: "order" | "reservation",
  entity_id,
  event_type,
  actor_type: "panel_user" | "customer" | "system",
  actor_user_id,
  actor_role,
  message,
  metadata,
  created_at
}
```

Politica de datos:

- `local_id` es obligatorio;
- `entity_type` y `entity_id` son obligatorios para historial por registro;
- `actor_user_id` se completa con `req.panelUser.userId` cuando la accion viene del panel;
- `actor_role` se completa con `req.panelUser.role` cuando aplica;
- acciones publicas usan `actor_type = "customer"`;
- procesos sin actor claro usan `actor_type = "system"`;
- `metadata` debe ser minima y no debe contener PII innecesaria;
- no guardar `checkin_token`;
- no guardar `table_note` completo;
- no guardar metodo QR/manual en este bloque.

Helper recomendado:

- `recordOperationalActivity(input)`;
- best-effort: si falla el insert del evento, no debe romper la operacion core;
- debe loguear errores con `requestId` si esta disponible;
- debe recibir `local_id` ya validado por el flujo de negocio;
- debe usarse despues de que la accion principal se complete correctamente, salvo intentos duplicados ya usados, que son errores operativos controlados.

Indices recomendados:

- `(local_id, entity_type, entity_id, created_at desc)`;
- `(local_id, created_at desc)`;
- `(local_id, event_type, created_at desc)` si se usa vista general futura.

RLS/grants:

- tabla backend-only para `anon` y `authenticated`;
- lectura/escritura desde backend con service role mientras siga el modelo actual;
- no exponer Data API directa;
- mantener tenant enforcement en endpoints backend.

## 7. Roadmap por slices

### Slice 0 - Discovery/documentacion

Estado de este documento.

Resultado esperado:

- plan cerrado;
- decisiones de alcance explicitadas;
- eventos MVP definidos;
- riesgos y QA definidos.

### Slice 1 - Modelo/helper de activity

Objetivo:

- agregar tabla dedicada e indices;
- aplicar RLS/grants backend-only;
- crear helper backend `recordOperationalActivity(...)`.

Reglas:

- migracion pequena;
- no tocar UI;
- no tocar paid flows;
- no cambiar contratos existentes;
- helper best-effort para no romper flujos core.

### Slice 2 - Eventos de Entradas/check-in

Objetivo:

- registrar `order_created`;
- registrar `order_checked_in`;
- registrar `order_already_used_attempt`.

Rutas candidatas:

- `POST /orders`;
- `PATCH /panel/orders/:id/use`;
- `PATCH /panel/checkin/:token`.

Reglas:

- no registrar `checkin_token`;
- no distinguir QR/manual;
- no registrar token invalido sin entidad;
- no cambiar reglas del scanner ni validacion manual;
- no romper near realtime de Entradas.

### Slice 3 - Eventos de Reservas

Objetivo:

- registrar `reservation_created`;
- registrar `reservation_confirmed`;
- registrar `reservation_cancelled`;
- registrar `reservation_table_note_updated`.

Rutas candidatas:

- `POST /reservations`;
- `PATCH /panel/reservations/:id`.

Reglas:

- no guardar contenido de `table_note`;
- no guardar PII comercial en metadata;
- no cambiar emails ni reglas de estado;
- no romper near realtime de Reservas.

### Slice 4 - UI historial por registro

Objetivo:

- mostrar historial dentro de una entrada o reserva especifica.

Endpoint sugerido:

```http
GET /panel/activity/entity?entity_type=order|reservation&entity_id=<uuid>
```

Controles:

- `panelAuth`;
- `requireRole(["owner", "staff"])`;
- filtro por `local_id = req.panelUser.localId`;
- validacion de `entity_type` y UUID;
- response sin PII sensible ni tokens.

Reglas UI:

- cargar historial lazy-load al abrir/expandir;
- no cargar historiales de todas las cards por defecto;
- mostrar mensaje, fecha/hora y actor si aplica;
- no mezclar con refresh/polling de listados.

### Slice 5 - Vista "Ultimas acciones"

Objetivo:

- vista o widget general de acciones recientes.

Reglas:

- opcional y posterior;
- reutilizar la tabla nueva;
- no reemplazar `GET /activity` actual hasta validar contrato/UI;
- evitar ruido y exceso de eventos.

## 8. UI propuesta

Primer UI recomendado: historial por registro, no vista global.

Entradas:

- agregar una accion o seccion colapsable `Historial`;
- mostrar eventos relevantes:
  - `Entrada creada`;
  - `Entrada validada`;
  - `Intento de validacion duplicado`;
- no mostrar si fue QR o manual;
- no mostrar `checkin_token`;
- no mostrar PII del comprador dentro del evento.

Reservas:

- agregar seccion `Historial` en card/detalle;
- mostrar eventos:
  - `Reserva creada`;
  - `Reserva confirmada`;
  - `Reserva cancelada`;
  - `Nota interna actualizada`;
- no mostrar el contenido de `table_note`;
- mostrar actor panel cuando aplique.

Copy recomendado:

- `Entrada creada`;
- `Entrada validada`;
- `Intento de validacion duplicado`;
- `Reserva creada`;
- `Reserva confirmada`;
- `Reserva cancelada`;
- `Nota interna actualizada`.

Vista general futura:

- `Ultimas acciones`;
- maxima prioridad despues de validar historial por registro;
- puede mostrar los ultimos eventos por local;
- no debe convertirse en CRM ni reporte avanzado.

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| PII innecesaria | Exposicion de datos sensibles | Metadata minima; no guardar tokens, emails, telefonos, documentos, nombres completos ni notas internas por defecto. |
| Tenant isolation incorrecta | Un local podria ver eventos de otro | `local_id` obligatorio en writes y reads; endpoints panel filtran por `req.panelUser.localId`. |
| Ruido operacional | Historial poco util | Registrar solo cambios operativos, no clicks, busquedas, refreshes ni aperturas. |
| Actor no disponible | Evento ambiguo | Usar `customer` o `system`; no inventar staff. |
| Duplicados | Timeline confusa | Event types claros; best-effort sin idempotencia compleja en MVP salvo ruido real. |
| Performance | Queries lentas en panel | Indices por local, entidad y `created_at`; lazy-load por registro. |
| Migracion | Riesgo DB | Slice separado con backup/checklist y QA API/DB. |
| Mezcla con `GET /activity` | Romper widget existente | Mantener `GET /activity` actual; no reemplazarlo en MVP. |
| Metodo QR/manual | Reabrir decision de trazabilidad | Mantener fuera de alcance; registrar solo `Entrada validada`. |

## 10. QA recomendado

QA por Slice 1:

- migracion aplicada en entorno controlado;
- tabla existe;
- indices existen;
- grants/RLS backend-only verificados;
- helper inserta evento minimo;
- fallo del helper no rompe flujo de prueba.

QA por Slice 2:

- crear entrada y verificar `order_created`;
- validar entrada manualmente y verificar `order_checked_in`;
- validar entrada por scanner y verificar `order_checked_in`;
- intentar validar entrada ya usada y verificar `order_already_used_attempt`;
- token invalido no crea evento sin entidad;
- historial no expone `checkin_token`;
- `PATCH /panel/checkin/:token` sigue funcionando;
- `PATCH /panel/orders/:id/use` sigue funcionando;
- `GET /panel/orders/search` sigue funcionando;
- near realtime de Entradas no se rompe.

QA por Slice 3:

- crear reserva y verificar `reservation_created`;
- confirmar reserva y verificar `reservation_confirmed`;
- cancelar reserva y verificar `reservation_cancelled`;
- editar `table_note` y verificar `reservation_table_note_updated`;
- el evento de nota no contiene la nota interna;
- `POST /reservations` sigue funcionando;
- `PATCH /panel/reservations/:id` sigue funcionando;
- near realtime de Reservas no se rompe.

QA por Slice 4:

- owner ve historial de su local;
- staff ve historial de su local;
- otro tenant no puede ver historial;
- UUID invalido devuelve error controlado;
- entidad inexistente devuelve respuesta controlada;
- historial no expone email, telefono, documento, `checkin_token` ni `table_note`;
- UI carga historial bajo demanda;
- UI no dispara requests por todas las cards;
- `/health` 200;
- `x-request-id` presente.

QA transversal:

- `GET /activity` existente no se rompe;
- Activity/Metrics/Dashboard siguen cargando;
- no se tocan paid flows;
- `/payments/callback` sigue fuera del corte;
- Sentry captura errores si aparecen.

## 11. Fuera de alcance

Fuera de este bloque:

- paid flows;
- `/payments/callback`;
- CRM;
- auditoria completa;
- reportes por staff;
- metricas avanzadas;
- export de activity;
- metodo QR/manual;
- `checkin_method`;
- `checkin_source`;
- `used_method`;
- cambios de scanner;
- cambios de reservas fuera de activity;
- cambios B2C UI;
- cambios a near realtime;
- reemplazo de `GET /activity` actual;
- WebSocket/SSE/Supabase Realtime.

## 12. Decisiones futuras

Evaluar despues del MVP:

- distinguir QR/manual si aparece necesidad real de auditoria;
- ultimas 10 validaciones en dashboard;
- intentos duplicados por rango horario;
- activity global consolidada;
- reportes operativos por staff;
- export de activity;
- integracion con Sentry/logs para troubleshooting;
- auditoria mas completa con cambios de catalogo, promos o perfil;
- retencion de eventos;
- politica de purga;
- endpoint o widget para `Ultimas acciones`.
