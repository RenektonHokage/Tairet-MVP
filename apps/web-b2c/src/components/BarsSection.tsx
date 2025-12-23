import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { BaseCarousel } from '@/components/BaseCarousel';
import VenueCard from '@/components/shared/VenueCard';
import { barsSectionVenues } from '@/lib/data/venues';
import type { Bar } from '@/lib/types';
import { slugify } from '@/lib/slug';
import { MVP_BAR_SLUGS } from '@/lib/mvpSlugs';

const BarsSection: React.FC<{
  typeFilter?: string;
}> = ({
  typeFilter
}) => {
  // Filter venues by type if typeFilter is provided
  let bars = typeFilter ? barsSectionVenues.filter(v => v.type === typeFilter) : barsSectionVenues;
  
  // Filtrar solo bares MVP (que tienen perfil real)
  bars = bars.filter((bar) => {
    const slug = slugify(bar.name);
    return MVP_BAR_SLUGS.includes(slug as any);
  });

  // Dynamic title based on type filter
  const sectionTitle = typeFilter === 'bar' ? 'BARES' : typeFilter === 'boliche' ? 'BOLICHES' : typeFilter === 'evento' ? 'EVENTOS' : 'Bares';

  // Si no hay bares después del filtro MVP, mostrar estado vacío
  if (bars.length === 0) {
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
            {bars.map(item => (
              <VenueCard 
                key={item.id}
                id={item.id}
                name={item.name}
                schedule={item.schedule}
                rating={item.rating}
                specialties={item.specialties}
                image={item.image}
                href={`/bar/${slugify(item.name)}`}
                type="bar"
                className="w-[280px] sm:w-[300px] lg:w-auto"
              />
            ))}
          </BaseCarousel>
        </div>

        {/* Desktop: Embla carousel with 4 visible and arrows */}
        <div className="hidden lg:block relative">
          <Carousel opts={{
          align: "start",
          loop: false
        }}>
            <CarouselContent className="-ml-6 [&>[role='group']]:pl-6">
              {bars.map(item => (
                <CarouselItem key={item.id} className="basis-1/4">
                  <VenueCard 
                    id={item.id}
                    name={item.name}
                    schedule={item.schedule}
                    rating={item.rating}
                    specialties={item.specialties}
                    image={item.image}
                    href={`/bar/${slugify(item.name)}`}
                    type="bar"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden lg:flex" />
            <CarouselNext className="hidden lg:flex" />
          </Carousel>
        </div>
      </div>
    </section>;
};
export default BarsSection;