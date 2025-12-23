import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Percent } from "lucide-react";
import promotions from "@/assets/promotions.jpg";
import { Link } from "react-router-dom";
import { venuePromos } from "@/lib/data/promos";

const Promociones = () => {

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
        {/* Background with parallax effect */}
        <div 
          className="absolute inset-0 bg-cover bg-center transform scale-105" 
          style={{
            backgroundImage: `url(${promotions})`
          }} 
        />
        
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 via-transparent to-yellow-600/20" />
        
        {/* Animated particles effect */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 py-20 text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight animate-fade-in">
            Las mejores
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-yellow-400 to-orange-400">
              ofertas
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed animate-fade-in">
            Disfrutá de la noche con increíbles descuentos, 2x1 y promociones especiales
          </p>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      {/* Featured Promo Venues */}
      <section className="py-16 md:py-24 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-green-500/5 to-transparent pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Promociones activas
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Los mejores descuentos y ofertas de hoy
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {venuePromos.map((promo) => (
              <Link 
                key={promo.id} 
                to={`/${promo.venueType === 'club' ? 'club' : 'bar'}/${promo.venueId}`}
                className="block"
              >
                <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-300 group cursor-pointer">
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <img 
                      src={promo.image} 
                      alt={promo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-white font-semibold text-lg">{promo.title}</h3>
                      <div className="flex items-center gap-2 mt-2 text-white/80 text-sm">
                        <Calendar className="w-4 h-4" />
                        <span>Válido hoy</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <div className="h-20 md:hidden" aria-hidden="true" />
      <BottomNavbar />
    </div>
  );
};

export default Promociones;