import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, Megaphone, BarChart3, Calendar, Percent, Sparkles, Users, Star, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import metricConsultas from "@/assets/metric-consultas.jpg";
import metricVisitas from "@/assets/metric-visitas.jpg";
import metricRedes from "@/assets/metric-redes.jpg";
import metricResenas from "@/assets/metric-resenas.jpg";
const PublicaTuLocal = () => {
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
            <Button variant="outline" size="sm" disabled>
              Próximamente
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
                  <Link to="/para-locales/solicitud">Aplicar como socio</Link>
                </Button>
                <Button variant="secondary" size="lg" asChild>
                  <a href="#" aria-label="Hablar por WhatsApp">Hablar por WhatsApp</a>
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
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              {[{
              title: "Gestión de mesas y entradas (MVP)",
              text: "Configurá lo esencial para empezar a vender con Tairet, sin complejidad innecesaria.",
              bullets: ["Carga inicial y edición de mesas y entradas: nombre, sector, precio y capacidad fija.", "Panel simple para ver las reservas y compras generadas desde Tairet.", "Ajustes manuales cuando se vende algo por fuera de la plataforma (por ejemplo, reservas telefónicas)."]
            }, {
              title: "Calendario y operación (MVP)",
              text: "Tené a la vista los días en los que Tairet está trayendo gente a tu local.",
              bullets: ["Calendario básico con las fechas y eventos activos publicados en Tairet.", "Bloqueo manual de fechas específicas (eventos privados, reformas, cierre del local).", "Visión rápida de qué días y horarios tienen más movimiento dentro de Tairet."]
            }, {
              title: "Audiencia y métricas básicas",
              text: "Un panel claro para entender, sin complicaciones, cómo se mueve tu público dentro de Tairet.",
              bullets: ["Vistas de perfil: cuántas personas ven tu ficha.", "Clics a WhatsApp: cuántos usuarios hacen clic para contactarte.", "Reservas recibidas y entradas vendidas desde la plataforma.", "Comparación simple por día/semana para ver qué tipo de eventos funcionan mejor."]
            }, {
              title: "Analítica y finanzas (MVP)",
              text: "El foco está en ayudarte a medir el impacto de Tairet en tu negocio, sin volverte loco con reportes.",
              bullets: ["Resumen básico de rendimiento: visitas → reservas → ventas.", "Indicadores simples para entender qué promos y qué fechas rinden mejor.", "Pensado para que más adelante puedas conectar esta información con tu propia gestión financiera interna."]
            }].map((tool, idx) => <Card key={idx}>
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

        {/* CTA FINAL */}
        <section>
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="flex flex-col items-center justify-between gap-4 rounded-lg border bg-card p-6 text-center md:flex-row md:text-left">
              <div>
                <h3 className="text-xl font-semibold">¿Listo para publicar tu local?</h3>
                <p className="text-muted-foreground">Aplicá ahora y sumá tu local a Tairet.</p>
              </div>
              <Button asChild size="lg">
                <Link to="/para-locales/solicitud">Aplicar como socio</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>;
};
export default PublicaTuLocal;