import { allClubs } from "@/lib/data/venues";
import { slugify } from "@/lib/slug";
import { MVP_CLUB_SLUGS } from "@/lib/mvpSlugs";
import { getLocalsList, type LocalListItem } from "@/lib/locals";
import type { Club } from "@/lib/types";

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

export async function getPublicClubSelection(options: VenueSelectorOptions = {}): Promise<{
  clubs: Club[];
  locals: LocalListItem[];
}> {
  const { city = "asuncion" } = options;
  if (!isCityOperative(city)) return { clubs: [], locals: [] };

  const bySlug = new Map<string, LocalListItem>();
  const seen = new Set<string>();
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const page = await getLocalsList("club", pageSize, offset);
    const previousCount = seen.size;
    for (const local of page) {
      seen.add(local.id);
      if (local.type === "club" && local.slug) bySlug.set(local.slug, local);
    }
    if (page.length < pageSize || MVP_CLUB_SLUGS.every(slug => bySlug.has(slug))) break;
    if (seen.size === previousCount) throw new Error("La paginación del catálogo no avanzó");
  }

  // Keep the editorial order and metadata, but never list a slug absent from the public API.
  const visibleSlugs = MVP_CLUB_SLUGS.filter(slug => bySlug.has(slug));
  return {
    clubs: orderByMvpSlugs(allClubs, visibleSlugs, club => slugify(club.name)),
    locals: visibleSlugs.map(slug => bySlug.get(slug)!),
  };
}
