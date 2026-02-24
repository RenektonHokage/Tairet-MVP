# SEO Fase 3 Runbook - Produccion: FASE COMPLETADA TECNICAMENTE 24/02/2026 DEJAMOS COMO PENDIENTE EL SEO POTENTE DE SEO POR PAGINAS

Fecha: 2026-02-24
Scope: cierre operativo SEO en produccion para `https://www.tairet.com.py`
Fuera de scope: cambios de codigo de app, backend, SQL, deploy scripts.

## 1) Objetivo de esta fase 

Cerrar SEO Fase 3 con evidencia operativa en produccion:

- dominio canonico y redirects correctos
- robots/sitemap publicados
- Search Console (y opcional Bing) configurados
- validacion de metadata/canonical en prod
- validacion OG/Twitter cards

## 2) Prerrequisitos y accesos

| Item | Lo hago yo | Lo puede Codex | Estado |
| --- | --- | --- | --- |
| Acceso al dominio/DNS o plataforma de hosting | SI | NO | [ ] |
| Acceso a Google Search Console | SI | NO | [ ] |
| Acceso opcional a Bing Webmaster | SI | NO | [ ] |
| URL de produccion disponible | SI | SI | [ ] |

Notas:

- Canonico acordado: `https://www.tairet.com.py`
- No usar canonical por rutas hash (`/#/...`)
- `tairet-mark.png` es OG temporal (pendiente no bloqueante: imagen 1200x630)

## 3) Preflight (antes de validar SEO externo)

1. Abrir:
   - `https://www.tairet.com.py/`
   - `https://www.tairet.com.py/robots.txt`
   - `https://www.tairet.com.py/sitemap.xml`
2. Confirmar que responden en navegador sin auth y sin errores 5xx.
3. Confirmar que home carga con metadata de marca Tairet (no Lovable).

## 4) Redirects canonicos (aceptar 301 o 308)

Probar estos casos:

| URL de entrada | Redireccion esperado | Estado valido | Resultado final esperado |
| --- | --- | --- | --- |
| `http://tairet.com.py/` | redirige | 301 o 308 | `https://www.tairet.com.py/` |
| `http://www.tairet.com.py/` | redirige | 301 o 308 | `https://www.tairet.com.py/` |
| `https://tairet.com.py/` | redirige | 301 o 308 | `https://www.tairet.com.py/` |
| `https://www.tairet.com.py/` | no redirige | 200 | `https://www.tairet.com.py/` |

Criterio de aceptacion:

- todo termina en `https://www.tairet.com.py/`
- no hay loops ni saltos innecesarios

## 5) Robots y sitemap en produccion

## 5.1 robots

Abrir `https://www.tairet.com.py/robots.txt` y validar:

- existe regla para `User-agent: *`
- contiene `Sitemap: https://www.tairet.com.py/sitemap.xml`

## 5.2 sitemap

Abrir `https://www.tairet.com.py/sitemap.xml` y validar:

- XML bien formado
- contiene al menos `<loc>https://www.tairet.com.py/</loc>`
- sin links a hosts no canonicos

## 6) Google Search Console (obligatorio)

1. Verificar propiedad (recomendado: Domain property `tairet.com.py`).
2. Ir a Sitemaps y enviar:
   - `https://www.tairet.com.py/sitemap.xml`
3. En URL Inspection:
   - inspeccionar `https://www.tairet.com.py/`
   - confirmar URL canonica seleccionada por Google (ideal: `https://www.tairet.com.py/`)
   - solicitar indexacion
4. Guardar evidencia (capturas o notas con fecha).

Importante:

- snippet viejo en Google no bloquea cierre tecnico inmediato
- los cambios de snippet dependen de recrawl

## 7) Bing Webmaster (opcional recomendado)

1. Verificar sitio.
2. Enviar sitemap: `https://www.tairet.com.py/sitemap.xml`
3. Revisar cobertura basica sin errores criticos.

## 8) Validacion de `<head>` en produccion

En home (`https://www.tairet.com.py/`), inspeccionar `<head>` y confirmar:

- `<title>` de marca Tairet
- `meta[name="description"]` correcta
- `<link rel="canonical" href="https://www.tairet.com.py">`
- OG:
  - `og:title`
  - `og:description`
  - `og:type=website`
  - `og:url=https://www.tairet.com.py`
  - `og:image=https://www.tairet.com.py/tairet-mark.png`
- Twitter:
  - `twitter:card`
  - `twitter:site=@tairetpy`
  - `twitter:title`
  - `twitter:description`
  - `twitter:image`
- sin referencias a `lovable.dev` ni `@lovable_dev`

## 9) Validacion OG/Twitter (herramientas externas)

Ejecutar:

- Facebook Sharing Debugger (Open Graph)
- X/Twitter Card Validator (o herramienta equivalente disponible)

Validar:

- preview carga sin errores tecnicos
- dominio y metadata correctos
- si visualmente se ve simple por logo cuadrado, registrar como pendiente visual no bloqueante

## 10) Troubleshooting rapido

**Problema: Google muestra snippet viejo**
- Causa probable: recrawl pendiente.
- Accion: URL Inspection + Request Indexing + esperar re-crawl.

**Problema: sitemap no se procesa**
- Revisar `200`, XML valido, host canonico, acceso publico sin bloqueos.

**Problema: canonical inconsistente**
- Revisar `<head>` renderizado en prod y reglas de redirect.

**Problema: preview social no actualiza**
- Forzar recache en debugger y verificar que `og:image` responda 200.

## 11) Evidencia a guardar (auditoria)

- Captura de redirects probados (o salida HTTP con status/final URL)
- Captura de `robots.txt` en prod
- Captura de `sitemap.xml` en prod
- Captura de URL Inspection en GSC (home)
- Captura de envio de sitemap en GSC
- Captura de debuggers OG/Twitter
- Fecha/hora de validacion y responsable

## 12) Go / No-Go final

| Criterio de cierre Fase 3 | Lo hago yo | Lo puede Codex | Estado |
| --- | --- | --- | --- |
| Redirects canonicos correctos (301/308 o 200 final canonico) | SI | SI (auditoria) | [ ] |
| Robots publicado y correcto | SI | SI (auditoria) | [ ] |
| Sitemap publicado y valido | SI | SI (auditoria) | [ ] |
| GSC verificado + sitemap enviado | SI | NO | [ ] |
| URL home inspeccionada/solicitada | SI | NO | [ ] |
| Metadata/canonical correctos en prod | SI | SI (auditoria) | [ ] |
| OG/Twitter sin errores tecnicos | SI | SI (interpretacion) | [ ] |

Regla de cierre:

- Fase 3 se puede cerrar si todos los checks tecnicos estan OK.
- Snippet viejo de Google no bloquea cierre tecnico si canonical/robots/sitemap/GSC estan correctos.
