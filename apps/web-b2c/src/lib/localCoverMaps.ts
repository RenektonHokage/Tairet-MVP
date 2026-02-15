import { getLocalsList, type LocalListItem } from "@/lib/locals";
import { slugify } from "@/lib/slug";

export type CoverBySlugMap = Map<string, string>;

function buildCoverMap(locals: LocalListItem[]): CoverBySlugMap {
  const coverMap = new Map<string, string>();

  locals.forEach((local) => {
    if (local.cover_url) {
      const normalizedSlug = slugify(local.name);
      if (normalizedSlug) {
        coverMap.set(normalizedSlug, local.cover_url);
      }
      if (local.slug && local.slug !== normalizedSlug) {
        coverMap.set(local.slug, local.cover_url);
      }
    }
  });

  return coverMap;
}

export async function getZoneCoverMaps(limit: number = 100): Promise<{
  clubCovers: CoverBySlugMap;
  barCovers: CoverBySlugMap;
}> {
  const [clubResult, barResult] = await Promise.allSettled([
    getLocalsList("club", limit),
    getLocalsList("bar", limit),
  ]);

  const clubLocals = clubResult.status === "fulfilled" ? clubResult.value : [];
  const barLocals = barResult.status === "fulfilled" ? barResult.value : [];

  return {
    clubCovers: buildCoverMap(clubLocals),
    barCovers: buildCoverMap(barLocals),
  };
}
