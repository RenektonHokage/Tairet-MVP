import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Footer from "@/components/Footer";
import EventCard from "@/components/shared/EventCard";
import { events } from "@/lib/data/events";

const Eventos = () => {


  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Header */}
      <section className="bg-gradient-to-br from-purple-900 via-purple-800 to-purple-900 relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,85,247,0.15),transparent_50%)]" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Eventos de la Semana
            </h1>
            <p className="text-lg text-white/80 mb-6 max-w-2xl mx-auto">
              Descubrí los mejores eventos de vida nocturna en Paraguay
            </p>
          </div>
        </div>
      </section>

      {/* Events Grid */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>


      <Footer />
      {/* Safe bottom space for mobile to avoid overlap and unify spacing */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      <BottomNavbar />
    </div>
  );
};

export default Eventos;