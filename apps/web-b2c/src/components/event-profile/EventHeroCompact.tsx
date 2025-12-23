import { Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatEventDate } from "@/lib/format";

interface EventHeroCompactProps {
  name: string;
  artist: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  ageLimit: string;
  description: string;
  image: string;
}

const EventHeroCompact = ({ 
  name, 
  artist, 
  venue, 
  location, 
  date, 
  time, 
  ageLimit, 
  description, 
  image 
}: EventHeroCompactProps) => {

  return (
    <div className="relative h-[60vh] min-h-[500px] overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />
      </div>

      {/* Content */}
      <div className="relative h-full flex items-end">
        <div className="w-full p-6 md:p-8 text-white">
          <div className="max-w-7xl mx-auto space-y-4">
            {/* Main Info */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
                  {name}
                </h1>
                <Badge className="bg-red-600 hover:bg-red-700 text-white text-sm">
                  {ageLimit}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <p className="text-xl md:text-2xl text-white/90">
                  {artist}
                </p>
                <p className="text-lg text-white/80">
                  {venue} • {location}
                </p>
              </div>
            </div>

            {/* Event Details */}
            <div className="flex flex-wrap gap-6 text-white/90">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span className="text-sm md:text-base">{formatEventDate(date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span className="text-sm md:text-base">{time}hs</span>
              </div>
            </div>

            {/* Description */}
            <p className="text-white/80 max-w-2xl text-sm md:text-base">
              {description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventHeroCompact;