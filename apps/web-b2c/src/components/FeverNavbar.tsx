import { ChevronDown, MapPin, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "./ThemeToggle";
const FeverNavbar = () => {
  return <header className="w-full bg-background border-b border-border px-4 py-3">
      <nav className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left Section - Logo */}
        <div className="flex items-center">
          <h1 className="text-2xl font-bold text-fever-primary">fever</h1>
        </div>

        {/* Center Section - Search Bar (hidden on smaller screens) */}
        <div className="hidden lg:flex flex-1 max-w-2xl mx-8">
          
        </div>

        {/* Right Section - City Selector, Language, User */}
        <div className="flex items-center space-x-4">
          {/* City Selector */}
          

          {/* Language Selector */}
          <Button variant="ghost" className="flex items-center space-x-1 text-fever-secondary hover:text-fever-primary">
            <span className="text-sm font-medium">EN</span>
            <ChevronDown className="h-4 w-4" />
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Icon */}
          <Button variant="ghost" size="icon" className="text-fever-secondary hover:text-fever-primary">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      {/* Mobile Search Bar */}
      <div className="lg:hidden mt-3">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-fever-secondary h-5 w-5" />
          <input type="text" placeholder="Find your city" className="w-full pl-10 pr-4 py-3 border border-border bg-background text-foreground rounded-full focus:outline-none focus:ring-2 focus:ring-fever-primary focus:border-transparent text-sm" />
        </div>
      </div>
    </header>;
};
export default FeverNavbar;