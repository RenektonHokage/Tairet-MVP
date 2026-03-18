# Panel B2B — UX/Performance Roadmap

## 1. Propósito
Este documento es la fuente de verdad del roadmap operativo del frente UX/performance del panel B2B.

Su objetivo es ordenar, con alcance chico y verificable:
- mejoras de UX de espera / loading;
- slices pequeños de percepción de rendimiento;
- futuras entradas controladas a performance real / fetching;
- backlog explícito de módulos que no conviene tocar primero.

No habilita CODE por sí solo.

---

## 2. Relación con otros docs del panel
- Fuente de verdad del rediseño/UI/demo del panel:
  - `docs/panel/PANEL_DEMO_Y_CAMBIOS_RELEVANTES.md`
- Fuente de verdad del discovery UX/loading/performance y del primer slice ya ejecutado:
  - `docs/panel/PANEL_B2B_UX_LOADING_Y_PERFORMANCE.md`
- Fuente de verdad del roadmap operativo de este frente:
  - `docs/panel/PANEL_B2B_UX_PERFORMANCE_ROADMAP.md`

La separación es deliberada:
- demo/rediseño UI no debe mezclarse con roadmap técnico;
- discovery/cierre de slices no debe mezclarse con cambios visuales demo;
- roadmap no debe reescribir la evidencia ya consolidada.

---

## 3. Alcance y no-goals

### Alcance
- UX de espera del panel autenticado.
- loading states y percepción de carga.
- slices pequeños de bajo riesgo sobre pantallas no sensibles.
- evaluación posterior de performance real / fetching solo cuando el frente lo justifique.

### No-goals
- no mezclar este roadmap con hardening SQL/RLS;
- no usarlo para reabrir `F3`, `F6` o `F7`;
- no convertirlo en auditoría general del repo;
- no usar el rediseño UI como excusa para refactor técnico amplio;
- no entrar primero por `orders`, `reservations`, `check-in`, `calendar` ni `/panel/metrics`;
- no presentar performance profunda como primer paso activo.

---

## 4. Estado actual del frente
- El discovery UX/performance del panel ya quedó consolidado en `docs/panel/PANEL_B2B_UX_LOADING_Y_PERFORMANCE.md`.
- El primer slice prudente ya fue identificado y ejecutado:
  - borde de entrada del dashboard `/panel`;
  - mejora del loading inicial percibido;
  - sin tocar backend, endpoints, SQL ni módulos sensibles.
- `UX-CODE-01` queda como primer y único slice ejecutado / consolidado por ahora.
- El microfix visual posterior sobre `Visitas al perfil` no quedó consolidado y debe considerarse descartado / revertido.
- El frente sigue separado del hardening roadmap; no reemplaza los docs de `docs/audits/`.

---

## 5. Guardrails / principios de trabajo
- Priorizar menor alcance, menor superficie de cambio y máxima verificabilidad.
- Preferir primero UX de espera percibida antes que performance profunda de backend.
- Cada slice debe ser:
  - pequeño;
  - reversible;
  - visible para el usuario;
  - aislado de módulos sensibles.
- No tocar auth, fetching global ni backend salvo evidencia fuerte de que el slice sigue siendo chico y seguro.
- No abrir un slice nuevo solo porque hay incomodidad visual; debe existir mejora clara y riesgo bajo.

---

## 6. Módulos sensibles / no tocar primero
- No conviene empezar por:
  - `orders`;
  - `reservations`;
  - `check-in`;
  - `calendar`;
  - `/panel/metrics`.

### Motivos
- mayor criticidad operativa;
- mayor blast radius;
- más probabilidad de tocar contratos o fetches sensibles;
- en `/panel/metrics`, además, la capa operativa ya lo clasifica como diferido / no activo.

---

## 7. Bloques / slices del roadmap

### UX-ASK-01 — Discovery UX/performance del panel
- Estado: **cerrado**
- Resultado:
  - inventario de módulos del panel;
  - clasificación UX vs performance real;
  - identificación de módulos sensibles;
  - selección del primer slice prudente.

### UX-CODE-01 — Loading inicial del dashboard `/panel`
- Estado: **ejecutado / consolidado**
- Alcance:
  - reemplazo del peor estado textual inicial por loading visual consistente;
  - foco exclusivo en el borde de entrada del dashboard;
  - sin tocar módulos sensibles.

### UX-ASK-02 — Selección del siguiente slice chico no sensible
- Estado: **cerrado / sin CODE habilitado**
- Veredicto:
  - no existe actualmente un segundo slice chico no sensible con suficiente valor para justificar `UX-CODE-02`;
  - los candidatos débiles remanentes no superan el umbral de valor / riesgo del frente;
  - el frente debe quedar en pausa hasta nueva evidencia o nueva prioridad.

### PERF-ASK-01 — Reevaluación de performance real / fetching
- Estado: **diferido**
- Solo debe abrirse cuando:
  - ya no haya quick wins claros de UX/loading de bajo riesgo;
  - exista evidencia suficiente para justificar entrada sobre fetch patterns o coste real.

---

## 8. Primer slice prudente ya identificado
- El primer slice prudente del frente ya quedó identificado y ejecutado en el borde de entrada del dashboard `/panel`.
- Debe leerse como:
  - slice de UX/loading percibido;
  - no slice de performance profunda;
  - no refactor de `context loading` global;
  - no optimización de backend.

La fuente de verdad de ese slice es:
- `docs/panel/PANEL_B2B_UX_LOADING_Y_PERFORMANCE.md`

---

## 9. Criterio para abrir el siguiente slice
Solo corresponde abrir el siguiente slice si se cumple todo lo siguiente:
- sigue siendo un cambio chico y verificable;
- no entra por módulos sensibles;
- mejora claramente la percepción de espera o elimina fricción concreta;
- no exige tocar backend, SQL o fetching global;
- no contradice el discovery ya consolidado.

Si esas condiciones no se cumplen, el frente debe quedar en espera y no abrir CODE nuevo.

---

## 10. Estado operativo / próximo paso
- El siguiente paso correcto ya no es abrir `UX-CODE-02` ni performance profunda.
- **Después de `UX-CODE-01`, no existe actualmente un segundo slice chico no sensible con suficiente valor para justificar `UX-CODE-02`; el frente queda en pausa hasta nueva evidencia o nueva prioridad.**
- Si el frente se retoma, debe volver a abrirse desde ASK y no desde CODE directo.
