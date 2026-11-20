import { Link } from "react-router-dom";
import tairetMark from "../../assets/tairet/tairet-mark.png";

export function PublicHeader(){return (<header className="header">
<div className="header-in">
<Link aria-label="TAIRET, inicio" className="brand" to="/">
<img alt="" src={tairetMark} />
<span>
{"TAIRET"}
</span>
</Link>
<Link className="catalog-back" to="/">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5-5-5 5 5 5">
</path>
</svg>
{" Inicio"}
</Link>
<form aria-label="Buscar en Asunción" className="catalog-search" role="search">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<circle cx="10.5" cy="10.5" r="7">
</circle>
<path d="m16 16 5 5">
</path>
</svg>
<input aria-label="Buscar por zona, local o música" data-search-input="" name="q" placeholder="Buscar fiesta, música o zona…" type="search" />
</form>
<div className="header-actions">

<button aria-label="Activar modo claro" className="icon-btn" data-theme-toggle="" type="button" aria-pressed="false">
<svg aria-hidden="true" className="icon" data-sun="" viewBox="0 0 24 24">
<circle cx="12" cy="12" r="4">
</circle>
<path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5">
</path>
</svg>
<svg aria-hidden="true" className="icon" data-moon="" style={{display:"none"}} viewBox="0 0 24 24">
<path d="M20.7 13A8.6 8.6 0 0 1 11 3.3 9 9 0 1 0 20.7 13Z">
</path>
</svg>
</button>
<button className="header-join" data-tu-join="" type="button">
{"Sumar mi local"}
</button>
</div>
</div>
</header>);}

export function PublicFooter(){return (<footer aria-label="Pie de página de TAIRET" className="tf-footer" id="tairet-footer">
<div className="tf-wrap">
<div className="tf-footer-grid">
<div className="tf-footer-about tf-reveal">
<Link aria-label="TAIRET, inicio" className="tf-brand" to="/">
<img alt="" height={35} src={tairetMark} width={35} />
<span>
{"TAIRET"}
</span>
</Link>
<p className="tf-footer-pitch">
{"Bares, discotecas y eventos de Paraguay. Información para salir y herramientas para los locales."}
</p>
<div aria-label="Redes sociales" className="tf-socials">
<a data-social-placement="footer" aria-label="Instagram de TAIRET, abre en una pestaña nueva" href="https://www.instagram.com/tairetpy/" rel="noopener noreferrer" target="_blank">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<rect height={17} rx="5.5" width={17} x="3.5" y="3.5">
</rect>
<circle cx="12" cy="12" r="4.15">
</circle>
<circle cx="17.4" cy="6.6" fill="currentColor" r=".9" stroke="none">
</circle>
</svg>
</a>
<a aria-label="TikTok de TAIRET, abre en una pestaña nueva" href="https://www.tiktok.com/@tairetpy" rel="noopener noreferrer" target="_blank">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M14.25 3a1 1 0 0 1 1 1c0 1.74 1.42 3.15 3.17 3.15a1 1 0 1 1 0 2A5.1 5.1 0 0 1 15.4 8v7.29a5.4 5.4 0 1 1-4.35-5.28 1 1 0 1 1-.38 1.96 3.4 3.4 0 1 0 2.73 3.33V4a1 1 0 0 1 1-1Z" fill="currentColor" stroke="none">
</path>
</svg>
</a>
<a aria-label="YouTube de TAIRET, abre en una pestaña nueva" href="https://www.youtube.com/@tairetpy" rel="noopener noreferrer" target="_blank">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<rect height="11.6" rx="3.6" width="18.4" x="2.8" y="6.2">
</rect>
<path d="m10 9.4 5.2 2.6L10 14.6z" fill="currentColor" stroke="none">
</path>
</svg>
</a>
</div>
</div>
<details className="tf-footer-group tf-reveal" open={true}>
<summary tabIndex={-1} aria-disabled="true">
{"Explorar"}
</summary>
<nav aria-label="Explorar">
<Link to="/asuncion">
{"Asunción"}
</Link>
<Link to="/eventos">
{"Eventos"}
</Link>
<Link to="/mapa">
{"Mapa"}
</Link>
</nav>
</details>
<details className="tf-footer-group tf-reveal" open={true}>
<summary tabIndex={-1} aria-disabled="true">
{"Para locales"}
</summary>
<nav aria-label="Para locales">
<Link to="/para-locales/bares">
{"Bares"}
</Link>
<Link to="/para-locales/discotecas">
{"Discotecas"}
</Link>
<Link to="/para-locales/organizadores">
{"Organizadores"}
</Link>
<Link to="/para-locales/solicitud">
{"Sumar mi local"}
</Link>
</nav>
</details>
<details className="tf-footer-group tf-reveal" open={true}>
<summary tabIndex={-1} aria-disabled="true">
{"Información"}
</summary>
<nav aria-label="Información">
<Link to="/sobre/que-es-tairet">
{"Qué es TAIRET"}
</Link>
<Link to="/sobre/como-funciona">
{"Cómo funciona"}
</Link>
<Link to="/sobre/preguntas-frecuentes">
{"Ayuda"}
</Link>
<Link to="/contacto">
{"Contacto"}
</Link>
</nav>
</details>
</div>
<div className="tf-footer-floor tf-reveal">
<span>
{"© "}
<span data-tf-year="">
{new Date().getFullYear()}
</span>
{" TAIRET · Hecho en Paraguay"}
</span>
<nav aria-label="Información legal" className="tf-footer-legal">
<Link to="/legal/terminos-condiciones">
{"Términos y condiciones"}
</Link>
<Link to="/legal/politica-privacidad">
{"Política de privacidad"}
</Link>
<Link to="/legal/cookies">
{"Cookies"}
</Link>
<button data-r4-preferences="" type="button">
{"Configurar cookies"}
</button>
</nav>
</div>
</div>
</footer>);}

export function PublicDock(){return (<nav aria-label="Navegación inferior" className="dock">
<Link data-nav="home" to="/">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z">
</path>
</svg>
<span>
{"Inicio"}
</span>
</Link>
<Link data-nav="asuncion" to="/asuncion">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M3 21h18M5 21V8h7v13M12 21V3h7v18M8 11h1M8 15h1M15 7h1M15 11h1M15 15h1">
</path>
</svg>
<span>
{"Asunción"}
</span>
</Link>
<Link data-nav="mapa" to="/mapa">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16">
</path>
</svg>
<span>
{"Mapa"}
</span>
</Link>
<Link data-nav="eventos" to="/eventos">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Zm12 3v2m0 4v2">
</path>
</svg>
<span>
{"Eventos"}
</span>
</Link>
<Link data-nav="informacion" to="/informacion">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<circle cx="12" cy="12" r="9">
</circle>
<path d="M12 11v6m0-10v1">
</path>
</svg>
<span>
{"Información"}
</span>
</Link>
</nav>);}

export function ConsentBanner(){return (<div aria-label="Preferencias de cookies" className="r4-cookie-banner" id="r4-cookie-banner" role="region">
<div><p>Podés permitir estadísticas y contenido externo, o seguir sin ellos. Cambiá tu elección cuando quieras.</p></div>
<div className="r4-cookie-actions">
<button className="tf-btn" data-r4-cookie-accept="" type="button">Aceptar</button>
<button className="tf-btn secondary" data-r4-cookie-reject="" type="button">Rechazar</button>
<button className="tf-btn secondary" data-r4-preferences="" type="button">Configurar</button>
</div>
</div>);}

export function ConsentDialog(){return (<dialog aria-describedby="r4-cookie-description" aria-labelledby="r4-cookie-title" className="r4-cookie-dialog" id="r4-cookie-dialog">
<div className="r4-cookie-inner">
<div className="r4-cookie-head">
<h2 id="r4-cookie-title">
{"Preferencias de cookies."}
</h2>
<button aria-label="Cerrar preferencias" className="r4-cookie-close" data-r4-cookie-close="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 6 12 12M6 18 18 6">
</path>
</svg>
</button>
</div>
<p id="r4-cookie-description">
{"Elegí por separado contenido externo y analítica. Rechazar estas categorías no impide navegar, preparar propuestas ni abrir WhatsApp."}
</p>
<div className="r4-cookie-category">
<div>
<strong>
{"Necesarias"}
</strong>
<p>
{"Recordar tu elección de privacidad y conservar la apariencia o los favoritos que elegís usar."}
</p>
</div>
<span className="r4-fixed">
{"Siempre activas"}
</span>
</div>
<div className="r4-cookie-category">
<div>
<strong id="r4-external-label">
{"Contenido externo"}
</strong>
<p id="r4-external-description">
{"Videos y mapas integrados. Sus proveedores pueden recibir tu IP y otros datos técnicos. Las fuentes tipográficas se cargan por separado como recursos de presentación."}
</p>
</div>
<label className="r4-cookie-switch">
<input aria-describedby="r4-external-description" aria-labelledby="r4-external-label" id="r4-external-toggle" type="checkbox" />
<span aria-hidden="true">
</span>
</label>
</div>
<div className="r4-cookie-category">
<div>
<strong id="r4-analytics-label">Analítica</strong>
<p id="r4-analytics-description">Recordar si permitís estadísticas de uso de TAIRET.</p>
</div>
<label className="r4-cookie-switch">
<input aria-describedby="r4-analytics-description" aria-labelledby="r4-analytics-label" id="r4-analytics-toggle" type="checkbox" />
<span aria-hidden="true"></span>
</label>
</div>
<div className="r4-cookie-category">
<div><strong>Publicidad</strong><p>No se habilitan píxeles, audiencias publicitarias ni permisos de marketing desde este panel.</p></div>
<span className="r4-fixed">Desactivada</span>
</div>
<div className="r4-cookie-actions">
<button className="tf-btn secondary" data-r4-cookie-reject="" type="button">
{"Solo necesarias"}
</button>
<button className="tf-btn secondary" data-r4-cookie-accept="" type="button">
{"Aceptar opcionales"}
</button>
<button className="tf-btn" data-r4-cookie-save="" type="button">
{"Guardar preferencias"}
</button>
</div>
<p className="r4-cookie-last">
{"Podés cambiar tu elección desde el pie de página. "}
<Link to="/legal/cookies">
{"Cookies"}
</Link>
{" · "}
<Link to="/legal/politica-privacidad">
{"Privacidad"}
</Link>
{"."}
</p>
<p aria-live="polite" className="r4-cookie-status" id="r4-cookie-status" role="status">
</p>
</div>
</dialog>);}
