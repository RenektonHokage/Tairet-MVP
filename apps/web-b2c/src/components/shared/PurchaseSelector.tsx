import { useState } from "react";
import { Users, Minus, Plus, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TicketType, TableType, PurchaseSelectorProps, SelectedItem, CartItem } from "@/lib/types";
import CheckoutBase from "@/components/shared/CheckoutBase";
import { formatPYG } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { trackWhatsappClick } from "@/lib/api";
const PurchaseSelector = ({
  tickets = [],
  tables = [],
  onCheckout,
  title = "Compra de Entradas y Mesas",
  subtitle = "Selecciona las opciones que deseas",
  mode = "both",
  whatsappNumber,
  localId
}: PurchaseSelectorProps) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [openCollapsibles, setOpenCollapsibles] = useState<Record<string, boolean>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const {
    addItem
  } = useCart();
  const updateQuantity = (itemId: string, change: number) => {
    setQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + change)
    }));
  };
  const toggleCollapsible = (itemId: string, open: boolean) => {
    setOpenCollapsibles(prev => ({
      ...prev,
      [itemId]: open
    }));
    // Removido el scroll automático que causaba el problema
  };
  const getTotalAmount = () => {
    return Object.entries(quantities).reduce((total, [itemId, quantity]) => {
      const ticket = tickets.find(t => t.id === itemId);
      const table = tables.find(t => t.id === itemId);
      const item = ticket || table;
      return total + (item ? item.price * quantity : 0);
    }, 0);
  };
  const hasItems = Object.values(quantities).some(q => q > 0);
  const getSelectedItems = (): SelectedItem[] => {
    return Object.entries(quantities).filter(([_, quantity]) => quantity > 0).map(([itemId, quantity]) => {
      const ticket = tickets.find(t => t.id === itemId);
      const table = tables.find(t => t.id === itemId);
      return {
        item: ticket || table!,
        quantity,
        type: ticket ? 'ticket' : 'table'
      } as SelectedItem;
    });
  };
  const handleCheckout = () => {
    // Add items to cart
    const selectedItems = getSelectedItems();
    selectedItems.forEach(({
      item,
      quantity,
      type
    }) => {
      const cartItem: CartItem = {
        id: `${type}-${item.id}-${Date.now()}`,
        type: type as 'ticket' | 'table',
        name: item.name,
        venue: "Venue Name",
        localId, // UUID del local para crear orders
        quantity,
        price: item.price,
        totalPrice: item.price * quantity,
        date: new Date().toISOString().split('T')[0],
        time: "21:00"
      };
      addItem(cartItem);
    });

    // Reset quantities
    setQuantities({});

    // Open unified checkout
    setShowCheckout(true);
  };

  // Seleccionar free pass (quantity = 1 fijo)
  const selectFreePass = (ticketId: string) => {
    setQuantities(prev => ({
      ...prev,
      [ticketId]: prev[ticketId] ? 0 : 1 // Toggle: si tiene 1, poner 0; si tiene 0, poner 1
    }));
  };
  return <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <div className="space-y-6">
        {/* Tickets Section */}
        {tickets.length > 0 && (mode === "tickets" || mode === "both") && <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Entradas</h3>
            <div className="grid gap-4">
              {tickets.map(ticket => <Card key={ticket.id} className="border border-border">
                  <CardHeader className="py-4 md:py-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <CardTitle className="text-base sm:text-lg font-semibold">
                          {ticket.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {ticket.description}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3 md:justify-end">
                        {ticket.price === 0 ? (
                          // Free pass: sin +/-, solo toggle
                          <>
                            <span className="text-base md:text-lg font-bold text-green-600">
                              FREE PASS
                            </span>
                            <Button 
                              variant={quantities[ticket.id] ? "default" : "outline"} 
                              size="sm" 
                              onClick={() => selectFreePass(ticket.id)}
                            >
                              {quantities[ticket.id] ? "Seleccionado ✓" : "Seleccionar"}
                            </Button>
                          </>
                        ) : (
                          // Ticket con precio: +/- normal
                          <>
                            <span className="text-base md:text-lg font-bold text-foreground">
                              {formatPYG(ticket.price)}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => updateQuantity(ticket.id, -1)} disabled={!quantities[ticket.id]}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="w-8 text-center font-medium">
                                {quantities[ticket.id] || 0}
                              </span>
                              <Button variant="outline" size="sm" onClick={() => updateQuantity(ticket.id, 1)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {ticket.benefits && <Collapsible open={openCollapsibles[ticket.id]} onOpenChange={open => toggleCollapsible(ticket.id, open)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-2 cursor-pointer">
                            <span className="text-sm text-muted-foreground">Ver beneficios</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${openCollapsibles[ticket.id] ? 'rotate-180' : ''}`} />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-3" id={`item-details-${ticket.id}`}>
                          {ticket.benefits.map((benefit, index) => <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ChevronRight className="h-3 w-3 text-foreground" />
                              <span>{benefit}</span>
                            </div>)}
                        </CollapsibleContent>
                      </Collapsible>}
                  </CardHeader>
                </Card>)}
            </div>
          </div>}

        {/* Tables Section */}
        {tables.length > 0 && (mode === "tables" || mode === "both") && <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">Mesas</h3>
            <div className="grid gap-4">
              {tables.map(table => <Card key={table.id} className="border border-border">
                  <CardHeader className="py-4 md:py-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base sm:text-lg font-semibold">
                          {table.name}
                        </CardTitle>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          {table.capacity}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-3 md:justify-end">
                        <Button size="lg" onClick={() => {
                    // Tracking fire-and-forget: no bloquear navegación
                    if (localId) {
                      void trackWhatsappClick(localId, whatsappNumber ? `+${whatsappNumber}` : undefined, "club_table_reservation");
                    }
                    const message = `Hola! Me gustaría reservar una ${table.name} para ${table.capacity} personas.`;
                    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
                    window.open(whatsappUrl, '_blank');
                  }} className="w-full md:w-auto mt-2">
                          Reservar
                        </Button>
                      </div>
                    </div>

                    {(table.benefits || table.drinks) && <Collapsible open={openCollapsibles[table.id]} onOpenChange={open => toggleCollapsible(table.id, open)}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-2 cursor-pointer">
                            <span className="text-sm text-muted-foreground">Ver detalles de la mesa</span>
                            <ChevronDown className={`h-4 w-4 transition-transform ${openCollapsibles[table.id] ? 'rotate-180' : ''}`} />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-2 pt-3" id={`item-details-${table.id}`}>
                          {table.benefits?.map((benefit, index) => <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ChevronRight className="h-3 w-3 text-foreground" />
                              <span>{benefit}</span>
                            </div>)}
                          {table.drinks?.map((drink, index) => <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <ChevronRight className="h-3 w-3 text-foreground" />
                              <span>{drink}</span>
                            </div>)}
                        </CollapsibleContent>
                      </Collapsible>}
                  </CardHeader>
                </Card>)}
            </div>
          </div>}
      </div>

      {hasItems && <div className="fixed bottom-4 left-4 right-4 bg-card border border-border rounded-lg p-4 shadow-lg z-40">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Total de tu compra</div>
              <div className="text-lg font-bold text-foreground">
                {formatPYG(getTotalAmount())}
              </div>
            </div>
            <Button onClick={handleCheckout}>
              Proceder al pago
            </Button>
          </div>
        </div>}

      {/* Unified Checkout Modal */}
      <CheckoutBase isOpen={showCheckout} onClose={() => setShowCheckout(false)} title="Finalizar Compra" />
    </section>;
};
export default PurchaseSelector;