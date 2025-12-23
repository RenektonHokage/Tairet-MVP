import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Wine } from "lucide-react";
import heroNightlife from "@/assets/hero-nightlife.jpg";
import VenueExperienceCard from "@/components/shared/VenueExperienceCard";
import { rooftopVenues } from "@/lib/data/venues";

const Rooftop = () => {
  return <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        {/* Background with parallax effect */}
        <div 
          className="absolute inset-0 bg-cover bg-center transform scale-105" 
          style={{
            backgroundImage: `url(${heroNightlife})`
          }} 
        />
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-transparent to-orange-600/20" />
        
        {/* Animated particles effect */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight animate-fade-in">
            Vistas de
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">
              ciudad
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed animate-fade-in">
            Disfrutá de tragos y música con las mejores vistas panorámicas de la ciudad
          </p>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Featured Rooftop Venues */}
      <section className="py-16 md:py-24 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Mejores rooftops
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Locales con las mejores terrazas y vistas
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {rooftopVenues.map((venue, index) => (
              <VenueExperienceCard
                key={venue.id}
                id={venue.id}
                name={venue.name}
                rating={venue.rating}
                schedule={venue.schedule}
                location={venue.location}
                specialties={venue.specialties}
                image={venue.image}
                animationDelay={`${index * 0.1}s`}
                badge={
                  <Badge className="bg-green-500 text-white border-0 shadow-lg">
                    {venue.dateTop}
                  </Badge>
                }
              />
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <div className="h-20 md:hidden" aria-hidden="true" />
      <BottomNavbar />
    </div>;
};
export default Rooftop;