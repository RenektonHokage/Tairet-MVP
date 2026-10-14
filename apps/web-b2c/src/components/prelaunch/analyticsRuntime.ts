import { analyticsConfig, GA4_ID, GA4_DISABLE_KEY, GA4_COOKIE_NAMES, type Flow, type Channel, type Placement, type SocialPlacement } from "./analyticsCatalog";
import { createAnalytics, deniedConsent, type TagCommand, type TagTransport } from "./analyticsEngine";
import { getConsentSnapshot, subscribeConsent } from "./consent";

type TagWindow=Window&{dataLayer?:unknown[];gtag?:(...args:TagCommand)=>void;[GA4_DISABLE_KEY]?:boolean};
function browserTransport():TagTransport{
 const win=window as TagWindow;
 return {
  disable(value){win[GA4_DISABLE_KEY]=value;},
  clearCookies(){
   for(const name of GA4_COOKIE_NAMES)document.cookie=name+"=; Max-Age=0; Path=/; SameSite=Lax";
  },
  command(...args){win.gtag?.(...args);},
  load(ready,failed){
   if(win.gtag||document.querySelector('script[src*="googletagmanager.com/gtag/js"]')){failed();return;}
   if(win.dataLayer&&win.dataLayer.length){failed();return;}
   win.dataLayer=win.dataLayer??[];
   // Keep the official gtag Arguments-object queue protocol.
   // eslint-disable-next-line prefer-rest-params
   win.gtag=function(){win.dataLayer!.push(arguments);};
   win.gtag("consent","default",deniedConsent);
   const script=document.createElement("script");
   script.id="tairet-ga4-script";script.async=true;script.referrerPolicy="origin";
   script.src="https://www.googletagmanager.com/gtag/js?id="+GA4_ID;
   let finished=false;
   const timeout=window.setTimeout(()=>{if(!finished){finished=true;script.remove();failed();}},8000);
   script.onload=()=>{if(!finished){finished=true;clearTimeout(timeout);ready();}};
   script.onerror=()=>{if(!finished){finished=true;clearTimeout(timeout);script.remove();failed();}};
   document.head.append(script);
  }
 };
}
let instance:ReturnType<typeof createAnalytics>|undefined;
function hashLocation(){
 const raw=window.location.hash.slice(1)||"/",question=raw.indexOf("?"),fragment=raw.indexOf("#");
 const pathname=raw.slice(0,Math.min(question<0?raw.length:question,fragment<0?raw.length:fragment));
 const search=question<0?"":raw.slice(question,fragment>question?fragment:undefined);
 return {pathname,search};
}
function runtime(){
 if(!instance){
  instance=createAnalytics(analyticsConfig(import.meta.env),window.location.origin,browserTransport());
  const sync=()=>instance!.sync({...hashLocation(),consent:getConsentSnapshot().consent});
  // Capture listeners run before late tag/history listeners; no history/network patching.
  window.addEventListener("hashchange",sync,true);
  window.addEventListener("popstate",sync,true);
  subscribeConsent(sync);
 }
 return instance;
}
export function observeAnalyticsRoute(pathname:string,search:string){
 runtime().sync({pathname,search,consent:getConsentSnapshot().consent});
}
function current(){
 const value=runtime();value.sync({...hashLocation(),consent:getConsentSnapshot().consent});return value;
}
export const analytics={
 convocationOpen:(flow:Flow,placement:Placement)=>current().convocationOpen(flow,placement),
 convocationDraftReady:(flow:Flow)=>current().convocationDraftReady(flow),
 contactChannelClick:(flow:Flow,channel:Channel,placement:Placement)=>current().contactChannelClick(flow,channel,placement),
 socialLinkClick:(placement:SocialPlacement)=>current().socialLinkClick(placement)
};
