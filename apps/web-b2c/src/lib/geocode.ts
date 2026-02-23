export type Coordinates = [number, number]; // [lng, lat]

interface GeocodeCacheEntry {
  coords: Coordinates;
  expiresAt: number;
}

interface GeocodeAddressArgs {
  token: string;
  venueId?: string;
  venueName?: string;
  address?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string;
  signal?: AbortSignal;
}

interface GoogleMapsDirectionsArgs {
  coords?: Coordinates | null;
  venueName?: string;
  address?: string | null;
  location?: string | null;
  city?: string | null;
  country?: string;
}

const GEO_CACHE_PREFIX = "geo:v1:";
const GEO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GEO_COUNTRY_DEFAULT = "Paraguay";
const memoryCache = new Map<string, GeocodeCacheEntry>();

const trimOrEmpty = (value?: string | null): string => value?.trim() ?? "";
const normalizeForCache = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const splitZoneAndCity = (location?: string | null, city?: string | null) => {
  const rawLocation = trimOrEmpty(location);
  const rawCity = trimOrEmpty(city);
  if (!rawLocation.includes("•")) {
    return {
      zone: rawLocation,
      city: rawCity,
    };
  }

  const [zonePart, cityPart] = rawLocation.split("•").map((part) => part.trim());
  return {
    zone: zonePart || rawLocation,
    city: rawCity || cityPart || "",
  };
};

const buildGeocodeQuery = (args: GeocodeAddressArgs): string => {
  const address = trimOrEmpty(args.address);
  const { zone, city } = splitZoneAndCity(args.location, args.city);
  const country = trimOrEmpty(args.country) || GEO_COUNTRY_DEFAULT;

  // Regla de oro: dirección pura + ciudad + país.
  const parts: string[] = [];
  if (address) {
    parts.push(address);
  } else if (zone) {
    parts.push(zone);
  } else if (args.venueName?.trim()) {
    parts.push(args.venueName.trim());
  }
  if (city) parts.push(city);
  if (country) parts.push(country);

  return parts.join(", ").replace(/\s+/g, " ").trim();
};

const buildFallbackQuery = (args: GeocodeAddressArgs): string => {
  const { zone, city } = splitZoneAndCity(args.location, args.city);
  const country = trimOrEmpty(args.country) || GEO_COUNTRY_DEFAULT;
  const parts: string[] = [];
  if (args.venueName?.trim()) parts.push(args.venueName.trim());
  if (zone) parts.push(zone);
  if (city) parts.push(city);
  if (country) parts.push(country);
  return parts.join(", ").replace(/\s+/g, " ").trim();
};

const buildCacheKey = (venueId: string | undefined, query: string): string => {
  const normalizedQuery = normalizeForCache(query);
  const normalizedVenueId = normalizeForCache(trimOrEmpty(venueId));
  if (normalizedVenueId) {
    return `${GEO_CACHE_PREFIX}venue:${normalizedVenueId}:${normalizedQuery}`;
  }
  return `${GEO_CACHE_PREFIX}query:${normalizedQuery}`;
};

const isCacheEntryValid = (entry: GeocodeCacheEntry | null | undefined): entry is GeocodeCacheEntry =>
  !!entry && Number.isFinite(entry.coords[0]) && Number.isFinite(entry.coords[1]) && entry.expiresAt > Date.now();

const readLocalStorageCache = (key: string): GeocodeCacheEntry | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GeocodeCacheEntry;
    return isCacheEntryValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeLocalStorageCache = (key: string, entry: GeocodeCacheEntry): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore quota/private mode errors.
  }
};

export async function geocodeAddressWithCache(args: GeocodeAddressArgs): Promise<Coordinates | null> {
  const token = trimOrEmpty(args.token);
  if (!token) return null;

  const query = buildGeocodeQuery(args);
  if (!query) return null;

  const cacheKey = buildCacheKey(args.venueId, query);
  const inMemory = memoryCache.get(cacheKey);
  if (isCacheEntryValid(inMemory)) return inMemory.coords;

  const persisted = readLocalStorageCache(cacheKey);
  if (isCacheEntryValid(persisted)) {
    memoryCache.set(cacheKey, persisted);
    return persisted.coords;
  }

  const requestCoords = async (searchQuery: string): Promise<Coordinates | null> => {
    const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json`;
    const params = new URLSearchParams({
      access_token: token,
      limit: "1",
      country: "py",
      language: "es",
      autocomplete: "false",
      types: "address,poi",
    });

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: "GET",
      signal: args.signal,
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as {
      features?: Array<{ center?: number[]; place_type?: string[] }>;
    };
    const topFeature = payload.features?.[0];
    const placeTypes = Array.isArray(topFeature?.place_type) ? topFeature.place_type : [];
    const isExactResult = placeTypes.includes("address") || placeTypes.includes("poi");
    if (!isExactResult) {
      return null;
    }

    const center = topFeature?.center;
    if (!center || center.length < 2) return null;

    const lng = Number(center[0]);
    const lat = Number(center[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

    return [lng, lat];
  };

  let coords = await requestCoords(query);
  if (!coords) {
    const fallbackQuery = buildFallbackQuery(args);
    if (fallbackQuery && fallbackQuery !== query) {
      coords = await requestCoords(fallbackQuery);
    }
  }
  if (!coords) return null;

  const entry: GeocodeCacheEntry = {
    coords,
    expiresAt: Date.now() + GEO_TTL_MS,
  };
  memoryCache.set(cacheKey, entry);
  writeLocalStorageCache(cacheKey, entry);
  return entry.coords;
}

export function buildGoogleMapsDirectionsUrl(args: GoogleMapsDirectionsArgs): string {
  const coords = args.coords;
  if (coords && Number.isFinite(coords[0]) && Number.isFinite(coords[1])) {
    const [lng, lat] = coords;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }

  const venueName = trimOrEmpty(args.venueName);
  const address = trimOrEmpty(args.address);
  const location = trimOrEmpty(args.location);
  const city = trimOrEmpty(args.city);
  const country = trimOrEmpty(args.country) || GEO_COUNTRY_DEFAULT;

  const parts: string[] = [];
  if (address) parts.push(address);
  else if (venueName) parts.push(venueName);
  if (location) parts.push(location);
  if (city) parts.push(city);
  if (country) parts.push(country);

  const destination = parts.join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
