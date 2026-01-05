import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, MessageCircle } from 'lucide-react';
import { trackWhatsappClick } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ContactInfo, hasContactChannel, openContactChannel } from '@/lib/contact';

interface BarReservationProps {
  localId: string;
  contactInfo?: ContactInfo | null;
}

const BarReservation: React.FC<BarReservationProps> = ({ localId, contactInfo }) => {
  const navigate = useNavigate();
  const { barId } = useParams();

  const handleReserve = () => {
    navigate(`/reservar/${barId}`);
  };

  return (
    <section className="relative">
      <Card className="border border-border/50 overflow-hidden bg-gradient-to-br from-card to-card/80 backdrop-blur-sm">
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left side - Content */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-primary mb-1">
                <Calendar className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-wide">Reservas</span>
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-foreground">
                Reservá tu mesa
              </h3>
              <p className="text-muted-foreground text-sm md:text-base">
                Asegurá tu lugar y disfrutá de la mejor experiencia
              </p>
            </div>

            {/* Right side - CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleReserve}
                size="lg"
                className="group relative overflow-hidden h-12 px-8"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Reservar ahora
                </span>
              </Button>
              
              <Button 
                variant="outline"
                size="lg"
                className="h-12 px-8 border-border/50 hover:border-primary/50"
                disabled={!hasContactChannel(contactInfo)}
                onClick={() => {
                  if (localId && contactInfo) {
                    // Fire-and-forget: no bloquear window.open
                    void trackWhatsappClick(
                      localId, 
                      contactInfo.whatsapp || contactInfo.phone || undefined, 
                      "bar_reservation"
                    );
                  }
                  if (contactInfo) {
                    openContactChannel(contactInfo, "Hola! Me gustaría hacer una consulta sobre reservas.");
                  }
                }}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
};

export default BarReservation;
