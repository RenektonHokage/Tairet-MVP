import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  User,
  MapPin,
  X,
  ShoppingBag,
  CheckCircle,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { formatPYG } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import { createOrder, Order, type OrderItemPayload } from "@/lib/orders";
import { isUuidLike } from "@/lib/types";
import { es } from "date-fns/locale";

interface CheckoutBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  venue?: string;
}

const ASUNCION_TZ = "America/Asuncion";

const pad2 = (value: number): string => value.toString().padStart(2, "0");

const parseIsoDate = (iso: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() + 1 !== month ||
    utcDate.getUTCDate() !== day
  ) {
    return null;
  }

  return utcDate;
};

const dateToIsoFromLocal = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const isoFromUtcDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

const addDaysToIso = (iso: string, days: number): string => {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return isoFromUtcDate(parsed);
};

const getAsuncionTodayIso = (): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ASUNCION_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
};

const isIsoWithinRange = (iso: string, minIso: string, maxIso: string): boolean =>
  iso >= minIso && iso <= maxIso;

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

  const todayIso = useMemo(() => getAsuncionTodayIso(), []);
  const maxSelectableIso = useMemo(() => addDaysToIso(todayIso, 30), [todayIso]);
  const [selectedDate, setSelectedDate] = useState(todayIso);

  const selectedDateAsDate = useMemo(() => parseIsoDate(selectedDate), [selectedDate]);
  const minSelectableDate = useMemo(() => parseIsoDate(todayIso), [todayIso]);
  const maxSelectableDate = useMemo(() => parseIsoDate(maxSelectableIso), [maxSelectableIso]);

  const selectedDateDisplay = useMemo(() => {
    const parsed = parseIsoDate(selectedDate);
    if (!parsed) return "Sin fecha seleccionada";
    return new Intl.DateTimeFormat("es-PY", {
      timeZone: ASUNCION_TZ,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(parsed);
  }, [selectedDate]);

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

    // Bloquear si hay items inválidos (legacy sin UUID)
    if (cartState.hasInvalidItems) {
      toast({
        title: "Error",
        description: "Tu carrito tiene items desactualizados. Vacía el carrito y vuelve a seleccionar tus entradas.",
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

    // Validar que todos los tickets tengan ticket_type_id UUID válido
    const ticketItems = cartState.items.filter(
      (item) => item.kind === "ticket" || item.type === "ticket"
    );
    const hasTicketItems = ticketItems.length > 0;

    if (hasTicketItems) {
      if (!selectedDate) {
        toast({
          title: "Error",
          description: "Debes seleccionar una fecha para continuar.",
          variant: "destructive",
        });
        return;
      }

      const parsedSelectedDate = parseIsoDate(selectedDate);
      if (!parsedSelectedDate || !isIsoWithinRange(selectedDate, todayIso, maxSelectableIso)) {
        toast({
          title: "Error",
          description: "La fecha seleccionada está fuera del rango permitido.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validación 1: todos los tickets deben tener ticket_type_id UUID
    const invalidTicketIds = ticketItems.filter(
      (item) => !item.ticket_type_id || !isUuidLike(item.ticket_type_id)
    );
    if (invalidTicketIds.length > 0) {
      toast({
        title: "Error",
        description: "Algunos tickets no tienen ID válido. Por favor, vuelve a seleccionar tus entradas.",
        variant: "destructive",
      });
      return;
    }

    // Validación 2: todos los items deben tener quantity > 0
    const invalidQty = ticketItems.filter(
      (item) => typeof item.quantity !== "number" || item.quantity <= 0
    );
    if (invalidQty.length > 0) {
      toast({
        title: "Error",
        description: "Algunos items tienen cantidad inválida.",
        variant: "destructive",
      });
      return;
    }

    // Validación 3: todos los items deben tener price como número
    const invalidPrice = ticketItems.filter(
      (item) => typeof item.price !== "number"
    );
    if (invalidPrice.length > 0) {
      toast({
        title: "Error",
        description: "Algunos items tienen precio inválido.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Construir items con formato del contrato backend: { ticket_type_id, quantity }
      const orderItems: OrderItemPayload[] = ticketItems.map((item) => ({
        ticket_type_id: item.ticket_type_id!, // Ya validado como UUID
        quantity: Number(item.quantity), // Usar quantity (no qty)
      }));

      // Validación 4: debe haber al menos un item para enviar
      if (orderItems.length === 0) {
        toast({
          title: "Error",
          description: "No hay entradas válidas en el carrito.",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      // Calcular cantidad total desde items
      const totalQty = orderItems.reduce((sum, i) => sum + i.quantity, 0) || 1;

      const order = await createOrder({
        local_id: firstItem.localId,
        quantity: totalQty,
        total_amount: cartState.total,
        currency: "PYG",
        payment_method: "free_pass",
        intended_date: hasTicketItems ? selectedDate : undefined,
        customer_email: formData.email,
        customer_name: formData.firstName,
        customer_last_name: formData.lastName,
        customer_phone: formData.phone,
        customer_document: formData.cedula,
        items: orderItems, // Siempre enviar items (ya validados)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-x-hidden bg-black/70 p-3 sm:p-4">
      <div className="max-h-[95vh] w-full max-w-6xl overflow-x-hidden overflow-y-auto rounded-2xl border border-white/10 bg-[#101010] text-white shadow-2xl">
        <div className="min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="grid grid-cols-[auto_1fr] items-center gap-3 sm:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="justify-start px-2 text-white/80 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>
            <h2 className="pl-1 text-left text-2xl font-bold leading-tight text-white sm:pl-2 sm:text-3xl">{title}</h2>
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-6">
            {/* Order Summary */}
            <div className="min-w-0 xl:order-2">
              <Card className="sticky top-4 border border-white/10 bg-[#171717]">
                <CardHeader className="border-b border-white/10 bg-white/[0.03]">
                  <CardTitle className="flex items-center gap-2 text-lg text-white sm:text-xl">
                    <ShoppingBag className="h-5 w-5 text-white/80" />
                    Resumen del Pedido
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {venue && (
                    <>
                      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#111111] p-3">
                        <MapPin className="h-5 w-5 flex-shrink-0 text-white/75" />
                        <div>
                          <p className="font-semibold text-white">{venue}</p>
                          <p className="text-xs text-white/55">Local</p>
                        </div>
                      </div>
                      <Separator className="bg-white/10" />
                    </>
                  )}

                  {cartState.hasInvalidItems && (
                    <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
                      <p className="text-sm font-medium text-destructive">
                        Tu carrito tiene items desactualizados que no se pueden procesar.
                      </p>
                      <p className="text-xs text-white/70">
                        Por favor, vacía el carrito y vuelve a seleccionar tus entradas.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          clearCart();
                          toast({
                            title: "Carrito vaciado",
                            description: "Ahora puedes seleccionar nuevas entradas.",
                          });
                        }}
                      >
                        Vaciar carrito
                      </Button>
                    </div>
                  )}

                  {cartState.items.length === 0 ? (
                    <div className="py-8 text-center">
                      <ShoppingBag className="mx-auto mb-2 h-12 w-12 text-white/45" />
                      <p className="text-sm text-white/55">No hay items en el carrito</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cartState.items.map((item, index) => {
                        const displayDate = item.type === "ticket" ? selectedDate : item.date;

                        return (
                          <div
                            key={`${item.type}-${item.id}-${index}`}
                            className={`group relative rounded-lg border p-3 transition-colors ${
                              item._invalid
                                ? "border-destructive/50 bg-destructive/5"
                                : "border-white/10 bg-[#121212] hover:bg-[#1c1c1c]"
                            }`}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity hover:bg-destructive/90 group-hover:opacity-100"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>

                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-white">{item.name}</p>
                                  {item.type === "table" && (
                                    <Badge variant="secondary" className="text-xs">
                                      Mesa
                                    </Badge>
                                  )}
                                  {item.type === "ticket" && (
                                    <Badge className="bg-white text-xs text-[#0f131b] hover:bg-white">Entrada</Badge>
                                  )}
                                  {item._invalid && (
                                    <Badge variant="destructive" className="text-xs">
                                      Inválido
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex flex-col gap-0.5 text-xs text-white/72">
                                  <span>Cantidad: {item.quantity}</span>
                                  {displayDate && <span>Fecha: {displayDate}</span>}
                                </div>
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <p className="text-sm font-bold text-white">{formatPYG(item.totalPrice)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Separator className="my-4 bg-white/10" />

                  <div className="flex items-center justify-between rounded-xl border-2 border-white/20 bg-white/[0.03] p-4">
                    <p className="text-base font-semibold text-white">Total</p>
                    <p className="text-4xl font-bold text-white sm:text-3xl">{formatPYG(cartState.total)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Checkout Form */}
            <div className="min-w-0 xl:order-1">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Date Selection */}
                <Card className="border border-white/10 bg-[#171717]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <CalendarDays className="h-5 w-5 text-white/80" />
                      Elegí tu fecha
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="mx-auto w-full max-w-[22rem] rounded-2xl border border-white/10 bg-[#131313] p-3 sm:max-w-[26rem] sm:p-4">
                      <Calendar
                        mode="single"
                        locale={es}
                        selected={selectedDateAsDate ?? undefined}
                        defaultMonth={selectedDateAsDate ?? minSelectableDate ?? undefined}
                        fromDate={minSelectableDate ?? undefined}
                        toDate={maxSelectableDate ?? undefined}
                        onSelect={(date) => {
                          if (!date) {
                            setSelectedDate("");
                            return;
                          }
                          const nextIso = dateToIsoFromLocal(date);
                          if (isIsoWithinRange(nextIso, todayIso, maxSelectableIso)) {
                            setSelectedDate(nextIso);
                          }
                        }}
                        disabled={(date) => {
                          const iso = dateToIsoFromLocal(date);
                          return !isIsoWithinRange(iso, todayIso, maxSelectableIso);
                        }}
                        className="mx-auto w-full bg-transparent p-0"
                        components={{
                          IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                          IconRight: () => <ChevronRight className="h-4 w-4" />,
                        }}
                        classNames={{
                          months: "flex flex-col",
                          month: "space-y-4",
                          caption: "relative flex items-center justify-center pb-1",
                          caption_label: "text-base sm:text-lg font-semibold text-white",
                          nav: "absolute inset-x-0 top-0 flex items-center justify-between px-1",
                          nav_button:
                            "h-7 w-7 rounded-md bg-transparent p-0 text-white/60 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25",
                          nav_button_previous: "relative left-0",
                          nav_button_next: "relative right-0",
                          table: "w-full border-collapse",
                          head_row: "flex justify-between",
                          head_cell: "w-9 text-center text-xs font-medium lowercase text-white/55 sm:w-10 sm:text-sm",
                          row: "mt-2 flex justify-between",
                          cell: "relative p-0 text-center",
                          day: "h-9 w-9 rounded-md text-sm font-medium text-white/90 transition-colors hover:bg-white/10 sm:h-10 sm:w-10",
                          day_selected:
                            "border border-white/30 bg-white/10 text-white hover:bg-white/15 focus:bg-white/15",
                          day_today: "border border-white/20 bg-white/5 text-white",
                          day_outside: "text-white/25 opacity-60",
                          day_disabled: "cursor-not-allowed text-white/20 opacity-50",
                          day_hidden: "invisible",
                        }}
                      />
                    </div>

                    <div className="flex justify-center">
                      <p className="text-center text-xs text-white/55 sm:text-sm">
                        Fecha seleccionada:{" "}
                        <span className="font-semibold text-white">{selectedDateDisplay}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Personal Information */}
                <Card className="border border-white/10 bg-[#171717]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <User className="h-5 w-5 text-white/80" />
                      Información Personal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="firstName" className="text-white/90">
                          Nombre *
                        </Label>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) => handleInputChange("firstName", e.target.value)}
                          className="h-12 border-white/10 bg-[#111111] text-white placeholder:text-white/35"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName" className="text-white/90">
                          Apellido *
                        </Label>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) => handleInputChange("lastName", e.target.value)}
                          className="h-12 border-white/10 bg-[#111111] text-white placeholder:text-white/35"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white/90">
                        Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="h-12 border-white/10 bg-[#111111] text-white placeholder:text-white/35"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-white/90">
                        Teléfono *
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => handleInputChange("phone", e.target.value)}
                        className="h-12 border-white/10 bg-[#111111] text-white placeholder:text-white/35"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cedula" className="text-white/90">
                        Cédula *
                      </Label>
                      <Input
                        id="cedula"
                        value={formData.cedula}
                        onChange={(e) => handleInputChange("cedula", e.target.value)}
                        className="h-12 border-white/10 bg-[#111111] text-white placeholder:text-white/35"
                        required
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Terms and Conditions */}
                <Card className="border border-white/10 bg-[#171717]">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="terms"
                        checked={acceptedTerms}
                        onCheckedChange={(checked) => setAcceptedTerms(checked as boolean)}
                        className="mt-1 border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[#0f131b]"
                      />
                      <div className="space-y-1">
                        <label htmlFor="terms" className="cursor-pointer text-sm font-medium leading-none text-white">
                          Acepto los términos y condiciones *
                        </label>
                        <p className="text-xs text-white/70">
                          Al continuar, aceptas nuestros{" "}
                          <Link
                            to="/informacion/terminos-condiciones"
                            className="text-white/85 hover:text-white hover:underline"
                            target="_blank"
                          >
                            Términos y Condiciones
                          </Link>
                          {" "}y nuestra{" "}
                          <Link
                            to="/informacion/politica-privacidad"
                            className="text-white/85 hover:text-white hover:underline"
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
                  className="h-12 w-full rounded-lg bg-white/60 text-[#111827] hover:bg-white/80"
                  size="lg"
                  disabled={
                    isProcessing || cartState.items.length === 0 || !acceptedTerms || cartState.hasInvalidItems
                  }
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
