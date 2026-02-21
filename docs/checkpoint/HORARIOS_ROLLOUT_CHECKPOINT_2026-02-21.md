# Horarios Rollout Checkpoint (Etapas 0–4 + subetapas B2C)
Status: Implementado y validado (checkpoint)
Fecha: 2026-02-21
Scope: DB + Backend API + Panel + B2C + Hard-stop backend
Referencia de contrato: `docs/contracts/local-opening-hours.md`

## 1) Propósito de este checkpoint

Este documento registra el **estado real implementado** del rollout de horarios (`opening_hours`) en Tairet, incluyendo:

- qué quedó cerrado (Etapas 0–4)
- qué subetapas B2C/UX se agregaron y cerraron
- contratos/API que ya están activos
- compatibilidad legacy preservada
- pendientes priorizados para continuar

> Nota: el archivo `docs/contracts/local-opening-hours.md` sigue siendo el documento de diseño/contrato.  
> Este checkpoint es el complemento operativo (implementación + QA + backlog).

---

## 2) Resumen ejecutivo

### ✅ Cerrado
- Etapa 0 — reconciliación base + utilidades de horarios
- Etapa 1 — API dual (`today_hours/is_open_today` + `opening_hours/hours`)
- Etapa 2 — panel con editor semanal estructurado de horarios
- Etapa 3 — adopción B2C (cards/detalle/calendarios) + consistencia “Hoy”
- Etapa 4A — hard-stop backend en `POST /reservations`
- Etapa 4B — hard-stop backend en `POST /orders`

### ✅ Subetapas B2C/UX cerradas
- Punto 2A — reserva bar: bloqueo por día cerrado (calendario + submit defensivo)
- Punto 2B — submit defensivo por hora fuera de rango
- Punto 2C — UX horario: selector solo muestra horas válidas por fecha
- Punto 2D — slots dinámicos por `opening_hours` + filtro “desde ahora” (Asunción)
- Punto 2D1 — fix calendario “hoy” (comparación por fecha en Asunción, no `new Date()` directo)

### ⚠️ Pendientes (post-rollout horarios)
- Cap de Free Pass (máx 1) en carrito + localStorage
- UI del panel de horarios (polish visual)
- UI del calendario de reservas (polish visual de selección)
- “Próximamente” / badges (Rooftop + pagos) polish
- Promociones con **feature real** (card con imagen + click al perfil)
- Lector QR (rework final, quedó revertido previamente)

---

## 3) Estado implementado por etapa

## Etapa 0 — Drift reconciliation + utilidades base
### Resultado
- Se alineó el trabajo de horarios con un contrato canónico y utilidades backend reutilizables.
- Se establecieron reglas de:
  - timezone `America/Asuncion`
  - cutoff operativo 06:00
  - soporte overnight
  - compatibilidad legacy

### Estado
✅ Cerrado

---

## Etapa 1 — API dual (nuevo contrato sin romper legacy)
### Resultado
- `/public/locals` expone estado liviano de “Hoy”:
  - `is_open_today`
  - `today_hours`
  - `operational_date` (debug funcional)
- `/public/locals/by-slug/:slug` expone:
  - `opening_hours` (modelo estructurado)
  - `hours` (legacy/compat)
- Se unificó la lógica de cálculo de “Hoy” en backend para evitar divergencias.

### Estado
✅ Cerrado

---

## Etapa 2 — Panel editor estructurado por día
### Resultado
- Panel B2B usa editor semanal estructurado (`closed + ranges`) como fuente primaria.
- Se mantiene vista/preview legacy derivada (`hours`) para compatibilidad.
- Se soportan rangos múltiples y overnight.
- La UI actual es funcional, pero quedó pendiente polish visual.

### Estado
✅ Cerrado (funcional)  
🟡 Pendiente: mejora visual/UI del editor (sin tocar lógica)

---

## Etapa 3 — Adopción B2C
### Resultado
- Cards/listados y detalle quedaron consistentes con la misma verdad de “Hoy”.
- Perfil B2C usa `opening_hours` (con fallback legacy cuando aplica).
- B2C adoptó lógica reutilizable para horarios (hook/helper), evitando duplicaciones.

### Subetapas cerradas
#### Punto 1 — Consistencia “Hoy” (card vs detalle)
- Se alineó backend list + detail
- Se validó caso abierto y caso cerrado
- Se mantuvo compatibilidad legacy

✅ Cerrado

#### Punto 2A — Reserva bar: día cerrado (calendario + submit)
- `ReservaForm` bloquea días cerrados en calendario
- submit defensivo si fecha cerrada
- hook reutilizable compartido con `CheckoutBase`

✅ Cerrado

#### Punto 2B — Validación de hora en submit
- submit bloquea hora fuera de rango del local
- soporta múltiples rangos + overnight (vía helper)
- fallback seguro con `opening_hours` ausente/inválido

✅ Cerrado

#### Punto 2C — UX del selector de hora
- selector de hora muestra solo horarios válidos para la fecha elegida
- si cambia fecha y la hora anterior queda inválida, se limpia automáticamente con aviso
- se mantiene submit defensivo de 2B

✅ Cerrado

#### Punto 2D — Slots dinámicos + “desde ahora”
- slots generados dinámicamente desde `opening_hours` (paso 30 min)
- filtro “desde ahora” para fecha actual en `America/Asuncion`
- fallback legacy seguro

✅ Cerrado

#### Punto 2D1 — Fix de “hoy” en calendario
- se corrigió comparación de fechas pasadas (Asunción) para que “hoy” sea seleccionable
- helper reusable para comparación de fecha calendario en Asunción

✅ Cerrado

### Estado general Etapa 3
✅ Cerrado

---

## Etapa 4 — Hard-stop backend (reservations/orders)

## Etapa 4A — `POST /reservations`
### Resultado
- Se agregó hard-stop server-side por día cerrado:
  - `opening_hours` + override `local_daily_ops`
  - respuesta `409` con `code: "LOCAL_CLOSED_DAY"`
- Compatibilidad legacy preservada:
  - si `opening_hours` es null/inválido, no bloquea por horario
  - override de cierre sí bloquea
- Se mantuvo flujo de email en casos exitosos

### Estado
✅ Cerrado (QA manual completo validado)

---

## Etapa 4B — `POST /orders`
### Resultado
- Se agregó hard-stop server-side por día cerrado:
  - usa `intended_date` si existe (flujo club)
  - si no existe, usa `computeOperationalDate(now)`
- Override diario con precedencia (`local_daily_ops.is_open=false`)
- Compatibilidad legacy preservada (`opening_hours=null` no bloquea por sí solo)
- No se mezcló con `reservations.ts`

### Estado
✅ Cerrado (QA manual completo validado)

---

## 4) Contratos/API activos (estado real)

## Backend público
### `GET /public/locals`
Activo y usado para listados/cards:
- `is_open_today`
- `today_hours`
- `operational_date` (debug funcional)

### `GET /public/locals/by-slug/:slug`
Activo y usado para detalle:
- `opening_hours` (modelo estructurado)
- `hours` (legacy)
- también `is_open_today`, `today_hours`, `operational_date` para consistencia “Hoy”

---

## Backend transaccional
### `POST /reservations`
Hard-stop activo:
- `409` + `LOCAL_CLOSED_DAY` si el local está cerrado ese día operativo
- compat mode legacy si no hay `opening_hours`

### `POST /orders`
Hard-stop activo:
- `409` + `LOCAL_CLOSED_DAY` si el local está cerrado
- soporta rama con `intended_date` y sin `intended_date`
- compat mode legacy si no hay `opening_hours`

---

## 5) Compatibilidad legacy preservada

### `hours: string[]`
- Se mantiene como representación legacy/compat
- Sigue funcionando en locales sin `opening_hours`
- No bloquea flujo por falso negativo en backend

### `opening_hours` ausente o inválido
- Frontend no crashea (fallback)
- Backend no bloquea por horario (compat mode)
- Override diario de cierre (`local_daily_ops.is_open=false`) sí bloquea

---

## 6) Decisiones de producto/alcance cerradas en este checkpoint

### Confirmadas
- Timezone canónica: `America/Asuncion`
- Cutoff operativo: `06:00`
- Override diario v1:
  - `is_open=false` cierra
  - `is_open=true` no abre excepcionalmente (v1)
- Hard-stop backend mínimo obligatorio:
  - por día cerrado
  - validación de hora solo donde el flujo ya trae hora explícita
- Reservas:
  - se descartó por ahora la regla “acepta reservas hasta X hora antes del cierre” (fuera de scope MVP actual)

---

## 7) Pendientes priorizados (siguiente roadmap)

## Punto-5A-FreePass-CartLimit (BUG funcional)
**Objetivo**
- Free Pass no debe permitir cantidad > 1 (ni en UI ni en estado persistido)

**Incluye**
- regla central en carrito/contexto
- guardas UI
- normalización de carrito al hidratar desde localStorage
- evitar que quede `qty > 1` por datos viejos

**Prioridad**
🔴 Alta

--- 5A — Free Pass máx 1 en carrito ✅ (regla centralizada en CartContext, saneo de localStorage, smoke OK)

## Punto-5B-Panel-Horarios-UI-Polish
**Objetivo**
- Mejorar visual del editor nuevo de horarios en panel (sin tocar lógica/contratos)

**Incluye**
- spacing/jerarquía visual por día
- compactación de filas
- botones/acciones más claros
- preview legacy derivado más liviano visualmente

**Prioridad**
🟡 Media

---

## Punto-5C-ReservaForm-Calendar-UI-Polish
**Objetivo**
- Mejorar UX visual del calendario (selección/estados), manteniendo la lógica actual

**Incluye**
- bajar peso visual de preselección
- diferenciar mejor hoy / seleccionado / cerrado / disabled
- no tocar validación funcional ya cerrada

**Prioridad**
🟡 Media

---

## Punto-5D-B2C-Badges-Proximamente (UI)
**Objetivo**
- Unificar y mejorar badges “Próximamente”

**Incluye**
- agregar “Próximamente” a Rooftop
- mejorar UI del badge “Próximamente pagos”
- (opcional) usar también badge temporal en Promociones mientras se implementa el feature real

**Prioridad**
🟡 Media

---

## Punto-5E-B2C-Promociones-Images-MVP (FEATURE real)
**Objetivo**
- Mostrar cards de promociones con imagen y click al perfil del local

**Definición acordada**
- Card con foto promocional
- Al click -> navega al perfil del local
- Esto se trata como feature separado (no solo badge/UI)

**Pendiente de definición técnica (en próximo scope)**
- fuente de imágenes (panel/DB/manual)
- estructura mínima de promo
- orden/prioridad y fallback
- vencimiento/visibilidad (si aplica en MVP)

**Prioridad**
🟠 Media-Alta (según foco comercial)

---

## Etapa-QR-Reader-Rework (último bloque)
**Objetivo**
- Rehacer el lector QR con enfoque estable (se había revertido una versión previa por fallas)

**Motivo de dejarlo al final**
- scope sensible (cámara, permisos, UX, flujo check-in)
- conviene entrar con hilo dedicado y sin mezclar con polishs/UI

**Prioridad**
🔵 Último de esta tanda

---

## 8) Riesgos conocidos (post-checkpoint)

- El editor de horarios del panel está funcional pero visualmente pesado.
- Las promociones todavía no tienen feature real de cards con imagen (si no se hace el Punto-5E, quedarán con badge temporal).
- El lector QR sigue pendiente de rework dedicado.

---

## 9) Criterio para reabrir este checkpoint

Reabrir este checkpoint solo si:
- se cambia el contrato de `opening_hours` (estructura JSON / timezone / cutoff)
- cambia la precedencia de `local_daily_ops`
- se agrega validación horaria server-side nueva para `orders/reservations`
- se depreca `hours` legacy definitivamente

Si no ocurre nada de eso, el avance siguiente va en checkpoints nuevos (bloque 5 / QR).

---

## 10) Próximo paso recomendado (inmediato)

1. **Punto-5A-FreePass-CartLimit** (bug funcional + localStorage)
2. **Punto-5B / 5C / 5D** (polishs UI)
3. **Punto-5E-Promociones-Images-MVP** (feature real)
4. **Etapa-QR-Reader-Rework** (hilo dedicado)