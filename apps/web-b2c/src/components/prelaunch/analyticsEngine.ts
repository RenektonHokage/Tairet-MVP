import { CONSENT_TTL, type Consent } from "./consent";
import { GA4_ID, GA4_COOKIE_PREFIX, analyticsPage, safeCampaign, flows, channels, placements, type AnalyticsConfig, type PublicPage, type Campaign, type Flow, type Channel, type Placement, type PageKey, socialPlacements, type SocialPlacement } from "./analyticsCatalog";

type GoogleConsent={analytics_storage:"granted"|"denied";ad_storage:"denied";ad_user_data:"denied";ad_personalization:"denied"};
export const deniedConsent:GoogleConsent={analytics_storage:"denied",ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied"};
type PageData=Campaign&{page_key:PageKey;page_location:string;page_title:string;page_referrer:string};
type EventName="page_view"|"convocation_open"|"convocation_draft_ready"|"contact_channel_click"|"social_link_click";
type EventData=PageData&{send_to:typeof GA4_ID;flow?:Flow;channel?:Channel;placement?:Placement|SocialPlacement;platform?:"instagram";account?:"tairetpy"};
type ConfigData=PageData&{send_page_view:false;allow_google_signals:false;allow_ad_personalization_signals:false;cookie_prefix:string;cookie_domain:"none";cookie_path:"/";cookie_expires:number;cookie_update:false;ignore_referrer:true};
export type TagCommand=
 |["consent","default"|"update",GoogleConsent]
 |["js",Date]
 |["config",typeof GA4_ID,ConfigData]
 |["set",PageData|{ads_data_redaction:true;url_passthrough:false}]
 |["event",EventName,EventData];
export type TagTransport={
 load:(ready:()=>void,failed:()=>void)=>void;
 command:(...args:TagCommand)=>void;
 disable:(value:boolean)=>void;
 clearCookies:()=>void;
};
type FunctionalEvent=
 |{name:"convocation_open";flow:Flow;placement:Placement}
 |{name:"convocation_draft_ready";flow:Flow}
 |{name:"contact_channel_click";flow:Flow;channel:Channel;placement:Placement}
 |{name:"social_link_click";placement:SocialPlacement};
type Input={pathname:string;search:string;consent:Consent|null};

export function createAnalytics(config:AnalyticsConfig,origin:string,transport:TagTransport,now=Date.now){
 let page:PublicPage|null=null,choice:Consent|null=null,active=false;
 let loadState:"idle"|"loading"|"ready"|"failed"="idle",configured=false,needsConsentUpdate=true,epoch=0;
 let sentKey:PageKey|null=null,lastLocation="",referrer="";
 let campaign=safeCampaign("");
 let pending:{event:FunctionalEvent;epoch:number}[]=[];
 const permitted=()=>config.enabled&&config.remoteApproved&&config.allowedOrigins.includes(origin)&&!!page&&choice?.analytics===true&&choice.savedAt<=now()&&now()-choice.savedAt<CONSENT_TTL;
 const metadata=():PageData=>({page_key:page!.key,page_location:origin+"/#"+page!.path,page_title:page!.title,page_referrer:referrer,...campaign});
 const invoke=(...args:TagCommand)=>{
  try{transport.command(...args);return true;}catch{loadState="failed";active=false;pending=[];transport.disable(true);return false;}
 };
 const suspend=()=>{
  transport.disable(true);epoch++;pending=[];sentKey=null;lastLocation="";referrer="";active=false;campaign=safeCampaign("");
  if(!choice?.analytics||now()-choice.savedAt>=CONSENT_TTL){
   if(loadState!=="idle")invoke("consent","update",deniedConsent);
   transport.clearCookies();
  }
 };
 const sendView=()=>{
  if(!permitted()||loadState!=="ready")return;
  if(sentKey===page!.key&&configured&&!needsConsentUpdate)return;
  const data=metadata();
  // Safe metadata is installed before the tag can measure anything.
  if(!invoke("set",data))return;
  if(needsConsentUpdate){if(!invoke("consent","update",{...deniedConsent,analytics_storage:"granted"}))return;needsConsentUpdate=false;}
  if(!configured){
   if(!invoke("set",{ads_data_redaction:true,url_passthrough:false}))return;
   if(!invoke("js",new Date(now())))return;
   if(!invoke("config",GA4_ID,{...data,send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_prefix:GA4_COOKIE_PREFIX,cookie_domain:"none",cookie_path:"/",cookie_expires:CONSENT_TTL/1000,cookie_update:false,ignore_referrer:true}))return;
   configured=true;
  }
  transport.disable(false);
  if(sentKey===page!.key)return;
  sentKey=page!.key;lastLocation=data.page_location;
  invoke("event","page_view",{...data,send_to:GA4_ID});
 };
 const sendFunctional=(event:FunctionalEvent)=>{
  if(!permitted()||loadState!=="ready"){if(!permitted())suspend();return;}
  const data:EventData={...metadata(),send_to:GA4_ID};
  if("flow" in event)data.flow=event.flow;
  if("channel" in event)data.channel=event.channel;
  if("placement" in event)data.placement=event.placement;
  if(event.name==="social_link_click"){data.platform="instagram";data.account="tairetpy";}
  invoke("event",event.name,data);
 };
 const functional=(event:FunctionalEvent)=>{
  if(!permitted()){suspend();return;}
  if(loadState==="ready")sendFunctional(event);
  else if(loadState==="loading"&&pending.length<20)pending.push({event,epoch});
 };
 const sync=({pathname,search,consent}:Input)=>{
  const oldKey=page?.key;page=analyticsPage(pathname);choice=consent;
  if(!permitted()){suspend();return;}
  if(!active){
   active=true;needsConsentUpdate=true;epoch++;pending=[];sentKey=null;lastLocation="";referrer="";campaign=safeCampaign(search);
  }else if(oldKey!==page!.key){epoch++;pending=[];referrer=lastLocation;}
  if(loadState==="ready"){sendView();return;}
  if(loadState!=="idle")return;
  loadState="loading";transport.disable(true);
  try{transport.load(()=>{
   if(loadState!=="loading")return;
   loadState="ready";
   if(!permitted()){suspend();return;}
   const queued=pending;pending=[];sendView();
   for(const item of queued)if(item.epoch===epoch)sendFunctional(item.event);
  },()=>{loadState="failed";suspend();});}catch{loadState="failed";suspend();}
 };
 return {
  sync,
  convocationOpen(flow:Flow,placement:Placement){if(flows.includes(flow)&&placements.includes(placement))functional({name:"convocation_open",flow,placement});},
  convocationDraftReady(flow:Flow){if(flows.includes(flow))functional({name:"convocation_draft_ready",flow});},
  contactChannelClick(flow:Flow,channel:Channel,placement:Placement){if(flows.includes(flow)&&channels.includes(channel)&&placements.includes(placement))functional({name:"contact_channel_click",flow,channel,placement});},
  socialLinkClick(placement:SocialPlacement){if(socialPlacements.includes(placement))functional({name:"social_link_click",placement});}
 };
}
