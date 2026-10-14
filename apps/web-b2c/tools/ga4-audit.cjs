const allowedPaths=new Set(["/","/inicio","/asuncion","/zona/asuncion","/halloween","/eventos","/informacion","/sobre/que-es-tairet","/sobre/como-funciona","/sobre/preguntas-frecuentes","/para-locales/publica-tu-local","/para-locales/bares","/para-locales/discotecas","/para-locales/organizadores","/para-locales/solicitud","/contacto","/legal/terminos-condiciones","/legal/politica-privacidad","/legal/cookies","/mapa"]);
const canonical=raw=>{const p=raw.replace(/^#/,"").split(/[?#]/)[0].replace(/\/+$/,"").toLowerCase();return p||"/";};
const isPublic=raw=>allowedPaths.has(canonical(raw));
function decode(value){let text=String(value);for(let i=0;i<3;i++)try{const next=decodeURIComponent(text);if(next===text)break;text=next;}catch{break;}return text;}
function personal(value){const s=decode(value);return /QA_PRIVATE|qa\.private|595991000111|QA_ACCESS|QA_ORDER|QA_REF|QA_AD_ID|wa\.me\/|instagram\.com\/tairetpy|mailto:|Hola, vengo de la web de TAIRET/i.test(s);}
function payloads(url,body){
 if(body?.trim().startsWith("{")){const x=JSON.parse(body);return[{event:x.name,params:x.params}];}
 const common=Object.fromEntries(new URL(url).searchParams),rows=body?body.split("\n"):[""];
 return rows.filter((x,i)=>x||i===0).map(row=>{const p={...common,...Object.fromEntries(new URLSearchParams(row))};return{event:p.en||"(protocol)",params:p};});
}
function auditRequest(record){
 const violations=[];
 if(record.kind==="tag"&&(!record.choice?.analytics||!record.technicalEnabled))violations.push({type:"preconsent-load",record:record.index});
 if(record.kind!=="collect")return violations;
 if(!record.choice?.analytics)violations.push({type:"without-consent",record:record.index});
 if(!isPublic(record.route))violations.push({type:"operational-send",record:record.index});
 if(personal(record.url)||personal(record.body))violations.push({type:"personal-parameter",record:record.index});
 for(const payload of record.payloads||[]){
  if(payload.event==="halloween_notice_click")violations.push({type:"retired-notice-event",record:record.index});
  for(const [key,value] of Object.entries(payload.params||{})){
   if(personal(value)||/^(?:ep\.)?(?:email|phone|name|user_id|user_data|link_url|form_destination)$/i.test(key))violations.push({type:"personal-parameter",record:record.index,key});
   if(["page_location","dl"].includes(key)&&(!String(value).includes("/#/")||!isPublic(String(value).split("#")[1]||"")||/[?]/.test(String(value).split("#")[1]||"")))violations.push({type:"unsafe-page-location",record:record.index});
  }
 }
 return violations;
}
module.exports={isPublic,personal,payloads,auditRequest};
