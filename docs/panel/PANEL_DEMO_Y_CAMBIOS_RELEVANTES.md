# Panel Demo y Cambios Relevantes

## 1. Propósito
Este documento resume solo los cambios relevantes del panel para demo/video y los puntos a revisar antes de operar real.
No es un changelog completo de UI. Sirve como referencia rápida para nosotros y para futuras intervenciones de Codex.

## 2. Cambios relevantes implementados
- Exportación principal del panel a Excel (`.xlsx`) para Reservas y Orders.
- Paginación simple en `/panel/orders` con navegación `Ver anteriores` / `Ver siguientes`.
- Login del panel rediseñado, estabilizado y con switch dark/light local.
- Runtime demo del panel habilitable por env y rutas dedicadas.
- Override temporal visual de métricas en `Promociones` para grabación/video.

## 3. Demo / video: elementos temporales
- Env relevante para demo: `NEXT_PUBLIC_ENABLE_PANEL_DEMO=true`.
- Rutas demo del panel:
  - `/panel/demo/bar`
  - `/panel/demo/discoteca`
  - `/panel/demo/off`
- Hoy no se está operando real; los flujos y datos de demo no deben asumirse productivos.
- Las métricas fake de `Promociones` son solo visuales y se usan únicamente para grabación.

## 4. Overrides temporales de promociones
- Existe un override temporal visual en `apps/web-next/app/panel/(authenticated)/marketing/promos/page.tsx`.
- Aplica solo a los locales:
  - `dlirio`
  - `mckharthys-bar`
- Toma las 3 promos activas visibles por posición y les asigna vistas fake para demo:
  - `dlirio`: `5.340`, `4.110`, `3.260`
  - `mckharthys-bar`: `4.981`, `3.420`, `2.870`
- Con ese override también se inflan:
  - `Total vistas`
  - `Más vista`
  - vistas individuales de las 3 promos visibles
- Es un cambio de frontend/panel, no toca backend ni DB.
- Es fácil de revertir eliminando la allowlist y el bloque de override temporal.

## 5. Exportación
- La UI principal del panel descarga Excel real (`.xlsx`).
- El backend expone `/panel/exports/reservations-clients.xlsx`.
- El endpoint CSV original se mantiene como compatibilidad interna:
  - `/panel/exports/reservations-clients.csv`
- La exportación conserva columnas, permisos y semántica del flujo anterior.

## 6. Login del panel
- El login fue rediseñado y estabilizado como pantalla principal de acceso al panel.
- `/panel/login` tiene switch dark/light local, compatible con:
  - `tairet.panel.theme`
  - `tairet:panel-theme-change`
- La lentitud inicial observada en dev correspondió a compilación/carga inicial de Next, no a un bug funcional persistente del login.
- No se documentan aquí microajustes visuales menores del login.

## 7. Qué limpiar o revertir antes de producción real
- Desactivar o retirar rutas demo del panel si no van a seguir activas.
- Revisar `NEXT_PUBLIC_ENABLE_PANEL_DEMO` y dejarlo apagado si no corresponde.
- Revertir el override temporal de métricas fake en `Promociones`.
- Limpiar datos demo o inflados antes de operar con datos reales.
- Validar que no queden métricas, vistas o escenarios de grabación activos por error.
- Revalidar exportación Excel, login y Orders con contexto real antes de operar.

## 8. Validación manual recomendada
- Probar `/panel/demo/bar`, `/panel/demo/discoteca` y `/panel/demo/off` con demo habilitada.
- Probar `/panel/login` en dark y light.
- Probar exportación Excel desde Reservas y Orders.
- Verificar la paginación simple en `/panel/orders`.
- Verificar que el override de `Promociones` solo aparezca en `dlirio` y `mckharthys-bar`.

## 9. Referencias a otros frentes del panel
- Este documento queda como fuente de verdad del frente de rediseño/UI/demo del panel.
- El discovery UX/performance del panel B2B y el primer slice de UX/loading del dashboard `/panel` quedaron reubicados en:
  - `docs/panel/PANEL_B2B_UX_LOADING_Y_PERFORMANCE.md`
- El roadmap operativo del frente UX/performance del panel vive en:
  - `docs/panel/PANEL_B2B_UX_PERFORMANCE_ROADMAP.md`
- Esa separación es deliberada:
  - `PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md` cubre rediseño visual, demo y cambios relevantes de UI;
  - `PANEL_B2B_UX_LOADING_Y_PERFORMANCE.md` cubre discovery, trazabilidad y cierre de slices UX/loading;
  - `PANEL_B2B_UX_PERFORMANCE_ROADMAP.md` cubre el roadmap operativo del frente.
