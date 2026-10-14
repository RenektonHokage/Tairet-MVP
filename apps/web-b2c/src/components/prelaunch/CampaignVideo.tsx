import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaPreferences } from "./consent";
import { videoSource } from "./media";
type Connection=EventTarget&{saveData?:boolean};
export default function CampaignVideo(){
 const ref=useRef<HTMLVideoElement>(null),{external,openPreferences}=useMediaPreferences();
 const intent=useRef<"auto"|"play"|"pause">("auto"),updateRef=useRef<()=>void>(()=>{});
 const [host,setHost]=useState<HTMLElement|null>(null),[playing,setPlaying]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{
  const video=ref.current;if(!video)return;
  const hero=video.closest<HTMLElement>(".hw16-hero");if(!hero)return;setHost(hero);
  const motion=matchMedia("(prefers-reduced-motion: reduce)"),mobile=matchMedia("(max-width:860px)");
  const connection=(navigator as Navigator&{connection?:Connection}).connection;
  let visible=false,cancelled=false;
  const paint=()=>{if(cancelled)return;const live=!video.paused&&!video.ended;setPlaying(live);hero.dataset.mediaPlaying=String(live);};
  const clear=()=>{video.pause();video.removeAttribute("src");video.load();hero.dataset.mediaFrame="false";hero.dataset.fixedVideoReady="false";setPlaying(false);};
  const update=()=>{
   if(cancelled)return;
   hero.dataset.manualVideo=String(intent.current==="play");
   if(!external){clear();return;}
   const shouldPlay=visible&&!document.hidden&&intent.current!=="pause"&&(intent.current==="play"||(!motion.matches&&!connection?.saveData));
   if(!shouldPlay){video.pause();return;}
   const src=videoSource(mobile.matches?860:861);
   if(video.getAttribute("src")!==src){video.src=src;video.load();}
   video.play().catch(()=>{if(!cancelled){setPlaying(false);setFailed(true);hero.dataset.mediaFrame="false";}});
  };
  updateRef.current=update;
  const onPlaying=()=>{if(cancelled)return;setFailed(false);hero.dataset.mediaFrame="true";hero.dataset.fixedVideoReady="true";paint();};
  const onError=()=>{setFailed(true);hero.dataset.mediaFrame="false";hero.dataset.fixedVideoReady="false";paint();};
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting===true&&entries[0].intersectionRatio>.08;update();},{threshold:[0,.08,.3]});
  observer.observe(hero);document.addEventListener("visibilitychange",update);motion.addEventListener("change",update);mobile.addEventListener("change",update);connection?.addEventListener("change",update);
  video.addEventListener("playing",onPlaying);video.addEventListener("pause",paint);video.addEventListener("error",onError);
  if(!external)clear();
  return()=>{cancelled=true;updateRef.current=()=>{};observer.disconnect();document.removeEventListener("visibilitychange",update);motion.removeEventListener("change",update);mobile.removeEventListener("change",update);connection?.removeEventListener("change",update);video.removeEventListener("playing",onPlaying);video.removeEventListener("pause",paint);video.removeEventListener("error",onError);video.pause();video.removeAttribute("src");video.load();};
 },[external]);
 return <><video ref={ref} className="fixed-hero-video" muted loop playsInline preload="none" aria-hidden="true"/>
 {host?createPortal(<button type="button" className="tu-video-control" aria-label={playing?"Pausar video de fondo":"Reproducir video de fondo"} onClick={()=>{intent.current=playing?"pause":"play";setFailed(false);if(!external)openPreferences();else updateRef.current();}}>
 <svg viewBox="0 0 24 24" aria-hidden="true"><path d={playing?"M8 5v14M16 5v14":"m9 5 10 7-10 7z"}/></svg></button>,host):null}
 {failed?<span className="sr-only" role="status">El video no está disponible. Se conserva la portada.</span>:null}</>;
}

