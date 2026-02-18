import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Calendar, MessageCircle } from 'lucide-react';
import { trackWhatsappClick } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { type ContactInfo } from '@/lib/contact';
import {
  buildWhatsAppReservationMessage,
  buildWhatsAppUrl,
  hasWhatsAppNumber,
  resolveWhatsAppNumber,
} from '@/lib/whatsapp';

interface BarReservationProps {
  localId: string;
  venueName: string;
  contactInfo?: ContactInfo | null;
}

const BarReservation: React.FC<BarReservationProps> = ({ localId, venueName, contactInfo }) => {
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
                disabled={!hasWhatsAppNumber(contactInfo)}
                onClick={() => {
                  const destinationPhone = resolveWhatsAppNumber(contactInfo);
                  if (!destinationPhone) return;

                  if (localId && contactInfo) {
                    // Fire-and-forget: no bloquear window.open
                    void trackWhatsappClick(
                      localId, 
                      destinationPhone,
                      "bar_reservation"
                    );
                  }
                  const message = buildWhatsAppReservationMessage({
                    venueType: "bar",
                    venueName,
                  });
                  const url = buildWhatsAppUrl(destinationPhone, message);
                  if (!url) return;
                  window.open(url, "_blank", "noopener,noreferrer");
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
