import { z } from "zod";
import program from "../../content/halloween-2026.public.json";
import { displayMetadata } from "./displayMetadata";
import type { PricePresentation } from "./presentation";

// The verification timestamp and published program describe this closed, editorial edition.
const text = (max:number) => z.string().trim().min(1).max(max);

const timestamp = z.string().datetime({offset:true});

const id = z.string().uuid();

export const InformationPrice = z.discriminatedUnion("kind", [

 z.object({kind:z.literal("confirmed"),amount:z.number().int().min(1).max(100_000_000),currency:z.enum(["PYG","USD"]).optional()}).strict(),

 z.object({kind:z.literal("free")}).strict(),

 z.object({kind:z.literal("unknown")}).strict(),

]);

export type InformationPrice = z.infer<typeof InformationPrice>;

const Offer = z.object({id:text(60),label:text(80),description:z.string().max(240),price:InformationPrice}).strict();

const Batch = z.object({id:text(60),label:text(80),status:z.enum(["current","upcoming","closed"]),prices:z.array(Offer).min(1).max(12)}).strict();

const Door = z.object({note:text(400),prices:z.array(Offer).min(1).max(12)}).strict();

const common = {note:text(400)};

const Ticketing = z.discriminatedUnion("mode",[

 z.object({mode:z.literal("door"),...common,door:Door}).strict(),

 z.object({mode:z.literal("whatsapp"),...common,batches:z.array(Batch).min(1).max(12).optional(),prices:z.array(Offer).min(1).max(12).optional()}).strict(),

 z.object({mode:z.literal("whatsapp_door"),...common,batches:z.array(Batch).min(1).max(12),door:Door}).strict(),

 z.object({mode:z.literal("external"),...common,provider:text(80),url:z.string().url(),prices:z.array(Offer).min(1).max(12)}).strict(),

 z.object({mode:z.literal("external_door"),...common,provider:text(80),url:z.string().url(),prices:z.array(Offer).min(1).max(12),door:Door}).strict(),

]);

export const PublicEventSchema=z.object({

 id,slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),name:text(100),subtitle:text(180),description:text(1200),

 startsAt:timestamp,endsAt:timestamp,timezone:z.literal("America/Asuncion"),venue:text(120),

 location:z.object({address:text(240),zone:text(80),city:text(80),mapUrl:z.string().url()}).strict(),

 organizer:text(120),poster:z.object({src:z.string().regex(/^\/halloween\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp|svg)$/),alt:text(180)}).strict(),

 music:z.array(text(60)).max(8),admissionNote:text(400),ticketing:Ticketing,

 tables:z.array(z.object({id:text(60),name:text(80),capacity:z.number().int().min(1).max(100).optional(),seatingLabel:text(80).optional(),note:text(180).optional(),availability:z.enum(["available","sold-out"]).optional(),requestStatus:z.literal("pending").optional(),includes:z.array(text(180)).max(12),price:InformationPrice}).strict()).max(20),
 tablesAvailability:z.enum(["available","sold-out"]).optional(),

 verifiedAt:timestamp,contentVersion:z.number().int().positive(),verification:z.enum(["verified","synthetic"]),

}).strict();

export const PublicManifestSchema=z.object({schemaVersion:z.literal(1),campaign:z.literal("halloween-2026"),kind:z.enum(["public","qa"]),

 contentVersion:z.number().int().positive(),generatedAt:timestamp,events:z.array(PublicEventSchema).max(30)}).strict();

export type PublicEvent = z.infer<typeof PublicEventSchema>;
export function informationPrices(e:PublicEvent){

 const t=e.ticketing;

 return "prices" in t&&t.prices?t.prices:"batches" in t&&t.batches?t.batches.find(b=>b.status==="current")?.prices??[]:"door" in t?t.door.prices:[];

}

export function informationPriceLabel(p:InformationPrice,subject="Entrada"){

 return p.kind==="confirmed"?(p.currency==="USD"?"USD ":"₲ ")+new Intl.NumberFormat("es-PY").format(p.amount):p.kind==="free"?(subject==="Entrada"?"Entrada gratuita":"Mesa gratuita"):"Precio a confirmar";

}

export function informationSummary(party:ArchivedParty):PricePresentation {

 const rows=informationPrices(party.information);

 if(!rows.length || rows.some(r=>r.price.kind==="unknown"))return {label:"Precio a confirmar",amount:null};

 const amount=Math.min(...rows.map(r=>r.price.kind==="confirmed"?r.price.amount:0));

 return {label:amount===0?"Entrada gratuita":"Desde ₲ "+new Intl.NumberFormat("es-PY").format(amount),amount};

}

export function toArchiveParty(e:PublicEvent) {
 const metadata=displayMetadata(e);

 const description=e.id==="fc2944e4-ccfd-48b4-9b98-d7aed06a9cf9"&&metadata?.zone==="Villa Morra"?e.description.replace("Jetlag, Carmelitas, Asunción","Jetlag, Villa Morra, Asunción"):e.description;
 return {editorialEventId:e.id,slug:e.slug,title:e.name,subtitle:e.subtitle,description,startsAt:e.startsAt,endsAt:e.endsAt,timezone:e.timezone,

  venue:{name:e.venue,...e.location,zone:metadata?.zone??e.location.zone??"",directionsUrl:e.location.mapUrl},organizer:e.organizer?{displayName:e.organizer}:undefined,poster:{url:e.poster.src,alt:e.poster.alt},music:e.music,information:e,...(metadata?{minimumAge:metadata.minimumAge}:{})};

}

export type ArchivedParty = ReturnType<typeof toArchiveParty>;
const published = PublicManifestSchema.parse(program);
export const archivedParties = published.kind === "public"
  ? published.events.filter(event => event.verification === "verified").map(toArchiveParty)
  : [];
