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

const BarPromotions: React.FC<BarPromotionsProps> = ({ promotions, localId }) => {

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

      {/* Mobile: Embla carousel with touch support */}
      <div className="md:hidden">
        <BaseCarousel
          className="scrollbar-hide"
          containerClassName="gap-4"
          options={{ dragFree: true, align: "start" }}
        >
          {promotions.map((promo) => (
            <Card 
              key={promo.id}
              className="overflow-hidden hover:shadow-lg transition-shadow duration-300 cursor-pointer w-[280px] sm:w-[300px]"
              onClick={() => handleOpenPromo(promo)}
            >
              <div className="aspect-[4/3] relative">
                <img 
                  src={promo.image} 
                  alt={promo.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-white font-semibold text-lg">{promo.title}</h3>
                </div>
              </div>
            </Card>
          ))}
        </BaseCarousel>
      </div>

      {/* Desktop: Grid layout */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
        {promotions.map((promo) => (
          <Card 
            key={promo.id} 
            className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group cursor-pointer"
            onClick={() => handleOpenPromo(promo)}
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
                <div className="flex items-center gap-2 mt-2 text-white/80 text-sm">
                  <Calendar className="w-4 h-4" />
                  <span>Válido hoy</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

    </section>
  );
};

export default BarPromotions;