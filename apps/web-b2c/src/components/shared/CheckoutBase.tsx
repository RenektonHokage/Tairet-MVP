import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, User, MapPin, X, ShoppingBag, CheckCircle, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatPYG } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { createOrder, Order } from "@/lib/orders";

interface CheckoutBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  venue?: string;
}

const CheckoutBase = ({ isOpen, onClose, title = "Finalizar Compra", venue }: CheckoutBaseProps) => {
  const { state: cartState, clearCart, removeFromCart } = useCart();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    cedula: ""
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [orderCreated, setOrderCreated] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRemoveItem = (index: number) => {
    removeFromCart(index);
    toast({
      title: "Item eliminado",
      description: "El item fue removido del carrito",
    });
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast({ title: "Token copiado", description: "El código fue copiado al portapapeles" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptedTerms) {
      toast({
        title: "Error",
        description: "Debes aceptar los términos y condiciones para continuar",
        variant: "destructive",
      });
      return;
    }

    // Solo permitir free_pass (total = 0) por ahora
    if (cartState.total !== 0) {
      toast({
        title: "Error",
        description: "Por el momento solo están habilitados los Free Pass (entradas gratuitas)",
        variant: "destructive",
      });
      return;
    }

    // Validar que haya items
    if (cartState.items.length === 0) {
      toast({
        title: "Error",
        description: "El carrito está vacío",
        variant: "destructive",
      });
      return;
    }

    // Obtener localId del primer item
    const firstItem = cartState.items[0];
    if (!firstItem.localId) {
      toast({
        title: "Error",
        description: "No se pudo identificar el local. Por favor, vuelve a seleccionar tu entrada.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const order = await createOrder({
        local_id: firstItem.localId,
        quantity: 1, // Forzar 1 para free_pass MVP
        total_amount: 0,
        currency: "PYG",
        payment_method: "free_pass",
        customer_email: formData.email,
        customer_name: formData.firstName,
        customer_last_name: formData.lastName,
        customer_phone: formData.phone,
        customer_document: formData.cedula,
      });

      setOrderCreated(order);
      clearCart();
      
      toast({
        title: "¡Listo!",
        description: "Tu Free Pass fue creado. Revisa tu email.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo completar la compra",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  // Vista de confirmación después de compra exitosa
  if (orderCreated) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-background max-w-md w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-lg">
          <div className="p-6 space-y-6 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
            <h2 className="text-2xl font-bold text-foreground">¡Free Pass Creado!</h2>
            <p className="text-muted-foreground">
              Te enviamos un email con tu código a <strong>{formData.email}</strong>
            </p>
            
            {/* QR Code */}
            <div className="bg-white p-6 rounded-lg inline-block mx-auto">
              <QRCodeSVG value={orderCreated.checkin_token} size={200} level="M" />
            </div>
            
            {/* Token con botón copiar */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tu código de entrada:</p>
              <div className="flex items-center gap-2 justify-center">
                <code className="flex-1 max-w-xs p-2 bg-muted rounded text-xs break-all font-mono text-left">
                  {orderCreated.checkin_token}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToken(orderCreated.checkin_token)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              También puedes ver tus entradas en <strong>Mis Entradas</strong> ingresando tu email.
            </p>
            
            <div className="flex gap-3 justify-center pt-4">
              <Button variant="outline" onClick={() => { setOrderCreated(null); onClose(); }}>
                Cerrar
              </Button>
              <Button asChild>
                <Link to="/mis-entradas">Ver Mis Entradas</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-background max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg shadow-lg">
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Order Summary */}
            <div className="lg:order-2">
              <Card className="sticky top-4 border-2">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShoppingBag className="h-5 w-5 text-primary" />
                    Resumen del Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {venue && (
                    <>
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground">{venue}</p>
                          <p className="text-xs text-muted-foreground">Local</p>
                        </div>
                      </div>
                      <Separator />
                    </>
                  )}

                  {cartState.items.length === 0 ? (
                    <div className="text-center py-8">
                      <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">No hay items en el carrito</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cartState.items.map((item, index) => (
                        <div 
                          key={`${item.type}-${item.id}-${index}`} 
                          className="group relative p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          
                          <div className="flex justify-between items-start gap-3">
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-foreground">
                                  {item.name}
                                </p>
                                {item.type === 'table' && (
                                  <Badge variant="secondary" className="text-xs">
                                    Mesa
                                  </Badge>
                                )}
                                {item.type === 'ticket' && (
                                  <Badge variant="default" className="text-xs">
                                    Entrada
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                <span>Cantidad: {item.quantity}</span>
                                {item.date && <span>Fecha: {item.date}</span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-primary">
                                {formatPYG(item.totalPrice)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator className="my-4" />

                  <div className="flex justify-between items-center p-4 bg-primary/5 rounded-lg border-2 border-primary/20">
                    <p className="font-semibold text-foreground text-base">Total</p>
                    <p className="text-xl font-bold text-primary">
                      {formatPYG(cartState.total)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Checkout Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Información Personal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Nombre *</Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange('firstName', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Apellido *</Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange('lastName', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono *</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cedula">Cédula *</Label>
                      <Input
                        id="cedula"
                        value={formData.cedula}
                        onChange={(e) => handleInputChange('cedula', e.target.value)}
                        required
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Terms and Conditions */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        id="terms" 
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                        className="mt-1"
                      />
                      <div className="space-y-1">
                        <label 
                          htmlFor="terms" 
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          Acepto los términos y condiciones *
                        </label>
                        <p className="text-xs text-muted-foreground">
                          Al continuar, aceptas nuestros{" "}
                          <Link 
                            to="/informacion/terminos-condiciones" 
                            className="text-primary hover:underline"
                            target="_blank"
                          >
                            Términos y Condiciones
                          </Link>
                          {" "}y nuestra{" "}
                          <Link 
                            to="/informacion/politica-privacidad" 
                            className="text-primary hover:underline"
                            target="_blank"
                          >
                            Política de Privacidad
                          </Link>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={isProcessing || cartState.items.length === 0 || !acceptedTerms}
                >
                  {isProcessing ? "Procesando..." : `Pagar ${formatPYG(cartState.total)}`}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutBase;