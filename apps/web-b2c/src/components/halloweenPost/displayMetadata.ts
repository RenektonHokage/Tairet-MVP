import approved from "../../content/halloween-display-metadata.json";
import type { VenueType, EventAge } from "./eventDiscovery";
type DisplayMetadata={startsAt:string;zone:string;venueType:VenueType;minimumAge:EventAge;pin?:{venue:string;address:string;latitude:number;longitude:number;sourceUrl:string;precision:"reference"|"owner-venue"}};
export function displayMetadata(party:{slug:string;startsAt:string}):DisplayMetadata|undefined {
 const row=(approved as Record<string,DisplayMetadata>)[party.slug];
 return row&&Date.parse(row.startsAt)===Date.parse(party.startsAt)?row:undefined;
}
