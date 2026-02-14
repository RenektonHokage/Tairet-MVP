import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/Navbar";
import BackButton from "@/components/shared/BackButton";

export default function ZonaCiudadDelEste() {
  useEffect(() => {
    document.title = "Descubrí Ciudad del Este | Zonas - Tairet";
  }, []);

  return (
    <>
      {/* Navbar */}
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-20 md:pb-10">
        <BackButton label="Volver a inicio" fallbackTo="/" />

        <section className="py-10 md:py-14">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <h1 className="text-2xl font-semibold text-foreground">Próximamente en Ciudad del Este</h1>
            <p className="mt-3 text-muted-foreground">
              Esta zona todavía no está habilitada para exploración de locales.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Por ahora operamos únicamente en Asunción.</p>
            <div className="mt-6">
              <Link to="/zona/asuncion" className="inline-block">
                <Button variant="secondary" size="sm">
                  Ver Asunción
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
