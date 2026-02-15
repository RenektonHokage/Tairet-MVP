import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { BaseCarousel } from "@/components/BaseCarousel";
import Navbar from "@/components/layout/Navbar";
import VenueCard from "@/components/shared/VenueCard";
import BackButton from "@/components/shared/BackButton";
import asuncionCity from "@/assets/asuncion-city.jpg";
import asuncionCityscape from "@/assets/asuncion-cityscape.jpg";
import afterOffice from "@/assets/after-office.jpg";
import promotionsImg from "@/assets/promotions.jpg";
import BarsSection from "@/components/BarsSection";
import { createZoneBars } from "@/lib/data/venues";
import { promosAsuncion } from "@/lib/data/promos";
import type { Club, ZonePromo, ZoneBar } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { selectClubVenues } from "@/lib/venueSelectors";
import { getZoneCoverMaps, type CoverBySlugMap } from "@/lib/localCoverMaps";

const discotecas = selectClubVenues({ city: "asuncion", scope: "zone" });
const promos = promosAsuncion;

// Generate bares with local images
const bares = createZoneBars([asuncionCity, asuncionCityscape, afterOffice, promotionsImg]);
function PromoCard({
  p
}: {
  p: ZonePromo;
}) {
  return <Card className="overflow-hidden">
      <div className="relative">
        <img src={p.img} alt={`${p.title} - Promoción en Asunción`} loading="lazy" decoding="async" className="w-full aspect-[16/9] object-cover" />
        <div className="absolute inset-0 bg-foreground/5 pointer-events-none" />
        <div className="absolute top-2 left-2 pointer-events-none">
          <Badge variant="secondary">Promoción</Badge>
        </div>
      </div>
      <CardContent className="p-4 space-y-2">
        <h3 className="text-sm font-semibold truncate text-foreground">{p.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-3">{p.text}</p>
        <div className="pt-2">
          <Button size="sm">{p.cta}</Button>
        </div>
      </CardContent>
    </Card>;
}
function BarCard({
  b
}: {
  b: ZoneBar;
}) {
  return <Card className="overflow-hidden">
      <div className="relative">
        <img src={b.img} alt={`${b.name} - Bar en Asunción`} loading="lazy" decoding="async" className="w-full aspect-[4/3] object-cover" />
      </div>
      <CardContent className="p-4">
        <h3 className="text-base font-semibold text-foreground">{b.name}</h3>
        <p className="text-sm text-muted-foreground">{b.ambiance}</p>
        <div className="pt-3">
          <Button size="sm" variant="secondary">Ver bar</Button>
        </div>
      </CardContent>
    </Card>;
}
export default function ZonaAsuncion() {
  const [clubCoverBySlug, setClubCoverBySlug] = useState<CoverBySlugMap>(new Map());
  const [barCoverBySlug, setBarCoverBySlug] = useState<CoverBySlugMap>(new Map());

  useEffect(() => {
    let active = true;
    document.title = "Descubrí Asunción | Zonas - Tairet";

    getZoneCoverMaps(100)
      .then(({ clubCovers, barCovers }) => {
        if (!active) return;
        setClubCoverBySlug(clubCovers);
        setBarCoverBySlug(barCovers);
      })
      .catch(() => {
        // Silently fail - current mock images/placeholders remain
      });

    return () => {
      active = false;
    };
  }, []);
  return <>
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
                {discotecas.map((item) => {
                  const clubSlug = slugify(item.name);
                  return (
                    <VenueCard 
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      schedule={item.schedule}
                      rating={item.rating}
                      genres={item.genres}
                      image={clubCoverBySlug.get(clubSlug) || item.customImage}
                      href={`/club/${clubSlug}`}
                      type="club"
                      className="w-[280px] sm:w-[300px] lg:w-auto"
                    />
                  );
                })}
              </BaseCarousel>
            </div>
          )}

          {/* Desktop: Embla carousel with 4 visible and arrows */}
          {discotecas.length > 0 && (
            <div className="hidden lg:block relative">
            <Carousel opts={{
              align: "start",
              loop: false
            }}>
              <CarouselContent className="-ml-6 [&>[role='group']]:pl-6">
                {discotecas.map((item) => {
                  const clubSlug = slugify(item.name);
                  return (
                    <CarouselItem key={item.id} className="basis-1/4">
                      <VenueCard 
                        id={item.id}
                        name={item.name}
                        schedule={item.schedule}
                        rating={item.rating}
                        genres={item.genres}
                        image={clubCoverBySlug.get(clubSlug) || item.customImage}
                        href={`/club/${clubSlug}`}
                        type="club"
                      />
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselPrevious className="hidden lg:flex" />
              <CarouselNext className="hidden lg:flex" />
            </Carousel>
          </div>
          )}
        </div>
      </section>

      

      <BarsSection coverBySlug={barCoverBySlug} />
    </main>
    </>;
}
