import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart, History, MapPin, Clock, Users, Star, Trash2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import { formatReservationDate, formatPYG } from "@/lib/format";
import { useCart } from "@/context/CartContext";

// Mock data para el carrito
const mockCartItems = [
  {
    id: 1,
    venueName: "Morgan Rooftop",
    venueType: "discoteca",
    date: "2024-09-15",
    time: "23:00",
    tableType: "Mesa VIP",
    people: 6,
    price: 450000,
    image: "/images/bar.jpg"
  },
  {
    id: 2,
    venueName: "Killkenny Pub",
    venueType: "bar",
    date: "2024-09-20",
    time: "20:00",
    tableType: "Mesa Regular",
    people: 4,
    price: 180000,
    image: "/images/bar.jpg"
  }
];

// Mock data para el historial
const mockHistory = [
  {
    id: 101,
    venueName: "Celavie Lounge",
    venueType: "discoteca",
    date: "2024-08-28",
    time: "23:30",
    tableType: "Mesa VIP",
    people: 8,
    price: 600000,
    status: "completada",
    rating: 5,
    image: "/images/bar.jpg"
  },
  {
    id: 102,
    venueName: "Mckharthys Irish Pub",
    venueType: "bar",
    date: "2024-08-15",
    time: "19:30",
    tableType: "Mesa Regular",
    people: 4,
    price: 200000,
    status: "completada",
    rating: 4,
    image: "/images/bar.jpg"
  },
  {
    id: 103,
    venueName: "Arenal Club",
    venueType: "discoteca",
    date: "2024-08-10",
    time: "00:00",
    tableType: "Mesa Premium",
    people: 6,
    price: 500000,
    status: "cancelada",
    rating: null,
    image: "/images/bar.jpg"
  }
];

export default function Reservas() {
  const { toast } = useToast();
  const { state, setQuantity, removeItem } = useCart();

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(itemId);
      return;
    }
    setQuantity(itemId, newQuantity);
  };

  const removeFromCart = (itemId: string) => {
    removeItem(itemId);
    toast({
      title: "Eliminado del carrito",
      description: "La reserva ha sido eliminada de tu carrito.",
    });
  };

  const proceedToCheckout = () => {
    toast({
      title: "Procesando reservas...",
      description: "Serás redirigido al proceso de pago.",
    });
  };

  const total = state.total;


  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" } = {
      completada: "default",
      cancelada: "destructive",
      pendiente: "secondary"
    };
    
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Volver al inicio
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Mis Reservas</h1>
                <p className="text-muted-foreground">Gestiona tu carrito e historial de reservas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="carrito" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="carrito" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Carrito ({state.items.length})
            </TabsTrigger>
            <TabsTrigger value="historial" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historial ({mockHistory.length})
            </TabsTrigger>
          </TabsList>

          {/* Carrito Tab */}
          <TabsContent value="carrito" className="space-y-6">
            {state.items.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <ShoppingCart className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Tu carrito está vacío</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Explora nuestros bares y discotecas para hacer tu primera reserva
                  </p>
                  <Button asChild>
                    <Link to="/bares">Ver bares</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Cart Items */}
                <div className="lg:col-span-2 space-y-4">
                {state.items.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <img
                          src="/images/bar.jpg"
                          alt={item.venue}
                          className="w-full sm:w-24 h-24 object-cover rounded-lg"
                        />
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{item.venue}</h3>
                              <Badge variant="outline" className="capitalize">
                                {item.type}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromCart(item.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>{formatReservationDate(item.date!)} - {item.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span>{item.name}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <span className="w-8 text-center">{item.quantity}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="text-lg font-semibold">
                              {formatPYG(item.totalPrice)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                </div>

                {/* Order Summary */}
                <div className="lg:col-span-1">
                  <Card className="sticky top-6">
                    <CardHeader>
                      <CardTitle>Resumen del pedido</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span>{formatPYG(total)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Comisión de servicio</span>
                          <span>{formatPYG(total * 0.1)}</span>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span>{formatPYG(total * 1.1)}</span>
                      </div>
                      
                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={proceedToCheckout}
                      >
                        Proceder al pago
                      </Button>
                      
                      <p className="text-xs text-muted-foreground text-center">
                        Al continuar, aceptas nuestros términos y condiciones
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Historial Tab */}
          <TabsContent value="historial" className="space-y-6">
            {mockHistory.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <History className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No tienes reservas anteriores</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Tus reservas completadas aparecerán aquí
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {mockHistory.map((reservation) => (
                  <Card key={reservation.id}>
                    <CardContent className="p-6">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <img
                          src={reservation.image}
                          alt={reservation.venueName}
                          className="w-full sm:w-24 h-24 object-cover rounded-lg"
                        />
                        
                        <div className="flex-1 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-semibold text-lg">{reservation.venueName}</h3>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="capitalize">
                                  {reservation.venueType}
                                </Badge>
                                {getStatusBadge(reservation.status)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{formatPYG(reservation.price)}</div>
                              <div className="text-sm text-muted-foreground">
                                Reserva #{reservation.id}
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              <span>{formatReservationDate(reservation.date)} - {reservation.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span>{reservation.tableType}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              <span>{reservation.people} personas</span>
                            </div>
                          </div>
                          
                          {reservation.rating && reservation.status === "completada" && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Tu calificación:</span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < reservation.rating!
                                        ? "text-yellow-400 fill-yellow-400"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {reservation.status === "completada" && !reservation.rating && (
                              <Button variant="outline" size="sm">
                                Calificar experiencia
                              </Button>
                            )}
                            <Button variant="outline" size="sm">
                              Ver detalles
                            </Button>
                            {reservation.status === "completada" && (
                              <Button variant="outline" size="sm">
                                Reservar de nuevo
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Safe bottom space for mobile to avoid overlap and unify spacing */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      <BottomNavbar />
    </div>
  );
}