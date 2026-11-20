import type { CatalogParty } from "./presentation";
import { displayMetadata } from "./displayMetadata";

export interface VerifiedVenuePin {
 venue:string;
 address:string;
 latitude:number;
 longitude:number;
 sourceUrl:string;
 precision?:"reference"|"owner-venue";
}
// Only Owner-confirmed venue points belong here. No geocoding guesses or mock pins.
const pins: Readonly<Record<string, VerifiedVenuePin>> = {
 "fc2944e4-ccfd-48b4-9b98-d7aed06a9cf9": {
  venue:"Jetlag",
  address:"Gral. Eugenio Alejandrino Garay 333, Asunción",
  latitude:-25.2900869,
  longitude:-57.5832302,
  sourceUrl:"https://www.google.com/maps/place/Gral.+Eugenio+Alejandrino+Garay+333,+Asunci%C3%B3n+001411/@-25.2900869,-57.5832302,1026m/data=!3m2!1e3!4b1!4m6!3m5!1s0x945da89c46f063c1:0x806e9a45a27f1cc4!8m2!3d-25.2900869!4d-57.5832302!16s%2Fg%2F11pv9lwqtt",
 },
};
export function verifiedVenuePin(party:CatalogParty):VerifiedVenuePin|undefined {
 const pin=pins[party.editorialEventId]??displayMetadata(party)?.pin;
 return pin&&pin.venue===party.venue.name&&pin.address===party.venue.address?pin:undefined;
}
