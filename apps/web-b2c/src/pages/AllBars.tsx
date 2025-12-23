import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import BackButton from "@/components/shared/BackButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import Footer from "@/components/Footer";
import { MobileFiltersBar } from "@/components/shared/MobileFiltersBar";
import { FilterBottomSheet } from "@/components/shared/FilterBottomSheet";
import VenueCard from "@/components/shared/VenueCard";
import { allBars } from "@/lib/data/venues";
import type { Bar } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { MVP_BAR_SLUGS } from "@/lib/mvpSlugs";

// Bar specialties for filtering
const barSpecialties = [
  "Cervezas artesanales",
  "Cocteles", 
  "Vinos",
  "Terraza",
  "After Office",
  "Música en vivo",
  "Después de las 12 am",
  "Temáticas"
];

// Zones for filtering
const zones = [
  "Carmelitas",
  "Centro", 
  "Villa Morra",
  "Las Mercedes",
  "Recoleta",
  "Costanera",
  "Mburucuyá"
];

// Sort options
const sortOptions = [
  { label: "Relevancia", value: "relevance" },
  { label: "Mejor puntuados", value: "rating" },
  { label: "Más visitados", value: "popular" }
];


// Filters interface
interface Filters {
  search: string;
  specialties: string[];
  openToday: boolean;
  activePromos: boolean;
  zones: string[];
  sortBy: string;
}

// Filter and sort bars
function filterAndSortBars(bars: Bar[], filters: Filters) {
  let filtered = [...bars];

  // Search filter
  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    filtered = filtered.filter(bar => 
      bar.name.toLowerCase().includes(searchTerm) ||
      (bar.location && bar.location.toLowerCase().includes(searchTerm))
    );
  }

  // Specialty filter
  if (filters.specialties.length > 0) {
    filtered = filtered.filter(bar => {
      return filters.specialties.some(selectedSpecialty => 
        bar.specialties.includes(selectedSpecialty)
      );
    });
  }

  // Sort bars
  switch (filters.sortBy) {
    case "rating":
      filtered.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
      break;
    case "popular":
      // For demo, shuffle array to simulate popularity
      filtered = filtered.sort(() => Math.random() - 0.5);
      break;
    default:
      // Keep original order for relevance
      break;
  }

  return filtered;
}

export default function AllBars() {
  const [filters, setFilters] = useState<Filters>({
    search: "",
    specialties: [],
    openToday: false,
    activePromos: false,
    zones: [],
    sortBy: "relevance"
  });

  const [showMoreBars, setShowMoreBars] = useState(8);
  const [isZonesSheetOpen, setIsZonesSheetOpen] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  useEffect(() => {
    document.title = "Todos los Bares | Tairet";
  }, []);

  // Filtrar solo bares MVP (que tienen perfil real)
  const mvpBars = allBars.filter((bar) => {
    const slug = slugify(bar.name);
    return MVP_BAR_SLUGS.includes(slug as any);
  });

  const filteredBars = filterAndSortBars(mvpBars, filters);
  const displayedBars = filteredBars.slice(0, showMoreBars);
  const hasMoreBars = filteredBars.length > showMoreBars;

  const activeFiltersCount = [
    filters.specialties.length > 0,
    filters.openToday,
    filters.activePromos
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilters({
      search: "",
      specialties: [],
      openToday: false,
      activePromos: false,
      zones: [],
      sortBy: "relevance"
    });
  };

  const toggleSpecialty = (specialty: string) => {
    setFilters(prev => ({
      ...prev,
      specialties: prev.specialties.includes(specialty)
        ? prev.specialties.filter(s => s !== specialty)
        : [...prev.specialties, specialty]
    }));
  };

  const toggleZone = (zone: string) => {
    setFilters(prev => ({
      ...prev,
      zones: prev.zones.includes(zone)
        ? prev.zones.filter(z => z !== zone)
        : [...prev.zones, zone]
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-8 md:pb-10">
        <BackButton label="Volver" fallbackTo="/" />

        {/* Filter Bar - Desktop */}
        <div className="hidden lg:block mb-8">
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border">
            <div className="space-y-3">
              {/* Row 1: Specialty Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground mr-1">Especialidad:</span>
                {barSpecialties.map(specialty => (
                  <Badge
                    key={specialty}
                    variant={filters.specialties.includes(specialty) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1 text-sm"
                    onClick={() => toggleSpecialty(specialty)}
                  >
                    {specialty}
                  </Badge>
                ))}
              </div>

              {/* Row 2: Dropdowns and Checkboxes */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Sort Selector */}
                <Select value={filters.sortBy} onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Zones Dropdown */}
                <Select 
                  value={filters.zones.length === 1 ? filters.zones[0] : filters.zones.length > 1 ? "multiple" : "all"}
                  onValueChange={(value) => {
                    if (value === "all") {
                      setFilters(prev => ({ ...prev, zones: [] }));
                    } else if (value !== "multiple") {
                      setFilters(prev => ({ ...prev, zones: [value] }));
                    }
                  }}
                >
                  <SelectTrigger className="w-44 h-9">
                    <SelectValue placeholder="Zonas">
                      {filters.zones.length === 0 ? "Zonas" : 
                       filters.zones.length === 1 ? filters.zones[0] : 
                       `${filters.zones.length} zonas`}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las zonas</SelectItem>
                    {zones.map(zone => (
                      <SelectItem key={zone} value={zone}>{zone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Checkboxes */}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="openToday"
                    checked={filters.openToday}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, openToday: !!checked }))}
                  />
                  <label htmlFor="openToday" className="text-sm text-foreground cursor-pointer">Abierto hoy</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="activePromos"
                    checked={filters.activePromos}
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, activePromos: !!checked }))}
                  />
                  <label htmlFor="activePromos" className="text-sm text-foreground cursor-pointer">Promociones</label>
                </div>

                {/* Clear Filters */}
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearAllFilters} className="flex items-center gap-1 h-9 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                    Limpiar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar - Mobile */}
        <MobileFiltersBar
          title="Bares"
          sortBy={filters.sortBy}
          sortOptions={sortOptions}
          onSortChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
          selectedZones={filters.zones}
          onOpenZones={() => setIsZonesSheetOpen(true)}
          openToday={filters.openToday}
          onToggleOpenToday={() => setFilters(prev => ({ ...prev, openToday: !prev.openToday }))}
          hasPromos={filters.activePromos}
          onTogglePromos={() => setFilters(prev => ({ ...prev, activePromos: !prev.activePromos }))}
          onOpenAdvancedFilters={() => setIsAdvancedFiltersOpen(true)}
          advancedFiltersCount={filters.specialties.length}
        />

        {/* Zones Bottom Sheet */}
        <FilterBottomSheet
          open={isZonesSheetOpen}
          onOpenChange={setIsZonesSheetOpen}
          title="Elegí tu zona"
          options={zones}
          selectedOptions={filters.zones}
          onToggleOption={toggleZone}
          onClear={() => setFilters(prev => ({ ...prev, zones: [] }))}
          onApply={() => {}}
        />

        {/* Advanced Filters Bottom Sheet */}
        <FilterBottomSheet
          open={isAdvancedFiltersOpen}
          onOpenChange={setIsAdvancedFiltersOpen}
          title="Filtros avanzados"
          options={barSpecialties}
          selectedOptions={filters.specialties}
          onToggleOption={toggleSpecialty}
          onClear={() => setFilters(prev => ({ ...prev, specialties: [] }))}
          onApply={() => {}}
        />

        {/* Bars Grid */}
        {filteredBars.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">No encontramos bares con esos filtros</p>
            <Button variant="outline" onClick={clearAllFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {displayedBars.map(bar => (
                <VenueCard 
                  key={bar.id}
                  id={bar.id}
                  name={bar.name}
                  schedule={bar.schedule}
                  rating={bar.rating}
                  specialties={bar.specialties}
                  image={bar.image}
                  href={`/bar/${slugify(bar.name)}`}
                  type="bar"
                />
              ))}
            </div>

            {/* Load More */}
            {hasMoreBars && (
              <div className="text-center">
                <Button 
                  variant="outline" 
                  onClick={() => setShowMoreBars(prev => prev + 8)}
                  className="px-8"
                >
                  Cargar más bares
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}