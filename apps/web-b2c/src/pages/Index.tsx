import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import TairetInfoSection from "@/components/TairetInfoSection";
import FeaturedVenuesSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import { useEffect, useState } from "react";
import rooftopCard from "@/assets/rooftop-card.png";
import afterOfficeCard from "@/assets/after-office-card.png";
import tairetLockup from "@/assets/tairet/tairet-lockup.png";
import { images } from "@/lib/images";
import ExperiencesCarousel from "@/components/ExperiencesCarousel";
import { Link } from "react-router-dom";

const Index = () => {
  const [heroOverlayTarget, setHeroOverlayTarget] = useState<string | null>(null);
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

  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />
      
      {/* Hero Section */}
      <section className="min-h-[50vh] sm:min-h-[60vh] md:min-h-[69vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.6)), url(${images.landing.hero})`
      }} />
        
        {/* Background pattern/texture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />

        {showHeroOverlay && heroOverlayTarget && (
          <img
            src={heroOverlayTarget}
            alt=""
            aria-hidden="true"
            className="pointer-events-none select-none absolute inset-0 z-[999] h-full w-full object-cover object-center opacity-40"
          />
        )}
        
        {/* Hero Content */}
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="mx-auto w-full max-w-[1180px] px-6 text-center">
            <div className="flex flex-col items-center gap-5 -translate-y-4 sm:gap-6 md:gap-7 md:-translate-y-6 lg:gap-8 lg:-translate-y-8">
              <div className="flex items-center justify-center">
                <img
                  src={tairetLockup}
                  alt="Tairet"
                  className="pointer-events-none select-none h-[28px] w-auto object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.55)] sm:h-[34px] md:h-[42px] lg:h-[52px] xl:h-[58px]"
                />
              </div>

              <h1 className="mx-auto text-[40px] font-extrabold leading-[0.96] tracking-[-0.02em] text-white sm:text-[52px] md:text-[60px] lg:text-[74px] xl:text-[82px]">
                <span className="block">Explorá la noche</span>
                <span className="mt-1 block sm:mt-1.5 md:mt-2">
                  con <span className="text-[#8d1313]">Tairet</span>
                </span>
              </h1>

              <p className="mx-auto max-w-[980px] text-[15px] leading-[1.32] text-white/80 sm:text-[18px] md:text-[20px] lg:text-[22px]">
                Descubrí los mejores bares y discotecas en tu ciudad. Reservá tu mesa y
                <br className="hidden md:block" /> viví experiencias únicas.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Three Info Blocks Section - Moved here before city selection */}
      <TairetInfoSection />
      
      {/* City Selection Section - Fever Style */}
      <section className="py-8 md:py-10 px-6 md:px-12 bg-background">
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
      <section className="py-8 md:py-10 px-6 md:px-12 bg-background overflow-visible lg:overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Experiencias destacadas</h2>
        </div>
        <div className="-mx-6 md:mx-0">
          <div className="px-6 md:px-0">
            <ExperiencesCarousel startIndex={1} items={[{
            src: rooftopCard,
            title: "Rooftop",
            href: "/experiencias/rooftop"
          }, {
            src: afterOfficeCard,
            title: "After Office",
            href: "/experiencias/after-office"
          }, {
            src: images.landing.experiences.promotions,
            title: "Promociones",
            href: "/experiencias/promociones"
          }, {
            src: images.landing.experiences.events,
            title: "Eventos",
            href: "/eventos"
          }]} />
          </div>
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
