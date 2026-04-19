import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import {
  normalizeQueryInput,
  parseSearchParams,
  setSearchParams,
} from "@/lib/search";
import {
  getNavbarSearchSuggestions,
  type NavbarSearchSuggestion,
} from "@/lib/navbarSearch";
import { getLocalsList, type LocalListItem } from "@/lib/locals";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

const SEARCH_DESTINATIONS = new Set(["/explorar", "/discotecas", "/bares"]);

function applyLocalLookupValues(
  local: LocalListItem,
  coverBySlug: Map<string, string>,
  locationBySlug: Map<string, string>
) {
  const normalizedSlug = slugify(local.name);
  const keys = [normalizedSlug, local.slug].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index
  );

  keys.forEach((key) => {
    if (local.cover_url) {
      coverBySlug.set(key, local.cover_url);
    }

    if (local.location) {
      locationBySlug.set(key, local.location);
    }
  });
}

interface NavbarSearchFormProps {
  placeholder: string;
  searchQuery: string;
  suggestions: NavbarSearchSuggestion[];
  onSearchChange: (value: string) => void;
  onOpenResults: () => void;
  onSelectSuggestion: (suggestion: NavbarSearchSuggestion) => void;
  resetKey: string;
  formClassName: string;
}

function getSuggestionInitials(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function NavbarSearchForm({
  placeholder,
  searchQuery,
  suggestions,
  onSearchChange,
  onOpenResults,
  onSelectSuggestion,
  resetKey,
  formClassName,
}: NavbarSearchFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isInteracting, setIsInteracting] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedQuery = normalizeQueryInput(searchQuery);
  const hasQuery = normalizedQuery.length > 0;
  const isOpen = isInteracting && hasQuery;
  const showFallback = hasQuery;
  const fallbackIndex = suggestions.length;
  const optionCount = suggestions.length + (showFallback ? 1 : 0);

  useEffect(() => {
    setIsInteracting(false);
    setActiveIndex(0);
    optionButtonRefs.current = [];
  }, [resetKey]);

  useEffect(() => {
    if (!hasQuery) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex(0);
  }, [hasQuery, searchQuery, suggestions.length]);

  const focusOption = (index: number) => {
    setActiveIndex(index);
    optionButtonRefs.current[index]?.focus();
  };

  const selectSuggestionByIndex = (index: number) => {
    const suggestion = suggestions[index];
    if (!suggestion) return;
    onSelectSuggestion(suggestion);
    setIsInteracting(false);
  };

  const openResultsFallback = () => {
    onOpenResults();
    setIsInteracting(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!hasQuery) {
      onOpenResults();
      return;
    }

    if (suggestions.length === 0) {
      openResultsFallback();
      return;
    }

    if (showFallback && activeIndex === fallbackIndex) {
      openResultsFallback();
      return;
    }

    selectSuggestionByIndex(Math.min(activeIndex, suggestions.length - 1));
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsInteracting}>
      <PopoverTrigger asChild>
        <form onSubmit={handleSubmit} className={formClassName}>
          <div className="relative">
            <button
              type="submit"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={searchQuery}
              onFocus={() => setIsInteracting(true)}
              onChange={(event) => {
                onSearchChange(event.target.value);
                setIsInteracting(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setIsInteracting(false);
                  return;
                }

                if (event.key === "ArrowDown" && isOpen && optionCount > 0) {
                  event.preventDefault();
                  focusOption(activeIndex);
                }
              }}
              className="w-full pl-10 pr-4"
              aria-label="Buscar"
              aria-expanded={isOpen}
              aria-autocomplete="list"
              autoComplete="off"
            />
          </div>
        </form>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-[var(--radix-popover-trigger-width)] max-w-[min(92vw,720px)] rounded-2xl border border-border bg-background p-2 shadow-xl"
      >
        <div className="space-y-1">
          {suggestions.map((suggestion, index) => {
            const metadataText = [...suggestion.metadata, suggestion.ageLabel]
              .filter(Boolean)
              .join(" · ");
            const isActive = activeIndex === index;

            return (
              <button
                key={suggestion.id}
                ref={(node) => {
                  optionButtonRefs.current[index] = node;
                }}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onClick={() => selectSuggestionByIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusOption(Math.min(index + 1, optionCount - 1));
                    return;
                  }

                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    if (index === 0) {
                      inputRef.current?.focus();
                      setActiveIndex(0);
                      return;
                    }

                    focusOption(index - 1);
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setIsInteracting(false);
                    inputRef.current?.focus();
                  }
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  isActive ? "bg-muted" : "hover:bg-muted/80",
                  "focus-visible:bg-muted focus-visible:outline-none"
                )}
              >
                <Avatar className="h-11 w-11 rounded-xl border border-border">
                  <AvatarImage
                    src={suggestion.imageSrc}
                    alt={suggestion.title}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-xl text-xs font-semibold">
                    {getSuggestionInitials(suggestion.title)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="truncate text-sm font-medium text-foreground">
                      {suggestion.title}
                    </div>
                    <div className="shrink-0 pt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {suggestion.typeLabel}
                    </div>
                  </div>
                  <div className="truncate pt-0.5 text-xs text-muted-foreground">
                    {metadataText}
                  </div>
                </div>
              </button>
            );
          })}

          {showFallback && (
            <button
              ref={(node) => {
                optionButtonRefs.current[fallbackIndex] = node;
              }}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(fallbackIndex)}
              onFocus={() => setActiveIndex(fallbackIndex)}
              onClick={openResultsFallback}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  focusOption(fallbackIndex);
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (suggestions.length === 0) {
                    inputRef.current?.focus();
                    setActiveIndex(0);
                    return;
                  }

                  focusOption(suggestions.length - 1);
                  return;
                }

                if (event.key === "Escape") {
                  event.preventDefault();
                  setIsInteracting(false);
                  inputRef.current?.focus();
                }
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border border-dashed px-3 py-3 text-left transition",
                activeIndex === fallbackIndex ? "border-border bg-muted" : "border-border/70 hover:bg-muted/60",
                "focus-visible:bg-muted focus-visible:outline-none"
              )}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  Ver todos los resultados
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  para &quot;{normalizedQuery}&quot;
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const Navbar = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [coverBySlug, setCoverBySlug] = useState<Map<string, string>>(new Map());
  const [locationBySlug, setLocationBySlug] = useState<Map<string, string>>(new Map());
  const location = useLocation();
  const isHome = location.pathname === "/";
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const searchState = parseSearchParams(location.search);
  const searchSuggestions = useMemo(
    () =>
      getNavbarSearchSuggestions(searchQuery, {
        coverBySlug,
        locationBySlug,
      }),
    [coverBySlug, locationBySlug, searchQuery]
  );

  useEffect(() => {
    setSearchQuery(searchState.q);
  }, [searchState.q]);

  useEffect(() => {
    let active = true;

    Promise.allSettled([getLocalsList("bar", 100), getLocalsList("club", 100)])
      .then(([barsResult, clubsResult]) => {
        if (!active) return;

        const nextCoverBySlug = new Map<string, string>();
        const nextLocationBySlug = new Map<string, string>();
        const locals = [
          ...(barsResult.status === "fulfilled" ? barsResult.value : []),
          ...(clubsResult.status === "fulfilled" ? clubsResult.value : []),
        ];

        locals.forEach((local) => {
          applyLocalLookupValues(local, nextCoverBySlug, nextLocationBySlug);
        });

        setCoverBySlug(nextCoverBySlug);
        setLocationBySlug(nextLocationBySlug);
      })
      .catch(() => {
        // Keep fixture-based fallbacks when public locals are unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  const resolveDestinationPath = () => {
    if (SEARCH_DESTINATIONS.has(location.pathname)) {
      return location.pathname;
    }
    return "/explorar";
  };

  const openSearchResults = () => {
    const destinationPath = resolveDestinationPath();
    const fixedType =
      destinationPath === "/discotecas"
        ? { type: "club" as const }
        : destinationPath === "/bares"
          ? { type: "bar" as const }
          : {};

    setSearchParams(
      navigate,
      destinationPath,
      location.search,
      { q: normalizeQueryInput(searchQuery) },
      { fixed: fixedType }
    );
  };

  const handleSuggestionSelect = (suggestion: NavbarSearchSuggestion) => {
    navigate(suggestion.href);
  };

  const resetKey = `${location.pathname}${location.search}`;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b backdrop-blur transition-colors",
        isHome
          ? "border-white/10 bg-background/34 supports-[backdrop-filter]:bg-background/26"
          : "border-border bg-background/80"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
        <div className="flex items-center">
          <Link
            to="/"
            className="text-xl lg:text-2xl font-bold text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Ir a inicio"
          >
            Tairet
          </Link>
        </div>

        <div className="hidden lg:flex flex-1 justify-center items-center w-full">
          <NavbarSearchForm
            placeholder="Buscar por zona, local o música…"
            searchQuery={searchQuery}
            suggestions={searchSuggestions}
            onSearchChange={setSearchQuery}
            onOpenResults={openSearchResults}
            onSelectSuggestion={handleSuggestionSelect}
            resetKey={`${resetKey}-desktop`}
            formClassName="w-full max-w-[720px] mx-auto"
          />
        </div>

        <div className="lg:hidden flex-1 flex justify-center items-center w-full px-4">
          <NavbarSearchForm
            placeholder="Buscar…"
            searchQuery={searchQuery}
            suggestions={searchSuggestions}
            onSearchChange={setSearchQuery}
            onOpenResults={openSearchResults}
            onSelectSuggestion={handleSuggestionSelect}
            resetKey={`${resetKey}-mobile`}
            formClassName="w-full"
          />
        </div>

        <div className="hidden lg:flex items-center space-x-3">
          <ThemeToggle />

          <Button variant="default" asChild className="font-medium">
            <Link to="/para-locales/publica-tu-local">Publicá tu local</Link>
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
