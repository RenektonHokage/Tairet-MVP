import React, { useEffect, useRef } from 'react';
import { MapPin, Navigation, Clock, Phone, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatEventDate } from "@/lib/format";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapSectionProps {
  venue: string;
  location: string;
  address?: string;
  hours?: string[];
  phone?: string;
  additionalInfo?: string[];
  isEvent?: boolean;
  date?: string;
  time?: string;
}

const MapSection: React.FC<MapSectionProps> = ({ 
  venue,
  location,
  address,
  hours = [],
  phone = "(021) 555-123",
  additionalInfo = [],
  isEvent = false,
  date,
  time
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const defaultAddress = address || `${venue}, ${location}, Paraguay`;
  const displayLocation = `${location}, Paraguay`;

  // Coordenadas por defecto para Paraguay (Asunción)
  const defaultCoords: [number, number] = [-57.5759, -25.2637];

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: defaultCoords,
        zoom: 15,
      });

      // Agregar controles de navegación
      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // Agregar marcador
      new mapboxgl.Marker({ color: '#8B5CF6' })
        .setLngLat(defaultCoords)
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>${venue}</strong><br/>${displayLocation}`))
        .addTo(map.current);

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [venue, displayLocation]);

  const handleGetDirections = () => {
    const query = encodeURIComponent(`${venue}, ${displayLocation}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <section className="space-y-4 sm:space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-foreground">
        {isEvent ? 'Ubicación del Evento' : 'Ubicación'}
      </h2>
      
      <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden h-full">
            {MAPBOX_TOKEN ? (
              <div 
                ref={mapContainer} 
                className="h-full min-h-[400px]"
              />
            ) : (
              <div className="h-full min-h-[400px] flex items-center justify-center bg-muted">
                <p className="text-muted-foreground text-sm">Mapa no disponible</p>
              </div>
            )}
          </Card>
        </div>
        
        {/* Info */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {isEvent ? 'Lugar del Evento' : 'Dirección'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {venue}<br />
                      {displayLocation}
                    </p>
                  </div>
                </div>
                
                {isEvent && date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Fecha del Evento</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>{formatEventDate(date)}</p>
                        <p className="text-green-600 font-medium">Próximo evento</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {isEvent ? 'Horario' : 'Horarios'}
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {isEvent && time ? (
                        <p>Inicio: {time}hs</p>
                      ) : hours.length > 0 ? (
                        hours.map((hour, index) => (
                          <p key={index}>{hour}</p>
                        ))
                      ) : (
                        <>
                          <p>Lun - Jue: 18:00 - 02:00</p>
                          <p>Vie - Sáb: 18:00 - 03:00</p>
                          <p>Dom: Cerrado</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Contacto</p>
                    <p className="text-sm text-muted-foreground">{phone}</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 space-y-2">
                <Button className="w-full" variant="outline" onClick={handleGetDirections}>
                  <Navigation className="w-4 h-4 mr-2" />
                  Cómo llegar
                </Button>
                <Button className="w-full" variant="outline" onClick={() => window.open(`tel:${phone}`)}>
                  <Phone className="w-4 h-4 mr-2" />
                  {isEvent ? 'Llamar al local' : 'Llamar'}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium text-foreground mb-3">
                {isEvent ? 'Información importante' : 'Información adicional'}
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {additionalInfo.length > 0 ? (
                  additionalInfo.map((info, index) => (
                    <p key={index}>• {info}</p>
                  ))
                ) : isEvent ? (
                  <>
                    <p>• Entrada solo con documento de identidad</p>
                    <p>• Código de vestimenta elegante</p>
                    <p>• Llegá temprano para mejores ubicaciones</p>
                    <p>• Estacionamiento disponible</p>
                    <p>• Evento sujeto a capacidad máxima</p>
                  </>
                ) : (
                  <>
                    <p>• Estacionamiento disponible</p>
                    <p>• Acceso para personas con discapacidad</p>
                    <p>• WiFi gratuito</p>
                    <p>• Aceptamos tarjetas de crédito</p>
                    <p>• Ambiente climatizado</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default MapSection;