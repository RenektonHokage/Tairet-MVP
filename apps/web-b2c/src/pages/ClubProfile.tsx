import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import BackButton from "@/components/shared/BackButton";
import ProfileSkeleton from "@/components/shared/ProfileSkeleton";
import { useProfileViewOnce } from "@/hooks/useProfileViewOnce";
import { useIsMobile } from "@/hooks/use-mobile";
import { Grid3X3, Clock, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PurchaseSelector from "@/components/shared/PurchaseSelector";
import ClubPromotions from "@/components/club-profile/ClubPromotions";
import ReviewsSection from "@/components/shared/ReviewsSection";
import LazyMapSection from "@/components/shared/LazyMapSection";
import TouchSlideGallery from "@/components/TouchSlideGallery";
import {
  buildDetailHoursLines,
  getDetailTodayScheduleLabelApiFirst,
  getClubAccessCatalog,
  getLocalBySlug,
  getClubCatalog,
  type ClubAccessCatalog,
  type ClubCatalog,
  type LocalInfo,
} from "@/lib/locals";
import { parseBenefits } from "@/lib/parseBenefits";
import { getDemoBrandDisplayName } from "@/lib/demoBrands";

interface ClubProfileData {
  local: LocalInfo;
  catalog: ClubCatalog | null;
  accessCatalog: ClubAccessCatalog | null;
}

const ClubProfile = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const clubId = useParams().clubId?.trim();
  const [profile, setProfile] = useState<ClubProfileData | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    let active = true;
    setSelectedImage(null);
    async function loadProfile() {
      const local = clubId ? await getLocalBySlug(clubId) : null;
      if (!active) return;
      if (!clubId || local?.type !== "club") {
        navigate("/404", { replace: true });
        return;
      }

      const [catalog, accessCatalog] = await Promise.all([
        getClubCatalog(clubId).catch(() => null),
        getClubAccessCatalog(clubId).catch(() => null),
      ]);
      if (active) setProfile({ local, catalog, accessCatalog });
    }
    void loadProfile().catch(() => {
      if (active) navigate("/404", { replace: true });
    });
    return () => { active = false; };
  }, [clubId, navigate]);

  const current = profile && profile.local.slug === clubId ? profile : null;
  useProfileViewOnce(current?.local.id);
  if (!current) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <ProfileSkeleton />
      </div>
    );
  }

  const { local, catalog, accessCatalog } = current;
  const localId = local.id;
  const venueDisplayName = getDemoBrandDisplayName(local.slug, local.name, "club");
  const localTodayScheduleLabel = getDetailTodayScheduleLabelApiFirst(local);
  const localAdditionalInfo = local.additional_info ?? [];
  const contactInfo = { phone: local.phone, whatsapp: local.whatsapp, email: null };
  const tags = [...new Set([
    ...(local.min_age != null ? [`+${local.min_age}`] : []),
    ...(local.attributes ?? []),
  ])];
  const tagBadges = tags.map(tag => (
    <span key={tag} className="border border-current/30 rounded-full px-3 py-1">{tag}</span>
  ));
  const apiPromotions = (local.promotions ?? []).map(p => ({
    id: p.id, title: p.title, image: p.image_url ?? "/placeholder.svg", validity: p.description?.trim() || undefined,
  }));

  const liveMusicLabel = localAdditionalInfo.find((item) => {
    const normalized = item
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return normalized.includes("dj") || normalized.includes("musica") || normalized.includes("live");
  });

  const sortedGallery = [...(local.gallery ?? [])].sort((a, b) => a.order - b.order);
  const carousel = sortedGallery.filter(image => image.kind === "carousel");
  const heroImage = sortedGallery.find(image => image.kind === "hero")?.url ?? carousel[0]?.url;
  const carouselImages = carousel.map(image => ({ src: image.url, alt: `Galería de ${venueDisplayName}` }));
  const heroSlide = heroImage ? [{ src: heroImage, alt: "Imagen principal" }] : [];
  const galleryImages = carouselImages.length ? carouselImages : heroSlide;
  const mobileGalleryImages = [...heroSlide, ...carouselImages.filter(image => image.src !== heroImage)];
  const purchaseTickets = [
    ...((catalog?.tickets ?? [])
      .filter((ticket) => ticket.price <= 0)
      .sort((a, b) => a.price - b.price)
      .map((ticket) => ({
        id: ticket.id,
        ticket_type_id: ticket.id,
        name: ticket.name,
        price: ticket.price,
        description: "",
        benefits: parseBenefits(ticket.description),
      }))),
    ...([...(accessCatalog?.tickets ?? [])]
      .sort((a, b) => a.price_gs - b.price_gs)
      .map((ticket) => ({
        id: ticket.access_ticket_type_id,
        access_ticket_type_id: ticket.access_ticket_type_id,
        name: ticket.name,
        price: ticket.price_gs,
        description: "",
        benefits: parseBenefits(ticket.description),
      }))),
  ];
  const purchaseTables = [...(catalog?.tables ?? [])]
    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
    .map((table) => ({
      id: table.id,
      name: table.name,
      capacity: table.capacity || 0,
      price: table.price || 0,
      drinks: parseBenefits(table.includes),
    }));
  const hasLoadedPurchaseCatalogs = catalog !== null || accessCatalog !== null;

  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
        <BackButton label="Volver a explorar" fallbackTo="/explorar" />
        
        {/* Galería del local */}
        <section className="w-full relative">
          {galleryImages.length === 0 ? (
            /* Placeholder when no images */
            <div className="w-full h-[400px] sm:h-[500px] lg:h-[600px] bg-muted rounded-lg flex flex-col items-center justify-center">
              <h2 className="text-2xl font-bold mb-2">{venueDisplayName}</h2>
              <div className="flex flex-wrap justify-center gap-2 text-sm mb-2">{tagBadges}</div>
              <p className="text-muted-foreground text-sm text-center px-4">
                Fotos no disponibles por el momento
              </p>
            </div>
          ) : isMobile ? (
            <TouchSlideGallery 
              images={mobileGalleryImages}
              hideSlideButton={true}
              overlayContent={
                <div className="absolute bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent w-full p-4 rounded-b-lg">
                  <h2 className="text-white text-xl font-bold mb-2">{venueDisplayName}</h2>
                  <div className="flex flex-wrap gap-2 text-white/90 text-sm mb-2">
                    {tagBadges}
                  </div>
                  <p className="text-white/90 text-sm mb-1 flex items-center gap-2">
                    <Clock size={16} />
                    {localTodayScheduleLabel}
                  </p>
                  {liveMusicLabel ? (
                    <p className="text-white/90 text-sm flex items-center gap-2">
                      <Music size={16} />
                      {liveMusicLabel}
                    </p>
                  ) : null}
                </div>
              }
            />
          ) : (
            <>
              <img src={heroImage} alt={`Galería de ${venueDisplayName}`} className="w-full h-[400px] sm:h-[500px] lg:h-[600px] object-cover rounded-lg" />
              <div className="absolute bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent w-full p-6 sm:p-8 rounded-b-lg">
                <h2 className="text-white text-2xl sm:text-3xl font-bold mb-2">{venueDisplayName}</h2>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-white/90 text-sm sm:text-base mb-2">
                  {tagBadges}
                </div>
                <p className="text-white/90 text-sm sm:text-base mb-1 flex items-center gap-2">
                  <Clock size={16} />
                  {localTodayScheduleLabel}
                </p>
                {liveMusicLabel ? (
                  <p className="text-white/90 text-sm sm:text-base flex items-center gap-2">
                    <Music size={16} />
                    {liveMusicLabel}
                  </p>
                ) : null}
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 flex items-center gap-2 bg-black/40 hover:bg-black/60 text-white border border-white/20"
                  >
                    <Grid3X3 size={16} />
                    Ver galería
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Galería de {venueDisplayName}</DialogTitle>
                  </DialogHeader>
                  {galleryImages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
                      {galleryImages.map((image, index) => (
                        <Card 
                          key={index} 
                          className="overflow-hidden aspect-square cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setSelectedImage(image)}
                        >
                          <img 
                            src={image.src} 
                            alt={image.alt} 
                            className="w-full h-full object-cover"
                          />
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">
                      No hay imágenes disponibles
                    </p>
                  )}
                </DialogContent>
              </Dialog>

              {/* Full Size Image Dialog */}
              <Dialog open={selectedImage !== null} onOpenChange={() => setSelectedImage(null)}>
                <DialogContent className="max-w-7xl max-h-[95vh] p-0">
                  {selectedImage && (
                    <img 
                      src={selectedImage.src} 
                      alt={selectedImage.alt} 
                      className="w-full h-full object-contain"
                    />
                  )}
                </DialogContent>
              </Dialog>
            </>
          )}
        </section>

        {/* Tickets and Table Reservations - DB-first ONLY (sin mocks) */}
        {localId && hasLoadedPurchaseCatalogs && (purchaseTickets.length > 0 || purchaseTables.length > 0) && (
          <PurchaseSelector 
            tickets={purchaseTickets}
            tables={purchaseTables}
            mode="both" 
            title="" 
            subtitle="" 
            onCheckout={() => {}} 
            contactInfo={contactInfo} 
            localId={localId} 
            venueName={venueDisplayName}
          />
        )}
        
        {/* Mensaje cuando el catálogo no está disponible */}
        {localId && !hasLoadedPurchaseCatalogs && (
          <section className="w-full py-8 text-center">
            <div className="bg-muted/50 rounded-lg p-6">
              <p className="text-muted-foreground">
                Catálogo de entradas y mesas no disponible en este momento.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Por favor, intenta más tarde o contacta al local directamente.
              </p>
            </div>
          </section>
        )}

        {/* Promociones vigentes del local */}
        {localId && (
          <ClubPromotions 
            promotions={apiPromotions}
            localId={localId} 
            localSlug={local.slug}
          />
        )}

        {/* Ubicación y contacto configurados */}
        <LazyMapSection
          venueType="club"
          venueId={localId}
          venue={venueDisplayName}
          location={local.location || ""}
          address={local.address || undefined}
          city={local.city}
          latitude={local.latitude}
          longitude={local.longitude}
          hours={buildDetailHoursLines(local.opening_hours, local.hours ?? [])}
          todayScheduleLabel={localTodayScheduleLabel}
          phone={local.phone || ""}
          additionalInfo={localAdditionalInfo}
        />

        {/* Reviews */}
        <ReviewsSection venueId={localId} venueType="club" highlights={[]} />
      </div>
    </div>;
};
export default ClubProfile;
