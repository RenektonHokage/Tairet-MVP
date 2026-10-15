import { matchPath } from "react-router-dom";
export const prelaunchPages: Record<string,string> = {
 "/":"home","/inicio":"home","/asuncion":"asuncion","/zona/asuncion":"asuncion",
 "/halloween":"halloween","/eventos":"halloween","/informacion":"informacion",
 "/sobre/que-es-tairet":"about","/sobre/como-funciona":"how","/sobre/preguntas-frecuentes":"faq",
 "/para-locales/publica-tu-local":"venues","/para-locales/bares":"venue-bar","/para-locales/discotecas":"venue-club",
 "/para-locales/organizadores":"organizers","/para-locales/solicitud":"lead","/contacto":"contact",
 "/legal/terminos-condiciones":"terms","/legal/politica-privacidad":"privacy","/legal/cookies":"cookies","/mapa":"mapa",
 "/zona/san-bernardino":"coming","/zona/ciudad-del-este":"coming","/explorar":"coming","/zonas":"coming",
 "/experiencias/rooftop":"coming","/experiencias/after-office":"coming","/experiencias/promociones":"coming",
 "/discotecas":"coming","/bares":"coming","/reseñas":"coming"
};
export function prelaunchPage(path: string) {
 // Match the installed router without changing the caller's URL, identifiers or query.
 const pathname=path.split(/[?#]/,1)[0];
 const page=Object.entries(prelaunchPages).find(([pattern])=>matchPath({path:pattern,end:true},pathname))?.[1];
 return page ?? (matchPath("/evento/:slug",pathname)?"halloween":matchPath("/club/:slug",pathname)||matchPath("/bar/:slug",pathname)?"coming":undefined);
}
export const isPrelaunchPath=(path: string)=>prelaunchPage(path)!==undefined;
const informationPages=new Set(["informacion","about","how","faq","venues","venue-bar","venue-club","organizers","lead","contact","terms","privacy","cookies"]);
export function prelaunchNav(page: string) {
 if(["home","asuncion","mapa","halloween"].includes(page))return page;
 return informationPages.has(page)?"informacion":undefined;
}
