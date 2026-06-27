import { Link, useParams } from "react-router-dom";
import { AlertCircle, Home, TicketCheck } from "lucide-react";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Navbar from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hasValidTokenFormat(token: string | undefined): boolean {
  return Boolean(token?.trim() && UUID_PATTERN.test(token.trim()));
}

const AccessCheckinLanding = () => {
  const { token } = useParams<{ token: string }>();
  const isValidTokenFormat = hasValidTokenFormat(token);
  const Icon = isValidTokenFormat ? TicketCheck : AlertCircle;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 mt-16">
        <Card className="w-full max-w-lg">
          <CardContent className="px-6 pb-8 pt-10 text-center space-y-6">
            <div className="flex justify-center">
              <div
                className={
                  isValidTokenFormat
                    ? "rounded-full bg-primary/10 p-5"
                    : "rounded-full bg-destructive/10 p-5"
                }
              >
                <Icon
                  className={
                    isValidTokenFormat
                      ? "h-12 w-12 text-primary"
                      : "h-12 w-12 text-destructive"
                  }
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                {isValidTokenFormat ? "Entrada para validar" : "Enlace no válido"}
              </h1>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                {isValidTokenFormat
                  ? "Mostrá al personal del local el QR que recibiste por correo."
                  : "Este enlace no parece válido."}
              </p>
            </div>

            {isValidTokenFormat ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                <p>La validación se realiza desde Tairet por el personal del local.</p>
                <p className="mt-2 font-medium text-foreground">
                  Si abriste este enlace desde tu cámara, volvé al correo y mostrales el QR
                  recibido.
                </p>
              </div>
            ) : null}

            <Button asChild className="w-full" size="lg">
              <Link to="/">
                <Home className="h-4 w-4" />
                Volver al inicio
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      <BottomNavbar />
    </div>
  );
};

export default AccessCheckinLanding;
