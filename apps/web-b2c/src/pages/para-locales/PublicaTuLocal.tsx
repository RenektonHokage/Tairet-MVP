import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, Megaphone, BarChart3, Calendar, Percent, Sparkles, Users, Star, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import metricConsultas from "@/assets/metric-consultas.jpg";
import metricVisitas from "@/assets/metric-visitas.jpg";
import metricRedes from "@/assets/metric-redes.jpg";
import metricResenas from "@/assets/metric-resenas.jpg";

type VenueType = "bar" | "club";

interface ToolCard {
  title: string;
  text: string;
  bullets: string[];
}

const TOOLS_CONTENT_BY_VENUE_TYPE: Record<VenueType, ToolCard[]> = {
  bar: [{
    title: "Herramientas de perfil y presencia",
    text: "Gestioná la presentación de tu local y mantené tu perfil siempre actualizado para convertir más visitas en contactos y reservas.",
    bullets: ["Editá portada, galería, ubicación, contacto y acceso directo a WhatsApp.", "Configurá horarios semanales por día con franjas horarias y estado abierto/cerrado.", "Mantené tu información alineada a la operación real del local."]
  }, {
    title: "Calendario y operación",
    text: "Organizá la operación del local con una vista clara por fecha para tomar decisiones más rápidas durante la semana.",
    bullets: ["Consultá el calendario del local y el detalle operativo diario en una sola vista.", "Registrá y ajustá reservas del día para mantener control de disponibilidad.", "Centralizá el seguimiento de movimiento del local desde el panel."]
  }, {
    title: "Audiencia y métricas",
    text: "Entendé cómo interactúan los clientes con tu perfil y qué acciones generan mejores resultados.",
    bullets: ["Seguí visitas al perfil y clics a WhatsApp por período.", "Visualizá el rendimiento de reservas generadas desde Tairet.", "Leé el comportamiento de tu audiencia para optimizar horarios y publicación."]
  }, {
    title: "Rendimiento comercial",
    text: "Tomá decisiones con una vista ordenada del desempeño de tu local dentro de Tairet.",
    bullets: ["Controlá reservas recibidas y su estado operativo.", "Seguí la actividad por fecha para detectar picos de demanda.", "Usá la información para mejorar gestión y planificación semanal."]
  }],
  club: [{
    title: "Herramientas de perfil y catálogo",
    text: "Administrá la imagen de tu discoteca y configurá tu oferta comercial desde un solo panel.",
    bullets: ["Editá portada, galería, ubicación, contacto y acceso directo a WhatsApp.", "Configurá horarios semanales por día con franjas horarias y estado abierto/cerrado.", "Gestioná entradas y mesas con catálogo activo, precios y disponibilidad."]
  }, {
    title: "Calendario y operación",
    text: "Organizá cada fecha con una vista operativa pensada para la dinámica de eventos y noches de alta demanda.",
    bullets: ["Consultá el calendario del local y el detalle operativo por jornada.", "Ajustá disponibilidad y seguimiento de movimiento según la fecha.", "Accedé a la gestión de entradas y check-in desde el flujo del panel."]
  }, {
    title: "Audiencia y métricas",
    text: "Medí el interés del público y el desempeño de tus fechas para optimizar resultados.",
    bullets: ["Seguí visitas al perfil y clics de contacto por período.", "Visualizá ventas y comportamiento del público dentro de Tairet.", "Identificá qué fechas y acciones responden mejor."]
  }, {
    title: "Analítica y resultados",
    text: "Consolidá indicadores clave para evaluar el rendimiento comercial de tu discoteca.",
    bullets: ["Monitoreá entradas vendidas, utilizadas y estado operativo.", "Seguí ingresos generados desde la plataforma.", "Usá datos para ajustar estrategia, fechas y oferta."]
  }]
};

const WHATSAPP_APPLY_MESSAGE =
  "Hola, quiero publicar mi local en Tairet y recibir información para aplicar como socio.";
const WHATSAPP_APPLY_URL = `https://wa.me/595981628109?text=${encodeURIComponent(WHATSAPP_APPLY_MESSAGE)}`;
const EMAIL_APPLY_SUBJECT = "Quiero publicar mi local en Tairet";
const EMAIL_APPLY_BODY = [
  "Hola equipo de Tairet, quiero recibir información para publicar mi local en la plataforma.",
  "",
  "Nombre del local:",
  "Ciudad:",
  "Nombre y cargo:",
  "Teléfono:",
  "Instagram (opcional):",
].join("\n");
const EMAIL_APPLY_URL = `mailto:tairet.contacto@gmail.com?subject=${encodeURIComponent(EMAIL_APPLY_SUBJECT)}&body=${encodeURIComponent(EMAIL_APPLY_BODY)}`;

const PublicaTuLocal = () => {
  const [venueType, setVenueType] = useState<VenueType>("bar");
  useEffect(() => {
    document.title = "Publicá tu local (Mesas) | Tairet";
    const desc = "Sumá visibilidad, gestioná mesas y promociones, y obtené analíticas claras en Tairet.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);
  return <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <Button asChild variant="ghost" aria-label="Volver a la landing">
            <Link to="/" className="inline-flex items-center">
              <ArrowLeft aria-hidden className="mr-2" />
              <span>Volver</span>
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              ¿Ya tenés tu local registrado?
            </span>
            <Button variant="outline" size="sm" asChild>
              <a href="https://tairet-mvp-web-next.vercel.app/" target="_blank" rel="noopener noreferrer">
                Ir al panel
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative border-b">
          <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Publicá tu local en Tairet</h1>
              <p className="mt-4 text-muted-foreground max-w-2xl">
                Más visibilidad en la noche, reservas ágiles de mesas y promociones en minutos. Tu local con datos claros para crecer.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href={EMAIL_APPLY_URL} aria-label="Enviar correo">
                    Enviar correo
                  </a>
                </Button>
                <Button variant="secondary" size="lg" asChild>
                  <a
                    href={WHATSAPP_APPLY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Hablar por WhatsApp"
                  >
                    Hablar por WhatsApp
                  </a>
                </Button>
              </div>
              <ul className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
                {[{
                icon: Eye,
                text: "Más visibilidad"
              }, {
                icon: BarChart3,
                text: "Estadísticas claras"
              }].map((i, idx) => <li key={idx} className="flex items-center gap-2">
                    <i.icon className="h-4 w-4" aria-hidden /> {i.text}
                  </li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section className="border-b">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Beneficios</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {[{
              icon: Eye,
              title: "Visibilidad en la plataforma",
              text: "Aparecé frente a miles de personas buscando dónde salir."
            }, {
              icon: Megaphone,
              title: "Promociones destacadas",
              text: "Impulsá tus mesas con promos programadas y visibles."
            }, {
              icon: Users,
              title: "Gestión de mesas y precios",
              text: "Definí categorías, capacidad y precios por franja horaria."
            }, {
              icon: BarChart3,
              title: "Analítica y rendimiento",
              text: "Entendé visitas, consultas y ocupación para optimizar."
            }].map((b, idx) => <Card key={idx} className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <b.icon className="h-5 w-5" aria-hidden />
                      <CardTitle className="text-base md:text-lg">{b.title}</CardTitle>
                    </div>
                    <CardDescription>{b.text}</CardDescription>
                  </CardHeader>
                </Card>)}
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA */}
        <section className="border-b">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Cómo funciona</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[{
              icon: CheckCircle2,
              title: "Aplicá con tu local",
              text: "Completá una solicitud sencilla en minutos."
            }, {
              icon: Sparkles,
              title: "Creá tu perfil",
              text: "Sumá fotos, info, horarios y detalles clave."
            }, {
              icon: Percent,
              title: "Publica mesas promos y entradas",
              text: "Definí mesas, franjas y activá promociones."
            }, {
              icon: BarChart3,
              title: "Medí y optimizá",
              text: "Analizá métricas y mejorá resultados."
            }].map((s, idx) => <Card key={idx}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <s.icon className="h-5 w-5" aria-hidden />
                      <CardTitle className="text-base">{s.title}</CardTitle>
                    </div>
                    <CardDescription>{s.text}</CardDescription>
                  </CardHeader>
                </Card>)}
            </div>
          </div>
        </section>

        {/* HERRAMIENTAS */}
        <section className="border-b">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Herramientas</h2>
            <Tabs
              value={venueType}
              onValueChange={(value) => setVenueType(value === "club" ? "club" : "bar")}
              className="mt-6"
            >
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="bar">Bares</TabsTrigger>
                <TabsTrigger value="club">Discotecas</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {TOOLS_CONTENT_BY_VENUE_TYPE[venueType].map((tool, idx) => <Card key={idx}>
                  <CardHeader>
                    <CardTitle className="text-lg">{tool.title}</CardTitle>
                    <CardDescription>{tool.text}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid gap-2 text-sm text-muted-foreground">
                      {tool.bullets.map((b, i) => <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" aria-hidden /> {b}
                        </li>)}
                    </ul>
                  </CardContent>
                </Card>)}
            </div>
          </div>
        </section>

        {/* CASOS / MÉTRICAS / TESTIMONIOS */}
        <section className="border-b">
          
        </section>

        {/* FAQ */}
        <section className="border-b">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Preguntas frecuentes</h2>
            <Accordion type="single" collapsible className="mt-6">
              {[{
              q: "¿Cómo doy de alta mi local?",
              a: "Completá la solicitud y nuestro equipo te contacta."
            }, {
              q: "¿Qué fotos necesito?",
              a: "Portada, galería del ambiente y mesas destacadas."
            }, {
              q: "¿Cuánto demora la aprobación?",
              a: "Entre 24 y 72 hs según verificación de datos."
            }, {
              q: "¿Cómo destaco mis promociones?",
              a: "Podés programarlas y fijarlas en horarios clave."
            }, {
              q: "¿Puedo ocultar reseñas?",
              a: "Se pueden ocultar si incumplen normas, nunca borrar."
            }, {
              q: "¿Cómo gestiono horarios?",
              a: "Definí franjas por día y fechas especiales."
            }].map((f, i) => <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger>{f.q}</AccordionTrigger>
                  <AccordionContent>{f.a}</AccordionContent>
                </AccordionItem>)}
            </Accordion>
          </div>
        </section>

      </main>
    </div>;
};
export default PublicaTuLocal;
