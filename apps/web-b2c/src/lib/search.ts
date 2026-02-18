import type { NavigateFunction } from "react-router-dom";

export type SearchType = "all" | "bar" | "club" | "evento";

export interface SearchState {
  q: string;
  city?: string;
  zones: string[];
  tags: string[];
  sort: string;
  type: SearchType;
  openToday: boolean;
  promos: boolean;
}

const DEFAULT_SEARCH_STATE: SearchState = {
  q: "",
  city: undefined,
  zones: [],
  tags: [],
  sort: "relevance",
  type: "all",
  openToday: false,
  promos: false,
};

function toParams(input: string | URLSearchParams): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  const raw = input.startsWith("?") ? input.slice(1) : input;
  return new URLSearchParams(raw);
}

function parseList(value: string | null): string[] {
  if (!value) return [];
  const uniqueValues = new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return [...uniqueValues];
}

function parseBool(value: string | null): boolean {
  return value === "1" || value === "true";
}

function normalizeType(value: string | null): SearchType {
  if (!value) return "all";
  if (value === "bar" || value === "club" || value === "all" || value === "evento") {
    return value;
  }
  if (value === "boliche") return "club";
  return "all";
}

function setStringParam(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value && value.length > 0) {
    params.set(key, value);
    return;
  }
  params.delete(key);
}

function setBoolParam(params: URLSearchParams, key: string, value: boolean): void {
  if (value) {
    params.set(key, "1");
    return;
  }
  params.delete(key);
}

function setListParam(params: URLSearchParams, key: string, value: string[]): void {
  if (value.length > 0) {
    params.set(key, value.join(","));
    return;
  }
  params.delete(key);
}

export function normalizeQueryInput(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseSearchParams(input: string | URLSearchParams): SearchState {
  const params = toParams(input);
  const q = normalizeQueryInput(params.get("q") ?? "");
  const city = params.get("city") ?? undefined;
  const zones = parseList(params.get("zones"));
  const tags = parseList(params.get("tags"));
  const sort = params.get("sort") || DEFAULT_SEARCH_STATE.sort;
  const type = normalizeType(params.get("type"));
  const openToday = parseBool(params.get("openToday"));
  const promos = parseBool(params.get("promos"));

  return {
    q,
    city,
    zones,
    tags,
    sort,
    type,
    openToday,
    promos,
  };
}

export function serializeSearchState(
  state: SearchState,
  base?: string | URLSearchParams,
): URLSearchParams {
  const params = base ? toParams(base) : new URLSearchParams();
  const nextQ = normalizeQueryInput(state.q);

  setStringParam(params, "q", nextQ || undefined);
  setStringParam(params, "city", state.city);
  setListParam(params, "zones", state.zones);
  setListParam(params, "tags", state.tags);
  setStringParam(params, "sort", state.sort === "relevance" ? undefined : state.sort);
  setStringParam(params, "type", state.type === "all" ? undefined : state.type);
  setBoolParam(params, "openToday", state.openToday);
  setBoolParam(params, "promos", state.promos);

  return params;
}

export function patchSearchParams(
  current: string | URLSearchParams,
  patch: Partial<SearchState>,
  fixed: Partial<SearchState> = {},
): URLSearchParams {
  const currentState = parseSearchParams(current);
  const nextState: SearchState = {
    ...DEFAULT_SEARCH_STATE,
    ...currentState,
    ...patch,
    ...fixed,
  };
  return serializeSearchState(nextState, current);
}

export function setSearchParams(
  navigate: NavigateFunction,
  pathname: string,
  currentSearch: string,
  patch: Partial<SearchState>,
  options: { replace?: boolean; fixed?: Partial<SearchState> } = {},
): void {
  const params = patchSearchParams(currentSearch, patch, options.fixed);
  const serialized = params.toString();
  navigate(
    {
      pathname,
      search: serialized ? `?${serialized}` : "",
    },
    { replace: options.replace ?? false },
  );
}

export function normalizeForSearch(value: string): string {
  return normalizeQueryInput(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesNormalized(haystack: string, needle: string): boolean {
  return normalizeForSearch(haystack).includes(needle);
}

function intersectsNormalized(values: string[], selectedValues: string[]): boolean {
  if (selectedValues.length === 0) return true;
  const selected = new Set(selectedValues.map(normalizeForSearch));
  return values.some((value) => selected.has(normalizeForSearch(value)));
}

export interface SearchFilterOptions<T> {
  getName: (item: T) => string;
  getLocation?: (item: T) => string | undefined;
  getTags?: (item: T) => string[];
  getZone?: (item: T) => string | undefined;
  getRating?: (item: T) => number;
  isOpenToday?: (item: T) => boolean;
  hasPromos?: (item: T) => boolean;
  customSortComparators?: Record<string, (a: T, b: T) => number>;
}

export function matchesQuery<T>(
  item: T,
  query: string,
  options: Pick<SearchFilterOptions<T>, "getName" | "getLocation" | "getTags">,
): boolean {
  if (!query) return true;
  const normalizedQuery = normalizeForSearch(query);
  const searchableParts: string[] = [options.getName(item)];
  const location = options.getLocation?.(item);
  if (location) searchableParts.push(location);
  const tags = options.getTags?.(item);
  if (tags && tags.length > 0) searchableParts.push(...tags);
  return searchableParts.some((part) => includesNormalized(part, normalizedQuery));
}

export function applySearchFilters<T>(
  items: T[],
  state: SearchState,
  options: SearchFilterOptions<T>,
): T[] {
  let filtered = [...items];

  filtered = filtered.filter((item) => matchesQuery(item, state.q, options));

  if (state.tags.length > 0 && options.getTags) {
    filtered = filtered.filter((item) => intersectsNormalized(options.getTags?.(item) ?? [], state.tags));
  }

  if (state.zones.length > 0 && options.getZone) {
    filtered = filtered.filter((item) => {
      const zone = options.getZone?.(item);
      return zone ? intersectsNormalized([zone], state.zones) : false;
    });
  }

  if (state.openToday && options.isOpenToday) {
    filtered = filtered.filter((item) => options.isOpenToday?.(item));
  }

  if (state.promos && options.hasPromos) {
    filtered = filtered.filter((item) => options.hasPromos?.(item));
  }

  const comparator = options.customSortComparators?.[state.sort];
  if (comparator) {
    filtered.sort(comparator);
  } else if (state.sort === "rating" && options.getRating) {
    filtered.sort((a, b) => (options.getRating?.(b) ?? 0) - (options.getRating?.(a) ?? 0));
  }

  return filtered;
}

export function getZoneFromLocation(location?: string | null): string | undefined {
  if (!location) return undefined;
  const [zone] = location.split("•");
  return zone?.trim() || undefined;
}
