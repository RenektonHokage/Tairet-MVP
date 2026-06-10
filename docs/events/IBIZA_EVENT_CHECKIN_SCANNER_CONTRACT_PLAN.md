# Ibiza Check-in Scanner: contrato de camara QR para panel de eventos

## 1. Proposito

Este documento define el contrato UI/UX y tecnico para agregar scanner de camara QR a la pantalla `Check-in` del panel de eventos.

El objetivo es preparar un futuro slice CODE que permita validar QRs con camara dentro de `/panel/events/[eventId]/checkin`, reutilizando la logica segura de Eventos y manteniendo input manual y fallback manual como alternativas operativas.

Este paso es solo ASK / DOCS. No implementa codigo runtime, frontend, backend, SQL, migraciones, endpoints, pagos, B2C, panel local, activity local ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Estado previo validado:

- Checkin-A: contrato UI de Check-in documentado.
- Checkin-B: `apps/web-next/lib/eventCheckin.ts` implementado con tipos, parser, clientes PATCH y labels/helpers.
- Checkin-C: ruta `/panel/events/[eventId]/checkin`, input QR/token/URL y resultado visual con QA frontend/manual PASS.
- Checkin-D: fallback manual por busqueda de entry y confirmacion fuerte con QA frontend/manual PASS.
- Backend Eventos: `PATCH /panel/events/:eventId/checkin/:token` QA runtime PASS.
- Backend Eventos: `PATCH /panel/events/:eventId/entries/:entryId/use` QA runtime PASS.
- Activity Eventos: check-in QR registra `source = qr` y fallback manual registra `source = manual`.

Reglas ya cerradas:

- El endpoint QR esta protegido con `eventPanelAuth + requireEventRole(["owner", "staff"])`.
- El check-in QR usa RPC transaccional y update atomico.
- El frontend de Eventos ya tiene `parseEventCheckinToken` y `checkInEventEntryByToken`.
- No se expone `checkin_token`, QR payload/base64, auth IDs, `local_id` ni metadata cruda.

## 3. Fuentes revisadas

Documentos revisados:

- `docs/events/IBIZA_EVENT_CHECKIN_UI_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_MANUAL_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_INTEGRATION_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_PANEL_SHELL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`

Frontend revisado sin modificar:

- `apps/web-next/components/panel/EventCheckinSection.tsx`
- `apps/web-next/lib/eventCheckin.ts`
- `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`
- `apps/web-next/package.json`
- `apps/web-next/components/panel/ui`
- `apps/web-next/lib/api.ts`

Terminos buscados:

- `@zxing/browser`
- `@zxing/library`
- `BrowserMultiFormatReader`
- `navigator.mediaDevices`
- `getUserMedia`
- `video`
- `decodeFromVideoDevice`
- `reset`
- `stop`
- `cooldown`
- `dedupe`
- `lastToken`
- `console.log`
- `checkin_token`
- `parseEventCheckinToken`
- `checkInEventEntryByToken`

## 4. Discovery scanner local / ZXing / camara

Hallazgos del check-in local:

- Existe scanner local en `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`.
- Usa `@zxing/browser` y `@zxing/library`, instalados en `apps/web-next/package.json`.
- Importa `BrowserQRCodeReader` de forma dinamica desde `@zxing/browser`.
- Usa hints de ZXing con `BarcodeFormat.QR_CODE` y `DecodeHintType.TRY_HARDER`.
- Usa `decodeFromVideoDevice(undefined, videoElement, callback)`.
- Usa `videoRef` para el preview de camara.
- Usa `navigator.mediaDevices.enumerateDevices()` para detectar camaras.
- Maneja estados de camara similares a `idle`, `requesting`, `active`, `no_devices`, `permission_denied` y `error`.
- Tiene cleanup con `scannerControlsRef.current.stop()`, `reader.reset()` si existe y `mediaStream.getTracks().forEach(track.stop())`.
- Limpia camara al desmontar y cuando el flujo local queda bloqueado.
- Tiene dedupe/cooldown por refs: request in-flight, auto scan in-flight, token en curso, ultimo token procesado y cooldown global.
- Tiene pausa funcional durante request mediante guards de in-flight, pero no debe copiarse sin adaptar semantica.
- Tiene soporte de linterna/capabilities como mejora opcional, no requerida para el primer scanner de Eventos.

Partes utiles como referencia tecnica:

- Inicializacion ZXing.
- Uso de `videoRef`.
- Uso de `decodeFromVideoDevice`.
- Cleanup de controls, reader y tracks.
- Dedupe/cooldown conceptual.
- Manejo de permiso denegado y sin camara.
- Uso de `playsInline` en video para mobile.

Partes que no se deben copiar tal cual:

- Endpoint local `PATCH /panel/checkin/:token`.
- `usePanelContext`.
- Semantica local de bar/club.
- Estados, labels y errores del check-in local.
- Logs que incluyen token normalizado o datos crudos del request.
- Retries y timeouts del flujo local sin revalidar contra Eventos.
- Cualquier exposicion de token raw, response cruda o detalle de error interno.

Limitaciones:

- Este ASK no valida runtime real de camara.
- Compatibilidad mobile, Safari iOS, Chrome Android, permisos y rendimiento deben validarse en QA con dispositivos reales.
- No se debe asumir que todos los navegadores soportan las mismas capabilities de video o linterna.

## 5. Decision de ubicacion UI

El scanner debe vivir dentro de:

- `/panel/events/[eventId]/checkin`

No crear ruta nueva.

Debe coexistir con:

- input QR/token/URL;
- fallback manual por busqueda de entry;
- resultado visual semantico existente.

Decision recomendada para el primer CODE:

- Agregar bloque `Escanear QR` dentro de la pantalla `Check-in`.
- Colocar boton `Activar camara` arriba del input actual.
- Mantener el input QR/token/URL inmediatamente disponible como respaldo.
- Mantener fallback manual como bloque separado.

Orden visual recomendado:

1. Scanner QR con camara.
2. Input QR/token/URL.
3. Fallback manual.
4. Resultado de ultima validacion.

Si el cambio visual se quiere reducir:

- Insertar solo el boton `Activar camara` y el preview de video dentro del card `Validar entrada`.
- No mover fallback manual.

## 6. Estrategia de activacion de camara

Decision:

- La camara no debe arrancar automaticamente al entrar a la pantalla.
- Debe requerir accion explicita con boton `Activar camara`.

Motivos:

- Evita permisos inesperados.
- Reduce consumo de bateria.
- Da control al staff en puerta.
- Es mas predecible en mobile.
- Mantiene input/fallback disponibles antes de pedir permisos.

Reglas:

- El boton `Activar camara` inicia permisos y scanner.
- `Detener camara` apaga scanner y tracks.
- `Escanear otro` reanuda despues de un resultado.
- Si la camara falla, input y fallback siguen operativos.

## 7. Estados del scanner

Estados definidos:

- `idle`: camara apagada.
- `requesting_permission`: solicitando permiso o preparando stream.
- `scanning`: camara activa y lista para leer.
- `processing`: QR leido y request `checkInEventEntryByToken` en curso.
- `paused_after_result`: resultado mostrado y scanner pausado.
- `permission_denied`: permiso de camara denegado o bloqueado.
- `no_camera`: no hay camara disponible.
- `scanner_error`: error controlado al iniciar o leer.

Reglas:

- `processing` bloquea nuevos scans y acciones paralelas de validacion.
- `paused_after_result` no dispara scans hasta que staff toque `Escanear otro`.
- `permission_denied`, `no_camera` y `scanner_error` deben mostrar mensajes controlados sin detalles crudos.

## 8. Flujo scanner

Flujo esperado:

1. Staff abre `/panel/events/[eventId]/checkin`.
2. Scanner empieza en `idle`.
3. Staff toca `Activar camara`.
4. UI pasa a `requesting_permission`.
5. Si hay permiso y camara, muestra preview y pasa a `scanning`.
6. ZXing lee un QR y entrega decoded text.
7. UI no muestra el decoded text.
8. UI llama `parseEventCheckinToken(decodedText)`.
9. Si el parser devuelve error:
   - mostrar `QR invalido`;
   - no llamar backend;
   - pausar brevemente o dejar scanning con cooldown controlado.
10. Si el parser devuelve token:
   - pasar a `processing`;
   - bloquear input/fallback o impedir validaciones paralelas;
   - detener lectura de nuevos frames;
   - llamar `checkInEventEntryByToken({ eventId, token })`.
11. Al recibir response:
   - limpiar token en memoria si ya no es necesario;
   - setear `result` con el response semantico existente;
   - pasar a `paused_after_result`;
   - mostrar boton `Escanear otro`.
12. Staff toca `Escanear otro`.
13. UI limpia estado transitorio y vuelve a `scanning`.
14. Staff puede tocar `Detener camara` para volver a `idle`.

## 9. Dedupe y doble validacion

Reglas obligatorias:

- No procesar frames mientras `processing`.
- Pausar scanner antes de iniciar el PATCH.
- Mantener un lock de request in-flight.
- No disparar multiples PATCH por frames repetidos del mismo QR.
- Guardar ultimo token procesado solo en memoria si hace falta.
- Preferir guardar hash/timestamp del token antes que token raw.
- No persistir token en localStorage, sessionStorage, URL, query params ni logs.
- No auto-reintentar el mismo QR despues de `valid`.
- Reanudar solo con accion explicita `Escanear otro`.

Backend sigue siendo fuente de verdad:

- Si el mismo QR se intenta validar nuevamente, backend debe responder `already_used`.
- El frontend reduce requests duplicados, pero no reemplaza la proteccion atomica del backend.

Dedupe minimo recomendado:

- `isProcessingRef`.
- `lastProcessedTokenFingerprintRef`.
- `lastProcessedAtRef`.
- cooldown corto para QR invalido o scan repetido.
- estado `paused_after_result` hasta accion del staff.

## 10. Cleanup de camara

Reglas obligatorias:

- Detener scanner al tocar `Detener camara`.
- Detener scanner al desmontar componente.
- Detener scanner al cambiar de ruta.
- Detener scanner si se oculta el bloque de camara.
- Llamar `controls.stop()` cuando exista.
- Llamar `reader.reset()` solo si la API disponible lo soporta.
- Detener todos los tracks de `videoRef.current.srcObject`.
- Setear `videoRef.current.srcObject = null`.
- Limpiar timers, cooldowns y refs transitorios.
- Apagar linterna/capabilities si se implementan.

No debe quedar:

- camara activa despues de navegar;
- stream vivo cuando el scanner esta `idle`;
- timer/cooldown que dispare requests despues del desmontaje;
- token raw retenido mas alla del intento necesario.

## 11. Manejo de permisos y errores

Mensajes recomendados:

- `permission_denied`: `No se pudo acceder a la camara. Podes usar el input manual o el fallback.`
- `no_camera`: `No se detecto camara disponible. Usa el input manual o el fallback.`
- `scanner_error`: `No se pudo iniciar el scanner.`
- QR invalido: `QR invalido.`
- Error API/red: `No se pudo validar la entrada.`

No mostrar:

- token;
- raw URL;
- decoded text completo;
- stack;
- `DOMException` cruda;
- response cruda del backend;
- headers;
- SQL;
- metadata interna.

Comportamiento:

- Permiso denegado no bloquea input/fallback.
- Sin camara no bloquea input/fallback.
- Error de scanner no bloquea input/fallback.
- Error de red deja resultado controlado y permite reintentar manualmente.

## 12. Relacion con input manual y fallback

Input QR/token/URL:

- Debe seguir disponible aunque exista scanner.
- Debe usar `parseEventCheckinToken`.
- Debe usar `checkInEventEntryByToken`.
- Debe quedar disabled durante `processing` para evitar validaciones paralelas.
- Debe borrar el valor despues del intento, como ya hace el flujo actual.

Fallback manual:

- Debe seguir disponible aunque exista scanner.
- Debe quedar disabled durante `processing` del scanner.
- Debe mantener confirmacion fuerte.
- Debe seguir usando `checkInEventEntryManually`.
- Si fallback valida una entrada, scanner no debe procesar en paralelo.

Resultado visual:

- Scanner, input y fallback deben escribir en el mismo `result`.
- No crear tres resultados separados.
- Reutilizar `EventCheckinResultCard` o el resultado visual existente.

## 13. Seguridad y no exposicion

Permitido mostrar:

- status semantico (`valid`, `already_used`, `invalid`, `outside_window`, `voided`, `not_valid_status`, `event_not_operable`);
- ticket;
- asistente;
- documento;
- `checkin_status`;
- `used_at`;
- evento.

Prohibido mostrar, guardar o loggear:

- decoded raw text;
- token;
- raw URL;
- `checkin_token`;
- QR payload;
- QR base64;
- auth IDs;
- `local_id`;
- metadata cruda;
- SQL;
- stack;
- headers;
- buyer phone/email/document;
- attendee phone/email.

Reglas:

- El token solo vive el tiempo minimo para llamar `checkInEventEntryByToken`.
- No se guarda en storage.
- No se incluye en activity metadata.
- No se imprime en `console.*`.
- No se envia URL raw completa al backend.
- No se exponen errores internos de ZXing ni del backend al usuario.

## 14. Arquitectura frontend futura

Decision recomendada:

- Crear componente separado `EventCheckinScanner` si el codigo supera una complejidad baja.
- Mantener `EventCheckinSection` como orquestador.

Responsabilidades de `EventCheckinScanner`:

- administrar camara;
- administrar `videoRef`;
- inicializar ZXing;
- leer decoded text;
- aplicar dedupe/cooldown;
- emitir evento `onDecodedText(decodedText)` o `onParsedToken(token)`;
- exponer estados controlados;
- hacer cleanup.

Responsabilidades de `EventCheckinSection`:

- mantener `result`;
- llamar `parseEventCheckinToken`;
- llamar `checkInEventEntryByToken`;
- coordinar disabled state con input/fallback;
- mostrar resultado visual;
- conservar fallback manual.

Alternativa aceptable:

- Mantener scanner inline en `EventCheckinSection` solo si el codigo queda chico y legible.

Regla:

- No introducir hook global ni carpeta nueva si no hace falta. En discovery no existe `apps/web-next/hooks`.

## 15. Reutilizacion del scanner local

Se puede reutilizar como referencia:

- inicializacion de ZXing;
- `videoRef`;
- `decodeFromVideoDevice`;
- cleanup de controls/reader/tracks;
- `playsInline`;
- deteccion basica de camaras;
- dedupe/cooldown conceptual;
- estados de permiso/camara;
- fallback conceptual cuando la camara falla.

No se puede copiar tal cual:

- endpoint `/panel/checkin/:token`;
- `usePanelContext`;
- reglas locales de bar/club;
- labels y errores locales;
- logs que incluyen token;
- logs de response/request crudo;
- retries/timeouts sin decision explicita;
- linterna/capabilities como requisito del primer CODE;
- modelo de resultado local;
- cualquier referencia a `local_id`.

## 16. Roadmap por slices

Scanner-A:

- Este ASK / DOCS.
- Crear contrato de scanner camara para Check-in de Eventos.

Scanner-B:

- Refactor minimo si hace falta antes del scanner.
- Extraer resultado visual o helpers comunes si `EventCheckinSection` queda grande.
- No implementar scanner todavia salvo que el codigo actual este listo.

Scanner-C:

- Implementado y QA frontend/runtime PASS.
- Scanner camara agregado dentro de `/panel/events/[eventId]/checkin`.
- Boton explicito `Activar camara`, sin auto-start.
- Preview con `<video playsInline muted />`.
- Usa ZXing, `parseEventCheckinToken` y `checkInEventEntryByToken`.
- Pausa durante `processing`, dedupe de frames repetidos y `Escanear otro`.
- `Detener camara` y cleanup de stream/tracks/timers/refs.
- Input QR/token y fallback manual preservados.
- No toco backend, SQL, pagos ni flujos operativos.

Scanner-D:

- QA frontend/runtime completado como parte de Scanner-C.
- Desktop/mobile, permisos, dedupe, cleanup, seguridad visual y logs del browser quedaron PASS.

Scanner-E futuro:

- Mejoras UX de puerta.
- Sonido/vibracion si corresponde.
- Modo pantalla grande.
- Selector de camara.
- Linterna si se valida compatibilidad.
- Optimizacion mobile.

## 17. QA futuro

Ruta:

- `/panel/events/:eventId/checkin`

Casos minimos:

- Scanner no arranca automaticamente.
- `Activar camara` pide permiso.
- Permiso concedido muestra preview.
- Permiso denegado muestra mensaje controlado.
- Sin camara muestra fallback operativo.
- QR valido devuelve `Entrada validada`.
- Segundo frame del mismo QR no dispara multiples requests.
- Input y fallback quedan bloqueados durante `processing`.
- Resultado queda visible.
- `Escanear otro` reanuda.
- Segundo intento del mismo QR devuelve `already_used` controlado.
- QR invalido muestra `QR invalido` sin llamar backend si el parser falla.
- `outside_window` muestra resultado controlado.
- `voided` muestra resultado controlado.
- `event_not_operable` muestra resultado controlado.
- Al cambiar de ruta la camara se apaga.
- Al tocar `Detener camara` la camara se apaga.
- Input manual sigue funcionando.
- Fallback manual sigue funcionando.
- Activity registra `source = qr` para validaciones por scanner.
- Owner/staff Ibiza pueden usar scanner.
- Sin sesion no puede usar scanner.
- Mobile usable con `playsInline`.
- No aparece token/raw URL/payload/auth IDs/`local_id`/metadata cruda en UI.
- No aparece token/raw URL/payload/auth IDs/`local_id`/metadata cruda en logs del browser.
- Regresion: Entradas sigue cargando.
- Regresion: Actividad sigue cargando.
- Regresion: check-in input sigue validando.
- Regresion: fallback manual sigue validando.

## 18. Estado Scanner-C - camara QR QA frontend/runtime PASS

Estado: implementado y QA frontend/runtime PASS.

Archivos del slice:

- `apps/web-next/components/panel/EventCheckinSection.tsx`
- `apps/web-next/components/panel/EventCheckinScanner.tsx`

Alcance implementado:

- scanner QR con camara dentro de `/panel/events/[eventId]/checkin`;
- boton explicito `Activar camara`;
- sin auto-start;
- preview con `<video playsInline muted />`;
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

- Preflight: `/checkin` carga, la camara no inicia automaticamente, `Activar camara` visible, input QR/token/URL visible y fallback manual visible.
- Camara: al activar camara el navegador solicita permiso, con permiso concedido aparece preview, el video no queda negro y no aparece error tecnico; preview validado en desktop y mobile.
- QR valido por camara: `QA-SCANNER-C-VALID` mostro `Entrada validada`; DB quedo `status = issued`, `checkin_status = used`, `used_at != null`, `used_by_auth_user_id != null`.
- Activity QR: se registro `event_entry_checked_in` con `source = qr` y mensaje `Entrada validada por QR`.
- Dedupe: mantener el QR frente a camara no genero multiples validaciones principales; hubo una validacion principal `source = qr`.
- `Escanear otro`: reanudo el flujo; segundo scan del mismo QR mostro `Entrada ya utilizada`, DB se mantuvo `used` y Activity registro `event_entry_already_used_attempt` con `source = qr`.
- QR invalido: mostro `QR invalido`, no llamo backend y no expuso decoded text, raw URL ni token.
- Input QR/token: `QA-SCANNER-C-INPUT` valido correctamente desde input y DB quedo `issued/used`, `used_at != null`, `used_by_auth_user_id != null`.
- Fallback manual: `QA-SCANNER-C-MANUAL` fue encontrado correctamente y el fallback siguio disponible junto al scanner.
- Permiso denegado/no camara: mostro `No se pudo acceder a la camara. Podes usar el input manual o el fallback.`, sin excepcion cruda; input y fallback quedaron disponibles.
- Seguridad visual y browser logs: no se observo exposicion de tokens, decoded text, raw URL, payloads QR, QR base64, auth IDs, metadata cruda, SQL, stack, headers ni datos sensibles no previstos.
- Datos visibles permitidos: asistente, documento del asistente, ticket, status, `checkin_status`, `used_at` y evento.
- Roles/acceso: owner Ibiza PASS en scan QR por camara y segundo scan `already_used`; staff Ibiza PASS en acceso, fixture, input QR/token y fallback manual; permiso denegado/no camara PASS; mobile PASS.
- Regresiones: Entradas PASS, Actividad PASS, Check-in PASS, input QR/token preservado PASS y fallback manual preservado PASS.
- Limpieza: `qa_order_remaining = 0`, `qa_item_remaining = 0`, `qa_entries_remaining = 0`, `qa_activity_remaining = 0`; Ibiza restaurado a `status = draft`, `checkin_valid_from = 2026-08-01 22:00:00+00`, `checkin_valid_to = 2026-08-02 10:00:00+00`.

Observacion no bloqueante:

- Input QR/token registra la validacion con `source = manual`.
- Scan por camara registra correctamente `source = qr`.
- No bloquea Scanner-C porque el alcance principal era validar scanner camara con `source = qr`.
- Si se quiere unificar semantica de activity para input QR/token, abrir analisis separado de activity source semantics.

Validaciones tecnicas:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente por configuracion interactiva de ESLint.

Estado final:

- Scanner-C implementado.
- Scanner-C QA frontend/runtime PASS.
- Scanner camara operativo dentro de Check-in de Eventos.
- Activacion explicita validada.
- Preview desktop/mobile validado.
- QR valido por camara validado.
- Dedupe validado.
- `Escanear otro` validado.
- `Detener camara` validado.
- Cleanup por cambio de ruta validado.
- Permiso denegado/no camara controlado.
- Input QR/token preservado.
- Fallback manual preservado.
- Activity `source = qr` validado para scan por camara.
- Seguridad visual/browser logs validada.
- Datos QA limpiados.
- Evento restaurado.

Proximo paso recomendado:

- Cierre operativo del Check-in de Eventos.
- No agregar mejoras nuevas todavia.
- Primero consolidar documentacion del estado actual del panel de eventos y preparar una revision final del flujo Ibiza.

Opciones posteriores, no inmediatas:

- sonido/vibracion;
- modo pantalla grande;
- selector de camara;
- linterna si se valida compatibilidad;
- historial por entry;
- Summary UI;
- login/entrypoint especifico de EventPanel.

## 19. Riesgos

Riesgos identificados:

- Permisos de camara varian por navegador/dispositivo.
- iOS/Safari y Chrome Android pueden comportarse distinto.
- `navigator.permissions.query({ name: "camera" })` no es consistente en todos los browsers.
- Lecturas duplicadas por multiples frames.
- Camara queda activa si cleanup falla.
- Token raw puede filtrarse si se copian logs del scanner local.
- Latencia del backend durante puerta.
- Red movil inestable.
- Mala iluminacion.
- QR en pantalla con brillo bajo.
- Staff tocando scanner, input y fallback al mismo tiempo.
- Linterna/capabilities no estan disponibles en todos los dispositivos.
- ZXing puede leer parcialmente o entregar errores no accionables por frame.

Mitigaciones:

- Boton explicito `Activar camara`.
- `processing` lock global para la pantalla.
- `paused_after_result` hasta `Escanear otro`.
- Cleanup obligatorio.
- Mensajes controlados.
- Input/fallback siempre disponibles como respaldo.
- QA en dispositivos reales antes de considerar PASS operativo.

## 20. Decision final para CODE

Scanner-C ya fue implementado y QA frontend/runtime PASS. Cualquier CODE posterior debe mantenerse fuera del alcance de Scanner-C y abrir un slice nuevo.

Criterios que quedaron validados:

- usar boton `Activar camara`;
- no auto-start;
- mantener input QR/token/URL;
- mantener fallback manual;
- usar `parseEventCheckinToken`;
- usar `checkInEventEntryByToken`;
- pausar scanner durante `processing`;
- mostrar `Escanear otro`;
- limpiar camara al desmontar/cambiar ruta/detener;
- no copiar scanner local tal cual;
- no loggear token, raw URL, decoded text ni response cruda;
- no tocar backend, SQL, pagos ni endpoints;
- validar en QA con navegador real.

## 21. No-goals

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
- tocar Activity UI;
- cambiar fallback manual;
- cambiar input QR/token/URL;
- crear Summary UI;
- crear Settings UI;
- configurar ESLint;
- crear endpoint nuevo;
- modificar RPCs.
