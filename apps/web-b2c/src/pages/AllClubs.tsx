import { useEffect, useMemo, useState } from "react";
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
import { slugify } from "@/lib/slug";
import { getLocalsList } from "@/lib/locals";
import { selectClubVenues } from "@/lib/venueSelectors";
import { useSearchParams } from "react-router-dom";
import {
  applySearchFilters,
  getZoneFromLocation,
  parseSearchParams,
  patchSearchParams,
  type SearchState,
} from "@/lib/search";

// Music genres for filtering
const musicGenres = [
  "Reggaeton",
  "Electronica", 
  "Pop",
  "Latino",
  "Mix"
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
  { label: "Más económicos", value: "price-asc" }
];


export default function AllClubs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchState = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const filters = useMemo(
    () => ({
      search: searchState.q,
      musicGenres: searchState.tags,
      openToday: searchState.openToday,
      activePromos: searchState.promos,
      zones: searchState.zones,
      sortBy: sortOptions.some((option) => option.value === searchState.sort)
        ? searchState.sort
        : "relevance",
    }),
    [searchState],
  );

  const [isZonesSheetOpen, setIsZonesSheetOpen] = useState(false);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
  
  // DB data for enriching mocks (covers, location, city, attributes, minAge)
  const [dbCovers, setDbCovers] = useState<Map<string, string>>(new Map());
  const [dbLocations, setDbLocations] = useState<Map<string, string>>(new Map());
  const [dbCities, setDbCities] = useState<Map<string, string>>(new Map());
  const [dbGenres, setDbGenres] = useState<Map<string, string[]>>(new Map());
  const [dbMinAges, setDbMinAges] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    document.title = "Todas las Discotecas | Tairet";
    
    // Cargar data desde DB para enriquecer cards
    getLocalsList("club", 100)
      .then((locals) => {
        const coverMap = new Map<string, string>();
        const locationMap = new Map<string, string>();
        const cityMap = new Map<string, string>();
        const genresMap = new Map<string, string[]>();
        const minAgeMap = new Map<string, number>();
        
        locals.forEach((local) => {
          if (local.cover_url) {
            coverMap.set(local.slug, local.cover_url);
          }
          if (local.location) {
            locationMap.set(local.slug, local.location);
          }
          if (local.city) {
            cityMap.set(local.slug, local.city);
          }
          if (local.attributes && local.attributes.length > 0) {
            genresMap.set(local.slug, local.attributes);
          }
          if (local.min_age !== null && local.min_age !== undefined) {
            minAgeMap.set(local.slug, local.min_age);
          }
        });
        
        setDbCovers(coverMap);
        setDbLocations(locationMap);
        setDbCities(cityMap);
        setDbGenres(genresMap);
        setDbMinAges(minAgeMap);
      })
      .catch(() => {
        // Silently fail - mocks will be used
      });
  }, []);

  const mvpClubs = selectClubVenues({ city: "asuncion", scope: "all" });

  const filteredClubs = useMemo(
    () =>
      applySearchFilters(mvpClubs, { ...searchState, type: "club" }, {
        getName: (club) => club.name,
        getLocation: (club) => {
          const slug = slugify(club.name);
          const dbLocation = dbLocations.get(slug);
          const dbCity = dbCities.get(slug);
          return [dbLocation, dbCity].filter(Boolean).join(" ");
        },
        getTags: (club) => dbGenres.get(slugify(club.name)) || club.genres,
        getZone: (club) => getZoneFromLocation(dbLocations.get(slugify(club.name))),
        getRating: (club) => Number.parseFloat(club.rating),
      }),
    [dbCities, dbGenres, dbLocations, mvpClubs, searchState],
  );
  const displayedClubs = filteredClubs;

  const activeFiltersCount = [
    filters.musicGenres.length > 0,
    filters.openToday,
    filters.activePromos,
    filters.zones.length > 0
  ].filter(Boolean).length;

  const updateFilters = (patch: Partial<SearchState>) => {
    const nextParams = patchSearchParams(searchParams, patch, { type: "club" });
    setSearchParams(nextParams);
  };

  const clearAllFilters = () => {
    updateFilters({
      q: "",
      tags: [],
      openToday: false,
      promos: false,
      zones: [],
      sort: "relevance",
    });
  };

  const toggleMusicGenre = (genre: string) => {
    const nextTags = filters.musicGenres.includes(genre)
      ? filters.musicGenres.filter((value) => value !== genre)
      : [...filters.musicGenres, genre];
    updateFilters({ tags: nextTags });
  };

  const toggleZone = (zone: string) => {
    const nextZones = filters.zones.includes(zone)
      ? filters.zones.filter((value) => value !== zone)
      : [...filters.zones, zone];
    updateFilters({ zones: nextZones });
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
              {/* Row 1: Music Genre Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground mr-1">Música:</span>
                {musicGenres.map(genre => (
                  <Badge
                    key={genre}
                    variant={filters.musicGenres.includes(genre) ? "default" : "outline"}
                    className="cursor-pointer px-3 py-1 text-sm"
                    onClick={() => toggleMusicGenre(genre)}
                  >
                    {genre}
                  </Badge>
                ))}
              </div>

              {/* Row 2: Dropdowns and Checkboxes */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Sort Selector */}
                <Select value={filters.sortBy} onValueChange={(value) => updateFilters({ sort: value })}>
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
                      updateFilters({ zones: [] });
                    } else if (value !== "multiple") {
                      updateFilters({ zones: [value] });
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
                    onCheckedChange={(checked) => updateFilters({ openToday: !!checked })}
                  />
                  <label htmlFor="openToday" className="text-sm text-foreground cursor-pointer">Abierto hoy</label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="activePromos"
                    checked={filters.activePromos}
                    onCheckedChange={(checked) => updateFilters({ promos: !!checked })}
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
          title="Discotecas"
          sortBy={filters.sortBy}
          sortOptions={sortOptions}
          onSortChange={(value) => updateFilters({ sort: value })}
          selectedZones={filters.zones}
          onOpenZones={() => setIsZonesSheetOpen(true)}
          openToday={filters.openToday}
          onToggleOpenToday={() => updateFilters({ openToday: !filters.openToday })}
          hasPromos={filters.activePromos}
          onTogglePromos={() => updateFilters({ promos: !filters.activePromos })}
          onOpenAdvancedFilters={() => setIsAdvancedFiltersOpen(true)}
          advancedFiltersCount={filters.musicGenres.length}
        />

        {/* Zones Bottom Sheet */}
        <FilterBottomSheet
          open={isZonesSheetOpen}
          onOpenChange={setIsZonesSheetOpen}
          title="Elegí tu zona"
          options={zones}
          selectedOptions={filters.zones}
          onToggleOption={toggleZone}
          onClear={() => updateFilters({ zones: [] })}
          onApply={() => {}}
        />

        {/* Advanced Filters Bottom Sheet */}
        <FilterBottomSheet
          open={isAdvancedFiltersOpen}
          onOpenChange={setIsAdvancedFiltersOpen}
          title="Género musical"
          options={musicGenres}
          selectedOptions={filters.musicGenres}
          onToggleOption={toggleMusicGenre}
          onClear={() => updateFilters({ tags: [] })}
          onApply={() => {}}
        />

        {/* Clubs Grid */}
        {filteredClubs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">No encontramos discotecas con esos filtros</p>
            <Button variant="outline" onClick={clearAllFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {displayedClubs.map(club => {
                const clubSlug = slugify(club.name);
                // DB-first: usar cover, location, city, genres, minAge de DB si existen, fallback a mock
                const coverUrl = dbCovers.get(clubSlug) || club.customImage;
                const dbLocation = dbLocations.get(clubSlug);
                const dbCity = dbCities.get(clubSlug);
                // Build "Zona • Ciudad" display string
                const locationDisplay = dbLocation && dbCity
                  ? `${dbLocation} • ${dbCity}`
                  : dbLocation || dbCity || "";
                const genres = dbGenres.get(clubSlug) || club.genres;
                const minAge = dbMinAges.get(clubSlug) ?? null; // null = no badge, DB-first sin fallback
                return (
                  <VenueCard 
                    key={club.id}
                    id={club.id}
                    name={club.name}
                    schedule={club.schedule}
                    rating={club.rating}
                    genres={genres}
                    location={locationDisplay}
                    image={coverUrl}
                    href={`/club/${clubSlug}`}
                    type="club"
                    minAge={minAge}
                  />
                );
              })}
            </div>

          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
