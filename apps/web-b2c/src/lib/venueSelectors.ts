import { allBars, allClubs } from "@/lib/data/venues";
import { slugify } from "@/lib/slug";
import { MVP_BAR_SLUGS, MVP_CLUB_SLUGS } from "@/lib/mvpSlugs";
import type { Bar, Club } from "@/lib/types";

export type VenueSelectorType = "bar" | "club";
export type VenueSelectorScope = "zone" | "all";
export type VenueSelectorCity = "asuncion" | "san-bernardino" | "ciudad-del-este";

interface VenueSelectorOptions {
  city?: VenueSelectorCity;
  scope?: VenueSelectorScope;
}

const OPERATIVE_CITIES: ReadonlySet<VenueSelectorCity> = new Set(["asuncion"]);

function orderByMvpSlugs<T>(items: T[], mvpSlugs: readonly string[], getSlug: (item: T) => string): T[] {
  const orderIndex = new Map<string, number>();
  mvpSlugs.forEach((slug, index) => orderIndex.set(slug, index));

  return items
    .map((item) => {
      const slug = getSlug(item);
      const index = orderIndex.get(slug);
      return index === undefined ? null : { item, index };
    })
    .filter((entry): entry is { item: T; index: number } => entry !== null)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.item);
}

export function isCityOperative(city: VenueSelectorCity): boolean {
  return OPERATIVE_CITIES.has(city);
}

export function selectClubVenues(options: VenueSelectorOptions = {}): Club[] {
  const { city = "asuncion" } = options;
  if (!isCityOperative(city)) return [];

  // scope stays explicit for parity with zone/all usage.
  return orderByMvpSlugs(allClubs, MVP_CLUB_SLUGS, (club) => slugify(club.name));
}

export function selectBarVenues(options: VenueSelectorOptions = {}): Bar[] {
  const { city = "asuncion" } = options;
  if (!isCityOperative(city)) return [];

  // scope stays explicit for parity with zone/all usage.
  return orderByMvpSlugs(allBars, MVP_BAR_SLUGS, (bar) => slugify(bar.name));
}
