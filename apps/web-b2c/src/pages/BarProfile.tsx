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
import { getLocalBySlug } from "@/lib/locals";
import { useNavigate } from "react-router-dom";

// Mock data for bars
const mockBarData = {
  "mckharthys-bar": {
    name: "Mckharthys Bar",
    images: ["/images/bar.jpg", "/images/bar.jpg", "/images/bar.jpg", "/images/bar.jpg"],
    ageRestriction: "+18",
    schedule: "18:00–02:00",
    specialties: ["Cervezas", "Cocteles"],
    location: "Centro • Asunción",
    story: "Mckharthys Bar es un emblema del entretenimiento nocturno en Asunción desde 1995. Fundado por una familia irlandesa, hemos mantenido la tradición de ofrecer la mejor selección de cervezas y cocteles en un ambiente acogedor. Nuestro local se ha convertido en punto de encuentro para jóvenes y profesionales que buscan relajarse después de una larga jornada.",
    highlights: ["Más de 25 años de experiencia en el rubro", "Bartenders certificados internacionalmente", "Ambiente familiar y acogedor", "Música en vivo los fines de semana", "Carta extensa de cervezas importadas"],
    promotions: [{
      id: "a1b2c3d4-e5f6-4789-a012-345678901234",
      title: "Promo de Prueba",
      image: "/images/bar.jpg"
    }, {
      id: "b2c3d4e5-f6a7-4890-b123-456789012345",
      title: "Happy Hour",
      image: "/images/bar.jpg"
    }, {
      id: "c3d4e5f6-a7b8-4901-c234-567890123456",
      title: "2x1 Cervezas",
      image: "/images/bar.jpg"
    }]
  },
  "killkenny-pub": {
    name: "Killkenny Pub",
    images: ["/images/bar.jpg", "/images/bar.jpg", "/images/bar.jpg", "/images/bar.jpg"],
    ageRestriction: "+18",
    schedule: "17:00–01:00",
    specialties: ["Cerveza artesanal", "Pub food"],
    location: "Villa Morra • Asunción",
    story: "Killkenny Pub es un auténtico pub irlandés establecido en Villa Morra. Especialistas en cerveza artesanal y comida tradicional de pub, ofrecemos una experiencia única con recetas originales traídas directamente de Irlanda. Nuestro ambiente cálido y acogedor te transporta a los tradicionales pubs de Dublín.",
    highlights: ["Recetas tradicionales irlandesas auténticas", "Cerveza artesanal de producción propia", "Ambiente tradicional de pub irlandés", "Carta de whiskeys premium", "Staff con formación en cultura irlandesa"],
    promotions: []
  }
};
const BarProfile = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { barId } = useParams();
  const [localId, setLocalId] = useState<string | null>(null);
  const [localType, setLocalType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{src: string, alt: string} | null>(null);

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
  
  const galleryImages = Array.from({
    length: 4
  }, (_, i) => ({
    src: barData.images[i % barData.images.length],
    alt: `${barData.name} ${i + 1}`
  }));

  const categoryTitles = ["Comida", "Interior", "Carta", "Tragos"];
  
  const getCategoryImages = (category: string) => {
    // In a real app, this would filter images by category
    return galleryImages;
  };
  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
        <BackButton label="Volver a explorar" fallbackTo="/explorar" />

        {/* Gallery Section */}
        <section className="w-full relative">
          {!barData.images || barData.images.length === 0 ? (
            /* Placeholder when no images */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-[400px] lg:h-[500px]">
              <div className="col-span-2 lg:col-span-4 row-span-2 relative overflow-hidden rounded-xl bg-muted flex items-center justify-center">
                <p className="text-muted-foreground text-sm text-center px-4">
                  Este local todavía no tiene fotos cargadas
                </p>
              </div>
            </div>
          ) : isMobile ? (
            <TouchSlideGallery 
              images={galleryImages}
            />
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 h-[400px] lg:h-[500px]">
              {/* Imagen destacada - ocupa 2 columnas y 2 filas */}
              <div className="col-span-2 row-span-2 relative overflow-hidden rounded-xl">
                <img 
                  src={galleryImages[0].src}
                  alt={barData.name}
                  className="absolute inset-0 w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </div>
              
              {/* Imágenes pequeñas con categorías */}
              {categoryTitles.map((category, index) => (
                <div 
                  key={category}
                  className="relative overflow-hidden rounded-xl cursor-pointer group"
                  onClick={() => setSelectedCategory(category)}
                >
                  <img 
                    src={galleryImages[index].src}
                    alt={category}
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
        {localId && <BarReservation localId={localId} />}

        {/* Promotions */}
        {localId && <BarPromotions promotions={barData.promotions} localId={localId} />}

        {/* Map */}
        <MapSection venue={barData.name} location="Centro, Asunción" address="Palma 123 esq. Chile" hours={["Lun - Jue: 18:00 - 02:00", "Vie - Sáb: 18:00 - 03:00", "Dom: Cerrado"]} phone="(021) 123-456" additionalInfo={["Estacionamiento disponible", "Acceso para personas con discapacidad", "WiFi gratuito", "Aceptamos tarjetas de crédito", "Ambiente climatizado"]} />

        {/* Reviews */}
        <BarReviews />
      </div>

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