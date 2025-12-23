import { useEffect } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, CalendarCheck, PartyPopper } from "lucide-react";
import FAQAccordion from "@/components/FAQAccordion";
import Navbar from "@/components/layout/Navbar";

const CONTENT: Record<string, Record<string, { title: string; description: string }>> = {
  sobre: {
    "que-es-tairet": {
      title: "¿Qué es Tairet?",
      description:
        "Descubrí qué es Tairet: una plataforma para explorar, descubrir y vivir experiencias nocturnas y de entretenimiento en Paraguay.",
    },
    vision: {
      title: "Nuestra visión",
      description:
        "Conectamos personas y locales para crear experiencias memorables, impulsando el crecimiento del ecosistema nocturno y cultural.",
    },
    faq: {
      title: "Preguntas frecuentes",
      description:
        "Respondemos las preguntas más comunes sobre el funcionamiento de Tairet, seguridad, reservas y más.",
    },
  },
  locales: {
    "publica-tu-local": {
      title: "Publicá tu local",
      description:
        "Presentá tu bar o discoteca en Tairet. Completá el formulario de registro para aparecer en la plataforma.",
    },
    "como-funciona": {
      title: "Cómo funciona Tairet para locales",
      description:
        "Guía rápida para empezar: administración de perfil, promociones, visibilidad y herramientas para tu local.",
    },
    beneficios: {
      title: "Beneficios y visibilidad en la plataforma",
      description:
        "Aumentá tu alcance con presencia destacada, promociones y herramientas de análisis para impulsar tu negocio.",
    },
  },
  legal: {
    "terminos-y-condiciones": {
      title: "Términos y condiciones",
      description:
        "Leé los términos y condiciones de uso de Tairet. Conocé tus derechos y responsabilidades como usuario.",
    },
    "politica-de-privacidad": {
      title: "Política de privacidad",
      description:
        "Cómo protegemos tus datos y qué información recolectamos al utilizar Tairet.",
    },
    cookies: {
      title: "Cookies",
      description:
        "Información sobre el uso de cookies, finalidades y cómo administrar tus preferencias.",
    },
  },
};

export default function SimpleInfoPage() {
  const { slug, "*": rest } = useParams();
  const location = useLocation();

  const [section] = location.pathname.split("/").filter(Boolean); // sobre | locales | legal
  const data = CONTENT[section as keyof typeof CONTENT]?.[slug ?? ""] as
    | { title: string; description: string }
    | undefined;

  const title = data?.title ?? "Contenido";
  const description = data?.description ?? "Información de Tairet.";

  const isQueEs = section === "sobre" && (slug ?? "") === "que-es-tairet";
  const isFAQ = section === "sobre" && (slug ?? "") === "faq";

  useEffect(() => {
    document.title = `${title} | Tairet`;

    let descTag = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!descTag) {
      descTag = document.createElement("meta");
      descTag.name = "description";
      document.head.appendChild(descTag);
    }
    descTag.content = description;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + location.pathname;
  }, [title, description, location.pathname]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className={isFAQ ? "" : "max-w-5xl mx-auto px-6 py-10"}>
        {isFAQ ? (
          <section
            aria-labelledby="faq-heading"
            className="py-16 lg:py-24 bg-white border-t-8 border-black"
          >
            <div className="container mx-auto px-6">
              <div className="max-w-4xl mx-auto">
                <h1
                  id="faq-heading"
                  className="text-4xl md:text-6xl font-black text-black mb-12 text-center leading-none"
                >
                  PREGUNTAS FRECUENTES
                </h1>
                <FAQAccordion />
              </div>
            </div>
          </section>
        ) : isQueEs ? (
          <article className="max-w-3xl mx-auto">
            <section aria-labelledby="que-es-tairet">
              <h2 id="que-es-tairet" className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">¿Qué es Tairet?</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Tairet te conecta con los bares y discotecas más destacados de tu ciudad. Encontrá fotos reales, horarios, ubicación, disponibilidad de mesas y promociones. Planificá tu salida y asegurá tu lugar antes de llegar.
              </p>
            </section>

            <section aria-labelledby="como-funciona" className="mt-12">
              <h3 id="como-funciona" className="text-xl font-semibold text-foreground">Cómo funciona</h3>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
                <div className="rounded-xl border bg-card text-card-foreground p-6 motion-safe:animate-fade-in">
                  <MapPin aria-hidden="true" className="h-8 w-8 text-primary" />
                  <h4 className="mt-4 font-semibold">Elegí dónde ir</h4>
                  <p className="mt-1 text-sm text-muted-foreground">Explorá por zonas o categorías.</p>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground p-6 motion-safe:animate-fade-in">
                  <CalendarCheck aria-hidden="true" className="h-8 w-8 text-primary" />
                  <h4 className="mt-4 font-semibold">Reservá tu mesa</h4>
                  <p className="mt-1 text-sm text-muted-foreground">Confirmación por correo con código QR.</p>
                </div>
                <div className="rounded-xl border bg-card text-card-foreground p-6 motion-safe:animate-fade-in">
                  <PartyPopper aria-hidden="true" className="h-8 w-8 text-primary" />
                  <h4 className="mt-4 font-semibold">Viví la experiencia</h4>
                  <p className="mt-1 text-sm text-muted-foreground">Presentá tu QR en el ingreso.</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="cta-final" className="mt-16 sm:mt-20">
              <div className="relative overflow-hidden rounded-2xl border bg-card text-card-foreground px-6 py-12 sm:px-12 sm:py-16">
                <div className="pointer-events-none absolute -top-12 -left-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-12 -right-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
                <p className="text-6xl sm:text-7xl lg:text-8xl font-extrabold leading-none tracking-tight">TAIRET</p>
                <p className="mt-4 text-base sm:text-lg text-muted-foreground">La plataforma definitiva para la vida nocturna en Paraguay</p>
                <div className="mt-6">
                  <Button asChild size="lg" aria-label="Explorar ahora">
                    <Link to="/">Explorar ahora</Link>
                  </Button>
                </div>
              </div>
            </section>
          </article>
        ) : (
          <article className="prose prose-neutral max-w-none">
            <p>
              Próximamente encontrarás aquí el contenido completo de "{title}". Si necesitás información puntual, escribinos a{" "}
              <a href="mailto:tairet.py@gmail.com" className="underline">tairet.py@gmail.com</a>.
            </p>
          </article>
        )}
      </main>
    </div>
  );
}
