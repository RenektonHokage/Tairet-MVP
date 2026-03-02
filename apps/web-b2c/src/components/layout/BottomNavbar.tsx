import { Link, useLocation } from "react-router-dom";
import { Home, Search, MapPin, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNavbar = () => {
  const location = useLocation();

  const navItems = [
    { name: "Inicio", path: "/", icon: Home },
    { name: "Zonas", path: "/explorar", icon: Search },
    { name: "Eventos", path: "/eventos", icon: MapPin },
    { name: "Información", path: "/informacion", icon: Info },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="grid grid-cols-4 items-center gap-1 px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => window.scrollTo({ top: 0, behavior: 'instant' })}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center rounded-lg px-2 py-2 transition-colors",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium truncate">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavbar;
