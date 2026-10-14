import scene2 from "../../assets/prelaunch/approved-0050982ea6317b.webp";
import scene1 from "../../assets/prelaunch/approved-a2ede2865582b0.webp";
// Selected approved sections converted to explicit JSX; behavior lives in scoped React hooks.
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import tairetMark from "../../assets/tairet/tairet-mark.png";
import CampaignVideo from "./CampaignVideo";
import asset0 from "../../assets/prelaunch/approved-f6b08509f48db8.webp";
import asset1 from "../../assets/prelaunch/approved-0050982ea6317b.webp";
import asset2 from "../../assets/prelaunch/approved-e477bda28dd75c.webp";
import asset3 from "../../assets/prelaunch/approved-e5b841b9b6f0e2.webp";
import asset4 from "../../assets/prelaunch/approved-87d272ff09db9d.webp";
import asset5 from "../../assets/prelaunch/approved-d0af85e4d1f269.png";
import asset6 from "../../assets/prelaunch/approved-2ab8afd348886b.webp";
import asset7 from "../../assets/prelaunch/approved-b15c7968a89f92.webp";
import asset8 from "../../assets/prelaunch/approved-d13b7f90d07113.png";










export function Page_home(){return (<div data-page="home">
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
{"Conocé la convocatoria"}
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
{"Mesas, próximamente"}
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
{"Entradas, próximamente"}
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
<button aria-haspopup="dialog" className="night-door" data-coming-soon="bares" type="button">
<img alt="Bar nocturno elegante con barra iluminada, tragos y gente socializando" data-photo="custom-bares" src={asset2} />
<div>
<strong>
{"Bares"}
</strong>
<span>
{"Tomar algo, comer, terraza."}
</span>
</div>
</button>
<button aria-haspopup="dialog" className="night-door" data-coming-soon="discotecas" type="button">
<img alt="Discoteca nocturna con pista llena, DJ y luces vibrantes" data-photo="custom-discotecas" src={asset3} />
<div>
<strong>
{"Discotecas"}
</strong>
<span>
{"Música, entradas, mesas."}
</span>
</div>
</button>
<Link className="night-door" to="/halloween">
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
export function Page_informacion(){return (<section aria-labelledby="tf-informacion-title" className="tf-page tf-new-page r4" data-page="informacion">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-informacion-title" tabIndex={-1}>
{"Información de TAIRET."}
</h1>
<p>
{"Conocé el servicio, encontrá ayuda y consultá nuestras políticas."}
</p>
</header>
<div className="r4-info-directory">
<section className="tf-reveal">
<h2>
{"Conocé TAIRET"}
</h2>
<Link to="/sobre/que-es-tairet">
<span>
<strong>
{"Qué es TAIRET"}
</strong>
<small>
{"La propuesta para quienes salen y para los locales."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<Link to="/sobre/como-funciona">
<span>
<strong>
{"Cómo funciona"}
</strong>
<small>
{"Publicaciones, consultas y canales de acceso."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</section>
<section className="tf-reveal">
<h2>
{"Encontrá una respuesta"}
</h2>
<Link to="/sobre/preguntas-frecuentes">
<span>
<strong>
{"Ayuda"}
</strong>
<small>
{"Preguntas organizadas por tema."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<Link to="/contacto">
<span>
<strong>
{"Contacto"}
</strong>
<small>
{"Consultas, correcciones y privacidad."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</section>
<section className="tf-reveal">
<h2>
{"Para locales"}
</h2>
<Link to="/para-locales/bares">
<span>
<strong>
{"Bares"}
</strong>
<small>
{"Reservas, métricas y perfil."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<Link to="/para-locales/discotecas">
<span>
<strong>
{"Discotecas"}
</strong>
<small>
{"Entradas, mesas y actividad."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<Link to="/para-locales/organizadores">
<span>
<strong>
{"Organizadores"}
</strong>
<small>
{"Una página para cada fecha."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<Link to="/para-locales/solicitud">
<span>
<strong>
{"Sumar mi local"}
</strong>
<small>
{"Prepará una consulta para el equipo."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</section>
<section className="tf-reveal">
<h2>
{"Políticas"}
</h2>
<Link to="/legal/terminos-condiciones">
<span>
<strong>
{"Términos y condiciones"}
</strong>
<small>
{"Uso del servicio y autorizaciones de contenido."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<Link to="/legal/politica-privacidad">
<span>
<strong>
{"Política de privacidad"}
</strong>
<small>
{"Datos, destinatarios y campañas."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
<Link to="/legal/cookies">
<span>
<strong>
{"Cookies"}
</strong>
<small>
{"Preferencias y almacenamiento."}
</small>
</span>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</section>
</div>
</div>
</section>);}
export function Page_about(){return (<section aria-labelledby="tf-about-title" className="tf-page tf-new-page r4" data-page="about">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-about-title" tabIndex={-1}>
{"Salir, con la información a mano."}
</h1>
<p>
{"TAIRET conecta a quienes buscan dónde salir con bares, discotecas y organizadores de eventos de Paraguay."}
</p>
</header>
<div className="r4-about-opening tf-reveal">
<figure className="r4-photo">
<img alt="Personas conversando en un bar" data-tf-image="bares" height={760} loading="lazy" src={asset2} style={{"objectPosition":"44% 50%"} as CSSProperties} width={800} />
</figure>
<div>
<h2>
{"Un punto de encuentro."}
</h2>
<p>
{"Una salida empieza con preguntas concretas: dónde queda, a qué hora abre, cuánto cuesta o cómo consultar por una mesa. TAIRET reúne esa información para que comparar opciones sea más simple."}
</p>
<p>
{"Del otro lado hay un equipo que prepara cada fecha, atiende consultas y necesita saber qué está pasando con su local. La propuesta también incluye herramientas para esa operación."}
</p>
</div>
</div>
<div className="r4-duo">
<section className="tf-reveal">
<h2>
{"Para quienes salen."}
</h2>
<p>
{"Descubrir fiestas y lugares, mirar fotos, consultar horarios y ubicación, guardar opciones y encontrar el canal correcto para entradas o mesas."}
</p>
<p>
{"El perfil explica cómo funciona cada propuesta. No todos los locales o eventos tienen las mismas modalidades de acceso."}
</p>
</section>
<section className="tf-reveal">
<h2>
{"Para quienes los reciben."}
</h2>
<p>
{"Visibilidad para su propuesta y herramientas según el tipo de negocio: reservas y métricas para bares; entradas, mesas y métricas para discotecas."}
</p>
<p>
{"Los organizadores cuentan con una página para presentar cada evento. Las funciones de gestión se coordinan con el equipo, sin confundirlas con la publicación en el hub."}
</p>
</section>
</div>
<section className="r4-prose-band tf-reveal">
<h2>
{"Información que viene de su fuente."}
</h2>
<div>
<p>
{"Los locales y organizadores aportan los datos, fotos, logos y flyers de sus propuestas. Les corresponde comunicar cambios de horarios, precios, acceso o disponibilidad."}
</p>
<p>
{"Cuando veas algo que deba corregirse, podés avisarnos desde Contacto. TAIRET no reemplaza al organizador ni presume una habilitación por el hecho de publicar un evento."}
</p>
</div>
</section>
<div className="r4-end tf-reveal">
<div>
<h2>
{"Conocé el recorrido."}
</h2>
<p>
{"Qué podés consultar, guardar y hacer antes de salir."}
</p>
</div>
<Link className="tf-btn" to="/sobre/como-funciona">
{"Cómo funciona"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
</div>
</section>);}
export function Page_how(){return (<section aria-labelledby="tf-how-title" className="tf-page tf-new-page r4" data-page="how">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-how-title" tabIndex={-1}>
{"De encontrar una fiesta"}
<br />
{"a decidir tu salida."}
</h1>
<p>
{"Cada paso tiene un propósito. Consultar información, contactar y comprar no son la misma acción."}
</p>
</header>
<div className="r4-steps">
<section className="r4-step tf-reveal">
<span aria-hidden="true">
{"01"}
</span>
<h2>
{"Encontrá una opción"}
</h2>
<div>
<p>
{"Recorré las fiestas y lugares publicados. Compará fecha, zona y propuesta para encontrar lo que te interesa."}
</p>
<details className="r4-disclosure">
<summary>
{"Un detalle a tener en cuenta"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Los filtros ayudan a reducir opciones; no reservan cupos ni garantizan disponibilidad."}
</p>
</div>
</details>
</div>
</section>
<section className="r4-step tf-reveal">
<span aria-hidden="true">
{"02"}
</span>
<h2>
{"Revisá su información"}
</h2>
<div>
<p>
{"Entrá a la ficha para ver horario, ubicación, restricciones de acceso y modalidades de entradas o mesas."}
</p>
<details className="r4-disclosure">
<summary>
{"Un detalle a tener en cuenta"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Tomá como referencia las condiciones de esa fecha. Una publicación anterior no reemplaza la información vigente del organizador."}
</p>
</div>
</details>
</div>
</section>
<section className="r4-step tf-reveal">
<span aria-hidden="true">
{"03"}
</span>
<h2>
{"Elegí cómo continuar"}
</h2>
<div>
<p>
{"Seguí el enlace de la ticketera o abrí el contacto del local u organizador, según lo que indique la ficha."}
</p>
<details className="r4-disclosure">
<summary>
{"Un detalle a tener en cuenta"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"No pedimos completar datos para visitar una ticketera externa ni para consultar información de venta en puerta. Una conversación por WhatsApp no equivale a una confirmación."}
</p>
</div>
</details>
</div>
</section>
<section className="r4-step tf-reveal">
<span aria-hidden="true">
{"04"}
</span>
<h2>
{"Guardá y compartí"}
</h2>
<div>
<p>
{"Guardá las fiestas que te interesan y volvé a consultarlas desde el mismo navegador."}
</p>
<details className="r4-disclosure">
<summary>
{"Un detalle a tener en cuenta"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Los favoritos no son entradas ni reservas. Al borrar los datos del navegador o cambiar de dispositivo puede dejar de aparecer esa selección."}
</p>
</div>
</details>
</div>
</section>
</div>
<section className="r4-prose-band tf-reveal">
<h2>
{"Entradas y mesas."}
</h2>
<div>
<p>
{"El hub informa cómo acceder a cada propuesta. No hay un proceso de pago directo habilitado aquí. La posible incorporación de ventas de entradas o mesas se informará con sus condiciones antes de realizar una compra."}
</p>
<p>
{"Cuando una operación se realice en una ticketera o con un organizador externo, la confirmación y la atención de esa operación corresponden al canal en el que se contrató."}
</p>
</div>
</section>
<div className="r4-end tf-reveal">
<div>
<h2>
{"¿Te quedó alguna duda?"}
</h2>
<p>
{"Encontrá respuestas por tema, sin recorrer toda la página."}
</p>
</div>
<Link className="tf-btn" to="/sobre/preguntas-frecuentes">
{"Ir a Ayuda"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
</div>
</section>);}
export function Page_faq(){return (<section aria-labelledby="tf-faq-title" className="tf-page tf-new-page r4" data-page="faq">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-faq-title" tabIndex={-1}>
{"Ayuda, por tema."}
</h1>
<p>
{"Buscá una respuesta sobre el hub, tu próxima salida o la publicación de un local."}
</p>
</header>
<div className="tf-faq-tools">
<label className="tf-search">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<circle cx="10.5" cy="10.5" r="6.5">
</circle>
<path d="m16 16 4 4">
</path>
</svg>
<input aria-label="Buscar en las preguntas frecuentes" autoComplete="off" id="tf-faq-search" placeholder="Buscar una pregunta" type="search" />
</label>
<span aria-live="polite" id="tf-faq-count">
{"20 preguntas"}
</span>
</div>
<div aria-label="Filtrar preguntas" className="tf-filter-group">
<button aria-pressed="true" data-tf-faq-filter="all" type="button">
{"Todas"}
</button>
<button aria-pressed="false" data-tf-faq-filter="general" type="button">
{"TAIRET"}
</button>
<button aria-pressed="false" data-tf-faq-filter="eventos" type="button">
{"Entradas y mesas"}
</button>
<button aria-pressed="false" data-tf-faq-filter="locales" type="button">
{"Locales"}
</button>
<button aria-pressed="false" data-tf-faq-filter="privacidad" type="button">
{"Privacidad"}
</button>
</div>
<div className="tf-faq-list">
<details data-faq-category="general" data-tf-faq="">
<summary>
{"¿Qué es TAIRET?"}
</summary>
<div className="tf-faq-answer">
<p>
{"TAIRET reúne información de bares, discotecas y eventos de Paraguay. Su propuesta combina la experiencia de descubrir dónde salir con herramientas para la gestión de los locales."}
</p>
</div>
</details>
<details data-faq-category="general" data-tf-faq="">
<summary>
{"¿Necesito una cuenta para explorar?"}
</summary>
<div className="tf-faq-answer">
<p>
{"No necesitás crear una cuenta para consultar la información pública, seguir un enlace o conocer una propuesta."}
</p>
</div>
</details>
<details data-faq-category="general" data-tf-faq="">
<summary>
{"¿Explorar el hub tiene costo?"}
</summary>
<div className="tf-faq-answer">
<p>
{"No cobramos por consultar la información del hub. El costo de una entrada, mesa o consumo corresponde a la propuesta y modalidad informadas por el local u organizador."}
</p>
</div>
</details>
<details data-faq-category="eventos" data-tf-faq="">
<summary>
{"¿TAIRET organiza las fiestas que publica?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Publicar una fiesta no convierte a TAIRET en su organizador. La ficha debe identificar a quien organiza la fecha y el lugar donde se realiza."}
</p>
</div>
</details>
<details data-faq-category="eventos" data-tf-faq="">
<summary>
{"¿Puedo comprar una entrada directamente acá?"}
</summary>
<div className="tf-faq-answer">
<p>
{"El hub no tiene un proceso de pago directo habilitado. Seguí el canal informado en la ficha. Si se incorpora venta directa, las condiciones de esa compra se mostrarán antes de pagar."}
</p>
</div>
</details>
<details data-faq-category="eventos" data-tf-faq="">
<summary>
{"¿Tengo que dejar mis datos para abrir una ticketera?"}
</summary>
<div className="tf-faq-answer">
<p>
{"No. No hace falta completar un formulario para ir a una ticketera externa ni para consultar información sobre venta en puerta."}
</p>
</div>
</details>
<details data-faq-category="eventos" data-tf-faq="">
<summary>
{"¿Consultar una mesa por WhatsApp la reserva?"}
</summary>
<div className="tf-faq-answer">
<p>
{"No. Es una consulta. El local u organizador debe confirmar disponibilidad, precio y condiciones antes de considerar la mesa reservada."}
</p>
</div>
</details>
<details data-faq-category="eventos" data-tf-faq="">
<summary>
{"¿Dónde consulto por una entrada comprada fuera de TAIRET?"}
</summary>
<div className="tf-faq-answer">
<p>
{"En la ticketera o con el vendedor con el que realizaste la compra. Conservá el comprobante. TAIRET puede ayudarte a identificar el canal publicado, pero no puede confirmar una operación que no gestionó."}
</p>
</div>
</details>
<details data-faq-category="eventos" data-tf-faq="">
<summary>
{"¿Qué pasa si cambian la fecha o el horario?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Revisá el aviso del organizador y contactá al canal donde adquiriste la entrada o acordaste la mesa. También podés avisarnos para corregir la publicación. Tus derechos aplicables no quedan eliminados por estas indicaciones."}
</p>
</div>
</details>
<details data-faq-category="locales" data-tf-faq="">
<summary>
{"¿Qué incluye la propuesta para bares?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Un perfil del local, reservas y métricas. La configuración y el alcance de las herramientas se coordinan con el equipo de TAIRET."}
</p>
</div>
</details>
<details data-faq-category="locales" data-tf-faq="">
<summary>
{"¿Y para discotecas?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Entradas, mesas, métricas y visibilidad del local. La publicación en el hub y la activación de herramientas comerciales son pasos diferentes; no todos los módulos están habilitados por aparecer en el sitio."}
</p>
</div>
</details>
<details data-faq-category="locales" data-tf-faq="">
<summary>
{"¿Cómo sumo mi evento?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Entrá en Sumar mi local, elegí Evento y completá los datos básicos. Podés revisar tu consulta antes de enviarla por WhatsApp o correo."}
</p>
</div>
</details>
<details data-faq-category="locales" data-tf-faq="">
<summary>
{"¿Quién aporta las fotos, logos y flyers?"}
</summary>
<div className="tf-faq-answer">
<p>
{"El local u organizador. Debe contar con los derechos y permisos necesarios. La autorización para publicar el material en el hub se distingue del permiso para difundirlo en redes o anuncios."}
</p>
</div>
</details>
<details data-faq-category="locales" data-tf-faq="">
<summary>
{"¿Publicar tiene una tarifa o plazo fijo de aprobación?"}
</summary>
<div className="tf-faq-answer">
<p>
{"No se anuncia una tarifa ni un plazo universal. El equipo conversa con cada local u organizador sobre el alcance, la información necesaria y las condiciones de su propuesta."}
</p>
</div>
</details>
<details data-faq-category="privacidad" data-tf-faq="">
<summary>
{"¿Los datos de clientes pueden usarse para campañas?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Las campañas pueden ser de TAIRET o del local u organizador con el que el cliente interactúa. El uso promocional debe informarse y elegirse por separado; enviar una consulta no equivale a aceptar publicidad ni compartir datos con todos los locales."}
</p>
</div>
</details>
<details data-faq-category="privacidad" data-tf-faq="">
<summary>
{"¿Aceptar cookies autoriza mensajes promocionales?"}
</summary>
<div className="tf-faq-answer">
<p>
{"No. Las preferencias del navegador y los permisos para campañas son decisiones distintas. Una autorización de contenido externo no habilita mensajes ni el envío de celulares a plataformas publicitarias."}
</p>
</div>
</details>
<details data-faq-category="privacidad" data-tf-faq="">
<summary>
{"¿Cómo cambio mis preferencias de cookies?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Abrí Configurar cookies desde el pie de página. Podés permitir o bloquear videos y mapas externos; los controles no eliminan datos que ya tenga un servicio ajeno a TAIRET."}
</p>
</div>
</details>
<details data-faq-category="privacidad" data-tf-faq="">
<summary>
{"¿Cómo dejo de recibir comunicaciones?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Pedí la baja al remitente o escribí a TAIRET.contacto@gmail.com, indicando si se trata de TAIRET o de un local concreto. La solicitud de baja no exige comprar ni contratar un servicio."}
</p>
</div>
</details>
<details data-faq-category="privacidad" data-tf-faq="">
<summary>
{"¿Dónde se guardan mis favoritos?"}
</summary>
<div className="tf-faq-answer">
<p>
{"En el navegador que utilizás. Podés borrarlos desde Cookies. Esto no borra mensajes enviados, compras externas ni datos de otros servicios."}
</p>
</div>
</details>
<details data-faq-category="general" data-tf-faq="">
<summary>
{"¿Cómo informo un error o un uso no autorizado de una imagen?"}
</summary>
<div className="tf-faq-answer">
<p>
{"Escribinos desde Contacto con el enlace de la publicación y una descripción. Para imágenes, indicá qué material te pertenece y cómo podemos verificarlo; no envíes documentos personales innecesarios."}
</p>
</div>
</details>
</div>
<div className="r4-empty" hidden={true} id="tf-faq-empty">
<h2>
{"No encontramos esa pregunta."}
</h2>
<p>
{"Probá con otra palabra o consultanos directamente."}
</p>
<button className="tf-btn secondary" data-tf-faq-clear="" type="button">
{"Limpiar búsqueda"}
</button>
</div>
<div className="r4-end tf-reveal">
<div>
<h2>
{"¿Necesitás hablar con alguien?"}
</h2>
<p>
{"Elegí el motivo de tu consulta para llegar con el contexto necesario."}
</p>
</div>
<Link className="tf-btn" to="/contacto">
{"Ir a Contacto"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
</div>
</section>);}
export function Page_venues(){return (<section aria-labelledby="tf-venues-title" className="tf-page tf-new-page r4" data-page="venues">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-venues-title" tabIndex={-1}>
{"Para cada tipo de local."}
</h1>
<p>
{"Conocé la propuesta que corresponde a tu bar, discoteca o evento."}
</p>
</header>
<div className="r4-business-index">
<Link className="r4-business-card tf-reveal" to="/para-locales/bares">
<figure className="r4-photo">
<img alt="Ambiente relacionado con bares" data-tf-image="bares" height={760} loading="lazy" src={asset2} style={{"objectPosition":"44% 50%"} as CSSProperties} width={800} />
</figure>
<div>
<h2>
{"Bares"}
</h2>
<p>
{"Reservas, perfil y métricas."}
</p>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</div>
</Link>
<Link className="r4-business-card tf-reveal" to="/para-locales/discotecas">
<figure className="r4-photo">
<img alt="Ambiente relacionado con discotecas" data-tf-image="discotecas" height={760} loading="lazy" src={asset3} style={{"objectPosition":"50% 48%"} as CSSProperties} width={800} />
</figure>
<div>
<h2>
{"Discotecas"}
</h2>
<p>
{"Entradas, mesas y actividad del local."}
</p>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</div>
</Link>
<Link className="r4-business-card tf-reveal" to="/para-locales/organizadores">
<figure className="r4-photo">
<img alt="Ambiente relacionado con organizadores" data-tf-image="eventos" height={760} loading="lazy" style={{"objectPosition":"50% 50%"} as CSSProperties} width={800} />
</figure>
<div>
<h2>
{"Organizadores"}
</h2>
<p>
{"Publicación de eventos y canales de acceso."}
</p>
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</div>
</Link>
</div>
<div className="r4-end tf-reveal">
<div>
<h2>
{"Empezamos por conocerte."}
</h2>
<p>
{"Contanos qué local o evento gestionás y qué necesitás organizar."}
</p>
</div>
<Link className="tf-btn" to="/para-locales/solicitud">
{"Sumar mi local"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
</div>
</section>);}
export function Page_venue_bar(){return (<section aria-labelledby="tf-venue-bar-title" className="tf-page tf-new-page r4" data-page="venue-bar">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<div className="r4-business-hero">
<div className="r4-business-copy tf-reveal">
<h1 id="tf-venue-bar-title" tabIndex={-1}>
{"Un lugar para tu bar."}
<br />
{"Orden para tus reservas."}
</h1>
<p>
{"Un perfil con la información del local, reservas por fecha y métricas para entender el interés de tus clientes."}
</p>
<Link className="tf-btn" to="/para-locales/solicitud?tipo=bar">
{"Consultar por mi bar"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
<figure className="r4-photo">
<img alt="Bar con mesas, barra y luz cálida" data-tf-image="bares" height={760} loading="lazy" src={asset2} style={{"objectPosition":"44% 50%"} as CSSProperties} width={800} />
</figure>
</div>
<div className="r4-feature-rail">
<article className="r4-feature tf-reveal">
<h2>
{"Reservas"}
</h2>
<p>
{"Organizá las solicitudes por fecha, horario, cantidad de personas y estado. Una consulta no se confunde con una reserva confirmada."}
</p>
<details className="r4-disclosure">
<summary>
{"Qué permite ordenar"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Reunir los datos de la solicitud, revisar el movimiento del día y dar seguimiento a cada reserva. El local conserva la decisión sobre la disponibilidad y la confirmación."}
</p>
</div>
</details>
</article>
<article className="r4-feature tf-reveal">
<h2>
{"Métricas"}
</h2>
<p>
{"Distinguí las visitas al perfil, los clics de contacto y las reservas recibidas. Cada dato responde a una acción diferente."}
</p>
<details className="r4-disclosure">
<summary>
{"Cómo leerlas"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Las visitas muestran interés; los clics indican intención de contacto; las solicitudes permiten seguir las reservas. No equivalen por sí solos a clientes atendidos ni a ingresos confirmados."}
</p>
</div>
</details>
</article>
<article className="r4-feature tf-reveal">
<h2>
{"Visibilidad"}
</h2>
<p>
{"Mostrá el ambiente del bar, sus horarios, ubicación, propuestas y formas de contacto en un perfil fácil de consultar."}
</p>
<details className="r4-disclosure">
<summary>
{"Información que ayuda a elegir"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Fotos aportadas por el local, descripción, dirección, horarios y enlaces de contacto. La idea es que una persona encuentre lo necesario para decidir y que el bar pueda mantenerlo actualizado."}
</p>
</div>
</details>
</article>
</div>
<div className="r4-business-note tf-reveal">
<h2>
{"Una experiencia más clara para ambos."}
</h2>
<div>
<p>
{"El público encuentra la información que necesita. El bar recibe consultas con contexto y puede seguir su operación sin perder de vista qué las generó."}
</p>
<Link to="/para-locales/discotecas">
{"Conocer la propuesta para discotecas"}
</Link>
</div>
</div>
</div>
</section>);}
export function Page_venue_club(){return (<section aria-labelledby="tf-venue-club-title" className="tf-page tf-new-page r4" data-page="venue-club">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<div className="r4-business-hero">
<div className="r4-business-copy tf-reveal">
<h1 id="tf-venue-club-title" tabIndex={-1}>
{"Tu discoteca."}
<br />
{"Cada fecha, en orden."}
</h1>
<p>
{"Entradas, mesas, métricas y un perfil que reúna la información que el público busca antes de salir."}
</p>
<Link className="tf-btn" to="/para-locales/solicitud?tipo=discoteca">
{"Consultar por mi discoteca"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
<figure className="r4-photo">
<img alt="Pista de discoteca con público y luces violetas" data-tf-image="discotecas" height={760} loading="lazy" src={asset3} style={{"objectPosition":"50% 48%"} as CSSProperties} width={800} />
</figure>
</div>
<div className="r4-feature-rail">
<article className="r4-feature tf-reveal">
<h2>
{"Entradas"}
</h2>
<p>
{"Presentá las modalidades y los precios de cada fecha, con un canal de acceso claro para el público."}
</p>
<details className="r4-disclosure">
<summary>
{"Venta directa en TAIRET"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"La venta directa forma parte de la propuesta de TAIRET: cobrar las entradas y distribuir los fondos a los locales correspondientes. No hay un proceso de pago habilitado en el hub; su activación requiere condiciones de compra, comprobantes, soporte y acuerdos definidos."}
</p>
</div>
</details>
</article>
<article className="r4-feature tf-reveal">
<h2>
{"Mesas"}
</h2>
<p>
{"Explicá qué incluye cada opción, su ubicación y cómo consultar. Una solicitud sigue siendo una solicitud hasta que se confirma."}
</p>
<details className="r4-disclosure">
<summary>
{"Sin condiciones ambiguas"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Capacidad, ubicación, consumición incluida cuando corresponda, precio y canal de consulta. La venta o el cobro de mesas no se presume habilitado: depende de la modalidad acordada para cada fecha."}
</p>
</div>
</details>
</article>
<article className="r4-feature tf-reveal">
<h2>
{"Métricas y visibilidad"}
</h2>
<p>
{"Un perfil para mostrar tu propuesta y datos para distinguir visitas, contactos y resultados de los módulos activos."}
</p>
<details className="r4-disclosure">
<summary>
{"Qué información se diferencia"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Las métricas del perfil se separan de las ventas, los ingresos y los accesos. Los indicadores comerciales corresponden únicamente a las operaciones gestionadas en las herramientas habilitadas."}
</p>
</div>
</details>
</article>
</div>
<div className="r4-business-note tf-reveal">
<h2>
{"La información antes de llegar."}
</h2>
<div>
<p>
{"Horario, ubicación, música y opciones de acceso, presentados de forma simple. Menos dudas para quien sale y consultas más concretas para el equipo del local."}
</p>
<Link to="/para-locales/bares">
{"Conocer la propuesta para bares"}
</Link>
</div>
</div>
</div>
</section>);}
export function Page_organizers(){return (<section aria-labelledby="tf-organizers-title" className="tf-page tf-new-page r4" data-page="organizers">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<div className="r4-business-hero">
<div className="r4-business-copy tf-reveal">
<h1 id="tf-organizers-title" tabIndex={-1}>
{"Tu evento,"}
<br />
{"con toda la información."}
</h1>
<p>
{"Una página propia para reunir fecha, lugar, entradas y contacto. El público encuentra los detalles sin tener que reconstruirlos entre publicaciones."}
</p>
<Link className="tf-btn" to="/para-locales/solicitud?tipo=evento">
{"Consultar por mi evento"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
<figure className="r4-photo">
<img alt="Público frente a un escenario de un evento nocturno" data-tf-image="eventos" height={760} loading="lazy" style={{"objectPosition":"50% 50%"} as CSSProperties} width={800} />
</figure>
</div>
<div className="r4-feature-rail">
<article className="r4-feature tf-reveal">
<h2>
{"Publicación"}
</h2>
<p>
{"Compartí los datos del evento y el material que querés publicar. TAIRET los presenta en el hub con una ficha propia."}
</p>
<details className="r4-disclosure">
<summary>
{"Qué necesitamos"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Nombre, fecha, horario, lugar, organizador, restricciones de acceso y precios o modalidades. Las fotos, logos y flyers los entrega el local u organizador con permiso para utilizarlos."}
</p>
</div>
</details>
</article>
<article className="r4-feature tf-reveal">
<h2>
{"Entradas y mesas"}
</h2>
<p>
{"Indicá el canal correspondiente: ticketera, contacto del organizador u otra modalidad expresamente informada."}
</p>
<details className="r4-disclosure">
<summary>
{"Qué significa cada acción"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Abrir una ticketera no es comprar en TAIRET. Consultar por WhatsApp no reserva una mesa ni confirma una entrada. Cada opción debe identificar a quien la atiende y explicar sus condiciones."}
</p>
</div>
</details>
</article>
<article className="r4-feature tf-reveal">
<h2>
{"Difusión"}
</h2>
<p>
{"Tu evento aparece dentro de un recorrido para descubrir y comparar fiestas, con información que se puede volver a consultar."}
</p>
<details className="r4-disclosure">
<summary>
{"Material y autorizaciones"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"La publicación en el hub y la difusión en redes o anuncios son usos diferentes. La autorización de cada canal se pide por separado; entregar un flyer no cede su propiedad ni autoriza cualquier reutilización."}
</p>
</div>
</details>
</article>
</div>
<div className="r4-business-note tf-reveal">
<h2>
{"Una fecha. Su propia página."}
</h2>
<div>
<p>
{"El evento tiene su ficha y sus canales de consulta. Las herramientas para bares y discotecas siguen en páginas independientes."}
</p>
<Link to="/halloween">
{"Ver el apartado de eventos"}
</Link>
</div>
</div>
</div>
</section>);}
export function Page_lead(){return (<section aria-labelledby="tf-lead-title" className="tf-page tf-new-page r4" data-page="lead">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-lead-title" tabIndex={-1}>
{"Contanos sobre"}
<br />
{"tu local o evento."}
</h1>
<p>
{"Elegí el tipo de propuesta y compartí la información necesaria para empezar la conversación."}
</p>
</header>
<div className="r4-form-layout">
<form autoComplete="off" className="tf-lead-form r4-inquiry-form" id="tf-lead-form">
<h2 className="tf-form-title">
{"Los datos básicos."}
</h2>
<p className="tf-form-intro">
{"Con esta información podemos entender tu propuesta. Después elegís cómo enviar la consulta."}
</p>
<div className="tf-form-grid">
<label className="tf-field full">
{"Nombre del local o evento *"}
<input aria-required="true" maxLength={100} name="venue" placeholder="Nombre de tu bar, discoteca o evento" required={true} />
</label>
<label className="tf-field">
{"Tipo de propuesta *"}
<select aria-required="true" name="type" required={true}>
<option value="">
{"Elegí una opción"}
</option>
<option value="bar">
{"Bar"}
</option>
<option value="discoteca">
{"Discoteca"}
</option>
<option value="evento">
{"Evento"}
</option>
</select>
</label>
<label className="tf-field">
{"Ciudad *"}
<input aria-required="true" maxLength={80} name="city" placeholder="Ciudad" required={true} />
</label>
<label className="tf-field full">
{"Tu nombre y cargo *"}
<input aria-required="true" maxLength={100} name="person" placeholder="Tu nombre y función en el negocio" required={true} />
</label>
<label className="tf-field full">
{"Instagram "}
<em>
{"Opcional"}
</em>
<input maxLength={120} name="instagram" placeholder="@tulocal" />
</label>
<label className="tf-field full">
{"¿Qué necesitás? "}
<em>
{"Opcional"}
</em>
<textarea maxLength={1000} name="message" placeholder="Contanos sobre tu local, evento o consulta." rows={3}>
</textarea>
</label>
</div>
<div className="r4-permissions">
<label className="r4-check">
<input name="terms" required={true} type="checkbox" />
<span>
{"Leí y acepto los "}
<Link to="/legal/terminos-condiciones">
{"Términos y condiciones"}
</Link>
{". Conozco cómo se utilizarán los datos de esta consulta según la "}
<Link to="/legal/politica-privacidad">
{"Política de privacidad"}
</Link>
{"."}
</span>
</label>
<label className="r4-check">
<input name="representative" required={true} type="checkbox" />
<span>
{"Estoy autorizado para realizar esta consulta en nombre del local o evento indicado."}
</span>
</label>
<label className="r4-check">
<input id="r4-material" name="material" type="checkbox" />
<span>
{"También voy a compartir fotos, logo o flyer para publicar la propuesta. "}
<em>
{"Opcional"}
</em>
</span>
</label>
<div hidden={true} id="r4-content-permissions">
<label className="r4-check">
<input name="rights" type="checkbox" />
<span>
{"Cuento con los derechos y permisos del material que entregue y autorizo su publicación en la ficha y las secciones relacionadas del hub. Se permiten ajustes de tamaño y recorte para su presentación, sin ceder la propiedad del material."}
</span>
</label>
<label className="r4-check">
<input name="socialPermission" type="checkbox" />
<span>
{"Autorizo además la difusión de ese material en las redes de TAIRET para promocionar este local o evento. "}
<em>
{"Opcional"}
</em>
</span>
</label>
<label className="r4-check">
<input name="paidPermission" type="checkbox" />
<span>
{"Autorizo además el uso de ese material en anuncios pagos de TAIRET para esta propuesta. "}
<em>
{"Opcional"}
</em>
</span>
</label>
<p className="r4-permission-note">
{"El material se comparte por el canal que elijas. Los permisos se refieren a esta propuesta mientras se mantenga publicada; podés solicitar su retirada. No constituyen un permiso para utilizar datos de clientes en campañas."}
</p>
</div>
<label className="r4-check">
<input name="news" type="checkbox" />
<span>
{"Quiero recibir novedades de TAIRET por el mismo canal que use para enviar esta consulta. "}
<em>
{"Opcional; podés pedir la baja."}
</em>
</span>
</label>
</div>
<p className="tf-form-note">
{"La información se usa para responderte. Podés continuar sin aceptar difusión en redes, anuncios ni novedades. No se envía nada hasta que confirmes en WhatsApp o correo."}
</p>
<button className="tf-btn" type="submit">
{"Continuar con mi consulta"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</button>
<div className="tf-draft-preview" hidden={true} id="tf-lead-preview" tabIndex={-1}>
<h3>
{"Tu consulta está lista."}
</h3>
<p>
{"Elegí WhatsApp o correo para enviarla al equipo."}
</p>
<pre id="tf-lead-text">
</pre>
<div className="tf-actions">
<a className="tf-btn" id="tf-lead-whatsapp" rel="noopener noreferrer" target="_blank">
{"Abrir WhatsApp"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z">
</path>
</svg>
</a>
<a className="tf-btn secondary" id="tf-lead-email">
{"Abrir correo"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<rect height={14} rx="2" width={18} x="3" y="5">
</rect>
<path d="m3 6 9 7 9-7">
</path>
</svg>
</a>
<button className="tf-btn secondary" data-tf-copy-message="" type="button">
{"Copiar mensaje"}
</button>
</div>
<p aria-live="polite" className="tf-inline-status" id="tf-lead-status" role="status">
</p>
</div>
</form>
<aside className="r4-form-aside">
<h2>
{"Una consulta,"}
<br />
{"sin compromiso."}
</h2>
<p>
{"No hay publicación ni cobro automático. El equipo revisa la propuesta y conversa con vos sobre los siguientes pasos."}
</p>
<details className="r4-disclosure">
<summary>
{"Qué material podés preparar"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Nombre y datos del local o evento, horarios, ubicación, precios o modalidades, fotos, logo y flyer. Compartí solo material que te pertenezca o que tengas permiso para utilizar."}
</p>
</div>
</details>
<details className="r4-disclosure">
<summary>
{"Qué sucede con tus permisos"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="m6 9 6 6 6-6">
</path>
</svg>
</summary>
<div>
<p>
{"Antes de enviar, podés revisar un mensaje que incluye los permisos que marcaste. La publicación en el hub, redes y anuncios son autorizaciones distintas. Ninguna habilita a usar datos de clientes en publicidad."}
</p>
</div>
</details>
</aside>
</div>
</div>
</section>);}
export function Page_contact(){return (<section aria-labelledby="tf-contact-title" className="tf-page tf-new-page r4" data-page="contact">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-contact-title" tabIndex={-1}>
{"Contanos qué necesitás."}
</h1>
<p>
{"Una consulta sobre el hub, tu local o tus datos. Elegí el motivo y el canal que te resulte más cómodo."}
</p>
</header>
<div className="r4-contact-layout">
<div className="r4-contact-reasons">
<section className="tf-reveal">
<span>
{"01"}
</span>
<h2>
{"Sobre una publicación"}
</h2>
<p>
{"Incluí el nombre del evento y el enlace. Indicá qué dato falta o debe corregirse."}
</p>
</section>
<section className="tf-reveal">
<span>
{"02"}
</span>
<h2>
{"Para locales y organizadores"}
</h2>
<p>
{"Contanos qué propuesta gestionás. La solicitud de incorporación permite preparar la información básica."}
</p>
</section>
<section className="tf-reveal">
<span>
{"03"}
</span>
<h2>
{"Privacidad y autorizaciones"}
</h2>
<p>
{"Podés solicitar acceso, corrección, eliminación o baja de comunicaciones, o informar un uso no autorizado de contenido."}
</p>
</section>
</div>
<aside className="r4-contact-direct tf-reveal">
<h2>
{"Hablemos."}
</h2>
<a data-contact-channel="whatsapp" href="https://wa.me/595981628109" rel="noopener noreferrer" target="_blank">
{"WhatsApp "}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</a>
<a data-contact-channel="email" href="mailto:tairet.contacto@gmail.com">
{"TAIRET.contacto@gmail.com "}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</a>
<p>
{"Escribí solo la información necesaria. No envíes contraseñas, datos de tarjetas ni documentos de identidad para una consulta general."}
</p>
<Link className="tf-btn secondary" to="/para-locales/solicitud">
{"Sumar mi local"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</aside>
</div>
<section className="r4-prose-band tf-reveal">
<h2>
{"Sobre una compra externa."}
</h2>
<div>
<p>
{"Si compraste en una ticketera o directamente con un organizador, contactá al vendedor y conservá el comprobante. Desde TAIRET podemos revisar el enlace o la información publicada."}
</p>
<p>
{"Para reportar contenido propio, identificá la publicación y el material afectado. Revisaremos la solicitud sin dar por autorizada una imagen solo porque ya aparezca en redes."}
</p>
</div>
</section>
</div>
</section>);}
export function Page_terms(){return (<section aria-labelledby="tf-terms-title" className="tf-page tf-new-page r4" data-page="terms">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-terms-title" tabIndex={-1}>
{"Términos y condiciones."}
</h1>
<p>
{"Reglas de uso del hub, publicaciones, consultas y autorizaciones sobre contenido."}
</p>
</header>
<p className="tf-legal-date">
{"Última actualización: 13 de octubre de 2026"}
</p>
<nav aria-label="Documentos legales" className="tf-subnav">
<Link aria-current="page" to="/legal/terminos-condiciones">
{"Términos y condiciones"}
</Link>
<Link to="/legal/politica-privacidad">
{"Política de privacidad"}
</Link>
<Link to="/legal/cookies">
{"Cookies"}
</Link>
</nav>
<div className="tf-article-grid">
<aside className="tf-toc">
<span>
{"Contenido"}
</span>
<Link to="/legal/terminos-condiciones?seccion=servicio">
{"1. El servicio de TAIRET"}
</Link>
<Link to="/legal/terminos-condiciones?seccion=uso">
{"2. Uso del sitio"}
</Link>
<Link to="/legal/terminos-condiciones?seccion=publicaciones">
{"3. Información de los eventos"}
</Link>
<Link to="/legal/terminos-condiciones?seccion=canales">
{"4. Entradas, mesas y canales externos"}
</Link>
<Link to="/legal/terminos-condiciones?seccion=venta">
{"5. Incorporación de ventas directas"}
</Link>
<Link to="/legal/terminos-condiciones?seccion=contenido">
{"6. Material y autorizaciones"}
</Link>
<Link to="/legal/terminos-condiciones?seccion=datos">
{"7. Datos y comunicaciones"}
</Link>
<Link to="/legal/terminos-condiciones?seccion=contacto">
{"8. Contacto y actualizaciones"}
</Link>
</aside>
<div className="tf-content">
<section className="tf-section is-visible" id="tf-terms-servicio" tabIndex={-1}>
<h2>
{"1. El servicio de TAIRET"}
</h2>
<p>
{"TAIRET es una plataforma para descubrir bares, discotecas y eventos en Paraguay. El hub reúne información de las propuestas publicadas y facilita el acceso a sus canales de contacto y entradas."}
</p>
<p>
{"Estos términos se refieren a la navegación y a las solicitudes de información en el sitio. La publicación de un evento no significa que TAIRET lo organice, sea propietario del establecimiento o garantice su habilitación. Tampoco excluye las obligaciones que correspondan a TAIRET por sus propios servicios."}
</p>
</section>
<section className="tf-section is-visible" id="tf-terms-uso" tabIndex={-1}>
<h2>
{"2. Uso del sitio"}
</h2>
<p>
{"La propuesta está orientada a personas mayores de 18 años. Cada local o evento puede tener requisitos de acceso adicionales, que deben consultarse en su información y con el organizador."}
</p>
<p>
{"Utilizá el sitio de forma lícita y respetuosa. No suplantes identidades, envíes información engañosa, intentes acceder a datos ajenos ni interfieras con el funcionamiento de la plataforma. Las consultas deben incluir datos de contacto correctos y únicamente la información necesaria."}
</p>
</section>
<section className="tf-section is-visible" id="tf-terms-publicaciones" tabIndex={-1}>
<h2>
{"3. Información de los eventos"}
</h2>
<p>
{"Los datos, fotos, logos y flyers son aportados por los locales y organizadores. Las condiciones pueden variar por fecha; comprobá horario, ubicación, precio y requisitos antes de trasladarte o contratar."}
</p>
<p>
{"TAIRET puede ordenar, editar la presentación o corregir publicaciones sin alterar deliberadamente las condiciones de la propuesta. Si detectás un error, informalo desde Contacto. La ausencia de un dato no significa que no exista una restricción."}
</p>
</section>
<section className="tf-section is-visible" id="tf-terms-canales" tabIndex={-1}>
<h2>
{"4. Entradas, mesas y canales externos"}
</h2>
<p>
{"El hub no tiene un proceso de pago directo habilitado. Abrir una ticketera externa, enviar un mensaje o guardar un evento no genera por sí solo una compra, una reserva ni un derecho de acceso."}
</p>
<p>
{"Cuando continuás con una ticketera, un local o un organizador, revisá quién atiende la operación y sus condiciones. La confirmación corresponde al canal que la gestiona. Las consultas de mesas no se consideran confirmadas hasta recibir una aceptación expresa."}
</p>
</section>
<section className="tf-section is-visible" id="tf-terms-venta" tabIndex={-1}>
<h2>
{"5. Incorporación de ventas directas"}
</h2>
<p>
{"La propuesta de venta directa prevé que TAIRET cobre entradas y distribuya los fondos a los locales correspondientes. Esa modalidad no se considera activa por estar descrita aquí. La posible venta de mesas también requiere una definición específica."}
</p>
<p>
{"Antes de habilitar cualquier cobro se informarán la identidad del prestador, el vendedor, precio total, comprobantes, entrega, canales de atención y condiciones aplicables a cambios, cancelaciones y reembolsos. Estos términos no sustituyen esas condiciones ni limitan los derechos que reconozca la normativa aplicable."}
</p>
</section>
<section className="tf-section is-visible" id="tf-terms-contenido" tabIndex={-1}>
<h2>
{"6. Material y autorizaciones"}
</h2>
<p>
{"Quien entregue fotos, logos, flyers o textos debe ser su titular o contar con los permisos necesarios, incluidos los que correspondan a personas identificables. Entregar material no transfiere su propiedad a TAIRET."}
</p>
<p>
{"La autorización para publicar permite mostrar ese material en la ficha y las secciones relacionadas del hub, realizar recortes o ajustes de tamaño para su presentación y mantenerlo durante la publicación de la propuesta. No incluye una cesión exclusiva ni una autorización ilimitada."}
</p>
<p>
{"La difusión en redes de TAIRET y su uso en anuncios pagos requieren autorizaciones separadas. Podés solicitar la corrección o retirada de material por el canal de contacto. Se revisará el alcance y las copias bajo control de TAIRET; no se promete eliminar copias ajenas."}
</p>
</section>
<section className="tf-section is-visible" id="tf-terms-datos" tabIndex={-1}>
<h2>
{"7. Datos y comunicaciones"}
</h2>
<p>
{"Los datos necesarios para atender una consulta se distinguen de los permisos promocionales. Las campañas de TAIRET y del local u organizador correspondiente deben identificar su finalidad y destinatario; no se autoriza un uso general por todos los locales al navegar o enviar una solicitud."}
</p>
<p>
{"Las opciones promocionales son voluntarias y separadas de la gestión del servicio. Podés pedir la baja sin costo. Consultá la Política de privacidad y Cookies para conocer cómo se trata la información y cómo ajustar las preferencias."}
</p>
</section>
<section className="tf-section is-visible" id="tf-terms-contacto" tabIndex={-1}>
<h2>
{"8. Contacto y actualizaciones"}
</h2>
<p>
{"Para consultas sobre el servicio, información incorrecta o derechos sobre contenido, escribí a "}
<a data-contact-channel="email" href="mailto:tairet.contacto@gmail.com">
{"TAIRET.contacto@gmail.com"}
</a>
{" o utilizá "}
<Link to="/contacto">
{"Contacto"}
</Link>
{". Indicá la publicación y el motivo para que podamos revisar el caso."}
</p>
<p>
{"La fecha de esta página identifica su revisión. Un cambio no elimina derechos adquiridos ni permite dar por aceptado un nuevo uso promocional de datos. Se aplica la normativa paraguaya correspondiente, sin perjuicio de los derechos irrenunciables de usuarios y consumidores."}
</p>
</section>
</div>
</div>
</div>
</section>);}
export function Page_privacy(){return (<section aria-labelledby="tf-privacy-title" className="tf-page tf-new-page r4" data-page="privacy">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-privacy-title" tabIndex={-1}>
{"Política de privacidad."}
</h1>
<p>
{"Qué información se utiliza, con quién se comparte y cómo elegís sus usos."}
</p>
</header>
<p className="tf-legal-date">
{"Última actualización: 14 de octubre de 2026"}
</p>
<nav aria-label="Documentos legales" className="tf-subnav">
<Link to="/legal/terminos-condiciones">
{"Términos y condiciones"}
</Link>
<Link aria-current="page" to="/legal/politica-privacidad">
{"Política de privacidad"}
</Link>
<Link to="/legal/cookies">
{"Cookies"}
</Link>
</nav>
<div className="tf-article-grid">
<aside className="tf-toc">
<span>
{"Contenido"}
</span>
<Link to="/legal/politica-privacidad?seccion=alcance">
{"1. Alcance y contacto"}
</Link>
<Link to="/legal/politica-privacidad?seccion=datos">
{"2. Qué información se utiliza"}
</Link>
<Link to="/legal/politica-privacidad?seccion=finalidades">
{"3. Para qué se utiliza"}
</Link>
<Link to="/legal/politica-privacidad?seccion=locales">
{"4. TAIRET y el local correspondiente"}
</Link>
<Link to="/legal/politica-privacidad?seccion=campanas">
{"5. Campañas y permisos promocionales"}
</Link>
<Link to="/legal/politica-privacidad?seccion=proveedores">
{"6. Servicios externos"}
</Link>
<Link to="/legal/politica-privacidad?seccion=conservacion">
{"7. Conservación y eliminación"}
</Link>
<Link to="/legal/politica-privacidad?seccion=derechos">
{"8. Tus solicitudes sobre datos"}
</Link>
<Link to="/legal/politica-privacidad?seccion=seguridad">
{"9. Cuidado de la información y cambios"}
</Link>
</aside>
<div className="tf-content">
<section className="tf-section is-visible" id="tf-privacy-alcance" tabIndex={-1}>
<h2>
{"1. Alcance y contacto"}
</h2>
<p>
{"Esta política explica el tratamiento de información en el hub de TAIRET, las consultas al equipo y la relación con los locales y organizadores. No describe como activas operaciones de pago que todavía no están habilitadas."}
</p>
<p>
{"El canal para consultas de privacidad es "}
<a data-contact-channel="email" href="mailto:tairet.contacto@gmail.com">
{"TAIRET.contacto@gmail.com"}
</a>
{". Identificá qué solicitud o publicación se relaciona con tu consulta; no adjuntes documentación sensible sin que se te solicite."}
</p>
</section>
<section className="tf-section is-visible" id="tf-privacy-datos" tabIndex={-1}>
<h2>
{"2. Qué información se utiliza"}
</h2>
<p>
{"Podés explorar la información pública sin crear una cuenta. Cuando preparás una consulta para el equipo, completás el nombre del local o evento, ciudad, tipo de propuesta, tu nombre y función, y los datos opcionales que decidas incluir."}
</p>
<p>
{"Al enviarla por WhatsApp o correo, ese canal también comunica los datos de tu cuenta o remitente. Los permisos elegidos sobre material o comunicaciones se incluyen en el mensaje preparado para que puedas revisarlos."}
</p>
<p>
{"El navegador conserva las preferencias de apariencia, favoritos y la elección de cookies. Al cargar recursos externos, sus proveedores pueden recibir información técnica como dirección IP, navegador y la solicitud del recurso."}
</p>
<p>Las novedades de Halloween se publican en Instagram, @tairetpy. El enlace se abre por una acción tuya; un clic no acredita que sigas la cuenta ni que hayas recibido una comunicación.</p>
<p>La analítica, si está habilitada y la permitís, registra vistas y acciones públicas con parámetros controlados. Un clic de contacto no acredita un mensaje recibido. Podés rechazarla o revocarla sin perder acceso al sitio, las propuestas ni los enlaces a redes sociales.</p>
</section>
<section className="tf-section is-visible" id="tf-privacy-finalidades" tabIndex={-1}>
<h2>
{"3. Para qué se utiliza"}
</h2>
<p>
{"La información de contacto permite responder consultas, revisar propuestas, corregir publicaciones y gestionar autorizaciones sobre el material aportado. Los favoritos y preferencias permiten recuperar las opciones elegidas en el dispositivo."}
</p>
<p>
{"Cuando una función solicite datos de un cliente para una entrada o mesa, debe explicar qué necesita, quién los recibe y para qué. La publicación de esa función no autoriza a pedir datos innecesarios. Visitar una ticketera externa o informarse sobre venta en puerta no exige un formulario previo en TAIRET."}
</p>
</section>
<section className="tf-section is-visible" id="tf-privacy-locales" tabIndex={-1}>
<h2>
{"4. TAIRET y el local correspondiente"}
</h2>
<p>
{"Los datos necesarios para gestionar una solicitud pueden ser tratados por TAIRET y por el local u organizador al que se dirige. Ese destinatario debe estar identificado en el momento de la consulta."}
</p>
<p>
{"La utilidad comercial de los datos para ambas partes no significa que se compartan con todos los locales ni que queden disponibles para cualquier fin. Cada parte debe respetar la finalidad comunicada, los permisos obtenidos y las solicitudes del titular."}
</p>
</section>
<section className="tf-section is-visible" id="tf-privacy-campanas" tabIndex={-1}>
<h2>
{"5. Campañas y permisos promocionales"}
</h2>
<p>
{"TAIRET y los locales u organizadores pueden realizar campañas. La autorización promocional se solicita de forma separada de la atención de una consulta y sin casillas premarcadas. Rechazarla no impide utilizar el servicio solicitado."}
</p>
<p>
{"La elección debe distinguir a TAIRET del local identificado y especificar si se trata de mensajes por WhatsApp, correo u otro canal, o de publicidad personalizada mediante plataformas publicitarias. Un permiso para recibir novedades no autoriza por sí solo a cargar celulares en una audiencia de anuncios."}
</p>
<p>
{"Aceptar cookies tampoco autoriza mensajes comerciales. Podés solicitar la baja al remitente o al canal de privacidad de TAIRET, indicando la comunicación o el local correspondiente. La baja de campañas no elimina automáticamente información que deba conservarse para atender una solicitud u obligación aplicable."}
</p>
</section>
<section className="tf-section is-visible" id="tf-privacy-proveedores" tabIndex={-1}>
<h2>
{"6. Servicios externos"}
</h2>
<p>
{"WhatsApp, correo, redes sociales y ticketeras tienen sus propias condiciones. Se accede a esos canales por una acción tuya. Las tipografías se sirven desde Google Fonts; los mapas y videos externos requieren la preferencia de contenido externo para cargarse desde el sitio."}
</p>
<p>
{"Esos proveedores pueden recibir datos técnicos y procesarlos fuera de Paraguay. Cuando la medición está habilitada y permitís analítica, Google Analytics 4 mide páginas públicas y acciones de navegación con cookies e información técnica. No se envían los valores de formularios, mensajes, teléfonos, correos ni datos operativos de Access. No se cargan píxeles publicitarios."}
</p>
</section>
<section className="tf-section is-visible" id="tf-privacy-conservacion" tabIndex={-1}>
<h2>
{"7. Conservación y eliminación"}
</h2>
<p>
{"El formulario mantiene los campos en la memoria de la página hasta que los borrás, reiniciás o cerrás el sitio. Preparar un mensaje no lo envía ni crea un registro en un servidor de TAIRET. El mensaje enviado se conserva en los canales usados para atender la consulta según su finalidad y las obligaciones aplicables."}
</p>
<p>
{"Las preferencias vencen a los 180 días. Una elección anterior válida conserva su permiso de medios y su antigüedad, pero no concede analítica. Al revocar analítica se detienen nuevos eventos y se eliminan las cookies propias de esta integración que el sitio puede gestionar; no se borran retroactivamente datos ya enviados a Google, mensajes, autenticación ni preferencias ajenas."}
</p>
<p>
{"Podés pedir información sobre la conservación de tu caso y solicitar eliminación cuando corresponda. No se ofrece un plazo de conservación universal para todos los tipos de solicitudes."}
</p>
</section>
<section className="tf-section is-visible" id="tf-privacy-derechos" tabIndex={-1}>
<h2>
{"8. Tus solicitudes sobre datos"}
</h2>
<p>
{"Podés pedir información sobre el tratamiento, acceso a tus datos, corrección, eliminación, oposición o retirada de permisos cuando corresponda. Para proteger la información puede ser necesario comprobar que la solicitud corresponde al titular, utilizando un medio proporcional al caso."}
</p>
<p>
{"Escribí a "}
<a data-contact-channel="email" href="mailto:tairet.contacto@gmail.com?subject=Consulta%20sobre%20mis%20datos">
{"TAIRET.contacto@gmail.com"}
</a>
{". Describí qué necesitás y cómo podemos identificar la solicitud. Las comunicaciones promocionales deben incluir un mecanismo sencillo y gratuito de baja."}
</p>
</section>
<section className="tf-section is-visible" id="tf-privacy-seguridad" tabIndex={-1}>
<h2>
{"9. Cuidado de la información y cambios"}
</h2>
<p>
{"No compartas contraseñas, códigos de acceso ni datos completos de tarjetas por formularios o mensajes de soporte. Ante una incidencia, avisá al equipo con una descripción y el enlace relacionado."}
</p>
<p>
{"La política se actualizará si cambian los datos solicitados, destinatarios o finalidades. Los nuevos usos que requieran permiso se presentarán por separado; una actualización de texto no sustituye esa elección."}
</p>
</section>
</div>
</div>
</div>
</section>);}
export function Page_cookies(){return (<section aria-labelledby="tf-cookies-title" className="tf-page tf-new-page r4" data-page="cookies">
<div className="tf-wrap">
<button className="tf-back" data-tf-return="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M19 12H5m5 5-5-5 5-5">
</path>
</svg>
{"Volver"}
</button>
<header className="r4-heading tf-reveal">
<h1 id="tf-cookies-title" tabIndex={-1}>
{"Cookies."}
</h1>
<p>
{"Tus preferencias del navegador y el control independiente de contenido externo y analítica."}
</p>
</header>
<p className="tf-legal-date">
{"Última actualización: 14 de octubre de 2026"}
</p>
<nav aria-label="Documentos legales" className="tf-subnav">
<Link to="/legal/terminos-condiciones">
{"Términos y condiciones"}
</Link>
<Link to="/legal/politica-privacidad">
{"Política de privacidad"}
</Link>
<Link aria-current="page" to="/legal/cookies">
{"Cookies"}
</Link>
</nav>
<div className="tf-article-grid">
<aside className="tf-toc">
<span>
{"Contenido"}
</span>
<Link to="/legal/cookies?seccion=tecnologias">
{"1. Cookies y almacenamiento local"}
</Link>
<Link to="/legal/cookies?seccion=preferencias">
{"2. Tus preferencias"}
</Link>
<Link to="/legal/cookies?seccion=categorias">
{"3. Qué se guarda y qué se carga"}
</Link>
<Link to="/legal/cookies?seccion=terceros">
{"4. Proveedores y límites del control"}
</Link>
<Link to="/legal/cookies?seccion=gestionar">
{"5. Favoritos en una próxima etapa"}
</Link>
<Link to="/legal/cookies?seccion=contacto">
{"6. Más información"}
</Link>
</aside>
<div className="tf-content">
<section className="tf-section is-visible" id="tf-cookies-tecnologias" tabIndex={-1}>
<h2>
{"1. Cookies y almacenamiento local"}
</h2>
<p>
{"Las cookies y tecnologías similares permiten recordar información en el navegador. TAIRET utiliza almacenamiento local para la apariencia y tu elección de privacidad. Los eventos guardados corresponden a una etapa posterior."}
</p>
<p>
{"No todas las conexiones externas usan cookies. Cargar un recurso también puede comunicar tu dirección IP y datos técnicos al proveedor. Por eso los videos y mapas integrados cuentan con un control específico."}
</p>
</section>
<section className="tf-section is-visible" id="tf-cookies-preferencias" tabIndex={-1}>
<h2>
{"2. Tus preferencias"}
</h2>
<p>
{"Podés mantener solo lo necesario o elegir por separado contenido externo y analítica. Ninguna elección condiciona navegar o abrir los enlaces de contacto y redes. Podés cambiarla desde el pie de página."}
</p>
<div className="tf-actions">
<button className="tf-btn" data-r4-preferences="" type="button">
{"Configurar cookies"}
</button>
</div>
<p aria-live="polite" className="r4-consent-status" data-r4-consent-status="">
{"Contenido externo y analítica bloqueados hasta una elección válida."}
</p>
</section>
<section className="tf-section is-visible" id="tf-cookies-categorias" tabIndex={-1}>
<h2>
{"3. Qué se guarda y qué se carga"}
</h2>
<div className="tf-table-wrap">
<table>
<caption>
{"Preferencias y recursos del sitio"}
</caption>
<thead>
<tr>
<th scope="col">
{"Categoría"}
</th>
<th scope="col">
{"Uso"}
</th>
<th scope="col">
{"Control"}
</th>
</tr>
</thead>
<tbody>
<tr>
<th scope="row">
{"Necesarias"}
</th>
<td>
{"Guardar tu elección de privacidad. Recordar apariencia y favoritos cuando usás esas funciones."}
</td>
<td>
{"La elección dura hasta 180 días. Los favoritos se pueden borrar de forma independiente."}
</td>
</tr>
<tr>
<th scope="row">
{"Contenido externo"}
</th>
<td>
{"Cargar videos y mapas de servicios externos. Puede comunicar datos técnicos al proveedor."}
</td>
<td>
{"Desactivado hasta que lo permitís. Revocar detiene los contenidos integrados."}
</td>
</tr>
<tr>
<th scope="row">Analítica</th>
<td>Google Analytics 4: vistas y acciones de páginas públicas, con cookies e información técnica. No se mide Access ni se envían campos de formularios o mensajes.</td>
<td>Bloqueada hasta una elección válida y la habilitación de la medición. Independiente del video. Podés revocarla en las preferencias.</td>
</tr>
<tr>
<th scope="row">Publicidad</th>
<td>No se cargan píxeles ni se habilitan audiencias publicitarias.</td>
<td>Desactivada.</td>
</tr>
</tbody>
</table>
</div>
<p>Esta integración usa cookies con prefijo tairet_b3 y duración máxima de 180 días. Antes de tu permiso no carga la etiqueta de Analytics. Revocar suspende la medición y elimina esas cookies gestionables, sin borrar autenticación, tema ni otras preferencias. No elimina información enviada previamente.</p>
</section>
<section className="tf-section is-visible" id="tf-cookies-terceros" tabIndex={-1}>
<h2>
{"4. Proveedores y límites del control"}
</h2>
<p>
{"Las fuentes tipográficas de Google Fonts se solicitan como recursos de presentación; no son un permiso para analítica ni publicidad. La preferencia de contenido externo controla los videos y los mapas integrados, no esas tipografías."}
</p>
<p>
{"Los enlaces a WhatsApp, redes y ticketeras no se abren hasta que los elegís. Al salir de TAIRET, se aplican las políticas de esos servicios. Rechazar contenido externo no elimina cookies que un proveedor ya haya guardado: podés administrarlas en los ajustes del navegador."}
</p>
</section>
<section className="tf-section is-visible" id="tf-cookies-gestionar" tabIndex={-1}>
<h2>
{"5. Favoritos en una próxima etapa"}
</h2>
<p>
{"Podés eliminar los eventos guardados en este navegador sin modificar el tema ni tu elección de cookies. Esto no cancela reservas, no borra mensajes enviados y no elimina datos de otros servicios."}
</p>
<div className="tf-actions">
<p>Los favoritos estarán disponibles en una etapa posterior.</p>
</div>
<p aria-live="polite" className="tf-inline-status" id="tf-storage-status" role="status">
</p>
</section>
<section className="tf-section is-visible" id="tf-cookies-contacto" tabIndex={-1}>
<h2>
{"6. Más información"}
</h2>
<p>
{"Las preferencias de cookies no reemplazan los permisos para comunicaciones o audiencias publicitarias. Consultá la "}
<Link to="/legal/politica-privacidad">
{"Política de privacidad"}
</Link>
{" para conocer esa diferencia."}
</p>
<p>
{"Para consultas, escribí a "}
<a data-contact-channel="email" href="mailto:tairet.contacto@gmail.com">
{"TAIRET.contacto@gmail.com"}
</a>
{". Si tu navegador bloquea el almacenamiento, tu elección se aplicará durante la visita, pero puede solicitarse nuevamente al recargar."}
</p>
</section>
</div>
</div>
</div>
</section>);}
export function Page_mapa(){return (<section aria-labelledby="tu-map-title" className="tf-page r4" data-page="mapa">
<div className="tf-wrap">
<Link className="tf-back" to="/asuncion">
{"Volver a Asunción"}
</Link>
<div className="tf-page-heading is-visible">
<h1 id="tu-map-title" tabIndex={-1}>
{"El mapa de Asunción,"}
<br />
{"próximamente."}
</h1>
<p>
{"Estamos incorporando los primeros bares, discotecas y eventos. Mientras tanto, conocé la convocatoria de Halloween o sumá tu local."}
</p>
</div>
<div className="tf-actions">
<Link className="tf-btn" to="/halloween">
{"Ver Halloween"}
</Link>
<Link className="tf-btn secondary" to="/para-locales/solicitud">
{"Sumar mi local"}
</Link>
</div>
</div>
</section>);}
export function ApprovedHeader(){return (<header className="header">
<div className="header-in">
<Link aria-label="TAIRET, inicio" className="brand" to="/inicio">
<img alt="" src={tairetMark} />
<span>
{"TAIRET"}
</span>
</Link>
<Link className="catalog-back" to="/inicio">
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
<input aria-label="Buscar por zona, local o música" data-search-input="" placeholder="Buscar fiesta, música o zona…" type="search" />
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
export function ApprovedFooter(){return (<footer aria-label="Pie de página de TAIRET" className="tf-footer" id="tairet-footer">
<div className="tf-wrap">
<div className="tf-footer-grid">
<div className="tf-footer-about tf-reveal">
<Link aria-label="TAIRET, inicio" className="tf-brand" to="/inicio">
<img alt="" height={33} src={asset5} width={33} />
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
<Link aria-current="page" to="/halloween">
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
{"2026"}
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
export function ApprovedDock(){return (<nav aria-label="Navegación inferior" className="dock">
<Link data-nav="home" to="/inicio">
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
<Link data-nav="halloween" aria-current="page" to="/halloween">
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
export function ApprovedConsentBanner(){return (<div aria-label="Preferencias de cookies" className="r4-cookie-banner" id="r4-cookie-banner" role="region">
<div><p>Podés permitir estadísticas y contenido externo, o seguir sin ellos. Cambiá tu elección cuando quieras.</p></div>
<div className="r4-cookie-actions">
<button className="tf-btn" data-r4-cookie-accept="" type="button">Aceptar</button>
<button className="tf-btn secondary" data-r4-cookie-reject="" type="button">Rechazar</button>
<button className="tf-btn secondary" data-r4-preferences="" type="button">Configurar</button>
</div>
</div>);}
export function Dialog_night_soon_dialog(){return (<dialog aria-describedby="night-soon-description" aria-labelledby="night-soon-title" className="night-soon-dialog" id="night-soon-dialog">
<div className="night-soon-photo">
<img alt="" id="night-soon-photo" />
<span className="night-soon-caption">
{"TAIRET / ASUNCIÓN"}
</span>
<span className="night-soon-category" id="night-soon-category">
{"BARES"}
</span>
<button aria-label="Cerrar aviso" className="night-soon-close" data-night-soon-close="" type="button">
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M18 6 6 18M6 6l12 12">
</path>
</svg>
</button>
</div>
<div className="night-soon-copy">
<span className="night-soon-kicker">
{"Próximamente en TAIRET"}
</span>
<h2 id="night-soon-title">
{"El próximo plan se está armando."}
</h2>
<p id="night-soon-description">
{"Estamos preparando esta sección."}
</p>
<div className="night-soon-bottom">
<button className="button" data-night-soon-close="" type="button">
{"Volver a TAIRET "}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</button>
<small>
{"Nos vemos pronto."}
</small>
</div>
</div>
</dialog>);}
export function Dialog_tu_search_notice(){return (<dialog aria-labelledby="tu-search-title" className="night-soon-dialog" id="tu-search-notice">
<div className="dialog-in">
<div className="dialog-top">
<h2 id="tu-search-title">
{"Próximamente en TAIRET"}
</h2>
<button aria-label="Cerrar aviso" className="icon-btn" data-tu-close-search="" type="button">
{"×"}
</button>
</div>
<p>
{"Estamos reuniendo los primeros locales y fiestas. Podés conocer Asunción o participar de la convocatoria de Halloween."}
</p>
<div className="actions">
<Link className="button" to="/halloween">
{"Ver Halloween"}
</Link>
</div>
</div>
</dialog>);}
export function Dialog_r4_cookie_dialog(){return (<dialog aria-describedby="r4-cookie-description" aria-labelledby="r4-cookie-title" className="r4-cookie-dialog" id="r4-cookie-dialog">
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
<p id="r4-analytics-description">Google Analytics 4 mide vistas y acciones en páginas públicas cuando la medición está habilitada y vos la permitís. Usa cookies y datos técnicos; no recibe los campos ni mensajes de tus propuestas. Es independiente del permiso de video.</p>
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
export function Page_asuncion(){return (<div className="tu-document" data-theme="dark">
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
<div aria-label="Próximamente: Bares, Discotecas y Eventos" className="hero-kinds">
<span>
{"Bares"}
</span>
<b aria-hidden="true">
{"/"}
</b>
<span>
{"Discotecas"}
</span>
<b aria-hidden="true">
{"/"}
</b>
<span>
{"Eventos"}
</span>
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
<a data-social-placement="asuncion_intro" aria-label="Seguir a @tairetpy en Instagram para enterarte de las novedades" className="path-cta" data-instagram="" href="https://www.instagram.com/tairetpy/">
{"Seguinos en Instagram "}
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</a>
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
<p className="prelaunch-note">
{"TAIRET está en prelanzamiento. Los locales, reservas y entradas todavía no están disponibles en la plataforma."}
</p>
<dialog aria-labelledby="owner-dialog-title" className="owner-dialog" id="owner-dialog">
<div className="dialog-head">
<h2 id="owner-dialog-title" tabIndex={-1}>
{"Sumá tu local a TAIRET"}
</h2>
<button aria-label="Cerrar" className="dialog-close" data-close-dialog="" type="button">
<svg viewBox="0 0 24 24">
<path d="M18 6 6 18M6 6l12 12">
</path>
</svg>
</button>
</div>
<div className="dialog-body">
<p>
{"¿Qué tipo de local tenés? Elegí una opción y te llevamos a WhatsApp con un mensaje preparado."}
</p>
<div aria-label="Tipo de local" className="local-options" role="radiogroup">
<label className="local-option">
<input name="type" type="radio" defaultValue="bar" />
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M8 3v18m8-18v18M5 3h14l-7 8-7-8ZM9 21h6">
</path>
</svg>
{"Bar"}
</label>
<label className="local-option">
<input name="type" type="radio" defaultValue="discoteca" />
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M9 18V5l11-2v13">
</path>
<circle cx="6" cy="18" r="3">
</circle>
<circle cx="17" cy="16" r="3">
</circle>
</svg>
{"Discoteca"}
</label>
</div>
<a aria-disabled="true" className="wa-link" href="#" id="owner-whatsapp">
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 4.7-7.6A8.38 8.38 0 0 1 12.5 3h.5a8.48 8.48 0 0 1 8 8v.5Z">
</path>
</svg>
{"Continuar por WhatsApp "}
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</a>
<p aria-live="polite" className="dialog-hint" id="owner-hint">
{"Seleccioná Bar o Discoteca para continuar."}
</p>
<a className="mail-link" data-contact-channel="email" href="mailto:tairet.contacto@gmail.com?subject=Quiero%20incorporar%20mi%20local%20a%20Tairet">
<svg aria-hidden="true" viewBox="0 0 24 24">
<rect height={16} rx="2" width={20} x="2" y="4">
</rect>
<path d="m2 6 10 7 10-7">
</path>
</svg>
{"O escribir a TAIRET.contacto@gmail.com"}
</a>
</div>
</dialog>
<dialog aria-labelledby="notice-title" className="notice-dialog" id="notice-dialog">
<div className="dialog-head">
<h2 id="notice-title">
{"Próximamente en TAIRET"}
</h2>
<button aria-label="Cerrar" className="dialog-close" data-close-dialog="" type="button">
<svg viewBox="0 0 24 24">
<path d="M18 6 6 18M6 6l12 12">
</path>
</svg>
</button>
</div>
<div className="dialog-body">
<p>
{"Estamos incorporando los primeros bares y discotecas de Asunción. Seguinos para enterarte cuando se habilite la exploración de locales."}
</p>
<a className="wa-link" data-instagram="" href="https://www.instagram.com/tairetpy/">
{"Ir a @tairetpy "}
<svg viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</a>
</div>
</dialog>
</div>
</div>);}
export function Page_halloween(){return (<div className="tu-document" data-art="party" data-finish="luz" data-hero-brief="portada" data-hero-r6="silueta" data-hero-round="3" data-hero-study="elevada" data-map-round="2" data-theme="dark">
<div className="tu-body" data-hw-name="Halloween 2026" data-route="halloween" data-study-theme="dark">
<div>
<div className="hw-page" data-page="halloween">
<section aria-labelledby="campaign-title" className="party-hero hwo-hero hw16-hero" data-media-frame="false" data-media-playing="false" data-manual-video="false">
<div className="hwo-media">
<picture className="tu-approved-poster">
<source media="(max-width:860px)" srcSet={asset6} />
<img alt="" aria-hidden="true" className="fixed-hero-poster" decoding="async" src={asset7} />
</picture>
<CampaignVideo />
</div>
<div aria-hidden="true" className="h16-shade">
</div>
<div className="h16-core">
<p className="h16-eyebrow">
<span>
{"Guía de fiestas de"}
</span>
<strong>
{"Halloween"}
</strong>
</p>
<h1 className="h16-logo" id="campaign-title">
<span className="sr-only">
{"TAIRET Halloween"}
</span>
<img alt="" aria-hidden="true" decoding="async" height={887} src={asset8} width={1774} />
</h1>
<p className="h16-location">
<span>
{"Asunción 2026"}
</span>
</p>
<p className="h16-description">
{"Estamos preparando la guía de Halloween en Asunción."}
</p>
</div>
<div className="h16-bottom">
<div aria-label="Participá de Halloween" className="h16-actions">
<button className="h16-cta h16-cta-primary" data-open-party="" type="button">
<span>
{"Sumar mi fiesta"}
</span>
<span className="h16-arrow">
<svg aria-hidden="true" viewBox="0 0 24 24">
<path d="M12 5v14M5 12h14">
</path>
</svg>
</span>
</button>
<a data-social-placement="halloween_hero" className="h16-cta h16-cta-saved" href="https://www.instagram.com/tairetpy/" rel="noopener noreferrer" target="_blank">
<svg aria-hidden="true" viewBox="0 0 24 24">
<rect height={18} rx="5" width={18} x="3" y="3">
</rect>
<circle cx="12" cy="12" r="4">
</circle>
<circle cx="17.5" cy="6.5" fill="currentColor" r=".75" stroke="none">
</circle>
</svg>
<span>
{"Seguinos en Instagram"}
</span>
</a>
</div>
</div>
</section>
<section aria-labelledby="launch-title" className="launch-intro">
<div>
<span className="launch-kicker">
{"Convocatoria abierta · Asunción 2026"}
</span>
<h2 id="launch-title">
{"Tu fiesta tiene que estar acá."}
</h2>
</div>
<div>
<p>
{"Estamos reuniendo las propuestas para Halloween. Si organizás una fiesta en Asunción o alrededores, acercanos la información para que podamos revisarla."}
</p>
<button className="launch-text-action" data-open-party="" type="button">
{"Quiero sumar mi fiesta ↗"}
</button>
</div>
</section>
</div>
</div>
<dialog aria-labelledby="party-title" id="party-form-dialog" className="party-dialog">
<div className="party-modal-head">
<span className="launch-kicker">
{"Para organizadores"}
</span>
<h2 id="party-title">
{"Sumá tu fiesta."}
</h2>
<button aria-label="Cerrar formulario" className="party-close" type="button">
{"×"}
</button>
<div aria-label="Pasos del formulario" className="party-progress">
<span data-progress="0">
{"1"}
<b>
{"La fiesta"}
</b>
</span>
<span data-progress="1">
{"2"}
<b>
{"Entradas"}
</b>
</span>
<span data-progress="2">
{"3"}
<b>
{"Mesas"}
</b>
</span>
<span data-progress="3">
{"4"}
<b>
{"Material y contacto"}
</b>
</span>
</div>
</div>
<form id="party-form" noValidate={true}>
<section className="party-step" data-step="0">
<div className="party-step-heading">
<h3 tabIndex={-1}>
{"La fiesta"}
</h3>
<p>
{"Empecemos por lo esencial."}
</p>
</div>
<div className="party-grid">
<label className="party-full">
{"Nombre de la fiesta"}
<input maxLength={120} name="event" placeholder="Nombre del evento" required={true} type="text" />
</label>
<label>
{"Fecha"}
<input name="date" required={true} type="date" />
</label>
<label>
{"Hora de inicio"}
<input name="start" required={true} type="time" />
</label>
<label className="party-full">
{"Local y ciudad"}
<input maxLength={160} name="place" placeholder="Local · Asunción" required={true} type="text" />
</label>
<label>
{"Música principal"}
<input maxLength={120} name="music" placeholder="Ej.: reggaetón, electrónica" required={true} type="text" />
</label>
<label>
{"Edad mínima"}
<input max="99" min="0" name="age" placeholder="Ej.: 18" required={true} step="1" type="number" />
</label>
</div>
</section>
<section className="party-step" data-step="1" hidden={true}>
<div className="party-step-heading">
<h3 tabIndex={-1}>
{"Entradas"}
</h3>
<p>
{"Contanos cómo se accede."}
</p>
</div>
<div className="party-grid">
<label>
{"Entrada"}
<select name="entry" required={true}>
<option value="">
{"Elegí una opción"}
</option>
<option value="paid">
{"Paga"}
</option>
<option value="free">
{"Gratis"}
</option>
<option value="timed">
{"Gratis hasta cierto horario"}
</option>
<option value="pending">
{"Por confirmar"}
</option>
</select>
</label>
<div className="party-full party-grid" data-condition="entry-paid" hidden={true}>
<label className="">
{"Entradas previstas para vender"}
<input maxLength={300} name="ticket_total" placeholder="Cantidad total" required={true} type="number" disabled={true} min="1" step="1" />
</label>
<label>
{"Canal principal de venta"}
<select name="sales" required={true} disabled={true}>
<option value="">
{"Elegí una opción"}
</option>
<option value="ticketera">
{"Ticketera"}
</option>
<option value="whatsapp">
{"WhatsApp"}
</option>
<option value="door">
{"En puerta"}
</option>
<option value="other">
{"Otro"}
</option>
</select>
</label>
<div className="party-full" data-condition="sale-contact" hidden={true}>
<label className="party-full">
<span id="sales-contact-label">
{"Enlace o contacto de venta"}
</span>
<input maxLength={500} name="sales_contact" placeholder="Enlace o contacto de venta" required={true} type="text" disabled={true} />
</label>
</div>
<div className="party-full">
<div className="party-row-heading">
<strong>
{"Tandas o tipos de entrada"}
</strong>
<span>
{"Precio en guaraníes"}
</span>
</div>
<div id="ticket-rows">
<div className="party-repeat-row" data-kind="ticket">
<div className="party-repeat-head">
<span>
{"Entrada 1"}
</span>
<button type="button" className="party-remove">
{"Limpiar"}
</button>
</div>
<div className="party-grid">
<label>
{"Nombre / tanda"}
<input data-field="name" type="text" required={true} maxLength={250} disabled={true} />
</label>
<label>
{"Precio (₲)"}
<input data-field="price" type="number" required={true} maxLength={250} min="0" step="1" disabled={true} />
</label>
<label>
{"Cantidad · opcional"}
<input data-field="qty" type="number" maxLength={250} min="1" step="1" disabled={true} />
</label>
<label>
{"Incluye / vigencia · opcional"}
<input data-field="details" type="text" maxLength={250} disabled={true} />
</label>
</div>
</div>
</div>
<button className="party-add" data-add="ticket" type="button">
{"+ Agregar otra tanda"}
</button>
</div>
<details className="party-more party-full">
<summary>
{"Agregar más detalles · opcional"}
</summary>
<div className="party-grid">
<label className="party-full">
{"Vigencia, incluidos y otros canales"}
<textarea maxLength={700} name="ticket_notes" placeholder="Ej.: Early Bird hasta agotar stock; general incluye una bebida. Indicá otros canales y cargos extra, si existen." rows={2} disabled={true}>
</textarea>
</label>
</div>
</details>
</div>
<div className="party-full party-grid" data-condition="entry-timed" hidden={true}>
<label className="">
{"Gratis hasta las"}
<input maxLength={300} name="free_until" placeholder="" required={true} type="time" disabled={true} />
</label>
<label className="">
{"Precio después (₲)"}
<input maxLength={300} name="later_price" placeholder="" required={true} type="number" disabled={true} min="0" step="1" />
</label>
</div>
<div className="party-full" data-condition="entry-free" hidden={true}>
<label className="party-full">
{"Condiciones de acceso gratuito"}
<textarea maxLength={700} name="free_notes" placeholder="Ej.: con lista previa o inscripción. Si es libre, indicá sin condiciones." rows={2} disabled={true}>
</textarea>
</label>
</div>
<p className="party-hint party-full" data-condition="entry-pending" hidden={true}>
{"Podés enviarnos la propuesta ahora y confirmar precios y venta después."}
</p>
</div>
</section>
<section className="party-step" data-step="2" hidden={true}>
<div className="party-step-heading">
<h3 tabIndex={-1}>
{"Mesas"}
</h3>
<p>
{"Solo completá esto si ofrecés mesas."}
</p>
</div>
<div className="party-grid">
<label>
{"¿Ofrecés mesas?"}
<select name="tables" required={true}>
<option value="">
{"Elegí una opción"}
</option>
<option value="yes">
{"Sí"}
</option>
<option value="no">
{"No"}
</option>
<option value="pending">
{"Por confirmar"}
</option>
</select>
</label>
<div className="party-full party-grid" data-condition="tables-yes" hidden={true}>
<div className="party-full">
<div className="party-row-heading">
<strong>
{"Tipos de mesa"}
</strong>
<span>
{"Precio total en guaraníes"}
</span>
</div>
<div id="table-rows">
<div className="party-repeat-row" data-kind="table">
<div className="party-repeat-head">
<span>
{"Mesa 1"}
</span>
<button type="button" className="party-remove">
{"Limpiar"}
</button>
</div>
<div className="party-grid">
<label>
{"Nombre de la mesa"}
<input data-field="name" type="text" required={true} maxLength={250} disabled={true} />
</label>
<label>
{"Precio total (₲)"}
<input data-field="price" type="number" required={true} maxLength={250} min="0" step="1" disabled={true} />
</label>
<label>
{"Personas por mesa"}
<input data-field="people" type="number" required={true} maxLength={250} min="1" step="1" disabled={true} />
</label>
<label>
{"Cantidad de mesas"}
<input data-field="qty" type="number" required={true} maxLength={250} min="1" step="1" disabled={true} />
</label>
<label>
{"¿Incluye entradas?"}
<select data-field="admission" required={true} disabled={true}>
<option value="">
{"Elegí"}
</option>
<option>
{"Sí"}
</option>
<option>
{"No"}
</option>
<option>
{"Por confirmar"}
</option>
</select>
</label>
<label>
{"Consumo incluido (₲) · opcional"}
<input data-field="credit" type="number" maxLength={250} min="0" step="1" disabled={true} />
</label>
<label>
{"Bebidas y otros incluidos"}
<input data-field="includes" type="text" maxLength={250} disabled={true} />
</label>
</div>
</div>
</div>
<button className="party-add" data-add="table" type="button">
{"+ Agregar otro tipo de mesa"}
</button>
</div>
<label className="party-full">
{"WhatsApp para vender o reservar mesas"}
<input maxLength={500} name="table_phones" placeholder="+595 981 123456, +595 982 654321" required={true} type="text" disabled={true} />
<span className="party-hint">
{"Si hay varios números, separalos con comas."}
</span>
</label>
</div>
<p className="party-hint party-full" data-condition="tables-pending" hidden={true}>
{"La propuesta puede avanzar. Te pediremos confirmar las mesas antes de publicarlas."}
</p>
</div>
</section>
<section className="party-step" data-step="3" hidden={true}>
<div className="party-step-heading">
<h3 tabIndex={-1}>
{"Material y contacto"}
</h3>
<p>
{"Último paso: con quién hablamos y qué publicamos."}
</p>
</div>
<div className="party-grid">
<label className="">
{"Organizador / productora"}
<input maxLength={300} name="organizer" placeholder="" required={true} type="text" />
</label>
<label className="">
{"Persona responsable"}
<input maxLength={300} name="responsible" placeholder="" required={true} type="text" />
</label>
<label className="">
{"WhatsApp del responsable"}
<input maxLength={300} name="contact_phone" placeholder="+595 981 123456" required={true} type="tel" />
</label>
<label className="">
{"Correo · opcional"}
<input maxLength={300} name="contact" placeholder="nombre@correo.com" type="email" />
</label>
<div className="party-full party-announcement">
<div className="party-announcement-top">
<span>
{"Anuncio oficial"}
</span>
<button aria-pressed="false" id="party-unpublished" type="button">
{"Aún no publiqué"}
</button>
</div>
<label className="party-full">
{"Enlace al anuncio"}
<input maxLength={300} name="source" placeholder="https://instagram.com/…" required={true} type="url" />
</label>
</div>
<label>
{"Flyer o foto del evento / local"}
<select name="material_mode" required={true}>
<option value="link">
{"Tengo un enlace con el material"}
</option>
<option value="whatsapp">
{"Lo mando por WhatsApp"}
</option>
</select>
</label>
<div className="party-full" data-condition="material-link">
<label className="party-full">
{"Enlace al flyer o las fotos"}
<input maxLength={300} name="material_url" placeholder="https://…" required={true} type="url" />
</label>
</div>
<p className="party-hint party-full" data-condition="material-whatsapp" hidden={true}>
{"Adjuntá al menos un flyer o foto al enviar el mensaje. Los archivos no se adjuntan automáticamente."}
</p>
<details className="party-more party-full">
<summary>
{"Agregar más detalles · opcional"}
</summary>
<div className="party-grid">
<label className="party-full">
{"Información adicional"}
<textarea maxLength={700} name="notes" placeholder="Instagram, aclaraciones o datos que todavía estén por confirmar." rows={2}>
</textarea>
</label>
</div>
</details>
</div>
</section>
<div className="party-wizard-nav">
<button className="party-back" id="party-prev" type="button">
{"Atrás"}
</button>
<span id="party-step-count">
{"1 de 4"}
</span>
<button className="party-submit" id="party-next" type="submit">
{"Continuar →"}
</button>
</div>
<p className="party-wizard-note">
{"La propuesta se envía por WhatsApp. Publicación sujeta a revisión."}
</p>
</form>
<section aria-live="polite" hidden={true} id="party-review">
<h3 tabIndex={-1}>
{"Tu propuesta está preparada"}
</h3>
<p>
{"Revisá el mensaje y confirmá su envío en WhatsApp."}
</p>
<pre id="party-message-preview">
</pre>
<p hidden={true} id="party-material-reminder">
{"Recordá adjuntar al menos un flyer o foto en WhatsApp."}
</p>
<a id="party-whatsapp-link" rel="noopener noreferrer" target="_blank">
{"Abrir WhatsApp ↗"}
</a>
<p>
<button className="party-back" type="button">
{"Volver y editar"}
</button>
</p>
</section>
</dialog>
</div>
</div>);}

