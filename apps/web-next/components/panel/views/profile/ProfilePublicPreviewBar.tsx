import { useMemo, useState } from "react";
import { Clock, MapPin, Navigation, Phone } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/panel/ui";
import { GALLERY_KIND_LABELS, type LocalGalleryItem } from "@/lib/panel";
import { PreviewGalleryModal } from "@/components/panel/views/profile/PreviewGalleryModal";
import { type Promo } from "@/lib/promos";
import { ProfilePromosSection } from "@/components/panel/views/profile/ProfilePromosSection";
import { ProfileReservationsSection } from "@/components/panel/views/profile/ProfileReservationsSection";

type BarTileKind = "menu" | "food" | "drinks" | "interior";

const BAR_TILE_ORDER: BarTileKind[] = ["food", "interior", "menu", "drinks"];

const FALLBACK_INFO = [
  "Estacionamiento disponible",
  "Acceso para personas con discapacidad",
  "WiFi gratuito",
  "Aceptamos tarjetas de credito",
  "Ambiente climatizado",
];

interface ProfilePublicPreviewBarProps {
  name: string;
  heroImageUrl: string | null;
  gallery: LocalGalleryItem[];
  address: string;
  location: string;
  city: string;
  hours: string[];
  additionalInfo: string[];
  phone: string;
  whatsapp: string;
  promos: Promo[];
  promosLoading: boolean;
  promosError: string | null;
}

export function ProfilePublicPreviewBar({
  name,
  heroImageUrl,
  gallery,
  address,
  location,
  city,
  hours,
  additionalInfo,
  phone,
  whatsapp,
  promos,
  promosLoading,
  promosError,
}: ProfilePublicPreviewBarProps) {
  const [activeKind, setActiveKind] = useState<BarTileKind | null>(null);

  const safeName = name || "Nombre del bar";
  const safeAddress = address || safeName;
  const safeLocation = [location, city].filter(Boolean).join(", ") || "Asuncion, Paraguay";
  const safeHours = hours.length > 0 ? hours : ["Horario pendiente"];
  const safeContact = phone || whatsapp || "Sin contacto";
  const safeInfo = additionalInfo.length > 0 ? additionalInfo : FALLBACK_INFO;

  const imagesByKind = useMemo(() => {
    return BAR_TILE_ORDER.reduce<Record<BarTileKind, LocalGalleryItem[]>>((acc, kind) => {
      acc[kind] = gallery.filter((item) => item.kind === kind);
      return acc;
    }, { menu: [], food: [], drinks: [], interior: [] });
  }, [gallery]);

  const modalImages = activeKind
    ? imagesByKind[activeKind].map((item, index) => ({
        src: item.url,
        alt: `${safeName} - ${GALLERY_KIND_LABELS[activeKind]} ${index + 1}`,
      }))
    : [];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Vista previa publica (Bar)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="w-full">
            <div className="grid h-[400px] grid-cols-2 gap-3 lg:h-[500px] lg:grid-cols-4">
              <div className="relative col-span-2 row-span-2 overflow-hidden rounded-xl bg-neutral-100">
                {heroImageUrl ? (
                  <img
                    src={heroImageUrl}
                    alt={`Hero de ${safeName}`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                    Imagen principal no cargada
                  </div>
                )}
              </div>

              {BAR_TILE_ORDER.map((kind) => {
                const imageUrl = imagesByKind[kind][0]?.url ?? null;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setActiveKind(kind)}
                    className="relative overflow-hidden rounded-xl bg-neutral-100 text-left"
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={GALLERY_KIND_LABELS[kind]}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-neutral-500">Sin imagen</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
                      <p className="text-base font-bold text-white sm:text-lg">{GALLERY_KIND_LABELS[kind]}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <ProfileReservationsSection />

          <ProfilePromosSection
            title="Promos del bar"
            promos={promos}
            loading={promosLoading}
            error={promosError}
          />

          <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 sm:space-y-6 sm:p-6">
            <h3 className="text-xl font-bold text-neutral-900 sm:text-2xl">Ubicacion</h3>
            <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch lg:gap-6">
              <div className="lg:col-span-2">
                <div className="flex h-full min-h-[360px] items-center justify-center rounded-2xl border border-neutral-200 bg-neutral-100 lg:min-h-0">
                  <p className="text-sm text-neutral-500">Mapa no disponible</p>
                </div>
              </div>

              <div className="space-y-4 lg:flex lg:h-full lg:flex-col">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="mt-0.5 h-5 w-5 text-neutral-900" />
                      <div>
                        <p className="font-semibold text-neutral-900">Direccion</p>
                        <p className="break-words text-sm text-neutral-600">{safeAddress}</p>
                        <p className="break-words text-sm text-neutral-600">{safeLocation}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-5 w-5 text-neutral-900" />
                      <div>
                        <p className="font-semibold text-neutral-900">Horarios</p>
                        <div className="space-y-1 text-sm text-neutral-600">
                          {safeHours.slice(0, 5).map((line) => (
                            <p key={line} className="break-words whitespace-pre-wrap">{line}</p>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-5 w-5 text-neutral-900" />
                      <div>
                        <p className="font-semibold text-neutral-900">Contacto</p>
                        <p className="break-words text-sm text-neutral-600">{safeContact}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
                    >
                      <Navigation className="h-4 w-4" />
                      Como llegar
                    </button>
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-900"
                    >
                      <Phone className="h-4 w-4" />
                      Llamar
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-4 lg:flex-1">
                  <p className="font-semibold text-neutral-900">Informacion adicional</p>
                  <div className="mt-3 space-y-2 text-sm text-neutral-600">
                    {safeInfo.slice(0, 5).map((item) => (
                      <p key={item}>• {item}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      <PreviewGalleryModal
        open={activeKind != null}
        title={activeKind ? `Galeria de ${GALLERY_KIND_LABELS[activeKind]} - ${safeName}` : "Galeria"}
        images={modalImages}
        onClose={() => setActiveKind(null)}
      />
    </>
  );
}
