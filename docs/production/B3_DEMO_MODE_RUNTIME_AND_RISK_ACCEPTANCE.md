# B3_DEMO_MODE_RUNTIME_AND_RISK_ACCEPTANCE

## 1. Propósito del documento

Este documento cierra documentalmente el bloque `B3 — Demo mode en producción, exposición por rutas no enlazadas y riesgo aceptado` del remediation plan de Tairet.

Su función es dejar una política operativa explícita para este corte sobre:

- permanencia del demo del panel en producción real;
- exposición limitada por rutas no enlazadas conocidas;
- relación entre demo y panel live;
- riesgo aceptado y alcance de ese riesgo;
- validaciones mínimas para no romper el flujo live;
- criterio de cierre verificable para destrabar `B6` y `B7`.

Este documento no apaga demo, no lo mueve a otro host y no inventa aislamiento fuerte ni controles que no estén demostrados por el repo o por la documentación vigente.

## 2. Alcance de B3

Este bloque consume como decisiones de entrada del corte:

- alcance del go-live: `free_pass only`;
- panel en host temporal aceptado `https://tairet-mvp-web-next.vercel.app/`;
- demo aceptado en producción por ruta no enlazada, con riesgo aceptado;
- rutas demo válidas del corte: `/panel/demo/bar`, `/panel/demo/discoteca`, `/panel/demo/off`;
- owners de release e incidentes: `nosotros`.

Fuentes base consumidas:

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md`
- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`
- `docs/production/B2_DEPLOY_ROLLBACK_AND_MIGRATIONS.md`
- `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`
- `docs/panel/PANEL_DEMO_DISCOVERY.md` solo como apoyo histórico para comportamiento de rutas/runtime
- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `apps/web-next/lib/panel-demo/runtime.ts`
- `apps/web-next/app/panel/demo/[scenario]/page.tsx`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/components/panel/SidebarNav.tsx`

Lectura documental importante:

- `B3` no reemplaza el hecho de que readiness y remediation trataban demo expuesto como algo a apagar o aislar para producción plena;
- para este corte, esa expectativa no se declara resuelta: se reencuadra como excepción operativa con riesgo aceptado explícitamente;
- por lo tanto, este documento no cierra hardening definitivo del panel demo; cierra la política operativa excepcional del corte actual.

## 3. Política operativa del demo en este corte

Para este corte, la política operativa vigente es:

- el demo se mantiene habilitado en producción real;
- vive bajo el mismo host y origin del panel live;
- no forma parte de la superficie live normal del panel;
- no se accede desde la navegación normal visible del panel;
- se accede solo por rutas conocidas;
- debe describirse como `exposición limitada por ruta no enlazada con riesgo aceptado`.

Esta política no debe venderse como:

- host separado;
- aislamiento fuerte;
- entorno demo independiente;
- control de acceso fuerte;
- superficie “segura” solo porque no está enlazada.

Nota operativa:

- el demo comparte app shell, host, origin y runtime base con el panel live;
- la diferencia observable la introduce `NEXT_PUBLIC_ENABLE_PANEL_DEMO` junto con el runtime demo persistido en browser;
- esa diferencia no equivale a segregación de infraestructura, ni de dominio, ni de origin.

## 4. Rutas demo válidas y comportamiento esperado

Las rutas demo válidas de este corte son:

- `/panel/demo/bar`
- `/panel/demo/discoteca`
- `/panel/demo/off`

### 4.1 `/panel/demo/bar`

- si `NEXT_PUBLIC_ENABLE_PANEL_DEMO` está activo, persiste escenario `bar` en runtime local del browser;
- luego redirige a `/panel`;
- desde ese punto, el panel opera en modo demo con identidad y contexto demo del escenario `bar`.

### 4.2 `/panel/demo/discoteca`

- si `NEXT_PUBLIC_ENABLE_PANEL_DEMO` está activo, persiste escenario `discoteca` en runtime local del browser;
- luego redirige a `/panel`;
- desde ese punto, el panel opera en modo demo con identidad y contexto demo del escenario `discoteca`.

### 4.3 `/panel/demo/off`

- limpia el runtime demo local del browser;
- luego redirige a `/panel/login`;
- esta es la vía limpia de “demo apagado” dentro del corte actual.

### 4.4 Lectura operativa de demo encendido / apagado

- `demo encendido`: flag `NEXT_PUBLIC_ENABLE_PANEL_DEMO` activo y una ruta de escenario que persiste runtime demo;
- `demo apagado`: limpieza explícita por `/panel/demo/off`, con retorno a login/live;
- si el flag público no está activo, las rutas limpian runtime y vuelven a `/panel/login`; ese comportamiento existe como fallback técnico, pero la política operativa vigente del corte asume demo habilitado.

**Evidencia principal**

- `apps/web-next/lib/panel-demo/runtime.ts`
- `apps/web-next/app/panel/demo/[scenario]/page.tsx`
- `docs/panel/PANEL_DEMO_DISCOVERY.md`

## 5. Relación entre demo y panel live

La convivencia demo/live de este corte debe leerse así:

- demo y live comparten el mismo host del panel aceptado en `B1`;
- demo y live comparten el mismo origin browser;
- el demo no agrega un origin nuevo y, por lo tanto, no agrega una superficie CORS separada;
- demo y live comparten shell y contexto general del panel;
- el runtime demo reemplaza el contexto live en browser mediante persistencia local y una identidad demo;
- ese reemplazo ocurre en frontend, no por host separado ni por un backend demo independiente.

Límites de esta lectura:

- no afirmar segregación por host;
- no afirmar separación de credenciales o aislamiento de infraestructura si eso no está demostrado;
- no afirmar que la ausencia de un link normal equivalga a control de acceso fuerte;
- no afirmar que la convivencia demo/live sea inocua para operación real.

Nota de scope operativo:

- `Check-in` y `Soporte/Settings` no deben venderse como módulos demo-ready solo por compartir la app;
- el alcance demo reutilizable confirmado sigue siendo el descrito en `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`, no toda la superficie del panel.

**Evidencia principal**

- `docs/production/B1_PRODUCTION_TOPOLOGY_AND_ENVS.md`
- `apps/web-next/lib/panelContext.tsx`
- `apps/web-next/components/panel/SidebarNav.tsx`
- `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`

## 6. Riesgo aceptado y alcance del riesgo

### 6.1 Riesgo aceptado

El riesgo aceptado de este corte es el siguiente:

- el demo permanece accesible en el mismo host y origin del panel live mediante rutas no enlazadas conocidas;
- cualquier persona que conozca esas rutas y llegue al host con el flag público activo puede activar runtime demo en su browser;
- esto puede generar confusión operativa, mezcla perceptiva entre demo y live o exposición funcional no deseada del modo demo;
- la no vinculación desde la navegación normal reduce descubribilidad, pero no equivale a aislamiento ni a control de acceso fuerte.

### 6.2 Por qué se acepta en este corte

Se acepta porque:

- este corte prioriza conservar una superficie demo comercial/controlada sin introducir ahora cleanup adicional ni cambios de infraestructura;
- `B0` y `B1` ya consumen esta decisión como parte del corte actual;
- `B3` documenta esa decisión como excepción operativa consciente, no como estado ideal de hardening.

### 6.3 Quién acepta el riesgo

- el riesgo queda aceptado por `nosotros`, en el marco de owners de release e incidentes ya asentados para este corte en `B0`;
- esta aceptación es documental y operativa para el corte actual; no reemplaza una validación técnica futura si la estrategia cambia.

### 6.4 Cuándo conviene apagarlo o aislarlo mejor

Se vuelve recomendable apagarlo o aislarlo mejor si ocurre cualquiera de estas condiciones:

- aparece un enlace normal o una forma de descubribilidad no deseada;
- el demo interfiere con el flujo live del panel;
- se detecta confusión operativa real en runtime;
- un corte posterior exige endurecimiento productivo mayor o separación de host/origin.

Regla documental:

- la aceptación del riesgo no sustituye validación técnica;
- todo lo que no esté demostrado en runtime debe quedar en `Requiere validación`.

**Evidencia principal**

- `docs/production/B0_GO_LIVE_DECISIONS_AND_OWNERSHIP.md`
- `docs/audits/STATUS.md`
- `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
- `docs/security/SECURITY_AND_HARDENING_STATUS.md`
- `docs/operations/ENVIRONMENTS_DEPLOYMENT_AND_OPERATIONS.md`

## 7. Validaciones mínimas para cerrar B3

Para considerar `B3` cerrado documentalmente en el entorno objetivo, deben validarse como mínimo estos puntos:

- confirmar que la navegación normal visible del panel no enlaza `/panel/demo/*`;
- confirmar que `/panel/demo/bar` activa escenario `bar` y retorna a `/panel`;
- confirmar que `/panel/demo/discoteca` activa escenario `discoteca` y retorna a `/panel`;
- confirmar que `/panel/demo/off` limpia runtime y retorna a `/panel/login`;
- confirmar que `/panel/login` y el flujo live mínimo del panel siguen funcionando con la decisión demo vigente;
- confirmar que demo y live comparten host/origin y que esta decisión no agrega origins adicionales ni requisitos CORS nuevos;
- confirmar que el entorno live sin runtime demo persistido sigue comportándose como panel normal;
- confirmar que la política del demo y el riesgo aceptado quedan escritos sin vender aislamiento inexistente.

Regla operativa:

- si cualquiera de estas validaciones falla en el entorno objetivo, `B3` no debe considerarse cerrado documentalmente para ese release del corte.

## 8. Requiere validación

- que las rutas demo sigan realmente accesibles en el host desplegado del corte;
- que la navegación normal desplegada no las exponga de forma indirecta;
- que `NEXT_PUBLIC_ENABLE_PANEL_DEMO` esté en el estado operativo esperado para este corte;
- que la convivencia demo/live no produzca confusión operativa real no visible desde el repo;
- que datasets demo y overrides locales no se rendericen fuera del runtime demo esperado;
- que el comportamiento en runtime coincida con lo observado en código y docs, no solo en local;
- que el host temporal del panel sirva el build esperado bajo esta política demo/live;
- que no existan accesos laterales o rutas adicionales demo no documentadas para este corte.

Drift documental explícito:

- `docs/production/GO_LIVE_REMEDIATION_PLAN.md` y `docs/production/PRODUCTION_READINESS_AND_GO_LIVE_CHECKLIST.md` todavía tratan demo expuesto como algo a apagar o aislar para producción plena;
- este documento no niega esa tensión: deja explícito que el corte actual adopta una excepción operativa con riesgo aceptado, no un cierre definitivo de hardening.

## 9. Criterio de cierre de B3

`B3` puede considerarse cerrado documentalmente cuando este documento deja explícitos y verificables los siguientes puntos:

- la política demo/live del corte queda documentada sin ambigüedad;
- las rutas demo válidas y su comportamiento quedan fijados;
- la convivencia en mismo host/origin y sus límites quedan explicitados;
- el riesgo aceptado queda formulado de manera concreta, con owner y motivo del corte;
- las validaciones mínimas para no romper live quedan documentadas;
- el documento distingue claramente entre lo decidido y lo que sigue requiriendo validación runtime.

Este cierre no implica que el demo haya quedado endurecido o aislado. Implica que la política excepcional del corte queda escrita de forma usable, honesta y trazable.

## 10. Dependencias que destraba B3

- destraba `B6` al dejar claro qué debe observarse y qué no debe confundirse con operación live;
- destraba `B7` al fijar qué smoke mínimo demo/live debe correrse sin reabrir la decisión de apagarlo;
- evita que `B2`, `B6` y `B7` operen con ambigüedad sobre el estado permitido del demo en este corte.
