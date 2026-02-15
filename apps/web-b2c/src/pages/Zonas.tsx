
import BottomNavbar from "@/components/layout/BottomNavbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Users, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import asuncionCityscape from "@/assets/asuncion-cityscape.jpg";
import sanberDistrict from "@/assets/sanber-district.jpg";
import ciudadDelEste from "@/assets/ciudad-del-este.jpg";

const Zonas = () => {
  const zones = [
    {
      name: "Asunción",
      path: "/zona/asuncion",
      image: asuncionCityscape,
      description: "La capital vibrante con la mejor vida nocturna del país",
      venues: "15+ locales",
      hours: "Hasta 4:00 AM",
      highlight: "Centro histórico y barrios modernos"
    },
    {
      name: "San Bernardino",
      path: "/zona/san-bernardino", 
      image: sanberDistrict,
      description: "Distrito turístico con ambiente relajado junto al lago",
      venues: "8+ locales",
      hours: "Hasta 3:00 AM",
      highlight: "Vista al lago Ypacaraí"
    },
    {
      name: "Ciudad del Este",
      path: "/zona/ciudad-del-este",
      image: ciudadDelEste,
      description: "Zona comercial fronteriza con propuestas diversas",
      venues: "10+ locales",
      hours: "Hasta 4:00 AM", 
      highlight: "Ambiente internacional"
    }
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      {/* Header */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Explorá por zonas
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            Descubrí la vida nocturna en las principales ciudades de Paraguay
          </p>
        </div>
      </section>

      {/* Zones Grid */}
      <section className="py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {zones.map((zone) => (
              <Link key={zone.path} to={zone.path} className="group block">
                <Card className="overflow-hidden border-0 shadow-lg group-hover:shadow-2xl transition-all duration-500 group-hover:scale-105">
                  <div className="relative h-64">
                    <img 
                      src={zone.image} 
                      alt={zone.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6">
                      <h2 className="text-white text-2xl font-bold md:mb-2">{zone.name}</h2>
                      <p className="hidden md:block text-white/90 text-sm mb-3">{zone.highlight}</p>
                       
                      <div className="hidden md:flex items-center justify-between text-white/80 text-sm">
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          <span>{zone.venues}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          <span>{zone.hours}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <CardContent className="hidden md:block p-6">
                    <p className="text-muted-foreground mb-4">{zone.description}</p>
                    <Button className="w-full group-hover:bg-primary/90">
                      Ver locales en {zone.name}
                      <MapPin className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Coming Soon Section */}
      <section className="py-12 md:py-16 bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Próximamente en más ciudades
            </h2>
            <p className="text-muted-foreground text-lg">
              Estamos expandiendo a nuevas ubicaciones
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {["Encarnación", "Pedro Juan Caballero", "Concepción", "Villarrica"].map((city) => (
              <Card key={city} className="text-center p-6 opacity-60">
                <CardContent className="p-0">
                  <div className="w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{city}</h3>
                  <p className="text-sm text-muted-foreground">Próximamente</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <Footer />
      <BottomNavbar />
    </div>
  );
};

export default Zonas;
