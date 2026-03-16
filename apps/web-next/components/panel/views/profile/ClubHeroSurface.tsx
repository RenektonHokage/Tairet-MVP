import type { ReactNode } from "react";
import { Clock, Grid3X3, Music2 } from "lucide-react";

interface ClubHeroSurfaceProps {
  name: string;
  heroImageUrl: string | null;
  chips?: string[];
  shortSchedule?: string | null;
  showPublicMeta?: boolean;
  showLiveMusic?: boolean;
  showHeroTextContent?: boolean;
  eyebrow?: string | null;
  description?: string | null;
  galleryButtonLabel?: string;
  onOpenGallery?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

export function ClubHeroSurface({
  name,
  heroImageUrl,
  chips = [],
  shortSchedule,
  showPublicMeta = true,
  showLiveMusic = true,
  showHeroTextContent = true,
  eyebrow,
  description,
  galleryButtonLabel = "Ver galeria",
  onOpenGallery,
  emptyTitle,
  emptyDescription,
  emptyAction,
}: ClubHeroSurfaceProps) {
  const safeName = name || "Nombre de la discoteca";
  const hasCustomPlaceholder = Boolean(emptyTitle || emptyDescription || emptyAction);

  return (
    <div className="relative h-[400px] overflow-hidden rounded-xl bg-neutral-900 sm:h-[500px] lg:h-[600px]">
      {heroImageUrl ? (
        <img src={heroImageUrl} alt={`Hero de ${safeName}`} className="h-full w-full object-cover" />
      ) : hasCustomPlaceholder ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-neutral-300">
          <div className="space-y-3">
            <div className="text-4xl">🖼️</div>
            <div className="space-y-1">
              {emptyTitle ? <p className="text-base font-medium text-white">{emptyTitle}</p> : null}
              {emptyDescription ? <p className="text-sm text-white/75">{emptyDescription}</p> : null}
            </div>
            {emptyAction ?? null}
          </div>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-neutral-400">
          Imagen principal no cargada
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          {showHeroTextContent ? (
            <div className="space-y-2 text-white">
              {eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/65">{eyebrow}</p>
              ) : null}

              <h3 className="text-2xl font-bold sm:text-3xl">{safeName}</h3>

              {showPublicMeta ? (
                <>
                  {chips.length > 0 ? (
                    <div className="flex flex-wrap gap-2 text-sm text-white/90 sm:text-base">
                      {chips.map((chip) => (
                        <span key={chip} className="rounded-full border border-white/30 px-3 py-1">
                          {chip}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {shortSchedule ? (
                    <p className="flex items-center gap-2 text-sm text-white/90 sm:text-base">
                      <Clock className="h-4 w-4" />
                      {shortSchedule}
                    </p>
                  ) : null}
                  {showLiveMusic ? (
                    <p className="flex items-center gap-2 text-sm text-white/90 sm:text-base">
                      <Music2 className="h-4 w-4" />
                      DJ en vivo
                    </p>
                  ) : null}
                </>
              ) : description ? (
                <p className="max-w-xl text-sm text-white/85 sm:text-base">{description}</p>
              ) : null}
            </div>
          ) : (
            <div aria-hidden="true" />
          )}

          {onOpenGallery ? (
            <button
              type="button"
              onClick={onOpenGallery}
              className="rounded-xl border border-white/30 bg-black/40 px-4 py-2 text-sm font-medium text-white"
            >
              <span className="inline-flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                {galleryButtonLabel}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
