import { Link } from "react-router-dom";

export function CityView(){return (<div className="tu-document" data-theme="dark">
<div className="tu-body" data-study-theme="dark">
<div>
<section aria-labelledby="hero-title" className="hero">
<div aria-hidden="true" className="hero-photo">
</div>
<div className="hero-inner">
<div className="hero-copy">
<h1 id="hero-title">
{"Asunción"}
<br />
{"no duerme"}
</h1>
<p className="hero-subtitle">
{"Elegí dónde empieza tu noche."}
</p>
<div aria-label="Categorías en Asunción" className="hero-kinds">
<Link to="/bares"><span>{"Bares"}</span></Link>
<b aria-hidden="true">
{"/"}
</b>
<Link to="/discotecas"><span>{"Discotecas"}</span></Link>
<b aria-hidden="true">
{"/"}
</b>
<Link to="/eventos"><span>{"Eventos"}</span></Link>
</div>
</div>
</div>
</section>
<section aria-label="TAIRET para quienes salen y para los locales" className="paths">
<article aria-labelledby="consumer-title" className="path path-a">
<div aria-hidden="true" className="path-photo">
</div>
<h2 id="consumer-title">
{"Quiero encontrar"}
<br />
{"dónde salir."}
</h2>
<p>
{"Explorá los mejores bares, boliches y eventos de Asunción. Filtrá por zona, ambiente o música y viví una noche inolvidable."}
</p>
<Link className="path-cta" to="/zona/asuncion">
{"Explorá los locales "}
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<div aria-hidden="true" className="path-decor">
{"La noche"}
<br />
{"también se"}
<br />
{"planea"}
</div>
</article>
<article aria-labelledby="owner-title" className="path path-b">
<div aria-hidden="true" className="path-photo">
</div>
<h2 id="owner-title">
{"Quiero sumar"}
<br />
{"mi local."}
</h2>
<p>
{"Si tenés un bar o boliche, conversemos. Formá parte de TAIRET y conectá con más personas."}
</p>
<button className="path-cta" data-open-owner="" type="button">
{"Sumar mi local "}
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</button>
<div aria-hidden="true" className="path-decor">
{"BUENAS"}
<br />
{"NOCHES"}
<br />
{"ACÁ TAMBIÉN"}
</div>
</article>
<aside aria-label="Beneficios para locales" className="benefits">
<div className="benefit">
<div className="benefit-icon">
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M4 20v-6M8 20V9M12 20V4M16 20v-8M20 20v-13">
</path>
</svg>
</div>
<span>
{"Más"}
<br />
{"visibilidad"}
</span>
</div>
<div className="benefit">
<div className="benefit-icon">
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75">
</path>
</svg>
</div>
<span>
{"Nuevos"}
<br />
{"clientes"}
</span>
</div>
<div className="benefit">
<div className="benefit-icon">
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z">
</path>
<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.82 2.82-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.52V21h-4v-.09a1.65 1.65 0 0 0-1-1.52 1.65 1.65 0 0 0-1.82.33l-.06.06-2.82-2.82.06-.06A1.65 1.65 0 0 0 4.78 15a1.65 1.65 0 0 0-1.52-1H3v-4h.09a1.65 1.65 0 0 0 1.52-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 2.82-2.82.06.06A1.65 1.65 0 0 0 9 4.78 1.65 1.65 0 0 0 10 3.26V3h4v.09a1.65 1.65 0 0 0 1 1.52 1.65 1.65 0 0 0 1.82-.33l.06-.06 2.82 2.82-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.52 1H21v4h-.09A1.65 1.65 0 0 0 19.4 15Z">
</path>
</svg>
</div>
<span>
{"Herramientas únicas"}
<br />
{"para tu rubro"}
</span>
</div>
</aside>
</section>
</div>
</div>
</div>);}
