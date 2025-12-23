import React from "react"
import { Link } from "react-router-dom"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock } from "lucide-react"

export type ExperienceItem = {
  src: string
  title: string
  description?: string
  alt?: string
  href?: string
  date?: string
  time?: string
  ageLimit?: string
  venue?: string
}

interface ExperiencesCarouselProps {
  items: ExperienceItem[]
  aspectRatio?: "square" | "portrait" | "compact"
  startIndex?: number
}

const ExperiencesCarousel: React.FC<ExperiencesCarouselProps> = ({ items, aspectRatio = "portrait", startIndex = 0 }) => {
  // Compact format for zones, portrait (3:4) for experiences, square (1:1) for special cases
  const aspectClass = aspectRatio === "square" ? "aspect-square w-full" 
    : aspectRatio === "compact" ? "aspect-[4/5]" 
    : "aspect-[3/4]"
  return (
    <div className="relative mx-auto w-full max-w-6xl">
      <Carousel
        opts={{ 
          align: "start", 
          containScroll: "trimSnaps", 
          loop: false,
          dragFree: true,
          skipSnaps: false,
          startIndex: startIndex
        }}
        className="relative"
      >
        <CarouselContent className="items-stretch gap-4 sm:gap-6 md:gap-8 -ml-2 md:-ml-4">
          {items.map((item, i) => (
            <CarouselItem
              key={`${item.title}-${i}`}
              className="basis-[82%] sm:basis-[70%] md:basis-[58%] lg:basis-[42%] xl:basis-[34%] pl-2 md:pl-4"
            >
              {item.href ? (
                <Link to={item.href} className="block">
                  <article className={`relative ${aspectClass} w-full overflow-hidden rounded-2xl ring-1 ring-border/50 bg-muted/5 shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 cursor-pointer`}>
                    <img
                      src={item.src}
                      alt={item.alt ?? `${item.title} - experiencia nocturna`}
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      draggable={false}
                      className="h-full w-full object-cover select-none"
                    />

                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                    {/* Age Badge - Only show for events */}
                    {item.ageLimit && (
                      <Badge className="absolute top-3 left-3 bg-red-600 hover:bg-red-700 text-white text-xs">
                        {item.ageLimit}
                      </Badge>
                    )}

                    {/* Event Info */}
                    <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
                      <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-lg mb-2">
                        {item.title}
                      </h3>
                      
                      {/* Description or Venue */}
                      {item.description && (
                        <p className="text-white/90 text-xs sm:text-sm mb-2">{item.description}</p>
                      )}

                      {/* Event Details - Only show if date/time exists */}
                      {(item.date || item.time) && (
                        <div className="flex items-center gap-3 text-white/80 text-xs">
                          {item.date && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>{item.date}</span>
                            </div>
                          )}
                          {item.time && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{item.time}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                </Link>
              ) : (
                <article className={`relative ${aspectClass} w-full overflow-hidden rounded-2xl ring-1 ring-border/50 bg-muted/5 shadow-2xl`}>
                  <img
                    src={item.src}
                    alt={item.alt ?? `${item.title} - experiencia nocturna`}
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    draggable={false}
                    className="h-full w-full object-cover select-none"
                  />

                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Bottom title */}
                  <div className="absolute inset-x-0 bottom-6 flex justify-center px-4">
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 drop-shadow-md text-center">
                      {item.title}
                    </h3>
                  </div>
                </article>
              )}
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Desktop arrows only */}
        <CarouselPrevious
          className="hidden lg:flex !left-2 md:!left-4 bg-background/70 backdrop-blur-sm border-border/50"
          aria-label="Anterior"
        />
        <CarouselNext
          className="hidden lg:flex !right-2 md:!right-4 bg-background/70 backdrop-blur-sm border-border/50"
          aria-label="Siguiente"
        />
      </Carousel>
    </div>
  )
}

export default ExperiencesCarousel
