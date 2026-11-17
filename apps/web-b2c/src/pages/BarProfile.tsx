import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import BackButton from "@/components/shared/BackButton";
import ProfileSkeleton from "@/components/shared/ProfileSkeleton";
import { useProfileViewOnce } from "@/hooks/useProfileViewOnce";
import { useIsMobile } from "@/hooks/use-mobile";
import { Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import BarPromotions from "@/components/bar-profile/BarPromotions";
import BarReviews from "@/components/bar-profile/BarReviews";
import BarReservation from "@/components/bar-profile/BarReservation";
import LazyMapSection from "@/components/shared/LazyMapSection";
import { buildDetailHoursLines, getDetailTodayScheduleLabelApiFirst, getLocalBySlug, type LocalInfo } from "@/lib/locals";
import { getHero, getBarGalleryImages, getBarCategory } from "@/lib/gallery";

const categoryToKind = { Comida: "food", Interior: "interior", Carta: "menu", Tragos: "drinks" } as const;
type Category = keyof typeof categoryToKind;
const categoryTitles = Object.keys(categoryToKind) as Category[];

function BarProfileContent({ slug }: { slug?: string }) {
  const isMobile = useIsMobile();
  const [local, setLocal] = useState<LocalInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showGalleryMenu, setShowGalleryMenu] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLocal(null);
    setIsLoading(true);
    setFailed(false);
    setSelectedImage(null);
    setSelectedCategory(null);
    setShowGalleryMenu(false);
    getLocalBySlug(slug ?? "").then(result => {
      if (active) setLocal(result?.type === "bar" && result.is_published === true ? result : null);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [slug, attempt]);

  useEffect(() => {
    document.title = local ? `${local.name} | Tairet` : "Bar | Tairet";
  }, [local]);

  useProfileViewOnce(local?.id);

  if (isLoading) return <div className="min-h-screen bg-background"><Navbar /><ProfileSkeleton /></div>;
  if (failed) return <div className="min-h-screen bg-background"><Navbar /><main className="mx-auto max-w-screen-2xl p-6 space-y-4"><p>No se pudo cargar el perfil del bar.</p><Button onClick={() => setAttempt(value => value + 1)}>Reintentar</Button></main></div>;
  if (!local) return <Navigate to="/404" replace />;

  const localId = local.id;
  const venueDisplayName = local.name;
  const contactInfo = { phone: local.phone, whatsapp: local.whatsapp, email: null };
  const galleryImages = getBarGalleryImages(local.gallery);
  const hero = getHero(local.gallery) ?? galleryImages[0];
  const heroImage = hero ? { src: hero.url, alt: venueDisplayName } : null;
  const getCategoryImages = (category: Category) => getBarCategory(local.gallery, categoryToKind[category])
    .map(image => ({ src: image.url, alt: `${venueDisplayName} - ${category}` }));
  const categoryImages = Object.fromEntries(categoryTitles.map(category => [category, getCategoryImages(category)[0]])) as Record<Category, { src: string; alt: string } | undefined>;
  const apiPromotions = (local.promotions ?? []).map(promo => ({ id: promo.id, title: promo.title, image: promo.image_url || "/placeholder.svg", description: promo.description?.trim() || undefined }));
  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
        <BackButton label="Volver a explorar" fallbackTo="/explorar" />

        <header className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-bold">{venueDisplayName}</h1>
          <div className="flex flex-wrap gap-2">
            {(local.attributes ?? []).map(attribute => <Badge key={attribute} variant="secondary">{attribute}</Badge>)}
            {local.min_age != null && <Badge variant="secondary">+{local.min_age}</Badge>}
          </div>
        </header>

        {/* Galería configurada desde B2B; cover se reserva para el listado. */}
        <section className="w-full relative">
          {!heroImage ? (
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
                <button
                  key={category}
                  disabled={!categoryImages[category]}
                  type="button"
                  className="relative overflow-hidden rounded-xl cursor-pointer group"
                  onClick={() => setSelectedCategory(category)}
                >
                  {categoryImages[category] ? <img
                    src={categoryImages[category].src}
                    alt={categoryImages[category].alt}
                    className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  /> : <span className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">Sin fotos</span>}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4">
                    <h3 className="text-white text-base sm:text-lg font-bold">{category}</h3>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Reservation Section */}
        {localId && <BarReservation localId={localId} venueName={venueDisplayName} contactInfo={contactInfo} />}

        {/* Promociones vigentes de la API */}
        {localId && (
          <BarPromotions
            promotions={apiPromotions}
            localId={localId}
          />
        )}

        {/* Ubicación y contacto configurados */}
        <LazyMapSection
          venueId={localId || undefined}
          venue={venueDisplayName}
          location={local.location || ""}
          address={local.address || undefined}
          city={local.city}
          latitude={local.latitude}
          longitude={local.longitude}
          hours={buildDetailHoursLines(local.opening_hours, local.hours)}
          todayScheduleLabel={getDetailTodayScheduleLabelApiFirst(local)}
          phone={local.phone || ""}
          venueType="bar"
          additionalInfo={local.additional_info}
        />

        {/* Reviews */}
        <BarReviews venueId={localId} />
      </div>

      {/* Mobile Gallery Menu Dialog */}
      <Dialog open={showGalleryMenu} onOpenChange={setShowGalleryMenu}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Galería de {venueDisplayName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {categoryTitles.map((category) => (
              <button
                key={category}
                disabled={!categoryImages[category]}
                onClick={() => {
                  setShowGalleryMenu(false);
                  setSelectedCategory(category);
                }}
                className="relative aspect-square rounded-xl overflow-hidden group"
              >
                {categoryImages[category] ? <img
                  src={categoryImages[category].src}
                  alt={category}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                /> : <span className="absolute inset-0 flex items-center justify-center bg-muted text-sm text-muted-foreground">Sin fotos</span>}
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
            <DialogTitle>Galería de {selectedCategory} - {venueDisplayName}</DialogTitle>
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
export default function BarProfile() {
  const { barId } = useParams();
  return <BarProfileContent key={barId} slug={barId} />;
}
