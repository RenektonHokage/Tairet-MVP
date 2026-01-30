A continuación tenés un **SOURCE OF TRUTH** (contrato) para **Perfil del local**. La idea es que esto sea la referencia única para no romper nada cuando entren Fase 2 y 3 (Entradas/Mesas).

---

# SOURCE OF TRUTH — Perfil del local (Panel ↔ DB ↔ B2C)

## 0) Objetivo

Permitir que cada local (bar/club) **autogestione** su perfil público desde `/panel/profile`, y que el B2C se alimente **DB-first con fallbacks** sin volver a hardcodear lógica crítica.

**Invariantes:**

* Multi-tenant estricto: un local solo lee/edita su `localId`.
* Roles: `owner` edita, `staff` read-only.
* No inventar campos en UI si no están conectados a DB + endpoints + types + wiring B2C.
* **Separación estricta** entre: foto de card, hero del perfil y galería.

---

## 1) Modelo de datos (DB)

### Tabla `public.locals` (campos relevantes)

**Texto / perfil:**

* `name` (TEXT)
* `address` (TEXT | null) → dirección exacta (Maps)
* `location` (TEXT | null) → **zona/barrio (visual)** (NO es la dirección)
* `city` (TEXT | null) → ciudad allowlist (para display + Maps)
* `hours` (JSONB string[] default `[]`)
* `additional_info` (JSONB string[] default `[]`)

**Contacto:**

* `phone` (TEXT | null)
* `whatsapp` (TEXT | null)

**Atributos / tags / edad:**

* `attributes` (JSONB string[] default `[]`) → max 3 allowlist por tipo
* `min_age` (SMALLINT | null) → null = todo público (sin badge)

**Galería:**

* `gallery` (JSONB default `[]`)

  * array de `LocalGalleryItem`:

    * `id: string`
    * `url: string`
    * `path: string`
    * `kind: GalleryKind`
    * `order: number`

### Alowlists (compartidas en `packages/types`)

* `BAR_SPECIALTIES` (bares)
* `CLUB_GENRES` (discotecas)
* `ZONES` (zona/barrio visual)
* `CITIES` (ciudades)
* `MIN_AGES` (edades permitidas; null = sin restricción)

> Nota de semántica:
> **location = zona visual**, **address = dirección exacta**, **city = ciudad**.
> No mezclar `location` con la lógica de destino principal de Maps.

---

## 2) Kinds de galería y reglas por tipo

### `GalleryKind` permitido

* Global: `cover`, `hero`
* Bar: `food`, `menu`, `drinks`, `interior` (+ `cover`, `hero`)
* Club: `carousel` (+ `cover`, `hero`)

### Reglas críticas

* `cover` = **Foto de perfil / Card** (listado B2C).
  **NO debe aparecer** en galería ni modales ni carruseles.
* `hero` = **Imagen principal del perfil** (dentro de BarProfile/ClubProfile).
  **NO debe “caer” en cover** automáticamente.
* `carousel` = solo discotecas (galería de club).
* Bar categories (`food/menu/drinks/interior`) pueden tener **múltiples imágenes por categoría** (orden dentro del kind).

### Límites (backend valida)

* Máx total items `gallery`: 12
* Máx 1 `cover`
* Máx 1 `hero`
* Validar `kind` según `local.type`

---

## 3) Contrato de APIs

### Panel (privado)

Archivo: `functions/api/src/routes/panel.ts`

* `GET /panel/local` (owner+staff)

  * retorna perfil del local autenticado (por `req.panelUser.localId`)
  * incluye: `name,address,location,city,hours,additional_info,phone,whatsapp,attributes,min_age,gallery`

* `PATCH /panel/local` (solo owner)

  * whitelist estricta: solo campos confirmados (los de arriba)
  * validaciones:

    * `attributes`: array strings, max 3, allowlist por tipo
    * `location`: allowlist ZONES (o null)
    * `city`: allowlist CITIES (o null)
    * `min_age`: allowlist MIN_AGES o null
    * `hours`: string[] (límites de items/longitudes)
    * `additional_info`: string[] (límites de items/longitudes)
  * nunca loguear PII

**Gallery uploads (privado)**

* Endpoints existentes en panel para:

  * signed upload (para evitar límite express json)
  * delete por `id/path`
  * (y luego patch del array `gallery` con el item agregado)

> Regla: el backend debe guardar `path` además de `url`, para borrar robusto.

### Público (B2C)

Archivo: `functions/api/src/routes/public.ts`

* `GET /public/locals`

  * listado para AllBars/AllClubs con DB-first
  * debe exponer: `id,slug,name,type,location,city,attributes,min_age,cover_url`
  * `cover_url` se extrae de `gallery.find(kind==="cover")`

* `GET /public/locals/by-slug/:slug`

  * detalle para BarProfile/ClubProfile
  * incluye: `address,location,city,hours,additional_info,phone,whatsapp,attributes,min_age,gallery`

---

## 4) B2C: puntos de consumo (wiring)

### Cards/Listado

* `apps/web-b2c/src/pages/AllBars.tsx`
* `apps/web-b2c/src/pages/AllClubs.tsx`
* `apps/web-b2c/src/components/shared/VenueCard.tsx`

**Reglas de display card:**

* Imagen: usar `cover_url` DB-first; fallback a placeholder/mocks si null.
* Tags:

  * Bar: `specialties` salen de `attributes`
  * Club: `genres` salen de `attributes`
* Edad:

  * mostrar badge solo si `min_age` es número (si null → **no mostrar**)
* Ubicación:

  * mostrar `"Zona • Ciudad"` si ambos existen
  * si solo zona, mostrar zona
  * si solo ciudad, mostrar ciudad (opcional; definido por UI)

### Perfil Bar

* `apps/web-b2c/src/pages/BarProfile.tsx`
* Helpers: `apps/web-b2c/src/lib/gallery.ts`

**Reglas:**

* Hero: usar `kind="hero"` si existe; fallback a primera imagen no-cover o mock.
  **Nunca usar cover como hero.**
* Mobile:

  * no meter cover en “galería”
  * categorías abren modal por kind (`food/menu/drinks/interior`)
* `getCategoryImages()` debe filtrar por kind (no retornar todo)

### Perfil Club

* `apps/web-b2c/src/pages/ClubProfile.tsx`
  **Reglas:**
* Hero: usar `kind="hero"` si existe; fallback a primer `carousel` o mock.
  **Nunca usar cover como hero.**
* Carrusel: usar solo `kind="carousel"`

---

## 5) Maps: “Cómo llegar”

Componente: `apps/web-b2c/src/components/shared/MapSection.tsx`

### Regla de negocio

* **Prioridad**: `address` > `venue`
* `location` y `city` son **complementos**
* siempre terminar en `"Paraguay"`
* string normalization: `trim()` + evitar vacíos → sin comas dobles.

**Casos esperados**

1. address + location + city → `address, location, city, Paraguay`
2. address + city → `address, city, Paraguay`
3. sin address → `venue, location, city, Paraguay`

---

## 6) Panel UI /panel/profile (single source)

Archivo: `apps/web-next/app/panel/(authenticated)/profile/page.tsx`

Debe cubrir:

* Datos básicos: name, address, phone, whatsapp
* Ubicación visual: zone(location allowlist), city allowlist
* Atributos: selector (max 3), allowlist por tipo
* Edad mínima: selector allowlist o “Todo público” (null)
* Galería:

  * Foto de perfil (cover) con preview card
  * Hero (hero) con preview (bar/club)
  * Bar: categorías con múltiples imágenes
  * Club: carousel ordenable
* Validaciones UX: tamaño, formato, min dimensions, warnings ratio

**Regla UX crítica:**

* Staff = todo disabled, sin acciones (upload/delete/reorder)
* Owner = editable

---

## 7) Seguridad / Tenancy

* Auth panel:

  * token válido (`supabase.auth.getSession()` en front)
  * backend valida token (`getUser()` en `panelAuth`)
  * mapping: auth_user_id → panel_users → local_id
* Cualquier mutación:

  * debe operar **solo** sobre `req.panelUser.localId`
  * nada por slug/email/inputs del cliente
* Upload/delete:

  * validación de `kind` por tipo
  * path bajo bucket esperado

---

## 8) Fallbacks permitidos (y dónde)

Permitidos SOLO en B2C:

* si `gallery` vacío → usar mocks (solo para no romper UI)
* si `cover_url` null → placeholder
* si categoría sin imágenes → fallback imagen mock de esa categoría

No permitido:

* volver a hardcodear `+18`
* usar `cover` como hero “porque no hay hero”
* usar `location` como destino principal de Maps si hay address

---

## 9) Checklist de regresión (cada vez que se toque Perfil del local)

1. Cards:

   * cover cambia → cards cambian
   * min_age null → no hay badge
   * ubicación “Zona • Ciudad”
2. BarProfile:

   * hero ≠ cover
   * mobile no incluye cover en gallery
   * categorías filtran por kind
3. ClubProfile:

   * hero ≠ cover
   * carrusel solo carousel
4. Maps:

   * con address → destino usa address
   * sin address → venue + location + city
5. Tenancy:

   * owner puede editar
   * staff no puede editar
   * local A no afecta local B
6. Upload:

   * > 100KB no falla (signed upload)
   * delete funciona por path

---

## Sugerencia

Pegá este SOURCE OF TRUTH en tu repo como `docs/SOURCE_OF_TRUTH_PROFILE.md` y **obligate** a que cualquier cambio de Fase 2/3 (entradas/mesas) declare explícitamente:

* qué columnas nuevas,
* qué endpoints,
* qué tipos,
* qué wiring B2C,
* y qué regresiones del checklist se vuelven a probar.
  Con eso evitás que “por agregar una feature” se rompa cover/hero/maps/tenancy otra vez.

  Catálogo Discotecas: Entradas y Mesas (Fase 2)
Alcance

Solo discotecas (local.type = "club")

Entradas: se muestran en B2C y luego se usarán para pagos (snapshot inmutable en orders).

Mesas: NO se venden. Solo reserva por WhatsApp. El precio es referencial.

DB

Tablas:

ticket_types

table_types

Columna snapshot:

orders.items (JSONB) = snapshot inmutable al crear la orden.

Money

ticket_types.price: BIGINT (Gs)

table_types.price: BIGINT nullable (Gs, referencial)

orders.total_amount: BIGINT (Gs)

Reglas de negocio (hard rules)

Tickets

Se pueden crear hasta 4 por local.

Se pueden tener máximo 2 activos simultáneamente.

Orden de listado: price ASC, luego sort_order ASC.

Sold-lock:

Si un ticket ya fue vendido (aparece en orders.items), entonces:

NO se puede cambiar name ni price (409).

NO se puede eliminar (409).

Sí se puede desactivar.

Mesas

Máximo 6 por local.

Orden de listado: price ASC (NULLS LAST), luego sort_order ASC.

Se pueden eliminar (hard delete) desde panel (owner).

Endpoints Panel (panel.ts) — multi-tenant

Todos filtran por req.panelUser.localId y verifican local.type === "club".

Tickets:

GET /panel/catalog/tickets (owner+staff)

POST /panel/catalog/tickets (owner)

PATCH /panel/catalog/tickets/:id (owner)

DELETE /panel/catalog/tickets/:id (owner)

Si tiene ventas → 409

Mesas:

GET /panel/catalog/tables (owner+staff)

POST /panel/catalog/tables (owner)

PATCH /panel/catalog/tables/:id (owner)

DELETE /panel/catalog/tables/:id (owner)

Hard delete (si no pertenece → 404)

Endpoint Público (public.ts)

GET /public/locals/by-slug/:slug/catalog

Devuelve solo is_active = true

Ordenado por precio ASC

Snapshot de órdenes (payments-safe)

Al crear orden, el backend arma orders.items[] como snapshot:

[{ kind:"ticket", ticket_type_id, name, price, qty }]

total_amount se calcula desde snapshot.

Cambios posteriores en ticket_types no afectan órdenes ya creadas.

UI Panel (/panel/profile) — clubs

Sección “Catálogo” visible solo para clubs.

Indicadores:

Creadas: X/4 · Activas: Y/2

Owner:

CRUD completo según reglas (incluye delete mesas y delete tickets con lock).

Staff:

Read-only.

B2C (ClubProfile)

DB-first: consume /public/locals/by-slug/:slug/catalog

Fallback a mocks si el catálogo viene vacío.

Orden extra defensivo en frontend por precio ASC para render.