import { buildTodayScheduleBySlug, getLocalsList, type LocalListItem } from "@/lib/locals";
import { slugify } from "@/lib/slug";

export type CoverBySlugMap = Map<string, string>;
export type TodayScheduleBySlugMap = Map<string, string>;
export type AttributesBySlugMap = Map<string, string[]>;
export type MinAgeBySlugMap = Map<string, number>;

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

function buildAttributesMap(locals: LocalListItem[]): AttributesBySlugMap {
  const attributesMap = new Map<string, string[]>();

  locals.forEach((local) => {
    if (Array.isArray(local.attributes) && local.attributes.length > 0) {
      const normalizedSlug = slugify(local.name);
      if (normalizedSlug) {
        attributesMap.set(normalizedSlug, local.attributes);
      }
      if (local.slug && local.slug !== normalizedSlug) {
        attributesMap.set(local.slug, local.attributes);
      }
    }
  });

  return attributesMap;
}

function buildMinAgeMap(locals: LocalListItem[]): MinAgeBySlugMap {
  const minAgeMap = new Map<string, number>();

  locals.forEach((local) => {
    if (typeof local.min_age === "number") {
      const normalizedSlug = slugify(local.name);
      if (normalizedSlug) {
        minAgeMap.set(normalizedSlug, local.min_age);
      }
      if (local.slug && local.slug !== normalizedSlug) {
        minAgeMap.set(local.slug, local.min_age);
      }
    }
  });

  return minAgeMap;
}

export async function getZoneCoverMaps(limit: number = 100): Promise<{
  clubCovers: CoverBySlugMap;
  barCovers: CoverBySlugMap;
  clubSchedules: TodayScheduleBySlugMap;
  barSchedules: TodayScheduleBySlugMap;
  clubAttributes: AttributesBySlugMap;
  barAttributes: AttributesBySlugMap;
  clubMinAges: MinAgeBySlugMap;
  barMinAges: MinAgeBySlugMap;
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
    clubSchedules: buildTodayScheduleBySlug(clubLocals),
    barSchedules: buildTodayScheduleBySlug(barLocals),
    clubAttributes: buildAttributesMap(clubLocals),
    barAttributes: buildAttributesMap(barLocals),
    clubMinAges: buildMinAgeMap(clubLocals),
    barMinAges: buildMinAgeMap(barLocals),
  };
}
