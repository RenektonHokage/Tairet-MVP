# Ibiza Event Panel Shell: contrato UI/UX y arquitectura frontend

## 1. Proposito

Este documento define el contrato de UI/UX y arquitectura frontend para crear un panel propio de Eventos, alineado visualmente al panel actual de bares/discotecas, pero sin acoplarse a `local_id`, `/panel/me` ni `PanelProvider` local.

Este paso es solo ASK / DOCS. No implementa codigo runtime, frontend, backend, SQL, migraciones, endpoints, pagos, activity local ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Backend Eventos ya esta QA PASS:

- `GET /panel/events/:eventId/me`
- `GET /panel/events/:eventId/activity`
- `GET /panel/events/:eventId/entries`
- `GET /panel/events/:eventId/summary`
- `GET /panel/events/:eventId/ticket-types`
- `POST /panel/events/:eventId/orders/manual-issue`
- `POST /panel/events/:eventId/entries/:entryId/send-email`
- `GET /panel/events/:eventId/entries/:entryId/qr`
- `PATCH /panel/events/:eventId/checkin/:token`
- `PATCH /panel/events/:eventId/entries/:entryId/use`

Frontend Eventos cerrado:

- UI-B: `apps/web-next/lib/eventActivity.ts`, `getEventActivity`, tipos, labels y helpers.
- UI-C: `apps/web-next/components/panel/EventActivitySection.tsx`, componente reusable.
- UI-E: ruta directa `/panel/events/[eventId]/activity`.
- UI-F: wrapper visual minimo con `bg-gray-50`, `min-h-screen`, padding responsive y contenedor `max-w-6xl`.
- Shell-C: `EventPanelShell`, `EventPanelNav`, layout propio en `/panel/events/[eventId]/layout.tsx` y Activity montada dentro del shell.
- Shell-D: QA visual/manual PASS completo reportado por el operador.
- Entries-B: cliente/tipos frontend `eventEntries.ts` PASS tecnico.
- Entries-C: ruta `Entradas`, nav y listado read-only implementados con QA frontend/manual PASS.

Estado actual:

- Activity funciona dentro del shell propio de evento.
- Entradas funciona dentro del shell propio de evento.
- Check-in funciona dentro del shell propio de evento.
- El panel de eventos tiene shell/nav/layout propio y queda separado del panel local.
- El panel local sigue autenticandose contra `/panel/me`.
- El panel de eventos usa `/panel/events/:eventId/me` y no depende de `PanelProvider` local.
- No se mezcla `local_id` con `event_id`.

## 3. Documentos y archivos revisados

Documentos:

- `docs/events/IBIZA_EVENT_ACTIVITY_UI_INTEGRATION_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_UI_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`

Frontend:

- `apps/web-next/app/panel`
- `apps/web-next/app/panel/(authenticated)`
- `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`
- `apps/web-next/components/panel/EventActivitySection.tsx`
- `apps/web-next/components/panel/PanelShell.tsx`
- `apps/web-next/components/panel/SidebarNav.tsx`
- `apps/web-next/components/panel/Sidebar.tsx`
- `apps/web-next/components/panel/MobileDrawer.tsx`
- `apps/web-next/components/panel/ui`
- `apps/web-next/components/panel/ui/PageHeader.tsx`
- `apps/web-next/components/panel/ui/Badge.tsx`
- `apps/web-next/components/panel/ui/Card.tsx`
- `apps/web-next/components/panel/ui/panel-ui.ts`
- `apps/web-next/lib/api.ts`
- `apps/web-next/lib/panel.ts`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/lib/eventActivity.ts`
- `apps/web-next/app/panel/(authenticated)/orders`
- `apps/web-next/app/panel/(authenticated)/checkin`
- `apps/web-next/app/panel/(authenticated)/calendar`
- `apps/web-next/app/panel/(authenticated)/profile`
- `apps/web-next/app/panel/demo/[scenario]/page.tsx`

Backend consultado para contrato de contexto:

- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/middlewares/eventPanelAuth.ts`
- `functions/api/src/middlewares/requireEventRole.ts`

## 4. Discovery del panel local actual

`PanelShell`:

- Es client component.
- Maneja tema `dark/light` con `localStorage`.
- Renderiza `Sidebar`, `MobileDrawer`, mobile header y un main con `lg:pl-64`.
- Usa un contenedor `mx-auto max-w-7xl px-4 py-8 pt-20 lg:pt-8`.
- No llama directamente a `/panel/me`, pero sus hijos de navegacion si dependen del contexto local.

`SidebarNav`:

- Es client component.
- Usa `usePanelContext`.
- Lee `data.local.type`.
- Construye rutas locales como `/panel/orders`, `/panel/checkin`, `/panel/calendar`, `/panel/profile`, `/panel/reservations`, `/panel/metrics` y `/panel/marketing/promos`.
- No conoce `eventId`.
- No tiene modelo de evento.
- No debe reutilizarse directamente para Eventos.

`PanelProvider`:

- Vive en `apps/web-next/lib/panelContext.tsx`.
- Llama `getPanelUserInfo()`.
- `getPanelUserInfo()` llama `/panel/me`.
- El contexto local expone `role`, `email` y `local`.
- Tiene runtime demo local (`panel-demo`) y overrides visuales de locales.
- No sirve como contexto de evento.

`apps/web-next/app/panel/(authenticated)/layout.tsx`:

- Envuelve rutas locales con `PanelProvider`.
- Redirige a `/panel/login` si `/panel/me` devuelve 401.
- Muestra estado unauthorized para 403.
- Renderiza `PanelShell`.

Patron visual local:

- Fondo general `bg-gray-50` o tema oscuro en `PanelShell`.
- Sidebar desktop fijo y drawer mobile.
- Contenido con `max-w-7xl`, padding responsive y `space-y-6`.
- `PageHeader` para titulo/subtitulo/actions.
- Cards/surfaces blancas con borde, radio y sombra ligera.
- Componentes visuales reutilizables en `components/panel/ui`: `PageHeader`, `Badge`, `Card`, `DataTable`, `EmptyState`, `Toolbar`, `StatCard`, `panelUi`, `cn`.

Runtime demo:

- Existe bajo `/panel/demo/[scenario]`.
- Usa `panel-demo` local y redirige a `/panel`.
- No debe tocarse ni mezclarse con Eventos en este contrato.

## 5. Discovery del panel de eventos actual

Estado actual:

- Existe `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`.
- La ruta queda fuera de `(authenticated)`.
- Toma `eventId` desde params.
- Renderiza `EventActivitySection`.
- Existe `apps/web-next/app/panel/events/[eventId]/layout.tsx`.
- Existe `EventPanelShell`.
- Existe `EventPanelNav`.
- Existe helper frontend `getEventPanelMe`.
- El shell consulta `/panel/events/:eventId/me`.
- La nav propia muestra rutas reales `Entradas`, `Check-in` y `Actividad`.
- Activity queda montada dentro del shell.
- Entradas queda montada dentro del shell.
- Check-in queda montado dentro del shell.
- No existe `EventPanelProvider`; el contexto se resuelve en el shell.
- No existe pantalla frontend de evento para summary, ticket-types o settings.

Endpoint de contexto disponible:

- `GET /panel/events/:eventId/me`
- Protegido por `eventPanelAuth + requireEventRole(["owner", "staff"])`.
- Devuelve:
  - `event.id`
  - `event.slug`
  - `event.title`
  - `event.status`
  - `membership.role`
  - `membership.display_name`
- No depende de `/panel/me`.
- No requiere `local_id`.

## 6. Componentes reutilizables definidos

Reutilizables directamente:

- `PageHeader`
- `Badge`
- `Card`
- `CardHeader`
- `CardContent`
- `CardFooter`
- `DataTable`
- `EmptyState`
- `Toolbar`
- `StatCard`
- `cn`
- `panelUi`
- `apiGetWithAuth`
- `EventActivitySection`
- `EventEntriesSection`
- `getEventActivity`
- `getEventEntries`

Reutilizables como referencia visual, no como dependencia directa:

- estructura de `PanelShell`;
- mobile header;
- sidebar desktop;
- spacing `max-w-7xl px-4 py-8`;
- cards del panel local;
- loading/empty/error/retry de pantallas locales.

## 7. Componentes que no deben reutilizarse directamente

No reutilizar directamente en Eventos:

- `PanelProvider`
- `usePanelContext`
- `PanelShell`
- `SidebarNav`
- `Sidebar`
- `MobileDrawer`
- helpers `panel-demo`
- helpers locales de `panel.ts` que llaman `/panel/me`
- componentes o paginas que asumen `local.id`, `local.slug`, `local.type` o `local_id`

Motivo:

- Arrastran contexto local.
- Pueden bloquear usuarios de evento que no tengan acceso al panel local.
- Mezclan rutas locales con rutas de evento.
- Pueden inducir errores de tenant al confundir `local_id` con `event_id`.

## 8. Estrategia recomendada de EventPanelShell

Decision recomendada:

- Crear `EventPanelShell` separado para Eventos.
- Crear `EventPanelNav` separado para Eventos.
- Crear un layout propio en `apps/web-next/app/panel/events/[eventId]/layout.tsx`.
- Reutilizar clases y primitivas visuales del panel local, no su contexto local.

No recomendado:

- Reutilizar `PanelProvider`.
- Reutilizar `SidebarNav`.
- Agregar links de evento al sidebar local.
- Montar Eventos dentro de `apps/web-next/app/panel/(authenticated)`.

Alcance MVP del shell:

- sidebar/nav simple en desktop;
- header mobile simple;
- contenedor `mx-auto max-w-7xl px-4 py-8`;
- surface visual coherente con el panel local;
- solo seccion real `Actividad` al principio.

## 9. Estrategia de contexto/auth de evento

Crear futuro helper:

- `getEventPanelMe(eventId)`
- Path: `/panel/events/${encodeURIComponent(eventId)}/me`
- Usar `apiGetWithAuth`.
- Validar `eventId` no vacio.
- No aceptar `event_id` por query.
- No usar `local_id`.

Tipos futuros sugeridos:

- `EventPanelEvent`: `id`, `slug`, `title`, `status`.
- `EventPanelMembership`: `role`, `displayName`.
- `EventPanelMeResponse`: `event`, `membership`.

Contexto futuro recomendado:

- `EventPanelProvider` o fetch directo en `EventPanelShell`.
- Fuente de verdad: `GET /panel/events/:eventId/me`.
- Actor/rol del shell salen de `membership`.
- Nombre/status del evento salen de `event`.
- 401/403/404/400 se manejan en boundary del shell o estado de error controlado.

Reglas:

- No usar `/panel/me`.
- No asumir que owner local es owner de evento.
- No usar `panel_users`.
- No usar `local_id`.
- `eventId` siempre sale de params `[eventId]`.

## 10. Estructura de rutas recomendada

Estructura objetivo:

- `/panel/events/[eventId]/activity`
- `/panel/events/[eventId]/entries`
- `/panel/events/[eventId]/checkin`
- `/panel/events/[eventId]/summary`
- `/panel/events/[eventId]/settings`

MVP inmediato:

- Mantener rutas reales ya implementadas: `/panel/events/[eventId]/activity`, `/panel/events/[eventId]/entries` y `/panel/events/[eventId]/checkin`.
- No crear rutas vacias.
- Nav actual con `Entradas`, `Check-in` y `Actividad`.

Futuro:

- Agregar `Resumen` cuando exista UI de summary/ticket-types.
- Agregar `Configuracion` solo si hay permisos y contrato especifico.

Decision sobre placeholders:

- No mostrar links clicables a rutas inexistentes.
- No crear nav falsa.
- Si se necesita visibilidad de roadmap, usar copy interno en docs, no UI.

## 11. Montaje de Activity definido

Activity debe vivir dentro de `EventPanelShell` cuando exista.

Reglas:

- `EventActivitySection` sigue recibiendo `eventId` por prop.
- `EventActivitySection` sigue usando `getEventActivity`.
- No duplicar fetch de activity en el shell.
- No hacer fetch extra a buyer/attendee.
- No pasar `local_id`.
- No aceptar `event_id` por query.

Titulo:

- Opcion inicial: conservar `PageHeader` dentro de `EventActivitySection`.
- El shell debe mostrar contexto de evento en una zona separada y no duplicar el titulo `Actividad`.
- Si el shell incorpora header de pagina por seccion en un slice posterior, mover titulo a un unico lugar para evitar doble titulo visual.

## 12. Layout visual y responsive

Desktop:

- Fondo general alineado al panel local.
- Sidebar/nav lateral de evento, no sidebar local.
- Contenido con `lg:pl-*` si hay nav fija.
- Contenedor `mx-auto max-w-7xl px-4 py-8`.
- Secciones con `space-y-6`.
- Cards/surfaces con `border`, `bg-white`, radio consistente y sombra ligera.

Mobile:

- Header compacto con nombre del evento y boton de menu.
- Drawer o nav superior simple para secciones reales.
- No crear una navegacion compleja hasta que haya mas de una seccion real.
- Mantener `Actividad` legible con filtros y `Cargar mas`.

Informacion visible del shell:

- Nombre del evento.
- Rol del usuario (`owner` o `staff`).
- Status del evento si ayuda operativamente.
- Link/boton de volver si existe destino claro.

No mostrar:

- `auth_user_id`.
- `local_id`.
- metadata cruda.
- tokens.
- QR payload/base64.
- PII de buyer/attendee.

## 13. Riesgos y mitigaciones

Riesgo: mezclar panel local con panel de evento.

- Mitigacion: `EventPanelShell`, `EventPanelNav` y `EventPanelProvider` separados.

Riesgo: bloquear usuarios de evento por `/panel/me`.

- Mitigacion: usar solo `/panel/events/:eventId/me`.

Riesgo: crear rutas vacias o nav enganosa.

- Mitigacion: nav MVP con `Actividad` solamente.

Riesgo: copiar demasiado `PanelShell` y arrastrar `SidebarNav`.

- Mitigacion: copiar patrones visuales, no dependencias.

Riesgo: deuda tecnica por helper de contexto improvisado en cada page.

- Mitigacion: crear `getEventPanelMe` y un contexto de evento en slice separado.

Riesgo: romper runtime demo.

- Mitigacion: no tocar `/panel/demo`, `panel-demo`, `PanelProvider` ni rutas locales.

Riesgo: exponer datos sensibles en shell.

- Mitigacion: usar solo datos de `/panel/events/:eventId/me`, no activity metadata cruda ni fetches extra.

## 14. QA futuro

Casos minimos para CODE posterior:

- Owner Ibiza entra al shell de evento.
- Staff Ibiza entra al shell de evento.
- Owner local sin membership recibe error controlado o 403 manejado.
- Sin auth/token invalido se maneja con error o redirect segun boundary definido.
- `eventId` invalido queda controlado.
- Evento inexistente queda controlado.
- `Actividad` carga dentro del shell.
- `EventActivitySection` conserva filtros y `Cargar mas`.
- Visual desktop se parece al panel local sin usar sidebar local.
- Visual mobile tiene header/nav utilizable.
- No aparece `local_id`.
- No aparecen auth IDs.
- No aparecen tokens.
- No aparece QR payload/base64.
- No aparece PII.
- No aparece metadata cruda.
- `SidebarNav` local no cambia.
- `PanelProvider` local no cambia.
- `/panel/orders` sigue funcionando.
- `/panel/checkin` sigue funcionando.
- `/panel/calendar` sigue funcionando.
- `/panel/profile` sigue funcionando.
- `/panel/demo/[scenario]` sigue funcionando.
- `pnpm -C apps/web-next typecheck` PASS.
- `git diff --check` PASS.

## 15. Estado Shell-D - QA visual/manual PASS

Estado: **PASS**.

Shell-D valido manualmente:

- ruta `/panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/activity`;
- `EventPanelShell` operativo;
- `EventPanelNav` operativo;
- layout propio de evento operativo;
- contexto de evento por `/panel/events/:eventId/me`;
- Activity montada dentro del shell;
- panel de eventos separado del panel local;
- base del panel de eventos lista para nuevas secciones.

QA owner/staff:

- owner Ibiza accede a la ruta y ve contexto de evento, rol `owner`, nav `Actividad` y Activity dentro del shell;
- staff Ibiza accede a la misma ruta, ve rol `staff` y Activity carga sin dependencia de `PanelProvider` local;
- no aparece dependencia de `/panel/me`;
- no redirige al panel local.

QA auth/tenant safety:

- owner local sin membership no accede a datos del evento y no ve activity rows;
- sin auth o token invalido no accede a datos del evento y la UI no crashea;
- `eventId` invalido y evento inexistente muestran error controlado;
- no se muestran datos de otro evento.

QA visual:

- desktop alineado al panel existente, sin full-width crudo, doble header confuso, padding excesivo ni scroll horizontal;
- nav/sidebar propia visible y correcta;
- Activity mantiene jerarquia visual;
- mobile con header y nav usables, Activity legible, filtros sin romper layout, cards sin desborde y `Cargar mas` accesible.

Seguridad visual:

- no se detecto exposicion de `local_id`, `auth_user_id`, `actor_auth_user_id`, `used_by_auth_user_id`, `checkin_token`, `token`, `qr_payload`, `qr_base64`, raw URL, email crudo, phone, document, buyer, attendee, metadata cruda, request/response crudo, stack ni headers.

Regresiones:

- panel local validado sin regresion en `/panel/orders`, `/panel/checkin`, `/panel/calendar`, `/panel/profile`, `/panel/me` si corresponde y login local si corresponde;
- runtime demo `/panel/demo/[scenario]` validado sin regresion.

Nota sobre `/panel/login`:

- `/panel/login` pertenece actualmente al flujo del panel local de bares/discotecas y usa `/panel/me`;
- usuarios que solo tienen membership de evento pueden ver `User not authorized for panel access`;
- no se considera bug de Shell-D porque el panel de eventos se valida por URL directa `/panel/events/:eventId/activity`, el shell usa `/panel/events/:eventId/me` y no depende de `/panel/me` ni de `PanelProvider` local;
- queda pendiente en slice separado definir entrypoint/login/redirect especifico para panel de eventos.

Validaciones tecnicas registradas:

- `pnpm -C apps/web-next typecheck` -> PASS.
- `git diff --check` -> PASS.
- `pnpm -C apps/web-next lint` -> N/A/no concluyente porque `next lint` abre configuracion interactiva de ESLint y no existe config no interactiva.

## 16. Nota sobre lint/tooling

Estado actual:

- `pnpm -C apps/web-next lint` sigue no concluyente porque `next lint` abre configuracion interactiva de ESLint y no existe config no interactiva en el proyecto.
- No resolver en este bloque.

Pendiente separado:

- Tooling ESLint no interactivo.
- Migrar o configurar lint para que pueda correr en CI/local sin prompts.

## 17. Roadmap por slices

Shell-A:

- Este ASK/DOCS.

Shell-B:

- Crear `getEventPanelMe` y tipos frontend de contexto de evento.
- No montar shell todavia si se quiere validar helper aislado.

Shell-C:

- Crear `EventPanelShell` y `EventPanelNav` minimos.
- Crear `apps/web-next/app/panel/events/[eventId]/layout.tsx`.
- Montar la ruta `Activity` dentro del shell.
- Nav inicial: `Actividad` solamente.
- Estado: implementado.

Shell-D:

- QA visual/manual desktop/mobile.
- Validar owner/staff Ibiza, owner local sin membership, sin auth y token invalido.
- Estado: QA visual/manual PASS.

Shell-E futuro:

- Agregar UI de `Entries`.
- Agregar UI de `Check-in` cuando exista contrato/componentes.
- Agregar UI de `Summary` cuando exista contrato/componentes.
- Recomendacion inicial: avanzar primero con Entries UI porque conecta emision, QR, email, activity y soporte operativo.

Entries-A:

- Contrato UI/UX y tecnico de `Entradas` documentado en `docs/events/IBIZA_EVENT_ENTRIES_UI_CONTRACT_PLAN.md`.
- Estado: documentado.

Entries-B:

- Cliente/tipos frontend para `Entradas` creados en `apps/web-next/lib/eventEntries.ts`.
- Estado: PASS tecnico.
- Incluye `getEventEntries`, `sendEventEntryQrEmail`, `getEventEntryQrBlob`, labels/constants y badge helpers.
- Sin UI visible, sin ruta `/entries` y sin update de `EventPanelNav`.

Entries-C:

- Ruta `/panel/events/[eventId]/entries` creada.
- `EventPanelNav` actualizado con `Entradas` y `Actividad`.
- `EventEntriesSection` implementado como listado read-only con `getEventEntries`.
- Filtros `q/status/checkin_status/sort`, paginacion `Cargar mas`, dedupe por `entry.id`, desktop/mobile y estados loading/empty/error/retry implementados.
- QA frontend/manual PASS: owner/staff Ibiza, tenant/auth safety, empty/listado, filtros, paginacion, desktop/mobile, seguridad visual y regresiones.
- Sin Ver QR, sin Reenviar email, sin Validar manual y sin cambios backend/SQL/pagos/flujos.

Entries-D/E:

- Acciones `Ver QR` y `Reenviar email` implementadas en `EventEntriesSection`.
- QR se carga por blob autenticado con `getEventEntryQrBlob` y se muestra en modal.
- Object URL se limpia al cerrar, cambiar QR y desmontar.
- Reenvio email usa `sendEventEntryQrEmail`.
- Loading/success/error es por entry y el feedback `Email reenviado.` queda controlado.
- `email.to` no queda como dato persistente.
- QA frontend/manual PASS: owner/staff Ibiza, listado/filtros, QR modal, cierre/cambio de QR, reenvio email, sin sesion, seguridad visual, ausencia de `Validar manual`, Activity directa y limpieza QA.
- Datos QA limpiados: `qa_order_remaining = 0`, `qa_item_remaining = 0`, `qa_entries_remaining = 0`, `qa_activity_remaining = 0`.
- Sin backend, SQL, pagos, `/payments/callback` ni flujos operativos modificados.

Checkin-C:

- Ruta `/panel/events/[eventId]/checkin` creada.
- `EventPanelNav` actualizado con `Entradas`, `Check-in` y `Actividad`.
- `EventCheckinSection` implementado con input QR/token/URL y resultado visual por estado.
- Parser validado para UUID directo, URL completa y URL con slash/query/hash.
- QA frontend/manual PASS: owner/staff Ibiza, token valido, already used, URL, invalid, outside window, voided, event not operable, sin sesion, seguridad visual, regresiones y limpieza QA.
- Sin fallback manual, sin scanner camara, sin backend, SQL, pagos ni flujos operativos modificados.

Checkin-D:

- Fallback manual agregado dentro de `EventCheckinSection`.
- Busqueda manual usa `getEventEntries`.
- Query vacio y query de 1 caracter quedan controlados localmente.
- Resultados compactos muestran asistente, documento, ticket, status, `checkin_status` y `used_at`.
- Confirmacion fuerte validada antes de `checkInEventEntryManually`.
- Cancelar no muta DB; confirmar marca entry como usada.
- Activity de validacion manual queda registrada con `source = manual`.
- QA frontend/manual PASS: owner/staff, busqueda, confirmacion, estados controlados, seguridad visual, regresiones y limpieza QA.
- Sin scanner camara, backend, SQL, pagos ni flujos operativos modificados.

Scanner-C:

- Scanner camara QR agregado dentro de `EventCheckinSection` mediante `EventCheckinScanner`.
- Boton explicito `Activar camara`, sin auto-start.
- Preview desktop/mobile validado.
- ZXing, `parseEventCheckinToken` y `checkInEventEntryByToken` integrados.
- Pausa durante `processing`, dedupe, `Escanear otro`, `Detener camara` y cleanup validados.
- Input QR/token y fallback manual preservados.
- Activity de scan por camara registrada con `source = qr`.
- QA frontend/runtime PASS: owner/staff, permisos/no camara, QR valido, already used, QR invalido, seguridad visual/browser logs, regresiones y limpieza QA.
- Sin backend, SQL, pagos ni flujos operativos modificados.

Proximo paso recomendado:

- Cierre operativo del Check-in de Eventos y revision final del flujo Ibiza antes de agregar mejoras nuevas.

Tooling futuro:

- Configurar ESLint no interactivo en slice separado.

## 18. No-goals

Fuera de este documento:

- implementar codigo;
- tocar frontend;
- tocar backend;
- tocar SQL/migraciones;
- tocar endpoints;
- tocar pagos;
- tocar `/payments/callback`;
- tocar B2C;
- tocar activity local;
- tocar `PanelProvider` local;
- tocar `SidebarNav` local;
- tocar runtime demo;
- crear rutas vacias;
- crear shell grande sin contrato;
- configurar ESLint;
- crear historial por entry;
- crear export;
- agregar busqueda textual;
- mezclar `local_id` con `event_id`.
