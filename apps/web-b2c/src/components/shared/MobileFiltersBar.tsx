import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SortOption {
  label: string;
  value: string;
}

interface MobileFiltersBarProps {
  title: string;
  sortBy: string;
  sortOptions: SortOption[];
  onSortChange: (value: string) => void;
  selectedZones: string[];
  onOpenZones: () => void;
  openToday: boolean;
  onToggleOpenToday: () => void;
  hasPromos: boolean;
  onTogglePromos: () => void;
  onOpenAdvancedFilters: () => void;
  advancedFiltersCount?: number;
}

export function MobileFiltersBar({
  title,
  sortBy,
  sortOptions,
  onSortChange,
  selectedZones,
  onOpenZones,
  openToday,
  onToggleOpenToday,
  hasPromos,
  onTogglePromos,
  onOpenAdvancedFilters,
  advancedFiltersCount = 0,
}: MobileFiltersBarProps) {
  const currentSortLabel = sortOptions.find(o => o.value === sortBy)?.label || "Relevancia";
  
  const zonesLabel = selectedZones.length === 0 
    ? "Zonas" 
    : selectedZones.length === 1 
      ? selectedZones[0] 
      : `Zonas: ${selectedZones.length}`;

  return (
    <div className="lg:hidden bg-background border-b border-border -mx-4 px-4">
      {/* Header row: Title + Sort */}
      <div className="flex items-center justify-between py-3">
        <h1 className="text-xl font-bold text-foreground">{title}</h1>
        
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <span>{currentSortLabel}</span>
            <ChevronDown className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border border-border z-50">
            {sortOptions.map(option => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onSortChange(option.value)}
                className={sortBy === option.value ? "bg-accent" : ""}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Chips row */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3">
        {/* Zonas chip */}
        <Badge
          variant={selectedZones.length > 0 ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-xs whitespace-nowrap shrink-0 flex items-center gap-1"
          onClick={onOpenZones}
        >
          {zonesLabel}
          <ChevronDown className="w-3 h-3" />
        </Badge>

        {/* Abierto hoy toggle */}
        <Badge
          variant={openToday ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
          onClick={onToggleOpenToday}
        >
          Abierto hoy
        </Badge>

        {/* Promociones toggle */}
        <Badge
          variant={hasPromos ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-xs whitespace-nowrap shrink-0"
          onClick={onTogglePromos}
        >
          Promociones
        </Badge>

        {/* Más filtros chip */}
        <Badge
          variant={advancedFiltersCount > 0 ? "default" : "outline"}
          className="cursor-pointer px-3 py-1.5 text-xs whitespace-nowrap shrink-0 flex items-center gap-1"
          onClick={onOpenAdvancedFilters}
        >
          <SlidersHorizontal className="w-3 h-3" />
          {advancedFiltersCount > 0 ? `Filtros (${advancedFiltersCount})` : "Más filtros"}
        </Badge>
      </div>
    </div>
  );
}
