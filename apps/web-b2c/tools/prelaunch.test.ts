import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parseConsent, CONSENT_TTL } from "../src/components/prelaunch/consent";
import { prelaunchPage, isPrelaunchPath, prelaunchNav } from "../src/components/prelaunch/routes";
import { videoSource } from "../src/components/prelaunch/media";
const base="05ff39dc340d98cddd01835a3d7bf01982a1f415",root=path.resolve(import.meta.dirname,"../../..");
test("consent rejects missing, malformed, expired, future and wrong-version choices",()=>{
 const now=2_000_000_000_000;
 for(const value of [null,"{","null","false",JSON.stringify({version:2,external:true,savedAt:now}),JSON.stringify({version:1,external:true,savedAt:now+1}),JSON.stringify({version:1,external:true,savedAt:now-CONSENT_TTL})])assert.equal(parseConsent(value,now),null);
});
test("external media permission never enables analytics or advertising",()=>{
 const value=parseConsent(JSON.stringify({version:1,external:true,savedAt:100,analytics:true,advertising:true}),101);
 assert.deepEqual(value,{version:2,savedAt:100,necessary:true,external:true,analytics:false,advertising:false});
});
test("demo and pre routes are explicit; operational and unknown paths are excluded",()=>{
 for(const p of ["/","/inicio","/asuncion","/zona/asuncion","/eventos","/halloween","/club/demo","/bar/demo","/evento/demo"])assert.equal(isPrelaunchPath(p),true,p);
 for(const p of ["/payments/access/status","/access/checkin/synthetic","/auth/login","/confirmacion-compra","/reservar/synthetic","/unrecognized"])assert.equal(isPrelaunchPath(p),false,p);
 assert.equal(prelaunchPage("/eventos"),"halloween");
});
test("mobile video includes the approved 860 px boundary and exact R2 path",()=>{
 assert.match(videoSource(860),/videos\/videos\/halloween-mobile-18s\.mp4$/);
 assert.match(videoSource(861),/videos\/videos\/halloween-desktop-18s\.mp4$/);
});
test("operational route assignments, parameter names and provider composition are preserved",()=>{
 const before=execFileSync("git",["--no-optional-locks","show",base+":apps/web-b2c/src/App.tsx"],{cwd:root,encoding:"utf8"});
 const after=fs.readFileSync(path.join(root,"apps/web-b2c/src/App.tsx"),"utf8");
 const paths=["/payments/access/status","/access/checkin/:token","/auth/login","/confirmacion-compra","/reservar/:barId"];
 const read=(source:string,p:string)=>source.split("\n").find(l=>l.includes('path="'+p+'"'))?.trim();
 for(const p of paths)assert.equal(read(after,p),read(before,p),p);
 assert.equal(after.slice(after.indexOf("<QueryClientProvider"),after.indexOf("<Routes>")).replace("          <AnalyticsRouteCoordinator />\n",""),before.slice(before.indexOf("<QueryClientProvider"),before.indexOf("<Routes>")));
});
test("Access and other operational implementations retain the base source content",()=>{
 for(const file of ["src/pages/AccessPaymentStatus.tsx","src/pages/AccessCheckinLanding.tsx","src/pages/PurchaseConfirmation.tsx","src/pages/ReservaForm.tsx","src/pages/auth/Login.tsx","src/components/shared/AccessPaidCheckout.tsx","src/lib/accessPublicStatus.ts","src/context/AuthContext.tsx","src/context/CartContext.tsx"]){
  const before=execFileSync("git",["--no-optional-locks","show",base+":apps/web-b2c/"+file],{cwd:root});
  const after=fs.readFileSync(path.join(root,"apps/web-b2c",file));
  // A Git checkout may materialize CRLF. Compare normalized source content.
  assert.equal(after.toString().replaceAll("\r\n","\n"),before.toString().replaceAll("\r\n","\n"),file);
 }
});


test("public equivalences use router matching without rewriting input URLs",()=>{
 const groups:Record<string,string[]>={halloween:["/halloween","/halloween/","/Halloween","/Halloween/","/eventos","/eventos/?origen=QA_Mixto"],asuncion:["/asuncion","/asuncion/","/zona/asuncion/"],cookies:["/legal/cookies","/legal/cookies/","/Legal/Cookies/"]};
 for(const [expected,paths] of Object.entries(groups))for(const input of paths){const original=input;assert.equal(prelaunchPage(input),expected,input);assert(isPrelaunchPath(input));assert.equal(input,original);}
 for(const input of ["/halloween/falso","/halloweenish","/legal","/legal/no-existe","/access/no-existe","/asuncion-extra","/auth/login?qa=MiXto","/payments/access/status?ref=QA_aBc","/access/checkin/QA_Token_aBc?origen=MiXto","/confirmacion-compra?qa=MiXto","/reservar/Bar_QA_aBc?origen=MiXto"]){assert.equal(prelaunchPage(input),undefined,input);assert.equal(isPrelaunchPath(input),false,input);}
});

test("dock classification keeps map aliases out of Information",()=>{
 for(const route of ["/mapa","/mapa/","/Mapa?origen=QA","#/mapa".slice(1)])assert.equal(prelaunchNav(prelaunchPage(route)!),"mapa",route);
 for(const route of ["/informacion","/sobre/que-es-tairet","/sobre/como-funciona","/sobre/preguntas-frecuentes","/para-locales/solicitud","/contacto","/legal/cookies"])assert.equal(prelaunchNav(prelaunchPage(route)!),"informacion",route);
 for(const route of ["/explorar","/zona/san-bernardino","/access/checkin/QA_SYNTHETIC","/unknown"])assert.equal(prelaunchNav(prelaunchPage(route)??""),undefined,route);
 assert.equal(prelaunchNav(prelaunchPage("/eventos")!),"halloween");
 assert.equal(prelaunchNav(prelaunchPage("/zona/asuncion")!),"asuncion");
});
