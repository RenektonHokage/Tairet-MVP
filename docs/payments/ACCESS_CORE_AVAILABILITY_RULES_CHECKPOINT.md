# Access Core Availability Rules Checkpoint

## Estado

Availability Rules backend queda cerrado hasta Fase 2B.2.
UI target queda pendiente para Fase 2B.3.

## Objetivo

Tairet ahora tiene un modelo durable para configurar disponibilidad de entradas pagas Access Core:

- reglas;
- weekdays con capacidad por noche;
- excepciones;
- materialización hacia `access_stock_limits`.

## Decisión de arquitectura

Modelo híbrido:

- `access_ticket_availability_rules`, `access_ticket_availability_rule_weekdays` y `access_ticket_availability_exceptions` son fuente durable de configuración.
- `access_stock_limits` sigue siendo el stock efectivo consumido por checkout.
- Checkout y Bancard no fueron modificados.

## Migración 042

La migración `042_access_ticket_availability_rules.sql` creó:

- `access_ticket_availability_rules`;
- `access_ticket_availability_rule_weekdays`;
- `access_ticket_availability_exceptions`.

Propósito:

- guardar reglas durables por tipo de entrada;
- guardar capacidad por weekday ISO;
- guardar excepciones por fecha de acceso;
- permitir una regla activa por ticket en esta fase;
- preparar una UI editable sin cambiar checkout.

Seguridad:

- RLS enabled en las tres tablas;
- sin policies para `anon` ni `authenticated`;
- `service_role` con permisos;
- `anon`, `authenticated` y `public` sin acceso.

## Migración 043

La migración `043_access_ticket_availability_materializer.sql` creó la RPC:

```text
public.save_access_ticket_availability(...)
```

Características:

- `SECURITY INVOKER`;
- execute solo para `service_role`;
- owner-only;
- club-only;
- Fase 2 local-only;
- valida que el ticket sea `source_type = local`, `payment_kind = paid` y `currency = PYG`;
- valida rango, weekdays, capacidades y excepciones;
- `closed` se materializa como `limited/0`;
- no reescribe fechas pasadas;
- cierra stock futuro viejo del mismo ticket si queda fuera de la nueva availability;
- materializa transaccionalmente hacia `access_stock_limits`;
- no toca checkout ni Bancard.

## Endpoints 2B.2

### GET /panel/access/config

Devuelve configuración completa para la futura UI target de Entradas.

Permisos:

- `panelAuth`;
- owner/staff.

Incluye:

- tickets locales pagados `PYG`;
- tickets activos e inactivos;
- `has_sales`;
- regla activa;
- weekdays de la regla;
- excepciones activas;
- summary con `has_rule`, `sellable_weekdays` y `exceptions_count`;
- `stock_effective` opcional con `include_stock=1`.

No incluye:

- free pass;
- tickets event;
- tickets de otro local;
- PII;
- tokens;
- QR;
- payloads de proveedor.

### PUT /panel/access/ticket-types/:id/availability

Guarda availability durable para una entrada y materializa stock efectivo vía RPC.

Permisos:

- `panelAuth`;
- owner-only.

Payload soportado:

```json
{
  "valid_from": "2026-07-01",
  "valid_to": "2026-08-31",
  "weekdays": [
    { "iso_weekday": 5, "stock_mode": "limited", "capacity": 50 },
    { "iso_weekday": 6, "stock_mode": "limited", "capacity": 80 }
  ],
  "exceptions": [
    {
      "access_date": "2026-07-12",
      "exception_mode": "limited",
      "capacity": 120,
      "reason": "Evento especial"
    },
    {
      "access_date": "2026-07-18",
      "exception_mode": "closed",
      "capacity": null,
      "reason": "Evento privado"
    }
  ]
}
```

Validaciones:

- fecha civil real `YYYY-MM-DD`;
- `valid_from <= valid_to`;
- `valid_from` no puede ser anterior a hoy en `America/Asuncion`;
- rango máximo 93 días;
- weekdays únicos entre 1 y 7;
- `limited` exige capacidad entera mayor a 0;
- `unlimited` exige capacidad `null`;
- exceptions default `[]`;
- exceptions únicas por fecha;
- exceptions dentro del rango;
- `closed` y `unlimited` exigen capacidad `null`;
- reason opcional, trim y máximo 200 caracteres.

Mapeo de errores:

- `forbidden` -> 403;
- `ticket_not_found` / `local_not_found` -> 404;
- `invalid_*` -> 400;
- `duplicate_exception_date` -> 400;
- `capacity_below_reserved` -> 409;
- `availability_materialization_failed` -> 409.

## QA runtime

Resultados:

```text
/health 200: PASS
GET /panel/access/config owner 200: PASS
GET /panel/access/config staff 200: PASS
PUT availability staff 403: PASS
PUT owner viernes limited 50 / sábado limited 80 200, materialized_count=7: PASS
PUT owner exception closed 200, closed_count=1: PASS
PUT owner exception limited 200, materialized_count=7: PASS
GET /panel/access/config?include_stock=1&from=2026-07-10&to=2026-07-31 200: PASS
GET config devuelve rule activa, weekdays, exception limited y stock_effective configurado: PASS
access-catalog público 200: PASS
panel abre correctamente: PASS
```

Observación QA:

El GET `include_stock` final refleja la última configuración enviada, que fue exception limited.
El caso `closed` fue validado antes por respuesta RPC con `closed_count=1` y luego reemplazado por el payload limited.

## No tocado

- B2C no tocado.
- Bancard no tocado.
- Checkout no tocado.
- Callback, email y QR helper no tocados.
- UI no tocada.
- Ventas por entrada no implementadas.

## Decisiones cerradas

- Una regla activa por ticket en Fase 1/Fase 2.
- Exceptions deben estar dentro del rango.
- Exceptions pueden abrir o cerrar fechas fuera de weekdays.
- `closed` bloquea nuevas ventas sin invalidar entradas ya vendidas.
- Stock futuro viejo del mismo ticket se cierra si queda fuera de la nueva availability.
- No se reescriben fechas pasadas.
- Ventas por entrada queda para Fase 2C.

## Pendiente

### Fase 2B.3 UI target Entradas

- Cards por entrada.
- Entrada seleccionada.
- Reglas de disponibilidad.
- Stock por noche.
- Excepciones.
- Desactivar con cuidado.
- Sin ventas avanzadas.

### Fase 2C

- Ventas por entrada.
- Ocupación.
- Ingresos.
- Exportación.
- Tendencia.

## Stash

El prototipo Slice 2A range quedó en stash como referencia técnica.
No debe aplicarse como producto final.
