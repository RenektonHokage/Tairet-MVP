import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import asset2 from "../../assets/prelaunch/approved-e477bda28dd75c.webp";
import asset3 from "../../assets/prelaunch/approved-e5b841b9b6f0e2.webp";
import asset4 from "../../assets/prelaunch/approved-87d272ff09db9d.webp";

export function MapPage(){return (<section aria-labelledby="tu-map-title" className="tf-page r4" data-page="mapa">
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
{"Estamos incorporando los primeros bares, discotecas y eventos. Mientras tanto, consultá la guía de Halloween 2026 o sumá tu local."}
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

export function ContactPage(){return (<section aria-labelledby="tf-contact-title" className="tf-page tf-new-page r4" data-page="contact">
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
<a data-contact-channel="whatsapp" href="https://wa.me/595972827780" rel="noopener noreferrer" target="_blank">
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

export function BarOwnerPage(){return (<section aria-labelledby="tf-venue-bar-title" className="tf-page tf-new-page r4" data-page="venue-bar">
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

export function ClubOwnerPage(){return (<section aria-labelledby="tf-venue-club-title" className="tf-page tf-new-page r4" data-page="venue-club">
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

export function OrganizerPage(){return (<section aria-labelledby="tf-organizers-title" className="tf-page tf-new-page r4" data-page="organizers">
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
<Link className="tf-btn" to="/contacto">
{"Consultar por mi evento"}
<svg aria-hidden="true" className="icon" viewBox="0 0 24 24">
<path d="M5 12h14m-5-5 5 5-5 5">
</path>
</svg>
</Link>
</div>
<figure className="r4-photo">
<img alt="Público frente a un escenario de un evento nocturno" data-tf-image="eventos" src={asset4} height={760} loading="lazy" style={{"objectPosition":"50% 50%"} as CSSProperties} width={800} />
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
