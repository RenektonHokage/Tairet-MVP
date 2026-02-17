import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ZonaAsuncion = lazy(() => import("./pages/zona/Asuncion"));
const ZonaSanBernardino = lazy(() => import("./pages/zona/SanBernardino"));
const ZonaCiudadDelEste = lazy(() => import("./pages/zona/CiudadDelEste"));
const SimpleInfoPage = lazy(() => import("./pages/SimpleInfoPage"));
const PublicaTuLocal = lazy(() => import("./pages/para-locales/PublicaTuLocal"));
const WizardSolicitud = lazy(() => import("./pages/para-locales/WizardSolicitud"));
const QueEsTairet = lazy(() => import("./pages/info/QueEsTairet"));
const ComoFunciona = lazy(() => import("./pages/info/ComoFunciona"));
const FAQ = lazy(() => import("./pages/info/FAQ"));
const TerminosCondiciones = lazy(() => import("./pages/info/TerminosCondiciones"));
const PoliticaPrivacidad = lazy(() => import("./pages/info/PoliticaPrivacidad"));
const Cookies = lazy(() => import("./pages/info/Cookies"));
const ClubProfile = lazy(() => import("./pages/ClubProfile"));
const BarProfile = lazy(() => import("./pages/BarProfile"));
const AllClubs = lazy(() => import("./pages/AllClubs"));
const AllBars = lazy(() => import("./pages/AllBars"));
const EventProfile = lazy(() => import("./pages/EventProfile"));
const AllReviews = lazy(() => import("./pages/AllReviews"));
const Login = lazy(() => import("./pages/auth/Login"));
const Informacion = lazy(() => import("./pages/Informacion"));
const Explorar = lazy(() => import("./pages/Explorar"));
const Eventos = lazy(() => import("./pages/Eventos"));
const Zonas = lazy(() => import("./pages/Zonas"));
const Rooftop = lazy(() => import("./pages/experiencias/Rooftop"));
const AfterOffice = lazy(() => import("./pages/experiencias/AfterOffice"));
const Promociones = lazy(() => import("./pages/experiencias/Promociones"));
const PurchaseConfirmation = lazy(() => import("./pages/PurchaseConfirmation"));
const ReservaForm = lazy(() => import("./pages/ReservaForm"));
const MisEntradas = lazy(() => import("./pages/MisEntradas"));

const RouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
    Cargando...
  </div>
);

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
          <Suspense fallback={<RouteFallback />}>
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
            <Route path="/mis-entradas" element={<MisEntradas />} />
            
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
          </Suspense>
        </HashRouter>
          </TooltipProvider>
        </AuthProvider>
      </CartProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
