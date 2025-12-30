import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Ticket, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Navbar from "@/components/layout/Navbar";
import { getOrdersByEmail, Order } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const MisEntradas = () => {
  const [email, setEmail] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSearch = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast.error("Por favor ingresa un email");
      return;
    }

    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      toast.error("Por favor ingresa un email válido");
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const data = await getOrdersByEmail(trimmedEmail);
      setOrders(data);
      if (data.length === 0) {
        toast.info("No se encontraron entradas para este email");
      }
    } catch (error) {
      toast.error("Error al buscar entradas");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Token copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Pagado";
      case "pending":
        return "Pendiente";
      case "failed":
        return "Fallido";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "text-green-600";
      case "pending":
        return "text-yellow-600";
      case "failed":
      case "cancelled":
        return "text-red-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Navbar */}
      <div className="hidden md:block">
        <Navbar />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b md:hidden">
        <div className="container flex h-14 items-center">
          <Link to="/" className="mr-4">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-xl font-bold">Mis Entradas</h1>
        </div>
      </div>

      <div className="container py-6 space-y-6 pb-24 md:pb-6">
        {/* Title for desktop */}
        <h1 className="hidden md:block text-2xl font-bold">Mis Entradas</h1>

        {/* Search Section */}
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ingresa tu email para ver tus entradas compradas
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? "Buscando..." : "Buscar"}
            </Button>
          </div>
        </div>

        {/* Orders List */}
        {searched && orders.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              {orders.length} entrada{orders.length > 1 ? "s" : ""} encontrada
              {orders.length > 1 ? "s" : ""}
            </h2>
            {orders.map((order) => (
              <div
                key={order.id}
                className="border rounded-lg p-4 space-y-2 cursor-pointer hover:bg-muted/50 transition"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">
                        {order.quantity} entrada{order.quantity > 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {order.total_amount > 0
                        ? `${order.total_amount.toLocaleString("es-PY")} ${order.currency}`
                        : "Gratis"}
                    </p>
                    <p className={`text-xs ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </p>
                  </div>
                </div>
                {order.payment_method === "free_pass" && (
                  <p className="text-xs text-muted-foreground">🎟️ Free pass</p>
                )}
                {order.used_at ? (
                  <p className="text-xs text-muted-foreground">
                    ✓ Usada el {formatDate(order.used_at)}
                  </p>
                ) : (
                  order.status === "paid" && (
                    <p className="text-xs text-green-600">
                      📱 Toca para ver el QR
                    </p>
                  )
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state after search */}
        {searched && orders.length === 0 && !loading && (
          <div className="text-center py-12">
            <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No se encontraron entradas para este email
            </p>
          </div>
        )}
      </div>

      {/* QR Modal */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Tu entrada
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG
                  value={selectedOrder.checkin_token}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>

              {/* Order info */}
              <div className="text-center space-y-1">
                <p className="font-medium">
                  {selectedOrder.quantity} entrada
                  {selectedOrder.quantity > 1 ? "s" : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(selectedOrder.created_at)}
                </p>
                <p className={`text-sm ${getStatusColor(selectedOrder.status)}`}>
                  {getStatusLabel(selectedOrder.status)}
                </p>
              </div>

              {/* Token with copy */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Código:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-muted rounded text-xs break-all font-mono">
                    {selectedOrder.checkin_token}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToken(selectedOrder.checkin_token)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Warnings */}
              {selectedOrder.status !== "paid" && (
                <p className="text-sm text-yellow-600 text-center">
                  ⚠️ Esta entrada aún no está pagada
                </p>
              )}
              {selectedOrder.used_at && (
                <p className="text-sm text-muted-foreground text-center">
                  ✓ Esta entrada ya fue usada el{" "}
                  {formatDate(selectedOrder.used_at)}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Mobile Bottom Navbar */}
      <BottomNavbar />
    </div>
  );
};

export default MisEntradas;

