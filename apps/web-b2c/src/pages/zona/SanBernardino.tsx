import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { BaseCarousel } from "@/components/BaseCarousel";
import Navbar from "@/components/layout/Navbar";
import VenueCard from "@/components/shared/VenueCard";
import BackButton from "@/components/shared/BackButton";
import BarsSection from "@/components/BarsSection";
import { discotecasSanBer } from "@/lib/data/venues";
import { slugify } from "@/lib/slug";
import { MVP_CLUB_SLUGS } from "@/lib/mvpSlugs";

// Local alias for compatibility
// Filtrar solo clubs MVP (que tienen perfil real)
const discotecas = discotecasSanBer.filter((club) => {
  const slug = slugify(club.name);
  return MVP_CLUB_SLUGS.includes(slug as any);
});

export default function ZonaSanBernardino() {
  useEffect(() => {
    document.title = "Descubrí San Bernardino | Zonas - Tairet";
  }, []);

  return (
    <>
      {/* Navbar */}
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-20 md:pb-10">
        <BackButton label="Volver a inicio" fallbackTo="/" />
        
        {/* Sección A — Discotecas */}
        <section className="py-6 md:py-8">
          <div className="px-6">
            <div className="mb-6 lg:mb-8 flex items-center justify-between">
              <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">DISCOTECAS</h2>
              <Link to="/discotecas" className="inline-block">
                <Button variant="secondary" size="sm">Ver todo</Button>
              </Link>
            </div>
            {/* Mobile/Tablet: Embla carousel with touch support */}
            {discotecas.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No hay discotecas disponibles en este momento.</p>
              </div>
            ) : (
              <div className="lg:hidden">
                <BaseCarousel
                  className="scrollbar-hide"
                  containerClassName="gap-4"
                  options={{ dragFree: true, align: "start" }}
                >
                  {discotecas.map((item) => (
                  <VenueCard 
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    dateTop={item.dateTop}
                    dateBottom={item.dateBottom}
                    schedule={item.schedule}
                    rating={item.rating}
                    genres={item.genres}
                    image={item.customImage}
                    href={`/club/${slugify(item.name)}`}
                    type="club"
                    className="w-[280px] sm:w-[300px] lg:w-auto"
                  />
                  ))}
                </BaseCarousel>
              </div>
            )}

            {/* Desktop: Embla carousel with 4 visible and arrows */}
            {discotecas.length > 0 && (
              <div className="hidden lg:block relative">
              <Carousel opts={{ align: "start", loop: false }}>
                <CarouselContent className="-ml-6 [&>[role='group']]:pl-6">
                  {discotecas.map((item) => (
                    <CarouselItem key={item.id} className="basis-1/4">
                      <VenueCard 
                        id={item.id}
                        name={item.name}
                        dateTop={item.dateTop}
                        dateBottom={item.dateBottom}
                        schedule={item.schedule}
                        rating={item.rating}
                        genres={item.genres}
                        image={item.customImage}
                        href={`/club/${slugify(item.name)}`}
                        type="club"
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden lg:flex" />
                <CarouselNext className="hidden lg:flex" />
              </Carousel>
            </div>
            )}
          </div>
        </section>

        
        <BarsSection />
      </main>
    </>
  );
}
