## RULES — UI/UX ONLY (ULTRA STRICT) — NO romper lógica / backend

### 0) Objetivo permitido

* ✅ *Permitido:* cambiar *solo* apariencia y experiencia visual: layout, spacing, tipografía, colores, sombras, tamaños, jerarquía visual, componentes de UI, microcopy, empty states, skeletons, tooltips, iconografía.
* ✅ *Permitido:* refactor visual interno *sin cambiar el comportamiento* (extraer componentes UI, reordenar JSX, unificar estilos, crear wrappers visuales).
* ❌ *Prohibido:* modificar comportamiento de negocio, endpoints, schemas, payloads, tracking, políticas, multi-tenant, roles, queries, filtros, cálculos de métricas, lógica de fallback.

---

## 1) Contratos de datos (INTOCABLES)

### 1.1 APIs / Endpoints

* ❌ No cambiar rutas ni nombres:

  * /public/locals/by-slug/:slug (incluye promotions)
  * /public/locals/by-slug/:slug/catalog
  * /panel/catalog/* (tickets/tables)
  * /locals/:id/promos/* (GET/POST/PATCH/DELETE/reorder)
  * /metrics/club/breakdown
  * /panel/support/status, /panel/support/access
  
* ✅ Si necesitás mostrar nuevos datos en UI, *solo* consumí lo que ya existe.

### 1.2 Tipos / shape de objetos

* ❌ No cambiar interfaces que viajan por API (solo podés extender tipos localmente si no afecta runtime).
* ❌ No renombrar campos:

  * promotions, is_active, sort_order, image_url, start_date, end_date
  * items[] en orders, ticket_type_id, qty/quantity, price, kind
  * metadata en whatsapp_clicks

### 1.3 DB-first del perfil

* ❌ No tocar *gallery JSONB* ni su convención *cover/hero/kinds*.
* ❌ No tocar mapbox/token/envs.
* ❌ No tocar RLS/policies/SQL en esta etapa.

---

## 2) Lógica y estado (INTOCABLES)

### 2.1 Hooks, state y handlers

* ✅ Podés *mover* handlers a componentes hijos si:

  * Mantienen la misma firma y side-effects.
  * No cambia orden/condición de ejecución.
* ❌ No cambiar:

  * useEffect dependencias (salvo ESLint/TypeScript y sin alterar comportamiento)
  * lógica de fetch, retries, gating, fallbacks (DB-first / mocks)
  * cálculos de totals, breakdown, revenue, sorting de datos (a menos que ya existan y solo se muevan)

### 2.2 Tracking / Analytics (INTOCABLE)

* ❌ No modificar:

  * nombres de eventos (promo_open, whatsapp_click, club_table_reservation, etc.)
  * payload keys de tracking
  * dedupe/guardrails existentes
* ✅ Solo podés:

  * envolver el click en componentes UI distintos manteniendo onClick final idéntico.
  * agregar tooltips/labels sin tocar la llamada original.

### 2.3 “Delete / Toggle / Reorder”

* ❌ No cambiar validaciones (owner-only vs staff read-only).
* ✅ Podés cambiar UI (botón, modal, confirm), pero:

  * debe seguir llamando a la *misma* función (deletePromo, deleteCatalogTable, etc.)
  * debe mantener confirmación para acciones destructivas.

---

## 3) Roles y multi-tenant (INTOCABLES)

* ❌ Prohibido quitar o relajar gating:

  * staff no puede mutar (solo lectura donde aplica)
  * club-only vs bar-only (métricas breakdown club, catálogo solo clubs, etc.)
* ✅ Permitido:

  * mejorar mensajes “No tenés permisos”.
  * esconder botones si no hay permisos (ya existe), pero NO cambiar la lógica que decide permisos.

---

## 4) Reglas de UI estrictas

### 4.1 Componentes

* ✅ Usar Tailwind + shadcn/ui + lucide-react.
* ❌ No agregar nuevas dependencias (NPM) para UI.
* ✅ Reusar componentes existentes (Card, Button, Badge, Dialog, Tooltip, Skeleton, Table, Tabs).
* ✅ Podés crear componentes UI nuevos en components/shared o components/ui si son *presentacionales*.

### 4.2 Estilo

* ✅ Mantener identidad Tairet: rojo #8d1313 + negro/blanco.
* ✅ Mejorar jerarquía: títulos claros, subtítulos, spacing consistente.
* ✅ Estados:

  * Loading: Skeleton
  * Empty: mensaje + CTA (si aplica)
  * Error: mensaje + “Reintentar”
  * Success: toast (si ya existe infra) o mensaje inline (sin tocar lógica)

### 4.3 Accesibilidad

* ✅ Focus visible en inputs/botones.
* ✅ Labels para inputs (no solo placeholder).
* ✅ No usar texto muy chico (<12px) para contenido clave.

### 4.4 Responsivo

* ✅ B2C: mobile-first, desktop adaptado.
* ✅ Desktop promos: si hay carrusel, *mantener tamaño fijo de cards* para que no cambie el tamaño al pasar de grid a carrusel.
* ❌ No romper breakpoints existentes.

---

## 5) Archivos que NO se tocan en “UI-only”

* ❌ functions/api/** (backend) — salvo que explícitamente se pida.
* ❌ infra/sql/**
* ❌ schemas/** backend
* ❌ cualquier archivo que cambie payload/requests/DB
NO modificar app/panel/ salvo para reemplazar render por <View /> con props (mínimo diff).
> Solo UI: apps/web-next/** y apps/web-b2c/** (componentes/páginas/estilos).

---

## 6) Reglas de refactor (para no romper)

* ✅ Cambios en commits pequeños por pantalla (promos UI, metrics UI, calendar UI, etc.).
* ✅ “No behavioral diffs”: el output de API calls debe ser el mismo; solo cambia la presentación.
* ✅ No mover lógica a “helpers” si cambia el orden de ejecución.
* ✅ No tocar lib/api salvo que sea *solo* para mejorar tipado sin cambiar runtime.

---

## 7) Checklist obligatorio antes de finalizar cualquier PR/UI change

* ✅ pnpm -C apps/web-next typecheck
* ✅ pnpm -C apps/web-b2c typecheck
* ✅ Navegar manualmente:

  * Panel: profile, promos, calendar, metrics, support
  * B2C: BarProfile y ClubProfile (mobile + desktop)
* ✅ Verificar que:

  * botones críticos funcionan (guardar, activar, eliminar, reorder)
  * tracking sigue disparando (promo_open, whatsapp_click)
  * gating por rol no se rompió (owner vs staff)

---

## 8) “Definition of Done” UI-only

Un cambio UI se considera OK solo si:

* No cambió ningún request/payload/endpoint.
* No cambió ninguna regla de permisos.
* No cambió cálculos de métricas.
* Typecheck pasa en ambos fronts.
* Visual mejora y mantiene consistencia.

---


Si para lograr el diseño necesitás tocar lógica o backend: DETENETE y proponé alternativa UI-only.

Si necesitás un chart: usar SOLO libs ya instaladas; si no hay, hacelo con SVG simple. NO agregar recharts.