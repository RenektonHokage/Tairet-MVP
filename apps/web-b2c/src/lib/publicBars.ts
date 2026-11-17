import { getLocalsList, getTodayScheduleLabel, type LocalListItem } from "./locals";

export interface PublicBar {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  location: string;
  specialties: string[];
  minAge: number | null;
  image: string;
  schedule: string;
  isOpenToday: boolean;
}

// The server is the publication authority. Never add mock rows or derive a slug from a name.
export function toPublicBars(locals: LocalListItem[]): PublicBar[] {
  return locals.filter(local => local.type === "bar" && local.is_published === true && Boolean(local.slug)).map(local => ({
    id: local.id,
    slug: local.slug,
    name: local.name,
    city: local.city,
    location: [local.location, local.city].filter(Boolean).join(" • "),
    specialties: local.attributes ?? [],
    minAge: local.min_age,
    image: local.cover_url || "",
    schedule: getTodayScheduleLabel(local) ?? "Horario no disponible",
    isOpenToday: local.is_open_today === true,
  }));
}

export async function getPublicBars(): Promise<PublicBar[]> {
  const locals: LocalListItem[] = [];
  const seen = new Set<string>();
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const page = await getLocalsList("bar", pageSize, offset);
    // An older backend does not prove publication and may ignore pagination.
    if (page.some(local => local.type === "bar" && local.is_published === undefined)) return [];
    if (page.some(local => seen.has(local.id))) throw new Error("La paginación del catálogo no avanzó");
    page.forEach(local => seen.add(local.id));
    locals.push(...page);
    if (page.length < pageSize) break;
  }
  return toPublicBars(locals);
}
