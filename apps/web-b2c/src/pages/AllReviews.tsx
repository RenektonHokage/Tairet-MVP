import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Star, ArrowLeft, ThumbsUp, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import SearchBar from "@/components/SearchBar";
import Footer from "@/components/Footer";
import { useReviews, type Review } from "@/hooks/useReviews";

function ReviewCard({ review }: { review: Review }) {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
      />
    ));
  };

  const venuePath = review.venueSlug ? `/${review.venueType}/${review.venueSlug}` : "#";

  return (
    <Card className="hover:shadow-md transition-shadow duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>{review.initials || "?"}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground">{review.author}</h4>
                {review.verified && (
                  <Badge variant="secondary" className="text-xs">
                    Verificado
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex">{renderStars(review.rating)}</div>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{review.date}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>

        <div className="mb-4">
          <Link to={venuePath} className="text-primary hover:underline font-medium">
            📍 {review.venueName || "Local"}
          </Link>
        </div>

        {review.title && <p className="font-medium text-foreground mb-2">{review.title}</p>}
        <p className="text-foreground mb-4 leading-relaxed">{review.comment}</p>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <ThumbsUp className="w-4 h-4" />
            Útil ({review.helpful})
          </Button>
          <Button variant="ghost" size="sm">
            Responder
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AllReviews() {
  const { reviews, isLoading, error, totalReviews, averageRating } = useReviews({
    scope: "global",
    limit: 100,
    initialDisplayCount: 100,
  });

  useEffect(() => {
    document.title = "Todas las Reseñas | Tairet";
  }, []);

  const verifiedPercent = useMemo(() => {
    if (!reviews.length) return 0;
    const verified = reviews.filter((review) => review.verified).length;
    return Math.round((verified / reviews.length) * 100);
  }, [reviews]);

  return (
    <>
      <header className="w-full bg-white border-b border-border">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 lg:py-5 grid grid-cols-2 lg:grid-cols-3 items-center">
          <div className="flex items-center">
            <Link
              to="/"
              className="text-xl sm:text-2xl font-bold text-foreground tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ir a inicio"
            >
              Tairet
            </Link>
          </div>
          <div className="hidden lg:flex justify-center">
            <SearchBar />
          </div>
          <div className="flex justify-end items-center space-x-3">
            <Button variant="ghost">Iniciar sesión</Button>
            <Button variant="outline">Mis reservas</Button>
          </div>
        </nav>
        <div className="lg:hidden px-4 sm:px-6 md:px-8 pb-3">
          <SearchBar />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-8 md:pb-10">
        <div className="mb-8 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.history.back()}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-foreground">Reseñas de la Comunidad</h1>
            <p className="text-muted-foreground mt-2">Descubre qué dice la comunidad sobre los mejores lugares</p>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-foreground">{totalReviews}</div>
              <div className="text-sm text-muted-foreground">Reseñas totales</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-foreground">{averageRating.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Puntuación promedio</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-foreground">{verifiedPercent}%</div>
              <div className="text-sm text-muted-foreground">Usuarios verificados</div>
            </CardContent>
          </Card>
        </div>

        {error && (
          <Card className="mb-6 border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-6 text-muted-foreground">Cargando reseñas...</CardContent>
            </Card>
          ) : reviews.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-muted-foreground">Todavía no hay reseñas publicadas.</CardContent>
            </Card>
          ) : (
            reviews.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
