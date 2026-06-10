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
- Checkin-C implementado y QA frontend/manual PASS: ruta real `/panel/events/[eventId]/checkin`, link `Check-in`, input QR/token/URL y resultado visual operativo.

Rutas actuales:

- `/panel/events/[eventId]/entries`
- `/panel/events/[eventId]/checkin`
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

- Implementado y QA frontend/manual PASS.
- Ruta `/panel/events/[eventId]/checkin` creada dentro de `EventPanelShell`.
- Link real `Check-in` agregado a `EventPanelNav`.
- Input manual QR/token/URL implementado con resultado visual por estado semantico.
- Sin scanner camara y sin fallback manual en este slice.

Checkin-D:

- Implementado y QA frontend/manual PASS.
- Fallback manual agregado dentro de la pantalla `Check-in`.
- Reutiliza `getEventEntries`.
- Confirmacion fuerte antes de `PATCH /entries/:entryId/use`.
- Resultado manual reutiliza el resultado visual semantico de Check-in.
- Sin scanner camara, backend, SQL, pagos ni flujos operativos modificados.

Scanner-C:

- Implementado y QA frontend/runtime PASS.
- Scanner camara agregado dentro de `/panel/events/[eventId]/checkin`.
- Boton explicito `Activar camara`, sin auto-start.
- Preview desktop/mobile validado.
- ZXing, `parseEventCheckinToken` y `checkInEventEntryByToken` integrados.
- Dedupe, pausa durante `processing`, `Escanear otro`, `Detener camara` y cleanup validados.
- Activity `source = qr` validada para scan por camara.
- Input QR/token y fallback manual preservados.

## 15. Estado Checkin-C - input QR/token/URL

Estado: implementado y QA frontend/manual PASS.

Archivos de runtime que quedaron registrados como parte de Checkin-C:

- `apps/web-next/app/panel/events/[eventId]/checkin/page.tsx`;
- `apps/web-next/components/panel/EventCheckinSection.tsx`;
- `apps/web-next/components/panel/EventPanelNav.tsx`.

Ruta y navegacion:

- ruta real `/panel/events/[eventId]/checkin`;
- pantalla dentro de `EventPanelShell`;
- `EventPanelNav` muestra `Entradas`, `Check-in` y `Actividad`;
- `Check-in` queda activo en su ruta;
- `Entradas` y `Actividad` siguen navegando correctamente.

Input y parser:

- input manual acepta token UUID directo;
- input manual acepta URL completa;
- parser extrae UUID desde URL con path, slash final, query o hash;
- la UI llama `checkInEventEntryByToken`;
- input y boton quedan disabled durante request;
- resultado queda visible despues de la validacion;
- input se limpia despues de cada intento procesado;
- formato invalido muestra error local y no llama backend;
- no se implemento fallback manual ni scanner camara.

QA frontend/manual registrado:

- se crearon 6 entries QA con `manual-issue`; API respondio `201 Created`, `entries.length = 6`, `email_delivery.status = sent`;
- se recuperaron 6 `checkin_token` solo por SQL controlado;
- estado inicial DB: entries `issued`, `unused`, `used_at = null`, `used_by_auth_user_id = null`;
- ventana de check-in abierta temporalmente y DB time dentro de ventana;
- `/checkin` carga dentro de `EventPanelShell`;
- input vacio no permite submit;
- texto invalido muestra error local sin raw response, stack ni error tecnico;
- token UUID valido directo valida la entry y DB queda `checkin_status = used`, `used_at != null`, `used_by_auth_user_id != null`;
- segundo intento del mismo token muestra `Entrada ya utilizada` sin romper pantalla;
- URL completa valida y parser extrae token;
- URL con slash final, query o hash valida y DB queda usada;
- UUID bien formado inexistente muestra `QR invalido` y `No se encontro una entrada valida para este QR.`;
- entry `issued/unused` fuera de ventana muestra `Fuera de la ventana de validacion` y no muta DB;
- entry `voided` muestra `Entrada anulada` y no hace check-in;
- evento no operable muestra `Evento no habilitado para check-in` y no muta DB;
- owner y staff Ibiza pueden entrar y operar el input;
- sin sesion se muestra login/bloqueo de panel, sin datos del evento ni input usable.

Seguridad visual validada:

- no se observo `checkin_token`;
- no se observo raw token despues de validar;
- no se observo raw URL;
- no se observo QR payload/base64;
- no se observaron auth IDs, `used_by_auth_user_id`, `created_by_auth_user_id` ni `local_id`;
- no se observo metadata cruda, request/response crudo, stack, headers ni SQL;
- no se observo buyer phone/email/document ni attendee phone/email;
- visible permitido: ticket, asistente, documento del asistente, `checkin_status`, evento y fecha de uso cuando aplica.

Regresiones y limpieza:

- `/entries` sigue cargando;
- `/activity` sigue cargando;
- la nav no rompe `Entradas`, `Check-in` ni `Actividad`;
- limpieza QA dejo `qa_order_remaining = 0`, `qa_item_remaining = 0`, `qa_entries_remaining = 0`, `qa_activity_remaining = 0`;
- evento Ibiza restaurado a `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Validaciones tecnicas:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente porque `next lint` abre configuracion interactiva de ESLint.

## 16. Estado Checkin-D - fallback manual por busqueda de entry

Estado: implementado y QA frontend/manual PASS.

Alcance implementado:

- fallback manual agregado dentro de `EventCheckinSection`;
- busqueda manual usando entries del evento mediante `getEventEntries`;
- query vacio controlado localmente;
- query de 1 caracter controlado localmente;
- resultados compactos;
- confirmacion fuerte antes de validar;
- cancelar no ejecuta mutacion;
- confirmar llama `checkInEventEntryManually`;
- resultado manual reutiliza el resultado visual semantico de Check-in;
- validacion manual registra activity con `source = manual`;
- entries `used` y `voided` no quedan accionables;
- scanner camara no implementado;
- no se toco backend, SQL, pagos ni flujos operativos.

QA frontend/manual PASS:

- Regresion QR/token: token valido marco entrada como `used`, segundo intento mostro `Entrada ya utilizada`, UUID inexistente mostro `QR invalido`.
- Busqueda manual: query vacio quedo controlado, query de 1 caracter mostro `La busqueda requiere al menos 2 caracteres`, busqueda por documento encontro la entry, busqueda por apellido encontro la entry y busqueda sin resultados mostro `No se encontraron entradas`.
- Resultados compactos: se mostraron asistente, documento del asistente, ticket, status, `checkin_status`, `used_at` y evento; no se observo buyer PII ni attendee email/phone.
- Confirmacion fuerte: `Validar manualmente` abre confirmacion, muestra datos operativos, `Cancelar` cierra la confirmacion y no muta DB, `Confirmar validacion` ejecuta la mutacion manual.
- Cancelar no muta DB: la entry quedo `status = issued`, `checkin_status = unused`, `used_at = null`, `used_by_auth_user_id = null`.
- Confirmar validacion manual: la entry quedo `status = issued`, `checkin_status = used`, `used_at != null`, `used_by_auth_user_id != null`.
- Segundo intento sobre entrada usada: la UI mostro la entrada como usada y la accion de validacion manual quedo deshabilitada.
- Estados controlados: `outside_window` mostro `Fuera de la ventana de validacion` y no muto DB; `voided` mostro entrada anulada y no hizo check-in; `event_not_operable` mostro `Evento no habilitado para check-in` y no muto DB.
- Activity: validacion manual registrada con `source = manual`, intento `outside_window` manual registrado con `source = manual`, regresion QR registrada con `source = qr`.
- Roles/acceso: owner Ibiza tuvo acceso y busqueda PASS; staff Ibiza tuvo busqueda y validacion manual PASS; sin sesion pide iniciar sesion y no muestra datos.
- Regresiones: Entradas PASS, Actividad PASS, Panel del evento PASS y fallback manual sigue dentro de Check-in.

Seguridad visual validada:

- no se observo token;
- no se observo payload QR;
- no se observo raw URL;
- no se observo QR base64;
- no se observaron auth IDs, `used_by_auth_user_id`, `created_by_auth_user_id` ni `local_id`;
- no se observo metadata cruda, request/response crudo, SQL, stack ni headers;
- no se observo buyer phone/email/document ni attendee phone/email;
- visible permitido: asistente, documento del asistente, ticket, status, `checkin_status`, `used_at` y evento.

Observacion no bloqueante:

- la busqueda por apellido funciono;
- la busqueda compuesta QA `Checkin D Owner` no devolvio resultado;
- no bloquea el PASS porque busqueda por documento y apellido funcionan correctamente;
- no se trata como bug UI salvo que un contrato futuro exija busqueda compuesta multi-campo.

Regresiones y limpieza:

- `qa_order_remaining = 0`;
- `qa_item_remaining = 0`;
- `qa_entries_remaining = 0`;
- `qa_activity_remaining = 0`;
- evento Ibiza restaurado a `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Validaciones tecnicas:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente porque `next lint` abre configuracion interactiva de ESLint.

## 17. Estado Scanner-C - scanner camara QR

Estado: implementado y QA frontend/runtime PASS.

Archivos del slice:

- `apps/web-next/components/panel/EventCheckinSection.tsx`;
- `apps/web-next/components/panel/EventCheckinScanner.tsx`.

Alcance implementado:

- scanner dentro de Check-in de Eventos;
- boton explicito `Activar camara`;
- sin auto-start;
- preview con `video playsInline muted`;
- integracion ZXing;
- parseo con `parseEventCheckinToken`;
- validacion con `checkInEventEntryByToken`;
- pausa durante `processing`;
- dedupe de frames repetidos;
- `Escanear otro`;
- `Detener camara`;
- cleanup de camara, stream, tracks, timers y refs;
- input QR/token/URL preservado;
- fallback manual preservado;
- sin tocar backend, SQL, pagos ni flujos operativos.

QA frontend/runtime PASS:

- Preflight: `/checkin` carga, camara sin auto-start, boton `Activar camara`, input QR/token/URL y fallback manual visibles.
- Camara: permiso solicitado, preview visible, video no negro, sin error tecnico, desktop PASS y mobile PASS.
- QR valido: `QA-SCANNER-C-VALID` mostro `Entrada validada`; DB quedo `issued/used`, `used_at != null`, `used_by_auth_user_id != null`.
- Activity: scan por camara registro `event_entry_checked_in` con `source = qr` y mensaje `Entrada validada por QR`.
- Dedupe: frames repetidos no generaron multiples validaciones principales.
- `Escanear otro`: reanudo; segundo scan del mismo QR mostro `Entrada ya utilizada` y registro `event_entry_already_used_attempt` con `source = qr`.
- QR invalido: mostro `QR invalido`, sin request backend y sin exponer decoded text, raw URL ni token.
- Input QR/token: `QA-SCANNER-C-INPUT` valido correctamente y mantuvo su flujo.
- Fallback manual: `QA-SCANNER-C-MANUAL` fue encontrado y el fallback siguio disponible.
- Permiso denegado/no camara: mensaje controlado, input/fallback disponibles y sin excepcion cruda.
- Seguridad visual y browser logs: sin tokens, decoded text, raw URL, QR payload/base64, auth IDs, metadata cruda, SQL, stack, headers ni datos sensibles no previstos.
- Roles/mobile: owner Ibiza PASS, staff Ibiza PASS, permiso denegado/no camara PASS y mobile PASS.
- Regresiones: Entradas PASS, Actividad PASS, Check-in PASS, input QR/token PASS y fallback manual PASS.
- Limpieza: `qa_order_remaining = 0`, `qa_item_remaining = 0`, `qa_entries_remaining = 0`, `qa_activity_remaining = 0`; Ibiza restaurado a `draft` con ventana original.

Observacion no bloqueante:

- Input QR/token registra la validacion con `source = manual`.
- Scan por camara registra correctamente `source = qr`.
- No bloquea Scanner-C porque el alcance principal era validar scanner camara con `source = qr`.
- Si se quiere unificar semantica de activity para input QR/token, abrir analisis separado.

Validaciones tecnicas:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente por configuracion interactiva de ESLint.

## 18. QA futuro restante

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

- mejoras UX posteriores, no inmediatas: sonido/vibracion, modo pantalla grande, selector de camara y linterna si se valida compatibilidad.

## 19. No-goals

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
- agregar mejoras nuevas de scanner sin slice nuevo;
- agregar Summary UI;
- agregar Settings UI;
- crear export;
- crear edicion/anulacion;
- configurar ESLint.

## 20. Estado final

Marcar:

- Check-in UI contrato definido.
- Ruta implementada: `/panel/events/[eventId]/checkin`.
- Checkin-B implementado: tipos/cliente `eventCheckin.ts` PASS tecnico.
- Checkin-C implementado: input QR/token/URL + resultado visual con QA frontend/manual PASS.
- Checkin-D implementado: fallback manual por busqueda en `/entries?q=...` + confirmacion fuerte con QA frontend/manual PASS.
- Scanner-C implementado: scanner camara QR dentro de Check-in con QA frontend/runtime PASS.
- Activacion explicita, preview desktop/mobile, dedupe, `Escanear otro`, `Detener camara`, cleanup por cambio de ruta y permiso denegado/no camara validados.
- Fallback manual operativo dentro de Check-in.
- Busqueda manual operativa.
- Cancelar no muta DB.
- Confirmar muta DB correctamente.
- Activity registra `source = manual`.
- Activity registra `source = qr` para scan por camara.
- Staff puede operar y sin sesion queda bloqueado.
- No hay exposicion sensible.
- Datos QA limpiados y evento restaurado.
- Proximo paso recomendado: cierre operativo del Check-in de Eventos y revision final del flujo Ibiza antes de agregar mejoras nuevas.
