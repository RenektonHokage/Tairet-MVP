import type { ArchivedParty } from "./archive";

export type CatalogParty = ArchivedParty;
export type ProfileParty = ArchivedParty;

export const partyTime = (value: string, timezone: string) => new Intl.DateTimeFormat("es-PY", {
  timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false,
}).format(new Date(value));
export interface PricePresentation { label: string; amount: number | null }
// Public copy only: preserve the exact B8 snapshots and request bindings.
const eventDescriptions:Record<string,string>={
 "wave-milena-adamis":"WAVE – MILENA ADAMIS: una noche de techno de ON BEAT en Jetlag, Asunción.",
 "halloween-offsite-tao":"Viví Halloween Offsite TAO en el Centro de Convenciones Mariscal.",
 "halloween-zazil-nightmare-cinema":"Nightmare Cinema: Halloween con Zazil en el Complejo Barrail Costanera.",
 "vertigo-halloween":"Viví Halloween en Vértigo con una noche de reggaetón, disfraces y fiesta en Asunción.",
 "hapore-four-lokoween":"Four Lokoween: una noche de Halloween con Hapore en Austria 1783.",
 "par-normal-the-abandoned-factory":"The Abandoned Factory: Halloween con Anormal en Estero Bellaco 302.",
 "terraza-dlirio-halloween-2026":"Celebrá Halloween y el cuarto aniversario de Terraza D’Lirio, con concurso de disfraces y sonido Funktion-One.",
 "saoko-halloween-vol-2":"Halloween Vol. 2: una noche de fiesta con Saoko en Lux Club.",
};
export function profileDescription(party:ProfileParty){return eventDescriptions[party.slug]??party.description;}
export function catalogDay(party: CatalogParty) {
 const parts = new Intl.DateTimeFormat("en-CA", { timeZone: party.timezone, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(new Date(party.startsAt));
 return ["year","month","day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}

// Display-only projections. The canonical B8/F1 payload is never rewritten.
export function profileIntro(party: ProfileParty) {
 const prefix = party.organizer?.displayName ? party.organizer.displayName + " · " : "";
 const subtitle = prefix&&party.subtitle.startsWith(prefix) ? party.subtitle.slice(prefix.length) : party.subtitle;
 return {
  subtitle: subtitle.charAt(0).toLocaleUpperCase("es") + subtitle.slice(1),
  summary: party.organizer?.displayName ? `Una noche organizada por ${party.organizer.displayName}.` : "",
 };
}
export function profileDate(value: string, timezone: string) {
 return new Intl.DateTimeFormat("es-PY", {timeZone:timezone,weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(value));
}
export function profileDay(value: string, timezone: string) {
 return new Intl.DateTimeFormat("es-PY", {timeZone:timezone,weekday:"long",day:"numeric",month:"long"}).format(new Date(value));
}
export function externalBatchLabel(rows: readonly {description:string}[]) {
 const labels = rows.map(row => /^(Lote\s+\d+)\s*·/i.exec(row.description)?.[1] ?? "");
 return labels.length && labels.every(label => label && label === labels[0]) ? labels[0] : "";
}
export function externalOfferDescription(description: string, provider: string, batch: string) {
 const note = batch && description.startsWith(batch + " · ") ? description.slice(batch.length + 3) : description;
 return note === `Precio informado. Consultá las condiciones vigentes en ${provider}.` || note === "Precio informado para esta modalidad." ? "" : note;
}
export function tablePeopleLabel(capacity: number | undefined, includes: readonly string[]) {
 if (capacity === undefined) return "";
 const included = includes.some(line => /^(?:Diez|10) entradas para (?:diez|10) personas$/i.test(line));
 return included && capacity === 10 ? "10 personas incluidas" : `Hasta ${capacity}`;
}

