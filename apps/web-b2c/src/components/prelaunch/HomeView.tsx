import scene2 from "../../assets/prelaunch/approved-0050982ea6317b.webp";
import scene1 from "../../assets/prelaunch/approved-a2ede2865582b0.webp";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import asset0 from "../../assets/prelaunch/approved-f6b08509f48db8.webp";
import asset1 from "../../assets/prelaunch/approved-0050982ea6317b.webp";
import asset2 from "../../assets/prelaunch/approved-e477bda28dd75c.webp";
import asset3 from "../../assets/prelaunch/approved-e5b841b9b6f0e2.webp";
import asset4 from "../../assets/prelaunch/approved-87d272ff09db9d.webp";

export function HomeView(){return (<div data-page="home">
<section className="cinema-hero">
<div className="cinema-scenes">
<img alt="Ambiente de bar" className="active" data-photo="a05" data-scene-img="0" src={asset0} />
<img alt="Terraza nocturna" data-scene-img="2" src={scene2} />
<img alt="Pista nocturna" data-scene-img="1" src={scene1} />
</div>
<div className="cinema-copy">
<h1>
{"¿Dónde salimos hoy?"}
</h1>
<h1 className="tmh-mobile-only" style={{"display":"none"} as CSSProperties}>
<span aria-hidden="true" className="tmh-kicker" style={{"display":"none"} as CSSProperties}>
{"TU NOCHE EMPIEZA ACA"}
</span>
<span className="tmh-top">
{"¿Dónde"}
</span>
<span className="tmh-bottom">
{"salimos hoy?"}
</span>
</h1>
<p className="intro-line">
{"Bares · Discotecas · Eventos"}
</p>
<div className="actions">
<Link className="button hw-campaign-cta" to="/halloween">
<span>
<strong>
{"HALLOWEEN 2026"}
</strong>
<small>
{"Descubrí las fiestas"}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<button className="text-link" data-tu-join="" type="button">
{"Sumar mi local"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M6 18 18 6M6 6h12v12">
</path>
</svg>
</button>
<Link className="text-link" to="/asuncion">
{"Explorá Asunción "}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
</div>
</section>
<section aria-label="Qué podés hacer" className="capabilities">
<div className="shell">
<div className="capability">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M8 3v4M16 3v4M4 9h16">
</path>
<rect height={15} rx="2" width={16} x="4" y="5">
</rect>
</svg>
<span>
{"Reservas de mesas"}
</span>
</div>
<div className="capability">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M4 10V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2">
</path>
<path d="M4 14v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2">
</path>
<path d="M4 10h16v4H4z">
</path>
<path d="M8 10v4">
</path>
</svg>
<span>
{"Entradas y Free Pass"}
</span>
</div>
<div className="capability">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M7 18.5A4.5 4.5 0 0 1 4 14.2V8.8A4.8 4.8 0 0 1 8.8 4h6.4A4.8 4.8 0 0 1 20 8.8v5.4A4.8 4.8 0 0 1 15.2 19H10l-3 2.5z">
</path>
</svg>
<span>
{"Elegí dónde salir"}
</span>
</div>
</div>
</section>
<section className="gateway cinema-gateway">
<div className="shell gateway-in">
<figure className="photo">
<img alt="Ambiente nocturno de referencia" className="" data-photo="a01" src={asset1} />
</figure>
<div className="gateway-copy">
<span className="small-label">
{"La ciudad, en un lugar"}
</span>
<h2>
{"Asunción no duerme"}
</h2>
<p>
{"Bares, discotecas y eventos por descubrir. Entrá a Asunción y elegí dónde empieza tu noche."}
</p>
<div className="actions">
<Link className="button" to="/asuncion">
{"Explorá Asunción"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
</div>
</div>
</section>
<section className="cinema-flow">
<div className="shell">
<h2 className="flow-title">
{"De la idea a la salida."}
</h2>
<div className="flow">
<div>
<h3>
{"Descubrí."}
</h3>
<p>
{"Conocé lugares para tomar algo, encontrarte o seguir la noche."}
</p>
</div>
<div>
<h3>
{"Elegí."}
</h3>
<p>
{"Revisá la información y encontrá lo que va con tu plan."}
</p>
</div>
<div>
<h3>
{"Salí."}
</h3>
<p>
{"Pasá de dar vueltas con la idea a elegir dónde ir."}
</p>
</div>
</div>
</div>
</section>
<section className="extra-section night-doors-section">
<div className="shell">
<div className="extra-head">
<div>
<span className="small-label">
</span>
<h2>
{"¿Qué te pinta esta noche?"}
</h2>
</div>
</div>
<div className="night-doors">
<Link className="night-door" to="/bares">
<img alt="Bar nocturno elegante con barra iluminada, tragos y gente socializando" data-photo="custom-bares" src={asset2} />
<div>
<strong>
{"Bares"}
</strong>
<span>
{"Tomar algo, comer, terraza."}
</span>
</div>
</Link>
<Link className="night-door" to="/discotecas">
<img alt="Discoteca nocturna con pista llena, DJ y luces vibrantes" data-photo="custom-discotecas" src={asset3} />
<div>
<strong>
{"Discotecas"}
</strong>
<span>
{"Música, entradas, mesas."}
</span>
</div>
</Link>
<Link className="night-door" to="/eventos">
<img alt="Evento nocturno al aire libre con escenario iluminado, público elegante y ambiente premium" data-photo="custom-eventos" src={asset4} />
<div>
<strong>
{"Eventos"}
</strong>
<span>
{"Fechas, tickets y planes especiales."}
</span>
</div>
</Link>
</div>
</div>
</section>
<section className="join-band">
<div className="shell join-inner">
<div>
<h2>
{"Tu lugar también puede ser el plan."}
</h2>
<p>
{"¿Tenés un bar, una discoteca o producís eventos? Conocé cómo formar parte de TAIRET."}
</p>
</div>
<button className="button" data-tu-join="" type="button">
{"Sumar mi local"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M6 18 18 6M6 6h12v12">
</path>
</svg>
</button>
</div>
</section>
</div>);}
