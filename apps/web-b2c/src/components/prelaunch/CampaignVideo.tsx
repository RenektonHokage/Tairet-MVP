import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaPreferences } from "./consent";
import { videoSource } from "./media";
type Connection=EventTarget&{saveData?:boolean};
export default function CampaignVideo(){
 const ref=useRef<HTMLVideoElement>(null),{external,openPreferences}=useMediaPreferences();
 const intent=useRef<"auto"|"play"|"pause">("auto"),updateRef=useRef<()=>void>(()=>{});
 const [host,setHost]=useState<HTMLElement|null>(null),[pauseAvailable,setPauseAvailable]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{
  const video=ref.current;if(!video)return;
  const hero=video.closest<HTMLElement>(".hw16-hero");if(!hero)return;setHost(hero.closest(".hw-page")?.querySelector<HTMLElement>(".launch-intro > div:last-child")??null);
  const motion=matchMedia("(prefers-reduced-motion: reduce)"),mobile=matchMedia("(max-width:860px)");
  const connection=(navigator as Navigator&{connection?:Connection}).connection;
  let visible=false,cancelled=false,visualReady=false,frame:number|undefined;
  const paint=()=>{if(cancelled)return;const live=!video.paused&&!video.ended;hero.dataset.mediaPlaying=String(live);};
  const clear=()=>{video.pause();video.removeAttribute("src");video.load();hero.dataset.mediaFrame="false";hero.dataset.fixedVideoReady="false";setPauseAvailable(false);};
  const update=()=>{
   if(cancelled)return;
   hero.dataset.manualVideo=String(intent.current==="play");
   if(!external){clear();return;}
   // Keep manual pause available while visibility pauses playback automatically.
   if(intent.current!=="auto")setPauseAvailable(intent.current==="play");
   const shouldPlay=visualReady&&visible&&!document.hidden&&intent.current!=="pause"&&(intent.current==="play"||(!motion.matches&&!connection?.saveData));
   if(!shouldPlay){video.pause();return;}
   const src=videoSource(mobile.matches?860:861);
   if(video.getAttribute("src")!==src){video.src=src;video.load();}
   setPauseAvailable(true);
   video.play().catch(()=>{if(!cancelled){setPauseAvailable(false);setFailed(true);hero.dataset.mediaFrame="false";}});
  };
  updateRef.current=update;
  const showFrame=()=>{if(cancelled||video.readyState<2||!video.videoWidth)return;setFailed(false);hero.dataset.mediaFrame="true";hero.dataset.fixedVideoReady="true";paint();};
  const onPlaying=()=>{if(cancelled)return;if(video.requestVideoFrameCallback)frame=video.requestVideoFrameCallback(showFrame);else frame=requestAnimationFrame(showFrame);};
  const onError=()=>{setPauseAvailable(false);setFailed(true);hero.dataset.mediaFrame="false";hero.dataset.fixedVideoReady="false";paint();};
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting===true&&entries[0].intersectionRatio>.08;update();},{threshold:[0,.08,.3]});
  observer.observe(hero);document.addEventListener("visibilitychange",update);motion.addEventListener("change",update);mobile.addEventListener("change",update);connection?.addEventListener("change",update);
  video.addEventListener("playing",onPlaying);video.addEventListener("pause",paint);video.addEventListener("error",onError);
  // Prioritize the existing poster and logo over the background video download.
  const images=[...hero.querySelectorAll<HTMLImageElement>(".fixed-hero-poster,.h16-logo img")];
  Promise.all(images.map(image=>(image.complete?Promise.resolve():new Promise<void>(resolve=>{image.addEventListener("load",()=>resolve(),{once:true});image.addEventListener("error",()=>resolve(),{once:true});})).then(()=>image.decode().catch(()=>undefined)))).then(()=>{if(!cancelled){visualReady=true;hero.dataset.visualReady="true";update();}});
  if(!external)clear();
  return()=>{cancelled=true;updateRef.current=()=>{};if(frame!==undefined){if(video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(frame);else cancelAnimationFrame(frame);}observer.disconnect();document.removeEventListener("visibilitychange",update);motion.removeEventListener("change",update);mobile.removeEventListener("change",update);connection?.removeEventListener("change",update);video.removeEventListener("playing",onPlaying);video.removeEventListener("pause",paint);video.removeEventListener("error",onError);video.pause();video.removeAttribute("src");video.load();};
 },[external]);
 return <><video ref={ref} id="halloween-background-video" className="fixed-hero-video" muted loop playsInline preload="none" aria-hidden="true"/>
 {host?createPortal(<button type="button" className="pl-video-toggle" aria-controls="halloween-background-video" aria-label={pauseAvailable?"Pausar video de fondo":"Reproducir video de fondo"} onClick={()=>{intent.current=pauseAvailable?"pause":"play";setFailed(false);if(!external)openPreferences();else updateRef.current();}}>
 <svg viewBox="0 0 24 24" aria-hidden="true"><path d={pauseAvailable?"M8 5v14M16 5v14":"m9 5 10 7-10 7z"}/></svg></button>,host):null}
 {failed?<span className="sr-only" role="status">El video no está disponible. Se conserva la portada.</span>:null}</>;
}

