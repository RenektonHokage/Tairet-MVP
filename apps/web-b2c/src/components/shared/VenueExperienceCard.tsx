import { Link } from 'react-router-dom';
import { Star, Clock, MapPin, Wine } from 'lucide-react';
import { slugify } from '@/lib/slug';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ReactNode } from 'react';

interface VenueExperienceCardProps {
  id: number;
  name: string;
  rating: string;
  schedule: string;
  location: string;
  specialties: string[];
  image: string;
  badge: ReactNode;
  extraContent?: ReactNode;
  animationDelay?: string;
  customHeader?: ReactNode;
}

const VenueExperienceCard = ({ 
  id,
  name, 
  rating, 
  schedule, 
  location, 
  specialties, 
  image,
  badge,
  extraContent,
  animationDelay,
  customHeader
}: VenueExperienceCardProps) => {
  return (
    <Link 
      to={`/bar/${slugify(name)}`} 
      className="group block animate-fade-in"
      style={{ animationDelay }}
    >
      <Card className="rounded-2xl overflow-hidden bg-card shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
        {/* Image Header or Custom Header */}
        {customHeader ? (
          customHeader
        ) : (
          <div className="h-40 sm:h-44 relative overflow-hidden">
            <div 
              className="absolute inset-0 bg-cover bg-center transform group-hover:scale-110 transition-transform duration-700"
              style={{ backgroundImage: `url(${image})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
            
            {/* Badge */}
            <div className="absolute top-4 right-4">
              {badge}
            </div>
          </div>
        )}

        {/* Body */}
        <CardContent className="p-4 flex-1 flex flex-col">
          {/* Extra content (if any) */}
          {extraContent}

          {/* Top row: title + rating */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-card-foreground truncate">{name}</h3>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-sm font-semibold text-card-foreground">{rating}</span>
            </div>
          </div>

          {/* Schedule line */}
          <div className="text-sm text-muted-foreground flex items-center mb-2">
            <Clock className="w-4 h-4 mr-2" />
            {schedule}
          </div>

          {/* Location */}
          <div className="text-sm text-muted-foreground flex items-center mb-3">
            <MapPin className="w-4 h-4 mr-2" />
            {location}
          </div>

          {/* Specialty chips */}
          <div className="flex flex-wrap gap-2">
            {specialties.map(specialty => (
              <span 
                key={specialty} 
                className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2 py-1 rounded"
              >
                <Wine className="w-3 h-3" />
                {specialty}
              </span>
            ))}
            <span className="inline-flex items-center bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
              +18
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default VenueExperienceCard;
