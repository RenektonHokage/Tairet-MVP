import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { trackPromoOpen } from '@/lib/api';
import { BaseCarousel } from '@/components/BaseCarousel';
import { getRealPromoId } from '@/lib/promoIdMap';

interface Promotion {
  id: string; // UUID string
  title: string;
  image: string;
}

interface BarPromotionsProps {
  promotions: Promotion[];
  localId: string;
}

// Unified Promo Card - same visual size for grid and carousel
const PromoCard: React.FC<{ promo: Promotion; onClick: () => void; showDate?: boolean }> = ({ 
  promo, 
  onClick,
  showDate = false 
}) => (
  <Card 
    className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group cursor-pointer w-full"
    onClick={onClick}
  >
    <div className="aspect-[4/3] relative overflow-hidden">
      <img 
        src={promo.image} 
        alt={promo.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-4 left-4 right-4">
        <h3 className="text-white font-semibold text-lg">{promo.title}</h3>
        {showDate && (
          <div className="flex items-center gap-2 mt-2 text-white/80 text-sm">
            <Calendar className="w-4 h-4" />
            <span>Válido hoy</span>
          </div>
        )}
      </div>
    </div>
  </Card>
);

const BarPromotions: React.FC<BarPromotionsProps> = ({ promotions, localId }) => {
  // Desktop: use carousel if more than 3 promos to prevent layout wrap
  const shouldCarouselDesktop = promotions.length > 3;

  const handleOpenPromo = (promo: Promotion) => {
    // Guard clause: si no hay promo o localId, no trackear
    if (!promo || !localId) {
      return;
    }
    // Obtener UUID real de la promo (mapeo de título a UUID de DB)
    // Para bares, usar mapeo legacy por título solo
    const realPromoId = getRealPromoId({ title: promo.title, fallbackId: promo.id });
    // trackPromoOpen valida internamente si es UUID válido y envía el request
    void trackPromoOpen(localId, realPromoId, "bar_promo_card");
  };

  if (!promotions || promotions.length === 0) {
    return (
      <section className="space-y-4 sm:space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Promos del bar</h2>
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex items-center justify-center py-12 text-center">
            <div className="space-y-2">
              <p className="text-muted-foreground">No hay promociones disponibles en este momento</p>
              <p className="text-sm text-muted-foreground">¡Mantente atento para futuras ofertas!</p>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Promos del bar</h2>
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Actualizadas hoy
        </Badge>
      </div>

      {/* Mobile: Always carousel with fixed-width slides */}
      <div className="md:hidden">
        <BaseCarousel
          className="scrollbar-hide"
          containerClassName="gap-4"
          slideClassName="!basis-[280px] sm:!basis-[300px]"
          options={{ dragFree: true, align: "start" }}
        >
          {promotions.map((promo) => (
            <PromoCard
              key={promo.id}
              promo={promo}
              onClick={() => handleOpenPromo(promo)}
            />
          ))}
        </BaseCarousel>
      </div>

      {/* Desktop: Grid if <=3, Carousel with 3-per-view if >3 */}
      <div className="hidden md:block">
        {shouldCarouselDesktop ? (
          <BaseCarousel
            className="scrollbar-hide"
            containerClassName="gap-6"
            slideClassName="!basis-[calc(33.333%-16px)]"
            options={{ dragFree: true, align: "start" }}
          >
            {promotions.map((promo) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                onClick={() => handleOpenPromo(promo)}
                showDate
              />
            ))}
          </BaseCarousel>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {promotions.map((promo) => (
              <PromoCard
                key={promo.id}
                promo={promo}
                onClick={() => handleOpenPromo(promo)}
                showDate
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default BarPromotions;
