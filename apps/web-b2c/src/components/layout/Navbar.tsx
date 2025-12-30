import { useState } from "react";
import { Link } from "react-router-dom";
import { Search, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { isAuthenticated, login, logout } = useAuth();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Search functionality will be implemented when backend is ready
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
        {/* Left - Logo */}
        <div className="flex items-center">
          <Link 
            to="/" 
            className="text-xl lg:text-2xl font-bold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Ir a inicio"
          >
            Tairet
          </Link>
        </div>

        {/* Center - Search Bar (Desktop only) */}
        <div className="hidden lg:flex flex-1 justify-center items-center w-full">
          <form onSubmit={handleSearchSubmit} className="w-full max-w-[720px] mx-auto">
            <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" 
                aria-hidden="true"
              />
              <Input
                type="text"
                placeholder="Buscar por zona, local o música…"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4"
                aria-label="Buscar"
              />
            </div>
          </form>
        </div>

        {/* Mobile Search Bar */}
        <div className="lg:hidden flex-1 flex justify-center items-center w-full px-4">
          <form onSubmit={handleSearchSubmit} className="w-full">
            <div className="relative">
              <Search 
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" 
                aria-hidden="true"
              />
              <Input
                type="text"
                placeholder="Buscar…"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full pl-10 pr-4"
                aria-label="Buscar"
              />
            </div>
          </form>
        </div>

        {/* Right - Auth buttons (Desktop only) */}
        <div className="hidden lg:flex items-center space-x-3">
          <ThemeToggle />
          
          <Button 
            variant="default" 
            asChild
            className="font-medium"
          >
            <Link to="/mis-entradas">Mis entradas</Link>
          </Button>

          {isAuthenticated && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-8 w-8 rounded-full"
                  aria-label="Abrir menú de usuario"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>JP</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="flex items-center">
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

      </div>
    </header>
  );
};

export default Navbar;