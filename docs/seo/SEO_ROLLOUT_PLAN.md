# SEO Rollout Plan - B2C (Discovery + Fases)

Fecha: 2026-02-23
Scope: `apps/web-b2c/**` (discovery) + referencia de placeholders en `apps/web-next/public/**`

## 1) Resumen ejecutivo

El frontend B2C tiene metadata base de origen Lovable en `index.html` y no tiene canonical global definido en el HTML base.  
Hay updates parciales de `title` y `description` en algunas rutas React, pero no hay estrategia unificada para OG/Twitter/canonical.  
Se propone rollout en 3 fases:

- F1: cleanup SEO visible (title/description/author/OG/Twitter + remocion Lovable).
- F2: SEO tecnico base (canonical acordado, favicon consistente, robots/sitemap).
- F3: rollout operativo externo (dominio, redirects, Search Console, validacion en produccion).

## 2) Hallazgos con evidencia (archivo + linea)

### 2.1 Metadata base actual (Lovable) en B2C

- `apps/web-b2c/index.html:6` -> `<title>feverup-nav-clone</title>`
- `apps/web-b2c/index.html:7` -> `description = "Lovable Generated Project"`
- `apps/web-b2c/index.html:8` -> `author = "Lovable"`
- `apps/web-b2c/index.html:10` -> `og:title = "feverup-nav-clone"`
- `apps/web-b2c/index.html:11` -> `og:description = "Lovable Generated Project"`
- `apps/web-b2c/index.html:13` -> `og:image` apunta a `lovable.dev`
- `apps/web-b2c/index.html:16` -> `twitter:site = @lovable_dev`
- `apps/web-b2c/index.html:17` -> `twitter:image` apunta a `lovable.dev`

Observacion: en ese bloque no existe `link rel=\"canonical\"` ni `twitter:title`/`twitter:description`.

### 2.2 Canonical parcial en runtime (solo algunas vistas)

- `apps/web-b2c/src/pages/SimpleInfoPage.tsx:88-94` crea/actualiza canonical dinamico con `window.location.origin + location.pathname`.

Riesgo: estrategia mixta (sin canonical base global + canonical parcial por ruta) puede generar inconsistencias.

### 2.3 Metadata runtime parcial (title/description)

- `apps/web-b2c/src/pages/Explorar.tsx:76-94` actualiza `document.title` y `meta[name=\"description\"]`.
- `apps/web-b2c/src/pages/para-locales/PublicaTuLocal.tsx:76-85` idem.
- `apps/web-b2c/src/pages/para-locales/WizardSolicitud.tsx:54-63` idem.

No se ve update equivalente de OG/Twitter por ruta.

### 2.4 robots / sitemap

- `apps/web-b2c/public/robots.txt:1-14` existe y permite crawlers comunes.
- No se encontro archivo sitemap en `apps/web-b2c/public` (discovery por archivos, sin matches para `sitemap`).

### 2.5 Favicon / branding assets

- `apps/web-b2c/public/favicon.ico` existe.
- `apps/web-next/public/favicon.ico:1` contiene texto placeholder (`# Placeholder - reemplazar con favicon real`).
- Asset de marca disponible: `apps/web-b2c/src/assets/tairet/tairet-mark.png`.

### 2.6 Referencias textuales a Lovable fuera de metadata

- `apps/web-b2c/src/pages/QueEsTairet.tsx:27`
- `apps/web-b2c/src/pages/QueEsTairet.tsx:32`
- `apps/web-b2c/src/pages/QueEsTairet.tsx:62`
- `apps/web-b2c/src/pages/QueEsTairet.tsx:174`

Son comentarios internos, no meta tags. Se pueden limpiar en F1 si se decide.

## 3) Decisiones explicitas de scope (acordadas)

- Canonical base objetivo: `https://www.tairet.com.py`
- Social handle oficial: `@tairetpy`
- Asset base marca/logo: `tairet-mark.png`

## 4) Plan por fases

## F1 - Cleanup SEO visible (metadata + Lovable)

Objetivo: remover huellas Lovable y dejar metadata base coherente de marca.

Acciones:

1. Actualizar `apps/web-b2c/index.html`:
   - `title`
   - `meta description`
   - `meta author`
   - OG (`og:title`, `og:description`, `og:image`)
   - Twitter (`twitter:site`, `twitter:image` y completar `twitter:title`/`twitter:description`)
2. Remover referencias a `lovable.dev` en metadata.
3. (Opcional recomendado) limpiar comentarios `LOVABLE` en `QueEsTairet.tsx` (no funcional).

Fuera de fase:
- No tocar backend ni logica React de negocio.

## F2 - SEO tecnico base (canonical/favicons/robots/sitemap)

Objetivo: estandarizar SEO tecnico para indexacion limpia.

Acciones:

1. Definir canonical base en HTML (`https://www.tairet.com.py`) y alinear comportamiento runtime.
2. Revisar `SimpleInfoPage.tsx` para no contradecir canonical acordado (mantener una sola estrategia).
3. Unificar favicon real en B2C y revisar placeholder de `apps/web-next/public/favicon.ico` (si aplica al deploy publico).
4. Mantener/ajustar `robots.txt` y agregar `sitemap.xml` si no existe.

Fuera de fase:
- No cambios de contenido comercial ni features UI.

## F3 - Rollout operativo externo (dominio + Search Console)

Objetivo: cerrar despliegue SEO en produccion.

Acciones:

1. Verificar dominio canonico y redirects (non-www <-> www segun estrategia final).
2. Publicar sitemap y validar robots en entorno productivo.
3. Alta/validacion en Google Search Console y Bing Webmaster.
4. Solicitar reindexacion de home y paginas clave.
5. Validar OG/Twitter con debuggers externos.

## 5) Checklist DoD por fase

## F1 DoD

- [ ] Sin metadata Lovable en `apps/web-b2c/index.html`
- [ ] OG/Twitter de marca Tairet en metadata base
- [ ] Sin referencias a `lovable.dev` en tags SEO

## F2 DoD

- [ ] Canonical alineado con `https://www.tairet.com.py`
- [ ] Estrategia canonical unica (sin contradiccion HTML vs runtime)
- [ ] favicon coherente sin placeholders en artefactos publicos
- [ ] `robots.txt` validado y `sitemap.xml` disponible

## F3 DoD

- [ ] Redirects y dominio canonico verificados en prod
- [ ] Search Console/Bing configurados
- [ ] Reindexacion solicitada para URLs clave
- [ ] OG/Twitter cards validadas externamente

## 6) Riesgos y mitigaciones

1. Riesgo: canonical inconsistente entre HTML y runtime.
   - Mitigacion: definir estrategia unica en F2 y testear head final por ruta.

2. Riesgo: OG image de baja calidad si se reutiliza solo logo.
   - Mitigacion: crear imagen social dedicada 1200x630.

3. Riesgo: placeholder favicon en otros apps confunde despliegues.
   - Mitigacion: inventario de favicons por app antes de release.

4. Riesgo: cambios SEO sin verificacion externa.
   - Mitigacion: checklist de validacion con Search Console + social debuggers.

## 7) Pendientes de input

1. OG image final 1200x630 (copy y visual aprobados).
2. Title/description finales de marca (home) para produccion.
3. Confirmar si canonical sera global a home o por ruta limpia (sin hash) en la etapa actual.
4. Confirmar si `apps/web-next/public/favicon.ico` participa en dominio publico final de marketing.

## 8) Comandos sugeridos para fase de implementacion

Discovery/QA local:

- `rg -n -i \"lovable|og:|twitter:|canonical|favicon|robots|sitemap|<title>|description|author\" apps/web-b2c apps/web-next/public`
- `pnpm -C apps/web-b2c typecheck`
- `pnpm -C apps/web-b2c dev --host 127.0.0.1 --clearScreen false`

Verificacion de scope:

- `git diff --name-only`

Checks manuales:

1. Inspeccionar `<head>` en home y rutas informativas.
2. Validar canonical final esperado.
3. Validar OG/Twitter tags sin referencias Lovable.
4. Verificar favicon mostrado en browser.

---

Nota recomendada:
Usar `tairet-mark.png` para favicon/logo y preparar una imagen social dedicada de 1200x630 para OG/Twitter cards.
