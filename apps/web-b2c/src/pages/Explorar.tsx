import Navbar from "@/components/layout/Navbar";
import BottomNavbar from "@/components/layout/BottomNavbar";
import Footer from "@/components/Footer";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { images } from "@/lib/images";
import { selectBarVenues, selectClubVenues } from "@/lib/venueSelectors";
import { applySearchFilters, parseSearchParams, patchSearchParams } from "@/lib/search";
import VenueCard from "@/components/shared/VenueCard";
import { slugify } from "@/lib/slug";
import { prefetchImages } from "@/lib/imagePrefetch";
import { buildTodayScheduleBySlug, getLocalsList } from "@/lib/locals";

const Explorar = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [todaySchedulesBySlug, setTodaySchedulesBySlug] = useState<Map<string, string>>(new Map());
  const searchState = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const typeFilter = searchState.type === "all" ? undefined : searchState.type;
  const bars = useMemo(
    () =>
      applySearchFilters(selectBarVenues({ city: "asuncion", scope: "all" }), searchState, {
        getName: (bar) => bar.name,
        getLocation: (bar) => bar.location,
        getTags: (bar) => bar.specialties,
      }),
    [searchState],
  );
  const clubs = useMemo(
    () =>
      applySearchFilters(selectClubVenues({ city: "asuncion", scope: "all" }), searchState, {
        getName: (club) => club.name,
        getTags: (club) => club.genres,
      }),
    [searchState],
  );
  const hasActiveQuery =
    Boolean(searchState.q) ||
    searchState.type !== "all" ||
    searchState.tags.length > 0 ||
    searchState.zones.length > 0 ||
    searchState.openToday ||
    searchState.promos;
  const showBars = searchState.type === "all" || searchState.type === "bar";
  const showClubs = searchState.type === "all" || searchState.type === "club";
  const totalResults = (showBars ? bars.length : 0) + (showClubs ? clubs.length : 0);

  // Title based on type filter
  const pageTitle =
    typeFilter === "bar"
      ? "Bares"
      : typeFilter === "club"
        ? "Discotecas"
        : typeFilter === "evento"
          ? "Eventos"
          : "Explorá la vida nocturna";

  const pageSubtitle = hasActiveQuery
    ? typeFilter === "bar"
      ? `${bars.length} bares coinciden con tu búsqueda`
      : typeFilter === "club"
        ? `${clubs.length} discotecas coinciden con tu búsqueda`
        : `${bars.length + clubs.length} resultados entre bares y discotecas`
    : typeFilter === "bar"
      ? "Los mejores bares en Paraguay"
      : typeFilter === "club"
        ? "Las mejores discotecas en Paraguay"
        : typeFilter === "evento"
          ? "Eventos especiales y fiestas en Paraguay"
          : "Descubrí los mejores bares y discotecas en Paraguay";

  // Update document title based on filter
  useEffect(() => {
    const docTitle = typeFilter === "bar"
      ? "Bares | Tairet"
      : typeFilter === "club"
        ? "Discotecas | Tairet"
        : typeFilter === "evento"
          ? "Eventos | Tairet"
          : "Explorar | Tairet";
    document.title = docTitle;

    const desc = pageSubtitle;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, [typeFilter, pageSubtitle]);

  useEffect(() => {
    let active = true;

    Promise.allSettled([getLocalsList("bar", 100), getLocalsList("club", 100)])
      .then(([barsResult, clubsResult]) => {
        if (!active) return;

        const barsLocals = barsResult.status === "fulfilled" ? barsResult.value : [];
        const clubsLocals = clubsResult.status === "fulfilled" ? clubsResult.value : [];
        const nextMap = new Map<string, string>([
          ...buildTodayScheduleBySlug(barsLocals),
          ...buildTodayScheduleBySlug(clubsLocals),
        ]);
        setTodaySchedulesBySlug(nextMap);
      })
      .catch(() => {
        // Fallback to fixture schedule on API errors.
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hasActiveQuery || totalResults === 0) return;

    const candidateImages: Array<string | undefined> = [];

    if (showBars) {
      candidateImages.push(...bars.map((bar) => bar.image));
    }

    if (showClubs) {
      candidateImages.push(...clubs.map((club) => club.customImage));
    }

    prefetchImages(candidateImages, 8);
  }, [bars, clubs, hasActiveQuery, showBars, showClubs, totalResults]);

  const clearSearch = () => {
    const nextParams = patchSearchParams(
      searchParams,
      { q: "", tags: [], zones: [], openToday: false, promos: false },
      { type: searchState.type },
    );
    setSearchParams(nextParams);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Header Section */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.1),transparent_50%)]" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4">
            {pageTitle}
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-2xl mx-auto">
            {pageSubtitle}
          </p>
          
        </div>
      </section>

      {hasActiveQuery ? (
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {totalResults === 0 ? (
              <div className="text-center py-12">
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                  No encontramos resultados
                </h2>
                <p className="text-muted-foreground mb-6">
                  Probá con otro término o limpiá la búsqueda.
                </p>
                <Button onClick={clearSearch}>Limpiar búsqueda</Button>
              </div>
            ) : (
              <div className="space-y-10">
                {showBars && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                        Bares ({bars.length})
                      </h2>
                      <Button variant="outline" size="sm" onClick={clearSearch}>
                        Limpiar
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {bars.map((bar, index) => (
                        <VenueCard
                          key={`bar-${bar.id}`}
                          id={bar.id}
                          name={bar.name}
                          schedule={todaySchedulesBySlug.get(slugify(bar.name)) ?? "Horario no disponible"}
                          rating={bar.rating}
                          specialties={bar.specialties}
                          location={bar.location}
                          image={bar.image}
                          href={`/bar/${slugify(bar.name)}`}
                          type="bar"
                          imagePriority={index < 6}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {showClubs && (
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                      Discotecas ({clubs.length})
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {clubs.map((club, index) => (
                        <VenueCard
                          key={`club-${club.id}`}
                          id={club.id}
                          name={club.name}
                          schedule={todaySchedulesBySlug.get(slugify(club.name)) ?? "Horario no disponible"}
                          rating={club.rating}
                          genres={club.genres}
                          image={club.customImage}
                          href={`/club/${slugify(club.name)}`}
                          type="club"
                          imagePriority={index < 6}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Zonas populares
              </h2>
              <p className="text-muted-foreground text-lg">
                Explorá por ubicación
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Link to="/zona/asuncion" className="group block">
                <Card className="overflow-hidden border-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <div className="relative h-48">
                    <img
                      src={images.zones.asuncion}
                      alt="Asunción"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-white text-xl font-bold mb-1">Asunción</h3>
                      <div className="hidden md:flex items-center text-white/80 text-sm">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span>Centro y alrededores</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/zona/san-bernardino" className="group block">
                <Card className="overflow-hidden border-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <div className="relative h-48">
                    <img
                      src={images.zones.sanBernardino}
                      alt="San Bernardino"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-white text-xl font-bold mb-1">San Bernardino</h3>
                      <div className="hidden md:flex items-center text-white/80 text-sm">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span>Distrito turístico</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>

              <Link to="/zona/ciudad-del-este" className="group block">
                <Card className="overflow-hidden border-0 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <div className="relative h-48">
                    <img
                      src={images.zones.ciudadDelEste}
                      alt="Ciudad del Este"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-white text-xl font-bold mb-1">Ciudad del Este</h3>
                      <div className="hidden md:flex items-center text-white/80 text-sm">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span>Zona comercial</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </div>
        </section>
      )}

      <Footer />
      {/* Safe bottom space for mobile to avoid overlap and unify spacing */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      <BottomNavbar />
    </div>
  );
};

export default Explorar;
