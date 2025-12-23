import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const PLACEHOLDERS = ["Buscá tu boliche favorito", "Buscá tu bar favorito"];

const SearchBar: React.FC = () => {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 10000);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div className="w-full max-w-2xl relative mb-16 lg:mb-0">
      <div className="relative flex items-center">
        <div className="absolute left-4 z-10">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <Input
          type="text"
          placeholder={PLACEHOLDERS[index]}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          aria-label="Buscar"
          className="w-full pl-12 pr-20 sm:pr-24 py-3 sm:py-4 lg:py-6 text-sm sm:text-base lg:text-lg bg-white/95 backdrop-blur-sm border-0 rounded-2xl shadow-2xl focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all duration-300 placeholder:text-slate-500"
        />
      </div>
    </div>
  );
};

export default SearchBar;
