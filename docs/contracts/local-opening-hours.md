“Implementación validada: ver docs/checkpoints/HORARIOS_ROLLOUT_CHECKPOINT_2026-02-21.md”.

# Local Opening Hours Contract (Mediano Plazo)

Status: Draft (FASE 1 ASK)  
Scope: DB + Backend API + Panel + B2C  
Timezone canonica: `America/Asuncion`  
Version: `v1`

## 1) Objetivo

Definir una unica fuente de verdad para horarios de locales y eliminar divergencias entre:

- fixtures/mocks de B2C (`schedule: string`)
- `hours: string[]` legacy de API/by-slug
- editor texto libre del Panel

Este contrato establece:

- modelo estructurado de horarios semanales (`opening_hours`)
- reglas de interpretacion (incluyendo overnight)
- compatibilidad temporal con `hours: string[]`
- precedencia con `local_daily_ops`
- payloads API durante migracion
- reglas de validacion de compra/reserva

## 2) Definiciones canonicas

### 2.1 Dia operativo

- Zona horaria obligatoria: `America/Asuncion`.
- Cutoff operativo: `06:00`.
- Regla:
  - si hora local `< 06:00`, el dia operativo es el dia calendario anterior.
  - si hora local `>= 06:00`, el dia operativo es el dia calendario actual.

Ejemplo:

- `2026-02-20 01:30` Asuncion -> dia operativo `2026-02-19`.
- `2026-02-20 10:00` Asuncion -> dia operativo `2026-02-20`.

### 2.2 Formato de visualizacion

Formato UI final: `HH:mm-HH:mm hs` (24h, minutos siempre, sufijo `hs` al final del rango).

### 2.3 Relacion `intended_date` vs uso real (check-in/reserva)

- `intended_date` representa la **fecha operativa** para compra/reserva en B2C.
- La validacion backend de apertura/cierre se hace contra ese dia operativo en `America/Asuncion`.
- `used_at` (check-in real) se conserva como timestamp real de evento y no reemplaza `intended_date`.
- Si una entrada fue comprada para un `intended_date` valido, el check-in posterior mantiene las reglas de ventana ya existentes (no se redefine en este contrato).

## 3) Modelo de datos propuesto (`locals.opening_hours`)

Campo nuevo propuesto en `public.locals`:

- `opening_hours JSONB NULL`

Estructura:

```json
{
  "version": 1,
  "timezone": "America/Asuncion",
  "days": {
    "mon": { "closed": true, "ranges": [] },
    "tue": { "closed": false, "ranges": [{ "start": "18:00", "end": "23:30" }] },
    "wed": { "closed": false, "ranges": [{ "start": "18:00", "end": "23:30" }] },
    "thu": { "closed": false, "ranges": [{ "start": "18:00", "end": "23:30" }] },
    "fri": { "closed": false, "ranges": [{ "start": "23:00", "end": "06:00" }] },
    "sat": { "closed": false, "ranges": [{ "start": "23:00", "end": "06:00" }] },
    "sun": { "closed": true, "ranges": [] }
  }
}
```

Reglas:

- `days` debe incluir `mon,tue,wed,thu,fri,sat,sun`.
- `closed=true` implica `ranges=[]`.
- `ranges` permite multiples tramos por dia (MVP soportado).
- Cada `start/end` es `HH:mm` 24h.

## 4) Reglas de interpretacion

### 4.1 Overnight (cruce de medianoche)

Si `end < start`, el rango cruza medianoche al dia siguiente.

Ejemplo:

- `23:00-06:00` en `fri` cubre:
  - viernes 23:00..23:59
  - sabado 00:00..05:59 (en la misma noche operativa de viernes)

### 4.2 Evaluacion de apertura por dia (MVP hard-stop)

Decisiones fijadas para este plan:

1. Hard-stop backend obligatorio por **dia cerrado**.
2. Bloqueo por hora solo si la entidad ya maneja hora en su payload/flujo.
3. Si no hay hora, no inventar validacion horaria adicional.

## 5) Compatibilidad legacy (`hours: string[]`)

`hours: string[]` se mantiene durante transicion y se deriva de `opening_hours`.

Derivacion sugerida:

- una linea por dia o grupo de dias segun misma configuracion
- usar formato `HH:mm-HH:mm hs`
- para cerrado: `Dom: Cerrado`

`hours` deja de ser editable como fuente primaria y pasa a ser representacion derivada/compat.

## 6) Precedencia con `local_daily_ops` (v1)

### 6.1 Regla de precedencia (MVP)

1. Base semanal: `locals.opening_hours`.
2. Override diario v1 (`local_daily_ops.is_open`) solo puede **cerrar**:
   - `is_open=false` -> cerrado forzado ese dia.
   - `is_open=true` no abre excepcionalmente un dia cerrado (sin rangos override en v1).

Matriz de precedencia v1:

- Semanal abierto + override ausente -> abierto.
- Semanal abierto + `is_open=false` -> cerrado.
- Semanal cerrado + override ausente -> cerrado.
- Semanal cerrado + `is_open=true` -> cerrado (v1 no habilita aperturas excepcionales).

### 6.2 v2 (fuera de scope)

Abrir excepcionalmente o definir horarios especiales por fecha requerira campos nuevos
(por ejemplo `override_ranges`) y nuevo contrato.

## 7) Contratos API propuestos (no breaking)

## 7.1 `GET /public/locals` (cards/listados, payload liviano)

Mantener campos actuales y agregar:

- `is_open_today: boolean | null`
- `today_hours: string | null` (ej: `18:00-23:00 hs` o `Cerrado`)
- opcional `operational_date: "YYYY-MM-DD"` para debug funcional

No incluir `opening_hours` completo en este endpoint por peso.

## 7.2 `GET /public/locals/by-slug/:slug`

Mantener campos actuales y agregar:

- `opening_hours: OpeningHoursV1 | null` (completo)
- `hours: string[]` (legacy durante migracion)

## 7.3 Panel `/panel/local` GET/PATCH

- GET: incluir `opening_hours` y `hours`.
- PATCH: aceptar `opening_hours` como fuente primaria.
- `hours` se mantiene por compatibilidad de clientes legacy.

## 8) Validacion backend (orders/reservations)

### 8.1 Orders (con `intended_date`)

- Rechazar cuando el local este cerrado en el dia operativo correspondiente.
- Mantener validaciones existentes de rango (`min/max`) y sumar regla de apertura.
- La validacion minima obligatoria en MVP es por **dia cerrado**.
- Validacion por hora solo cuando el flujo tenga hora explicita (no inferir hora faltante).

### 8.2 Reservations

- Rechazar por dia cerrado usando fecha/hora solicitada en timezone Asuncion.
- Si el flujo no dispone de hora utilizable, validar solo por dia.

## 9) Errores estandarizados propuestos

Respuesta sugerida:

```json
{
  "error": "LOCAL_CLOSED_DAY",
  "message": "El local no opera en la fecha seleccionada",
  "timezone": "America/Asuncion",
  "operational_date": "2026-02-20"
}
```

Codigos:

- `LOCAL_CLOSED_DAY`
- `LOCAL_CLOSED_TIME` (solo cuando aplique validacion horaria real)
- `SCHEDULE_UNAVAILABLE` (fallback controlado si falta configuracion)

## 10) Ejemplos de comportamiento esperado

### Ejemplo A: Dia normal abierto

Input:

- dia operativo martes
- `opening_hours.days.tue = 18:00-23:00`
- sin override diario

Output:

- `is_open_today=true`
- `today_hours="18:00-23:00 hs"`
- compra/reserva permitida por dia

### Ejemplo B: Overnight

Input:

- viernes `23:00-06:00`
- solicitud sabado 01:30 (misma noche operativa)

Output:

- considerado dentro de la ventana overnight de viernes
- no marcar cerrado por dia si cae dentro de esa noche operativa

### Ejemplo C: Override de cierre

Input:

- semanal viernes abierto
- `local_daily_ops(day=viernes).is_open=false`

Output:

- cerrado forzado
- `is_open_today=false`, `today_hours="Cerrado"`
- backend rechaza con `LOCAL_CLOSED_DAY`

## 11) Deprecacion y salida de transicion

- Fase dual: coexisten `opening_hours` + `hours`.
- Se eliminan fixtures de horarios en B2C listados una vez que `GET /public/locals` entregue `today_hours/is_open_today`.
- Criterio de deprecacion de `hours`:
  - panel usa editor estructurado
  - B2C no consume fixtures para horario
  - backend valida apertura con `opening_hours`

## 12) Notas de implementacion (no runtime en esta fase)

- Este documento define contrato y etapas; no implica cambios de codigo en esta fase.
- Cualquier cambio de schema/productivo debe iniciar con reconciliacion de drift (Etapa 0).
