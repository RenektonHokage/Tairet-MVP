# Ibiza Check-in UI: contrato de validacion QR/manual en EventPanelShell

## 1. Proposito

Este documento define el contrato UI/UX y tecnico para la seccion `Check-in` del panel de eventos.

El objetivo es preparar una pantalla operativa de puerta para owner/staff que permita validar entradas por QR y por fallback manual, usando endpoints de Eventos ya implementados y validados.

Este paso es solo ASK / DOCS. No implementa codigo runtime, frontend, backend, SQL, migraciones, endpoints, pagos, B2C, activity local ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Backend Eventos ya esta QA runtime PASS:

- `PATCH /panel/events/:eventId/checkin/:token`
  - estados: `valid`, `already_used`, `invalid`, `outside_window`, `voided`, `not_valid_status`, `event_not_operable`.
  - protegido con `eventPanelAuth + requireEventRole(["owner", "staff"])`.
  - usa RPC transaccional y update atomico.
  - no expone `checkin_token`, QR payload/base64, auth IDs, `local_id` ni metadata cruda.
  - registra activity con `source = qr`.
- `PATCH /panel/events/:eventId/entries/:entryId/use`
  - estados: `valid`, `already_used`, `outside_window`, `voided`, `not_valid_status`, `event_not_operable`.
  - protegido con `eventPanelAuth + requireEventRole(["owner", "staff"])`.
  - usa RPC transaccional y update atomico.
  - no expone token.
  - registra activity con `source = manual`.
- `GET /panel/events/:eventId/entries`
  - sirve como busqueda operativa para fallback manual.
  - soporta `q`, `ticket_type_id`, `status`, `checkin_status`, `page`, `page_size` y `sort`.
- `GET /panel/events/:eventId/activity`
  - registra check-ins QR/manual, intentos rechazados, email e issue logs.

Frontend Eventos cerrado:

- `EventPanelShell`, `EventPanelNav` y layout propio de evento con QA PASS.
- Activity UI QA PASS.
- Entries UI QA PASS.
- Entries QR/email QA PASS.
- Existen `getEventPanelMe`, `getEventEntries`, `getEventEntryQrBlob` y `sendEventEntryQrEmail`.
- Checkin-B implementado y validado tecnicamente: `apps/web-next/lib/eventCheckin.ts` existe con tipos, parser, helpers PATCH y labels de estado.

Rutas actuales:

- `/panel/events/[eventId]/entries`
- `/panel/events/[eventId]/activity`

## 3. Fuentes revisadas

Documentos revisados:

- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_MANUAL_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_LOG_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_INTEGRATION_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_UI_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_PANEL_SHELL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`

Frontend revisado sin modificar:

- `apps/web-next/app/panel/events/[eventId]/layout.tsx`
- `apps/web-next/app/panel/events/[eventId]/entries/page.tsx`
- `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`
- `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`
- `apps/web-next/components/panel/EventPanelShell.tsx`
- `apps/web-next/components/panel/EventPanelNav.tsx`
- `apps/web-next/components/panel/EventEntriesSection.tsx`
- `apps/web-next/components/panel/EventActivitySection.tsx`
- `apps/web-next/lib/eventEntries.ts`
- `apps/web-next/lib/eventActivity.ts`
- `apps/web-next/lib/eventPanel.ts`
- `apps/web-next/lib/api.ts`
- `apps/web-next/package.json`

Backend/SQL revisado como contrato, sin modificar:

- `functions/api/src/routes/panelEvents.ts`
- `infra/sql/migrations/030_create_event_checkin_rpc.sql`
- `infra/sql/migrations/031_create_event_manual_checkin_rpc.sql`

## 4. Discovery frontend y scanner

Hallazgos:

- Existe check-in local en `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`.
- Ese flujo local usa `@zxing/browser`, `@zxing/library`, `navigator.mediaDevices`, `video`, cooldowns, dedupe de tokens y timeout/retry acotado.
- El flujo local llama `PATCH /panel/checkin/:token`, usa `usePanelContext`, diferencia local `bar/club` y esta acoplado a semantica local.
- El flujo local no debe reutilizarse tal cual para Eventos porque Eventos usa `eventPanelAuth`, `event_panel_users`, `event_id` y endpoints event-scoped.
- El flujo local registra tokens raw en algunos `console.*`; ese patron no debe copiarse al check-in de Eventos.
- `apiPatchWithAuth<T>(path, body?)` existe en `apps/web-next/lib/api.ts`.
- `@zxing/browser` y `@zxing/library` estan instalados en `apps/web-next/package.json`.
- No se encontro una UI de scanner especifica de Eventos.
- La capacidad real de camara/permisos no queda validada en este ASK porque requiere browser/runtime y permisos del dispositivo.

Decision:

- Usar el check-in local solo como referencia tecnica para scanner/cooldowns si se implementa camara en un slice posterior.
- Para el primer CODE de Eventos, priorizar input manual de QR/token/URL y fallback manual por busqueda de entry.
- Planificar scanner camara como slice posterior, salvo que se decida asumir el patron local y re-hardening completo para Eventos.

## 5. Ubicacion y navegacion

Ruta recomendada:

- `/panel/events/[eventId]/checkin`

La pantalla debe vivir dentro de `EventPanelShell`.

`EventPanelNav` futuro:

- `Entradas`
- `Check-in`
- `Actividad`

Reglas:

- Agregar `Check-in` solo cuando exista la ruta real `/panel/events/[eventId]/checkin`.
- No crear placeholders ni rutas falsas.
- No crear `Summary` ni `Settings` en este bloque.
- Mantener `Entradas` como listado operativo y `Check-in` como pantalla de puerta.

## 6. Objetivo operativo

La pantalla de `Check-in` debe resolver:

- staff en puerta valida accesos rapido;
- staff distingue entrada valida, ya usada, fuera de ventana, anulada, invalida o evento no operable;
- staff tiene fallback si el QR no escanea;
- staff ve informacion minima de asistente/ticket;
- staff no ve ni copia token, payload QR, metadata cruda ni IDs internos sensibles;
- staff no necesita navegar por la lista general de entradas durante una validacion.

No debe ser:

- listado general de entradas;
- CRM;
- export;
- emision manual;
- edicion/anulacion;
- analitica;
- configuracion del evento.

## 7. Modos de validacion

Modo A - Scanner QR con camara:

- Ideal operativo para puerta.
- Requiere permisos de camara y validacion runtime.
- Puede usar `@zxing/browser` como referencia tecnica.
- Debe pausar lecturas mientras procesa.
- Debe evitar multiples requests por el mismo QR.
- Queda recomendado para slice posterior si no se valida camara antes.

Modo B - Input manual de QR/token/URL:

- Recomendado para primer CODE.
- Permite pegar URL completa del QR o token UUID.
- Usa endpoint QR `PATCH /panel/events/:eventId/checkin/:token`.
- Debe extraer token en cliente y no mostrarlo de vuelta.
- Debe borrar el input despues del intento.

Modo C - Fallback manual por busqueda de entry:

- Recomendado para primer bloque o slice siguiente inmediato.
- Busca entradas con `GET /panel/events/:eventId/entries?q=...`.
- Selecciona una entry y pide confirmacion fuerte.
- Usa endpoint manual `PATCH /panel/events/:eventId/entries/:entryId/use`.
- Es util cuando el QR falla o el cliente presenta documento/nombre.

Recomendacion MVP:

1. Input manual de QR/token/URL.
2. Fallback manual por busqueda de entry con confirmacion.
3. Scanner camara en slice posterior con hardening especifico.

## 8. QR input y token parsing

El input acepta:

- URL completa: `https://tairet.com.py/events/checkin/<token>`
- Token UUID directo.

Reglas de parseo:

- `trim` del input.
- Si es URL, extraer el ultimo segmento no vacio del path.
- Validar UUID antes de llamar backend.
- Si el formato es invalido, mostrar error local y no llamar backend.
- Usar `encodeURIComponent(token)` al construir el path.

Reglas de seguridad:

- No mostrar token extraido.
- No loggear token.
- No guardar token en storage.
- No persistir token en URL de la UI.
- No enviar URL raw completa al backend.
- Borrar input despues del intento.
- No incluir token en activity metadata.

## 9. Resultado visual por estado

La UI debe mostrar un resultado persistente hasta el siguiente intento.

`valid`:

- Variante visual: `success`.
- Titulo: `Entrada validada`.
- Mostrar ticket, asistente, `checkin_status = used` y `used_at` si backend lo devuelve.

`already_used`:

- Variante visual: `warn` o `danger`.
- Titulo: `Entrada ya utilizada`.
- Mostrar `used_at`, ticket y asistente si vienen.
- No permitir reintento automatico inmediato sobre el mismo resultado.

`outside_window`:

- Variante visual: `warn`.
- Titulo: `Fuera de la ventana de validacion`.
- Mensaje: `Esta entrada pertenece al evento, pero no puede validarse en este momento.`

`voided`:

- Variante visual: `danger`.
- Titulo: `Entrada anulada`.

`invalid`:

- Variante visual: `danger`.
- Titulo: `QR invalido`.
- No revelar si el token existe en otro evento.

`not_valid_status`:

- Variante visual: `warn` o `danger`.
- Titulo: `Entrada no valida para check-in`.

`event_not_operable`:

- Variante visual: `warn`.
- Titulo: `Evento no habilitado para check-in`.

Errores HTTP/network:

- Variante visual: `danger`.
- Mensaje controlado: `No se pudo validar la entrada.`
- Mostrar accion `Reintentar` solo para errores recuperables.

No mostrar:

- token;
- raw URL;
- QR payload;
- QR base64;
- metadata cruda;
- stack;
- SQL;
- auth IDs;
- `local_id`.

## 10. Fallback manual por entry

Flujo recomendado:

1. Staff escribe `q` por documento, nombre, apellido o email si soporte lo necesita.
2. UI llama `getEventEntries({ eventId, q, pageSize: 25, sort: "created_at_desc" })`.
3. UI muestra resultados compactos.
4. Staff selecciona una entry.
5. UI muestra confirmacion fuerte: `Validar esta entrada marcara el acceso como usado.`
6. UI llama `PATCH /panel/events/:eventId/entries/:entryId/use`.
7. UI muestra el mismo componente de resultado semantico.

Datos en resultado de busqueda:

- asistente;
- documento si es operativo para puerta;
- ticket;
- `status`;
- `checkin_status`;
- `used_at` si existe.

Reglas:

- No poner `Validar manualmente` dentro de Entries UI general.
- No permitir validacion manual con un solo click accidental.
- Si la entry ya esta `used` o `voided`, ocultar el boton o mostrarlo disabled con explicacion.
- No aceptar `event_id`, `local_id`, status overrides ni datos de attendee desde cliente.
- Si la busqueda no devuelve resultados, mostrar `No se encontraron entradas`.

## 11. Datos visibles y PII

Permitido en puerta:

- attendee `name`;
- attendee `last_name`;
- attendee `document`;
- `ticket_name`;
- `status`;
- `checkin_status`;
- `used_at`;
- event title/status.

Evitar por defecto:

- buyer email;
- buyer phone;
- buyer document;
- attendee phone;
- attendee email, salvo decision operativa explicita;
- auth IDs;
- `local_id`;
- `used_by_auth_user_id`;
- metadata cruda.

Motivo:

- Documento/nombre/ticket son suficientes para verificacion en puerta.
- Email/telefono son utiles para soporte, pero no son necesarios en una pantalla rapida de validacion y aumentan exposicion visual.

## 12. Prevencion de doble validacion accidental

Reglas obligatorias:

- Deshabilitar input y botones mientras hay request en vuelo.
- No hacer auto-retry sobre el mismo token.
- Borrar token del input despues del intento.
- Confirmar fallback manual antes de marcar como usada.
- Mantener el resultado visible para que staff no repita por incertidumbre.

Si se implementa scanner camara:

- Pausar scanner mientras procesa.
- Reanudar solo con accion explicita `Escanear otro` o despues de un cooldown controlado.
- Usar dedupe en memoria para el ultimo token procesado.
- Si se guarda hash para dedupe, que sea solo en memoria y nunca token raw.
- No copiar logs del check-in local que imprimen token raw.

Backend sigue siendo la garantia fuerte:

- La prevencion frontend mejora UX, pero la atomicidad real depende de la RPC.
- Segundo intento debe resolverse como `already_used`.

## 13. API client y tipos

Archivo creado en Checkin-B:

- `apps/web-next/lib/eventCheckin.ts`

Tipos:

- `EventCheckinStatus`
- `EventCheckinEntry`
- `EventCheckinAttendee`
- `EventCheckinEvent`
- `EventCheckinResponse`
- `CheckInEventEntryByTokenInput`
- `CheckInEventEntryManuallyInput`

Helpers:

- `parseEventCheckinToken(input)`
- `checkInEventEntryByToken(input)`
- `checkInEventEntryManually(input)`

Reglas de cliente:

- Usar `apiPatchWithAuth`.
- Validar `eventId` no vacio.
- Validar token UUID antes de request.
- Usar `encodeURIComponent` para `eventId`, `token` y `entryId`.
- No enviar body salvo `{}` si el helper compartido lo requiere.
- No enviar query params.
- No aceptar `event_id`, `local_id`, auth IDs, token overrides, metadata ni PII.
- No hacer fetch extra a buyer/attendee fuera de `/entries`.
- No loggear token, URL raw ni response completa.

Estado Checkin-B:

- `apps/web-next/lib/eventCheckin.ts` creado.
- Tipos TS creados para estados, entry, attendee, event, response, error, inputs y variantes visuales.
- `parseEventCheckinToken(input)` creado.
- `checkInEventEntryByToken(input)` creado con `apiPatchWithAuth`.
- `checkInEventEntryManually(input)` creado con `apiPatchWithAuth`.
- Labels y helpers `getEventCheckinStatusLabel` / `getEventCheckinStatusVariant` creados.
- Validaciones locales de `eventId`, token UUID y `entryId` UUID implementadas.
- `encodeURIComponent` aplicado para `eventId`, `token` y `entryId`.
- Sin UI visible, sin ruta `/checkin`, sin cambios en `EventPanelNav`, backend, SQL, pagos ni flujos existentes.

Validaciones Checkin-B:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente porque `next lint` abre configuracion interactiva de ESLint.

## 14. Roadmap por slices

Checkin-A:

- Este ASK/DOCS.

Checkin-B:

- Implementado y validado tecnicamente.
- `apps/web-next/lib/eventCheckin.ts` creado con tipos, parser, clientes PATCH y labels/helpers.
- Typecheck PASS.
- Sin UI visible, ruta `/checkin` ni cambios en `EventPanelNav`.

Checkin-C:

- Crear ruta `/panel/events/[eventId]/checkin`.
- Agregar link real `Check-in` a `EventPanelNav`.
- Implementar input QR/token/URL y resultado visual.
- Sin scanner camara.

Checkin-D:

- Implementar fallback manual por busqueda de entry.
- Reutilizar `getEventEntries`.
- Confirmacion fuerte antes de `PATCH /entries/:entryId/use`.

Checkin-E:

- QA frontend/manual completo desktop/mobile.
- Validar activity y regresiones de Entries/Activity.

Checkin-F futuro:

- Scanner camara con `@zxing/browser` o `BarcodeDetector` si se confirma compatibilidad.
- Re-hardening de permisos, dedupe, pausa/reanudacion y logs sin token raw.

## 15. QA futuro

Casos minimos:

- owner Ibiza entra a `/panel/events/:eventId/checkin`.
- staff Ibiza entra a `/panel/events/:eventId/checkin`.
- owner local sin membership no accede.
- sin auth devuelve comportamiento de auth existente.
- token invalido/malformado muestra error local o `invalid_checkin_token` controlado.
- token valido dentro de ventana devuelve `valid`.
- segundo intento del mismo token devuelve `already_used`.
- token UUID inexistente devuelve `invalid`.
- entrada fuera de ventana devuelve `outside_window`.
- entry `voided` devuelve `voided`.
- evento no operable devuelve `event_not_operable`.
- fallback manual valido devuelve `valid`.
- fallback manual sobre entry usada devuelve `already_used`.
- confirmacion manual evita click accidental.
- input/botones quedan disabled mientras procesa.
- resultado no muestra token, raw URL, QR payload/base64, auth IDs, `local_id` ni metadata cruda.
- Activity recibe logs `qr` y `manual`.
- Entries sigue funcionando.
- Activity sigue funcionando.
- panel local/demo sin regresion.
- mobile usable en puerta.

QA futuro de scanner camara:

- permiso concedido activa camara.
- permiso denegado muestra fallback manual.
- sin camara muestra fallback manual.
- scanner no dispara requests duplicados para el mismo QR.
- scanner se pausa durante procesamiento.
- no se loggea token raw.

## 16. No-goals

Fuera de este contrato:

- implementar codigo;
- tocar frontend runtime;
- tocar backend;
- tocar SQL/migraciones;
- tocar endpoints;
- tocar pagos;
- tocar `/payments/callback`;
- tocar B2C;
- tocar panel local;
- tocar runtime demo;
- tocar activity local;
- tocar Entries UI;
- meter `Validar manualmente` en Entradas;
- crear scanner camara en primer CODE sin decision explicita;
- agregar Summary UI;
- agregar Settings UI;
- crear export;
- crear edicion/anulacion;
- configurar ESLint.

## 17. Estado final recomendado

Marcar:

- Check-in UI contrato definido.
- Ruta recomendada: `/panel/events/[eventId]/checkin`.
- Checkin-B implementado: tipos/cliente `eventCheckin.ts` PASS tecnico.
- Proximo CODE recomendado: Checkin-C, input QR/token/URL + resultado visual.
- Fallback manual recomendado: busqueda por `/entries?q=...` + confirmacion.
- Scanner camara queda futuro hasta validar runtime/permisos y hardening sin token raw.
