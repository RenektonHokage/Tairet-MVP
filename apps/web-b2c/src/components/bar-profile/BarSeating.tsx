import React from 'react';
import { Users, CheckCircle, Wine } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SeatingOption {
  id: string;
  name: string;
  capacity: number;
  price: number;
  includes: string[];
}

interface BarSeatingProps {
  seating: SeatingOption[];
}

const BarSeating: React.FC<BarSeatingProps> = ({ seating }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency: 'PYG',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price).replace('PYG', 'Gs');
  };

  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Espacios del bar</h2>
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="w-3 h-3 mr-1" />
          Disponible hoy
        </Badge>
      </div>

      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-2">
        {seating?.map((option) => (
          <Card key={option.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/20">
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                    {option.name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>Hasta {option.capacity} personas</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-foreground">
                    {formatPrice(option.price)}
                  </div>
                  <div className="text-xs text-muted-foreground">por reserva</div>
                </div>
              </div>

              {/* Includes */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Incluye:</h4>
                <div className="space-y-1">
                  {option.includes.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Wine className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <Button 
                className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                variant="outline"
              >
                Reservar espacio
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-muted/30 rounded-lg p-4 sm:p-6 space-y-2">
        <h3 className="font-medium text-foreground">Información importante</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Las reservas se confirman con anticipo mínimo de 2 horas</li>
          <li>• Los precios pueden variar en fechas especiales y eventos</li>
          <li>• Consultar disponibilidad para grupos grandes</li>
          <li>• Política de cancelación: hasta 1 hora antes</li>
        </ul>
      </div>
    </section>
  );
};

export default BarSeating;