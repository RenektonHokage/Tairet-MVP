import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import BackButton from "@/components/shared/BackButton";
import { useProfileViewOnce } from "@/hooks/useProfileViewOnce";
import { useIsMobile } from "@/hooks/use-mobile";
import { Play, Grid3X3, Clock, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import PurchaseSelector from "@/components/shared/PurchaseSelector";
import ClubPromotions from "@/components/club-profile/ClubPromotions";
import ClubReviews from "@/components/club-profile/ClubReviews";
import MapSection from "@/components/shared/MapSection";
import TouchSlideGallery from "@/components/TouchSlideGallery";
import { getLocalBySlug, getClubCatalog, type LocalGalleryItem, type CatalogTicket, type CatalogTable } from "@/lib/locals";
import { parseBenefits } from "@/lib/parseBenefits";
import { useNavigate } from "react-router-dom";
import { mockClubData } from "@/lib/mocks/clubs";
import { ContactInfo } from "@/lib/contact";

const ClubProfile = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { clubId } = useParams();
  const [localId, setLocalId] = useState<string | null>(null);
  const [localType, setLocalType] = useState<string | null>(null);
  const [localAddress, setLocalAddress] = useState<string | null>(null);
  const [localLocation, setLocalLocation] = useState<string | null>(null);
  const [localCity, setLocalCity] = useState<string | null>(null);
  const [localHours, setLocalHours] = useState<string[]>([]);
  const [localAdditionalInfo, setLocalAdditionalInfo] = useState<string[]>([]);
  const [localGallery, setLocalGallery] = useState<LocalGalleryItem[]>([]);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [catalogTickets, setCatalogTickets] = useState<CatalogTicket[] | null>(null);
  const [catalogTables, setCatalogTables] = useState<CatalogTable[] | null>(null);
  const [selectedImage, setSelectedImage] = useState<{src: string, alt: string} | null>(null);
  // Promotions from API (undefined = backend viejo/fetch failed, [] = no promos, [...] = promos)
  const [apiPromotions, setApiPromotions] = useState<{id: string; title: string; image: string}[] | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Resolver local_id real desde slug
  useEffect(() => {
    if (!clubId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    getLocalBySlug(clubId)
      .then((local) => {
        if (!local) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        // Verificar que sea un club
        if (local.type !== "club") {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        // Verificar que exista mock data
        const clubData = mockClubData[clubId as keyof typeof mockClubData];
        if (!clubData) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        setLocalId(local.id);
        setLocalType(local.type);
        setLocalAddress(local.address);
        setLocalLocation(local.location);
        setLocalCity(local.city);
        setLocalHours(local.hours || []);
        setLocalAdditionalInfo(local.additional_info || []);
        setLocalGallery(local.gallery || []);
        setContactInfo({
          phone: local.phone,
          whatsapp: local.whatsapp,
        });

        // DB-first promotions: if API returns promotions field, use it (even if empty)
        // Only fallback to mock if promotions is undefined (old backend)
        if (local.promotions !== undefined) {
          setApiPromotions(
            local.promotions.map((p) => ({
              id: p.id,
              title: p.title,
              image: p.image_url ?? "/placeholder.svg",
            }))
          );
        }

        // Cargar catálogo de la API
        getClubCatalog(clubId)
          .then((catalog) => {
            if (catalog) {
              setCatalogTickets(catalog.tickets);
              setCatalogTables(catalog.tables);
            }
          })
          .catch((err) => {
            console.warn("Error al cargar catálogo, usando mocks:", err);
          })
          .finally(() => {
            setIsLoading(false);
          });
      })
      .catch((error) => {
        console.error("Error al obtener local por slug:", error);
        setNotFound(true);
        setIsLoading(false);
      });
  }, [clubId]);

  // Si no se encuentra, redirigir a NotFound después de un breve delay
  useEffect(() => {
    if (notFound) {
      const timer = setTimeout(() => {
        navigate("/404", { replace: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [notFound, navigate]);

  // Hook SIEMPRE se llama (incluso si localId es null/undefined)
  // El hook internamente verifica si hay localId antes de trackear
  useProfileViewOnce(localId || undefined);

  // TODOS los hooks deben estar ANTES de cualquier return temprano
  // Si está cargando o no se encontró, mostrar loading o nada (redirige a 404)
  if (isLoading || notFound || !clubId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  const clubData = mockClubData[clubId as keyof typeof mockClubData];
  if (!clubData) {
    return null; // Se redirige a 404
  }
  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // ==========================================================================
  // Galería DB-first con fallback a mocks
  // ==========================================================================

  // ==========================================================================
  // Galería DB-first con fallback a mocks
  // ==========================================================================

  // Ordenar galería por order
  const sortedGallery = [...localGallery].sort((a, b) => a.order - b.order);

  // Para clubs: separar cover, hero y carousel
  const coverImage = sortedGallery.find(g => g.kind === "cover");
  const heroImageItem = sortedGallery.find(g => g.kind === "hero");
  const carouselImages = sortedGallery.filter(g => g.kind === "carousel");

  // Hero image: 
  // 1. Si existe hero => usar hero
  // 2. Si NO existe hero => fallback a primer carousel
  // 3. Si no hay nada => fallback a mock
  // NUNCA usar cover como hero
  const heroImage = heroImageItem
    ? heroImageItem.url
    : carouselImages[0]?.url || clubData.images[0];

  // Galería completa para modal desktop - DB-first con fallback a mocks
  // Si hay carousel en DB, usar solo esos. Si no, fallback a mocks.
  const galleryImages = carouselImages.length > 0
    ? carouselImages.map(g => ({ src: g.url, alt: "Galería" }))
    : clubData.images.map((src, i) => ({ src, alt: `${clubData.name} ${i + 1}` }));

  // Mobile gallery: hero como primera imagen + carousel (NUNCA cover)
  const mobileGalleryImages = (() => {
    const images: { src: string; alt: string }[] = [];
    // Hero primero si existe
    if (heroImage) {
      images.push({ src: heroImage, alt: "Imagen principal" });
    }
    // Luego carousel (excluyendo hero si ya está)
    carouselImages.forEach(g => {
      if (g.url !== heroImage) {
        images.push({ src: g.url, alt: "Galería" });
      }
    });
    // Fallback a mocks si no hay nada
    if (images.length === 0) {
      return clubData.images.map((src, i) => ({ src, alt: `${clubData.name} ${i + 1}` }));
    }
    return images;
  })();
  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
        <BackButton label="Volver a explorar" fallbackTo="/explorar" />
        
        {/* Gallery - DB-first con fallback a mocks */}
        <section className="w-full relative">
          {galleryImages.length === 0 ? (
            /* Placeholder when no images */
            <div className="w-full h-[400px] sm:h-[500px] lg:h-[600px] bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground text-sm text-center px-4">
                Fotos no disponibles por el momento
              </p>
            </div>
          ) : isMobile ? (
            <TouchSlideGallery 
              images={mobileGalleryImages}
              onPlayClick={clubData.video ? handlePlayPause : undefined}
              isPlaying={isPlaying}
              hideSlideButton={true}
              overlayContent={
                <div className="absolute bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent w-full p-4 rounded-b-lg">
                  <h2 className="text-white text-xl font-bold mb-2">{clubData.name}</h2>
                  <div className="flex flex-wrap gap-2 text-white/90 text-sm mb-2">
                    <span className="border border-white/30 rounded-full px-3 py-1">{clubData.ageRestriction}</span>
                    <span className="border border-white/30 rounded-full px-3 py-1">Cocktails</span>
                    <span className="border border-white/30 rounded-full px-3 py-1">{clubData.genre}</span>
                  </div>
                  <p className="text-white/90 text-sm mb-1 flex items-center gap-2">
                    <Clock size={16} />
                    {clubData.schedule}
                  </p>
                  <p className="text-white/90 text-sm flex items-center gap-2">
                    <Music size={16} />
                    DJ en vivo
                  </p>
                </div>
              }
            />
          ) : (
            <>
              <img src={heroImage} alt="Galería del club" className="w-full h-[400px] sm:h-[500px] lg:h-[600px] object-cover rounded-lg" />
              <div className="absolute bottom-0 left-0 bg-gradient-to-t from-black/80 to-transparent w-full p-6 sm:p-8 rounded-b-lg">
                <h2 className="text-white text-2xl sm:text-3xl font-bold mb-2">{clubData.name}</h2>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-white/90 text-sm sm:text-base mb-2">
                  <span className="border border-white/30 rounded-full px-3 py-1">{clubData.ageRestriction}</span>
                  <span className="border border-white/30 rounded-full px-3 py-1">Cocktails</span>
                  <span className="border border-white/30 rounded-full px-3 py-1">{clubData.genre}</span>
                </div>
                <p className="text-white/90 text-sm sm:text-base mb-1 flex items-center gap-2">
                  <Clock size={16} />
                  {clubData.schedule}
                </p>
                <p className="text-white/90 text-sm sm:text-base flex items-center gap-2">
                  <Music size={16} />
                  DJ en vivo
                </p>
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
                    <DialogTitle>Galería de {clubData.name}</DialogTitle>
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

        {/* Tickets and Table Reservations - DB-first con fallback a mocks */}
        {localId && (
          <PurchaseSelector 
            tickets={
              // DB-first: transformar tickets de API a formato esperado, ordenados por precio ASC
              catalogTickets && catalogTickets.length > 0
                ? [...catalogTickets]
                    .sort((a, b) => a.price - b.price)
                    .map((t) => ({
                      id: t.id,
                      name: t.name,
                      price: t.price,
                      description: "", // Ya no se muestra como subtítulo fijo
                      benefits: parseBenefits(t.description), // Parsear description a benefits[]
                    }))
                : clubData.tickets
            } 
            tables={
              // DB-first: transformar tables de API a formato esperado, ordenados por precio ASC (NULLS LAST)
              catalogTables && catalogTables.length > 0
                ? [...catalogTables]
                    .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
                    .map((t) => ({
                      id: t.id,
                      name: t.name,
                    capacity: t.capacity || 0,
                    price: t.price || 0,
                    drinks: parseBenefits(t.includes), // Parsear includes a drinks[]
                  }))
                : clubData.tables
            } 
            mode="both" 
            title="" 
            subtitle="" 
            onCheckout={() => {}} 
            contactInfo={contactInfo} 
            localId={localId} 
          />
        )}

        {/* Promotions - DB-first: API promotions if available, mock only if undefined */}
        {localId && (
          <ClubPromotions 
            promotions={apiPromotions !== undefined ? apiPromotions : clubData.promotions} 
            localId={localId} 
            localSlug={clubId} 
          />
        )}

        {/* Map - DB-first con fallback */}
        <MapSection
          venue={clubData.name}
          location={localLocation || "Villa Morra, Asuncion"}
          address={localAddress || "Av. Mariscal Lopez 1234"}
          city={localCity}
          hours={localHours.length > 0 ? localHours : ["Jue - Sab: 23:00 - 06:00", "Dom - Mie: Cerrado", "Abierto hoy"]}
          phone={contactInfo?.phone || "(021) 555-123"}
          additionalInfo={localAdditionalInfo.length > 0 ? localAdditionalInfo : ["Estacionamiento valet disponible", "Dress code: Elegante", "Entrada solo +18 con documento", "Reservas recomendadas", "Sistema de sonido profesional"]}
        />

        {/* Reviews */}
        <ClubReviews />
      </div>
    </div>;
};
export default ClubProfile;