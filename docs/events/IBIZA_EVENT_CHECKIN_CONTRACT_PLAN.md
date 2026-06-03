# Ibiza Slice 3E.1: contrato de check-in QR para entradas de evento

## 1. Proposito

Este documento define el contrato tecnico y de producto para el futuro check-in QR de entradas emitidas del evento Ibiza.

El objetivo es dejar listo el diseno para un futuro slice CODE que implemente validacion de QR de Eventos sin reutilizar el check-in local basado en `orders.local_id`.

Este documento no implementa codigo runtime, SQL, migraciones, endpoints, frontend, B2C, pagos, export, activity log ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo validado:

- Slice 3B.2: `POST /panel/events/:eventId/orders/manual-issue` implementado y QA runtime PASS completo.
- Slice 3C.2: `GET /panel/events/:eventId/entries` implementado y QA runtime PASS.
- Slice 3D.2: `GET /panel/events/:eventId/entries/:entryId/qr` implementado y QA runtime PASS.
- Slice 3D.3A: `POST /panel/events/:eventId/entries/:entryId/send-email` implementado y QA runtime PASS completo.
- Slice 3D.3B: email automatico post `manual-issue` implementado y QA runtime PASS completo.

Modelo vigente:

- `event_orders` = orden comercial/backoffice.
- `event_order_items` = linea comercial vendida.
- `event_order_entries` = acceso individual, unidad QR y futura unidad de check-in.
- `event_order_entries.checkin_token` existe como valor opaco interno.
- `event_order_entries.checkin_status` tiene valores `unused | used`.
- `event_order_entries.used_at` y `used_by_auth_user_id` registran el check-in exitoso.

## 3. Fuentes revisadas

Documentos:

- `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/IBIZA_MANUAL_ISSUE_CONTRACT_PLAN.md`

Codigo y SQL:

- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/routes/panel.ts`
- `functions/api/src/services/eventQr.ts`
- `functions/api/src/services/operationalActivity.ts`
- `functions/api/src/middlewares/eventPanelAuth.ts`
- `functions/api/src/middlewares/requireEventRole.ts`
- `infra/sql/migrations/027_create_event_pilot_tables.sql`
- `infra/sql/migrations/028_add_event_packages_and_order_items.sql`
- `infra/sql/migrations/029_create_issue_event_manual_order_rpc.sql`

Hallazgos:

- El QR de Eventos ya se genera server-side desde `event_order_entries.checkin_token`.
- El payload QR vigente usa formato `https://tairet.com.py/events/checkin/<opaque-validation-value>`.
- El valor opaco no se devuelve en JSON y no debe aparecer en logs, exports ni activity metadata.
- El check-in local existente `PATCH /panel/checkin/:token` no debe reutilizarse tal cual porque esta acoplado a `orders.local_id`.
- Eventos ya usa `eventPanelAuth` y `requireEventRole(["owner", "staff"])` para endpoints operativos.

## 4. Endpoint de check-in QR

Endpoint futuro recomendado:

- `PATCH /panel/events/:eventId/checkin/:token`

Proteccion:

- `eventPanelAuth`
- `requireEventRole(["owner", "staff"])`

Input:

- `eventId` solo desde path.
- `token` solo desde path.
- No aceptar `event_id`, `local_id`, `auth_user_id`, `checkin_token`, `metadata` ni overrides por body o query.
- El body no es requerido para el primer CODE.
- Para el MVP, el token en path se acepta por consistencia con el flujo actual y por simplicidad del scanner.

Objetivo:

- validar un QR escaneado;
- marcar una `event_order_entry` como usada si corresponde;
- devolver una respuesta operativa segura para puerta;
- evitar doble validacion por concurrencia;
- no exponer el token ni el payload QR.

## 5. Token y payload QR

Decision:

- El QR visual conserva el payload actual:

```text
https://tairet.com.py/events/checkin/<opaque-validation-value>
```

- El scanner/panel extrae el ultimo segmento de la URL y llama el endpoint con ese valor como `:token`.
- Para el primer CODE, `<opaque-validation-value>` puede seguir mapeando a `event_order_entries.checkin_token`.
- El endpoint backend valida el token contra `event_order_entries.checkin_token` y siempre dentro del `event_id` autorizado.
- El QR no incluye PII.
- El token debe tratarse como credencial de acceso aunque viaje dentro de una URL escaneada.

Reglas:

- No devolver `checkin_token`.
- No devolver payload QR.
- No devolver QR base64.
- No loggear token, payload QR, URL escaneada completa, path completo ni `req.originalUrl`.
- No incluir token en exports.
- No incluir token en activity metadata.
- No revelar si un token valido pertenece a otro evento.

Hardening futuro:

- Evaluar mover el token al body:

```text
PATCH /panel/events/:eventId/checkin
```

```json
{
  "token": "opaque-validation-value"
}
```

- Evaluar redaccion o sanitizacion de paths en logs de infraestructura si la plataforma lo permite.
- No cambiar el contrato del MVP todavia; documentar el riesgo y restringir logging de aplicacion.

## 6. Validaciones

Validaciones de request:

- `eventId` debe ser UUID valido.
- `token` debe existir y no estar vacio despues de `trim`.
- Para el primer CODE, `token` debe tener formato UUID porque `checkin_token` actual es UUID.
- Parametros desconocidos en query/body deben rechazarse si se usa schema strict.

Validaciones de auth y tenant:

- El usuario debe estar autenticado.
- El usuario debe pertenecer a `event_panel_users` del evento.
- El rol debe ser `owner` o `staff`.
- La query usa `req.eventPanelUser.eventId` como fuente de verdad.
- No usar `panel_users`.
- No usar `local_id`.
- No aceptar `event_id` desde query o body.

Validaciones de evento:

- El evento debe existir.
- Durante QA y pruebas controladas, el backend puede permitir check-in para eventos en `draft` y `published`.
- Para operacion en puerta, el evento debe estar en `published`.
- `draft` no debe usarse como estado operativo del evento durante la validacion de asistentes.
- Antes de operar Ibiza en puerta, el evento debe pasar a `published` como paso operativo previo.
- Mantener `draft` permitido solo para pruebas controladas o ambientes de validacion.
- `paused` y `finished` bloquean check-in con estado `event_not_operable`.
- La ventana de check-in se toma de `events.checkin_valid_from` y `events.checkin_valid_to`.

Validaciones de entry:

- Debe existir una `event_order_entry` con `checkin_token = token` y `event_id = req.eventPanelUser.eventId`.
- Si el token no existe dentro del evento autorizado, responder estado `invalid` sin datos de entry.
- La entry debe tener `status = issued`.
- La entry debe tener `checkin_status = unused`.
- La entry debe tener `used_at is null`.
- La entry debe tener `used_by_auth_user_id is null`.

## 7. Ventana de check-in

Fuente de verdad:

- `events.checkin_valid_from`
- `events.checkin_valid_to`

Ibiza:

- `checkin_valid_from = 2026-08-01 18:00:00 America/Asuncion`
- `checkin_valid_to = 2026-08-02 06:00:00 America/Asuncion`

Reglas:

- Comparar contra `now()` de DB o timestamp server-side confiable.
- Permitir check-in si `now >= checkin_valid_from` y `now <= checkin_valid_to`.
- Fuera de ventana devolver estado `outside_window`.
- Fuera de ventana no actualizar `checkin_status`, `used_at` ni `used_by_auth_user_id`.
- No usar `orders.intended_date`.
- No usar `weekendWindow`.
- No usar ventanas del panel local.

## 8. Estados de respuesta

Estados semanticos:

- `valid`: la entry fue marcada como usada en esta request.
- `already_used`: la entry ya estaba usada antes de esta request o fue usada por otra request concurrente.
- `invalid`: token ausente en el evento autorizado, token de otro evento o token inexistente.
- `outside_window`: QR autentico del evento, pero fuera de la ventana de check-in.
- `voided`: entry existente del evento, pero `status = voided`.
- `not_valid_status`: estado futuro no aceptado para check-in.
- `event_not_operable`: evento `paused` o `finished`.

HTTP recomendado:

- `200` para estados de evaluacion de QR: `valid`, `already_used`, `invalid`, `outside_window`, `voided`, `not_valid_status`.
- `400` para `eventId` invalido, token vacio o token con formato invalido.
- `401` para auth ausente o token invalido.
- `403` para usuario sin membership o rol insuficiente.
- `404` para evento inexistente.
- `409` no es necesario para duplicados si se devuelve `already_used` como estado semantico.
- `500` para error inesperado.

Motivo:

- El scanner necesita una respuesta de dominio estable para mostrar el resultado del QR.
- Los errores HTTP quedan reservados para request/auth/tenant/infra.
- `invalid` no revela si el token existe en otro evento.

## 9. Response segura

Respuesta `valid`:

```json
{
  "status": "valid",
  "entry": {
    "id": "uuid",
    "ticket_name": "General Preventa 1",
    "checkin_status": "used",
    "used_at": "2026-08-01T22:15:00.000Z"
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

Respuesta `already_used`:

```json
{
  "status": "already_used",
  "entry": {
    "id": "uuid",
    "ticket_name": "General Preventa 1",
    "checkin_status": "used",
    "used_at": "2026-08-01T22:15:00.000Z"
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

Respuesta `invalid`:

```json
{
  "status": "invalid",
  "entry": null,
  "attendee": null,
  "event": {
    "id": "uuid",
    "title": "Ibiza"
  }
}
```

PII permitida:

- `attendee.name`
- `attendee.last_name`
- `attendee.document`

Motivo:

- Puerta necesita verificar identidad basica.
- Email y telefono no son necesarios para el gesto de check-in.

No incluir:

- `checkin_token`
- payload QR
- QR base64
- `attendee.email`
- `attendee.phone`
- buyer PII
- `used_by_auth_user_id`
- `created_by_auth_user_id`
- `auth_user_id`
- `local_id`
- raw metadata
- datos de otros eventos

## 10. Atomicidad y concurrencia

Riesgo principal:

- Dos scanners pueden intentar validar el mismo QR casi al mismo tiempo.

Decision:

- El marcado de uso debe ser atomico.
- No confiar en el frontend para prevenir doble scan.
- Usar un update condicional que solo actualice si la entry sigue disponible.

Operacion atomica recomendada:

```sql
update public.event_order_entries
set
  checkin_status = 'used',
  used_at = now(),
  used_by_auth_user_id = p_actor_auth_user_id,
  updated_at = now()
where id = v_entry_id
  and event_id = p_event_id
  and status = 'issued'
  and checkin_status = 'unused'
  and used_at is null
  and used_by_auth_user_id is null
returning *;
```

Regla de clasificacion:

- Si el update devuelve 1 fila: `valid`.
- Si el update devuelve 0 filas: reconsultar la entry scoped por `event_id` y clasificar `already_used`, `voided`, `not_valid_status` o `invalid`.
- Si otra request gano la carrera, la segunda debe devolver `already_used`.

## 11. Decision RPC vs endpoint TS

Decision recomendada para el primer CODE:

- Crear una RPC SQL transaccional para check-in y llamarla desde el endpoint TS.

RPC propuesta:

```sql
public.check_in_event_entry_by_token(
  p_event_id uuid,
  p_actor_auth_user_id uuid,
  p_token text
)
returns jsonb
```

Motivo:

- Check-in es una operacion de escritura con riesgo de concurrencia.
- La DB ya tiene checks de consistencia entre `checkin_status`, `used_at` y `used_by_auth_user_id`.
- El proyecto ya valido el patron endpoint TS + RPC con `issue_event_manual_order`.
- La RPC puede hacer update condicional y clasificacion en una misma transaccion.

Seguridad esperada de la RPC:

- `language plpgsql`.
- `security definer` solo si se fija `set search_path = public, pg_temp`.
- `revoke execute` de `public`, `anon` y `authenticated`.
- `grant execute` solo a `service_role`.
- El endpoint TS sigue usando `eventPanelAuth` y `requireEventRole(["owner", "staff"])`.
- La RPC revalida membership defensivamente.

Responsabilidad TS:

- Validar `eventId` y token en path.
- Usar `req.eventPanelUser.eventId`.
- Usar `req.eventPanelUser.authUserId`.
- Llamar la RPC.
- Mapear errores inesperados.
- No implementar una logica paralela de check-in.

Alternativa aceptable pero secundaria:

- Update condicional directo desde TS con Supabase JS.
- Solo seria aceptable si mantiene el update atomico y la clasificacion posterior, pero la RPC es preferida por consistencia con Slice 3B.1.

## 12. Fallback manual

Endpoint futuro sugerido:

- `PATCH /panel/events/:eventId/entries/:entryId/use`

Uso:

- Permitir marcar una entry por ID cuando el QR no se puede leer.
- Misma proteccion: `eventPanelAuth` + `requireEventRole(["owner", "staff"])`.
- Misma ventana de check-in.
- Misma validacion de evento, tenant, `status`, `checkin_status`, `used_at` y `used_by_auth_user_id`.
- Misma respuesta segura.

Decision:

- No incluir fallback manual en el primer CODE de check-in QR si se quiere mantener el slice chico.
- Implementarlo como Slice 3E.3, idealmente reutilizando la misma estrategia RPC con entry id.

## 13. Activity futuro

No implementar activity en el primer CODE de check-in QR.

Eventos futuros recomendados:

- `event_entry_checked_in`
- `event_entry_already_used_attempt`
- `event_entry_outside_window_attempt`
- `event_entry_invalid_token_attempt`
- `event_entry_voided_attempt`

Reglas:

- Entity type futuro separado para Eventos, por ejemplo `event_order_entry`.
- Actor desde `eventPanelAuth`.
- No usar `local_id`.
- No incluir `checkin_token`.
- No incluir payload QR.
- No incluir QR base64.
- No incluir email, phone, document ni buyer PII en metadata.
- Para invalid token, registrar solo conteo/contexto seguro si se decide auditar.

## 14. Seguridad y logging

Riesgo de token en path:

- `PATCH /panel/events/:eventId/checkin/:token` deja el valor opaco en el path.
- Algunos proxies, plataformas o logs de infraestructura podrian registrar URLs completas.
- Para el MVP se acepta por consistencia con el flujo actual y simplicidad operativa, pero el token debe tratarse como credencial.
- La aplicacion no debe loggear URL completa, path completo, `req.originalUrl` ni el valor del token.

Reglas obligatorias:

- No exponer `checkin_token` en JSON.
- No exponer `checkin_token` en errores.
- No loggear `checkin_token`.
- No loggear payload QR.
- No loggear QR base64.
- No loggear URL escaneada completa.
- No loggear path completo.
- No loggear `req.originalUrl`.
- No loggear headers sensibles.
- No aceptar token en body si ya viene en path.
- No aceptar override de event, entry, ticket, attendee o actor.
- No revelar si un token valido pertenece a otro evento.
- No devolver `used_by_auth_user_id`.
- No devolver `auth_user_id`.
- No devolver `local_id`.
- No devolver metadata cruda.

Logging permitido:

- `requestId`
- `eventId`
- `entryId` cuando el token pertenece al evento autorizado
- `status` semantico
- `error_code` estable

Hardening futuro:

- Evaluar endpoint alternativo con token en body: `PATCH /panel/events/:eventId/checkin`.
- Evaluar redaccion o sanitizacion de paths en logs de infraestructura si la plataforma lo permite.
- Mantener para el MVP el endpoint con `:token` en path, pero con restriccion estricta de logging de aplicacion.

## 15. Scanner y panel futuro

Decision:

- Este contrato no implementa frontend.
- El scanner futuro puede reutilizar `@zxing/browser` como referencia tecnica.
- El scanner debe llamar el endpoint de Eventos, no `/panel/checkin/:token`.
- Si el QR contiene URL, el cliente debe extraer el ultimo segmento y enviar solo el valor opaco como `:token`.
- Si en un slice posterior el backend acepta URL completa, debe parsearla de forma defensiva y no loggear la URL completa.

## 16. Roadmap por slices

Propuesta:

- Slice 3E.1 - contrato de check-in QR para Eventos.
- Slice 3E.2A - RPC SQL `check_in_event_entry_by_token` + QA DB PASS.
- Slice 3E.2B - endpoint TS `PATCH /panel/events/:eventId/checkin/:token` + QA runtime.
- Slice 3E.3 - fallback manual `PATCH /panel/events/:eventId/entries/:entryId/use`.
- Slice 3E.4 - activity log de check-in de Eventos.
- Slice 3E.5 - UI scanner/panel de check-in.

Nota:

- Slice 3E.1 queda actualizado con politica de estado operativo y hardening de token en path.
- Slice 3E.2A debe mantener `draft` permitido para QA controlado, pero documentar que Ibiza debe estar `published` antes de operar en puerta.

## 17. QA futuro

Casos minimos para CODE posterior:

- owner Ibiza escanea QR valido dentro de ventana: `status = valid`, `checkin_status = used`, `used_at != null`.
- staff Ibiza escanea QR valido dentro de ventana: `status = valid`.
- segundo scan del mismo QR: `status = already_used`, no cambia `used_at`.
- dos scans concurrentes del mismo QR: uno `valid` y otro `already_used`.
- token inexistente con formato valido: `status = invalid`, sin datos de entry.
- token valido de otro evento: `status = invalid`, sin filtrar datos del otro evento.
- token vacio o malformado: `400`.
- evento inexistente: `404`.
- eventId invalido: `400`.
- sin auth: `401`.
- token invalido de auth: `401`.
- owner local sin membership de evento: `403`.
- evento `paused`: `event_not_operable`, no actualiza entry.
- evento `finished`: `event_not_operable`, no actualiza entry.
- fuera de ventana antes de `checkin_valid_from`: `outside_window`, no actualiza entry.
- fuera de ventana despues de `checkin_valid_to`: `outside_window`, no actualiza entry.
- entry `voided`: `voided`, no actualiza entry.
- entry ya usada mantiene consistencia DB: `checkin_status = used`, `used_at != null`, `used_by_auth_user_id != null`.
- response no incluye `checkin_token`.
- response no incluye payload QR ni QR base64.
- response no incluye attendee email/phone, buyer PII, `auth_user_id`, `local_id` ni metadata.
- `/entries` refleja `checkin_status = used` despues de check-in valido.
- `/summary` refleja conteo de used/unused despues de check-in valido.
- `GET /entries/:entryId/qr` sigue funcionando.
- `send-email` por entry sigue funcionando.
- `manual-issue` sigue funcionando.
- panel local `/panel/checkin/:token`, `/panel/me` y `/panel/orders/summary` no se rompen.

QA de ventana:

- Usar transaccion o fixture controlado para mover temporalmente `checkin_valid_from/checkin_valid_to`.
- Restaurar estado al final si se prueba contra DB compartida.

## 18. No-goals

Fuera de este contrato y del primer CODE posterior:

- frontend scanner;
- QR visual nuevo;
- email QR;
- WhatsApp API;
- export;
- activity log;
- dashboard en tiempo real;
- pagos online;
- `/payments/callback`;
- B2C publico;
- import CSV;
- anulacion/void;
- edicion/correccion;
- reenvio de QR;
- cambios al check-in local;
- cambios al panel local;
- cambios al flujo `manual-issue`.

## 19. Proximo CODE recomendado

Slice 3E.2B - endpoint TS check-in QR de Eventos:

- crear endpoint `PATCH /panel/events/:eventId/checkin/:token`;
- usar `eventPanelAuth` y `requireEventRole(["owner", "staff"])`;
- llamar la RPC con `req.eventPanelUser.eventId` y `req.eventPanelUser.authUserId`;
- validar path sin loggear URL completa, path completo, `req.originalUrl` ni token;
- no exponer `checkin_token`;
- no duplicar logica de check-in en TypeScript;
- no tocar QR/email/frontend/pagos/exports/activity;
- ejecutar typecheck, `git diff --check` y QA runtime.

## 20. Estado Slice 3E.2A - RPC check-in QR QA DB PASS

Slice 3E.2A queda registrado como implementado, aplicado y validado:

- migracion 030 aplicada;
- RPC `public.check_in_event_entry_by_token(uuid, uuid, text)` creada;
- firma validada: `check_in_event_entry_by_token(uuid,uuid,text)`;
- QA DB PASS completo;
- lista para ser consumida por el endpoint TS de Slice 3E.2B.

QA DB validado:

- funcion encontrada con firma `check_in_event_entry_by_token(uuid,uuid,text)`;
- grants correctos: `anon_can_execute = false`, `authenticated_can_execute = false`, `service_role_can_execute = true`;
- variables QA cargadas: event `aed4cb4a-b297-4093-98e1-b3474f3b399c`, ticket General `d89499b3-eb49-4b74-b8c8-48b2d5a55dbe`, actor `253c667d-e2ab-4705-bd97-8621608ad8cc`;
- 4 entries QA creadas dentro de transaccion mediante `issue_event_manual_order`, todas `issued`, `unused`, `used_at = null` y con `checkin_token`;
- ventana de check-in abierta temporalmente dentro de la transaccion;
- primer scan valido respondio `ok = true`, `status = valid`, `entry.checkin_status = used`, `entry.used_at != null`;
- la DB muto la entry a `checkin_status = used`, `used_at != null`, `used_by_auth_user_id = actor`;
- segundo scan secuencial del mismo token respondio `already_used`;
- token UUID inexistente respondio `invalid` con `entry = null` y `attendee = null`;
- token malformado respondio `ok = false`, `error.code = invalid_input`;
- actor sin membership respondio `ok = false`, `error.code = forbidden`;
- entry usada + fuera de ventana respondio `already_used`, confirmando prioridad semantica sobre `outside_window`;
- entry emitida/unused + fuera de ventana respondio `outside_window` y no muto la entry;
- entry `voided` + fuera de ventana respondio `voided`, confirmando prioridad semantica sobre `outside_window`;
- evento no operable respondio `event_not_operable` con `entry = null` y `attendee = null`;
- responses validadas no expusieron `checkin_token`, `auth_user_id`, `local_id`, metadata, email ni phone;
- response mantiene `attendee.document` como dato operativo permitido para puerta;
- QA corrio con `begin; ... rollback;`;
- verificacion posterior: `qa_3e2a_orders = 0`;
- Ibiza quedo restaurado con `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Matiz:

- Este QA valida DB/RPC, no endpoint HTTP.
- El doble scan validado fue secuencial.
- La proteccion contra carrera concurrente queda soportada por el update condicional atomico.
- Slice 3E.2B debe incluir, si es posible, dos requests rapidos/concurrentes para confirmar el comportamiento de puerta.
