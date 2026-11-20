import { useEffect, useRef, type ReactNode, type KeyboardEvent } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, CalendarDays, Clock, MapPin, X } from "lucide-react";
import { partyTime } from "./presentation";
import { PartyPoster } from "./HalloweenCatalog";
import { profileDate, profileDay, profileIntro, profileDescription, type ProfileParty } from "./presentation";
import { ProfileLocation } from "./ProfileLocation";
import "./halloween-post.css";
import "./halloween-ui.css";
import "./request-owner.css";

export function HalloweenProfileFrame({party,priceLabel,priceCaption="Entradas desde",admissionNote,onBack,children}:{party:ProfileParty;priceLabel:string;priceCaption?:string;admissionNote?:string;verifiedAt?:string;onBack:()=>void;children:ReactNode}) {
 const info=useRef<HTMLDialogElement>(null),opener=useRef<HTMLElement|null>(null),overflow=useRef<string|null>(null);
 const intro=profileIntro(party);
 const close=()=>{if(overflow.current!==null){document.documentElement.style.overflow=overflow.current;overflow.current=null;}opener.current?.focus({preventScroll:true});};
 useEffect(()=>()=>{if(overflow.current!==null)document.documentElement.style.overflow=overflow.current;},[]);
 const showInfo=()=>{opener.current=document.activeElement as HTMLElement;overflow.current=document.documentElement.style.overflow;document.documentElement.style.overflow="hidden";info.current?.showModal();info.current?.querySelector<HTMLButtonElement>(".hp-close")?.focus();};
 const keepInfoFocus=(event:KeyboardEvent<HTMLDialogElement>)=>{
  if(event.key!=="Tab")return;
  const buttons=event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
  const first=buttons[0],last=buttons[buttons.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
 };
 return <article className="hp hp-profile hp-profile-refined"><div className="hp-shell">
  <nav className="hp-profile-nav" aria-label="Ficha de fiesta"><button onClick={onBack}><ArrowLeft size={16} aria-hidden="true"/>Volver a las fiestas</button><span>Halloween en {party.venue.city}</span></nav>
  <div className="hp-hero"><PartyPoster party={party} priority/><div className="hp-hero-copy">
   <p className="hp-kicker hp-icon-line"><CalendarDays size={17} aria-hidden="true"/><time dateTime={party.startsAt}>{profileDate(party.startsAt,party.timezone)}</time></p>
   <h1>{party.title}</h1><p className="hp-subtitle">{intro.subtitle}</p>
   <div className="hp-hero-facts"><p className="hp-icon-line"><MapPin size={17} aria-hidden="true"/>{party.venue.name} · {[party.venue.zone,party.venue.city].filter(Boolean).join(", ")}</p><p className="hp-icon-line"><Clock size={17} aria-hidden="true"/>{partyTime(party.startsAt,party.timezone)}{party.endsAt?<> — {partyTime(party.endsAt,party.timezone)} del {new Intl.DateTimeFormat("es-PY",{timeZone:party.timezone,weekday:"long"}).format(new Date(party.endsAt))}</>:" · Apertura"}</p></div>
   {intro.summary&&<p className="hp-muted hp-hero-summary">{intro.summary}</p>}
   <button className="hp-info-trigger" onClick={showInfo} aria-haspopup="dialog"><span>Ver información del evento</span><ArrowRight size={17} aria-hidden="true"/></button>
   <div className="hp-hero-actions"><div><small>{priceCaption}</small><strong>{priceLabel}</strong></div><a className="hp-button" href="#entradas" onClick={event=>{event.preventDefault();document.getElementById("entradas")?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"});}}>Ver entradas de 2026<ArrowDown size={17} aria-hidden="true"/></a></div>
  </div></div>
  {children}
  <ProfileLocation party={party}/>
  <dialog ref={info} className="hp-dialog hp-info-dialog" aria-labelledby="hp-event-info-title" onClose={close} onKeyDown={keepInfoFocus}>
   <div className="hp-dialog-header"><h2 id="hp-event-info-title">Información del evento</h2><p>{party.title}</p><button className="hp-close" type="button" aria-label="Cerrar información del evento" onClick={()=>info.current?.close()}><X size={20} aria-hidden="true"/></button></div>
   <div className="hp-dialog-body"><p className="hp-info-description">{profileDescription(party)}</p>
    <dl className="hp-info-facts"><div><dt>Fecha</dt><dd>{profileDate(party.startsAt,party.timezone)}</dd></div><div><dt>Apertura</dt><dd>{partyTime(party.startsAt,party.timezone)} del {profileDay(party.startsAt,party.timezone)}</dd></div>{party.endsAt&&<div><dt>Cierre</dt><dd>{partyTime(party.endsAt,party.timezone)} del {profileDay(party.endsAt,party.timezone)}</dd></div>}<div><dt>Lugar</dt><dd>{party.venue.name} · {[party.venue.zone,party.venue.city].filter(Boolean).join(", ")}<br/>{party.venue.address}</dd></div>{party.organizer&&<div><dt>Organiza</dt><dd>{party.organizer.displayName}</dd></div>}</dl>
    {admissionNote&&<div className="hp-info-notes"><h3>Antes de ir</h3><p>{admissionNote}</p></div>}
    <button className="hp-button hp-button-secondary hp-info-return" type="button" onClick={()=>info.current?.close()}>Volver al evento</button>
   </div>
  </dialog>
 </div></article>;
}
