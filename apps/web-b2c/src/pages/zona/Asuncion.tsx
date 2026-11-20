import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { BaseCarousel } from "@/components/BaseCarousel";
import Navbar from "@/components/layout/Navbar";
import VenueCard from "@/components/shared/VenueCard";
import VenueCardSkeleton from "@/components/shared/VenueCardSkeleton";
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
import {
  getZoneCoverMaps,
  type AttributesBySlugMap,
  type CoverBySlugMap,
  type MinAgeBySlugMap,
  type TodayScheduleBySlugMap,
} from "@/lib/localCoverMaps";
import { usePublicBars } from "@/hooks/usePublicBars";
import { prefetchImages } from "@/lib/imagePrefetch";

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
  const [discotecas, setDiscotecas] = useState<Club[]>([]);
  const [clubCoverBySlug, setClubCoverBySlug] = useState<CoverBySlugMap>(new Map());
  const [clubScheduleBySlug, setClubScheduleBySlug] = useState<TodayScheduleBySlugMap>(new Map());
  const [clubAttributesBySlug, setClubAttributesBySlug] = useState<AttributesBySlugMap>(new Map());
  const [clubMinAgeBySlug, setClubMinAgeBySlug] = useState<MinAgeBySlugMap>(new Map());
  const [isLoadingCovers, setIsLoadingCovers] = useState(true);
  const { bars: publicBars, isLoading: isLoadingBars } = usePublicBars();
  const bars = useMemo(() => publicBars.filter(bar => bar.city === "Asunción"), [publicBars]);

  useEffect(() => {
    let active = true;
    document.title = "Descubrí Asunción | Zonas - Tairet";

    getZoneCoverMaps()
      .then(({ clubs, clubCovers, clubSchedules, clubAttributes, clubMinAges }) => {
        if (!active) return;
        setDiscotecas(clubs);
        setClubCoverBySlug(clubCovers);
        setClubScheduleBySlug(clubSchedules);
        setClubAttributesBySlug(clubAttributes);
        setClubMinAgeBySlug(clubMinAges);
      })
      .catch(() => {
        // Leave the public club selection empty.
      })
      .finally(() => {
        if (active) {
          setIsLoadingCovers(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isLoadingCovers) return;

    const topClubImages = discotecas.map((item) => {
      const clubSlug = slugify(item.name);
      return clubCoverBySlug.get(clubSlug) || item.customImage;
    });

    prefetchImages([...topClubImages, ...bars.map(bar => bar.image)], 8);
  }, [bars, discotecas, clubCoverBySlug, isLoadingCovers]);
  return <>
      {/* Navbar */}
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-20 md:pb-10">
        <BackButton label="Volver a inicio" fallbackTo="/" />
      

      {/* Sección A — Discotecas */}
      <section className="py-6 md:py-8">
        <div className="px-0 lg:px-6">
          <div className="mb-6 lg:mb-8 flex items-center justify-between">
            <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">DISCOTECAS</h2>
            <Link to="/discotecas" className="inline-block">
              <Button variant="secondary" size="sm">Ver todo</Button>
            </Link>
          </div>
          {/* Mobile/Tablet: Embla carousel with touch support */}
          {isLoadingCovers ? (
            <div className="lg:hidden">
              <BaseCarousel
                className="scrollbar-hide"
                containerClassName="gap-4"
                options={{ dragFree: true, align: "start" }}
              >
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={`club-mobile-skeleton-${index}`} className="w-[280px] sm:w-[300px] lg:w-auto">
                    <VenueCardSkeleton />
                  </div>
                ))}
              </BaseCarousel>
            </div>
          ) : discotecas.length === 0 ? (
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
                {discotecas.map((item, index) => {
                  const clubSlug = slugify(item.name);
                  const genres = clubAttributesBySlug.get(clubSlug) || item.genres;
                  const minAge = clubMinAgeBySlug.get(clubSlug) ?? null;
                  return (
                    <VenueCard 
                      key={item.id}
                      id={item.id}
                      name={item.name}
                      schedule={clubScheduleBySlug.get(clubSlug) ?? "Horario no disponible"}
                      rating={item.rating}
                      genres={genres}
                      image={clubCoverBySlug.get(clubSlug) || item.customImage}
                      href={`/club/${clubSlug}`}
                      type="club"
                      minAge={minAge}
                      className="w-[280px] sm:w-[300px] lg:w-auto"
                      imagePriority={index < 6}
                    />
                  );
                })}
              </BaseCarousel>
            </div>
          )}

          {/* Desktop: Embla carousel with 4 visible and arrows */}
          {isLoadingCovers ? (
            <div className="hidden lg:block relative">
              <Carousel
                opts={{
                  align: "start",
                  loop: false,
                }}
              >
                <CarouselContent className="-ml-6 [&>[role='group']]:pl-6">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <CarouselItem key={`club-desktop-skeleton-${index}`} className="basis-1/4">
                      <VenueCardSkeleton />
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden lg:flex" />
                <CarouselNext className="hidden lg:flex" />
              </Carousel>
            </div>
          ) : discotecas.length > 0 && (
            <div className="hidden lg:block relative">
            <Carousel opts={{
              align: "start",
              loop: false
            }}>
              <CarouselContent className="-ml-6 [&>[role='group']]:pl-6">
                {discotecas.map((item, index) => {
                  const clubSlug = slugify(item.name);
                  const genres = clubAttributesBySlug.get(clubSlug) || item.genres;
                  const minAge = clubMinAgeBySlug.get(clubSlug) ?? null;
                  return (
                    <CarouselItem key={item.id} className="basis-1/4">
                      <VenueCard 
                        id={item.id}
                        name={item.name}
                        schedule={clubScheduleBySlug.get(clubSlug) ?? "Horario no disponible"}
                        rating={item.rating}
                        genres={genres}
                        image={clubCoverBySlug.get(clubSlug) || item.customImage}
                        href={`/club/${clubSlug}`}
                        type="club"
                        minAge={minAge}
                        imagePriority={index < 6}
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

      
      <BarsSection bars={bars} isLoading={isLoadingBars} />
    </main>
    </>;
}
