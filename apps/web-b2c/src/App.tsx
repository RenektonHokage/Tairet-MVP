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
import AnalyticsRouteCoordinator from "./components/prelaunch/AnalyticsRouteCoordinator";

const queryClient = new QueryClient();
const PrelaunchLayout = lazy(() => import("./components/prelaunch/PrelaunchLayout"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SimpleInfoPage = lazy(() => import("./pages/SimpleInfoPage"));
const Login = lazy(() => import("./pages/auth/Login"));
const Eventos = lazy(() => import("./pages/Eventos"));
const AccessPaymentStatus = lazy(() => import("./pages/AccessPaymentStatus"));
const AccessCheckinLanding = lazy(() => import("./pages/AccessCheckinLanding"));
const PurchaseConfirmation = lazy(() => import("./pages/PurchaseConfirmation"));
const ReservaForm = lazy(() => import("./pages/ReservaForm"));

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
          <AnalyticsRouteCoordinator />
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
            <Route path="/inicio" element={<PrelaunchLayout />} />
            <Route path="/asuncion" element={<PrelaunchLayout />} />
            <Route path="/halloween" element={<PrelaunchLayout />} />
            <Route path="/mapa" element={<PrelaunchLayout />} />
            <Route path="/contacto" element={<PrelaunchLayout />} />
            <Route path="/para-locales/bares" element={<PrelaunchLayout />} />
            <Route path="/para-locales/discotecas" element={<PrelaunchLayout />} />
            <Route path="/para-locales/organizadores" element={<PrelaunchLayout />} />
            <Route path="/" element={<Index />} />
            <Route path="/zona/asuncion" element={<PrelaunchLayout />} />
            <Route path="/zona/san-bernardino" element={<PrelaunchLayout />} />
            <Route path="/zona/ciudad-del-este" element={<PrelaunchLayout />} />
            <Route path="/evento/:eventId" element={<PrelaunchLayout />} />
            <Route path="/club/:clubId" element={<PrelaunchLayout />} />
            <Route path="/bar/:barId" element={<PrelaunchLayout />} />
            
            {/* Navigation pages */}
            <Route path="/explorar" element={<PrelaunchLayout />} />
            <Route path="/eventos" element={<Eventos />} />
            <Route path="/zonas" element={<PrelaunchLayout />} />
            
            {/* Experience pages */}
            <Route path="/experiencias/rooftop" element={<PrelaunchLayout />} />
            <Route path="/experiencias/after-office" element={<PrelaunchLayout />} />
            <Route path="/experiencias/promociones" element={<PrelaunchLayout />} />
            
            {/* "Ver todo" pages */}
            <Route path="/discotecas" element={<PrelaunchLayout />} />
            <Route path="/bares" element={<PrelaunchLayout />} />
            <Route path="/reseñas" element={<PrelaunchLayout />} />
            
            {/* Auth & User pages */}
            <Route path="/auth/login" element={<Login />} />
            <Route path="/informacion" element={<PrelaunchLayout />} />
            <Route path="/payments/access/status" element={<AccessPaymentStatus />} />
            <Route path="/access/checkin/:token" element={<AccessCheckinLanding />} />
            <Route path="/confirmacion-compra" element={<PurchaseConfirmation />} />
            <Route path="/reservar/:barId" element={<ReservaForm />} />
            
            {/* Informational routes */}
            <Route path="/sobre/que-es-tairet" element={<PrelaunchLayout />} />
            <Route path="/sobre/como-funciona" element={<PrelaunchLayout />} />
            <Route path="/sobre/preguntas-frecuentes" element={<PrelaunchLayout />} />
            <Route path="/legal/terminos-condiciones" element={<PrelaunchLayout />} />
            <Route path="/legal/politica-privacidad" element={<PrelaunchLayout />} />
            <Route path="/legal/cookies" element={<PrelaunchLayout />} />
            <Route path="/sobre/:slug" element={<SimpleInfoPage />} />
            <Route path="/locales/:slug" element={<SimpleInfoPage />} />
            <Route path="/legal/:slug" element={<SimpleInfoPage />} />

            {/* Para locales (Mesas) */}
            <Route path="/para-locales/publica-tu-local" element={<PrelaunchLayout />} />
            <Route path="/para-locales/solicitud" element={<PrelaunchLayout />} />


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
