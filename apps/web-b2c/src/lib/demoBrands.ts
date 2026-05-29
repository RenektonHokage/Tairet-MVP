export type DemoBrandType = "club" | "bar";

export interface DemoBrand {
  slug: string;
  type: DemoBrandType;
  displayName: string;
  sourceName: string;
  demoBrand: true;
}

const DEMO_BRANDS: Record<string, DemoBrand> = {
  dlirio: {
    slug: "dlirio",
    type: "club",
    displayName: "Koala Jack",
    sourceName: "D'Lirio",
    demoBrand: true,
  },
  "mckharthys-bar": {
    slug: "mckharthys-bar",
    type: "bar",
    displayName: "Tairet Bar",
    sourceName: "McKarthy's",
    demoBrand: true,
  },
};

export function getDemoBrand(slug: string | null | undefined, type?: DemoBrandType): DemoBrand | null {
  if (!slug) {
    return null;
  }

  const brand = DEMO_BRANDS[slug.toLowerCase()];
  if (!brand || (type && brand.type !== type)) {
    return null;
  }

  return brand;
}

export function getDemoBrandDisplayName(
  slug: string | null | undefined,
  fallbackName: string,
  type?: DemoBrandType
): string {
  return getDemoBrand(slug, type)?.displayName ?? fallbackName;
}
