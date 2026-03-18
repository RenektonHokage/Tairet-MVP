# Panel B2B — UX Loading y Performance

## 1. Propósito
Este documento es la fuente de verdad del frente UX/loading/percepción de espera del panel B2B.
Separa explícitamente:
- rediseño visual / demo / cambios UI del panel;
- discovery de UX/performance;
- slices pequeños orientados a mejorar la percepción de carga.

No reemplaza `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`.
Ese documento sigue siendo la fuente de verdad del frente demo/rediseño/UI.

---

## 2. Referencia cruzada
- Fuente de verdad del rediseño/UI/demo del panel:
  - `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`
- Fuente de verdad del frente UX/loading/performance del panel:
  - `docs/panel/PANEL_B2B_UX_LOADING_Y_PERFORMANCE.md`
- Fuente de verdad del roadmap UX/performance del panel:
  - `docs/panel/PANEL_B2B_UX_PERFORMANCE_ROADMAP.md`

---

## 3. Discovery UX/performance del panel B2B (consolidado)

### 3.1 Alcance y lectura correcta
- Este bloque consolida discovery de UX de espera / loading states / fetch patterns del panel B2B.
- No habilita CODE por sí solo.
- El rediseño UI reciente del panel debe leerse como contexto de producto/experiencia visual, no como disparador de refactor técnico amplio.
- La fuente principal de esta lectura es el código real del panel en `apps/web-next/**` y las rutas/backend que lo alimentan en `functions/api/src/routes/**`.

### 3.2 Inventario operativo de módulos/pantallas
- Shell/auth del panel: `apps/web-next/lib/panelContext.tsx`, `apps/web-next/app/panel/(authenticated)/layout.tsx`, `apps/web-next/app/panel/(authenticated)/loading.tsx`.
- Dashboard principal: `/panel` en `apps/web-next/app/panel/(authenticated)/page.tsx`.
- Profile: `/panel/profile` en `apps/web-next/app/panel/(authenticated)/profile/page.tsx`.
- Reservations: `/panel/reservations` en `apps/web-next/app/panel/(authenticated)/reservations/page.tsx`.
- Orders: `/panel/orders` en `apps/web-next/app/panel/(authenticated)/orders/OrdersPageClient.tsx`.
- Check-in: `/panel/checkin` en `apps/web-next/app/panel/(authenticated)/checkin/page.tsx`.
- Calendar: `/panel/calendar` en `apps/web-next/app/panel/(authenticated)/calendar/page.tsx`.
- Metrics / lineup: `/panel/metrics` en `apps/web-next/app/panel/(authenticated)/metrics/page.tsx` + `apps/web-next/components/panel/views/lineup/*`.
- Marketing / promos: `/panel/marketing/promos` en `apps/web-next/app/panel/(authenticated)/marketing/promos/page.tsx`.
- Settings / soporte / accesos: `/panel/settings` en `apps/web-next/app/panel/(authenticated)/settings/page.tsx`.

### 3.3 Estado actual de loading / empty / error / disabled
- Dashboard `/panel`: en el baseline del discovery, tenía `loading.tsx` a nivel de ruta y skeletons internos en `DashboardClubView` / `DashboardBarView`, pero el borde real de entrada todavía caía en `Verificando sesión...` y mezclaba `usePanelContext()` con verificación adicional de sesión. Ese era el principal problema de espera percibida que luego atacó el primer slice.
- Profile: cobertura relativamente buena de `loading`, `error`, `disabled`, banners y empty states (`carrusel`, `tickets`, `mesas`), pero con superficie de carga amplia y varios subestados (`uploading`, `promosLoading`, `catalogLoading`, guardados por dominio).
- Reservations: cobertura buena de `loading`, `empty`, `error`, `disabled`, refresh/export y estados por fecha. No aparece como el peor problema de UX de espera.
- Orders: cobertura media; existen `summaryLoading`, `entriesLoading`, `summaryError`, `entriesError`, empty state y botón de búsqueda, pero el flujo se percibe fragmentado porque `summary` y `entries` cargan por separado.
- Check-in: cobertura visual rica y bastante madura (`cameraStatus`, `loading`, `isCheckinProcessing`, overlays, retry, errores de cámara/red/servidor). No parece faltarle feedback primario.
- Calendar: tiene `loadingMonth`, `loadingDay`, `saving`, errores separados y feedback razonable en la vista; no tiene el peor problema de espera percibida, pero sí bastante trabajo real por detrás.
- Metrics / lineup: visualmente ya tiene skeletons y errores razonables; el problema principal no es ausencia de loaders sino coste de datos y cantidad de requests.
- Marketing / promos: cobertura buena de `contextLoading`, `loading`, `error`, `uploading`, `saving`, empty state y disabled states.
- Settings: cobertura buena de skeleton/retry/error para soporte y accesos; el problema de espera no es prioritario acá.

### 3.4 Distinción: percepción UX vs performance real
- Problema principalmente de percepción UX:
  - borde de entrada del panel y dashboard `/panel`;
  - patrones de `context loading` que, en el baseline del discovery, se resolvían con texto simple (`Cargando...`, `Verificando sesión...`) en varias pantallas.
- Problema principalmente de performance real:
  - `metrics` / `activity`;
  - `calendar` por cruces entre `local_daily_ops`, `reservations`, `orders`, `events_public` y `locals`.
- Mezcla de ambos:
  - `orders` por split de `summary` + `entries`;
  - `profile` por carga pesada, aunque mejor comunicada visualmente;
  - `lineup` / métricas derivadas.

### 3.5 Patrones de fetch observables
- El patrón dominante del panel es `useEffect + useState` manual; `QueryClient` existe en `apps/web-next/lib/api.ts`, pero no aparece como capa dominante de queries del panel.
- Hay waterfall implícito por contexto: muchas pantallas esperan primero `PanelProvider` / `/panel/me` y recién después cargan sus datos.
- Varias requests autenticadas vuelven a resolver sesión/token en helpers del frontend (`apps/web-next/lib/api.ts`, `apps/web-next/lib/panel.ts`).
- Los hotspots de carga real hoy no parecen venir de “falta de loaders”, sino de:
  - agregaciones backend pesadas en `metrics` y `activity`;
  - cruces de tablas en `calendar`;
  - separación manual de requests en `orders`;
  - superficie amplia en `profile`.

### 3.6 Módulos sensibles / no tocar primero
- No corresponde empezar por:
  - `orders`;
  - `reservations`;
  - `check-in`;
  - `calendar`;
  - `/panel/metrics`.
- Motivos:
  - son superficies más sensibles operativamente;
  - varias ya quedaron estabilizadas por hardening previo o están explícitamente diferidas / pausadas en la capa operativa;
  - mezclan más riesgo de regresión que ganancia rápida de UX.
- Tampoco conviene usar el rediseño visual reciente como excusa para reabrir refactors amplios de estas superficies.

### 3.7 Quick wins razonables
- Mejorar el feedback de entrada del panel antes que la performance profunda del backend.
- Unificar el patrón de `context loading` con un tratamiento visual consistente y más claro.
- Corregir primero el borde de entrada de `/panel` antes que módulos sensibles con múltiples contratos o validaciones previas.
- Mantener cualquier futura optimización inicial en un slice chico, reversible y visualmente perceptible.

### 3.8 Primer slice prudente recomendado
- El primer slice prudente recomendado entra por UX/loading inicial del panel.
- Punto exacto de entrada:
  - borde de entrada del dashboard `/panel`;
  - y, solo si el scope sigue claramente chico, el patrón compartido de `context loading`.
- No corresponde empezar por `orders`, `reservations`, `check-in`, `calendar` ni `/panel/metrics`.
- Este discovery deja una recomendación priorizada, pero no habilita CODE todavía.

---

## 4. Primer slice UX/loading del panel B2B (consolidado)

### 4.1 Qué fue realmente este slice
- El primer slice ejecutado de este frente entró por UX/loading inicial del dashboard `/panel`.
- El problema atacado fue la peor espera percibida del borde inicial del panel: el estado textual simple `Verificando sesión...`.
- El cambio consolidado reemplaza esa espera inicial por un estado visual de loading consistente del dashboard.

### 4.2 Qué resolvió
- Mejoró la percepción de carga inicial de `/panel` sin cambiar contratos, backend, auth ni fetching profundo.
- Relegó el peor caso de texto plano como estado principal de espera del dashboard.
- Mantuvo el cambio acotado al borde inicial del dashboard, sin convertirlo en un rediseño general del panel.

### 4.3 Qué quedó explícitamente fuera de scope
- No entró por:
  - `orders`;
  - `reservations`;
  - `check-in`;
  - `calendar`;
  - `/panel/metrics`.
- No tocó:
  - backend;
  - endpoints;
  - SQL;
  - optimización profunda de performance;
  - refactor global de `context loading`.

### 4.4 Qué no debe contarse como parte del slice final
- El microfix visual posterior que intentó representar mejor el bloque de `Visitas al perfil` dentro del skeleton inicial no forma parte del slice consolidado.
- Ese microajuste fue descartado / revertido y no debe contarse como mejora final del bloque.

### 4.5 Cómo debe leerse este cierre
- Este primer slice fue de UX/loading percibido, no de performance real.
- No debe presentarse como optimización profunda de backend, fetching o métricas.
- No debe presentarse como unificación completa del patrón de `context loading` del panel.

### 4.6 Estado operativo después de `UX-ASK-02`
- `UX-CODE-01` queda como primer y único slice ejecutado / consolidado por ahora dentro de este frente.
- **Después de `UX-CODE-01`, no existe actualmente un segundo slice chico no sensible con suficiente valor para justificar `UX-CODE-02`; el frente queda en pausa hasta nueva evidencia o nueva prioridad.**
- No corresponde usar este cierre para justificar entrada inmediata sobre `orders`, `reservations`, `check-in`, `calendar` o `/panel/metrics`.
- Si el frente se retoma en el futuro, debe volver a abrirse desde ASK y no desde CODE directo.

---

## 5. Relación con el roadmap
- Este documento consolida evidencia, discovery y slices ya ejecutados del frente UX/loading/performance del panel.
- La planificación operativa del frente vive en:
  - `docs/panel/PANEL_B2B_UX_PERFORMANCE_ROADMAP.md`
- El roadmap no reemplaza este documento; lo usa como base para decidir qué slice chico y no sensible conviene abrir después.
