import { Instagram, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import tiktokIcon from "@/assets/tiktok.svg";
const Footer = () => {
  const currentYear = new Date().getFullYear();
  return <footer className="bg-zinc-950 text-zinc-200 hidden md:block">
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          
          {/* Columna 1 - Branding */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Tairet</h2>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Tairet es la plataforma digital para descubrir bares y boliches, reservar mesas y comprar entradas en Paraguay.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="https://www.instagram.com/tairetpy/" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Tairet" className="text-zinc-400 hover:text-white transition-colors duration-200">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.tiktok.com/@tairetpy" target="_blank" rel="noopener noreferrer" aria-label="TikTok de Tairet" className="text-zinc-400 hover:text-white transition-colors duration-200">
                <img src={tiktokIcon} alt="TikTok Tairet" className="w-5 h-5" style={{
                filter: 'brightness(0) saturate(100%) invert(60%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(90%) contrast(90%)'
              }} />
              </a>
              <a href="https://www.youtube.com/@tairetpy" target="_blank" rel="noopener noreferrer" aria-label="YouTube de Tairet" className="text-zinc-400 hover:text-white transition-colors duration-200">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Columna 2 - Sobre Tairet */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">Sobre Tairet</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/sobre/que-es-tairet" className="text-sm text-zinc-300 hover:text-white hover:underline transition-colors duration-200">
                  Qué es Tairet
                </Link>
              </li>
              <li>
                <Link to="/sobre/como-funciona" className="text-sm text-zinc-300 hover:text-white hover:underline transition-colors duration-200">
                  Cómo funciona
                </Link>
              </li>
              <li>
                <Link to="/sobre/preguntas-frecuentes" className="text-sm text-zinc-300 hover:text-white hover:underline transition-colors duration-200">
                  Preguntas frecuentes
                </Link>
              </li>
            </ul>
          </div>

          {/* Columna 3 - Para locales */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">Para locales</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/para-locales/publica-tu-local" className="text-sm text-zinc-300 hover:text-white hover:underline transition-colors duration-200">
                  Publicá tu local
                </Link>
              </li>
              <li>
                
              </li>
              <li>
                
              </li>
            </ul>
          </div>

          {/* Columna 4 - Legal */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/legal/terminos-condiciones" className="text-sm text-zinc-300 hover:text-white hover:underline transition-colors duration-200">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link to="/legal/politica-privacidad" className="text-sm text-zinc-300 hover:text-white hover:underline transition-colors duration-200">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link to="/legal/cookies" className="text-sm text-zinc-300 hover:text-white hover:underline transition-colors duration-200">
                  Cookies
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-zinc-800 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-zinc-400">
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
    </footer>;
};
export default Footer;