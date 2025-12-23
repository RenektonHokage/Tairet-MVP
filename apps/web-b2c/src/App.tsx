import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import ScrollToTop from "./components/ScrollToTop";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ZonaAsuncion from "./pages/zona/Asuncion";
import ZonaSanBernardino from "./pages/zona/SanBernardino";
import ZonaCiudadDelEste from "./pages/zona/CiudadDelEste";
import SimpleInfoPage from "./pages/SimpleInfoPage";
import PublicaTuLocal from "@/pages/para-locales/PublicaTuLocal";
import WizardSolicitud from "@/pages/para-locales/WizardSolicitud";
import QueEsTairet from "@/pages/info/QueEsTairet";
import ComoFunciona from "@/pages/info/ComoFunciona";
import FAQ from "@/pages/info/FAQ";
import TerminosCondiciones from "@/pages/info/TerminosCondiciones";
import PoliticaPrivacidad from "@/pages/info/PoliticaPrivacidad";
import Cookies from "@/pages/info/Cookies";
import ClubProfile from "@/pages/ClubProfile";
import BarProfile from "@/pages/BarProfile";
import AllClubs from "@/pages/AllClubs";
import AllBars from "@/pages/AllBars";
import EventProfile from "@/pages/EventProfile";
import AllReviews from "@/pages/AllReviews";
import Login from "@/pages/auth/Login";
import Informacion from "@/pages/Informacion";
import Explorar from "@/pages/Explorar";
import Eventos from "@/pages/Eventos";
import Zonas from "@/pages/Zonas";
import Rooftop from "@/pages/experiencias/Rooftop";
import AfterOffice from "@/pages/experiencias/AfterOffice";
import Promociones from "@/pages/experiencias/Promociones";
import PurchaseConfirmation from "@/pages/PurchaseConfirmation";
import ReservaForm from "@/pages/ReservaForm";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="tairet-theme">
      <CartProvider>
        <AuthProvider>
          <TooltipProvider>
          <Toaster />
          <Sonner />
          <HashRouter>
          <ScrollToTop />
          <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/zona/asuncion" element={<ZonaAsuncion />} />
          <Route path="/zona/san-bernardino" element={<ZonaSanBernardino />} />
          <Route path="/zona/ciudad-del-este" element={<ZonaCiudadDelEste />} />
          <Route path="/evento/:eventId" element={<EventProfile />} />
          <Route path="/club/:clubId" element={<ClubProfile />} />
          <Route path="/bar/:barId" element={<BarProfile />} />
          
          {/* Navigation pages */}
          <Route path="/explorar" element={<Explorar />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/zonas" element={<Zonas />} />
          
          {/* Experience pages */}
          <Route path="/experiencias/rooftop" element={<Rooftop />} />
          <Route path="/experiencias/after-office" element={<AfterOffice />} />
          <Route path="/experiencias/promociones" element={<Promociones />} />
          
          {/* "Ver todo" pages */}
          <Route path="/discotecas" element={<AllClubs />} />
          <Route path="/bares" element={<AllBars />} />
          <Route path="/reseñas" element={<AllReviews />} />
          
          {/* Auth & User pages */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/informacion" element={<Informacion />} />
          <Route path="/confirmacion-compra" element={<PurchaseConfirmation />} />
          <Route path="/reservar/:barId" element={<ReservaForm />} />
          
          {/* Informational routes */}
          <Route path="/sobre/que-es-tairet" element={<QueEsTairet />} />
          <Route path="/sobre/como-funciona" element={<ComoFunciona />} />
          <Route path="/sobre/preguntas-frecuentes" element={<FAQ />} />
          <Route path="/legal/terminos-condiciones" element={<TerminosCondiciones />} />
          <Route path="/legal/politica-privacidad" element={<PoliticaPrivacidad />} />
          <Route path="/legal/cookies" element={<Cookies />} />
          <Route path="/sobre/:slug" element={<SimpleInfoPage />} />
          <Route path="/locales/:slug" element={<SimpleInfoPage />} />
          <Route path="/legal/:slug" element={<SimpleInfoPage />} />

          {/* Para locales (Mesas) */}
          <Route path="/para-locales/publica-tu-local" element={<PublicaTuLocal />} />
          <Route path="/para-locales/solicitud" element={<WizardSolicitud />} />


          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </HashRouter>
          </TooltipProvider>
        </AuthProvider>
      </CartProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
