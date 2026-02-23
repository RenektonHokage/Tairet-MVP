import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/shared/BackButton";
import ComingSoon from "@/components/shared/ComingSoon";

const Promociones = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-20 md:pb-10">
        <BackButton label="Volver a inicio" fallbackTo="/" />
        <ComingSoon
          title="Próximamente Promociones"
          subtitle="La sección de promociones todavía no está disponible."
          emphasis="Estamos trabajando para traerte las mejores ofertas y descuentos."
          primaryCtaLabel="Volver al inicio"
          primaryCtaTo="/"
        />
      </main>

      <Footer />
      <div className="h-20 md:hidden" aria-hidden="true" />
      <BottomNavbar />
    </div>
  );
};

export default Promociones;
