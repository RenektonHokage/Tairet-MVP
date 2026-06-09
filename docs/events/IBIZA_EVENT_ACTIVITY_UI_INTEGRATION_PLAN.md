# Ibiza Activity UI-D: integracion de EventActivitySection en panel de eventos

## 1. Proposito

Este documento define el contrato de integracion para montar `EventActivitySection` en una ruta/layout real del panel de eventos.

Este paso es solo ASK / DOCS. No implementa codigo, frontend adicional, backend, SQL, migraciones, endpoints, pagos, activity local ni cambios en `/payments/callback`.

## 2. Contexto cerrado

Backend cerrado y QA PASS:

- `GET /panel/events/:eventId/activity`
- read-only;
- protegido por `eventPanelAuth + requireEventRole(["owner", "staff"])`;
- tenant safety por `req.eventPanelUser.eventId`;
- filtros, paginacion, actor seguro y metadata filtrada;
- sin PII, tokens, QR payload/base64, auth IDs ni `local_id`.

UI-A cerrado:

- `docs/events/IBIZA_EVENT_ACTIVITY_UI_CONTRACT_PLAN.md`

UI-B cerrado:

- `apps/web-next/lib/eventActivity.ts`
- tipos TS;
- `getEventActivity`;
- labels/constants;
- helpers puros;
- typecheck PASS.

UI-C cerrado:

- `apps/web-next/components/panel/EventActivitySection.tsx`
- componente reutilizable;
- recibe `eventId` por prop;
- consume `getEventActivity`;
- filtros por source y action exacta;
- loading/empty/error/retry;
- `Cargar mas`;
- metadata permitida como chips seguros;
- sin PII, tokens ni metadata cruda;
- no montado en navegacion global porque no existia ruta/layout estable confirmada.

Shell-C cerrado:

- `EventPanelShell` y `EventPanelNav` implementados.
- Layout propio creado en `/panel/events/[eventId]/layout.tsx`.
- `EventActivitySection` montado dentro del shell.
- Contexto de evento con `getEventPanelMe(eventId)`.
- Nav propia con `Actividad` solamente.
- Separacion del panel local.

Shell-D cerrado:

- QA visual/manual PASS completo reportado por el operador para `/panel/events/aed4cb4a-b297-4093-98e1-b3474f3b399c/activity`.
- Owner/staff Ibiza acceden correctamente.
- Usuarios no autorizados, sin auth/token invalido, `eventId` invalido y evento inexistente quedan controlados.
- Desktop/mobile validados sin doble layout, scroll horizontal ni exposicion sensible.
- Panel local y runtime demo validados sin regresion.

## 3. Documentos y archivos revisados

Documentos:

- `docs/events/IBIZA_EVENT_ACTIVITY_UI_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`

Frontend:

- `apps/web-next/app/panel`
- `apps/web-next/app/panel/(authenticated)`
- `apps/web-next/components/panel`
- `apps/web-next/components/panel/EventActivitySection.tsx`
- `apps/web-next/lib/eventActivity.ts`
- `apps/web-next/lib/api.ts`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/lib/panel.ts`
- `apps/web-next/components/panel/PanelShell.tsx`
- `apps/web-next/components/panel/SidebarNav.tsx`
- `apps/web-next/components/panel/ui`

## 4. Discovery de rutas/layout

Hallazgos:

- No existe una ruta real de panel de eventos en `apps/web-next/app/panel`.
- No existe `apps/web-next/app/panel/events/[eventId]`.
- No existe layout propio de evento.
- No existe nav/tabs especifico de evento.
- No existe pantalla frontend de event entries, event orders, event check-in, event summary ni event ticket-types.
- La unica activity de frontend fuera de Eventos es activity local (`lib/activity.ts` y `OperationalActivityHistory`).
- `EventActivitySection` y `getEventActivity` son los unicos archivos frontend actuales especificos de activity de Eventos.

Panel local actual:

- `apps/web-next/app/panel/(authenticated)/layout.tsx` usa `PanelProvider`.
- `PanelProvider` llama `/panel/me`, que pertenece al panel local.
- `PanelShell` renderiza sidebar local.
- `SidebarNav` navega por rutas locales como `/panel/orders`, `/panel/checkin`, `/panel/calendar`, `/panel/profile`.
- `SidebarNav` no tiene modelo de evento ni `eventId`.
- Runtime demo existe bajo `/panel/demo/[scenario]` y helpers `panel-demo`; no debe tocarse.

Riesgo principal:

- Montar activity de Eventos dentro de `(authenticated)` puede bloquear usuarios de evento que no tengan acceso local, porque el layout local consulta `/panel/me` antes de renderizar.
- Tambien puede mezclar mentalmente panel local (`local_id`) con panel de evento (`event_id`).

## 5. Decision de integracion recomendada

Decision:

- No montar `EventActivitySection` dentro del panel local actual.
- No agregar `Actividad` a `SidebarNav` local.
- No montar temporalmente dentro de `/panel/orders` ni `/panel/checkin`.
- Crear primero una ruta/shell minima de panel de evento o una ruta directa de activity de evento.

Opcion recomendada para el CODE posterior:

- Crear ruta nueva de evento:
  - `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`
- Esta ruta queda fuera de `apps/web-next/app/panel/(authenticated)` para evitar depender de `PanelProvider` local.
- La pagina toma `eventId` desde params y renderiza `EventActivitySection`.
- No agrega todavia navegacion global.

Alternativa si se decide crear shell de evento en el mismo CODE:

- `apps/web-next/app/panel/events/[eventId]/layout.tsx`
- `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`
- `apps/web-next/components/panel/EventPanelShell.tsx`
- `apps/web-next/components/panel/EventPanelNav.tsx`

Recomendacion de alcance:

- Primer CODE de montaje: ruta directa `Actividad` con `eventId` de params.
- Slice posterior: event shell/tabs si hay mas secciones de evento listas para montar.

Motivo:

- El backend ya valida auth/tenant por evento.
- El componente ya recibe `eventId`.
- Evita tocar navegacion local y reduce riesgo de regresion.
- Permite QA visual/manual con un `eventId` real sin definir toda la experiencia de evento.

## 6. Fuente de eventId

Fuente definida:

- `eventId` debe salir de params de ruta: `[eventId]`.
- El page component del CODE posterior debe pasar ese valor a `EventActivitySection`.

No usar:

- hardcode del eventId de Ibiza;
- `localStorage`;
- query manual `event_id`;
- contexto de panel local;
- `local_id`;
- constantes temporales de UI.

Regla:

- La UI no debe construir filtros con `event_id`.
- El unico `eventId` visible para el cliente es el path param necesario para llamar `/panel/events/:eventId/activity`.
- El backend sigue siendo la fuente de tenant safety.

## 7. Ubicacion visual

Label visible:

- `Actividad`

Titulo interno:

- `Actividad`

Subtitulo:

- `Historial operativo del evento.`

Modo de montaje recomendado:

- MVP: pantalla/ruta directa de activity del evento.
- Futuro: tab `Actividad` dentro de un shell de evento cuando existan mas secciones.

No recomendado ahora:

- sidebar global del panel local;
- card embebida en `/panel/orders`;
- card embebida en `/panel/checkin`;
- ruta demo.

## 8. Archivos candidatos para CODE posterior

Ruta directa minima:

- Crear `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`.

Si se necesita layout de evento:

- Crear `apps/web-next/app/panel/events/[eventId]/layout.tsx`.
- Crear `apps/web-next/components/panel/EventPanelShell.tsx`.
- Crear `apps/web-next/components/panel/EventPanelNav.tsx`.

Opcional:

- Actualizar `apps/web-next/components/panel/index.ts` solo si se necesita exportar nuevos componentes del shell.

No modificar en el primer montaje:

- `apps/web-next/components/panel/SidebarNav.tsx`;
- `apps/web-next/app/panel/(authenticated)/layout.tsx`;
- `apps/web-next/lib/panelContext.tsx`;
- runtime demo;
- rutas locales existentes.

## 9. Riesgos detectados

Riesgos:

- Confundir panel local con panel de evento.
- Bloquear usuarios de evento si se usa `PanelProvider` local.
- Pasar `local_id` como si fuera `event_id`.
- Agregar una opcion de sidebar local que no tenga `eventId`.
- Montar bajo una ruta sin fuente estable de `eventId`.
- Mostrar errores genericos de auth/tenant sin contexto si no se define boundary futuro.
- Tocar runtime demo o rutas locales sin necesidad.
- Crear un shell de evento demasiado grande antes de tener mas vistas del evento.

Mitigaciones:

- Usar params `[eventId]`.
- Mantener el primer montaje fuera de `(authenticated)` local.
- No tocar `SidebarNav` local.
- No usar `PanelProvider` para rutas de evento hasta que exista un event panel context.
- Dejar que backend valide 401/403/404/400.
- QA con owner Ibiza, staff Ibiza y owner local sin membership.

## 10. Seguridad y no exposicion

La integracion no debe:

- pasar eventId hardcodeado;
- pasar `local_id`;
- aceptar `event_id` por query;
- mezclar activity de otro evento;
- mostrar PII;
- mostrar tokens;
- mostrar QR payload/base64;
- mostrar raw URL;
- mostrar auth IDs;
- mostrar `local_id`;
- mostrar metadata cruda;
- hacer fetch extra a buyer/attendee;
- loggear response completa en browser.

Reglas:

- Consumir solo `EventActivitySection`.
- `EventActivitySection` consume solo `getEventActivity`.
- Backend mantiene tenant safety por `eventPanelAuth`.
- No crear joins ni fetches adicionales.

## 11. QA frontend/manual futuro

Casos minimos despues del CODE de montaje:

- Abrir ruta de activity con owner Ibiza.
- Abrir ruta de activity con staff Ibiza.
- Validar que `Actividad` carga.
- Validar empty state si no hay activity.
- Validar rows cuando hay activity.
- Validar labels de action.
- Validar labels de source.
- Validar actor label.
- Validar filtros source/action.
- Validar `Cargar mas`.
- Validar responsive mobile/desktop.
- Confirmar que no aparecen tokens.
- Confirmar que no aparece QR payload/base64.
- Confirmar que no aparece raw URL.
- Confirmar que no aparece email/phone/document.
- Confirmar que no aparece buyer/attendee PII.
- Confirmar que no aparecen auth IDs.
- Confirmar que no aparece `local_id`.
- Confirmar que no aparece metadata cruda.
- Owner local sin membership no accede a activity del evento.
- Sin auth/token invalido se maneja con error/redirect segun boundary disponible.
- Panel local sigue funcionando.
- Rutas existentes `/panel/orders`, `/panel/checkin`, `/panel/calendar`, `/panel/profile` no se rompen.
- Runtime demo sigue funcionando.

## 12. Lint/tooling

Estado actual:

- `pnpm -C apps/web-next lint` no es concluyente porque `next lint` abre configuracion interactiva de ESLint y no existe config en el proyecto.
- Este bloqueo es de tooling/configuracion, no de UI-C ni de este contrato.

No resolver en este bloque:

- No configurar ESLint.
- No migrar `next lint` a ESLint CLI.

Validaciones minimas para el CODE posterior:

- `pnpm -C apps/web-next typecheck`
- `git diff --check`

Pendiente opcional:

- Crear un slice separado de tooling para configurar lint no interactivo si se decide.

## 13. Roadmap por slices

UI-A:

- Contrato UI de activity.

UI-B:

- Tipos TS, labels/constants, helpers puros y `getEventActivity`.
- Estado: implementado y typecheck PASS.

UI-C:

- `EventActivitySection` reutilizable.
- Estado: implementado a nivel componente y typecheck PASS.
- Montado dentro de `EventPanelShell` en Shell-C.

UI-D:

- Este contrato de integracion.
- Estado: cerrado.

UI-E recomendado:

- CODE - crear ruta directa `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`.
- Tomar `eventId` de params.
- Renderizar `EventActivitySection`.
- No tocar sidebar local.
- No crear shell complejo salvo necesidad explicita.
- Estado: superado por Shell-C, que monto Activity dentro de layout propio de evento.

UI-F posterior:

- Event panel shell/tabs/nav si ya existen mas secciones de evento.
- Decidir tabs como `Resumen`, `Entradas`, `Check-in`, `Actividad`.
- Estado: base shell/nav ya implementada en Shell-C con `Actividad` como unica seccion real.

UI-G posterior:

- QA frontend/manual con datos reales/controlados.
- Estado: Shell-D QA visual/manual PASS.

Siguiente slice recomendado:

- ASK / DOCS - definir primera seccion operativa posterior del panel de eventos.
- Recomendacion inicial: Entries UI.

## 14. No-goals

Fuera de este contrato:

- implementar codigo;
- tocar frontend;
- tocar backend;
- tocar SQL/migraciones;
- tocar endpoints;
- tocar pagos;
- tocar `/payments/callback`;
- tocar B2C;
- tocar activity local;
- tocar `manual-issue`;
- tocar email;
- tocar check-in QR;
- tocar fallback manual;
- tocar runtime demo;
- montar rutas;
- configurar ESLint;
- crear historial por entry;
- crear export;
- agregar busqueda textual.
