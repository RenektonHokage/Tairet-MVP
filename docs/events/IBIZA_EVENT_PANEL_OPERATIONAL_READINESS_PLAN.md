# Ibiza EventPanel: checkpoint de readiness operativa

## 1. Proposito

Este documento registra el estado operativo del EventPanel de Ibiza, su grado de reutilizacion para futuros eventos y el impacto esperado sobre bares, discotecas, pagos y Bancard.

Es un checkpoint documental. No implementa codigo runtime, backend, frontend, SQL, migraciones, endpoints, pagos, Bancard, B2C ni panel local.

## 2. Estado ejecutivo

Veredicto:

- El EventPanel de Ibiza esta cerca de estar operativo para lectura, soporte, QR, email, check-in, fallback manual y activity.
- El gap principal para operar Ibiza no esta en check-in ni lectura: esta en definir la forma operativa de crear/emitir entradas desde panel o desde un flujo controlado.
- La base construida es mayormente reutilizable por `event_id`; no esta hardcodeada a Ibiza salvo por provisioning, fixtures, QA y documentacion de piloto.
- El vertical de Eventos esta aislado del panel local por rutas, tablas, auth y activity separada.
- Bancard todavia no esta conectado a Eventos ni al EventPanel. Se puede avanzar con Bancard si se mantiene congelado el surface operativo de Eventos y se aisla el core de pagos.

Decision de checkpoint:

- Ibiza puede entrar a una etapa de smoke/freeze operativo despues de cerrar el bloque de emision de entradas.
- No conviene tocar check-in, QR, entries, email, activity ni shell salvo bugs bloqueantes.
- No conviene mezclar Bancard con este EventPanel hasta definir el core de pagos y el flujo de emision pagada.

## 3. Fuentes revisadas

Documentos de Eventos revisados:

- `docs/events/EVENTS_PRODUCT_AND_TECH_PLAN.md`
- `docs/events/IBIZA_EVENT_TECHNICAL_MODEL_PLAN.md`
- `docs/events/IBIZA_EVENT_PILOT_PLAN.md`
- `docs/events/IBIZA_MANUAL_ISSUE_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ENTRIES_UI_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_QR_DELIVERY_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_AUTOMATIC_EMAIL_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_MANUAL_CHECKIN_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_UI_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_CHECKIN_SCANNER_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_LOG_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_INTEGRATION_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_READ_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_UI_CONTRACT_PLAN.md`
- `docs/events/IBIZA_EVENT_ACTIVITY_UI_INTEGRATION_PLAN.md`
- `docs/events/IBIZA_EVENT_PANEL_SHELL_CONTRACT_PLAN.md`

Documentos de pagos revisados:

- `docs/payments/BANCARD_SINGLE_BUY_ARCHITECTURE.md`
- `docs/payments/ACCESS_CORE_ARCHITECTURE.md`

Frontend revisado:

- `apps/web-next/app/panel/events/[eventId]/layout.tsx`
- `apps/web-next/app/panel/events/[eventId]/entries/page.tsx`
- `apps/web-next/app/panel/events/[eventId]/checkin/page.tsx`
- `apps/web-next/app/panel/events/[eventId]/activity/page.tsx`
- `apps/web-next/components/panel/EventPanelShell.tsx`
- `apps/web-next/components/panel/EventPanelNav.tsx`
- `apps/web-next/components/panel/EventEntriesSection.tsx`
- `apps/web-next/components/panel/EventCheckinSection.tsx`
- `apps/web-next/components/panel/EventCheckinScanner.tsx`
- `apps/web-next/components/panel/EventActivitySection.tsx`
- `apps/web-next/lib/eventPanel.ts`
- `apps/web-next/lib/eventEntries.ts`
- `apps/web-next/lib/eventCheckin.ts`
- `apps/web-next/lib/eventActivity.ts`
- `apps/web-next/lib/api.ts`
- `apps/web-b2c/src/components/shared/CheckoutBase.tsx`
- `apps/web-b2c/src/components/FAQAccordion.tsx`

Backend, SQL y pagos revisados:

- `functions/api/src/server.ts`
- `functions/api/src/routes/panelEvents.ts`
- `functions/api/src/routes/panel.ts`
- `functions/api/src/routes/orders.ts`
- `functions/api/src/routes/payments.ts`
- `functions/api/src/routes/activity.ts`
- `functions/api/src/services/payments.ts`
- `functions/api/src/services/eventActivity.ts`
- `functions/api/src/services/eventEmails.ts`
- `functions/api/src/services/eventQr.ts`
- `functions/api/src/middlewares/eventPanelAuth.ts`
- `functions/api/src/middlewares/requireEventRole.ts`
- `infra/sql/schema.sql`
- `infra/sql/migrations/027_create_event_pilot_tables.sql`
- `infra/sql/migrations/028_add_event_packages_and_order_items.sql`
- `infra/sql/migrations/029_create_issue_event_manual_order_rpc.sql`
- `infra/sql/migrations/030_create_event_checkin_rpc.sql`
- `infra/sql/migrations/031_create_event_manual_checkin_rpc.sql`
- `infra/sql/migrations/032_create_event_activity_events.sql`
- `infra/sql/migrations/025_create_operational_activity_events.sql`
- `infra/sql/migrations/024_harden_panel_users_payment_events_grants.sql`

## 4. Estado por bloque

| Bloque | Estado | Evidencia | Reutilizable | Riesgo actual | Proximo paso |
| --- | --- | --- | --- | --- | --- |
| EventPanelShell | Cerrado | `EventPanelShell`, `EventPanelNav`, layout `/panel/events/[eventId]` | Si | Bajo | Freeze |
| Navegacion EventPanel | Cerrado | Tabs `Entradas`, `Check-in`, `Actividad` | Si | Bajo | Freeze |
| Membership owner/staff | Cerrado | `eventPanelAuth` + `requireEventRole(["owner", "staff"])` | Si | Bajo | Smoke final |
| Entradas read-only | Cerrado | `GET /panel/events/:eventId/entries` + `EventEntriesSection` | Si | Bajo | Smoke final |
| QR PNG por entry | Cerrado | `GET /panel/events/:eventId/entries/:entryId/qr` + boton `Ver QR` | Si | Bajo | Smoke final |
| Reenvio email manual | Cerrado | `POST /panel/events/:eventId/entries/:entryId/send-email` | Si | Bajo | Smoke final |
| Email automatico post manual-issue | Cerrado | `email_delivery.mode = order_bundle`, QA runtime PASS documentado | Si | Medio | Smoke con emision final |
| Check-in QR/token | Cerrado | `PATCH /panel/events/:eventId/checkin/:token` + input UI | Si | Bajo | Smoke final |
| Check-in scanner camara | Cerrado | `EventCheckinScanner` integrado y Checkin-B aprobado | Si | Medio | Smoke en dispositivos reales |
| Fallback manual por entry | Cerrado | `PATCH /panel/events/:eventId/entries/:entryId/use` + UI de busqueda | Si | Bajo | Smoke final |
| Activity backend/read/UI | Cerrado | `event_activity_events`, `recordEventActivity`, `GET /activity`, `EventActivitySection` | Si | Bajo | Smoke final |
| Activity integrada en flujos | Cerrado | manual-issue, email, check-in QR y fallback manual documentados como QA PASS | Si | Bajo | Smoke final |
| Crear/generar entradas desde UI | Pendiente | Backend existe; no se encontro pantalla visible de emision | Si, si se diseña generico | Alto operativo | Definir slice de UI o script controlado |
| Summary/ticket-types UI | Pendiente no bloqueante | Backend existe; no aparece ruta visible en EventPanel | Si | Bajo | Futuro si soporte lo necesita |
| B2C compra publica de evento | Pendiente | No forma parte del EventPanel actual | Si, futuro | Medio | Separar de Bancard/core pagos |
| Bancard eventos | Pendiente | Arquitectura documentada, sin integracion runtime al EventPanel | Si, futuro | Alto si se mezcla con legacy | Diseñar core aislado |

## 5. Que quedo cerrado para Ibiza

Queda cerrado para el flujo operativo de puerta y soporte:

- Shell dedicado de evento en `/panel/events/:eventId`.
- Navegacion propia de evento separada del panel local.
- Lectura de entries por evento.
- Busqueda y filtros operativos de entries.
- Visualizacion de PII operativa permitida para owner/staff.
- QR PNG por entry sin exponer `checkin_token`.
- Reenvio manual de QR por email.
- Email automatico post `manual-issue` en bundle por orden.
- Check-in por QR/token.
- Scanner de camara en UI.
- Fallback manual por `entryId`.
- Activity log de Eventos separado de activity local.
- Lectura de activity por evento.
- UI de activity.
- Activity integrada en emision, email, check-in QR y fallback manual.
- Seguridad por `event_id`, `event_panel_users`, owner/staff y middlewares propios.
- No exposicion de `checkin_token`, QR payload/base64, `local_id`, auth IDs ni metadata cruda en responses operativas.

## 6. Que falta para operar Ibiza

Bloqueantes o casi bloqueantes:

- Definir como se van a emitir las entradas reales de Ibiza antes de puerta.
- Decidir si la emision sera por UI de owner/staff, por script/API controlado o por import futuro.
- Ejecutar un smoke final con entradas reales o fixture final equivalente.
- Confirmar configuracion final del evento: estado, ventana de check-in, ticket types activos, stock y staff.
- Confirmar el entrypoint operativo para staff: URL, credenciales, roles y dispositivos.

Pendientes recomendados pero no necesariamente bloqueantes:

- Pantalla de resumen operativo de evento, si se quiere un dashboard visual.
- Historial por entry, si soporte necesita ver activity filtrada desde una entry.
- Export, si el equipo operativo exige planilla externa.
- Mejoras de UX del scanner segun pruebas en celulares reales.
- Manual operativo breve para staff: buscar entrada, reenviar QR, validar, fallback manual y interpretar estados.

Futuro fuera del cierre de Ibiza:

- Compra publica B2C de eventos.
- Bancard para eventos.
- Import CSV.
- Anulacion/void desde UI.
- Edicion/correccion de datos de attendee.
- Conciliacion de pagos.

## 7. Bloque Crear entradas / Emitir entradas

Estado confirmado:

- Existe backend para emision manual: `POST /panel/events/:eventId/orders/manual-issue`.
- La creacion real ocurre por RPC `public.issue_event_manual_order`.
- El endpoint crea `event_orders`, `event_order_items` y `event_order_entries`.
- El endpoint esta protegido por `eventPanelAuth` y `requireEventRole(["owner", "staff"])`.
- La emision esta event-scoped por `event_id`.
- La response no expone `checkin_token`.
- El flujo dispara email automatico por orden y activity best-effort.
- El flujo fue validado por QA runtime en documentos previos.

Gap confirmado:

- No se encontro una pantalla visible en `apps/web-next/app/panel/events/[eventId]` para crear o emitir entradas.
- La navegacion visible del EventPanel expone `Entradas`, `Check-in` y `Actividad`, no una seccion de emision.
- Por eso, para operar Ibiza todavia falta decidir la herramienta de emision final.

Campos requeridos por la operacion:

- Buyer: `name`, `last_name`, `email`, `phone`, `document`.
- Items: `ticket_type_id`, `quantity`, `attendees`.
- Attendees por entry: `name`, `last_name`, `email`, `phone`, `document`.
- `notes` opcional.

Termino recomendado para UI:

- Label visible: `Emitir entradas`.
- Nombre funcional interno: `manual-issue`.
- Evitar `Crear entradas` como label principal porque puede confundirse con crear tipos de ticket o stock.

Opciones:

| Opcion | Descripcion | Ventaja | Riesgo | Recomendacion |
| --- | --- | --- | --- | --- |
| UI reutilizable de emision | Pantalla owner/staff dentro de EventPanel que usa ticket types del evento | Menor error operativo, reusable para futuros eventos | Requiere un slice adicional | Recomendada si staff/owner emitira entradas |
| Script/API controlado | Emisiones por request controlado por equipo tecnico | Rapido para una carga puntual | Mayor riesgo humano y peor UX | Aceptable solo para operacion acotada |
| UI Ibiza-only | Pantalla rapida hardcodeada para Ibiza | Puede salir rapido | Deuda y duplicacion | Evitar salvo urgencia fuerte |
| Import CSV | Carga masiva futura | Bueno para volumen alto | No esta implementado | Futuro |

Decision recomendada:

- Si Ibiza necesita emitir entradas durante la operacion o por staff, crear una UI reutilizable `Emitir entradas`.
- Si solo falta precargar una lista cerrada y validada, usar un script/API controlado con checklist y cleanup.
- No mezclar este bloque con Bancard ni con B2C.

## 8. Reutilizable vs exclusivo Ibiza

| Pieza | Reutilizable por evento | Exclusivo Ibiza | Comentario |
| --- | --- | --- | --- |
| `events` / `event_ticket_types` / `event_orders` / `event_order_entries` | Si | No | Modelo event-scoped |
| `event_panel_users` | Si | No | Membership por evento |
| `EventPanelShell` | Si | No | Recibe `eventId` |
| `EventPanelNav` | Si | No | Construye rutas por `eventId` |
| `EventEntriesSection` | Si | No | Consume `getEventEntries(eventId)` |
| `EventCheckinSection` | Si | No | Consume clientes por `eventId` |
| `EventCheckinScanner` | Si | No | Scanner generico de token/URL |
| `EventActivitySection` | Si | No | Consume activity por `eventId` |
| `POST /orders/manual-issue` de Eventos | Si | No | Usa eventId y ticket types del evento |
| RPCs de check-in | Si | No | Filtran por `event_id` |
| `event_activity_events` | Si | No | Separada de local activity |
| Provisioning Ibiza | No | Si | Seed/evento/staff/productos del piloto |
| QA fixtures Ibiza | No | Si | Datos temporales del piloto |
| Documentos Ibiza | Parcial | Si | Sirven como blueprint, no como runtime |
| Bancard docs | Si | No | Arquitectura futura transversal |

Conclusion de reutilizacion:

- La arquitectura del EventPanel es reusable.
- Ibiza es el primer caso concreto, no un fork tecnico.
- El mayor riesgo de volverlo Ibiza-only seria crear la pantalla de emision con IDs, precios o textos hardcodeados.

## 9. Impacto sobre bares y discotecas

Separacion actual:

- Eventos usa rutas `/panel/events/:eventId/...`.
- Panel local usa rutas `/panel/...` y `PanelProvider`.
- Eventos usa `eventPanelAuth`, `event_panel_users` y `event_id`.
- Panel local usa `panelAuth`, `panel_users` y `local_id`.
- Eventos usa `event_orders`, `event_order_items`, `event_order_entries` y `event_activity_events`.
- Locales usan `orders`, `reservations`, `ticket_types`, `operational_activity_events` y tablas con `local_id`.

Impacto esperado:

- El EventPanel no deberia afectar bares/discotecas mientras se mantenga esa separacion.
- Los cambios de Eventos no deben tocar `orders`, `reservations`, `panel_users`, `panel.ts`, `orders.ts`, `CheckoutBase` ni `operational_activity_events`.
- Los puntos compartidos reales son helpers de UI, `apps/web-next/lib/api.ts`, montaje de routers en `server.ts`, middleware global, dependencias y estilos compartidos.

Riesgos para bares/discotecas:

- Cambiar `apiGetWithAuth`/`apiPostWithAuth`/`apiPatchWithAuth` sin smoke del panel local.
- Reutilizar `local_id` dentro de Eventos o `event_id` dentro del panel local.
- Mezclar `operational_activity_events` con `event_activity_events`.
- Modificar `/orders`, `/panel/orders/summary`, `/panel/checkin/:token` o `/payments/callback` por necesidades de Eventos.
- Cambiar componentes compartidos de layout o `Badge` sin revisar pantallas locales.

Smoke local recomendado despues de cualquier cambio futuro:

- `/panel/me` local.
- `/panel/orders/summary` local.
- `/panel/orders/search` local.
- Check-in local por token.
- Reservas local.
- B2C local checkout si se toca `orders` o pagos.

## 10. Impacto sobre Bancard y pagos

Estado confirmado:

- Bancard no esta integrado en el EventPanel de Ibiza.
- `POST /panel/events/:eventId/orders/manual-issue` usa `payment_method = manual_transfer` y `payment_status = confirmed_externally`.
- `event_orders.payment_method` permite `bancard`, pero eso no implica que el flujo Bancard exista.
- `/payments/callback` existe como callback generico actual para `payment_events`.
- La arquitectura de Bancard documentada recomienda no reutilizar `/payments/callback` as-is para el contrato final de Bancard.
- `BANCARD_SINGLE_BUY_ARCHITECTURE.md` y `ACCESS_CORE_ARCHITECTURE.md` plantean un core de pagos/accesos futuro, no una integracion runtime ya cerrada.
- B2C actual de locales usa `local_id`, `orders` y `CheckoutBase`; no es el flujo publico de compra de eventos.

Impacto esperado:

- Se puede avanzar con Bancard en paralelo solo si no se modifica el surface operativo de Eventos ya validado.
- Bancard debe diseñarse como core aislado o flujo especifico, no como parche sobre `manual-issue`.
- La emision pagada de eventos debe crear entries solo despues de confirmacion segura del pago.
- No debe usarse `manual-issue` como callback Bancard.

Riesgos con Bancard:

- Reusar `orders` legacy para eventos pagos y mezclar `local_id` con `event_id`.
- Reusar `/payments/callback` sin idempotencia, validacion de monto/moneda/hash y conciliacion.
- Emitir entries antes de una confirmacion Bancard confiable.
- Liberar stock si Bancard queda ambiguo.
- Exponer payloads tecnicos Bancard a owner/staff.
- Tocar EventPanel al mismo tiempo que se define Bancard.

Regla recomendada:

- Congelar EventPanel operativo de Ibiza antes de Bancard.
- Definir Bancard sobre un core de pagos/accesos separado.
- Ejecutar smoke de Eventos y panel local antes y despues de cambios de pagos.

## 11. Riesgos actuales

Riesgos altos:

- No tener aun una herramienta operativa visible para emitir entradas reales.
- Usar requests manuales para emitir entradas sin checklist, validacion UX ni confirmacion humana clara.
- Hacer cambios de Bancard sobre tablas o endpoints legacy sin aislar pagos.

Riesgos medios:

- Scanner depende de permisos/camara/dispositivo/navegador.
- Email automatico puede fallar por proveedor, dominio o configuracion de envio.
- Staff puede necesitar entrenamiento para interpretar `already_used`, `outside_window`, `voided` e `invalid`.
- Sin export, soporte depende del panel para busqueda.
- Sin historial por entry, activity general puede ser menos directa para soporte puntual.

Riesgos bajos:

- Lectura de entries ya esta event-scoped.
- Check-in QR y fallback manual ya estan separados de local check-in.
- Activity de Eventos esta separada de `operational_activity_events`.
- No hay exposicion conocida de `checkin_token` en UI operativa.

## 12. Proximos pasos recomendados

Orden recomendado:

1. Definir decision final del bloque `Emitir entradas`.
2. Si corresponde, crear ASK/DOCS para UI reusable de emision manual.
3. Implementar UI de emision solo si realmente la operacion la necesita.
4. Ejecutar smoke final de EventPanel con owner y staff Ibiza.
5. Congelar EventPanel operativo salvo bugs bloqueantes.
6. Preparar guia breve de operacion para staff.
7. Retomar Bancard solo con el EventPanel congelado y tests de regresion definidos.

Si se decide no crear UI de emision:

- Preparar un script/request controlado.
- Validar buyer/attendees antes de emitir.
- Ejecutar una emision piloto.
- Confirmar entries, emails, QR, activity y check-in.
- Registrar limpieza o fixture final.

## 13. Freeze / no tocar recomendado

No tocar salvo bug bloqueante:

- `functions/api/src/routes/panelEvents.ts` en endpoints ya QA PASS.
- RPCs `issue_event_manual_order`, `check_in_event_entry_by_token`, `check_in_event_entry_manually`.
- `apps/web-next/components/panel/EventPanelShell.tsx`.
- `apps/web-next/components/panel/EventPanelNav.tsx`.
- `apps/web-next/components/panel/EventEntriesSection.tsx`.
- `apps/web-next/components/panel/EventCheckinSection.tsx`.
- `apps/web-next/components/panel/EventCheckinScanner.tsx`.
- `apps/web-next/components/panel/EventActivitySection.tsx`.
- `apps/web-next/lib/eventEntries.ts`.
- `apps/web-next/lib/eventCheckin.ts`.
- `apps/web-next/lib/eventActivity.ts`.
- `event_activity_events` y helper `recordEventActivity`.
- Flujos de QR, email, check-in, fallback manual y activity.

No tocar por trabajo de Eventos:

- `/payments/callback`.
- `functions/api/src/routes/orders.ts`.
- `functions/api/src/routes/payments.ts`.
- `functions/api/src/services/payments.ts`.
- `apps/web-b2c/src/components/shared/CheckoutBase.tsx`.
- `operational_activity_events`.
- `panel_users` y panel local.
- Rutas locales `/panel/...` no event-scoped.

## 14. Smoke tests recomendados

Smoke EventPanel Ibiza:

- Owner Ibiza abre `/panel/events/:eventId/entries`.
- Staff Ibiza abre `/panel/events/:eventId/entries`.
- Owner local sin membership recibe `403`.
- `/entries` lista entries y filtros basicos funcionan.
- `Ver QR` devuelve PNG visible.
- Reenvio email por entry responde OK.
- `/checkin` carga dentro de EventPanelShell.
- Check-in por token valido devuelve `valid`.
- Segundo scan devuelve `already_used`.
- Token invalido devuelve `invalid`.
- Fallback manual busca entry y valida.
- Scanner de camara lee un QR real en celular.
- `/activity` muestra eventos generados.
- No aparece `checkin_token`, QR payload/base64, `auth_user_id`, `local_id` ni metadata cruda.

Smoke de regresion local:

- `/panel/me` local sigue OK.
- `/panel/orders/summary` local sigue OK.
- `/panel/orders/search` local sigue OK.
- Check-in local sigue OK.
- B2C local checkout no cambia si no se toco pagos.

Smoke de pagos/Bancard antes de tocar pagos:

- Confirmar que `/payments/callback` queda intacto.
- Confirmar que `payment_events` no se toca por Eventos.
- Confirmar que `manual-issue` no depende de Bancard.
- Confirmar que el EventPanel no lee payloads Bancard.

## 15. Conclusion

Respuestas del checkpoint:

- Ibiza esta mayormente cerrada en EventPanel operativo para soporte, QR, email, check-in, fallback manual y activity.
- Ibiza no esta completamente lista para operacion real hasta cerrar la forma de emitir entradas reales.
- El bloque `Emitir entradas` existe en backend y fue validado, pero no tiene pantalla visible confirmada.
- La recomendacion es crear UI reusable de emision si owner/staff necesita cargar entradas durante la operacion.
- La arquitectura de Eventos es reusable por `event_id`; Ibiza no es un fork tecnico.
- Bares y discotecas no deberian verse afectados si no se toca panel local, `local_id`, `orders`, `reservations`, `operational_activity_events` ni pagos legacy.
- Bancard puede avanzar despues, pero debe hacerlo aislado del EventPanel ya validado y sin reutilizar `/payments/callback` as-is.
- El siguiente paso practico es decidir el modo de emision y ejecutar smoke/freeze.

## 16. No-goals respetados

Este documento no:

- toca codigo runtime;
- toca backend;
- toca frontend;
- toca SQL;
- toca migraciones;
- toca endpoints;
- toca pagos;
- toca Bancard;
- toca B2C;
- toca panel local;
- modifica `/payments/callback`;
- implementa emision UI;
- implementa compra publica de eventos.
