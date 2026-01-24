import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import BackButton from "@/components/shared/BackButton";
import { useProfileViewOnce } from "@/hooks/useProfileViewOnce";
import { useIsMobile } from "@/hooks/use-mobile";
import { Play, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TouchSlideGallery from "@/components/TouchSlideGallery";
import BarPromotions from "@/components/bar-profile/BarPromotions";
import BarReviews from "@/components/bar-profile/BarReviews";
import BarReservation from "@/components/bar-profile/BarReservation";
import MapSection from "@/components/shared/MapSection";
import { getLocalBySlug, type LocalGalleryItem, type GalleryKind } from "@/lib/locals";
import { getCover, getHero, getBarGalleryImages, getBarCategory } from "@/lib/gallery";
import { useNavigate } from "react-router-dom";
import { mockBarData } from "@/lib/mocks/bars";
import { ContactInfo } from "@/lib/contact";

const BarProfile = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { barId } = useParams();
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showGalleryMenu, setShowGalleryMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{src: string, alt: string} | null>(null);
  // Promotions from API (undefined = backend viejo/fetch failed, [] = no promos, [...] = promos)
  const [apiPromotions, setApiPromotions] = useState<{id: string; title: string; image: string}[] | undefined>(undefined);

  // Resolver local_id real desde slug
  useEffect(() => {
    if (!barId) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    getLocalBySlug(barId)
      .then((local) => {
        if (!local) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        // Verificar que sea un bar
        if (local.type !== "bar") {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        // Verificar que exista mock data
        const barData = mockBarData[barId as keyof typeof mockBarData];
        if (!barData) {
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

        setIsLoading(false);
      })
      .catch((error) => {
        console.error("Error al obtener local por slug:", error);
        setNotFound(true);
        setIsLoading(false);
      });
  }, [barId]);

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
  if (isLoading || notFound || !barId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  const barData = mockBarData[barId as keyof typeof mockBarData];
  if (!barData) {
    return null; // Se redirige a 404
  }

  // ==========================================================================
  // Galería DB-first con fallback a mocks
  // ==========================================================================

  // Obtener cover (foto de perfil para cards) - NUNCA usar como hero
  const coverImage = getCover(localGallery);

  // Obtener hero (imagen principal del perfil) - SEPARADO de cover
  const heroImageItem = getHero(localGallery);

  // Galería SIN cover (para mobile y modales de categoría)
  // Incluye hero + categorías
  const galleryWithoutCover = getBarGalleryImages(localGallery);

  // Mapeo de categoría UI → kind en DB
  const categoryToKind: Record<string, GalleryKind> = {
    Comida: "food",
    Interior: "interior",
    Carta: "menu",
    Tragos: "drinks",
  };

  // Labels para mostrar en modal
  const GALLERY_KIND_LABELS: Record<GalleryKind, string> = {
    cover: "Portada",
    hero: "Principal",
    carousel: "Galería",
    food: "Comida",
    interior: "Interior",
    menu: "Carta",
    drinks: "Tragos",
  };

  // Obtener primera imagen de una categoría para el tile del grid
  const getCategoryImage = (kind: GalleryKind, fallbackIdx: number) => {
    const categoryImages = getBarCategory(localGallery, kind);
    if (categoryImages.length > 0) {
      return { src: categoryImages[0].url, alt: GALLERY_KIND_LABELS[kind] };
    }
    // Fallback al mock
    return {
      src: barData.images[fallbackIdx % barData.images.length],
      alt: GALLERY_KIND_LABELS[kind],
    };
  };

  // Imágenes para el grid 2x2 por categoría (primera imagen de cada kind)
  const categoryImages = {
    Comida: getCategoryImage("food", 0),
    Interior: getCategoryImage("interior", 1),
    Carta: getCategoryImage("menu", 2),
    Tragos: getCategoryImage("drinks", 3),
  };

  // Hero image: prioridad hero > primera imagen no-cover > mock
  // NUNCA usar cover como hero
  const heroImage = (() => {
    // 1. Si existe hero, usarlo
    if (heroImageItem) {
      return { src: heroImageItem.url, alt: barData.name };
    }
    // 2. Si existe alguna imagen que no sea cover ni hero, usar la primera
    const firstNonCover = galleryWithoutCover.find(g => g.kind !== "hero");
    if (firstNonCover) {
      return { src: firstNonCover.url, alt: barData.name };
    }
    // 3. Fallback a mock
    return { src: barData.images[0], alt: barData.name };
  })();

  // Galería para TouchSlideGallery (mobile) - SIN cover, incluye hero
  const galleryImages = galleryWithoutCover.length > 0
    ? galleryWithoutCover.map(g => ({ src: g.url, alt: GALLERY_KIND_LABELS[g.kind] }))
    : barData.images.map((src, i) => ({ src, alt: `${barData.name} ${i + 1}` }));

  const categoryTitles = ["Comida", "Interior", "Carta", "Tragos"] as const;
  
  // Obtener todas las imágenes de una categoría específica para el modal
  const getCategoryImages = (category: string) => {
    const kind = categoryToKind[category];
    if (!kind) return []; // Categoría inválida: devolver vacío, NO todo
    
    // Filtrar imágenes de la galería por kind (excluye cover automáticamente)
    const kindImages = getBarCategory(localGallery, kind)
      .map(g => ({ src: g.url, alt: `${barData.name} - ${GALLERY_KIND_LABELS[kind]}` }));
    
    // Si hay imágenes para ese kind, usarlas
    if (kindImages.length > 0) {
      return kindImages;
    }
    
    // Fallback: usar imagen correspondiente del mock
    const fallbackIndex = Object.keys(categoryToKind).indexOf(category);
    return [{ 
      src: barData.images[fallbackIndex % barData.images.length], 
      alt: `${barData.name} - ${category}` 
    }];
  };
  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
        <BackButton label="Volver a explorar" fallbackTo="/explorar" />

        {/* Gallery Section - DB-first con fallback a mocks */}
        <section className="w-full relative">
          {galleryImages.length === 0 ? (
            /* Placeholder when no images */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-[400px] lg:h-[500px]">
              <div className="col-span-2 lg:col-span-4 row-span-2 relative overflow-hidden rounded-xl bg-muted flex items-center justify-center">
                <p className="text-muted-foreground text-sm text-center px-4">
                  Este local todavía no tiene fotos cargadas
                </p>
              </div>
            </div>
          ) : isMobile ? (
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden">
              <img 
                src={heroImage.src}
                alt={heroImage.alt}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <Button
                variant="outline"
                onClick={() => setShowGalleryMenu(true)}
                className="absolute bottom-6 right-6 flex items-center gap-2 bg-black/40 hover:bg-black/60 text-white border border-white/20"
              >
                <Grid3X3 size={16} />
                Ver galería
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-[400px] lg:h-[500px]">
              {/* Imagen destacada (cover) - ocupa 2 columnas y 2 filas */}
              <div className="col-span-2 row-span-2 relative overflow-hidden rounded-xl">
                <img 
                  src={heroImage.src}
                  alt={heroImage.alt}
                  className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
              
              {/* Imágenes pequeñas con categorías - DB-first por kind */}
              {categoryTitles.map((category) => (
                <div 
                  key={category}
                  className="relative overflow-hidden rounded-xl cursor-pointer group"
                  onClick={() => setSelectedCategory(category)}
                >
                  <img 
                    src={categoryImages[category].src}
                    alt={categoryImages[category].alt}
                    className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
                    <h3 className="text-white text-base sm:text-lg font-bold">{category}</h3>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Reservation Section */}
        {localId && <BarReservation localId={localId} contactInfo={contactInfo} />}

        {/* Promotions - DB-first: API promotions if available, mock only if undefined */}
        {localId && (
          <BarPromotions 
            promotions={apiPromotions !== undefined ? apiPromotions : barData.promotions} 
            localId={localId} 
          />
        )}

        {/* Map - DB-first con fallback */}
        <MapSection
          venue={barData.name}
          location={localLocation || "Centro, Asuncion"}
          address={localAddress || "Palma 123 esq. Chile"}
          city={localCity}
          hours={localHours.length > 0 ? localHours : ["Lun - Jue: 18:00 - 02:00", "Vie - Sab: 18:00 - 03:00", "Dom: Cerrado"]}
          phone={contactInfo?.phone || "(021) 123-456"}
          additionalInfo={localAdditionalInfo.length > 0 ? localAdditionalInfo : ["Estacionamiento disponible", "Acceso para personas con discapacidad", "WiFi gratuito", "Aceptamos tarjetas de credito", "Ambiente climatizado"]}
        />

        {/* Reviews */}
        <BarReviews />
      </div>

      {/* Mobile Gallery Menu Dialog */}
      <Dialog open={showGalleryMenu} onOpenChange={setShowGalleryMenu}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Galería de {barData.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {categoryTitles.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setShowGalleryMenu(false);
                  setSelectedCategory(category);
                }}
                className="relative aspect-square rounded-xl overflow-hidden group"
              >
                <img 
                  src={categoryImages[category].src}
                  alt={category}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <h3 className="text-white text-base font-bold">{category}</h3>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Gallery Dialog */}
      <Dialog open={selectedCategory !== null} onOpenChange={() => setSelectedCategory(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Galería de {selectedCategory} - {barData.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-4">
            {selectedCategory && getCategoryImages(selectedCategory).map((image, index) => (
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
    </div>;
};
export default BarProfile;