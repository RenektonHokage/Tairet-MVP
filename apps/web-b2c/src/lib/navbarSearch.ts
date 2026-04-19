import { mockBarData } from "@/lib/mocks/bars";
import { mockClubData } from "@/lib/mocks/clubs";
import { getZoneFromLocation, normalizeForSearch } from "@/lib/search";
import { slugify } from "@/lib/slug";
import { selectBarVenues, selectClubVenues } from "@/lib/venueSelectors";

export interface NavbarSearchSuggestion {
  id: string;
  title: string;
  typeLabel: "Bar" | "Discoteca";
  href: string;
  imageSrc: string;
  metadata: string[];
  ageLabel?: string;
}

interface RankedSuggestion extends NavbarSearchSuggestion {
  rank: number;
}

interface NavbarSearchSuggestionOptions {
  maxSuggestions?: number;
  coverBySlug?: ReadonlyMap<string, string>;
  locationBySlug?: ReadonlyMap<string, string>;
}

function getRank(values: string[], normalizedQuery: string) {
  if (values.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const [primaryValue, ...secondaryValues] = values;

  if (primaryValue.startsWith(normalizedQuery)) return 0;
  if (primaryValue.includes(normalizedQuery)) return 1;
  if (secondaryValues.some((value) => value.startsWith(normalizedQuery))) return 2;
  if (secondaryValues.some((value) => value.includes(normalizedQuery))) return 3;

  return Number.POSITIVE_INFINITY;
}

function compactMetadata(values: Array<string | undefined>, limit = 2) {
  return values.filter((value): value is string => Boolean(value)).slice(0, limit);
}

export function getNavbarSearchSuggestions(
  query: string,
  options: NavbarSearchSuggestionOptions = {}
): NavbarSearchSuggestion[] {
  const { maxSuggestions = 6, coverBySlug, locationBySlug } = options;
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) {
    return [];
  }

  const rankedBars: RankedSuggestion[] = selectBarVenues({ city: "asuncion", scope: "all" })
    .map((bar) => {
      const slug = slugify(bar.name);
      const mockBar = mockBarData[slug as keyof typeof mockBarData];
      const ageLabel = mockBar?.ageRestriction;
      const resolvedLocation = locationBySlug?.get(slug) ?? bar.location;
      const neighborhood = getZoneFromLocation(resolvedLocation);

      return {
        id: `bar-${slug}`,
        title: bar.name,
        typeLabel: "Bar" as const,
        href: `/bar/${slug}`,
        imageSrc: coverBySlug?.get(slug) ?? bar.image ?? mockBar?.images[0] ?? "/images/bar.jpg",
        metadata: compactMetadata([neighborhood, bar.specialties[0]]),
        ageLabel,
        rank: getRank(
          [
            normalizeForSearch(bar.name),
            normalizeForSearch(resolvedLocation ?? ""),
            ...bar.specialties.map((specialty) => normalizeForSearch(specialty)),
            normalizeForSearch(ageLabel ?? ""),
          ],
          normalizedQuery
        ),
      };
    })
    .filter((suggestion) => Number.isFinite(suggestion.rank));

  const rankedClubs: RankedSuggestion[] = selectClubVenues({
    city: "asuncion",
    scope: "all",
  })
    .map((club) => {
      const slug = slugify(club.name);
      const mockClub = mockClubData[slug as keyof typeof mockClubData];
      const ageLabel = mockClub?.ageRestriction;
      const resolvedLocation = locationBySlug?.get(slug);
      const neighborhood = getZoneFromLocation(resolvedLocation);
      const genresLabel = club.genres.join(" · ") || undefined;

      return {
        id: `club-${slug}`,
        title: club.name,
        typeLabel: "Discoteca" as const,
        href: `/club/${slug}`,
        imageSrc: coverBySlug?.get(slug) ?? club.customImage ?? mockClub?.images[0] ?? "/images/bar.jpg",
        metadata: compactMetadata([neighborhood, genresLabel]),
        ageLabel,
        rank: getRank(
          [
            normalizeForSearch(club.name),
            normalizeForSearch(resolvedLocation ?? ""),
            ...club.genres.map((genre) => normalizeForSearch(genre)),
            normalizeForSearch(ageLabel ?? ""),
          ],
          normalizedQuery
        ),
      };
    })
    .filter((suggestion) => Number.isFinite(suggestion.rank));

  return [...rankedBars, ...rankedClubs]
    .sort((left, right) => {
      if (left.rank !== right.rank) {
        return left.rank - right.rank;
      }

      return left.title.localeCompare(right.title, "es", { sensitivity: "base" });
    })
    .slice(0, maxSuggestions)
    .map(({ rank: _rank, ...suggestion }) => suggestion);
}
