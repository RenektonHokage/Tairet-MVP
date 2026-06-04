# Ibiza Slice 3E.3A: contrato de fallback manual de check-in por entry

## 1. Proposito

Este documento define el contrato tecnico y de producto para un fallback manual de check-in por entrada emitida del evento Ibiza.

El objetivo es dejar listo el diseno para futuros slices CODE que permitan marcar una `event_order_entry` como usada desde el panel operativo cuando el QR no pueda escanearse, sin avanzar todavia en frontend, activity log, export, B2C, pagos ni cambios en `/payments/callback`.

Este documento no implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, panel UI, pagos, provisioning ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo validado:

- Slice 3B.2: `POST /panel/events/:eventId/orders/manual-issue` implementado y QA runtime PASS completo.
- Slice 3C.2: `GET /panel/events/:eventId/entries` implementado y QA runtime PASS.
- Slice 3D.2: `GET /panel/events/:eventId/entries/:entryId/qr` implementado y QA runtime PASS.
- Slice 3D.3A: `POST /panel/events/:eventId/entries/:entryId/send-email` implementado y QA runtime PASS completo.
- Slice 3D.3B: email automatico post `manual-issue` implementado y QA runtime PASS completo.
- Slice 3E.1: contrato de check-in QR de Eventos aprobado.
- Slice 3E.2A: RPC `check_in_event_entry_by_token` aplicada y QA DB PASS completo.
- Slice 3E.2B: endpoint `PATCH /panel/events/:eventId/checkin/:token` implementado y QA runtime PASS completo.
- Slice 3E.3A: este documento define el contrato de fallback manual por `entryId`.
- Slice 3E.3B: RPC `check_in_event_entry_manually` aplicada y QA DB PASS.

Modelo vigente:

- `event_orders` = orden comercial/backoffice.
- `event_order_items` = linea comercial vendida y snapshot de producto.
- `event_order_entries` = acceso individual, unidad QR y futura unidad de check-in.
- Una Mesa VIP con 10 accesos genera 10 entries y se debe validar entrada por entrada.

## 3. Fuentes revisadas

Documentos:

- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_MANUAL_ISSUE_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`

Codigo/SQL revisado como contexto, sin modificar:

- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/middlewares/eventPanelAuth.ts`
- `functions/api/src/middlewares/requireEventRole.ts`
- `infra/sql/migrations/030_create_event_checkin_rpc.sql`

Hallazgos:

- El check-in QR usa una RPC transaccional como fuente fuerte de clasificacion y update.
- El panel de Eventos ya tiene lectura operativa por entries para encontrar una entrada antes de operar sobre ella.
- El fallback manual debe operar sobre `entryId`, no sobre order, item ni token.
- El panel local tiene flujos legacy de check-in, pero no deben reutilizarse para Eventos porque Eventos se autoriza por `event_panel_users`.

## 4. Endpoint fallback manual definido

Endpoint futuro:

- `PATCH /panel/events/:eventId/entries/:entryId/use`

Proteccion:

- `eventPanelAuth`
- `requireEventRole(["owner", "staff"])`

Objetivo:

- marcar como usada una entrada emitida (`event_order_entries`) cuando el QR no pueda escanearse;
- mantener la misma semantica operativa que el check-in por QR;
- no exponer `checkin_token`;
- no aceptar datos sensibles o de tenant desde cliente.

Body:

- No requerido.
- Si se recibe body no vacio con campos de override, el endpoint debe devolver `400`.

No aceptar desde body/query:

- `event_id`;
- `local_id`;
- `auth_user_id`;
- `checkin_token`;
- `status`;
- `checkin_status`;
- `used_at`;
- `used_by_auth_user_id`;
- `metadata`;
- attendee/buyer/ticket overrides.

## 5. Unidad validable

La unidad validable es:

- `event_order_entries.id`

No son unidad validable:

- `event_orders.id`;
- `event_order_items.id`;
- `event_ticket_types.id`;
- `checkin_token` desde cliente;
- `local_id`.

Regla para paquetes:

- Una Mesa VIP con `entries_per_unit = 10` genera 10 entries.
- El fallback manual marca una sola entry por request.
- No debe marcar una mesa completa con un solo click salvo un contrato futuro explicito.

## 6. Decision RPC vs endpoint TS

Decision:

- Implementar el update y la clasificacion fuerte en una RPC SQL transaccional.
- El endpoint TS debe ser un adaptador delgado: autentica, valida path/query/body, llama RPC y mapea resultado a HTTP.
- No duplicar en TypeScript la logica de ventana, estado, concurrencia ni update condicional.

RPC propuesta para el slice SQL futuro:

```sql
public.check_in_event_entry_manually(
  p_event_id uuid,
  p_actor_auth_user_id uuid,
  p_entry_id uuid
)
returns jsonb
```

Propiedades esperadas:

- `security definer`;
- `set search_path = public, pg_temp`;
- `revoke execute` de `public`, `anon`, `authenticated`;
- `grant execute` solo a `service_role`;
- membership defensivo en `event_panel_users`;
- scope obligatorio por `event_id`;
- update condicional atomico.

Alternativa evaluada:

- Hacer el `update ... where ... returning` directamente en TS.

Decision sobre la alternativa:

- No usarla como primera opcion porque partiria la semantica de check-in entre SQL y TS.
- Mantener una sola fuente de verdad operacional reduce divergencia entre QR y fallback manual.

## 7. Reglas de validacion

Validaciones de entrada:

- `eventId` debe ser UUID valido.
- `entryId` debe ser UUID valido.
- Actor debe estar autenticado.
- Actor debe tener membership del evento.
- Rol permitido: `owner` o `staff`.
- `event_id` se toma solo desde path y se pasa a la RPC desde `req.eventPanelUser.eventId`.
- `p_actor_auth_user_id` se toma solo desde `req.eventPanelUser.authUserId`.
- Body no debe contener overrides.
- Query params desconocidos deben rechazarse.

Validaciones de dominio:

- Evento inexistente: `404`.
- Evento no operable: status semantico `event_not_operable`; no actualizar entry.
- Entry inexistente o que no pertenece al evento: `404 entry_not_found`.
- Entry `voided`: status semantico `voided`; no actualizar entry.
- Entry con `status <> issued`: status semantico `not_valid_status`; no actualizar entry.
- Entry ya usada: status semantico `already_used`; no actualizar entry.
- Entry emitida y no usada, pero fuera de ventana: status semantico `outside_window`; no actualizar entry.
- Entry emitida, no usada y dentro de ventana: update a `checkin_status = used`.

## 8. Prioridad de clasificacion

Orden obligatorio de clasificacion despues de resolver evento, actor y entry:

1. Entry inexistente o fuera del evento: `404 entry_not_found`.
2. Evento no operable: `event_not_operable`.
3. `entry.status = voided`: `voided`.
4. `entry.status <> issued`: `not_valid_status`.
5. `entry.checkin_status = used`: `already_used`.
6. Fuera de ventana de check-in: `outside_window`.
7. `issued + unused + dentro de ventana`: update atomico y respuesta `valid`.

Motivo:

- Los estados propios de la entrada deben tener prioridad sobre la ventana.
- Una entrada ya usada fuera de ventana debe seguir respondiendo `already_used`, no `outside_window`.
- Una entrada anulada fuera de ventana debe responder `voided`, no `outside_window`.

## 9. Atomicidad y concurrencia

La RPC futura debe usar update condicional atomico:

```sql
update public.event_order_entries
set
  checkin_status = 'used',
  used_at = now(),
  used_by_auth_user_id = p_actor_auth_user_id,
  updated_at = now()
where id = p_entry_id
  and event_id = p_event_id
  and status = 'issued'
  and checkin_status = 'unused'
  and used_at is null
  and used_by_auth_user_id is null
returning id, checkin_status, used_at;
```

Comportamiento:

- Si el update devuelve una fila: `valid`.
- Si el update no devuelve filas: reconsultar la entry y reclasificar.
- La reclasificacion post-update debe mantener el orden robusto:
  - inexistente -> `entry_not_found`;
  - `voided` -> `voided`;
  - `status <> issued` -> `not_valid_status`;
  - `checkin_status = used` -> `already_used`;
  - si sigue `issued/unused` en una carrera rara -> `not_valid_status` o estado seguro equivalente.

No hace falta revisar `outside_window` en la reclasificacion post-update porque la ventana ya fue aprobada antes del intento de update.

## 10. Response segura

Respuesta semantica exitosa:

```json
{
  "ok": true,
  "status": "valid",
  "entry": {
    "id": "uuid",
    "ticket_name": "General Preventa 1",
    "checkin_status": "used",
    "used_at": "2026-06-03T20:00:00.000Z"
  },
  "attendee": {
    "name": "string",
    "last_name": "string",
    "document": "string"
  },
  "event": {
    "id": "uuid",
    "title": "Ibiza"
  }
}
```

Status semanticos posibles:

- `valid`;
- `already_used`;
- `outside_window`;
- `voided`;
- `not_valid_status`;
- `event_not_operable`.

Errores HTTP esperados:

- `400 invalid_input`: `eventId` o `entryId` invalido, body/query con overrides o formato invalido.
- `401`: sin auth o token invalido, manteniendo middlewares existentes.
- `403 forbidden`: actor sin membership/rol.
- `404 event_not_found`: evento inexistente.
- `404 entry_not_found`: entry inexistente o no perteneciente al evento.
- `500 manual_checkin_failed`: error inesperado.

No incluir:

- `checkin_token`;
- QR raw;
- QR base64;
- attendee email;
- attendee phone;
- buyer PII;
- `created_by_auth_user_id`;
- `used_by_auth_user_id`;
- `auth_user_id`;
- `local_id`;
- metadata cruda;
- datos de otros eventos.

## 11. No distinguir QR/manual durablemente

Decision:

- El primer fallback manual no registra durablemente si el check-in ocurrio por QR o por accion manual.
- Ambos flujos terminan en el mismo estado operativo: `checkin_status = used`.
- No agregar columna `checkin_method`.
- No agregar metadata.
- No agregar activity log en este slice.

Motivo:

- El objetivo inmediato es operacion de puerta confiable.
- La trazabilidad fina debe resolverse con un activity log futuro, no con metadata improvisada en entries.

Decision futura:

- Si se requiere auditoria, un activity log debe registrar `event_entry_checked_in` con `method = qr | manual`, actor y timestamp, sin exponer tokens ni PII innecesaria.

## 12. Relacion con listado y busqueda

Flujo operativo esperado:

1. Staff busca una entrada en `GET /panel/events/:eventId/entries`.
2. Staff identifica la entry por documento, email, nombre, ticket o estado.
3. Staff ejecuta `PATCH /panel/events/:eventId/entries/:entryId/use`.
4. El listado vuelve a reflejar `checkin_status = used` y `used_at`.

Decision:

- No crear endpoint `/orders` para este fallback.
- No cambiar el contrato de `/entries` en este slice.
- El endpoint de lectura existente ya provee `entry.id`, attendee, buyer y estado suficiente para soporte operativo.

## 13. Activity futuro

No implementar activity en este contrato.

Eventos futuros recomendados:

- `event_entry_checked_in`
- `event_entry_checkin_rejected`

Campos futuros sugeridos:

- `event_id`;
- `entry_id`;
- `order_id`;
- `actor_auth_user_id`;
- `method = qr | manual`;
- `result_status`;
- `occurred_at`;
- `request_id`;
- metadata minima sin PII sensible.

No incluir en activity futura:

- `checkin_token`;
- QR payload;
- QR base64;
- attendee phone;
- buyer PII;
- `local_id`;
- metadata cruda.

## 14. Seguridad y no exposicion

Reglas obligatorias:

- Usar `eventPanelAuth`.
- Usar `requireEventRole(["owner", "staff"])`.
- Scope por `req.eventPanelUser.eventId`.
- No aceptar `event_id` por query o body.
- No usar `panel_users`.
- No usar `local_id`.
- No exponer `checkin_token`.
- No aceptar token desde cliente.
- No exponer email/phone de attendee en respuesta de check-in.
- No exponer buyer PII.
- No exponer `auth_user_id`.
- No exponer `used_by_auth_user_id`.
- No exponer metadata cruda.

Logging:

- Permitido loggear `eventId`, `entryId`, request id y codigo de error.
- No loggear token, QR payload, QR base64, phone, document, buyer PII ni filas completas.

## 15. Roadmap por slices

Roadmap recomendado:

- Slice 3E.3A: contrato de fallback manual por entry. Estado: este documento.
- Slice 3E.3B: migracion/RPC `check_in_event_entry_manually(...)` aplicada y QA DB PASS.
- Slice 3E.3C: endpoint TS `PATCH /panel/events/:eventId/entries/:entryId/use` con QA runtime. Estado: proximo paso.
- Slice 3E.4: activity log de check-in QR/manual, si se requiere auditoria.
- Slice 3E.5: UI operativa de check-in y fallback manual.

No adelantar frontend antes de cerrar RPC y endpoint.

## 16. QA futuro

QA DB para Slice 3E.3B:

- RPC existe y firma correcta.
- Grants/revokes correctos: solo `service_role` puede ejecutar.
- Owner/staff con membership puede validar entry `issued/unused` dentro de ventana.
- Entry pasa a `checkin_status = used`.
- Se completa `used_at`.
- Se completa `used_by_auth_user_id`.
- Segunda ejecucion sobre la misma entry devuelve `already_used`.
- Entry usada y fuera de ventana devuelve `already_used`, no `outside_window`.
- Entry `voided` y fuera de ventana devuelve `voided`, no `outside_window`.
- Entry `issued/unused` fuera de ventana devuelve `outside_window`.
- Entry inexistente o de otro evento devuelve `entry_not_found`.
- Actor sin membership devuelve `forbidden`.
- Evento inexistente devuelve `event_not_found`.
- Evento `paused` o `finished` devuelve `event_not_operable`.
- No se expone `checkin_token`, email, phone, buyer PII, `auth_user_id`, `local_id` ni metadata.
- Usar `begin; ... rollback;` para no dejar datos persistidos.

QA runtime para Slice 3E.3C:

- Owner Ibiza marca manualmente una entry como usada.
- Staff Ibiza marca manualmente una entry como usada.
- Segunda marca devuelve `already_used`.
- Entry inexistente devuelve `404 entry_not_found`.
- Entry de otro evento devuelve `404 entry_not_found` o `403` si falla membership antes.
- Entry `voided` devuelve `voided`.
- Entry fuera de ventana devuelve `outside_window`.
- Usuario local sin membership devuelve `403`.
- Sin auth devuelve `401`.
- Token invalido devuelve `401`.
- `eventId` invalido devuelve `400`.
- `entryId` invalido devuelve `400`.
- Body con `checkin_token`, `event_id`, `local_id` o overrides devuelve `400`.
- Response no contiene `checkin_token`, QR raw, QR base64, attendee email, attendee phone, buyer PII, `auth_user_id`, `local_id` ni metadata.
- `/entries` refleja `checkin_status = used`.
- `/summary`, `/ticket-types`, `manual-issue`, `send-email` y QR PNG no se rompen.
- Regresion panel local: `/panel/me` y `/panel/orders/summary` siguen en `200 OK`.
- Limpieza QA deja Ibiza sin ordenes/entries QA si se crearon para el test.

## 17. No-goals

Fuera de este contrato:

- endpoint TS;
- migracion SQL;
- aplicar migracion;
- check-in QR;
- QR visual;
- email QR;
- export;
- activity log;
- frontend/panel UI;
- B2C publico;
- pagos online;
- `/payments/callback`;
- WhatsApp API;
- import CSV;
- anulacion/void;
- edicion/correccion de entradas;
- bulk check-in;
- distinguir durablemente QR vs manual.

## 18. Proximo CODE recomendado

Slice 3E.3C - endpoint TS:

- agregar `PATCH /panel/events/:eventId/entries/:entryId/use`;
- usar `eventPanelAuth`;
- usar `requireEventRole(["owner", "staff"])`;
- validar path/body/query de forma estricta;
- llamar la RPC;
- mapear errores a HTTP;
- no duplicar update ni semantica en TS;
- no tocar frontend, pagos ni `/payments/callback`.

## 19. Estado Slice 3E.3B - RPC fallback manual QA DB PASS

Slice 3E.3B queda registrado como implementado, aplicado y validado:

- migracion 031 aplicada;
- RPC `public.check_in_event_entry_manually(uuid, uuid, uuid)` creada;
- firma validada: `check_in_event_entry_manually(uuid,uuid,uuid)`;
- QA DB PASS;
- lista para ser consumida por el endpoint TS de Slice 3E.3C.

QA DB registrado:

- funcion encontrada con firma `check_in_event_entry_manually(uuid,uuid,uuid)`;
- grants correctos: `anon_can_execute = false`, `authenticated_can_execute = false`, `service_role_can_execute = true`;
- todos los checks del script de QA dieron `true`;
- check-in manual valido de entry `issued/unused` dentro de ventana muto a `checkin_status = used`, `used_at` no nulo y `used_by_auth_user_id = actor`;
- segundo intento sobre la misma entry respondio `already_used`;
- entry inexistente respondio `entry_not_found`;
- actor sin membership respondio `forbidden`;
- evento inexistente respondio `event_not_found`;
- entry `unused` fuera de ventana respondio `outside_window` y no muto la entry;
- entry `voided` fuera de ventana respondio `voided`;
- evento no operable respondio `event_not_operable`;
- responses validadas no expusieron `checkin_token`, `auth_user_id`, `local_id`, metadata sensible, email ni phone;
- QA corrio con rollback y dejo 0 datos QA persistidos;
- Ibiza quedo restaurado con `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Comportamiento validado:

- instalacion correcta de RPC;
- grants correctos;
- validacion defensiva de membership;
- validacion por `event_id + entry_id`;
- check-in manual valido;
- doble intento como `already_used`;
- ventana horaria;
- entry `voided`;
- evento no operable;
- mutacion atomica mediante update condicional;
- no exposicion de token ni datos internos sensibles;
- rollback sin datos QA persistidos;
- evento Ibiza restaurado a su ventana original.

Matiz:

- Este QA valida DB/RPC, no endpoint HTTP.
- El endpoint TS queda para Slice 3E.3C.
- TypeScript no debe duplicar la logica de ventana, estado, doble uso ni mutacion de entry.
- La RPC es la fuente de verdad para el fallback manual.
