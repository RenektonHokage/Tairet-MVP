import { Clock3, Music2, Star, Wine } from "lucide-react";

interface ListingPreviewCardProps {
  localType: "bar" | "club";
  name: string;
  imageUrl: string | null;
  location?: string | null;
  city?: string | null;
  attributes?: string[];
  minAge?: number | null;
  hours?: string[];
  rating?: number | null;
  className?: string;
}

export function ListingPreviewCard({
  localType,
  name,
  imageUrl,
  location,
  city,
  attributes = [],
  minAge = null,
  hours = [],
  rating = null,
  className,
}: ListingPreviewCardProps) {
  // Layout ported from apps/web-b2c/src/components/shared/VenueCard.tsx
  const title = name.trim() || "Nombre del local";
  const locationLine = [location, city].filter(Boolean).join(" • ");
  const schedule = hours.find((line) => line.trim().length > 0) ?? "";
  const chips = attributes.filter(Boolean).slice(0, 3);
  const ageChip = typeof minAge === "number" && minAge > 0 ? `+${minAge}` : "";
  const FeatureIcon = localType === "bar" ? Wine : Music2;
  const hasFooterBadges = chips.length > 0 || Boolean(ageChip);

  return (
    <article
      className={`flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 sm:min-h-[340px] ${className ?? ""}`.trim()}
    >
      <div className="relative h-40 overflow-hidden bg-neutral-100 sm:h-44">
        {imageUrl ? (
          <img src={imageUrl} alt={`Vista previa de ${title}`} className="h-full w-full object-cover object-center" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-400">Sin foto de perfil</div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6">
        <div className="mb-2 flex min-w-0 items-start justify-between gap-3">
          <p className="min-w-0 truncate font-bold text-neutral-900">{title}</p>
          {typeof rating === "number" ? (
            <span className="flex flex-shrink-0 items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {rating.toFixed(1)}
            </span>
          ) : null}
        </div>

        {schedule ? (
          <p className="mb-3 flex min-w-0 items-center text-sm text-neutral-500">
            <Clock3 className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="min-w-0 truncate">{schedule}</span>
          </p>
        ) : null}

        {locationLine ? (
          <p className="mb-3 min-w-0 line-clamp-1 text-sm text-neutral-500">{locationLine}</p>
        ) : null}

        <div className="flex-1" />

        {hasFooterBadges ? (
          <div className="flex max-h-[56px] min-w-0 flex-wrap gap-2 overflow-hidden">
            {chips.map((chip) => (
              <span
                key={chip}
                className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600"
              >
                <FeatureIcon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{chip}</span>
              </span>
            ))}
            {ageChip ? (
              <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-600">
                {ageChip}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
