import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useNavigationType } from "react-router-dom";
import { useTheme } from "next-themes";
import { approvedPages } from "./pageComponents";
import { ApprovedHeader, ApprovedFooter, ApprovedDock, ApprovedConsentBanner, Dialog_r4_cookie_dialog, Dialog_tu_search_notice, Dialog_night_soon_dialog } from "./ApprovedViews";
import { MediaPreferences, useConsentState, chooseConsent } from "./consent";
import { analytics } from "./analyticsRuntime";
import { socialPlacements, type SocialPlacement } from "./analyticsCatalog";
import { prelaunchPage, prelaunchNav } from "./routes";
import { setupVisualEffects } from "./visualEffects";
import { setupConvocations } from "./convocations";
import "./approved-shell.css";
import "./approved-asuncion.css";
import "./approved-halloween.css";
import "./prelaunch.css";
const positions=new Map<string,number>();
const FONT_URL="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700;800&family=Rye&display=swap";
export default function PrelaunchLayout(){
 const root=useRef<HTMLDivElement>(null),location=useLocation(),navigate=useNavigate(),navigationType=useNavigationType();
 const page=prelaunchPage(location.pathname)??"coming",Page=approvedPages[page as keyof typeof approvedPages];
 const {resolvedTheme,setTheme}=useTheme(),theme=resolvedTheme==="light"?"light":"dark";
 const {consent,persisted}=useConsentState();
 const [dialogVersion,setDialogVersion]=useState(0);
 const inlineConvocationPage=useRef<string|null>(null);
 const previousOverflow=useRef<string|null>(null),opener=useRef<HTMLElement|null>(null);
 const closeDialogs=useCallback(()=>{
  root.current?.querySelectorAll<HTMLDialogElement>("dialog[open]").forEach(d=>d.close());
  if(previousOverflow.current!==null){document.documentElement.style.overflow=previousOverflow.current;previousOverflow.current=null;}
 },[]);
 const openDialog=useCallback((id:string)=>{
  const d=root.current?.querySelector<HTMLDialogElement>("#"+id);if(!d)return;
  opener.current=document.activeElement as HTMLElement;closeDialogs();
  previousOverflow.current=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden";
  d.showModal();setDialogVersion(v=>v+1);
  if(id==="party-form-dialog")analytics.convocationOpen("halloween_event",opener.current?.closest(".launch-intro")?"halloween_intro":"halloween_hero");
  if(id==="owner-dialog")analytics.convocationOpen("local","asuncion_owner");
 },[closeDialogs]);
 const openPreferences=useCallback(()=>openDialog("r4-cookie-dialog"),[openDialog]);
 const save=useCallback((external:boolean,analyticsPermission:boolean)=>{
  chooseConsent(external,analyticsPermission);closeDialogs();
 },[closeDialogs]);
 useEffect(()=>{
  if(page==="lead"&&inlineConvocationPage.current!=="lead")analytics.convocationOpen("local","local_form");
  inlineConvocationPage.current=page;
 },[page]);
 useEffect(()=>{
  const link=document.createElement("link");link.rel="stylesheet";link.href=FONT_URL;link.dataset.prelaunchFonts="true";document.head.append(link);
  return()=>{link.remove();closeDialogs();};
 },[]);
 useLayoutEffect(()=>{
  const key=location.key;
  const restore=()=>{const section=new URLSearchParams(location.search).get("seccion");const target=section?root.current?.querySelector<HTMLElement>("#tf-"+page+"-"+CSS.escape(section)):null;if(target&&!positions.has(key)){target.scrollIntoView();target.focus({preventScroll:true});}else window.scrollTo({top:navigationType==="POP"?(positions.get(key)??0):0,behavior:"instant"});};
  restore();const frame=requestAnimationFrame(restore);
  const track=()=>positions.set(key,window.scrollY);
  window.addEventListener("scroll",track,{passive:true});
  return()=>{cancelAnimationFrame(frame);window.removeEventListener("scroll",track);};
 },[location.key,navigationType,location.search,page]);
 useEffect(()=>{
  const el=root.current;if(!el)return;
  el.querySelectorAll<HTMLElement>(".tu-document").forEach(n=>n.dataset.theme=theme);
  const toggle=el.querySelector<HTMLButtonElement>("[data-theme-toggle]");
  if(toggle){toggle.setAttribute("aria-label",theme==="dark"?"Activar modo claro":"Activar modo oscuro");toggle.setAttribute("aria-pressed",String(theme==="light"));}
  const sun=el.querySelector<SVGElement>("[data-sun]"),moon=el.querySelector<SVGElement>("[data-moon]");
  if(sun)sun.style.display=theme==="dark"?"":"none";if(moon){moon.removeAttribute("hidden");moon.style.display=theme==="light"?"":"none";}
  el.querySelectorAll("#tairet-footer a[aria-current]").forEach(a=>a.removeAttribute("aria-current"));
  const input=el.querySelector<HTMLInputElement>("[data-search-input]");if(input)input.placeholder=page==="halloween"?(innerWidth<=560?"Buscar fiesta…":"Buscar fiesta, música o zona…"):(innerWidth<=560?"Buscar…":"Buscar por zona, local o música…");
  const check=el.querySelector<HTMLInputElement>("#r4-external-toggle");if(check)check.checked=consent?.external===true;
  const analyticsCheck=el.querySelector<HTMLInputElement>("#r4-analytics-toggle");if(analyticsCheck)analyticsCheck.checked=consent?.analytics===true;
  el.querySelectorAll<HTMLElement>("[data-r4-consent-status],#r4-cookie-status").forEach(status=>{status.textContent=consent?"Contenido externo: "+(consent.external?"permitido":"bloqueado")+". Analítica: "+(consent.analytics?"permitida":"bloqueada")+". Publicidad desactivada.":"Todavía no elegiste una preferencia.";});
  const banner=el.querySelector<HTMLElement>("#r4-cookie-banner");if(banner)banner.hidden=consent!==null;
 },[theme,consent,page,dialogVersion]);
 useEffect(()=>{
  const el=root.current;if(!el)return;
  closeDialogs();
  document.title=({home:"Inicio",asuncion:"Asunción",halloween:"Halloween 2026",coming:"Próximamente"}[page]??el.querySelector("h1")?.textContent??"Información")+" — TAIRET";
  el.querySelectorAll<HTMLElement>("[data-nav]").forEach(n=>{const current=prelaunchNav(page);if(n.dataset.nav===current)n.setAttribute("aria-current","page");else n.removeAttribute("aria-current");});
  const cleanupForms=setupConvocations(el,location.search),cleanupVisual=setupVisualEffects(el,page);let category="all";
  const filterFaq=()=>{
   const query=(el.querySelector<HTMLInputElement>("#tf-faq-search")?.value??"").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");let count=0;
   el.querySelectorAll<HTMLDetailsElement>("[data-tf-faq]").forEach(n=>{const text=(n.textContent??"").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");n.hidden=!((category==="all"||n.dataset.faqCategory===category)&&text.includes(query));if(!n.hidden)count++;else n.open=false;});
   el.querySelectorAll("[data-tf-faq-filter]").forEach(n=>n.setAttribute("aria-pressed",String((n as HTMLElement).dataset.tfFaqFilter===category)));
   const output=el.querySelector("#tf-faq-count");if(output)output.textContent=count+" preguntas";const empty=el.querySelector<HTMLElement>("#tf-faq-empty");if(empty)empty.hidden=count>0;
  };
  const click=(event:MouseEvent)=>{
   if(event.target instanceof HTMLDialogElement){const box=event.target.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDialogs();}
   const summary=(event.target as Element).closest(".tf-footer-group summary");if(summary&&!matchMedia("(max-width:760px)").matches){event.preventDefault();return;}
   const target=(event.target as Element).closest<HTMLElement>("button,a");if(!target)return;
   if(target.hasAttribute("data-tu-join")){event.preventDefault();navigate("/para-locales/solicitud");}
   if(target.hasAttribute("data-open-owner"))openDialog("owner-dialog");
   if(target.hasAttribute("data-open-party"))openDialog("party-form-dialog");
   if(target.hasAttribute("data-theme-toggle"))setTheme(theme==="dark"?"light":"dark");
   if(target.hasAttribute("data-r4-preferences"))openPreferences();
   if(target.hasAttribute("data-r4-cookie-accept"))save(true,true);
   if(target.hasAttribute("data-r4-cookie-reject"))save(false,false);
   if(target.hasAttribute("data-r4-cookie-save"))save(el.querySelector<HTMLInputElement>("#r4-external-toggle")?.checked===true,el.querySelector<HTMLInputElement>("#r4-analytics-toggle")?.checked===true);
   if(target.matches("[data-close-dialog],[data-tu-close-search],[data-night-soon-close],[data-r4-cookie-close],.party-close"))closeDialogs();
   if(target.hasAttribute("data-tf-return")){event.preventDefault();if(location.key!=="default")navigate(-1);else navigate("/");}
   if(target.hasAttribute("data-coming-soon")){event.preventDefault();const image=target.querySelector("img"),photo=el.querySelector<HTMLImageElement>("#night-soon-photo");if(image&&photo){photo.src=image.src;photo.alt=image.alt;}const label=el.querySelector("#night-soon-category");if(label)label.textContent=target.dataset.comingSoon==="bares"?"Bares":"Discotecas";openDialog("night-soon-dialog");}
   if(target.hasAttribute("data-tf-top"))window.scrollTo({top:0,behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"});
   if(target.dataset.tfFaqFilter){category=target.dataset.tfFaqFilter;filterFaq();}
   if(target.hasAttribute("data-tf-faq-clear")){category="all";const input=el.querySelector<HTMLInputElement>("#tf-faq-search");if(input)input.value="";filterFaq();}
   if(target.matches("a")&&target.hasAttribute("href")&&target.getAttribute("aria-disabled")!=="true"){
    if(target.getAttribute("href")==="https://www.instagram.com/tairetpy/"&&socialPlacements.includes(target.dataset.socialPlacement as SocialPlacement))analytics.socialLinkClick(target.dataset.socialPlacement as SocialPlacement);
    else if(target.id==="tf-lead-whatsapp")analytics.contactChannelClick("local","whatsapp","local_review");
    else if(target.id==="tf-lead-email")analytics.contactChannelClick("local","email","local_review");
    else if(target.id==="party-whatsapp-link")analytics.contactChannelClick("halloween_event","whatsapp","halloween_review");
    else if(target.id==="owner-whatsapp")analytics.contactChannelClick("local","whatsapp","asuncion_owner");
    else if(target.dataset.contactChannel==="whatsapp"||target.dataset.contactChannel==="email"){
     analytics.contactChannelClick(target.closest("#owner-dialog")?"local":"general",target.dataset.contactChannel,target.closest("#owner-dialog")?"asuncion_owner":target.closest("#tairet-footer")?"footer":target.closest('[data-page="contact"]')?"contact_page":"information_page");
    }
   }
   if(target.getAttribute("aria-disabled")==="true")event.preventDefault();
   if(target.getAttribute("href")==="#"){event.preventDefault();}
  };
  const input=(event:Event)=>{if((event.target as HTMLElement).id==="tf-faq-search")filterFaq();};
  const submit=(event:Event)=>{if((event.target as HTMLFormElement).classList.contains("catalog-search")){event.preventDefault();openDialog("tu-search-notice");}};
  const onCancel=(event:Event)=>{event.preventDefault();closeDialogs();};
  const header=el.querySelector<HTMLElement>("header.header");
  const onScroll=()=>{header?.classList.toggle("is-scroll-locked",window.scrollY>48);};
  const onClose=()=>{if(!el.querySelector("dialog[open]")&&previousOverflow.current!==null){document.documentElement.style.overflow=previousOverflow.current;previousOverflow.current=null;opener.current?.focus({preventScroll:true});}};
  el.addEventListener("click",click);el.addEventListener("input",input);el.addEventListener("submit",submit);el.addEventListener("close",onClose,true);el.addEventListener("cancel",onCancel,true);window.addEventListener("scroll",onScroll,{passive:true});window.addEventListener("resize",onScroll);
  const media=matchMedia("(max-width:760px)"),footer=()=>el.querySelectorAll<HTMLDetailsElement>(".tf-footer-group").forEach(d=>{d.open=!media.matches;const s=d.querySelector("summary");if(s){s.tabIndex=media.matches?0:-1;if(media.matches)s.removeAttribute("aria-disabled");else s.setAttribute("aria-disabled","true");}});footer();media.addEventListener("change",footer);onScroll();filterFaq();
  const section=new URLSearchParams(location.search).get("seccion");
  if(section){const target=el.querySelector<HTMLElement>("#tf-"+page+"-"+CSS.escape(section));target?.scrollIntoView();target?.focus({preventScroll:true});}
  return()=>{cleanupForms();cleanupVisual();el.removeEventListener("click",click);el.removeEventListener("input",input);el.removeEventListener("submit",submit);el.removeEventListener("close",onClose,true);el.removeEventListener("cancel",onCancel,true);window.removeEventListener("scroll",onScroll);window.removeEventListener("resize",onScroll);media.removeEventListener("change",footer);closeDialogs();};
 },[page,location.key,location.search,theme,navigate,openDialog,openPreferences,save,setTheme,closeDialogs]);
 return <MediaPreferences.Provider value={{external:consent?.external===true,openPreferences}}>
 <div ref={root} className="prelaunch" data-concept="cinema" data-route={page} data-theme={theme} data-reference="rojo" data-tf-page={!["home","asuncion","halloween"].includes(page)}>
 <a className="skip" href="#main" onClick={e=>{e.preventDefault();root.current?.querySelector<HTMLElement>("#main")?.focus();}}>Saltar al contenido</a>
 <ApprovedHeader/>
 <main id="main" tabIndex={-1} key={location.pathname}>
 {Page?<div className={"pl-"+page}><Page/></div>:<section className="tf-page r4"><div className="tf-wrap"><h1>Próximamente en TAIRET</h1><p>Estamos preparando la exploración de bares, discotecas y eventos. TAIRET está en prelanzamiento.</p><Link className="tf-btn" to="/asuncion">Conocé Asunción</Link><Link className="tf-btn secondary" to="/halloween">Halloween 2026</Link></div></section>}
 </main>
 <ApprovedFooter/><ApprovedDock/>
 <ApprovedConsentBanner/><Dialog_r4_cookie_dialog/><Dialog_tu_search_notice/><Dialog_night_soon_dialog/>
 {!persisted?<p className="pl-storage-notice" role="status">La preferencia se aplica en esta visita; el navegador no permitió guardarla.</p>:null}
 </div></MediaPreferences.Provider>;
}

