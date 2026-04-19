# Panel Demo y Cambios Relevantes

## 1. Propósito
Este documento resume el estado operativo actual del panel demo y los cambios relevantes que conviene tener presentes para video, QA interno y futuras intervenciones.
No es un changelog exhaustivo de UI. Solo registra lo estable, lo demo-only y el cleanup previo a operación real.

## 2. Estado actual del panel demo
- El panel demo quedó funcional y reutilizable como base de demo comercial e interna.
- El runtime demo vive en frontend y se habilita por env + rutas dedicadas.
- La demo ya no depende de abrir una segunda pestaña ni de usar el panel real para mostrar los módulos principales.
- Los módulos demo-ready usan datasets locales y, donde aplica, edición local en cliente sin backend real.
- `Check-in` y `Soporte/Settings` no forman parte de la superficie demo reutilizable actual; siguen acoplados a flujos reales.

## 3. Módulos demo-ready hoy
- Shell demo del panel:
  - identidad demo;
  - navegación;
  - runtime por escenario.
- Dashboard / Inicio:
  - `bar`;
  - `discoteca`.
- Reservas:
  - demo-ready para `bar`.
- Orders / Entradas:
  - demo-ready para `discoteca`.
- Métricas:
  - demo-ready para `bar`;
  - demo-ready para `discoteca`.
- Promociones:
  - demo-ready para `bar`;
  - demo-ready para `discoteca`;
  - dataset local y mutaciones solo en cliente.
- Perfil del local:
  - demo-ready para `bar`;
  - demo-ready para `discoteca`;
  - edición local e imágenes demo sin storage real.
- Calendario:
  - demo-ready para `bar`;
  - demo-ready para `discoteca`;
  - navegación mensual y guardado local de demo.
- Fuera del scope demo-ready actual:
  - `Check-in`;
  - `Soporte / Settings`.

## 4. Cambios relevantes estables
- Exportación principal del panel a Excel (`.xlsx`) para flujos operativos.
- Compatibilidad CSV interna mantenida donde correspondía.
- Paginación simple en `/panel/orders`.
- Login del panel rediseñado y estabilizado.
- Switch dark/light disponible en `/panel/login`.

## 5. Elementos demo-only / temporales
- Env de demo:
  - `NEXT_PUBLIC_ENABLE_PANEL_DEMO=true`
- Rutas demo:
  - `/panel/demo/bar`
  - `/panel/demo/discoteca`
  - `/panel/demo/off`
- Runtime demo en frontend:
  - `apps/web-next/lib/panel-demo/runtime.ts`
  - `apps/web-next/lib/panel-demo/identity.ts`
- Datasets demo locales para módulos demo-ready:
  - dashboard / métricas;
  - reservas bar;
  - orders discoteca;
  - promociones;
  - perfil del local;
  - calendario.
- Edición local en cliente, sin backend real, en módulos demo donde aplica:
  - `Promociones`
  - `Perfil del local`
  - `Calendario`
- Hoy no se está operando real; los datos y flujos demo no deben asumirse productivos.

## 6. Overrides temporales específicos
- Override visual temporal de nombre/email mostrado en el panel:
  - `dlirio`:
    - nombre mostrado: `Boliche`
    - email mostrado: `owner.boliche@tairet.com.py`
  - `mckharthys-bar`:
    - nombre mostrado: `Mckharthys Bar`
    - email mostrado: `owner.bar@tairet.com.py`
  - vive en `apps/web-next/lib/panelContext.tsx`
  - aplica solo a display en UI del panel
  - no cambia credenciales reales, auth, backend ni DB
- Override temporal visual de métricas fake en `Promociones` para video:
  - aplica solo a `dlirio` y `mckharthys-bar`
  - infla:
    - `Total vistas`
    - `Más vista`
    - vistas individuales de las 3 promos visibles
  - valores usados:
    - `dlirio`: `5.340`, `4.110`, `3.260`
    - `mckharthys-bar`: `4.981`, `3.420`, `2.870`
  - vive en `apps/web-next/app/panel/(authenticated)/marketing/promos/page.tsx`
  - es reversible y no toca backend ni DB

## 7. Qué limpiar o revertir antes de operación real
- Revisar si el runtime demo debe quedar habilitado:
  - si no, apagar `NEXT_PUBLIC_ENABLE_PANEL_DEMO`
  - y retirar o dejar inaccesibles las rutas demo
- Revisar y retirar los overrides visuales de video:
  - nombre/email fake en panel
  - métricas fake de `Promociones`
- Confirmar que no queden visibles en panel real:
  - nombres fake;
  - emails fake;
  - métricas infladas;
  - datasets demo por error fuera del runtime demo
- Revalidar con contexto real:
  - login;
  - exportación `.xlsx`;
  - `/panel/orders`;
  - `Promociones`
  - `Perfil del local`
  - `Calendario`
- Si el runtime demo va a permanecer, mantenerlo explícitamente aislado del panel real por env y por escenario.

## 8. Validación manual recomendada
- `/panel/login`:
  - dark;
  - light.
- `/panel/demo/bar`:
  - dashboard;
  - reservas;
  - métricas;
  - promociones;
  - perfil del local;
  - calendario.
- `/panel/demo/discoteca`:
  - dashboard;
  - orders / entradas;
  - métricas;
  - promociones;
  - perfil del local;
  - calendario.
- `/panel/demo/off`
- Exportación Excel desde módulos reales donde corresponda.
- Verificar que los overrides visuales de video solo aparezcan en:
  - `dlirio`
  - `mckharthys-bar`
