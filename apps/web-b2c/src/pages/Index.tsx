import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import TairetInfoSection from "@/components/TairetInfoSection";
import FeaturedVenuesSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import { useEffect, useRef, useState } from "react";
import rooftopCard from "@/assets/rooftop-card.png";
import afterOfficeCard from "@/assets/after-office-card.png";
import tairetLockup from "@/assets/tairet/tairet-lockup.png";
import { images } from "@/lib/images";
import ExperiencesCarousel from "@/components/ExperiencesCarousel";
import CoverflowCarousel from "@/components/CoverflowCarousel";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const [heroOverlayTarget, setHeroOverlayTarget] = useState<string | null>(null);
  const zonesSectionRef = useRef<HTMLElement | null>(null);
  const experiencesSectionRef = useRef<HTMLElement | null>(null);
  const showHeroOverlay =
    import.meta.env.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("heroOverlay") === "1";

  useEffect(() => {
    let cancelled = false;

    if (!showHeroOverlay || !import.meta.env.DEV) {
      setHeroOverlayTarget(null);
      return () => {
        cancelled = true;
      };
    }

    import("@/assets/tairet/hero-overlay-target.png")
      .then((module) => {
        if (!cancelled) setHeroOverlayTarget(module.default);
      })
      .catch(() => {
        if (!cancelled) setHeroOverlayTarget(null);
      });

    return () => {
      cancelled = true;
    };
  }, [showHeroOverlay]);

  const scrollToSection = (section: HTMLElement | null) => {
    if (typeof window === "undefined" || !section) return;

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const offset = isMobile ? 76 : 84;
    const top = section.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: "smooth",
    });
  };

  const handleExploreCities = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      navigate("/explorar");
      return;
    }

    scrollToSection(zonesSectionRef.current);
  };

  const handleViewExperiences = () => {
    scrollToSection(experiencesSectionRef.current);
  };

  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative isolate min-h-[78vh] overflow-hidden bg-slate-950 sm:min-h-[80vh] md:min-h-[88vh] lg:min-h-[94vh]">
        <div
          className="absolute inset-0 scale-[1.03] bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${images.landing.hero})`,
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.84)_0%,rgba(2,6,23,0.58)_28%,rgba(2,6,23,0.68)_62%,rgba(2,6,23,0.9)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.14),transparent_26%),radial-gradient(circle_at_50%_32%,rgba(141,19,19,0.28),transparent_46%),radial-gradient(circle_at_50%_100%,rgba(15,23,42,0.72),transparent_38%)]" />
        <div className="absolute inset-0 opacity-45 bg-[linear-gradient(120deg,rgba(255,255,255,0.06)_0%,transparent_24%,rgba(255,255,255,0.04)_48%,transparent_74%)]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-background via-background/55 to-transparent" />

        {showHeroOverlay && heroOverlayTarget && (
          <img
            src={heroOverlayTarget}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 z-[999] h-full w-full object-cover object-center opacity-40"
          />
        )}
        
        {/* Hero Content */}
        <div className="relative z-10 mx-auto flex min-h-[78vh] w-full max-w-[1240px] items-center justify-center px-5 pb-24 pt-24 text-center sm:min-h-[80vh] sm:px-8 sm:pb-24 sm:pt-28 md:min-h-[88vh] md:pb-28 md:pt-32 lg:min-h-[94vh] lg:px-10 lg:pb-32 lg:pt-36">
          <div className="w-full max-w-[940px]">
            <div className="flex flex-col items-center gap-5 sm:gap-7 md:gap-8 lg:gap-10">
              <div className="inline-flex items-center justify-center rounded-full border border-white/14 bg-white/[0.06] px-3.5 py-2.5 shadow-[0_22px_70px_-32px_rgba(0,0,0,0.75)] backdrop-blur-sm sm:px-5 sm:py-3 md:px-6">
                <img
                  src={tairetLockup}
                  alt="Tairet"
                  className="pointer-events-none select-none h-[28px] w-auto object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.45)] sm:h-[36px] md:h-[44px] lg:h-[54px] xl:h-[60px]"
                />
              </div>

              <div className="space-y-3.5 sm:space-y-5 md:space-y-6">
                <h1 className="mx-auto max-w-[11.5ch] text-[40px] font-black leading-[0.92] tracking-[-0.04em] text-white sm:text-[58px] md:text-[72px] lg:text-[88px] xl:text-[96px]">
                  <span className="block">Explorá la noche</span>
                  <span className="mt-1.5 block sm:mt-2 md:mt-2.5">
                    con <span className="text-[#a11717]">Tairet</span>
                  </span>
                </h1>

                <p className="mx-auto max-w-[34rem] text-[15px] leading-[1.55] text-white/76 sm:max-w-[42rem] sm:text-[18px] md:max-w-[760px] md:text-[20px] lg:text-[22px]">
                  Descubrí los mejores bares y discotecas en tu ciudad, reservá tu mesa y encontrá planes para salir con una experiencia más simple, clara y premium.
                </p>
              </div>

              <div className="flex w-full max-w-sm flex-col items-center justify-center gap-3 pt-2 sm:max-w-none sm:flex-row sm:gap-4">
                <Button
                  type="button"
                  size="lg"
                  onClick={handleExploreCities}
                  className="h-11 w-full min-w-[190px] rounded-full bg-white px-6 text-sm font-semibold text-slate-950 shadow-[0_18px_48px_-22px_rgba(255,255,255,0.55)] hover:bg-white/92 sm:w-auto"
                >
                  Explorar ciudades
                </Button>

                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={handleViewExperiences}
                  className="h-11 w-full min-w-[190px] rounded-full border-white/16 bg-white/[0.08] px-6 text-sm font-semibold text-white backdrop-blur-sm hover:bg-white/[0.14] hover:text-white sm:w-auto"
                >
                  Ver experiencias
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Three Info Blocks Section - Moved here before city selection */}
      <TairetInfoSection />
      
      {/* City Selection Section - Fever Style */}
      <section ref={zonesSectionRef} id="zonas" className="py-8 md:py-10 px-6 md:px-12 bg-background">
        <div className="max-w-6xl mx-auto">
          {/* Popular Zones Section */}
          <div>
            <h3 className="text-2xl font-semibold text-foreground mb-6">Zonas populares</h3>
          </div>

          {/* Mobile: Carousel, Desktop: Grid */}
          <div className="lg:hidden overflow-hidden -mx-6 md:-mx-12">
            <div className="px-6 md:px-12">
              <ExperiencesCarousel aspectRatio="square" items={[{
              src: images.zones.asuncion,
              title: "Asunción",
              href: "/zona/asuncion"
            }, {
              src: images.zones.sanBernardino,
              title: "San Bernardino",
              href: "/zona/san-bernardino"
            }, {
              src: images.zones.ciudadDelEste,
              title: "Ciudad del Este",
              href: "/zona/ciudad-del-este"
            }]} />
            </div>
          </div>
          
          {/* Desktop: Grid */}
          <div className="hidden lg:block">
          <div className="grid grid-cols-3 gap-6">
            <Link to="/zona/asuncion" className="group block">
              <div className="relative aspect-square w-auto overflow-hidden rounded-2xl ring-1 ring-border/50 bg-muted/5 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 cursor-pointer">
                <img src={images.zones.asuncion} alt="Asunción - zona nocturna" loading="lazy" decoding="async" fetchPriority="low" draggable={false} className="h-full w-full object-cover select-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white drop-shadow-lg text-center">
                    Asunción
                  </h3>
                </div>
              </div>
            </Link>

            <Link to="/zona/san-bernardino" className="group block">
              <div className="relative aspect-square w-auto overflow-hidden rounded-2xl ring-1 ring-border/50 bg-muted/5 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 cursor-pointer">
                <img src={images.zones.sanBernardino} alt="San Bernardino - zona nocturna" loading="lazy" decoding="async" fetchPriority="low" draggable={false} className="h-full w-full object-cover select-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white drop-shadow-lg text-center">
                    San Bernardino
                  </h3>
                </div>
              </div>
            </Link>

            <Link to="/zona/ciudad-del-este" className="group block">
              <div className="relative aspect-square w-auto overflow-hidden rounded-2xl ring-1 ring-border/50 bg-muted/5 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 cursor-pointer">
                <img src={images.zones.ciudadDelEste} alt="Ciudad del Este - zona nocturna" loading="lazy" decoding="async" fetchPriority="low" draggable={false} className="h-full w-full object-cover select-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white drop-shadow-lg text-center">
                    Ciudad del Este
                  </h3>
                </div>
              </div>
            </Link>
            </div>
          </div>
        </div>
      </section>
      
      {/* Experiencias - Carrusel horizontal */}
      <section ref={experiencesSectionRef} id="experiencias" className="py-8 md:py-10 px-6 md:px-12 bg-background overflow-visible lg:overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Experiencias destacadas</h2>
          <CoverflowCarousel
            initialIndex={1}
            items={[
              {
                src: rooftopCard,
                title: "Rooftop",
                href: "/experiencias/rooftop",
              },
              {
                src: afterOfficeCard,
                title: "After Office",
                href: "/experiencias/after-office",
              },
              {
                src: images.landing.experiences.promotions,
                title: "Promociones",
                href: "/experiencias/promociones",
              },
              {
                src: images.landing.experiences.events,
                title: "Eventos",
                href: "/eventos",
              },
            ]}
          />
        </div>
      </section>
      
      {/* Featured Venues Section */}
      
      
      {/* Featured Venues Section */}
      <FeaturedVenuesSection />
      
      {/* Footer */}
      <Footer />
      
      {/* Safe bottom space for mobile to avoid overlap and unify spacing */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      
      {/* Bottom Navigation */}
      <BottomNavbar />
    </div>;
};
export default Index;
