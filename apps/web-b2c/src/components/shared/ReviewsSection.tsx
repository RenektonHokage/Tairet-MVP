import React, { useMemo, useState } from "react";
import { Star, ThumbsUp, MessageSquare, PenSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useReviews, type ReviewVenueType } from "@/hooks/useReviews";
import { getOrCreateFingerprint } from "@/lib/fingerprint";
import { useToast } from "@/hooks/use-toast";

interface ReviewsSectionProps {
  venueId: string | null;
  venueType: ReviewVenueType;
  highlights: Array<{ label: string; value: string }>;
  className?: string;
}

const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  venueId,
  venueType,
  highlights,
  className = "",
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newReview, setNewReview] = useState({
    author: "",
    title: "",
    rating: 5,
    comment: "",
  });
  const { toast } = useToast();

  const {
    displayedReviews,
    filterType,
    setFilterType,
    showAllReviews,
    toggleShowAll,
    filterCounts,
    averageRating,
    totalReviews,
    ratingDistribution,
    isLoading,
    isSubmitting,
    error,
    submitError,
    clearSubmitError,
    createReview,
  } = useReviews({
    venueId: venueId || undefined,
    venueType,
    scope: "venue",
    limit: 50,
    initialDisplayCount: 5,
    enabled: Boolean(venueId),
  });

  const shouldShowToggle = useMemo(() => filterCounts.all > 5, [filterCounts.all]);

  const handleSubmitReview = async () => {
    if (!venueId) {
      toast({
        title: "Local no disponible",
        description: "No se pudo identificar el local para guardar la reseña.",
        variant: "destructive",
      });
      return;
    }

    if (!newReview.author.trim() || !newReview.comment.trim()) {
      toast({
        title: "Campos incompletos",
        description: "Completá nombre y comentario para publicar la reseña.",
        variant: "destructive",
      });
      return;
    }

    clearSubmitError();

    const result = await createReview({
      venueId,
      venueType,
      displayName: newReview.author.trim(),
      title: newReview.title.trim() || undefined,
      rating: newReview.rating,
      comment: newReview.comment.trim(),
      fingerprint: getOrCreateFingerprint(),
    });

    if (!result.ok) {
      if (result.code === "RATE_LIMIT") {
        const retryText =
          result.retryAfterSeconds && result.retryAfterSeconds > 0
            ? ` Intentá de nuevo en ${Math.ceil(result.retryAfterSeconds / 60)} min.`
            : "";
        toast({
          title: "Límite alcanzado",
          description: `Probá de nuevo más tarde.${retryText}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "No se pudo publicar",
          description: result.message || "Probá de nuevo más tarde.",
          variant: "destructive",
        });
      }
      return;
    }

    toast({
      title: "¡Reseña enviada!",
      description: "Gracias por compartir tu experiencia.",
    });

    setNewReview({ author: "", title: "", rating: 5, comment: "" });
    setIsDialogOpen(false);
  };

  return (
    <section className={`space-y-4 sm:space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">Reseñas</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" disabled={!venueId}>
              <PenSquare className="w-4 h-4" />
              Escribir reseña
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Escribir una reseña</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="author">Nombre</Label>
                <Input
                  id="author"
                  placeholder="Tu nombre"
                  value={newReview.author}
                  onChange={(e) => setNewReview({ ...newReview, author: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título (opcional)</Label>
                <Input
                  id="title"
                  placeholder="Resumen de tu experiencia"
                  value={newReview.title}
                  onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                  maxLength={80}
                />
              </div>

              <div className="space-y-2">
                <Label>Calificación</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReview({ ...newReview, rating: star })}
                      className="focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          star <= newReview.rating
                            ? "fill-primary text-primary"
                            : "fill-none text-muted-foreground"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Comentario</Label>
                <Textarea
                  id="comment"
                  placeholder="Contanos cómo fue tu experiencia..."
                  rows={4}
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  maxLength={1000}
                />
              </div>

              {submitError && <p className="text-sm text-destructive">{submitError}</p>}

              <Button onClick={handleSubmitReview} className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Publicando..." : "Publicar reseña"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">{averageRating.toFixed(1)}</div>
              <div className="flex justify-center mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={star <= Math.round(averageRating) ? "rating-star" : "rating-star-empty"}
                  />
                ))}
              </div>
              <div className="text-sm text-muted-foreground">{totalReviews} reseñas</div>
            </div>

            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating) => {
                const percentage = ratingDistribution[rating] || 0;
                return (
                  <div key={rating} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{rating}</span>
                    <Star className="rating-star-small" />
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground text-xs w-8">{percentage}%</span>
                  </div>
                );
              })}
            </div>

            <div className="space-y-3">
              {highlights.map((highlight, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">{highlight.label}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {highlight.value}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={filterType}
        onValueChange={(value) => setFilterType(value as "all" | "positive" | "negative")}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
          <TabsTrigger value="all" className="text-sm">
            Todas ({filterCounts.all})
          </TabsTrigger>
          <TabsTrigger value="positive" className="text-sm">
            Positivas ({filterCounts.positive})
          </TabsTrigger>
          <TabsTrigger value="negative" className="text-sm">
            Negativas ({filterCounts.negative})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="space-y-3 sm:space-y-4">
        {isLoading ? (
          <Card className="border-border/50">
            <CardContent className="p-4 sm:p-6 text-sm text-muted-foreground">Cargando reseñas...</CardContent>
          </Card>
        ) : displayedReviews.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="p-4 sm:p-6 text-sm text-muted-foreground">
              Todavía no hay reseñas para este local.
            </CardContent>
          </Card>
        ) : (
          displayedReviews.map((review) => (
            <Card key={review.id} className="border-border/50 hover:shadow-lg transition-shadow duration-200">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex gap-3 sm:gap-4">
                  <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">{review.initials}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{review.author}</span>
                          {review.verified && <Badge variant="outline" className="text-xs">Verificado</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={star <= review.rating ? "rating-star-small" : "rating-star-empty"}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">{review.date}</span>
                        </div>
                      </div>
                    </div>

                    {review.title && <p className="text-sm font-medium text-foreground">{review.title}</p>}
                    <p className="text-muted-foreground">{review.comment}</p>

                    <div className="flex items-center gap-2 pt-2">
                      <button className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary">
                        <ThumbsUp className="w-3 h-3" />
                        <span>Útil ({review.helpful})</span>
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {shouldShowToggle && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={toggleShowAll} className="min-w-[200px]">
            {showAllReviews ? "Ver menos reseñas" : "Ver todas las reseñas"}
          </Button>
        </div>
      )}
    </section>
  );
};

export default ReviewsSection;
