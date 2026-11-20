import { useMediaPreferences } from "../prelaunch/consent";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Minus, Plus, RotateCcw } from "lucide-react";
import type { Map, Marker } from "mapbox-gl";
import type { VerifiedVenuePin } from "./verifiedVenuePins";

export interface MapPoint { id:string; title:string; pin:VerifiedVenuePin }
export function CatalogGeoCanvas({points,selectedId,onSelect}:{points:readonly MapPoint[];selectedId?:string;onSelect:(id:string)=>void}) {
 const {external,openPreferences}=useMediaPreferences();
 const available=Boolean(import.meta.env.VITE_MAPBOX_TOKEN);
 const container=useRef<HTMLDivElement>(null),map=useRef<Map|null>(null);
 const markers=useRef<{id:string;marker:Marker;button:HTMLButtonElement}[]>([]);
 const select=useRef(onSelect),currentPoints=useRef(points);
 const [visible,setVisible]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(false);
 const {resolvedTheme}=useTheme();
 select.current=onSelect;currentPoints.current=points;
 const theme=resolvedTheme==="light"?"light":"dark";
 // Public catalog polling may create new objects without changing the map data.
 const pointKey=JSON.stringify(points.map(({id,title,pin})=>[id,title,pin.venue,pin.latitude,pin.longitude]));
 const reset=()=>{
  const target=map.current,items=currentPoints.current;
  if(!target||!items.length)return;
  if(items.length===1)target.jumpTo({center:[items[0].pin.longitude,items[0].pin.latitude],zoom:13.5,bearing:0,pitch:0});
  else target.fitBounds([
   [Math.min(...items.map(p=>p.pin.longitude)),Math.min(...items.map(p=>p.pin.latitude))],
   [Math.max(...items.map(p=>p.pin.longitude)),Math.max(...items.map(p=>p.pin.latitude))],
  ],{padding:70,maxZoom:14,duration:0});
 };
 useEffect(()=>{
  const node=container.current;if(!node)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:"160px"});
  observer.observe(node);return()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  if(!external||!available||!visible||!container.current)return;
  let disposed=false,instance:Map|undefined,resize:ResizeObserver|undefined;
  setReady(false);setError(false);
  Promise.all([import("mapbox-gl"),import("mapbox-gl/dist/mapbox-gl.css")]).then(([module])=>{
   if(disposed||!container.current)return;
   const gl=module.default,first=currentPoints.current[0];if(!first)return;
   instance=new gl.Map({container:container.current,accessToken:import.meta.env.VITE_MAPBOX_TOKEN,
    style:`mapbox://styles/mapbox/${theme}-v11`,center:[first.pin.longitude,first.pin.latitude],zoom:13.5,
    cooperativeGestures:!matchMedia("(pointer:coarse)").matches,attributionControl:true,collectResourceTiming:false});
   map.current=instance;
   instance.on("load",()=>{if(!disposed){setReady(true);setError(false);reset();}});
   instance.on("error",()=>{if(!disposed)setError(true);});
   resize=new ResizeObserver(()=>instance?.resize());resize.observe(container.current);
   // Markers are DOM buttons: keyboard selection is equivalent to clicking a pin.
   markers.current=currentPoints.current.map(point=>{
    const button=document.createElement("button");
    button.type="button";button.className="hp-map-pin";
    button.setAttribute("aria-label",`Seleccionar ${point.title} en ${point.pin.venue}`);
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("width","22");svg.setAttribute("height","22");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.7");svg.setAttribute("aria-hidden","true");
    const shape=document.createElementNS(svg.namespaceURI,"path");shape.setAttribute("d","M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z");
    const center=document.createElementNS(svg.namespaceURI,"circle");center.setAttribute("cx","12");center.setAttribute("cy","10");center.setAttribute("r","2.5");
    svg.append(shape,center);button.appendChild(svg);
    const label=document.createElement("span");label.textContent=point.pin.venue;button.appendChild(label);
    button.addEventListener("click",()=>select.current(point.id));
    return {id:point.id,button,marker:new gl.Marker({element:button}).setLngLat([point.pin.longitude,point.pin.latitude]).addTo(instance!)};
   });
  }).catch(()=>{if(!disposed)setError(true);});
  return()=>{disposed=true;resize?.disconnect();markers.current.forEach(m=>m.marker.remove());markers.current=[];instance?.remove();map.current=null;};
 },[visible,external,available,theme,pointKey]);
 useEffect(()=>{
  markers.current.forEach(item=>item.button.setAttribute("aria-pressed",String(item.id===selectedId)));
 const point=currentPoints.current.find(p=>p.id===selectedId);
  if(ready&&point)map.current?.easeTo({center:[point.pin.longitude,point.pin.latitude],duration:matchMedia("(prefers-reduced-motion:reduce)").matches?0:350});
 },[selectedId,ready,pointKey]);
 const mapReady=external&&available&&ready;
 return <div className="hp-geo-wrap" data-map-ready={mapReady} data-map-error={external&&available&&error}>
  <div ref={container} className="hp-geo-canvas" aria-label="Mapa interactivo de fiestas en Asunción"/>
  <div className="hp-geo-controls" aria-label="Controles del mapa">
   <button type="button" aria-label="Acercar mapa" disabled={!mapReady} onClick={()=>map.current?.zoomIn({duration:0})}><Plus size={18}/></button>
   <button type="button" aria-label="Alejar mapa" disabled={!mapReady} onClick={()=>map.current?.zoomOut({duration:0})}><Minus size={18}/></button>
   <button type="button" aria-label="Restablecer mapa" disabled={!mapReady} onClick={reset}><RotateCcw size={17}/></button>
  </div>
  {!external&&<button className="hp-geo-status" type="button" onClick={openPreferences}>Preferencias de contenido externo</button>}
  {external&&!available&&<p className="hp-geo-status">Cartografía no disponible. Podés consultar cómo llegar en la ficha.</p>}
  {external&&available&&!ready&&!error&&<p className="hp-geo-status" role="status">Cargando mapa…</p>}
  {external&&available&&error&&<p className="hp-geo-status" role="status">No pudimos cargar toda la cartografía. Podés abrir la ficha o consultar cómo llegar.</p>}
 </div>;
}
