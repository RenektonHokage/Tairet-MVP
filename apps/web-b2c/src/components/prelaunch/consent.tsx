import { createContext, useContext, useSyncExternalStore } from "react";

export const CONSENT_KEY="tairet-privacy-v1"; // Keep one storage key; migrate the payload, not the choice date.
export const CONSENT_TTL=180*24*60*60*1000;
export const CONSENT_VERSION=2;
export type Consent=Readonly<{version:2;savedAt:number;external:boolean;analytics:boolean;necessary:true;advertising:false}>;
export function parseConsent(raw:string|null,now=Date.now()):Consent|null{
 try{
  const value:unknown=JSON.parse(raw??"null");
  if(!value||typeof value!=="object")return null;
  const x=value as {version?:unknown;savedAt?:unknown;external?:unknown;analytics?:unknown};
  if(typeof x.savedAt!=="number"||!Number.isFinite(x.savedAt)||x.savedAt>now||now-x.savedAt>=CONSENT_TTL||typeof x.external!=="boolean")return null;
  if(x.version!==1&&x.version!==2)return null;
  if(x.version===2&&typeof x.analytics!=="boolean")return null;
  return {version:2,savedAt:x.savedAt,external:x.external,analytics:x.version===2&&x.analytics===true,necessary:true,advertising:false};
 }catch{return null;}
}
export function readConsent(){try{return parseConsent(localStorage.getItem(CONSENT_KEY));}catch{return null;}}
type Snapshot=Readonly<{consent:Consent|null;persisted:boolean}>;
const serverSnapshot:Snapshot={consent:null,persisted:true};
let snapshot:Snapshot|undefined;
const listeners=new Set<()=>void>();
let expiry:ReturnType<typeof setTimeout>|undefined;
let listening=false;
function scheduleExpiry(){
 if(expiry!==undefined)clearTimeout(expiry);
 if(!listeners.size||!snapshot?.consent)return;
 const remaining=CONSENT_TTL-(Date.now()-snapshot.consent.savedAt);
 expiry=setTimeout(()=>{
  if(snapshot?.consent&&Date.now()-snapshot.consent.savedAt>=CONSENT_TTL)publish({consent:null,persisted:snapshot.persisted});
  else scheduleExpiry();
 },Math.max(1,Math.min(remaining,24*60*60*1000)));
}
function publish(next:Snapshot){
 snapshot=next;
 // Synchronous subscribers suspend measurement before React paints the new preference.
 for(const listener of listeners)listener();
 scheduleExpiry();
}
function onStorage(event:StorageEvent){
 if(event.key===CONSENT_KEY||event.key===null)publish({consent:parseConsent(event.newValue),persisted:true});
}
export function getConsentSnapshot():Snapshot{
 if(!snapshot)snapshot={consent:typeof window==="undefined"?null:readConsent(),persisted:true};
 return snapshot;
}
export function subscribeConsent(listener:()=>void){
 listeners.add(listener);
 if(!listening&&typeof window!=="undefined"){window.addEventListener("storage",onStorage);listening=true;}
 getConsentSnapshot();scheduleExpiry();
 return ()=>{
  listeners.delete(listener);
  if(!listeners.size&&listening){window.removeEventListener("storage",onStorage);listening=false;}
  scheduleExpiry();
 };
}
export function chooseConsent(external:boolean,analytics:boolean){
 const consent:Consent={version:2,savedAt:Date.now(),necessary:true,external,analytics,advertising:false};
 let persisted=true;
 try{localStorage.setItem(CONSENT_KEY,JSON.stringify(consent));}catch{persisted=false;}
 publish({consent,persisted});
}
export const useConsentState=()=>useSyncExternalStore(subscribeConsent,getConsentSnapshot,()=>serverSnapshot);
export const MediaPreferences=createContext({external:false,openPreferences:()=>{}});
export const useMediaPreferences=()=>useContext(MediaPreferences);
