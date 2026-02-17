import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Footer from "@/components/Footer";
import BackButton from "@/components/shared/BackButton";
import ComingSoon from "@/components/shared/ComingSoon";

const AfterOffice = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-20 md:pb-10">
        <BackButton label="Volver a inicio" fallbackTo="/" />
        <ComingSoon
          title="Próximamente After Office"
          subtitle="La sección de after office todavía no está disponible."
          emphasis="Estamos trabajando para traerte los mejores lugares para relajarte después del trabajo."
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

export default AfterOffice;
