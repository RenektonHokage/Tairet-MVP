import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatShortDate } from '@/lib/format';
import type { Event } from '@/lib/types';

export interface EventCardProps {
  event: Event;
  href?: string;
  className?: string;
}

/**
 * Event card component for displaying event information
 * Used in Eventos.tsx and other event listing pages
 */
const EventCard: React.FC<EventCardProps> = ({ 
  event, 
  href,
  className = '' 
}) => {
  const eventLink = href || `/evento/${event.id}`;

  return (
    <Link to={eventLink} className={`block ${className}`}>
      <Card className="event-card overflow-hidden border-0 hover:shadow-2xl transition-all duration-300">
        <div className="relative h-52 flex-shrink-0">
          <img 
            src={event.image} 
            alt={event.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          
          {/* Age Badge */}
          <Badge className="absolute top-4 left-4 bg-red-600 hover:bg-red-700 text-white">
            {event.ageLimit}
          </Badge>

          {/* Event Info Overlay */}
          <div className="absolute bottom-6 left-6 right-6">
            <h2 className="text-white text-xl font-bold mb-2 line-clamp-1">{event.name}</h2>
            <p className="text-white/90 text-sm mb-3 line-clamp-1">{event.artist}</p>
            
            <div className="flex items-center justify-between text-white/80 text-sm">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                <span>{formatShortDate(event.date)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>{event.time}hs</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="event-card-content">
          <div className="flex items-center text-muted-foreground text-sm">
            <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
            <span className="line-clamp-1">{event.venue}, {event.location}</span>
          </div>

          <p className="event-card-description text-muted-foreground text-sm">
            {event.description}
          </p>
        </div>
      </Card>
    </Link>
  );
};

export default EventCard;
