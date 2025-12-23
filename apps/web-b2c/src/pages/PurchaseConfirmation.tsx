import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Mail, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";

const PurchaseConfirmation = () => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 flex items-center justify-center px-4 py-12 mt-16">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-12 pb-8 px-6 text-center space-y-6">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl"></div>
                <div className="relative bg-primary/10 p-6 rounded-full">
                  <CheckCircle2 className="h-16 w-16 text-primary" />
                </div>
              </div>
            </div>

            {/* Success Message */}
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                ¡Compra Exitosa!
              </h1>
              <p className="text-muted-foreground">
                Tu reserva ha sido confirmada
              </p>
            </div>

            {/* Email Confirmation */}
            <div className="bg-accent/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Mail className="h-5 w-5" />
                <span className="font-medium">Confirmación Enviada</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Te enviamos el QR de ingreso a tu correo electrónico
              </p>
            </div>

            {/* Additional Info */}
            <div className="space-y-3 text-sm text-muted-foreground border-t pt-6">
              <p className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Revisa tu bandeja de entrada y spam
              </p>
              <p className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Presenta el QR en la entrada del local
              </p>
              <p className="flex items-start gap-2">
                <span className="text-primary">•</span>
                Guarda el QR en tu dispositivo móvil
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3 pt-4">
              <Button 
                onClick={() => navigate("/")}
                className="w-full"
                size="lg"
              >
                <Home className="h-4 w-4 mr-2" />
                Volver al Inicio
              </Button>
              
              <Button 
                onClick={() => navigate("/reservas")}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Ver Mis Reservas
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavbar />
    </div>
  );
};

export default PurchaseConfirmation;
