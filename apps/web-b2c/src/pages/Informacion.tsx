import { Instagram, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import tiktokIcon from "@/assets/tiktok.svg";

const Informacion = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Branding */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-4">Tairet</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tairet es la plataforma digital para descubrir bares y boliches, reservar mesas y comprar entradas en Paraguay.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <a 
                href="https://www.instagram.com/tairetpy/" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="Instagram de Tairet" 
                className="text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a 
                href="https://www.tiktok.com/@tairetpy" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="TikTok de Tairet" 
                className="text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <img 
                  src={tiktokIcon} 
                  alt="TikTok Tairet" 
                  className="w-5 h-5 opacity-60 hover:opacity-100 transition-opacity"
                />
              </a>
              <a 
                href="https://www.youtube.com/@tairetpy" 
                target="_blank" 
                rel="noopener noreferrer" 
                aria-label="YouTube de Tairet" 
                className="text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Grid de secciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {/* Sobre Tairet */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Sobre Tairet</h2>
              <ul className="space-y-3">
                <li>
                  <Link 
                    to="/sobre/que-es-tairet" 
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                  >
                    Qué es Tairet
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/sobre/como-funciona" 
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                  >
                    Cómo funciona
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/sobre/preguntas-frecuentes" 
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                  >
                    Preguntas frecuentes
                  </Link>
                </li>
              </ul>
            </div>

            {/* Para locales */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Para locales</h2>
              <ul className="space-y-3">
                <li>
                  <Link 
                    to="/para-locales/publica-tu-local" 
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                  >
                    Publicá tu local
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Legal</h2>
              <ul className="space-y-3">
                <li>
                  <Link 
                    to="/legal/terminos-condiciones" 
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                  >
                    Términos y condiciones
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/legal/politica-privacidad" 
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                  >
                    Política de privacidad
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/legal/cookies" 
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline transition-colors duration-200"
                  >
                    Cookies
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom info */}
          <div className="mt-12 pt-6 border-t border-border">
            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <div>
                © {currentYear} Tairet. Todos los derechos reservados.
              </div>
              <div className="flex items-center gap-2">
                <span>Hecho en Paraguay</span>
                <span>·</span>
                <span>MVP</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNavbar />
    </div>
  );
};

export default Informacion;
