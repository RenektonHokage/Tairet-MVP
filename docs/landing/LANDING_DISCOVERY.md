# TAIRET - Landing publica temporal - Discovery tecnico

Fecha del discovery: 2026-03-03
Repo: `tairet-mono-2`
App objetivo: `apps/web-b2c`

## Resumen

- El entrypoint real de la app publica es `apps/web-b2c/src/main.tsx`.
- La app monta `App` sobre `#root` y resuelve navegacion con `HashRouter`.
- La ruta `/` renderiza hoy `apps/web-b2c/src/pages/Index.tsx`.
- La home actual compone `Navbar`, secciones de contenido, `Footer` y `BottomNavbar` directamente, sin layout dedicado.
- La implementacion minima y reversible para la landing temporal es reemplazar la UI de `Index.tsx` o delegarla a un nuevo componente de landing, sin borrar el resto del B2C ni tocar las demas rutas.
- La evidencia visible de F7 en el working tree apunta a backend/API/SQL, no a `apps/web-b2c`. Con la evidencia disponible, la clasificacion es `Compatible en paralelo`.

## Flujo real de entrada

1. `apps/web-b2c/index.html` define el `head`, `#root` y carga `src/main.tsx`.
2. `apps/web-b2c/src/main.tsx` hace `createRoot(...).render(<App />)`.
3. `apps/web-b2c/src/App.tsx` monta providers globales, `HashRouter`, `ScrollToTop` y el arbol de rutas.
4. En `App.tsx`, `path="/"` apunta a `Index`.
5. `apps/web-b2c/src/pages/Index.tsx` renderiza la portada publica actual.

## Home actual

Archivo actual de la portada:

- `apps/web-b2c/src/pages/Index.tsx`

Wrappers y componentes globales que hoy afectan `/`:

- Providers y router en `apps/web-b2c/src/App.tsx`
- `apps/web-b2c/src/components/layout/Navbar.tsx`
- `apps/web-b2c/src/components/Footer.tsx`
- `apps/web-b2c/src/components/layout/BottomNavbar.tsx`
- Secciones internas llamadas desde `Index.tsx` como `TairetInfoSection`, `ExperiencesCarousel` y `TestimonialsSection`

## Superficie publica residual

Rutas publicas adicionales visibles en `App.tsx`:

- zonas: `/zona/asuncion`, `/zona/san-bernardino`, `/zona/ciudad-del-este`
- exploracion: `/explorar`, `/eventos`, `/zonas`, `/discotecas`, `/bares`, `/reseñas`
- perfiles: `/evento/:eventId`, `/club/:clubId`, `/bar/:barId`
- info/legal: `/sobre/*`, `/legal/*`, `/locales/:slug`, `/informacion`
- para locales: `/para-locales/publica-tu-local`, `/para-locales/solicitud`
- auth/otros: `/auth/login`, `/confirmacion-compra`, `/reservar/:barId`

Implicacion:

- Si el objetivo es que el usuario entre al dominio y vea la landing solo en la entrada principal, alcanza con intervenir `/`.
- Si el objetivo fuera convertir temporalmente todo el B2C publico en una single landing y cerrar el resto de la superficie accesible por URL directa, eso requiere validacion adicional y no se logra reemplazando solo `Index.tsx`.

## Ruta minima de implementacion futura

Implementacion recomendada:

1. Crear una carpeta especifica de landing, por ejemplo `apps/web-b2c/src/components/landing/` o `apps/web-b2c/src/features/landing/`.
2. Crear un componente raiz tipo `TemporaryLanding.tsx`.
3. Hacer que `apps/web-b2c/src/pages/Index.tsx` delegue todo a ese componente temporal.
4. Mantener intacto el resto del router y de las paginas existentes.
5. Ajustar SEO minimo de home en `apps/web-b2c/index.html` y, si hace falta contenido especifico de la home, desde el componente de landing con `useEffect`.

Archivos minimos a tocar en la futura implementacion:

- `apps/web-b2c/src/pages/Index.tsx`
- `apps/web-b2c/index.html`
- nuevo(s) archivo(s) de landing dentro de `apps/web-b2c/src/components/landing/` o equivalente
- opcional: `apps/web-b2c/src/index.css` solo si la landing necesita estilos globales no expresables con la base actual

Archivos que no haria falta tocar para el camino minimo:

- `apps/web-b2c/src/App.tsx`
- resto de paginas existentes
- rutas no relacionadas
- backend, SQL o docs de auditoria

## SEO minimo

Estado actual:

- `apps/web-b2c/index.html` ya define `title`, `meta description`, `canonical`, Open Graph y Twitter para la app.
- No hay un head manager central.
- Algunas paginas secundarias actualizan `document.title` y `meta[name="description"]` via `useEffect`, pero la home actual no lo hace.

Cambio minimo recomendado para la futura landing:

- actualizar en `apps/web-b2c/index.html` el `title`, `description`, `og:*`, `twitter:*` y el icon si corresponde a la nueva landing
- mantener `canonical` en `https://www.tairet.com.py`
- si la home necesita copy SEO distinto del estatico por entorno o por futura convivencia, agregar en el componente de landing un `useEffect` puntual para `document.title` y `meta description`

## Assets

Confirmado en repo:

- `apps/web-b2c/src/assets/tairet/tairet-mark.png` existe y es viable para import directo desde React
- `apps/web-b2c/public/favicon.ico` existe y es viable para `link rel="icon"`
- `apps/web-b2c/public/tairet-mark.png` tambien existe y hoy se usa en `index.html`

Implicacion:

- para UI React conviene consumir `src/assets/tairet/tairet-mark.png`
- para favicon/head estatico conviene usar `public/favicon.ico` o mantener `/tairet-mark.png` si la decision visual sigue siendo esa

## Compatibilidad visible con F7

Evidencia visible considerada:

- branch actual: `main`
- `git status --short` no muestra cambios en `apps/web-b2c`
- cambios visibles fuera de auditoria: `functions/api/src/routes/panel.ts`, `functions/api/src/routes/panelCatalog.ts`, `functions/api/src/routes/panelLocal.ts`, `infra/sql/rls.sql`, `infra/sql/migrations/016_harden_tracking_rls_backend_only.sql`
- unica referencia explicita a `F7` fuera de `docs/audits`: comentario `-- F7 CODE 01` en `infra/sql/migrations/016_harden_tracking_rls_backend_only.sql`

Lectura tecnica:

- la evidencia visible apunta a trabajo de panel/backend/SQL y hardening de tracking
- no hay evidencia visible de cambios en `apps/web-b2c`, `src/App.tsx`, `src/pages/Index.tsx`, `Navbar`, `Footer` o assets de la home

Clasificacion:

- `Compatible en paralelo`

Reserva:

- si existe trabajo de F7 aun no commiteado, no presente en este workspace o coordinado por otra rama remota, queda fuera de la evidencia y pasa a `Requiere validacion`

## Riesgos y requiere validacion

- `HashRouter`: si la expectativa futura es SEO/routing por path real sin hash, eso no forma parte del cambio minimo y requiere validacion aparte
- cierre total de superficie publica: no confirmado para este ASK; reemplazar `/` no deshabilita rutas publicas directas existentes
- fidelidad a `https://v0-tairet-landing-page.vercel.app/`: requiere validacion visual en implementacion, no en este discovery
- cualquier dependencia oculta de F7 fuera del repo/branch/working tree visible: `Requiere validacion`

## Recomendacion operativa

- Avanzar en paralelo con la landing temporal.
- Mantener el cambio acotado a `Index.tsx`, nuevo(s) componente(s) de landing y SEO minimo en `index.html`.
- No tocar router global salvo que aparezca un requerimiento explicito de cerrar rutas publicas residuales.
