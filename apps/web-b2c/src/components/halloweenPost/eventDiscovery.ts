import { catalogDay, type CatalogParty } from "./presentation";
import { displayMetadata } from "./displayMetadata";

export const eventAges = [18, 21, 23, 25] as const;
export type EventAge = typeof eventAges[number];
export const venueTypes = ["bar", "boliche", "fiesta independiente"] as const;
export type VenueType = typeof venueTypes[number];
export interface DiscoveryMetadata { minimumAge?: EventAge; venueType?: VenueType }
export interface DiscoveryFilters {
 date: string;
 music: string[];
 zones: string[];
 venueTypes: VenueType[];
 ages: EventAge[];
}
export const emptyDiscoveryFilters = (): DiscoveryFilters => ({date:"",music:[],zones:[],venueTypes:[],ages:[]});

// Owner-confirmed UI metadata, 20 October 2026. This does not rewrite B8/F1.
// Unknown events have no age/type until those facts are explicitly confirmed.
export function eventDiscovery(party: Pick<CatalogParty, "editorialEventId" | "slug" | "startsAt" | "minimumAge">): DiscoveryMetadata {
 const approved=displayMetadata(party);if(approved)return {minimumAge:approved.minimumAge,venueType:approved.venueType};
 if (party.editorialEventId === "fc2944e4-ccfd-48b4-9b98-d7aed06a9cf9" &&
     party.slug === "wave-milena-adamis" &&
     Date.parse(party.startsAt) === Date.parse("2026-10-30T23:00:00-03:00")) {
  return { minimumAge:18, venueType:"boliche" };
 }
 return party.minimumAge!==undefined&&eventAges.includes(party.minimumAge)?{minimumAge:party.minimumAge}:{};
}
export function catalogAge(party: Parameters<typeof eventDiscovery>[0]) {
 const age=eventDiscovery(party).minimumAge;
 return age === undefined ? "" : `+${age}`;
}
// OR within a category; AND across categories. Age is an exact event minimum,
// never the visitor's age. Missing data cannot match a selected category.
export function matchesDiscovery(party: CatalogParty, filters: DiscoveryFilters, metadata=eventDiscovery(party)) {
 return (!filters.date || catalogDay(party)===filters.date) &&
  (!filters.music.length || party.music.some(value=>filters.music.includes(value))) &&
  (!filters.zones.length || filters.zones.includes(party.venue.zone)) &&
  (!filters.venueTypes.length || (metadata.venueType!==undefined && filters.venueTypes.includes(metadata.venueType))) &&
  (!filters.ages.length || (metadata.minimumAge!==undefined && filters.ages.includes(metadata.minimumAge)));
}
