# Activity Actor Label Plan

## 1. Proposito

Este documento define el plan para mejorar el actor visible en el historial operativo por registro de Tairet.

El objetivo es pasar de labels genericos como `Staff`, `Owner`, `Cliente` o `Sistema` a labels mas utiles cuando la accion viene del panel, por ejemplo `Staff Martin` o `Owner Ana`, sin exponer datos sensibles, IDs internos ni emails.

Este documento no implementa cambios. Define el camino recomendado para un CODE posterior.

## 2. Problema operativo

El activity log operativo ya permite ver que paso con una entrada o reserva, pero el actor panel se muestra de forma generica.

Eso alcanza cuando hay un solo operador. No alcanza cuando varios staff operan al mismo tiempo y el local necesita responder:

- quien valido esta entrada;
- quien confirmo esta reserva;
- quien cancelo esta reserva;
- quien actualizo la nota interna.

El label debe ser util para operacion, pero no debe convertir el activity log en CRM, reporte por staff ni auditoria completa.

## 3. Estado actual detectado

Backend/auth:

- `panelAuth` resuelve `panel_users` por `auth_user_id`;
- `req.panelUser` expone `userId`, `email`, `localId` y `role`;
- `req.panelUser.userId` corresponde al usuario de Supabase Auth (`auth_user_id`), no a `panel_users.id`;
- `requireRole(["owner", "staff"])` mantiene el control de roles.

DB:

- `panel_users` hoy tiene `id`, `auth_user_id`, `email`, `local_id`, `role`, `created_at`, `updated_at`;
- no existe `display_name` en `panel_users`;
- no existe `actor_label` en `operational_activity_events`;
- `operational_activity_events` guarda `actor_user_id` y `actor_role`;
- `actor_user_id` se completa con `req.panelUser.userId` en eventos panel.

Endpoint:

- `GET /panel/activity/entity` filtra por `local_id = req.panelUser.localId`;
- no acepta `local_id` por query;
- no devuelve `actor_user_id`;
- no devuelve `local_id`;
- no devuelve email ni PII;
- devuelve `actor_type`, `actor_role`, `message`, `metadata` filtrada y `created_at`.

Frontend:

- `OperationalActivityHistory` muestra fecha/hora, `message` y actor legible;
- el actor actual se resuelve por `actor_type` y `actor_role`;
- labels actuales:
  - `Cliente`;
  - `Sistema`;
  - `Owner`;
  - `Staff`;
  - `Panel` como fallback.

## 4. Opciones evaluadas

### Opcion A - Mantener actor generico

- Mantiene `Owner`, `Staff`, `Cliente`, `Sistema`.
- No requiere cambios.
- Menor riesgo.
- Bajo valor operativo cuando existan varios staff.

Decision: no recomendada como destino, aunque sigue siendo fallback necesario.

### Opcion B - Mostrar email parcial o completo

- Podria mostrar `Staff owner.dlirio@...` o email completo.
- No requiere migracion de nombre visible.
- Expone un dato no ideal para UI operativa.
- Puede mezclar identidad de login con identidad publica/operativa.

Decision: no recomendada para MVP.

### Opcion C - Agregar `display_name` a `panel_users`

- Permite nombres operativos como `Martin`, `Ana`, `Encargado puerta`.
- Evita mostrar email.
- Requiere migracion pequena.
- Requiere definir fallback cuando no existe nombre.
- No exige gestionar usuarios completo en este bloque.

Decision: recomendada.

### Opcion D - Guardar `actor_label` en `operational_activity_events`

- Preserva como se veia el actor al momento del evento.
- Requiere definir fuente confiable del label.
- Requiere migracion adicional y politica de historico inmutable.
- Puede ser util si el nombre del staff cambia y el historico debe conservar el label original.

Decision: no recomendado como primer slice; dejar como mejora futura opcional.

### Opcion E - Resolver actor label en lectura

- Usa `actor_user_id` y `actor_role` ya guardados.
- El endpoint busca `panel_users` internamente por tenant.
- No duplica label en eventos.
- Los eventos viejos pueden mejorar automaticamente si se agrega `display_name`.
- Si cambia el nombre, el historico cambia visualmente.

Decision: recomendada en combinacion con Opcion C.

## 5. Recomendacion

Implementar primero **Opcion C + Opcion E**:

- agregar `display_name` nullable a `panel_users`;
- resolver `actor_label` en `GET /panel/activity/entity` mediante lookup interno a `panel_users`;
- usar join/logica backend por:
  - `panel_users.auth_user_id = operational_activity_events.actor_user_id`;
  - `panel_users.local_id = req.panelUser.localId`;
- devolver `actor_label: string | null`;
- no devolver `actor_user_id`, email ni `local_id`;
- frontend muestra `actor_label` si existe;
- si no existe, mantiene fallback actual por `actor_type` y `actor_role`.

Formato recomendado:

- `Staff Martin` si `actor_role = staff` y `display_name = Martin`;
- `Owner Martin` si `actor_role = owner` y `display_name = Martin`;
- `Staff` si `actor_role = staff` sin `display_name`;
- `Owner` si `actor_role = owner` sin `display_name`;
- `Cliente` para `actor_type = customer`;
- `Sistema` para `actor_type = system`;
- `Panel` como fallback.

No usar email parcial ni completo como label visible. No exponer `actor_user_id` en frontend.

## 6. Roadmap por slices

### Slice 0 - Documento/discovery

- Crear este documento.
- Cerrar decision de arquitectura.
- Mantener fuera de alcance CODE, SQL y UI en este paso.

### Slice 1 - Modelo de datos para nombre visible

- Crear migracion pequena para `panel_users.display_name text null`.
- Agregar check de longitud y trim si aplica.
- No hacer backfill desde email.
- Mantener `panel_users` backend-only como esta hoy.

### Slice 2 - Backend de lectura

- Actualizar `GET /panel/activity/entity`.
- Seleccionar `actor_user_id` internamente, sin devolverlo.
- Resolver `actor_label` por tenant contra `panel_users`.
- Devolver `actor_label: string | null`.
- Mantener metadata filtrada.
- Mantener response sin email, `local_id`, PII ni IDs internos.

### Slice 3 - UI historial

- Actualizar `OperationalActivityHistory`.
- Mostrar `actor_label` si viene.
- Mantener fallback actual si no viene.
- No mostrar email, `actor_user_id`, `local_id` ni metadata cruda.

### Slice 4 - Gestion futura de nombre visible

- Si aparece necesidad operativa, agregar edicion owner-only de `display_name`.
- No incluir gestion completa de usuarios/staff en el MVP.

### Slice futuro opcional - Snapshot `actor_label`

- Evaluar columna `actor_label` en `operational_activity_events` solo si Tairet requiere historico inmutable del label visible.
- Mantener separado del primer CODE.

## 7. Modelo de datos propuesto

Primer cambio recomendado:

```sql
alter table public.panel_users
  add column display_name text null;
```

Checks recomendados:

- permitir `null`;
- si no es `null`, exigir `char_length(trim(display_name)) > 0`;
- limitar longitud, por ejemplo 80 caracteres;
- no exigir unicidad;
- no derivar automaticamente de email.

No agregar en el primer slice:

- `actor_label` en `operational_activity_events`;
- reportes por staff;
- metricas por staff;
- export de activity.

## 8. Cambios backend propuestos

En `panelAuth`:

- no es obligatorio agregar `display_name` a `req.panelUser` para el primer objetivo, porque el label se resuelve en lectura.

En `GET /panel/activity/entity`:

- leer eventos del tenant como hoy;
- internamente conservar `actor_user_id` para resolver label;
- buscar usuarios de panel del mismo `local_id`;
- mapear `auth_user_id` -> `{ display_name, role }`;
- construir `actor_label` seguro;
- no devolver `actor_user_id`;
- no devolver email;
- no devolver `local_id`;
- mantener `items: []` para entidades sin eventos.

En `recordOperationalActivity(...)`:

- no cambiar en el primer slice;
- seguir guardando `actor_user_id` y `actor_role`;
- no guardar email ni PII.

## 9. Cambios frontend propuestos

En `apps/web-next/lib/activity.ts`:

- extender `OperationalActivityItem` con `actor_label?: string | null`.

En `OperationalActivityHistory`:

- usar `item.actor_label` si existe;
- si no existe, mantener fallback actual:
  - `Cliente`;
  - `Sistema`;
  - `Owner`;
  - `Staff`;
  - `Panel`.

No mostrar:

- email;
- `actor_user_id`;
- `local_id`;
- metadata cruda;
- PII;
- `checkin_token`;
- `table_note`;
- metodo QR/manual.

## 10. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
| --- | --- | --- |
| Exponer email como identidad visible | Filtra dato no necesario para operacion | No usar email como label; usar `display_name`. |
| Exponer `actor_user_id` | Filtra ID interno de auth | Resolver internamente y nunca devolverlo al frontend. |
| Actor de otro tenant | Mezcla de actividad entre locales | Lookup por `auth_user_id` y `local_id = req.panelUser.localId`. |
| Staff sin `display_name` | UI vuelve a label generico | Fallback a `Staff`/`Owner`. |
| Nombre cambia y afecta historico | Historico mutable visualmente | Aceptar para MVP; evaluar snapshot `actor_label` futuro si importa. |
| `display_name` mal elegido | Confusion operativa | Futuro owner-only para gestion; sin backfill automatico desde email. |
| Scope creep a reportes por staff | Aumenta superficie y privacidad | Mantener fuera de alcance reportes, export y metricas por staff. |

## 11. QA recomendado

QA por Slice 1:

- migracion aplicada en entorno controlado;
- `panel_users.display_name` existe;
- acepta `null`;
- rechaza string vacio si se agrega check;
- no cambia login panel.

QA por Slice 2:

- evento nuevo de staff con `display_name` devuelve `actor_label = Staff <nombre>`;
- evento viejo con `actor_user_id` y usuario con `display_name` resuelve label;
- evento sin `display_name` mantiene fallback;
- `Cliente` y `Sistema` no cambian;
- otro tenant no puede resolver/ver actores de otro local;
- response no expone `actor_user_id`, email, `local_id`, PII, tokens, `table_note`, `notes` ni metadata cruda;
- `GET /panel/activity/entity` sigue devolviendo eventos existentes.

QA por Slice 3:

- Historial en Entradas muestra actor label si existe;
- Historial en Reservas muestra actor label si existe;
- fallback `Owner`/`Staff` sigue funcionando;
- lazy-load sigue funcionando;
- no se cargan historiales de todas las cards;
- no hay regresion visual relevante.

Smoke transversal:

- `/health` 200;
- `x-request-id` presente;
- `GET /activity` actual sigue funcionando;
- near realtime de Entradas/Reservas no se rompe.

## 12. Fuera de alcance

Queda fuera de este bloque:

- reportes por staff;
- metricas por staff;
- export de activity;
- vista `Ultimas acciones`;
- CRM;
- auditoria completa;
- gestion completa de usuarios/staff;
- metodo QR/manual;
- `checkin_method`, `checkin_source`, `used_method`;
- paid flows;
- `/payments/callback`;
- scanner;
- validacion manual;
- near realtime;
- B2C;
- exports.

## 13. Decisiones futuras

Decisiones que pueden reabrirse despues:

- si `display_name` se gestiona desde pantalla owner-only;
- si se requiere snapshot `actor_label` persistente en cada evento;
- si se necesita diferenciar actor de creacion publica vs sistema;
- si el local necesita reportes por staff;
- si se agrega vista `Ultimas acciones`;
- si se agrega export de activity;
- si se necesita auditoria mas completa por compliance.
