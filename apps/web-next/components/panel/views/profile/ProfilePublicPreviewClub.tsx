import { useMemo, useState } from "react";
import { ChevronDown, Clock, Grid3X3, MapPin, Music2, Navigation, Phone, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/panel/ui";
import { type CatalogTable, type CatalogTicket, type LocalGalleryItem } from "@/lib/panel";
import { PreviewGalleryModal } from "@/components/panel/views/profile/PreviewGalleryModal";
import { type Promo } from "@/lib/promos";
import { ProfilePromosSection } from "@/components/panel/views/profile/ProfilePromosSection";

const FALLBACK_INFO = [
  "Estacionamiento valet disponible",
  "Dress code: Elegante",
  "Entrada solo +18 con documento",
  "Reservas recomendadas",
  "Sistema de sonido profesional",
];

interface ProfilePublicPreviewClubProps {
  name: string;
  heroImageUrl: string | null;
  gallery: LocalGalleryItem[];
  address: string;
  location: string;
  city: string;
  hours: string[];
  additionalInfo: string[];
  minAge: number | null;
  attributes: string[];
  phone: string;
  whatsapp: string;
  tickets: CatalogTicket[];
  tables: CatalogTable[];
  promos: Promo[];
  promosLoading: boolean;
  promosError: string | null;
}

type TicketPreview = {
  id: string;
  name: string;
  price: number;
  description?: string | null;
};

type TablePreview = {
  id: string;
  name: string;
  price: number | null;
  capacity: number | null;
  includes?: string | null;
};

const DEFAULT_TICKET_PLACEHOLDERS: TicketPreview[] = [
  { id: "placeholder-free", name: "Entrada free", price: 0, description: null },
  { id: "placeholder-general", name: "Entrada general", price: 50000, description: null },
];

const DEFAULT_TABLE_PLACEHOLDERS: TablePreview[] = [
  { id: "placeholder-vip", name: "Mesa VIP", capacity: 12, price: 450000, includes: null },
  { id: "placeholder-premium", name: "Mesa premium", capacity: 15, price: 2500000, includes: null },
];

function formatGs(value: number): string {
  return `${value.toLocaleString("es-PY")} Gs`;
}

function parseBenefits(text?: string | null): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function ProfilePublicPreviewClub({
  name,
  heroImageUrl,
  gallery,
  address,
  location,
  city,
  hours,
  additionalInfo,
  minAge,
  attributes,
  phone,
  whatsapp,
  tickets,
  tables,
  promos,
  promosLoading,
  promosError,
}: ProfilePublicPreviewClubProps) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [openTicketBenefits, setOpenTicketBenefits] = useState<Record<string, boolean>>({});
  const [openTableBenefits, setOpenTableBenefits] = useState<Record<string, boolean>>({});

  const safeName = name || "Nombre de la discoteca";
  const safeAddress = address || safeName;
  const safeLocation = [location, city].filter(Boolean).join(", ") || "Asuncion, Paraguay";
  const safeHours = hours.length > 0 ? hours : ["Horario pendiente"];
  const shortSchedule = safeHours[0] ?? "Horario pendiente";
  const safeContact = phone || whatsapp || "Sin contacto";
  const safeInfo = additionalInfo.length > 0 ? additionalInfo : FALLBACK_INFO;

  const chips: string[] = [];
  chips.push(minAge ? `+${minAge}` : "+21");
  chips.push(...attributes.slice(0, 2));
  while (chips.length < 3) {
    chips.push(chips.length === 1 ? "Cocktails" : "Electronica");
  }

  const activeTickets: TicketPreview[] = tickets
    .filter((ticket) => ticket.is_active)
    .slice(0, 3)
    .map((ticket) => ({
      id: ticket.id,
      name: ticket.name,
      price: ticket.price,
      description: ticket.description,
    }));
  const displayTickets = activeTickets.length > 0 ? activeTickets : DEFAULT_TICKET_PLACEHOLDERS;

  const activeTables: TablePreview[] = tables
    .filter((table) => table.is_active)
    .slice(0, 3)
    .map((table) => ({
      id: table.id,
      name: table.name,
      price: table.price,
      capacity: table.capacity,
      includes: table.includes,
    }));
  const displayTables = activeTables.length > 0 ? activeTables : DEFAULT_TABLE_PLACEHOLDERS;

  const galleryImages = useMemo(() => {
    return gallery
      .filter((item) => item.kind === "carousel" && Boolean(item.url))
      .map((item, index) => ({
        src: item.url,
        alt: `${safeName} ${index + 1}`,
      }));
  }, [gallery, safeName]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Vista previa publica (Discoteca)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <section className="w-full">
            <div className="relative h-[400px] overflow-hidden rounded-xl bg-neutral-900 sm:h-[500px] lg:h-[600px]">
              {heroImageUrl ? (
                <img src={heroImageUrl} alt={`Hero de ${safeName}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                  Imagen principal no cargada
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-6 sm:p-8">
                <div className="flex items-end justify-between gap-4">
                  <div className="space-y-2 text-white">
                    <h3 className="text-2xl font-bold sm:text-3xl">{safeName}</h3>
                    <div className="flex flex-wrap gap-2 text-sm text-white/90 sm:text-base">
                      {chips.map((chip) => (
                        <span key={chip} className="rounded-full border border-white/30 px-3 py-1">
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="flex items-center gap-2 text-sm text-white/90 sm:text-base">
                      <Clock className="h-4 w-4" />
                      {shortSchedule}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-white/90 sm:text-base">
                      <Music2 className="h-4 w-4" />
                      DJ en vivo
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsGalleryOpen(true)}
                    className="rounded-xl border border-white/30 bg-black/40 px-4 py-2 text-sm font-medium text-white"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Grid3X3 className="h-4 w-4" />
                      Ver galeria
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Entradas</h3>
            <div className="grid gap-4">
              {displayTickets.map((ticket) => {
                const benefits = parseBenefits(ticket.description);
                const isOpen = !!openTicketBenefits[ticket.id];

                return (
                  <div key={ticket.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <p className="text-base font-semibold text-neutral-900 sm:text-lg">{ticket.name}</p>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenTicketBenefits((prev) => ({
                              ...prev,
                              [ticket.id]: !prev[ticket.id],
                            }))
                          }
                          className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600"
                        >
                          Ver beneficios
                          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isOpen && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3">
                            {benefits.length > 0 ? (
                              <ul className="space-y-1 text-sm text-slate-600">
                                {benefits.map((benefit) => (
                                  <li key={benefit}>• {benefit}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-500">Sin beneficios cargados (preview)</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {ticket.price === 0 ? (
                          <span className="text-base font-bold text-emerald-600">FREE PASS</span>
                        ) : (
                          <>
                            <span className="text-base font-bold text-neutral-900 sm:text-lg">{formatGs(ticket.price)}</span>
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                              Proximamente (Pagos)
                            </span>
                          </>
                        )}
                        {ticket.price === 0 && (
                          <button
                            type="button"
                            disabled
                            className="rounded-xl border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
                          >
                            Seleccionar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Mesas</h3>
            <div className="grid gap-4">
              {displayTables.map((table) => {
                const benefits = parseBenefits(table.includes);
                const isOpen = !!openTableBenefits[table.id];

                return (
                  <div key={table.id} className="rounded-2xl border border-neutral-200 bg-white p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <p className="flex items-center gap-2 text-base font-semibold text-neutral-900 sm:text-lg">
                          {table.name}
                          {table.capacity ? (
                            <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                              <Users className="h-4 w-4" />
                              {table.capacity}
                            </span>
                          ) : null}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenTableBenefits((prev) => ({
                              ...prev,
                              [table.id]: !prev[table.id],
                            }))
                          }
                          className="mt-2 inline-flex items-center gap-1 text-sm text-slate-600"
                        >
                          Ver beneficios
                          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isOpen && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3">
                            {benefits.length > 0 ? (
                              <ul className="space-y-1 text-sm text-slate-600">
                                {benefits.map((benefit) => (
                                  <li key={benefit}>• {benefit}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-500">Sin beneficios cargados (preview)</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold text-neutral-900 sm:text-lg">
                          {table.price != null ? formatGs(table.price) : "Precio por confirmar"}
                        </span>
                        <button
                          type="button"
                          disabled
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                        >
                          Reservar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <ProfilePromosSection
            title="Promos del local"
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
        open={isGalleryOpen}
        title={`Galeria de ${safeName}`}
        images={galleryImages}
        emptyMessage="Sin imagenes en galeria"
        onClose={() => setIsGalleryOpen(false)}
      />
    </>
  );
}
