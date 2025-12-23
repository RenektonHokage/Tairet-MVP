import React from 'react';
import { Card } from '@/components/ui/card';

import cardHeaderPlaceholder from '@/assets/card-header-placeholder.png';

const PromotionsSection: React.FC = () => {
  const promos = [
    { image: cardHeaderPlaceholder },
    { image: cardHeaderPlaceholder },
    { image: cardHeaderPlaceholder },
    { image: cardHeaderPlaceholder },
  ];

  return (
    <section className="py-16 px-6" aria-labelledby="promotions-heading">
      <div className="max-w-7xl mx-auto">
        <h2 id="promotions-heading" className="text-foreground text-2xl font-bold mb-8 tracking-wider">
          PROMOCIONES
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {promos.map((promo, idx) => (
            <Card key={idx} className="overflow-hidden">
              <div className="relative aspect-[16/9]">
                <img
                  src={promo.image}
                  alt="Promoción"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PromotionsSection;
