import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Share2, Heart, Play, Grid3X3 } from "lucide-react";
import { useState } from "react";
import heroNightlife from "@/assets/hero-nightlife.jpg";
import nightlifeScene from "@/assets/nightlife-scene.jpg";
import djGuests from "@/assets/dj-guests.jpg";
import partyVideo from "@/assets/party-video-placeholder.jpg";
import afterOffice from "@/assets/after-office.jpg";

const EventHero = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  
  const galleryImages = [
    { src: nightlifeScene, alt: "Image 1" },
    { src: djGuests, alt: "Image 2" },
    { src: afterOffice, alt: "Image 3" },
    { src: partyVideo, alt: "Image 4" }
  ];

  return (
    <section className="min-h-screen bg-background">
      {/* Header Navigation */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center space-x-8">
          <h1 className="text-2xl font-bold">fever</h1>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <span>📍 São Paulo</span>
            <span>🏷️ Categorias</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-muted rounded-full px-4 py-2">
            <span className="text-sm">🔍 Descobrir espetáculos ao vivo</span>
          </div>
          <span className="text-sm">🇵🇹 PT</span>
          <Heart className="w-5 h-5" />
          <div className="w-8 h-8 bg-muted rounded-full" />
        </div>
      </header>

      {/* Hero Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-2">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            <div className="relative">
              <Card className="overflow-hidden bg-black aspect-video">
                <div className="relative w-full h-full">
                  <img src={heroNightlife} alt="Main Event" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20" />
                  
                  {/* Play Button */}
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute bottom-4 left-4 rounded-full bg-white/20 backdrop-blur-sm border-white/20 hover:bg-white/30" 
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    <Play className="w-6 h-6 text-white" />
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Sidebar - Right Side */}
          <div className="h-full">
            <div className="relative h-full">
              <div className="grid grid-cols-2 gap-1 h-full mx-0">
                {galleryImages.map((image, index) => (
                  <div key={index} className="overflow-hidden rounded-lg cursor-pointer hover:opacity-90 transition-opacity relative">
                    <img src={image.src} alt={image.alt} className="w-full h-full object-cover" />
                    {index === 3 && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm text-black hover:bg-white text-xs px-2 py-1 h-auto" 
                        onClick={() => setShowGallery(!showGallery)}
                      >
                        <Grid3X3 className="w-3 h-3 mr-1" />
                        Galeria
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default EventHero;