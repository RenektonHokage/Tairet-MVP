import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import TairetInfoSection from "@/components/TairetInfoSection";
import FeaturedVenuesSection from "@/components/TestimonialsSection";
import Footer from "@/components/Footer";
import asuncionCityscape from "@/assets/asuncion-cityscape.jpg";
import sanberDistrict from "@/assets/sanber-district.jpg";
import ciudadDelEste from "@/assets/ciudad-del-este.jpg";
import comingSoonCard from "@/assets/coming-soon-card.jpg";
import afterOffice from "@/assets/after-office.jpg";
import reggaeton from "@/assets/bar-scene.jpg";
import techno from "@/assets/boliche-club.jpg";
import djGuests from "@/assets/dj-guests.jpg";
import promotions from "@/assets/spring-break-promo.jpg";
import carouselEventos from "@/assets/carousel_eventos.png";
import heroNightlife from "@/assets/hero-nightlife.jpg";
import featuredVenueHeader from "@/assets/featured-venue-header.png";
import rooftopCard from "@/assets/rooftop-card.png";
import afterOfficeCard from "@/assets/after-office-card.png";
import nightclubLights from "@/assets/hero-nightlife-main.webp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";
import CoverflowCarousel from "@/components/CoverflowCarousel";
import ExperiencesCarousel from "@/components/ExperiencesCarousel";
import { Link } from "react-router-dom";
const Index = () => {
  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />
      
      {/* Hero Section */}
      <section className="min-h-[50vh] sm:min-h-[60vh] md:min-h-[69vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 bg-cover bg-center" style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.6)), url(${nightclubLights})`
      }} />
        
        {/* Background pattern/texture */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        
        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center justify-center lg:px-12 sm:py-6 md:py-8 max-w-4xl mx-auto text-center min-h-0 flex-1 px-[24px] py-[75px] lg:py-[139px]">
          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 lg:mb-8 leading-tight">
            Explorá la noche
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              con Tairet
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg lg:text-xl text-white/80 mb-6 lg:mb-12 max-w-2xl leading-relaxed">Descubrí los mejores bares y discotecas en tu ciudad. Reservá tu mesa y viví experiencias únicas.</p>
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
              src: asuncionCityscape,
              title: "Asunción",
              href: "/zona/asuncion"
            }, {
              src: sanberDistrict,
              title: "San Bernardino",
              href: "/zona/san-bernardino"
            }, {
              src: ciudadDelEste,
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
                <img src={asuncionCityscape} alt="Asunción - zona nocturna" loading="lazy" decoding="async" fetchPriority="low" draggable={false} className="h-full w-full object-cover select-none" />
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
                <img src={sanberDistrict} alt="San Bernardino - zona nocturna" loading="lazy" decoding="async" fetchPriority="low" draggable={false} className="h-full w-full object-cover select-none" />
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
                <img src={ciudadDelEste} alt="Ciudad del Este - zona nocturna" loading="lazy" decoding="async" fetchPriority="low" draggable={false} className="h-full w-full object-cover select-none" />
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
      <section className="py-8 md:py-10 px-6 md:px-12 bg-background overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-foreground mb-6">Experiencias destacadas</h2>
        </div>
        <ExperiencesCarousel startIndex={1} items={[{
        src: rooftopCard,
        title: "Rooftop",
        href: "/experiencias/rooftop"
      }, {
        src: afterOfficeCard,
        title: "After Office",
        href: "/experiencias/after-office"
      }, {
        src: featuredVenueHeader,
        title: "Promociones",
        href: "/experiencias/promociones"
      }, {
        src: featuredVenueHeader,
        title: "Eventos",
        href: "/eventos"
      }]} />
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
