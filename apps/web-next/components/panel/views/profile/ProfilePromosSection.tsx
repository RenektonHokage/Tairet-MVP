import { Calendar, Clock } from "lucide-react";

import { type Promo } from "@/lib/promos";

interface ProfilePromosSectionProps {
  title: string;
  promos: Promo[];
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
  maxItems?: number;
}

const DEFAULT_EMPTY_MESSAGE = "Aun no tenes promociones publicadas";

export function ProfilePromosSection({
  title,
  promos,
  loading,
  error,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  maxItems = 6,
}: ProfilePromosSectionProps) {
  const activePromos = promos.filter((promo) => promo.is_active !== false);
  const visiblePromos = activePromos.slice(0, maxItems);
  const isCarousel = visiblePromos.length > 3;

  const promoCards = visiblePromos.map((promo) => (
    <article key={promo.id} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="relative aspect-[4/3] overflow-hidden">
        {promo.image_url ? (
          <img
            src={promo.image_url}
            alt={promo.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-sm text-neutral-500">
            Sin imagen
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-4 bottom-4 text-white">
          <p className="line-clamp-2 text-lg font-semibold">{promo.title}</p>
          <p className="mt-2 inline-flex items-center gap-1 text-sm text-white/90">
            <Calendar className="h-4 w-4" />
            Valido hoy
          </p>
        </div>
      </div>
    </article>
  ));

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-neutral-900 sm:text-2xl">{title}</h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
          <Clock className="h-3.5 w-3.5" />
          Actualizadas hoy
        </span>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          {error}
        </div>
      ) : visiblePromos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center text-sm text-neutral-600">
          {emptyMessage}
        </div>
      ) : (
        <>
          {isCarousel ? (
            <div className="w-full overflow-x-auto overflow-y-hidden scroll-smooth">
              <div className="flex flex-nowrap gap-4 snap-x snap-mandatory">
                {promoCards.map((card, index) => (
                  <div
                    key={visiblePromos[index].id}
                    className="w-[80%] flex-none snap-start sm:w-[60%] lg:w-[calc((100%-2rem)/3)]"
                  >
                    {card}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {promoCards}
            </div>
          )}
          {activePromos.length > maxItems ? (
            <div className="text-right text-sm font-medium text-neutral-500">Ver mas</div>
          ) : null}
        </>
      )}
    </section>
  );
}
