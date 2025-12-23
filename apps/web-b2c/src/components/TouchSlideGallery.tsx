import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Grid3X3 } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";

interface TouchSlideGalleryProps {
  images: Array<{
    src: string;
    alt: string;
  }>;
  onPlayClick?: () => void;
  isPlaying?: boolean;
  overlayContent?: React.ReactNode;
  hideSlideButton?: boolean;
}

const TouchSlideGallery: React.FC<TouchSlideGalleryProps> = ({ 
  images, 
  onPlayClick, 
  isPlaying = false,
  overlayContent,
  hideSlideButton = false
}) => {
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  React.useEffect(() => {
    if (!api) return;

    setCurrentSlide(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrentSlide(api.selectedScrollSnap());
    });
  }, [api]);

  // Placeholder when no images available
  if (!images || images.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-lg">
        <Card className="overflow-hidden bg-muted aspect-video">
          <div className="relative w-full h-full flex items-center justify-center">
            <p className="text-muted-foreground text-sm text-center px-4">
              Fotos no disponibles por el momento
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <Carousel
        setApi={setApi}
        opts={{ 
          align: "start",
          loop: false,
          dragFree: false,
          watchDrag: true
        }}
        className="relative"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {/* Main image */}
          <CarouselItem className="pl-2 md:pl-4">
            <Card className="overflow-hidden bg-black aspect-video">
              <div className="relative w-full h-full">
                <img 
                  src={images[0]?.src} 
                  alt={images[0]?.alt || "Imagen principal"} 
                  className="w-full h-full object-cover select-none"
                  draggable={false}
                />
                <div className="absolute inset-0 bg-black/20" />
                
                {/* Custom Overlay Content */}
                {overlayContent}
                
                
                {/* Gallery Info */}
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <span className="text-white text-xs bg-black/50 backdrop-blur-sm px-2 py-1 rounded">
                    {currentSlide + 1} / {images.length}
                  </span>
                  {!hideSlideButton && images.length > 1 && (
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="bg-white/90 backdrop-blur-sm text-black hover:bg-white text-xs px-2 py-1 h-auto" 
                    >
                      <Grid3X3 className="w-3 h-3 mr-1" />
                      Desliza →
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </CarouselItem>
          
          {/* Individual gallery images */}
          {images.slice(1).map((image, index) => (
            <CarouselItem key={index} className="pl-2 md:pl-4">
              <Card className="overflow-hidden bg-black aspect-video">
                <div className="relative w-full h-full">
                  <img 
                    src={image.src} 
                    alt={image.alt} 
                    className="w-full h-full object-cover select-none"
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-black/20" />
                  
                  {/* Image counter */}
                  <div className="absolute bottom-4 right-4">
                    <span className="text-white text-xs bg-black/50 backdrop-blur-sm px-2 py-1 rounded">
                      {currentSlide + 1} / {images.length}
                    </span>
                  </div>
                </div>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
};

export default TouchSlideGallery;