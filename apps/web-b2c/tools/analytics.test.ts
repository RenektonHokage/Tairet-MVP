import test from "node:test";
import assert from "node:assert/strict";
import { createAnalytics, deniedConsent, type TagCommand, type TagTransport } from "../src/components/prelaunch/analyticsEngine";
import { analyticsConfig, analyticsPage, safeCampaign, GA4_ID, type AnalyticsConfig, type Flow, type Channel, type SocialPlacement } from "../src/components/prelaunch/analyticsCatalog";
import { parseConsent, CONSENT_TTL, type Consent } from "../src/components/prelaunch/consent";
import { readFileSync } from "node:fs";

const origin="https://qa.invalid",initialTime=2_000_000_000_000;
const enabled:AnalyticsConfig={enabled:true,remoteApproved:true,allowedOrigins:[origin]};
const choice=(analytics=true,external=false,savedAt=initialTime):Consent=>({version:2,savedAt,external,analytics,necessary:true,advertising:false});
function fixture(config=enabled){
 let time=initialTime,disabled=true,loads=0,clears=0,ready=()=>{},fail=()=>{},throwCommand=false;
 const commands:TagCommand[]=[];
 const transport:TagTransport={
  disable(value){disabled=value;},clearCookies(){clears++;},
  command(...args){if(throwCommand)throw Error("QA transport failure");if(args[0]==="event")assert.equal(disabled,false);commands.push(args);},
  load(ok,bad){loads++;commands.push(["consent","default",deniedConsent]);ready=ok;fail=bad;}
 };
 const engine=createAnalytics(config,origin,transport,()=>time);
 return {engine,commands,ready:()=>ready(),fail:()=>fail(),advance:()=>{time+=CONSENT_TTL;},breakCommands:()=>{throwCommand=true;},loads:()=>loads,clears:()=>clears,disabled:()=>disabled,events:()=>commands.filter((x):x is Extract<TagCommand,["event",unknown,unknown]>=>x[0]==="event")};
}
test("v1 migration preserves media and age, never grants analytics; invalid and expired choices fail closed",()=>{
 const legacy={version:1,savedAt:initialTime-100,external:true,analytics:true,advertising:true};
 assert.deepEqual(parseConsent(JSON.stringify(legacy),initialTime),choice(false,true,initialTime-100));
 for(const raw of ["{","null",JSON.stringify({...legacy,version:9}),JSON.stringify({...legacy,savedAt:initialTime+1}),JSON.stringify({...legacy,savedAt:initialTime-CONSENT_TTL}),JSON.stringify({...legacy,external:"true"}),JSON.stringify({...legacy,version:2,analytics:"true"})])assert.equal(parseConsent(raw,initialTime),null);
 for(const external of [false,true])for(const analytics of [false,true])assert.deepEqual(parseConsent(JSON.stringify({...choice(analytics,external),advertising:true}),initialTime),choice(analytics,external));
});
test("three activation gates and consent are independent; URL parameters cannot enable collection",()=>{
 assert.equal(analyticsConfig({}).enabled,false);
 assert.deepEqual(analyticsConfig({VITE_GA4_ENABLED:"true",VITE_GA4_REMOTE_CONFIGURATION_APPROVED:"true",VITE_GA4_ALLOWED_ORIGINS:"https://qa.invalid,https://qa.invalid/path,javascript:bad"}),enabled);
 for(const config of [{...enabled,enabled:false},{...enabled,remoteApproved:false},{...enabled,allowedOrigins:[]}]){
  const f=fixture(config);f.engine.sync({pathname:"/halloween",search:"?VITE_GA4_ENABLED=true&analytics=true",consent:choice()});assert.equal(f.loads(),0);assert.equal(f.events().length,0);
 }
 const f=fixture();for(const consent of [null,choice(false,false),choice(false,true)])f.engine.sync({pathname:"/halloween",search:"",consent});
 assert.equal(f.loads(),0);assert.equal(f.commands.length,0);
});
test("explicit public catalogue agrees with H05 while excluding operational, unknown and dynamic demonstration IDs",()=>{
 for(const p of ["/","/inicio","/asuncion/","/zona/asuncion/","/Halloween/","/eventos","/Legal/Cookies/","/contacto","/para-locales/solicitud"])assert(analyticsPage(p),p);
 for(const p of ["/auth/login","/payments/access/status","/access/checkin/QA_aBc","/confirmacion-compra","/reservar/Bar_QA","/evento/QA_Event","/club/QA_Club","/bar/QA_Bar","/halloween/unknown","/legal/unknown","/explorar"])assert.equal(analyticsPage(p),null,p);
});
test("manual SPA views count transitions and revisits, not aliases/rerenders or pre-consent history",()=>{
 const f=fixture();
 f.engine.sync({pathname:"/inicio",search:"",consent:null});f.engine.sync({pathname:"/asuncion",search:"",consent:null});
 f.engine.sync({pathname:"/halloween",search:"",consent:choice()});assert.equal(f.events().length,0);f.ready();
 for(const pathname of ["/eventos","/Halloween/","/halloween"])f.engine.sync({pathname,search:"?irrelevant=QA_PRIVATE",consent:choice()});
 assert.deepEqual(f.events().map(x=>x[2].page_key),["halloween"]);
 f.engine.sync({pathname:"/inicio",search:"",consent:choice()});
 f.engine.sync({pathname:"/halloween",search:"",consent:choice()});
 assert.deepEqual(f.events().map(x=>x[2].page_key),["halloween","home","halloween"]);
 assert.equal(f.events()[0][2].page_referrer,"");
 assert.equal(f.events()[1][2].page_referrer,origin+"/#/halloween");
 assert.equal(f.loads(),1);assert.equal(f.commands.filter(x=>x[0]==="config").length,1);
 const config=f.commands.find(x=>x[0]==="config")!;
 assert.equal(config[2].send_page_view,false);assert.equal(config[2].allow_google_signals,false);assert.equal(config[2].allow_ad_personalization_signals,false);
 assert.equal(config[2].cookie_domain,"none");assert.equal(config[2].cookie_update,false);
});
test("campaign attribution is an exact catalogue, rejects duplicates/free text and never passes operational identifiers",()=>{
 assert.deepEqual(safeCampaign("?utm_source=instagram&utm_medium=social&utm_campaign=halloween_2026_pre&utm_content=story_01"),{campaign_source:"instagram",campaign_medium:"social",campaign_name:"halloween_2026_pre",campaign_content:"story_01"});
 const bad=safeCampaign("?utm_source=instagram&utm_source=QA_PRIVATE&utm_medium=mail%40example.invalid&utm_campaign=QA_TOKEN&utm_content=595981000000&gclid=QA_AD_ID");
 assert(Object.values(bad).every(x=>x==="unattributed"));
 const f=fixture();f.engine.sync({pathname:"/halloween",search:"?email=QA_PRIVATE%40example.invalid&token=QA_TOKEN&phone=595981000000",consent:choice()});f.ready();f.engine.socialLinkClick("halloween_hero");
 const serialized=JSON.stringify(f.commands);for(const forbidden of ["QA_PRIVATE","QA_TOKEN","595981000000","example.invalid","gclid"])assert(!serialized.includes(forbidden),forbidden);
});
test("bounded typed functional events contain only closed fields; Instagram records only a social click, not contact or a claimed follower",()=>{
 const f=fixture();f.engine.sync({pathname:"/halloween",search:"",consent:choice()});f.ready();
 f.engine.convocationOpen("halloween_event","halloween_hero");f.engine.convocationDraftReady("halloween_event");
 f.engine.contactChannelClick("halloween_event","whatsapp","halloween_review");f.engine.socialLinkClick("halloween_hero");
 f.engine.convocationDraftReady("QA_PRIVATE" as Flow);f.engine.contactChannelClick("local","mailto:QA_PRIVATE@example.invalid" as Channel,"local_review");
 f.engine.socialLinkClick("QA_PRIVATE" as SocialPlacement);
 Reflect.apply(f.engine.socialLinkClick,null,[{phone:"QA_PRIVATE"}]);
 assert.deepEqual(f.events().map(x=>x[1]),["page_view","convocation_open","convocation_draft_ready","contact_channel_click","social_link_click"]);
 for(const e of f.events()){
  assert.equal(e[2].send_to,GA4_ID);
  assert(Object.keys(e[2]).every(k=>["page_key","page_location","page_title","page_referrer","campaign_source","campaign_medium","campaign_name","campaign_content","send_to","flow","channel","placement","platform","account"].includes(k)));
 }
 assert(!JSON.stringify(f.commands).includes("QA_PRIVATE"));
});
test("revocation during download drops pending events; a late script cannot reactivate measurement",()=>{
 const f=fixture();f.engine.sync({pathname:"/halloween",search:"",consent:choice(true,true)});f.engine.convocationOpen("halloween_event","halloween_hero");
 f.engine.sync({pathname:"/halloween",search:"",consent:choice(false,true)});f.ready();f.engine.socialLinkClick("halloween_hero");
 assert.equal(f.events().length,0);assert.equal(f.disabled(),true);assert(f.clears()>0);
 f.engine.sync({pathname:"/halloween",search:"",consent:choice(true,true)});assert.deepEqual(f.events().map(x=>x[1]),["page_view"]);assert.equal(f.loads(),1);
});
test("public to Access invalidates pending work and preserves choice without replaying Access on return",()=>{
 for(const excluded of ["/auth/login","/payments/access/status","/access/checkin/QA_Token_aBc","/confirmacion-compra","/reservar/Bar_QA_aBc"]){
  const f=fixture();f.engine.sync({pathname:"/halloween",search:"",consent:choice()});f.engine.convocationDraftReady("halloween_event");
  f.engine.sync({pathname:excluded,search:"?ref=QA_PRIVATE",consent:choice()});f.ready();f.engine.contactChannelClick("general","email","contact_page");f.engine.socialLinkClick("footer");
  assert.equal(f.events().length,0);assert.equal(f.disabled(),true);
  f.engine.sync({pathname:"/asuncion",search:"",consent:choice()});assert.deepEqual(f.events().map(x=>x[2].page_key),["asuncion"]);
  assert.equal(f.events()[0][2].page_referrer,"");assert(!JSON.stringify(f.commands).includes("QA_PRIVATE"));assert.equal(f.loads(),1);
 }
});
test("expiry, load failure and thrown transport stop safely without retry loops",()=>{
 const f=fixture();f.engine.sync({pathname:"/halloween",search:"",consent:choice()});f.ready();f.advance();f.engine.socialLinkClick("halloween_hero");
 assert.equal(f.events().length,1);assert.equal(f.disabled(),true);assert(f.clears()>0);
 const failed=fixture();failed.engine.sync({pathname:"/halloween",search:"",consent:choice()});failed.fail();failed.ready();
 for(let i=0;i<10;i++)failed.engine.sync({pathname:"/halloween",search:"",consent:choice()});
 assert.equal(failed.loads(),1);assert.equal(failed.events().length,0);
 const broken=fixture();broken.engine.sync({pathname:"/halloween",search:"",consent:choice()});broken.breakCommands();
 assert.doesNotThrow(()=>broken.ready());assert.doesNotThrow(()=>broken.engine.socialLinkClick("halloween_hero"));assert.equal(broken.disabled(),true);
});
test("Instagram reuses existing anchors, with no notice block or retired event",()=>{
 const views=readFileSync(new URL("../src/components/prelaunch/ApprovedViews.tsx",import.meta.url),"utf-8");
 assert(!views.includes("HalloweenNotice"));assert(!views.includes("Avisame cuando"));
 for(const placement of ["halloween_hero","footer","asuncion_intro"])assert(views.includes('data-social-placement="'+placement+'"'));
 const f=fixture();f.engine.sync({pathname:"/halloween",search:"",consent:choice()});f.ready();f.engine.socialLinkClick("halloween_hero");
 assert.deepEqual(f.events().at(-1)?.slice(1),["social_link_click",{...f.events()[0][2],placement:"halloween_hero",platform:"instagram",account:"tairetpy"}]);
 assert(!JSON.stringify(f.commands).includes("instagram.com"));
});
