import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import MapSection from "@/components/shared/MapSection";
import EventHeroCompact from "@/components/event-profile/EventHeroCompact";

// Importar imágenes
import nightlifeScene from "@/assets/nightlife-scene.jpg";
import techno from "@/assets/techno.jpg";
import reggaeton from "@/assets/reggaeton.jpg";
import afterOffice from "@/assets/after-office.jpg";

// Mock data - in real app would come from API/params
const mockEventData = {
  "1": {
    name: "Noche de Techno",
    venue: "Club Matrix",
    location: "Asunción",
    date: "2024-01-15",
    time: "23:00",
    ageLimit: "18+",
    category: "techno",
    image: techno,
    description: "La mejor noche de techno underground con DJs internacionales",
    artist: "DJ Martinez & Guest",
    images: [techno, nightlifeScene, techno],
    tickets: [{
      id: "free-pass-event-1",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso al evento", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      price: 50000,
      description: "Acceso completo al evento",
      benefits: ["Acceso a todas las áreas", "1 drink incluido"]
    }, {
      id: "vip",
      name: "Entrada VIP",
      price: 100000,
      description: "Acceso preferencial y beneficios exclusivos",
      benefits: ["Acceso VIP", "2 drinks incluidos", "Sin filas", "Área exclusiva"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 250000,
      benefits: ["Mesa para 4 personas", "1 botella incluida", "Servicio de mesero"]
    }, {
      id: "premium",
      name: "Mesa Premium",
      capacity: 6,
      price: 400000,
      benefits: ["Mesa para 6 personas", "2 botellas incluidas", "Servicio VIP", "Ubicación privilegiada"]
    }]
  },
  "2": {
    name: "Reggaeton Party",
    venue: "Fever Disco",
    location: "San Bernardino",
    date: "2024-01-20",
    time: "22:00",
    ageLimit: "21+",
    category: "reggaeton",
    image: reggaeton,
    description: "Los mejores hits de reggaeton y música urbana",
    artist: "DJ Latino",
    images: [reggaeton, nightlifeScene, reggaeton],
    tickets: [{
      id: "general",
      name: "Entrada General",
      price: 40000,
      description: "Acceso completo al evento",
      benefits: ["Acceso a todas las áreas", "Ambiente reggaeton"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 200000,
      benefits: ["Mesa para 4 personas", "1 botella incluida", "Servicio de mesero"]
    }]
  },
  "3": {
    name: "After Office",
    venue: "Sky Bar",
    location: "Asunción", 
    date: "2024-01-18",
    time: "18:00",
    ageLimit: "25+",
    category: "afterwork",
    image: afterOffice,
    description: "Relájate después del trabajo con buena música y tragos",
    artist: "Acoustic Duo",
    images: [afterOffice, nightlifeScene, afterOffice],
    tickets: [{
      id: "general",
      name: "Entrada General",
      price: 30000,
      description: "Acceso completo al evento",
      benefits: ["Acceso completo", "Happy hour hasta 20:00"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 150000,
      benefits: ["Mesa para 4 personas", "Botella incluida", "Vista panorámica"]
    }]
  },
  "4": {
    name: "Fiesta de Fin de Semana",
    venue: "Neon Club",
    location: "Ciudad del Este",
    date: "2024-01-22",
    time: "23:30",
    ageLimit: "18+",
    category: "mixto",
    image: nightlifeScene,
    description: "Mix de géneros para cerrar el fin de semana",
    artist: "DJ Mix Master",
    images: [nightlifeScene, techno, reggaeton],
    tickets: [{
      id: "general",
      name: "Entrada General",
      price: 45000,
      description: "Acceso completo al evento",
      benefits: ["Acceso completo", "Música variada"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 6,
      price: 220000,
      benefits: ["Mesa para 6 personas", "1 botella incluida", "Servicio completo"]
    }]
  }
};

const EventProfile = () => {
  const { eventId } = useParams();
  const [activeSection, setActiveSection] = useState<'tickets' | 'ubicacion'>('tickets');
  
  const eventData = eventId ? mockEventData[eventId as keyof typeof mockEventData] : null;

  if (!eventData) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">Evento no encontrado</h2>
            <Link to="/eventos">
              <Button>Volver a eventos</Button>
            </Link>
          </div>
        </div>
        <BottomNavbar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 md:pb-0">
      <Navbar />
      
      {/* Back Button */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link to="/eventos">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a eventos
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <EventHeroCompact
        name={eventData.name}
        artist={eventData.artist}
        venue={eventData.venue}
        location={eventData.location}
        date={eventData.date}
        time={eventData.time}
        ageLimit={eventData.ageLimit}
        description={eventData.description}
        image={eventData.image}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Navigation Tabs */}
        <div className="border-b border-border">
          <div className="flex space-x-0">
            <button
              onClick={() => setActiveSection('tickets')}
              className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'tickets'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Entradas
            </button>
            <button
              onClick={() => setActiveSection('ubicacion')}
              className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeSection === 'ubicacion'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Ubicación
            </button>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {activeSection === 'tickets' && (
            // EventProfile actualmente usa datos mock sin catálogo real (DB-first)
            // PROHIBIDO: pasar mocks a PurchaseSelector para flujo transaccional
            // TODO: integrar catálogo real de eventos cuando exista
            <section className="w-full py-8 text-center">
              <div className="bg-muted/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-foreground mb-2">Entradas</h3>
                <p className="text-muted-foreground">
                  La venta de entradas para este evento no está disponible en este momento.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Contacta al organizador para más información.
                </p>
              </div>
            </section>
          )}
          {activeSection === 'ubicacion' && (
            <MapSection
              venue={eventData.venue}
              location={eventData.location}
              address={`${eventData.venue}, ${eventData.location}`}
              hours={[`Evento: ${eventData.date} a las ${eventData.time}`]}
              phone="(021) 555-123"
              additionalInfo={[
                `Edad mínima: ${eventData.ageLimit}`,
                eventData.description || ""
              ]}
            />
          )}
        </div>
      </div>

      <BottomNavbar />
    </div>
  );
};

export default EventProfile;