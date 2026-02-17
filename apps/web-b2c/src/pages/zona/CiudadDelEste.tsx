import { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import BackButton from "@/components/shared/BackButton";
import ComingSoon from "@/components/shared/ComingSoon";

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

        <ComingSoon
          className="py-10 md:py-14"
          title="Próximamente en Ciudad del Este"
          subtitle="Esta zona todavía no está habilitada para exploración de locales."
          emphasis="Por ahora operamos únicamente en Asunción."
          primaryCtaLabel="Ver Asunción"
          primaryCtaTo="/zona/asuncion"
        />
      </main>
    </>
  );
}
