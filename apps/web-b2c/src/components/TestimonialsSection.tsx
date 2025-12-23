import { Link } from "react-router-dom";
import { Star, Clock, CheckCircle, Wine, Music } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import featuredVenueHeader from "@/assets/featured-venue-header.png";
import { featuredVenues } from "@/lib/data/venues";

const FeaturedVenuesSection = () => {
  return <section className="py-16 px-6 md:px-12 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Locales destacados
          </h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Los lugares que no te podés perder esta semana en Tairet
          </p>
        </div>

        {/* Mobile Carousel */}
        <div className="block md:hidden">
          <Carousel className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {featuredVenues.map(venue => <CarouselItem key={venue.id} className="pl-2 md:pl-4 basis-[85%] sm:basis-[75%]">
                  <Link to={`/${venue.type}/${venue.slug}`} className="block rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                    {/* Header with image */}
                    <div className="h-40 sm:h-44 relative overflow-hidden">
                      <img 
                        src={featuredVenueHeader} 
                        alt={venue.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Body */}
                    <CardContent className="p-4 flex-1 flex flex-col">
                      {/* Top row: title + rating */}
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-bold text-gray-900 truncate">{venue.name}</h3>
                        <div className="flex items-center gap-1" aria-label="Valoración">
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                          <span className="text-sm font-semibold text-gray-900">{venue.rating}</span>
                        </div>
                      </div>

                      {/* Schedule line */}
                      <div className="mt-2 text-sm text-gray-700 flex items-center">
                        <Clock className="w-4 h-4 mr-2 text-gray-700" />
                        {venue.schedule}
                      </div>


                      {/* Specialty chips */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {venue.specialties.map(specialty => <span key={specialty} aria-label={`Especialidad: ${specialty}`} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                            {venue.type === 'bar' ? <Wine className="w-3 h-3" aria-hidden="true" /> : <Music className="w-3 h-3" aria-hidden="true" />}
                            {specialty}
                          </span>)}
                        <span aria-label="Restricción de edad" className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                          +18
                        </span>
                      </div>
                    </CardContent>
                  </Link>
                </CarouselItem>)}
            </CarouselContent>
          </Carousel>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredVenues.map(venue => <Link key={venue.id} to={`/${venue.type}/${venue.slug}`} className="block rounded-2xl overflow-hidden bg-white shadow-md hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
              {/* Header with image */}
              <div className="h-40 sm:h-44 relative overflow-hidden">
                <img 
                  src={featuredVenueHeader} 
                  alt={venue.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Body */}
              <CardContent className="p-4 flex-1 flex flex-col">
                {/* Top row: title + rating */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-gray-900 truncate">{venue.name}</h3>
                  <div className="flex items-center gap-1" aria-label="Valoración">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-sm font-semibold text-gray-900">{venue.rating}</span>
                  </div>
                </div>

                {/* Schedule line */}
                <div className="mt-2 text-sm text-gray-700 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-gray-700" />
                  {venue.schedule}
                </div>


                {/* Specialty chips */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {venue.specialties.map(specialty => <span key={specialty} aria-label={`Especialidad: ${specialty}`} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                      {venue.type === 'bar' ? <Wine className="w-3 h-3" aria-hidden="true" /> : <Music className="w-3 h-3" aria-hidden="true" />}
                      {specialty}
                    </span>)}
                  <span aria-label="Restricción de edad" className="inline-flex items-center bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                    +18
                  </span>
                </div>
              </CardContent>
            </Link>)}
        </div>
      </div>
    </section>;
};
export default FeaturedVenuesSection;