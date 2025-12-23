import React from 'react';
import { Star, Award, Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BarStoryProps {
  story: string;
  highlights: string[];
  specialties: string[];
}

const BarStory: React.FC<BarStoryProps> = ({ story, highlights, specialties }) => {
  return (
    <section className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Nuestra Historia</h2>
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Heart className="w-3 h-3 mr-1" />
          Tradición
        </Badge>
      </div>

      {/* Story Section */}
      <Card className="border-border/50">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <p className="text-muted-foreground leading-relaxed">
            {story}
          </p>
        </CardContent>
      </Card>

      {/* Highlights Section */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card className="border-border/50">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg text-foreground">Nuestras Fortalezas</h3>
            </div>
            <div className="space-y-2">
              {highlights.map((highlight, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Star className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                  <span>{highlight}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-lg text-foreground">Especialidades</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {specialties.map((specialty, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {specialty}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};

export default BarStory;