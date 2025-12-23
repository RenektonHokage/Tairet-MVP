import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Star, ArrowLeft, ThumbsUp, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import SearchBar from "@/components/SearchBar";
import Footer from "@/components/Footer";
import type { PageReview } from "@/lib/types";

// Extended reviews data
const allReviews: PageReview[] = [
  {
    id: 1,
    author: "Maria García",
    avatar: "/placeholder.svg",
    initials: "MG",
    rating: 5,
    date: "hace 2 días",
    venue: "Morgan Rooftop",
    venueType: "club",
    comment: "Increíble experiencia en Morgan! La música estuvo perfecta toda la noche y el ambiente muy bueno. La terraza tiene una vista espectacular de la ciudad. El servicio fue excelente y los tragos de muy buena calidad. Definitivamente volvería.",
    helpful: 12,
    verified: true,
    images: []
  },
  {
    id: 2,
    author: "Carlos Mendoza",
    avatar: "/placeholder.svg", 
    initials: "CM",
    rating: 4,
    date: "hace 5 días",
    venue: "Celavie Lounge",
    venueType: "bar",
    comment: "Muy buen ambiente, perfecto para una salida con amigos. Los cocteles están muy bien preparados y el DJ tocó buena música. El lugar es elegante y cómodo.",
    helpful: 8,
    verified: true,
    images: []
  },
  {
    id: 3,
    author: "Ana Rodríguez",
    avatar: "/placeholder.svg",
    initials: "AR", 
    rating: 5,
    date: "hace 1 semana",
    venue: "Killkenny Pub",
    venueType: "bar",
    comment: "El mejor pub de Asunción! Las cervezas artesanales son espectaculares y la comida muy rica. El ambiente es súper acogedor y el personal muy atento. Recomiendo 100%.",
    helpful: 15,
    verified: true,
    images: []
  },
  {
    id: 4,
    author: "Diego Silva",
    avatar: "/placeholder.svg",
    initials: "DS",
    rating: 4,
    date: "hace 1 semana", 
    venue: "Mckharthys Bar",
    venueType: "bar",
    comment: "Buena experiencia general. El lugar es amplio y tiene buena música. Los precios son razonables y el servicio es bueno. Ideal para ir en grupo.",
    helpful: 6,
    verified: false,
    images: []
  },
  {
    id: 5,
    author: "Lucía Fernández",
    avatar: "/placeholder.svg",
    initials: "LF",
    rating: 5,
    date: "hace 2 semanas",
    venue: "Arenal Club",
    venueType: "club", 
    comment: "¡Qué noche increíble! La música reggaeton estuvo genial, el ambiente muy bueno y la pista siempre llena. Los tragos ricos y el personal súper amable. Volveré pronto.",
    helpful: 20,
    verified: true,
    images: []
  },
  {
    id: 6,
    author: "Roberto Pérez",
    avatar: "/placeholder.svg",
    initials: "RP",
    rating: 3,
    date: "hace 2 semanas",
    venue: "Bodega Urbana",
    venueType: "bar",
    comment: "El lugar está bien pero nada extraordinario. Los vinos son buenos pero la atención podría mejorar. El ambiente es tranquilo, ideal para una cita.",
    helpful: 4,
    verified: false,
    images: []
  },
  {
    id: 7,
    author: "Valentina López",
    avatar: "/placeholder.svg",
    initials: "VL",
    rating: 5,
    date: "hace 3 semanas",
    venue: "Triana Night",
    venueType: "club",
    comment: "Espectacular! La música tech house estuvo perfecta, el sonido impecable y las luces alucinantes. El lugar es muy elegante y el servicio VIP valió la pena.",
    helpful: 18,
    verified: true,
    images: []
  },
  {
    id: 8,
    author: "Sebastián Ruiz",
    avatar: "/placeholder.svg",
    initials: "SR",
    rating: 4,
    date: "hace 3 semanas",
    venue: "Río Taproom",
    venueType: "bar",
    comment: "Muy buenas cervezas artesanales y las hamburguesas están deliciosas. El ambiente es relajado y perfecto para después del trabajo. Buena relación precio-calidad.",
    helpful: 9,
    verified: true,
    images: []
  },
  {
    id: 9,
    author: "Camila Torres",
    avatar: "/placeholder.svg",
    initials: "CT",
    rating: 5,
    date: "hace 1 mes",
    venue: "Morgan Rooftop",
    venueType: "club",
    comment: "La mejor vista de Asunción! El rooftop es increíble, especialmente al atardecer. La música estuvo genial y los tragos muy bien preparados. Experiencia inolvidable.",
    helpful: 25,
    verified: true,
    images: []
  },
  {
    id: 10,
    author: "Javier Martínez",
    avatar: "/placeholder.svg",
    initials: "JM",
    rating: 4,
    date: "hace 1 mes",
    venue: "Alameda Social",
    venueType: "bar",
    comment: "Perfecto para after office. El ambiente es muy bueno, tienen buena variedad de tragos y la música no está muy alta, ideal para conversar.",
    helpful: 7,
    verified: false,
    images: []
  }
];

function ReviewCard({ review }: { review: PageReview }) {
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ));
  };

  return (
    <Card className="hover:shadow-md transition-shadow duration-300">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={review.avatar} alt={review.author} />
              <AvatarFallback>{review.initials}</AvatarFallback>
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

        {/* Venue info */}
        <div className="mb-4">
          <Link 
            to={`/${review.venueType}/${review.venue.toLowerCase().replace(/\s+/g, '-')}`}
            className="text-primary hover:underline font-medium"
          >
            📍 {review.venue}
          </Link>
        </div>

        {/* Comment */}
        <p className="text-foreground mb-4 leading-relaxed">
          {review.comment}
        </p>

        {/* Footer */}
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
  useEffect(() => {
    document.title = "Todas las Reseñas | Tairet";
  }, []);

  return (
    <>
      {/* Navbar */}
      <header className="w-full bg-white border-b border-border">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-4 lg:py-5 grid grid-cols-2 lg:grid-cols-3 items-center">
          {/* Left: Logo/Text */}
          <div className="flex items-center">
            <Link
              to="/"
              className="text-xl sm:text-2xl font-bold text-foreground tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Ir a inicio"
            >
              Tairet
            </Link>
          </div>
          {/* Center: Search bar (desktop) */}
          <div className="hidden lg:flex justify-center">
            <SearchBar />
          </div>
          {/* Right: Auth / Reservations */}
          <div className="flex justify-end items-center space-x-3">
            <Button variant="ghost">Iniciar sesión</Button>
            <Button variant="outline">Mis reservas</Button>
          </div>
        </nav>
        {/* Mobile: search bar below */}
        <div className="lg:hidden px-4 sm:px-6 md:px-8 pb-3">
          <SearchBar />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-8 md:pb-10">
        {/* Header with back button */}
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

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-foreground">{allReviews.length}</div>
              <div className="text-sm text-muted-foreground">Reseñas totales</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-foreground">4.6</div>
              <div className="text-sm text-muted-foreground">Puntuación promedio</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold text-foreground">85%</div>
              <div className="text-sm text-muted-foreground">Usuarios verificados</div>
            </CardContent>
          </Card>
        </div>

        {/* Reviews Grid */}
        <div className="space-y-6">
          {allReviews.map(review => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </main>

      <Footer />
    </>
  );
}