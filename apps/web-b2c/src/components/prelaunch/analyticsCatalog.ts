import { matchPath } from "react-router-dom";
import { prelaunchPage } from "./routes";

export const GA4_ID="G-L5DRMC7Z1F";
export const GA4_DISABLE_KEY=`ga-disable-${GA4_ID}` as const;
export const GA4_COOKIE_PREFIX="tairet_b3";
export const GA4_COOKIE_NAMES=[GA4_COOKIE_PREFIX+"_ga",GA4_COOKIE_PREFIX+"_ga_"+GA4_ID.slice(2)] as const;
const pages={
 home:{path:"/inicio",title:"Inicio — TAIRET"},
 asuncion:{path:"/asuncion",title:"Asunción — TAIRET"},
 halloween:{path:"/halloween",title:"Halloween 2026 — TAIRET"},
 informacion:{path:"/informacion",title:"Información — TAIRET"},
 about:{path:"/sobre/que-es-tairet",title:"Qué es TAIRET"},
 how:{path:"/sobre/como-funciona",title:"Cómo funciona TAIRET"},
 faq:{path:"/sobre/preguntas-frecuentes",title:"Preguntas frecuentes — TAIRET"},
 venues:{path:"/para-locales/publica-tu-local",title:"Sumar un local — TAIRET"},
 "venue-bar":{path:"/para-locales/bares",title:"Para bares — TAIRET"},
 "venue-club":{path:"/para-locales/discotecas",title:"Para discotecas — TAIRET"},
 organizers:{path:"/para-locales/organizadores",title:"Para organizadores — TAIRET"},
 lead:{path:"/para-locales/solicitud",title:"Convocatoria de locales — TAIRET"},
 contact:{path:"/contacto",title:"Contacto — TAIRET"},
 terms:{path:"/legal/terminos-condiciones",title:"Términos y condiciones — TAIRET"},
 privacy:{path:"/legal/politica-privacidad",title:"Privacidad — TAIRET"},
 cookies:{path:"/legal/cookies",title:"Cookies — TAIRET"},
 mapa:{path:"/mapa",title:"Mapa en prelanzamiento — TAIRET"}
} as const;
export type PageKey=keyof typeof pages;
export type PublicPage={key:PageKey;path:string;title:string};
const allowedPaths=[
 "/","/inicio","/asuncion","/zona/asuncion","/halloween","/eventos",
 "/informacion","/sobre/que-es-tairet","/sobre/como-funciona","/sobre/preguntas-frecuentes",
 "/para-locales/publica-tu-local","/para-locales/bares","/para-locales/discotecas","/para-locales/organizadores","/para-locales/solicitud",
 "/contacto","/legal/terminos-condiciones","/legal/politica-privacidad","/legal/cookies","/mapa"
] as const;
export function analyticsPage(pathname:string):PublicPage|null{
 if(!allowedPaths.some(pattern=>matchPath({path:pattern,end:true},pathname)))return null;
 const key=prelaunchPage(pathname);
 return key&&Object.hasOwn(pages,key)?{key:key as PageKey,...pages[key as PageKey]}:null;
}
export const campaignCatalog={
 utm_source:["instagram","facebook","whatsapp","tairet","qr"],
 utm_medium:["social","referral","offline"],
 utm_campaign:["halloween_2026_pre","tairet_prelaunch"],
 utm_content:["bio","story_01","post_01","qr_local_01"]
} as const;
export type Campaign={campaign_source:string;campaign_medium:string;campaign_name:string;campaign_content:string};
export function safeCampaign(search:string):Campaign{
 const query=new URLSearchParams(search);
 const code=(key:keyof typeof campaignCatalog)=>{
  const values=query.getAll(key),value=values.length===1?values[0]:"";
  return (campaignCatalog[key] as readonly string[]).includes(value)?value:"unattributed";
 };
 return {campaign_source:code("utm_source"),campaign_medium:code("utm_medium"),campaign_name:code("utm_campaign"),campaign_content:code("utm_content")};
}
export type AnalyticsConfig={enabled:boolean;remoteApproved:boolean;allowedOrigins:readonly string[]};
export function analyticsConfig(env:Record<string,unknown>):AnalyticsConfig{
 const raw=typeof env.VITE_GA4_ALLOWED_ORIGINS==="string"?env.VITE_GA4_ALLOWED_ORIGINS:"";
 const allowedOrigins=raw.split(",").map(x=>x.trim()).filter(value=>{
  try{const url=new URL(value);return ["http:","https:"].includes(url.protocol)&&!url.username&&!url.password&&url.origin===value;}catch{return false;}
 });
 return {enabled:env.VITE_GA4_ENABLED==="true",remoteApproved:env.VITE_GA4_REMOTE_CONFIGURATION_APPROVED==="true",allowedOrigins};
}
export const flows=["local","halloween_event","general"] as const;
export const channels=["whatsapp","email"] as const;
export const placements=["local_form","local_review","asuncion_owner","halloween_hero","halloween_intro","halloween_review","contact_page","information_page","footer"] as const;
export type Flow=typeof flows[number];
export type Channel=typeof channels[number];
export type Placement=typeof placements[number];

export const socialPlacements=["halloween_hero","footer","asuncion_intro"] as const;
export type SocialPlacement=typeof socialPlacements[number];
