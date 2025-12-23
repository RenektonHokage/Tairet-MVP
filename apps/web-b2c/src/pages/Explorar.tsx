import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Footer from "@/components/Footer";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Star } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import asuncionCityscape from "@/assets/asuncion-cityscape.jpg";
import sanberDistrict from "@/assets/sanber-district.jpg";
import ciudadDelEste from "@/assets/ciudad-del-este.jpg";

const Explorar = () => {
  const [searchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') || undefined;

  // Title based on type filter
  const pageTitle = typeFilter === 'bar' ? 'Bares' 
    : typeFilter === 'boliche' ? 'Boliches'
    : typeFilter === 'evento' ? 'Eventos'
    : 'Explorá la vida nocturna';

  const pageSubtitle = typeFilter === 'bar' ? 'Los mejores bares en Paraguay' 
    : typeFilter === 'boliche' ? 'Las mejores discotecas en Paraguay'
    : typeFilter === 'evento' ? 'Eventos especiales y fiestas en Paraguay'
    : 'Descubrí los mejores bares y discotecas en Paraguay';

  // Update document title based on filter
  useEffect(() => {
    const docTitle = typeFilter === 'bar' ? 'Bares | Tairet' 
      : typeFilter === 'boliche' ? 'Boliches | Tairet'
      : typeFilter === 'evento' ? 'Eventos | Tairet'
      : 'Explorar | Tairet';
    document.title = docTitle;

    const desc = pageSubtitle;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, [typeFilter, pageSubtitle]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Header Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
            {pageTitle}
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            {pageSubtitle}
          </p>
          
        </div>
      </section>

      {/* Popular Zones Section */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Zonas populares
            </h2>
            <p className="text-muted-foreground text-lg">
              Explorá por ubicación
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link to="/zona/asuncion" className="group block">
              <Card className="overflow-hidden border-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <div className="relative h-48">
                  <img 
                    src={asuncionCityscape} 
                    alt="Asunción"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-white text-xl font-bold mb-1">Asunción</h3>
                    <div className="flex items-center text-white/80 text-sm">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>Centro y alrededores</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>

            <Link to="/zona/san-bernardino" className="group block">
              <Card className="overflow-hidden border-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <div className="relative h-48">
                  <img 
                    src={sanberDistrict} 
                    alt="San Bernardino"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-white text-xl font-bold mb-1">San Bernardino</h3>
                    <div className="flex items-center text-white/80 text-sm">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>Distrito turístico</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>

            <Link to="/zona/ciudad-del-este" className="group block">
              <Card className="overflow-hidden border-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                <div className="relative h-48">
                  <img 
                    src={ciudadDelEste} 
                    alt="Ciudad del Este"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <h3 className="text-white text-xl font-bold mb-1">Ciudad del Este</h3>
                    <div className="flex items-center text-white/80 text-sm">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>Zona comercial</span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
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

export default Explorar;