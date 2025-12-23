import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchBar from "@/components/SearchBar";
import nightclubHero from "@/assets/hero-nightlife-main.jpg";
const TairetHeroNavbar = () => {
  return <section className="min-h-[70vh] sm:min-h-[75vh] md:min-h-[69vh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 bg-cover bg-center" style={{
      backgroundImage: `linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.6)), url(${nightclubHero})`
    }} />
      
      {/* Background pattern/texture */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6 max-w-7xl mx-auto lg:grid lg:grid-cols-3 lg:justify-normal">
        {/* Logo - Left */}
        <div className="flex items-center justify-start">
          <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
            Tairet
          </h1>
        </div>

        {/* Center Navigation - Hidden on mobile */}
        <div className="hidden lg:flex items-center justify-center space-x-2">
        </div>

        {/* Right Section */}
        <div className="flex items-center justify-end space-x-4">
          {/* Auth buttons */}
          <div className="hidden lg:flex items-center space-x-3">
            <Button variant="ghost" className="text-white/90 hover:text-white hover:bg-white/15 font-medium px-5 py-2.5 rounded-lg transition-all duration-200">
              Iniciar sesión
            </Button>
            <Button variant="outline" className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20 hover:border-white/50 font-medium px-5 py-2.5 rounded-lg transition-all duration-200 hover:scale-105">
              Mis reservas
            </Button>
          </div>
          
          {/* Mobile menu */}
          <Button variant="ghost" size="icon" className="lg:hidden text-white/90 hover:text-white hover:bg-white/15 rounded-lg transition-all duration-200 my-0 px-0 py-0 mx-0 text-center text-base">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center justify-center lg:px-12 sm:py-6 md:py-8 lg:py-16 max-w-4xl mx-auto text-center min-h-0 flex-1 px-[24px] py-[75px]">
        {/* Main Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold text-white mb-4 lg:mb-8 leading-tight">
          Explorá la noche
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            con Tairet
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg lg:text-xl text-white/80 mb-6 lg:mb-12 max-w-2xl leading-relaxed">Descubrí los mejores bares y discotecas en tu ciudad. Reservá tu mesa y viví experiencias únicas.</p>

        {/* Search Bar */}
        <SearchBar />

        {/* Popular searches or tags */}
        
      </div>

      {/* Mobile Navigation Menu - Could be expanded later */}
      <div className="lg:hidden absolute bottom-0 left-0 right-0 bg-slate-800/50 backdrop-blur-sm border-t border-white/10 p-4">
        <div className="flex items-center justify-center space-x-6">
        </div>
      </div>
    </section>;
};
export default TairetHeroNavbar;