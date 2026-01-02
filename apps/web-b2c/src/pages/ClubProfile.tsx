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
import { getLocalBySlug } from "@/lib/locals";
import { useNavigate } from "react-router-dom";
import dlirioVideo from "@/assets/dlirio-video.mp4";
import bailongoPromo from "@/assets/bailongo-promo.jpg";
import formulaPromo from "@/assets/formula-promo.jpg";
import tragosFreshPromo from "@/assets/tragos-fresh-promo.jpg";
import dlirioGallery1 from "@/assets/dlirio-gallery-1.jpg";
import dlirioGallery2 from "@/assets/dlirio-gallery-2.jpg";
import dlirioGallery3 from "@/assets/dlirio-gallery-3.jpg";
import dlirioGallery4 from "@/assets/dlirio-gallery-4.jpg";

// Mock data - in real app would come from API/params
const mockClubData = {
  morgan: {
    name: "Morgan",
    images: ["/images/bar.jpg", "/images/bar.jpg", "/images/bar.jpg"],
    video: undefined,
    ageRestriction: "+18",
    schedule: "23:00–06:00",
    genre: "Reggaeton",
    entryPrice: "50.000 Gs",
    tickets: [{
      id: "free-pass-morgan",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 50000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 150000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 250000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial", "Ubicación privilegiada"]
    }, {
      id: "premium",
      name: "Mesa Premium",
      capacity: 8,
      price: 350000,
      drinks: ["Botella ultra premium", "10 mixers", "Hielera y vasos", "Servicio VIP", "Vista panorámica"]
    }, {
      id: "sofa",
      name: "Sofá Área Preferencial",
      capacity: 10,
      price: 450000,
      drinks: ["2 botellas premium", "15 mixers", "Servicio completo", "Área exclusiva", "Acceso directo"]
    }],
    promotions: [{
      id: "d4e5f6a7-b8c9-4012-d345-678901234567",
      title: "Ladies Night",
      image: "/images/bar.jpg"
    }, {
      id: "e5f6a7b8-c9d0-4123-e456-789012345678",
      title: "Happy Hour",
      image: "/images/bar.jpg"
    }, {
      id: "f6a7b8c9-d0e1-4234-f567-890123456789",
      title: "Student Night",
      image: "/images/bar.jpg"
    }]
  },
  celavie: {
    name: "Celavie",
    images: ["/images/bar.jpg", "/images/bar.jpg"],
    video: undefined,
    ageRestriction: "+18",
    schedule: "23:00–06:00",
    genre: "Mix",
    entryPrice: "60.000 Gs",
    tickets: [{
      id: "free-pass-celavie",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 60000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 180000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 280000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial", "Ubicación privilegiada"]
    }, {
      id: "premium",
      name: "Mesa Premium",
      capacity: 8,
      price: 380000,
      drinks: ["Botella ultra premium", "10 mixers", "Hielera y vasos", "Servicio VIP", "Vista panorámica"]
    }, {
      id: "sofa",
      name: "Sofá Área Preferencial",
      capacity: 10,
      price: 480000,
      drinks: ["2 botellas premium", "15 mixers", "Servicio completo", "Área exclusiva", "Acceso directo"]
    }],
    promotions: [{
      id: "a7b8c9d0-e1f2-4345-a678-901234567890",
      title: "Ladies Night",
      image: "/images/bar.jpg"
    }, {
      id: "b8c9d0e1-f2a3-4456-b789-012345678901",
      title: "Happy Hour",
      image: "/images/bar.jpg"
    }, {
      id: "c9d0e1f2-a3b4-4567-c890-123456789012",
      title: "Student Night",
      image: "/images/bar.jpg"
    }]
  },
  dlirio: {
    name: "DLirio",
    images: [dlirioGallery1, dlirioGallery2, dlirioGallery3, dlirioGallery4],
    video: dlirioVideo,
    ageRestriction: "+21",
    schedule: "22:00–05:00",
    genre: "Electrónica",
    entryPrice: "70.000 Gs",
    tickets: [{
      id: "free-pass-dlirio",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 70000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 200000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 280000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial", "Ubicación privilegiada"]
    }, {
      id: "premium",
      name: "Mesa Premium",
      capacity: 8,
      price: 380000,
      drinks: ["Botella ultra premium", "10 mixers", "Hielera y vasos", "Servicio VIP", "Vista panorámica"]
    }, {
      id: "sofa",
      name: "Sofá Área Preferencial",
      capacity: 10,
      price: 480000,
      drinks: ["2 botellas premium", "15 mixers", "Servicio completo", "Área exclusiva", "Acceso directo"]
    }],
    promotions: [{
      id: 1,
      title: "Bailongo - Sole Rössner",
      image: bailongoPromo
    }, {
      id: 2,
      title: "Tragos Fresh",
      image: tragosFreshPromo
    }, {
      id: 3,
      title: "La Fórmula Perfecta",
      image: formulaPromo
    }]
  },
  fresa: {
    name: "Fresa",
    images: ["/images/bar.jpg", "/images/bar.jpg"],
    video: undefined,
    ageRestriction: "+18",
    schedule: "23:00–06:00",
    genre: "Pop",
    entryPrice: "50.000 Gs",
    tickets: [{
      id: "free-pass-fresa",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 50000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 150000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 250000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial"]
    }],
    promotions: []
  },
  mambo: {
    name: "Mambo",
    images: ["/images/bar.jpg", "/images/bar.jpg"],
    video: undefined,
    ageRestriction: "+18",
    schedule: "23:00–06:00",
    genre: "Reggaeton",
    entryPrice: "45.000 Gs",
    tickets: [{
      id: "free-pass-mambo",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 45000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 140000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 240000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial"]
    }],
    promotions: []
  }
};
const ClubProfile = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { clubId } = useParams();
  const [localId, setLocalId] = useState<string | null>(null);
  const [localType, setLocalType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{src: string, alt: string} | null>(null);
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
        setIsLoading(false);
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
  const galleryImages = Array.from({
    length: 4
  }, (_, i) => ({
    src: clubData.images[i % clubData.images.length],
    alt: `${clubData.name} ${i + 1}`
  }));
  return <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6 sm:space-y-8">
        <BackButton label="Volver a explorar" fallbackTo="/explorar" />
        
        {/* Gallery */}
        <section className="w-full relative">
          {!clubData.images || clubData.images.length === 0 ? (
            /* Placeholder when no images */
            <div className="w-full h-[400px] sm:h-[500px] lg:h-[600px] bg-muted rounded-lg flex items-center justify-center">
              <p className="text-muted-foreground text-sm text-center px-4">
                Fotos no disponibles por el momento
              </p>
            </div>
          ) : isMobile ? (
            <TouchSlideGallery 
              images={galleryImages}
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
              <img src={clubData.images[0]} alt="Galería del club" className="w-full h-[400px] sm:h-[500px] lg:h-[600px] object-cover rounded-lg" />
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

        {/* Tickets and Table Reservations */}
        {localId && (
          <PurchaseSelector 
            tickets={clubData.tickets} 
            tables={clubData.tables} 
            mode="both" 
            title="" 
            subtitle="" 
            onCheckout={() => {}} 
            whatsappNumber="595981234567" 
            localId={localId} 
          />
        )}

        {/* Promotions */}
        {localId && <ClubPromotions promotions={clubData.promotions} localId={localId} localSlug={clubId} />}

        {/* Map */}
        <MapSection venue={clubData.name} location="Villa Morra, Asunción" address="Av. Mariscal López 1234" hours={["Jue - Sáb: 23:00 - 06:00", "Dom - Mié: Cerrado", "Abierto hoy"]} phone="(021) 555-123" additionalInfo={["Estacionamiento valet disponible", "Dress code: Elegante", "Entrada solo +18 con documento", "Reservas recomendadas", "Sistema de sonido profesional"]} />

        {/* Reviews */}
        <ClubReviews />
      </div>
    </div>;
};
export default ClubProfile;