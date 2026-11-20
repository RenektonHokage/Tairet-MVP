import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Heart, Maximize, X } from "lucide-react";

import { partyTime } from "./presentation";
import { catalogAge } from "./eventDiscovery";
import { type CatalogParty, type PricePresentation } from "./presentation";
import { verifiedVenuePin } from "./verifiedVenuePins";
import { CatalogGeoCanvas } from "./CatalogGeoCanvas";
import "./catalog-map.css";

export function CatalogMap<T extends CatalogParty>({parties,saved,getPrice,onSelect,onFavorite,filterSummary}:{parties:readonly T[];saved:readonly string[];getPrice:(party:T)=>PricePresentation;onSelect:(party:T)=>void;onFavorite:(id:string)=>void;filterSummary:string}) {
 const [favoritesOnly,setFavoritesOnly]=useState(false),[selectedId,setSelectedId]=useState(""),[expanded,setExpanded]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),opener=useRef<HTMLButtonElement>(null);
 const located=useMemo(()=>parties.flatMap(party=>{const pin=verifiedVenuePin(party);return pin?[{party,pin}]:[];}),[parties]);
 const visible=useMemo(()=>located.filter(row=>!favoritesOnly||saved.includes(row.party.editorialEventId)),[located,favoritesOnly,saved]);
 const selected=visible.find(row=>row.party.editorialEventId===selectedId)??visible[0];
 const points=useMemo(()=>visible.map(({party,pin})=>({id:party.editorialEventId,title:party.title,pin})),[visible]);
 const index=selected?visible.indexOf(selected):-1;
 useEffect(()=>{
  if(!expanded)return;
  const node=dialog.current,trigger=opener.current,overflow=document.documentElement.style.overflow;
  document.documentElement.style.overflow="hidden";node?.showModal();
  return()=>{node?.close();document.documentElement.style.overflow=overflow;trigger?.focus({preventScroll:true});};
 },[expanded]);
 const panel=<div className="hp-map-panel">
  <div className="hp-map-toolbar"><div className="hp-map-tabs" role="group" aria-label="Fiestas en el mapa">
   <button aria-pressed={!favoritesOnly} onClick={()=>setFavoritesOnly(false)}>Todas</button>
   <button aria-pressed={favoritesOnly} onClick={()=>setFavoritesOnly(true)}>Mi Halloween</button>
  </div><div className="hp-map-summary"><span>{filterSummary}</span><small role="status">{visible.length} {visible.length===1?"fiesta en el mapa":"fiestas en el mapa"}</small></div></div>
  {selected?<div className="hp-map-layout">
   <CatalogGeoCanvas points={points} selectedId={selected.party.editorialEventId} onSelect={setSelectedId}/>
   <aside className="hp-map-detail" aria-label="Fiesta seleccionada">
    <div className="hp-map-detail-head"><span>FIESTA SELECCIONADA</span><span>{index+1} / {visible.length}</span>
     <button aria-label="Fiesta anterior" disabled={visible.length<2} onClick={()=>setSelectedId(visible[(index+visible.length-1)%visible.length].party.editorialEventId)}><ArrowLeft size={15}/></button>
     <button aria-label="Fiesta siguiente" disabled={visible.length<2} onClick={()=>setSelectedId(visible[(index+1)%visible.length].party.editorialEventId)}><ArrowRight size={15}/></button>
    </div>
    {selected.party.poster&&<img className="hp-map-poster" src={selected.party.poster.url} alt={selected.party.poster.alt} loading="lazy" referrerPolicy="no-referrer"/>}
    <h3>{selected.party.title}</h3>
    <p className="hp-map-date">{new Intl.DateTimeFormat("es-PY",{timeZone:selected.party.timezone,day:"2-digit",month:"short"}).format(new Date(selected.party.startsAt))} · {partyTime(selected.party.startsAt,selected.party.timezone)}</p>
    <p>{selected.pin.venue} · {selected.party.venue.zone}</p><p>{selected.party.music.join(" / ")}{catalogAge(selected.party)?" · "+catalogAge(selected.party):""}</p>
    <strong className="hp-map-price">{getPrice(selected.party).label}</strong>
    <div className="hp-map-actions"><a href={`#/halloween/fiesta/${selected.party.slug}`} onClick={e=>{if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey){e.preventDefault();setExpanded(false);onSelect(selected.party);}}}>Abrir ficha <ArrowUpRight size={17}/></a>
     <button aria-label={`${saved.includes(selected.party.editorialEventId)?"Quitar de":"Guardar en"} Mi Halloween desde el mapa`} aria-pressed={saved.includes(selected.party.editorialEventId)} onClick={()=>onFavorite(selected.party.editorialEventId)}><Heart size={20} fill={saved.includes(selected.party.editorialEventId)?"currentColor":"none"}/></button>
    </div>
   </aside>
  </div>:<div className="hp-map-empty" role="status"><h3>{favoritesOnly?"No hay favoritas con ubicación para estos filtros.":"No hay ubicaciones confirmadas para estos filtros."}</h3><p>{favoritesOnly?"Guardá una fiesta con el corazón o elegí Todas.":"Las fiestas con ubicación confirmada aparecerán acá."}</p></div>}
  {parties.length>located.length&&<p className="hp-map-footnote">{parties.length-located.length} {parties.length-located.length===1?"fiesta pendiente":"fiestas pendientes"} de ubicación confirmada.</p>}
 </div>;
 return <section className="hp-map-section hp-shell" aria-labelledby="hp-map-title">
  <header className="hp-map-heading"><div><h2 id="hp-map-title">Mapa de las fiestas</h2><p>Las mismas fiestas. Otra forma de elegir.</p></div><button ref={opener} onClick={()=>setExpanded(true)} aria-haspopup="dialog"><Maximize size={16}/>Ampliar mapa</button></header>
  {!expanded&&panel}
  <dialog ref={dialog} className="hp-map-dialog" aria-labelledby="hp-expanded-map-title" onCancel={()=>setExpanded(false)} onClose={()=>setExpanded(false)}>
   <header><h2 id="hp-expanded-map-title">Mapa de las fiestas</h2><button aria-label="Cerrar mapa ampliado" onClick={()=>setExpanded(false)}><X size={21}/></button></header>
   {expanded&&panel}
  </dialog>
 </section>;
}
