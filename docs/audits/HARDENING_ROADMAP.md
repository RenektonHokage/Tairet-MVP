# TAIRET — HARDENING_ROADMAP (V1)

## 1) Título

**TAIRET — HARDENING_ROADMAP (V1)**

## 2) Ruta canónica

`docs/audits/HARDENING_ROADMAP.md`

## 3) Propósito

Definir el roadmap maestro de hardening del MVP de Tairet usando como base exclusiva la capa documental v1 ya consolidada, separando de forma estricta:

* **ASK** = discovery, extracción de verdad, validaciones pendientes, definición de contratos y gates
* **CODE** = implementación

Este roadmap no reemplaza a los demás documentos; los usa como prerequisito operativo para decidir:

* qué puede tocarse
* en qué orden
* bajo qué condiciones
* y con qué bloqueantes documentales o de validación

---

## 4) Regla de fuente de verdad

La prioridad operativa para este roadmap es:

1. **Código del repo**
2. **Runtime/entorno**, solo cuando el código no alcanza
3. **Input humano**, solo para:

   * riesgo aceptado
   * comportamiento esperado
   * prioridad operativa

Todo lo no demostrado debe quedar como:

* **Requiere validación**

---

## 5) Base documental obligatoria

Este roadmap se apoya en:

* `docs/audits/CONTRATOS_CONGELADOS_V1.md`
* `docs/audits/BASELINE_FUNCIONAL_V1.md`
* `docs/audits/MATRIZ_VALIDACION_PREVIA_V1.md`
* `docs/audits/SMOKE_TESTS_V1.md`
* `docs/audits/RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

Ninguna fase CODE debe interpretarse sin leer primero estos cinco documentos.

---

## 6) Principios de ejecución

### 6.1 Separación ASK vs CODE

* **ASK** no implementa.
* **CODE** no redefine contratos ni verdad operativa sin antes pasar por ASK cuando corresponda.

### 6.2 No-breaking en fases tempranas

Antes de cualquier cambio sensible:

* no romper contratos actuales de `/public/orders?email`
* no romper `MisEntradas`
* no romper auth panel
* no romper reservas panel
* no romper check-in
* no romper export CSV

### 6.3 Una fase sensible por vez

No mezclar en la misma fase:

* refactor estructural de `panel.ts`
* hardening SQL/RLS
* hardening delicado del endpoint público
* cambios grandes de arquitectura

### 6.4 Todo lo no confirmado sigue abierto

Si algo todavía depende de:

* extracción adicional desde código
* validación runtime
* o decisión humana permitida

entonces no se trata como listo para CODE sensible.

---

## 7) Dependencias maestras

### 7.1 Dependencias documentales

Antes de iniciar CODE sensible deben existir y estar vigentes:

* contratos congelados
* baseline funcional
* matriz de validación previa
* smoke tests
* riesgos aceptados y pendientes

### 7.2 Dependencias de validación

Los siguientes bloques requieren cierre adicional antes de tocar implementación sensible:

* payload mínimo real de órdenes públicas consumido por B2C
* contrato actual de reservas panel
* contrato completo de check-in
* contrato completo de export CSV
* cobertura exacta de auth panel
* matriz actor → tabla → operación para RLS
* validaciones runtime mínimas del popup, reservas, logout y RLS

---

## 8) Orden maestro de ejecución

### Orden recomendado

1. **F0 — Cierre documental v1**
2. **F1 — ASK de extracción contractual adicional**
3. **F2 — ASK / validación runtime mínima**
4. **F3 — CODE de observabilidad y guardrails**
5. **F4 — CODE de hardening aditivo del flujo público B2C**
6. **F5A — CODE de reservas + auth/logout**
7. **F5B — CODE de check-in + export CSV**
8. **F6 — CODE de refactor estructural `panel.ts`**
9. **F7 — CODE de hardening SQL / RLS**
10. **F8 — CODE de pendientes no bloqueantes y cierre documental**

---

## 9) Qué puede ir en paralelo y qué no

### 9.1 Puede ir en paralelo

Solo cuando no toquen la misma superficie sensible:

* tareas ASK documentales entre sí
* extracción adicional desde código para contratos independientes
* preparación de runtime validation templates
* actualizaciones documentales no conflictivas

### 9.2 No debe ir en paralelo

* **F6 (`panel.ts`)** con **F7 (RLS)**
* hardening de `/public/orders?email` con cambios incompatibles en `MisEntradas`
* cambios de auth panel con refactor estructural grande
* cambios de check-in/export con reestructuración masiva de rutas
* **F5A** con **F5B** si comparten archivos o contratos aún no congelados del panel

---

## 10) Fases del roadmap

## F0 — Cierre documental v1

**Tipo:** ASK
**Objetivo:** dejar cerrada la capa documental base antes de tocar código.

### Input documental

* código y evidencia ya relevada
* borradores o versiones vigentes de los docs v1

### Output esperado

* docs v1 consistentes entre sí
* ruta canónica `docs/audits/` estable
* contradicciones mayores resueltas o marcadas como `Requiere validación`

### Bloqueantes

* contradicciones no resueltas entre docs
* nombres/rutas documentales inconsistentes
* afirmaciones no demostradas sin marcar

### Docs a actualizar al cerrar

* `CONTRATOS_CONGELADOS_V1.md`
* `BASELINE_FUNCIONAL_V1.md`
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Qué puede romperse

* nada funcional; es fase documental

---

## F1 — ASK de extracción contractual adicional

**Tipo:** ASK
**Objetivo:** cerrar los contratos críticos todavía parcialmente abiertos.

### Input documental

* `CONTRATOS_CONGELADOS_V1.md`
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`

### Bloques mínimos

1. payload mínimo real de `/public/orders?email` consumido por B2C
2. contrato actual de reservas panel
3. contrato completo de check-in
4. contrato completo de export CSV
5. cobertura exacta de rutas protegidas por auth panel
6. matriz actor → tabla → operación para RLS

### Output esperado

* reducción de filas `Requiere validación` en la matriz
* contratos críticos más cerrados que en F0
* mejor definición de no-breaking por bloque

### Bloqueantes

* evidencia de código insuficiente
* dependencias no trazadas entre frontend y backend
* contratos edge-case todavía no identificados

### Docs a actualizar al cerrar

* `CONTRATOS_CONGELADOS_V1.md`
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Qué puede romperse

* nada funcional; sigue siendo discovery

### Requiere validación

* todo lo que no pueda cerrarse desde código debe seguir marcado explícitamente

---

## F2 — ASK / validación runtime mínima

**Tipo:** ASK + Runtime
**Objetivo:** validar los puntos que el código no puede cerrar por sí solo.

### Input documental

* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Bloques mínimos

1. explotabilidad real del popup de mapa
2. severidad real del límite y filtrado de reservas
3. efectividad real del logout
4. efecto real de RLS según credenciales/modelo de acceso

### Output esperado

* smoke tests críticos ejecutados o preparados con evidencia
* clasificación más precisa de riesgos abiertos
* gates runtime mínimos listos antes de CODE sensible

### Bloqueantes

* entorno no disponible
* datos de prueba insuficientes
* falta de criterio explícito para comportamiento esperado en logout o riesgo aceptado

### Docs a actualizar al cerrar

* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Qué puede romperse

* nada de implementación; sí puede revelar bloqueos reales

### Requiere validación

* si no hay entorno o datos de prueba suficientes, el bloqueo debe quedar documentado

---

## F3 — CODE de observabilidad y guardrails

**Tipo:** CODE
**Objetivo:** mejorar trazabilidad y capacidad de diagnóstico antes de tocar áreas más riesgosas.

### Input documental

* `BASELINE_FUNCIONAL_V1.md`
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Alcance

* unificación documental/técnica del uso de `requestId`
* mejora del middleware de error respecto a `console.error`
* activación mínima de Sentry panel
* guardrails de logging sin romper contratos

### Output esperado

* mejor trazabilidad mínima en backend/panel
* menor ceguera operativa antes de tocar bloques sensibles
* smoke tests del bloque sin regresión visible

### Bloqueantes

* política mínima de logging/PII no definida
* smoke tests críticos del bloque no preparados
* evidencia insuficiente de los puntos actuales de observabilidad

### Docs a actualizar al cerrar

* `BASELINE_FUNCIONAL_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Qué no debe mezclarse aquí

* refactor estructural grande
* cambios de RLS
* hardening del endpoint público

### Qué puede romperse

* logging
* diagnóstico
* inicialización de observabilidad
* no debería romper contratos funcionales si se mantiene aditivo

### Criterio de salida

* trazabilidad mínima mejorada
* sin regresiones visibles en auth/check-in/export/B2C

### Nota operativa

**El primer bloque CODE recomendable es F3 — observabilidad y guardrails, siempre que los prerequisitos documentales y de validación mínima definidos en F0/F1/F2 estén cerrados para este bloque.**

---

## F4 — CODE de hardening aditivo del flujo público B2C

**Tipo:** CODE
**Objetivo:** endurecer el flujo público B2C existente en código sin romper `MisEntradas`, tratándolo como superficie potencialmente reexponible y previo al relanzamiento mientras el estado de exposición pública actual siga en `Requiere validación`.

### Input documental

* `CONTRATOS_CONGELADOS_V1.md`
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Alcance

* hardening compatible de `/public/orders?email`
* compatibilidad explícita con `MisEntradas`
* tratamiento aditivo del riesgo de `checkin_token`
* revisión/hardening del popup de mapa solo si la trazabilidad y runtime ya están suficientemente validados

### Output esperado

* reducción de exposición técnica antes de reexposición o relanzamiento
* compatibilidad mantenida con `MisEntradas`
* documentación actualizada del estado del riesgo

### Bloqueantes

* estado de exposición pública actual del B2C sin confirmar en dominio/deploy final
* abuso real del endpoint y exposición operativa exacta del bloque siguen en `Requiere validación`
* cualquier hardening del bloque debe preservar `MisEntradas` y no asumir relanzamiento ya confirmado

### Docs a actualizar al cerrar

* `CONTRATOS_CONGELADOS_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
* `BASELINE_FUNCIONAL_V1.md` si cambia el baseline observable

### Qué no debe mezclarse aquí

* login B2C nuevo
* cambios grandes de UI
* refactor estructural del backend panel
* RLS

### Qué puede romperse

* recuperación de entradas por email
* visualización de QR/token
* popup del mapa

### Criterio de salida

* el flujo actual sigue funcionando
* el hardening no rompe el contrato consumido por B2C
* los riesgos tratados quedan documentados con before/after

---

## F5A — CODE de reservas + auth/logout

**Tipo:** CODE
**Objetivo:** estabilizar reservas panel y comportamiento auth/logout sin tocar check-in/export en esta fase.

### Input documental

* `CONTRATOS_CONGELADOS_V1.md`
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Alcance

* reservas panel
* filtros/límites del flujo de reservas
* auth panel en rutas críticas del bloque
* logout solo si su validación runtime confirma ajuste necesario

### Output esperado

* mejoras del bloque implementadas sin regresión visible en reservas y auth/logout
* rollback más simple que en una fase combinada con check-in/export

### Bloqueantes

* contrato actual de reservas todavía no congelado
* comportamiento esperado de logout no definido
* smoke tests del bloque no listos
* cobertura exacta de auth panel todavía abierta

### Docs a actualizar al cerrar

* `CONTRATOS_CONGELADOS_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
* `BASELINE_FUNCIONAL_V1.md` si cambia comportamiento observable

### Qué no debe mezclarse aquí

* check-in
* export CSV
* refactor estructural `panel.ts`
* RLS

### Qué puede romperse

* reservas visibles
* filtros/orden
* acceso a rutas protegidas del panel
* logout si se toca sin criterio claro

### Criterio de salida

* no hay regresión bloqueante en reservas/auth/logout
* smoke tests del bloque pasan o quedan triageados explícitamente

---

## F5B — CODE de check-in + export CSV

**Tipo:** CODE
**Objetivo:** estabilizar check-in y export CSV como flujos operativos delicados, sin mezclar reservas/auth.

### Input documental

* contratos del bloque ya ampliados desde F1
* validaciones runtime mínimas desde F2
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Alcance

* check-in panel
* export CSV
* manejo de estados, errores y edge cases del bloque según contrato vigente

### Output esperado

* comportamiento del check-in/export más estable y mejor definido
* menor riesgo de regresión cruzada respecto de reservas/auth

### Bloqueantes

* contrato completo de check-in aún abierto
* contrato completo de export aún abierto
* smoke tests del bloque no definidos o no ejecutados
* auth del bloque no suficientemente validada

### Docs a actualizar al cerrar

* `CONTRATOS_CONGELADOS_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
* `BASELINE_FUNCIONAL_V1.md` si cambia comportamiento observable

### Qué no debe mezclarse aquí

* reservas panel
* logout/auth general
* refactor estructural `panel.ts`
* RLS

### Qué puede romperse

* check-in operativo
* clasificación de estados
* descarga/export
* acceso del bloque si depende de auth no validada

### Criterio de salida

* no hay regresión bloqueante en check-in/export
* smoke tests del bloque pasan o quedan triageados explícitamente

---

## F6 — CODE de refactor estructural `panel.ts`

**Tipo:** CODE
**Objetivo:** reducir acoplamiento estructural sin cambiar contratos externos.

### Input documental

* riesgos críticos abiertos
* contratos del panel ya congelados
* smoke tests del panel vigentes

### Alcance

* descomposición progresiva por dominios
* preservación de rutas/contratos
* preservación de middleware de auth/rol
* regresión controlada endpoint por endpoint

### Output esperado

* menor acoplamiento estructural
* mejor mantenibilidad
* contratos externos preservados

### Bloqueantes

* contratos críticos del panel todavía incompletos
* smoke tests del panel insuficientes
* observabilidad mínima no disponible
* estabilidad insuficiente del bloque panel en F5A/F5B

### Docs a actualizar al cerrar

* `BASELINE_FUNCIONAL_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

### Qué no debe mezclarse aquí

* RLS
* hardening del endpoint público
* cambios funcionales grandes

### Qué puede romperse

* rutas panel
* auth/roles
* check-in/export/reservas por regresión cruzada

### Criterio de salida

* paridad funcional suficiente
* contratos externos preservados
* smoke tests de panel sin regresión bloqueante

---

## F7 — CODE de hardening SQL / RLS

**Tipo:** CODE
**Objetivo:** cerrar la deuda de permisividad RLS con rollout controlado.

### Input documental

* matriz actor → tabla → operación congelada por tabla crítica
* reconciliación entre `schema.sql`, migraciones observadas y tablas/columnas usadas en runtime
* validación runtime del modelo observable de acceso y de la semántica efectiva por credencial
* clasificación vigente de riesgos RLS

### Alcance

* endurecimiento progresivo de policies sobre el SQL observado ya reconciliado
* validación por tabla/actor/operación
* rollback claro por etapa

### Output esperado

* policies más cerradas que el baseline actual
* validación por etapas
* rollback documentado

### Bloqueantes

* matriz de acceso todavía incompleta
* drift no reconciliado entre `schema.sql`, migraciones y runtime
* semántica efectiva de `SUPABASE_SERVICE_ROLE` o esquema real no validados
* impacto real del modelo actual no validado
* refactor estructural en curso
* smoke tests insuficientes por actor/flujo

### Docs a actualizar al cerrar

* `CONTRATOS_CONGELADOS_V1.md` si afecta contratos observables
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`
* `BASELINE_FUNCIONAL_V1.md`

### Qué no debe mezclarse aquí

* refactor estructural de `panel.ts`
* cambios grandes de contratos de aplicación
* múltiples capas sensibles al mismo tiempo

### Qué puede romperse

* lecturas/escrituras panel
* flujos B2C
* acceso por actor/credencial
* operaciones hoy toleradas por policies permisivas

### Superficies de alto cuidado

* `orders`
* `reservations`
* `locals`
* `local_daily_ops`
* `panel_users`
* `ticket_types`
* `table_types`

### Criterio de salida

* policies endurecidas con rollback documentado
* sin regresión bloqueante por actor/tabla crítica
* runtime validado después de cada etapa

---

## F8 — CODE de pendientes no bloqueantes y cierre documental

**Tipo:** CODE + docs
**Objetivo:** resolver lo no crítico y cerrar la capa documental post-hardening.

### Input documental

* roadmap ejecutado hasta F7
* estado vigente de riesgos
* smoke tests actualizados

### Alcance

* `/panel/metrics`
* ajustes documentales pendientes
* actualización de estados de riesgo
* cierre de fases ASK/CODE ejecutadas

### Output esperado

* pendientes no críticos resueltos o clasificados
* docs post-hardening consistentes
* cierre documental del ciclo ejecutado

### Bloqueantes

* fases críticas previas no cerradas
* smoke tests desactualizados
* estados de riesgos no reflejados documentalmente

### Docs a actualizar al cerrar

* todos los docs v1 que hayan cambiado de estado
* `HARDENING_ROADMAP.md` si se consolida una nueva versión
* cualquier tablero de estado operativo si existe

### Qué puede romperse

* navegación o semántica menor si se toca `/panel/metrics`
* consistencia documental si no se sincronizan los docs

### Criterio de salida

* docs actualizados
* pendientes no críticos clasificados o resueltos
* roadmap histórico consistente con lo ejecutado

---

## 11) Gates mínimos antes de cualquier CODE sensible

Antes de iniciar **F4**, **F5A**, **F5B**, **F6** o **F7**, deben cumplirse como mínimo:

* contratos suficientemente congelados del bloque afectado
* smoke tests definidos y vigentes
* riesgos del bloque clasificados
* validaciones runtime mínimas hechas cuando el código no alcanza
* checklist explícito de no-breaking del flujo afectado

---

## 12) Bloques especialmente sensibles

### 12.1 `/public/orders?email` + `MisEntradas`

Existe riesgo aceptado por negocio y superficie técnica potencialmente reexponible. El estado de exposición pública productiva actual queda en `Requiere validación` hasta confirmar dominio/deploy final.

### 12.2 Reservas panel

El riesgo técnico está confirmado en código, pero la severidad real depende del uso.

### 12.3 Check-in y export

Son flujos críticos operativos del panel y todavía requieren congelamiento contractual fino.

### 12.4 `panel.ts`

Es riesgo estructural confirmado y cualquier cambio puede tener regresión cruzada.

### 12.5 RLS

La permisividad está confirmada en código, pero el impacto real requiere modelo de acceso validado.

---

## 13) Qué no autoriza este roadmap

Este documento no autoriza por sí solo:

* implementación inmediata sin ASK previo del bloque sensible
* romper contratos en fases tempranas
* mezclar refactor estructural con RLS
* tratar riesgos “aceptados” como riesgos “cerrados”
* asumir que un flujo está seguro solo porque existe en código

---

## 14) Regla de uso del documento

Este roadmap debe leerse **después** de:

* `CONTRATOS_CONGELADOS_V1.md`
* `BASELINE_FUNCIONAL_V1.md`
* `MATRIZ_VALIDACION_PREVIA_V1.md`
* `SMOKE_TESTS_V1.md`
* `RIESGOS_ACEPTADOS_Y_PENDIENTES.md`

Este documento existe para ordenar la ejecución.
No reemplaza la evidencia, no reemplaza los contratos, y no reemplaza la validación.

---

## 15) Siguiente paso recomendado

Una vez cerrado este roadmap:

1. elegir el **primer ASK específico** del bloque a ejecutar
2. validar que sus prerequisitos documentales estén realmente cerrados
3. recién después abrir el **primer CODE** del roadmap

La opción más segura, según la evidencia documental actual, es empezar por:

* **F1 — ASK de extracción contractual adicional**

y, una vez cerrados los prerequisitos mínimos correspondientes:

* **F3 — CODE de observabilidad y guardrails**
