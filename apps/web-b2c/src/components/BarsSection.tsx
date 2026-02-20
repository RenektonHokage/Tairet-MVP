import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { BaseCarousel } from '@/components/BaseCarousel';
import VenueCard from '@/components/shared/VenueCard';
import VenueCardSkeleton from '@/components/shared/VenueCardSkeleton';
import type { Bar } from '@/lib/types';
import { slugify } from '@/lib/slug';
import { selectBarVenues } from '@/lib/venueSelectors';
import { prefetchImages } from '@/lib/imagePrefetch';

const BarsSection: React.FC<{
  typeFilter?: string;
  coverBySlug?: Map<string, string>;
  scheduleBySlug?: Map<string, string>;
  isLoading?: boolean;
}> = ({
  typeFilter,
  coverBySlug,
  scheduleBySlug,
  isLoading = false,
}) => {
  let bars = selectBarVenues({ city: "asuncion", scope: "zone" });

  // Mantener compatibilidad si se llega a usar el filtro por tipo.
  if (typeFilter) {
    bars = bars.filter((bar) => {
      if (typeFilter === "bar") return true;
      return bar.type === typeFilter;
    });
  }

  // Dynamic title based on type filter
  const sectionTitle = typeFilter === 'bar' ? 'BARES' : typeFilter === 'boliche' ? 'BOLICHES' : typeFilter === 'evento' ? 'EVENTOS' : 'Bares';

  useEffect(() => {
    if (isLoading) return;
    const topImages = bars.map((item) => {
      const barSlug = slugify(item.name);
      return coverBySlug?.get(barSlug) || item.image;
    });
    prefetchImages(topImages, 8);
  }, [bars, coverBySlug, isLoading]);

  // Si no hay bares después del filtro MVP, mostrar estado vacío
  if (!isLoading && bars.length === 0) {
    return (
      <section className="py-6 md:py-8">
        <div className="px-6">
          <div className="mb-6 lg:mb-8 flex items-center justify-between">
            <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">{sectionTitle}</h2>
          </div>
          <div className="text-center py-12">
            <p className="text-muted-foreground">No hay locales disponibles en este momento.</p>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="py-6 md:py-8">
        <div className="px-6">
          <div className="mb-6 lg:mb-8 flex items-center justify-between">
            <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">{sectionTitle}</h2>
            <Link to="/bares" className="inline-block">
              <Button variant="secondary" size="sm">Ver todo</Button>
            </Link>
          </div>
          <div className="lg:hidden">
            <BaseCarousel
              className="scrollbar-hide"
              containerClassName="gap-4"
              options={{ dragFree: true, align: "start" }}
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`bar-mobile-skeleton-${index}`} className="w-[280px] sm:w-[300px] lg:w-auto">
                  <VenueCardSkeleton />
                </div>
              ))}
            </BaseCarousel>
          </div>
          <div className="hidden lg:block relative">
            <Carousel
              opts={{
                align: "start",
                loop: false,
              }}
            >
              <CarouselContent className="-ml-6 [&>[role='group']]:pl-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <CarouselItem key={`bar-desktop-skeleton-${index}`} className="basis-1/4">
                    <VenueCardSkeleton />
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="hidden lg:flex" />
              <CarouselNext className="hidden lg:flex" />
            </Carousel>
          </div>
        </div>
      </section>
    );
  }

  return <section className="py-6 md:py-8">
      <div className="px-6">
        <div className="mb-6 lg:mb-8 flex items-center justify-between">
          <h2 className="text-2xl lg:text-3xl font-semibold text-foreground">{sectionTitle}</h2>
          <Link to="/bares" className="inline-block">
            <Button variant="secondary" size="sm">Ver todo</Button>
          </Link>
        </div>
        {/* Mobile/Tablet: Embla carousel with touch support */}
        <div className="lg:hidden">
          <BaseCarousel
            className="scrollbar-hide"
            containerClassName="gap-4"
            options={{ dragFree: true, align: "start" }}
          >
            {bars.map((item, index) => {
              const barSlug = slugify(item.name);
              return (
                <VenueCard 
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  // TODO(local-opening-hours.md Etapa 3B): remove fixture fallback once all envs expose today_hours/is_open_today.
                  schedule={scheduleBySlug?.get(barSlug) || item.schedule}
                  rating={item.rating}
                  specialties={item.specialties}
                  image={coverBySlug?.get(barSlug) || item.image}
                  href={`/bar/${barSlug}`}
                  type="bar"
                  className="w-[280px] sm:w-[300px] lg:w-auto"
                  imagePriority={index < 6}
                />
              );
            })}
          </BaseCarousel>
        </div>

        {/* Desktop: Embla carousel with 4 visible and arrows */}
        <div className="hidden lg:block relative">
          <Carousel opts={{
          align: "start",
          loop: false
        }}>
            <CarouselContent className="-ml-6 [&>[role='group']]:pl-6">
              {bars.map((item, index) => {
                const barSlug = slugify(item.name);
                return (
                  <CarouselItem key={item.id} className="basis-1/4">
                    <VenueCard 
                      id={item.id}
                      name={item.name}
                      // TODO(local-opening-hours.md Etapa 3B): remove fixture fallback once all envs expose today_hours/is_open_today.
                      schedule={scheduleBySlug?.get(barSlug) || item.schedule}
                      rating={item.rating}
                      specialties={item.specialties}
                      image={coverBySlug?.get(barSlug) || item.image}
                      href={`/bar/${barSlug}`}
                      type="bar"
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
      </div>
    </section>;
};
export default BarsSection;
