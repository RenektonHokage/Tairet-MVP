import { type ReactNode, useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  Clock3,
  Instagram,
  MapPin,
  Menu,
  Search,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import tairetMark from "@/assets/tairet/tairet-mark.png";

const LANDING_TITLE = "Tairet | Próximamente: bares, discotecas y eventos en Paraguay";
const LANDING_DESCRIPTION =
  "Tairet es la nueva plataforma de vida nocturna en Paraguay. Muy pronto: bares, discotecas, eventos y experiencias en un solo lugar.";
const LANDING_CANONICAL = "https://www.tairet.com.py";
const LANDING_IMAGE = `${LANDING_CANONICAL}/tairet-mark.png`;

const navItems = [
  { label: "Inicio", sectionId: "inicio" },
  { label: "Qué es", sectionId: "que-es" },
  { label: "Para locales", sectionId: "para-locales" },
  { label: "Ciudades", sectionId: "ciudades" },
  { label: "Contacto", sectionId: "contacto" },
] as const;

const stats = [
  { value: "3", label: "Ciudades iniciales" },
  { value: "∞", label: "Experiencias posibles" },
  { value: String(new Date().getFullYear()), label: "Lanzamiento" },
] as const;

const features = [
  {
    title: "Descubrimiento",
    description: "Encontra los mejores lugares de tu ciudad, filtra por tipo, zona y ambiente",
    status: "Muy pronto",
    icon: Search,
  },
  {
    title: "Eventos",
    description: "Todo lo que pasa esta semana, en un solo lugar.",
    status: "Muy pronto",
    icon: CalendarDays,
    highlighted: true,
  },
  {
    title: "Reservas",
    description: "Asegurá tu lugar antes de llegar.",
    status: "Muy pronto",
    icon: Clock3,
  },
  {
    title: "Entradas",
    description: "Acceso a eventos y discotecas con entradas digitales.",
    status: "Muy pronto",
    icon: Ticket,
  },
  {
    title: "Promociones",
    description: "Promociones y beneficios exclusivos por utilizar Tairet.",
    status: "Muy pronto",
    icon: Sparkles,
  },
  {
    title: "Y mucho más por revelar.",
    description: "Una plataforma pensada para crecer con la noche paraguaya desde el día uno.",
    status: "En evolución",
  },
] as const;

const cityCards = [
  {
    number: "01",
    eyebrow: "Ciudad capital",
    title: "Asunción",
    description: "Capital y epicentro de la noche paraguaya.",
  },
  {
    number: "02",
    eyebrow: "Ciudad del verano",
    title: "San Bernardino",
    description: "El destino de verano que nunca duerme.",
  },
  {
    number: "03",
    eyebrow: "Ciudad sin pausa",
    title: "Ciudad del Este",
    description: "Una ciudad que vive las 24 horas.",
  },
] as const;

const headingFont = {
  fontFamily: '"Playfair Display","Iowan Old Style","Palatino Linotype","Book Antiqua",serif',
};

const uiFont = {
  fontFamily: '"Inter","Segoe UI Variable Text","Segoe UI",system-ui,sans-serif',
};

const uiLabelClassName = "text-[11px] uppercase tracking-[0.28em]";
const compactUiLabelClassName = "text-[10px] uppercase tracking-[0.2em] sm:text-[11px] sm:tracking-[0.28em]";

function upsertMeta(kind: "name" | "property", key: string, content: string) {
  let tag = document.head.querySelector(`meta[${kind}="${key}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(kind, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>) {
  let tag = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = rel;
    document.head.appendChild(tag);
  }
  tag.href = href;
  Object.entries(extra ?? {}).forEach(([key, value]) => tag?.setAttribute(key, value));
}

function LandingButton({
  children,
  onClick,
  variant = "secondary",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const baseClassName =
    `inline-flex items-center justify-center rounded-full px-7 py-3 font-normal transition duration-300 ease-out sm:px-8 ${uiLabelClassName}`;
  const variants = {
    primary: "bg-[#efe8df] text-[#0b0b0b] hover:bg-white hover:shadow-[0_0_30px_rgba(255,255,255,0.12)]",
    secondary:
      "border border-white/12 bg-white/[0.02] text-[#f3eee7] hover:border-white/25 hover:bg-white/[0.05]",
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      style={uiFont}
      className={`${baseClassName} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function SectionEyebrow({ index, label }: { index: string; label: string }) {
  return (
    <div className={`mb-8 flex items-center gap-3 text-[#f4efe9] ${uiLabelClassName}`}>
      <span>{index}</span>
      <span aria-hidden="true">—</span>
      <span>{label}</span>
    </div>
  );
}

export default function TemporaryLanding() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollToSection = (sectionId: string) => {
    if (sectionId === "inicio") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setMobileMenuOpen(false);
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    document.title = LANDING_TITLE;
    document.documentElement.lang = "es";

    upsertMeta("name", "description", LANDING_DESCRIPTION);
    upsertMeta("name", "robots", "index, follow");
    upsertMeta("property", "og:title", LANDING_TITLE);
    upsertMeta("property", "og:description", LANDING_DESCRIPTION);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:url", LANDING_CANONICAL);
    upsertMeta("property", "og:image", LANDING_IMAGE);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:site", "@tairetpy");
    upsertMeta("name", "twitter:title", LANDING_TITLE);
    upsertMeta("name", "twitter:description", LANDING_DESCRIPTION);
    upsertMeta("name", "twitter:image", LANDING_IMAGE);

    upsertLink("canonical", LANDING_CANONICAL);
    upsertLink("icon", "/favicon.ico", { type: "image/x-icon" });
    upsertLink("apple-touch-icon", "/tairet-mark.png");
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-[#f4efe9]" style={uiFont}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18%),linear-gradient(180deg,#070707_0%,#050505_45%,#060606_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[24rem] h-[34rem] bg-[radial-gradient(circle_at_center,rgba(123,24,24,0.22),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28rem] bg-[radial-gradient(circle_at_center,rgba(88,20,20,0.20),transparent_58%)]" />

      <header className="sticky top-0 z-50 border-b border-white/8 bg-[#050505]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-5 py-5 sm:px-8">
          <button
            type="button"
            onClick={() => scrollToSection("inicio")}
            className="flex items-center gap-3 text-left text-[#f4efe9] transition hover:opacity-90"
            aria-label="Ir al inicio de la landing"
          >
            <img src={tairetMark} alt="" aria-hidden="true" className="h-8 w-8 object-contain opacity-90" />
            <span className="text-[17px] uppercase tracking-[0.18em]" style={uiFont}>
              Tairet
            </span>
          </button>

          <nav className="hidden items-center gap-10 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.sectionId}
                type="button"
                onClick={() => scrollToSection(item.sectionId)}
                style={uiFont}
                className={`${uiLabelClassName} text-[#9f9a93] transition hover:text-[#f4efe9]`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden lg:block">
            <LandingButton onClick={() => scrollToSection("contacto")}>Sumar mi local</LandingButton>
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] text-[#f4efe9] transition hover:border-white/20 hover:bg-white/[0.06] lg:hidden"
            onClick={() => setMobileMenuOpen((current) => !current)}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/8 bg-[#070707]/95 px-5 py-4 lg:hidden">
            <div className="flex flex-col gap-3">
              {navItems.map((item) => (
                <button
                  key={item.sectionId}
                  type="button"
                  onClick={() => scrollToSection(item.sectionId)}
                  style={uiFont}
                  className={`rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left text-[#d2cdc5] transition hover:bg-white/[0.05] ${uiLabelClassName}`}
                >
                  {item.label}
                </button>
              ))}
              <LandingButton onClick={() => scrollToSection("contacto")} variant="primary">
                Sumar mi local
              </LandingButton>
            </div>
          </div>
        )}
      </header>

      <main className="relative z-10">
        <section id="inicio" className="scroll-mt-28">
          <div className="mx-auto flex min-h-[calc(100vh-81px)] max-w-[1180px] items-center px-5 pb-16 pt-8 sm:px-8 sm:pb-24 sm:pt-10 md:pt-20">
            <div className="relative w-full overflow-hidden rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] px-6 py-16 shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:px-10 sm:py-20 lg:px-16 lg:py-24">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(circle_at_center,rgba(98,17,17,0.28),transparent_60%)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />
              <img
                src={tairetMark}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute right-[-3rem] top-1/2 hidden h-[24rem] w-[24rem] -translate-y-1/2 opacity-[0.035] blur-[1px] lg:block"
              />

              <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                <div className={`mb-10 flex items-center gap-3 text-[#f4efe9] sm:gap-4 ${compactUiLabelClassName}`}>
                  <span className="h-px w-7 bg-white/12 sm:w-8" />
                  <span className="flex items-center gap-2 whitespace-nowrap sm:gap-3">
                    <span>Paraguay</span>
                    <span className="text-white/55">·</span>
                    <span>Nightlife</span>
                  </span>
                  <span className="h-px w-7 bg-white/12 sm:w-8" />
                </div>

                <h1
                  className="max-w-4xl text-[clamp(3.7rem,8vw,7rem)] leading-[0.92] tracking-[-0.04em] text-[#f6f0ea]"
                  style={headingFont}
                >
                  Explora la noche
                </h1>

                <p className="mt-8 max-w-3xl text-[18px] leading-8 text-[#9d988f] sm:text-[21px]">
                  Tairet conecta bares, discotecas y organizadores de eventos con personas que
                  quieren vivir la noche en Paraguay.
                </p>

                <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
                  <LandingButton variant="primary" onClick={() => scrollToSection("contacto")}>
                    Sumar mi local
                  </LandingButton>
                  <LandingButton onClick={() => scrollToSection("que-es")}>Conocer más</LandingButton>
                </div>

                <button
                  type="button"
                  onClick={() => scrollToSection("que-es")}
                  style={uiFont}
                  className={`mt-16 inline-flex flex-col items-center gap-3 text-[#79756f] transition hover:text-[#f4efe9] ${uiLabelClassName}`}
                >
                  <span>Scroll</span>
                  <span className="h-12 w-px bg-gradient-to-b from-white/35 to-transparent" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="que-es" className="scroll-mt-28 border-t border-white/8 py-24 sm:py-28">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <SectionEyebrow index="01" label="Qué es" />

            <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
              <div>
                <h2
                  className="max-w-[9ch] text-[clamp(3rem,7vw,5.5rem)] leading-[0.97] tracking-[-0.04em] text-[#f6f0ea]"
                  style={headingFont}
                >
                  La plataforma que tu local necesita
                </h2>
              </div>

              <div className="space-y-8 pt-2 text-[19px] leading-10 text-[#8e8980]">
                <p>
                  Tairet es la plataforma que conecta tu bar, discoteca o evento con miles de
                  personas que buscan salir en Paraguay. Visibilidad, reservas y herramientas
                  pensadas para el rubro.
                </p>
                <p>
                  Es una presencia digital completa diseñada para que tu local destaque y opere
                  antes, durante y después de cada noche.
                </p>

                <div className="border-t border-white/10 pt-8 text-[18px] text-[#736d65]">
                  Estamos sumando los primeros locales. No te quedes afuera.
                </div>
              </div>
            </div>

            <div className="mt-16 grid gap-px overflow-hidden rounded-[28px] border border-white/8 bg-white/8 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-[#080808] px-6 py-10 text-center transition duration-300 hover:bg-white/[0.03]"
                >
                  <div className="text-[42px] text-[#f5efe8]" style={headingFont}>
                    {stat.value}
                  </div>
                  <div className={`mt-3 text-[#8a857d] ${uiLabelClassName}`}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="para-locales" className="scroll-mt-28 border-t border-white/8 py-24 sm:py-28">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <SectionEyebrow index="02" label="Para quién" />

            <h2
              className="max-w-[14ch] text-[clamp(2.8rem,6vw,4.8rem)] leading-[1] tracking-[-0.04em] text-[#f6f0ea]"
              style={headingFont}
            >
              Pensado para tu negocio
            </h2>

            <div className="mt-14 grid gap-6 lg:grid-cols-2">
              <article className="rounded-[30px] border border-white/10 bg-white/[0.03] p-8 transition duration-300 hover:-translate-y-1 hover:border-white/16 hover:bg-white/[0.04]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-white">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="mt-8 text-[38px] text-[#f6f0ea]" style={headingFont}>
                  Para locales
                </h3>
                <p className="mt-4 text-[18px] leading-8 text-[#8f8a82]">
                  Bares, discotecas y organizadores de eventos que quieren crecer.
                </p>
                <ul className="mt-8 space-y-4 text-[17px] leading-8 text-[#a7a297]">
                  <li>Perfil digital completo y actualizable.</li>
                  <li>Visibilidad directa ante tu público objetivo.</li>
                  <li>Gestión de reservas y entradas en un solo lugar.</li>
                  <li>Acceso a métricas y análisis de tu audiencia.</li>
                </ul>
              </article>

              <article className="rounded-[30px] border border-white/10 bg-white/[0.02] p-8 transition duration-300 hover:-translate-y-1 hover:border-white/16 hover:bg-white/[0.04]">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/8 text-white">
                  <MapPin className="h-5 w-5" />
                </div>
                <h3 className="mt-8 text-[38px] text-[#f6f0ea]" style={headingFont}>
                  Para personas
                </h3>
                <p className="mt-4 text-[18px] leading-8 text-[#8f8a82]">
                  Quienes viven la noche y quieren hacerlo mejor.
                </p>
                <ul className="mt-8 space-y-4 text-[17px] leading-8 text-[#a7a297]">
                  <li>Descubrí tu próximo lugar favorito.</li>
                  <li>Enterate de lo que pasa esta noche.</li>
                  <li>Reservá y comprá entradas sin complicaciones.</li>
                  <li>Acceder a eventos antes que todos.</li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="ciudades" className="scroll-mt-28 border-t border-white/8 py-24 sm:py-28">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <SectionEyebrow index="03" label="Ciudades" />

            <div className="max-w-4xl">
              <h2
                className="text-[clamp(2.9rem,6vw,4.8rem)] leading-[0.98] tracking-[-0.04em] text-[#f6f0ea]"
                style={headingFont}
              >
                  Donde empieza todo
              </h2>
              <p className="mt-6 max-w-3xl text-[19px] leading-9 text-[#8f8a82]">
                Tairet arranca en tres ciudades clave de Paraguay, con visión de crecer a todo el
                país.
              </p>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-white/8 bg-white/8 lg:grid-cols-3">
              {cityCards.map((city) => (
                <article
                  key={city.title}
                  className="group relative overflow-hidden bg-[#080808] px-8 py-12 transition duration-300 hover:bg-white/[0.03]"
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_62%)] opacity-0 transition duration-500 group-hover:opacity-100" />
                  <div className="relative text-[44px] tracking-[-0.04em] text-[#8b867f] transition duration-500 group-hover:text-[#f4efe9]" style={headingFont}>
                    {city.number}
                  </div>
                  <div className={`mt-8 inline-flex rounded-full border border-white/10 px-4 py-2 text-[#8d887f] ${uiLabelClassName}`}>
                    {city.eyebrow}
                  </div>
                  <h3 className="relative mt-8 text-[36px] text-[#f6f0ea] transition duration-500 group-hover:text-white" style={headingFont}>
                    {city.title}
                  </h3>
                  <p className="relative mt-4 max-w-[22ch] text-[18px] leading-8 text-[#8f8a82] transition duration-500 group-hover:text-[#b7b2aa]">
                    {city.description}
                  </p>
                </article>
              ))}
            </div>

            <p className={`mt-10 text-center text-[#7b766f] ${uiLabelClassName}`}>
              Más ciudades en camino
            </p>
          </div>
        </section>

        <section className="border-t border-white/8 py-24 sm:py-28">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <SectionEyebrow index="04" label="Lo que viene" />
                <h2
                  className="max-w-[14ch] text-[clamp(2.8rem,6vw,4.8rem)] leading-[1] tracking-[-0.04em] text-[#f6f0ea]"
                  style={headingFont}
                >
                  Lo que estamos construyendo
                </h2>
              </div>

              <div className={`inline-flex w-fit items-center gap-3 rounded-full border border-white/10 px-5 py-3 text-[#f4efe9] ${uiLabelClassName}`}>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inset-0 rounded-full bg-white/35 blur-[2px] animate-pulse" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)]" />
                </span>
                <span>En desarrollo</span>
              </div>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-white/8 bg-white/8 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <article
                    key={feature.title}
                    className={`min-h-[17rem] bg-[#070707] px-8 py-10 transition duration-300 hover:bg-white/[0.035] ${
                      feature.highlighted ? "bg-white/[0.04]" : ""
                    }`}
                  >
                    {Icon ? (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-[#f4efe9]">
                        <Icon className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="h-11" />
                    )}
                    <h3 className="mt-8 text-[34px] text-[#f6f0ea]" style={headingFont}>
                      {feature.title}
                    </h3>
                    <p className="mt-5 max-w-[22ch] text-[18px] leading-8 text-[#8c877f]">
                      {feature.description}
                    </p>
                    <p className={`mt-8 text-[#746f68] ${uiLabelClassName}`}>
                      {feature.status}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="contacto" className="scroll-mt-28 border-t border-white/8 py-24 sm:py-32">
          <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
            <div className="rounded-[36px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(92,18,18,0.12))] px-6 py-16 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:px-10 sm:py-20">
              <div className="mx-auto max-w-3xl">
                <div className={`mb-8 inline-flex items-center gap-4 text-[#f4efe9] ${uiLabelClassName}`}>
                  <span className="h-px w-8 bg-white/12" />
                  <span>Locales fundadores</span>
                  <span className="h-px w-8 bg-white/12" />
                </div>

                <h2
                  className="text-[clamp(3rem,6vw,5.3rem)] leading-[0.98] tracking-[-0.04em] text-[#f6f0ea]"
                  style={headingFont}
                >
                  Sumate antes del lanzamiento
                </h2>

                <p className="mx-auto mt-8 max-w-2xl text-[19px] leading-9 text-[#99948b]">
                  Los primeros locales en unirse tendrán acceso prioritario, visibilidad destacada y
                  condiciones especiales. Escribinos directamente a{" "}
                  <span className="text-[#f4efe9] underline decoration-white/30 underline-offset-4">
                    tairet.contacto@gmail.com
                  </span>
                  .
                </p>

                <div className="mt-12 flex items-center justify-center gap-5">
                  <span className={`text-[#7d786f] ${uiLabelClassName}`}>Seguinos</span>
                  <a
                    href="https://www.instagram.com/tairetpy/"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Instagram de Tairet"
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#f4efe9] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <Instagram className="h-5 w-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/8 py-6">
        <div className={`mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-5 px-5 text-center text-[#78736b] sm:px-8 lg:flex-row lg:text-left ${uiLabelClassName}`}>
          <div className="flex items-center gap-3 text-[#f4efe9]">
            <img src={tairetMark} alt="" aria-hidden="true" className="h-6 w-6 object-contain opacity-90" />
            <span style={uiFont}>Tairet</span>
          </div>
          <div className="text-[#f4efe9]">Paraguay · Nightlife · {new Date().getFullYear()}</div>
          <div className="rounded-full border border-white/10 px-4 py-2 text-[#8c877f]">Próximamente</div>
        </div>
      </footer>
    </div>
  );
}
