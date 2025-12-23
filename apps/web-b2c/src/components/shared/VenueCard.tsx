import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Clock, Wine, Music } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cardStyles, ratingStyles, textStyles, buttonStyles } from '@/lib/design-tokens';
import cardHeaderPlaceholder from '@/assets/card-header-placeholder.png';

export interface VenueCardProps {
  id: number | string;
  name: string;
  schedule: string;
  rating: string;
  specialties?: string[];
  genres?: string[];
  location?: string;
  image?: string;
  href: string;
  type: 'bar' | 'club';
  className?: string;
  // Date header mode (optional - if not provided, uses image header)
  dateTop?: string;
  dateBottom?: string;
  // Show +18 badge
  showAgeRestriction?: boolean;
}

/**
 * Generic venue card component
 * Supports two header modes:
 * 1. Date header (when dateTop/dateBottom provided) - colored background with date
 * 2. Image header (default) - venue image at top
 */
const VenueCard: React.FC<VenueCardProps> = ({
  id,
  name,
  dateTop,
  dateBottom,
  schedule,
  rating,
  specialties = [],
  genres = [],
  location,
  image,
  href,
  type,
  className = '',
  showAgeRestriction = true
}) => {
  const features = type === 'bar' ? specialties : genres;
  const Icon = type === 'bar' ? Wine : Music;
  const hasDateHeader = dateTop && dateBottom;

  return (
    <Link to={href} className={`block ${className}`}>
      <Card className={`${cardStyles.base} ${cardStyles.interactive} h-full min-h-[320px] sm:min-h-[340px] flex flex-col overflow-hidden`}>
        {/* Header - Date mode or Image mode */}
        {hasDateHeader ? (
          <div className={`venue-card-header ${
            type === 'bar' 
              ? 'venue-card-header-bar'
              : 'venue-card-header-club'
          }`}>
            <div className="text-white font-bold text-2xl sm:text-3xl tracking-wide">
              {dateTop}
            </div>
            <div className="text-white/90 text-sm uppercase tracking-wider">
              {dateBottom}
            </div>
          </div>
        ) : (
          <div className="h-40 sm:h-44 relative overflow-hidden">
            <img 
              src={image || cardHeaderPlaceholder} 
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="venue-card-content">
          {/* Title and rating */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-bold text-foreground truncate">{name}</h3>
            <div className={`${ratingStyles.container} flex-shrink-0`} aria-label="Valoración">
              <Star className="rating-star" />
              <span className="text-sm font-semibold text-foreground">{rating}</span>
            </div>
          </div>

          {/* Schedule */}
          <div className={`${textStyles.small} flex items-center mb-3`}>
            <Clock className="w-4 h-4 mr-2" />
            {schedule}
          </div>

          {location && (
            <div className={`${textStyles.small} mb-3`}>
              {location}
            </div>
          )}

          {/* Spacer for consistent height */}
          <div className="flex-1"></div>

          {/* Features/genres */}
          <div className="flex flex-wrap gap-2">
            {features.slice(0, hasDateHeader ? 2 : 3).map((feature, idx) => (
              <Badge 
                key={idx} 
                className={buttonStyles.badge}
                variant="secondary"
              >
                <Icon className="w-3 h-3" aria-hidden="true" />
                {feature}
              </Badge>
            ))}
            
            {features.length > (hasDateHeader ? 2 : 3) && (
              <Badge variant="secondary" className={buttonStyles.badge}>
                +{features.length - (hasDateHeader ? 2 : 3)}
              </Badge>
            )}

            {showAgeRestriction && (
              <Badge 
                variant="secondary" 
                className={buttonStyles.badge}
                aria-label="Restricción de edad"
              >
                +18
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
};

export default VenueCard;
