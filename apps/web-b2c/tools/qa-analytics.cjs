const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.QA_PLAYWRIGHT);
const fixtureSource=require('./ga4-fixture.cjs'),audit=require('./ga4-audit.cjs');
const evidence=process.argv[2],mode=process.env.QA_GA4_MODE||'fixture',control=process.env.QA_GA4_CONTROL||'';
const base=process.env.QA_BASE_URL||'http://127.0.0.1:4175',disabledBase=process.env.QA_DISABLED_BASE_URL||'http://127.0.0.1:4173';
if(!evidence||!/(?:b3|b4)/.test(path.resolve(evidence)))throw Error('Use a new b3 or b4 evidence directory');
for(const d of ['PRUEBAS','CAPTURAS'])fs.mkdirSync(path.join(evidence,d),{recursive:true});
const report={status:'RUNNING',mode,control,results:[],requests:[],violations:[],errors:[],console:[],tagLibraries:[],captures:[],cuts:[],servicePolicy:'All collectors, operational requests and contact exits intercepted before navigation. Official mode forwards only the exact gtag.js GET. No analytics events/messages delivered.'};
let browser,officialBody;
const stamp=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const allowedChoice=(analytics=true,external=false)=>({version:2,savedAt:Date.now(),necessary:true,external,analytics,advertising:false});
const instagramURL='https://www.instagram.com/tairetpy/';
function initProbe(options){
 if(location.origin!==options.origin)return;
 const KEY='tairet-privacy-v1',DISABLE='ga-disable-G-L5DRMC7Z1F';
 const originalSet=Storage.prototype.setItem;
 if(options.initial!==undefined)originalSet.call(localStorage,KEY,typeof options.initial==='string'?options.initial:JSON.stringify(options.initial));
 originalSet.call(localStorage,'tairet-theme','dark');
 const parse=raw=>{try{const x=JSON.parse(raw);return x&&[1,2].includes(x.version)&&typeof x.savedAt==='number'&&x.savedAt<=Date.now()&&Date.now()-x.savedAt<180*86400000?{analytics:x.version===2&&x.analytics===true,external:x.external===true}:null;}catch{return null;}};
 let choice=parse(localStorage.getItem(KEY)),disabled;
 const timeline=window.__qaTimeline=[];
 const record=reason=>timeline.push({time:performance.timeOrigin+performance.now(),route:location.hash||'#/',choice,disabled,reason});
 record('initial');
 Storage.prototype.setItem=function(key,value){
  if(key===KEY){choice=parse(value);record('explicit-choice');if(options.storageBlocked)throw new DOMException('QA blocked storage','SecurityError');}
  return originalSet.call(this,key,value);
 };
 addEventListener('storage',event=>{if(event.key===KEY||event.key===null){choice=parse(event.newValue);record('storage-sync');}},true);
 addEventListener('hashchange',()=>record('hashchange'),true);addEventListener('popstate',()=>record('popstate'),true);
 Object.defineProperty(window,DISABLE,{configurable:true,get:()=>disabled,set:value=>{disabled=value;record('disable-flag');}});
 window.__qaMailto=[];
 window.__qaSocialExits=[];
 addEventListener('click',event=>{const link=event.target.closest?.('a[href="https://www.instagram.com/tairetpy/"]');if(link&&link.target!=='_blank'){event.preventDefault();window.__qaSocialExits.push({url:link.href,intercepted:true,at:performance.timeOrigin+performance.now()});}},true);
 addEventListener('click',event=>{const link=event.target.closest?.('a[href^="mailto:"]');if(link){event.preventDefault();window.__qaMailto.push({time:performance.timeOrigin+performance.now(),intercepted:true});}},true);
 const states=new WeakMap();
 Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return states.get(this)!==false;},configurable:true});
 HTMLMediaElement.prototype.load=function(){};
 HTMLMediaElement.prototype.play=function(){states.set(this,false);this.dispatchEvent(new Event('playing'));return Promise.resolve();};
 HTMLMediaElement.prototype.pause=function(){states.set(this,true);this.dispatchEvent(new Event('pause'));};
 if(options.preconsentControl)addEventListener('DOMContentLoaded',()=>{const s=document.createElement('script');s.src='https://www.googletagmanager.com/gtag/js?id=G-L5DRMC7Z1F';document.head.append(s);});
}
async function makeContext(name,options={}){
 const site=options.base||base;
 const context=await browser.newContext({viewport:{width:options.width||1440,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 const local={name,requests:[],errors:[],context,site,pages:new Map(),options};
 await context.addInitScript(initProbe,{origin:new URL(site).origin,initial:options.initial,storageBlocked:!!options.storageBlocked,preconsentControl:control==='preconsent-load'});
 context.on('page',p=>{
  local.pages.set(p,local.pages.size+1);
  p.setDefaultTimeout(10000);
  p.on('pageerror',error=>{local.errors.push(error.message);report.errors.push({case:name,type:'pageerror',message:error.message});});
  p.on('console',m=>{
   if(m.type()!=='error')return;
   const location=m.location(),message=m.text();
   let synthetic404=false;
   try{const u=new URL(location.url);synthetic404=u.origin==='http://127.0.0.1:4199'&&['/public/locals','/payments/access/status','/public/locals/by-slug/Bar_QA_aBc'].includes(u.pathname)&&message==='Failed to load resource: the server responded with a status of 404 (Not Found)';}catch{}
   const expected=synthetic404||(options.tagError===true&&location.url==='https://www.googletagmanager.com/gtag/js?id=G-L5DRMC7Z1F'&&message.includes('ERR_BLOCKED_BY_CLIENT'));
   report.console.push({case:name,message,location,expected,reason:synthetic404?'Declared intercepted API 404':expected?'Intentional blocked tag test':null});
   if(!expected){local.errors.push(message);report.errors.push({case:name,type:'console',message});}
  });
 });
 await context.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(u.origin===new URL(site).origin)return route.continue();
  if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)){
   if(options.fonts)return route.continue();
   return route.fulfill({status:200,body:'',contentType:'text/css'});
  }
  const tag=u.hostname==='www.googletagmanager.com'&&u.pathname==='/gtag/js'&&u.searchParams.get('id')==='G-L5DRMC7Z1F';
  const kind=tag?'tag':u.hostname==='wa.me'?'whatsapp':u.href===instagramURL?'instagram':u.port==='4199'?'operational-fixture':u.pathname.endsWith('.mp4')?'media-fixture':'collect';
  const start=request.timing().startTime>0?request.timing().startTime:stamp();
  let page,timeline=[];
  try{page=request.frame().page();timeline=await page.evaluate(()=>window.__qaTimeline||[]);}catch{}
  const current=timeline.filter(x=>x.time<=start).at(-1)||timeline[0]||{choice:null,route:'#/'};
  const record={index:report.requests.length,case:name,kind,page:local.pages.get(page)||0,startedAt:start,url:request.url(),method:request.method(),body:request.postData()||'',route:current.route,choice:current.choice,technicalEnabled:options.technicalEnabled!==false,intercepted:kind!=='tag'||mode!=='official'};
  if(kind==='collect')try{record.payloads=audit.payloads(record.url,record.body);}catch(e){report.violations.push({type:'unreadable-payload',record:record.index,message:e.message});}
  report.requests.push(record);local.requests.push(record);report.violations.push(...audit.auditRequest(record));
  if(kind==='tag'){
   if(options.tagError)return route.abort('blockedbyclient');
   if(options.tagDelay)await sleep(options.tagDelay);
   if(mode==='official'){
    if(!officialBody){
     if(process.env.QA_OFFICIAL_LIBRARY_PATH){
      assert(/^[a-f0-9]{64}$/i.test(process.env.QA_OFFICIAL_LIBRARY_SHA256||''),'Explicit SHA-256 required for supplied official library');
      officialBody=fs.readFileSync(path.resolve(process.env.QA_OFFICIAL_LIBRARY_PATH));
      assert.equal(crypto.createHash('sha256').update(officialBody).digest('hex'),process.env.QA_OFFICIAL_LIBRARY_SHA256.toLowerCase());
      report.tagLibraries.push({url:request.url(),bytes:officialBody.length,sha256:process.env.QA_OFFICIAL_LIBRARY_SHA256.toLowerCase(),modified:false,source:path.resolve(process.env.QA_OFFICIAL_LIBRARY_PATH),freshDownload:false});
     }else{
     const downloadedAtUTC=new Date().toISOString();
     const response=await route.fetch({maxRedirects:0,timeout:20000,headers:{...request.headers(),'cache-control':'no-cache'}});
     assert.equal(response.status(),200,'Official library unavailable');
     officialBody=await response.body();
     fs.writeFileSync(path.join(evidence,'PRUEBAS','gtag-official.js'),officialBody,{flag:'wx'});
     report.download={downloadedAtUTC,responseDate:response.headers()['date'],status:response.status(),bytes:officialBody.length,sha256:crypto.createHash('sha256').update(officialBody).digest('hex'),freshDownload:true};
     report.tagLibraries.push({url:request.url(),status:response.status(),bytes:officialBody.length,sha256:crypto.createHash('sha256').update(officialBody).digest('hex'),modified:false});
     }
    }
    return route.fulfill({status:200,contentType:'application/javascript',body:officialBody});
   }
   return route.fulfill({status:200,contentType:'application/javascript',body:fixtureSource(control)});
  }
  if(kind==='operational-fixture')return route.fulfill({status:404,contentType:'application/json',body:'{"error":"Synthetic not found"}'});
  if(kind==='whatsapp'||kind==='instagram')return route.fulfill({status:200,contentType:'text/html',body:'<p>Salida interceptada por QA. No se envió ningún mensaje.</p>'});
  return route.fulfill({status:204,body:'',headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS'}});
 });
 const page=await context.newPage();
 return {...local,page};
}
const settle=()=>sleep(mode==='official'?1500:180);
async function go(c,route='/halloween'){await c.page.goto(c.site+'/#'+route);await c.page.locator('.prelaunch').waitFor();await settle();}
async function waitTag(c){await c.page.waitForFunction(()=>window.dataLayer?.some(x=>x[0]==='config'));await settle();}
function events(c,name){return c.requests.filter(x=>x.kind==='collect').flatMap(x=>(x.payloads||[]).map(p=>({...p,request:x}))).filter(x=>!name||x.event===name);}
async function openPreferences(c){
 const banner=c.page.locator('#r4-cookie-banner');
 if(await banner.isVisible())await banner.locator('[data-r4-preferences]').click();
 else await c.page.getByRole('button',{name:'Configurar cookies',exact:true}).click();
}
async function expectEvents(c,name,expected){
 const began=stamp(),maximum=mode==='official'?8000:1000;
 if(expected>0)while(events(c,name).length<expected&&stamp()-began<maximum)await sleep(50);
 const observed=stamp();
 await sleep(mode==='official'?Math.max(1500,6500-(observed-began)):100);
 const actual=events(c,name).length;
 (report.eventWaits??=[]).push({case:c.name,event:name,expected,actual,receiptWaitMs:observed-began,totalObservationMs:stamp()-began,maximumReceiptMs:maximum});
 if(name==='page_view'&&actual!==expected)report.violations.push({type:actual>expected?'duplicate-view':'missing-view',case:c.name,observed:actual,expected});
 assert.equal(actual,expected,'Exact event count: '+name);
}
async function expectViewCount(c,expected){await expectEvents(c,'page_view',expected);}
async function preferences(c,external,analytics){
 await openPreferences(c);
 await c.page.locator('#r4-external-toggle').setChecked(external);await c.page.locator('#r4-analytics-toggle').setChecked(analytics);
 await c.page.locator('[data-r4-cookie-save]').click();await settle();
}
async function clickInstagram(c,keyboard=false){
 const link=c.page.locator('[data-social-placement="halloween_hero"]');
 const href=await link.getAttribute('href');assert.equal(href,instagramURL);
 assert.equal(await c.page.locator('.pl-halloween-notice,[data-halloween-notice]').count(),0);
 assert.equal(await link.locator('xpath=ancestor::*[contains(@class,"hw16-hero")]').count(),1);
 await link.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
 const popupPromise=c.page.waitForEvent('popup');
 if(keyboard){await link.focus();await link.press('Enter');}else await link.click();
 const popup=await popupPromise;await popup.waitForLoadState();assert.equal(popup.url(),href);await popup.close();await settle();
 assert.equal(await c.page.getByText(/Ya estás registrado|Aviso confirmado/).count(),0);
}
async function snapshot(c,file){
 await c.page.screenshot({path:path.join(evidence,'CAPTURAS',file)});
 const actual=await c.page.evaluate(()=>({url:location.href,theme:document.querySelector('.prelaunch')?.dataset.theme,viewport:{width:innerWidth,height:innerHeight},overflow:document.documentElement.scrollWidth>innerWidth,fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family)}));
 assert.equal(actual.overflow,false);report.captures.push({file,...actual});
}
async function queueAudit(c){
 if(await c.page.evaluate(()=>window.dataLayer?.some(x=>x[0]==='event'&&x[1]==='halloween_notice_click')))report.violations.push({type:'retired-notice-event',case:c.name});
 const values=await c.page.evaluate(()=>{
  const result=[],seen=new WeakSet();
  const walk=(x,depth=0)=>{
   if(depth>7||x==null)return;
   if(typeof x==='string'){result.push(x);return;}
   if(typeof x!=='object'||seen.has(x))return;seen.add(x);
   if(x instanceof Element){result.push(x.outerHTML);if(x instanceof HTMLFormElement)for(const field of x.elements)if('value' in field)result.push(field.value);return;}
   for(const key of Object.keys(x))walk(x[key],depth+1);
  };
  for(const x of window.dataLayer||[])walk(x);
  return result;
 });
 if(values.some(audit.personal)){
  const entries=await c.page.evaluate(()=> (window.dataLayer||[]).map(x=>({event:typeof x?.event==='string'?x.event:null,command:typeof x?.[0]==='string'?x[0]:null,keys:Object.keys(x||{}),hasContactHref:Object.values(x||{}).some(v=>typeof v==='string'&&/wa\.me|mailto:/.test(v))})).filter(x=>x.hasContactHref));
  report.violations.push({type:'personal-in-queue',case:c.name,redactedEntries:entries});
 }
}
async function runCase(name,options,fn){
 if(process.env.QA_CASE_FILTER&&name!==process.env.QA_CASE_FILTER)return;
 const c=await makeContext(name,options);
 try{await fn(c);await queueAudit(c);assert.equal(c.errors.length,0);report.results.push({name,status:'PASS',requests:c.requests.length,events:events(c).map(x=>x.event)});}
 catch(e){report.results.push({name,status:'FAIL',error:e.stack});}
 finally{await c.context.close();}
 console.log(JSON.stringify(report.results.at(-1)));
 if(!control&&(report.results.at(-1).status==='FAIL'||report.violations.length))throw Error('Stopping at first failed analytics boundary; evidence preserved');
}
(async()=>{
 try{
  browser=await chromium.launch({channel:'msedge',headless:true});
  if(control){
   await runCase('controlled-'+control,{initial:control==='preconsent-load'?undefined:allowedChoice()},async c=>{
    await go(c);
    if(control!=='preconsent-load'){await waitTag(c);await expectViewCount(c,1);}
    if(control==='operational'){await c.page.evaluate(()=>{location.hash='#/access/checkin/QA_ACCESS_aBc'});await settle();}
    assert(c.requests.length>0);
   });
  }else{
   await runCase('explicit rejection and reload without tag',{},async c=>{
    await go(c);await c.page.locator('#r4-cookie-banner [data-r4-cookie-reject]').click();await c.page.reload();await c.page.locator('.prelaunch').waitFor();await settle();
    assert.equal(c.requests.filter(x=>['tag','collect'].includes(x.kind)).length,0);await clickInstagram(c);
   });
   await runCase('explicit acceptance and reload of current public view',{},async c=>{
    await go(c);await preferences(c,false,true);await waitTag(c);await expectViewCount(c,1);
    await c.page.reload();await c.page.locator('.prelaunch').waitFor();await waitTag(c);await expectViewCount(c,2);
    assert.equal(c.requests.filter(x=>x.kind==='tag').length,2);
   });
   await runCase('activation disabled despite valid choice and URL flags',{base:disabledBase,technicalEnabled:false,initial:allowedChoice()},async c=>{await go(c,'/halloween?VITE_GA4_ENABLED=true&analytics=true');assert.equal(c.requests.filter(x=>['tag','collect'].includes(x.kind)).length,0);await clickInstagram(c);});
   const now=Date.now();
   for(const [name,initial] of [['no choice',undefined],['only media',allowedChoice(false,true)],['legacy media remains without analytics',{version:1,savedAt:now-10000,external:true,analytics:true}],['malformed','{'],['expired',allowedChoice(true,true,now-181*86400000)],['future',{...allowedChoice(),savedAt:now+86400000}],['unknown version',{...allowedChoice(),version:99}]]){
    // The expired case is assigned explicitly; helper parameters are intentionally not used for dates.
    const value=name==='expired'?{...allowedChoice(true,true),savedAt:now-181*86400000}:initial;
    await runCase(name,{initial:value,width:name==='no choice'?320:1440},async c=>{
     await go(c);assert.equal(c.requests.filter(x=>['tag','collect'].includes(x.kind)).length,0);await clickInstagram(c,name==='no choice');
     if(name==='only media'||name==='legacy media remains without analytics'){await c.page.getByRole('button',{name:'Configurar cookies',exact:true}).click();assert(await c.page.locator('#r4-external-toggle').isChecked());assert(!(await c.page.locator('#r4-analytics-toggle').isChecked()));}
    });
   }
   await runCase('analytics only, independent media and exact single Instagram event',{initial:allowedChoice(true,false)},async c=>{
    await go(c);await waitTag(c);assert.equal(await c.page.locator('video').getAttribute('src'),null);
    await clickInstagram(c);await expectEvents(c,'social_link_click',1);await expectEvents(c,'contact_channel_click',0);
   });
   await runCase('Instagram placement catalogue preserves commercial contacts',{initial:allowedChoice()},async c=>{
    await go(c,'/asuncion');await waitTag(c);
    for(const [index,placement] of ['asuncion_intro','footer'].entries()){
     const link=c.page.locator('[data-social-placement="'+placement+'"]');assert.equal(await link.getAttribute('href'),instagramURL);
     await link.evaluate(n=>n.scrollIntoView({block:'center',behavior:'instant'}));
     if(placement==='footer'){const pop=c.page.waitForEvent('popup');await link.click();const out=await pop;await out.waitForLoadState();assert.equal(out.url(),instagramURL);await out.close();}
     else{const before=await c.page.evaluate(()=>window.__qaSocialExits.length);await link.click();const exits=await c.page.evaluate(()=>window.__qaSocialExits);assert.equal(exits.length,before+1);assert.equal(exits.at(-1).url,instagramURL);assert(exits.at(-1).intercepted);}
     await expectEvents(c,'social_link_click',index+1);
     const last=events(c,'social_link_click').at(-1).params;assert.equal(last.placement||last['ep.placement'],placement);assert.equal(last.platform||last['ep.platform'],'instagram');assert.equal(last.account||last['ep.account'],'tairetpy');
    }
    await expectEvents(c,'contact_channel_click',0);await expectViewCount(c,1);
   });
   await runCase('manual SPA current view, aliases, history, theme and dialogs',{},async c=>{
    await go(c,'/inicio');await c.page.evaluate(()=>{location.hash='#/asuncion'});await c.page.locator('.pl-asuncion').waitFor();
    await c.page.evaluate(()=>{location.hash='#/halloween'});await c.page.locator('.pl-halloween').waitFor();await preferences(c,false,true);await waitTag(c);
    await expectViewCount(c,1);
    await c.page.locator('header [data-theme-toggle]').click();await c.page.getByRole('button',{name:'Configurar cookies',exact:true}).click();await c.page.keyboard.press('Escape');
    await c.page.evaluate(()=>{location.hash='#/eventos/?origen=QA_Mixto'});await c.page.waitForURL('**/#/halloween?origen=QA_Mixto');await settle();await expectViewCount(c,1);
    await c.page.evaluate(()=>{location.hash='#/asuncion'});await c.page.locator('.pl-asuncion').waitFor();await settle();
    await c.page.goBack();await c.page.locator('.pl-halloween').waitFor();await settle();await c.page.goForward();await c.page.locator('.pl-asuncion').waitFor();await settle();
    await expectViewCount(c,4);
   });
   await runCase('safe campaign catalogue and poisoned URL/title',{initial:allowedChoice()},async c=>{
    await go(c,'/halloween?utm_source=instagram&utm_medium=social&utm_campaign=halloween_2026_pre&utm_content=story_01&phone=595991000111&email=qa.private.email%40example.invalid&ref=QA_REF_aBc&gclid=QA_AD_ID');await waitTag(c);
    await c.page.evaluate(()=>{document.title='QA_PRIVATE_TITLE qa.private.email@example.invalid';});await clickInstagram(c);
    await expectEvents(c,'social_link_click',1);
   });
   await runCase('valid local proposal only, no form data in measurement',{initial:allowedChoice()},async c=>{
    await go(c,'/para-locales/solicitud');await waitTag(c);await expectEvents(c,'convocation_open',1);
    const f=c.page.locator('#tf-lead-form');await f.locator('button[type=submit]').click();await settle();await expectEvents(c,'convocation_draft_ready',0);
    for(const [n,v] of Object.entries({venue:'QA_PRIVATE_VENUE',city:'QA_PRIVATE_CITY',person:'QA_PRIVATE_NAME'}))await f.locator('[name='+n+']').fill(v);
    await f.locator('[name=type]').selectOption('bar');await f.locator('[name=terms]').check();await f.locator('[name=representative]').check();await f.locator('button[type=submit]').click();await settle();
    await expectEvents(c,'convocation_draft_ready',1);
    await c.page.locator('#tf-lead-email').click();await settle();await expectEvents(c,'contact_channel_click',1);assert.equal(await c.page.evaluate(()=>window.__qaMailto.length),1);
    const pop=c.page.waitForEvent('popup');await c.page.locator('#tf-lead-whatsapp').click();const out=await pop;await out.waitForLoadState();await out.close();
    await expectEvents(c,'contact_channel_click',2);
    const stored=await c.page.evaluate(()=>JSON.stringify({...localStorage}));assert(!audit.personal(stored));
   });
   await runCase('valid Halloween proposal only and reset regressions',{initial:allowedChoice()},async c=>{
    await go(c);await waitTag(c);await c.page.locator('[data-open-party]').first().click();await settle();await expectEvents(c,'convocation_open',1);
    const f=c.page.locator('#party-form');await f.locator('#party-next').click();await settle();await expectEvents(c,'convocation_draft_ready',0);
    for(const [n,v] of Object.entries({event:'QA_PRIVATE_EVENT',date:'2026-10-31',start:'23:00',place:'QA_PRIVATE_PLACE',music:'QA_PRIVATE_MUSIC',age:'18'}))await f.locator('[name='+n+']').fill(v);
    await f.locator('#party-next').click();await f.locator('[name=entry]').selectOption('free');await f.locator('#party-next').click();await f.locator('[name=tables]').selectOption('no');await f.locator('#party-next').click();
    for(const [n,v] of Object.entries({organizer:'QA_PRIVATE_ORGANIZER',responsible:'QA_PRIVATE_NAME',contact_phone:'+595 991 000111',contact:'qa.private.email@example.invalid'}))await f.locator('[name='+n+']').fill(v);
    await f.locator('#party-unpublished').click();await f.locator('[name=material_mode]').selectOption('whatsapp');await f.locator('#party-next').click();await c.page.locator('#party-review').waitFor();await settle();
    await expectEvents(c,'convocation_draft_ready',1);
    const pop=c.page.waitForEvent('popup');await c.page.locator('#party-whatsapp-link').click();const out=await pop;await out.waitForLoadState();await out.close();await expectEvents(c,'contact_channel_click',1);
    await c.page.keyboard.press('Escape');await c.page.locator('[data-open-party]').first().click();assert.equal(await f.locator('[name=event]').inputValue(),'');assert.equal(await f.locator('#party-unpublished').getAttribute('aria-pressed'),'false');await c.page.keyboard.press('Escape');
   });
   await runCase('revocation keeps media, clears only owned cookies and synchronizes tabs',{initial:allowedChoice(true,true)},async c=>{
    await go(c);await waitTag(c);await c.page.getByRole('button',{name:'Reproducir video de fondo',exact:true}).click();
    const src=await c.page.locator('video').getAttribute('src');assert(src);
    await c.page.evaluate(()=>{document.cookie='auth_keep=QA; Path=/';document.cookie='_ga=QA_FOREIGN; Path=/';});
    const second=await c.context.newPage();await second.goto(c.site+'/#/halloween');await second.locator('.prelaunch').waitFor();await settle();
    const other={...c,page:second};await preferences(other,true,false);
    await c.page.waitForFunction(()=>window['ga-disable-G-L5DRMC7Z1F']===true);const cut=stamp();report.cuts.push({case:c.name,at:cut,reason:'revoked across tabs'});
    const before=events(c).length;await clickInstagram(c);await sleep(mode==='official'?6500:250);assert.equal(events(c).length,before);
    assert.equal(await c.page.locator('video').getAttribute('src'),src);
    const names=await c.page.evaluate(()=>document.cookie.split(';').map(x=>x.trim().split('=')[0]));
    assert(names.includes('auth_keep')&&names.includes('_ga'));assert(!names.some(x=>x.startsWith('tairet_b3_ga')));
   });
   await runCase('blocked storage retains explicit choice in memory',{storageBlocked:true},async c=>{
    await go(c);await preferences(c,false,true);await waitTag(c);assert(await c.page.locator('.pl-storage-notice').isVisible());await clickInstagram(c);await expectEvents(c,'social_link_click',1);
    await c.page.evaluate(()=>{location.hash='#/asuncion'});await c.page.locator('.pl-asuncion').waitFor();await c.page.evaluate(()=>{location.hash='#/halloween'});await c.page.locator('.pl-halloween').waitFor();await settle();await expectViewCount(c,3);
   });
   const operational=['/auth/login?qa=QA_MiXto','/payments/access/status?ref=QA_REF_aBc','/access/checkin/QA_ACCESS_aBc','/confirmacion-compra?order=QA_ORDER_aBc','/reservar/Bar_QA_aBc?qa=QA_MiXto'];
   for(const route of operational){
    await runCase('direct excluded '+route.split('?')[0],{initial:allowedChoice()},async c=>{
     await c.page.goto(c.site+'/#'+route);await sleep(400);assert.equal(await c.page.locator('.prelaunch').count(),0);assert.equal(c.requests.filter(x=>['tag','collect'].includes(x.kind)).length,0);
    });
   }
   await runCase('loaded tag public to Access to public with no operational send',{initial:allowedChoice()},async c=>{
    await go(c);await waitTag(c);
    for(const route of operational){
     const before=events(c).length;await c.page.evaluate(x=>{location.hash='#'+x},route);await c.page.waitForFunction(()=>window['ga-disable-G-L5DRMC7Z1F']===true);
     const cut=stamp();report.cuts.push({case:c.name,at:cut,reason:'excluded route'});await sleep(mode==='official'?6500:250);assert.equal(events(c).length,before);
     assert.equal(new URL(c.page.url()).hash,'#'+route);
     await c.page.evaluate(()=>{location.hash='#/halloween'});await c.page.locator('.pl-halloween').waitFor();await settle();await expectViewCount(c,1+operational.indexOf(route)+1);
    }
    assert.equal(c.requests.filter(x=>x.kind==='tag').length,1);
   });
   for(const cut of ['revocation','Access']){
    await runCase('late loader after '+cut,{initial:allowedChoice(),tagDelay:1200},async c=>{
     await c.page.goto(c.site+'/#/halloween');await c.page.locator('.prelaunch').waitFor();
     await c.page.waitForFunction(()=>!!document.querySelector('#tairet-ga4-script'));
     if(cut==='revocation')await preferences(c,false,false);else{await c.page.evaluate(()=>{location.hash='#/access/checkin/QA_ACCESS_aBc'});await c.page.waitForFunction(()=>window['ga-disable-G-L5DRMC7Z1F']===true);}
     await sleep(1600);assert.equal(events(c).length,0);assert.equal(await c.page.evaluate(()=>window['ga-disable-G-L5DRMC7Z1F']),true);
    });
   }
   await runCase('blocked Google does not block Instagram or navigation',{initial:allowedChoice(),tagError:true},async c=>{await go(c);await clickInstagram(c);assert.equal(events(c).length,0);await c.page.evaluate(()=>{location.hash='#/asuncion'});await c.page.locator('.pl-asuncion').waitFor();});
   if(mode==='fixture'){
    await runCase('tag timeout and late completion remain disabled',{initial:allowedChoice(),tagDelay:8500},async c=>{await go(c);await clickInstagram(c);await sleep(9000);assert.equal(events(c).length,0);assert.equal(c.requests.filter(x=>x.kind==='tag').length,1);});
    await runCase('responsive Instagram and preferences, keyboard and effective themes',{fonts:true},async c=>{
     for(const width of [320,390,768,860,861,1440])for(const theme of ['dark','light']){
      await c.page.setViewportSize({width,height:1000});await go(c);
      if(await c.page.locator('.prelaunch').getAttribute('data-theme')!==theme)await c.page.locator('header [data-theme-toggle]').click();
      await c.page.evaluate(()=>document.fonts.ready);
      if(await c.page.locator('#r4-cookie-banner').isVisible()){await snapshot(c,'banner-'+width+'-'+theme+'.png');await c.page.locator('#r4-cookie-banner [data-r4-cookie-reject]').click();}
      const notice=c.page.locator('[data-social-placement="halloween_hero"]');await notice.scrollIntoViewIfNeeded();
      const hero=await c.page.locator('.hw16-hero').boundingBox(),noticeBox=await notice.boundingBox();assert(noticeBox.y>=hero.y&&noticeBox.y+noticeBox.height<=hero.y+hero.height+2);
      await c.page.keyboard.press('Tab');await notice.focus();
      const focus=await notice.evaluate(n=>({visible:n.matches(':focus-visible'),style:getComputedStyle(n).outlineStyle,width:getComputedStyle(n).outlineWidth,font:getComputedStyle(n).fontFamily}));
      assert(focus.visible&&focus.style!=='none'&&parseFloat(focus.width)>=2);assert(focus.font.includes('Inter'));
      report.captures.push({kind:'instagram-focus',width,theme,focus});
      await snapshot(c,'instagram-'+width+'-'+theme+'.png');
      await openPreferences(c);await c.page.locator('#r4-analytics-toggle').focus();await c.page.keyboard.press('Tab');
      await snapshot(c,'preferences-'+width+'-'+theme+'.png');await c.page.keyboard.press('Escape');
     }
    });
   }
  }
 }catch(e){report.errors.push({type:'runner',message:e.stack});}
 finally{
  if(browser)await browser.close();
  report.status=report.violations.length||report.errors.length||report.results.some(x=>x.status==='FAIL')?'FAIL':'PASS';
  fs.writeFileSync(path.join(evidence,'PRUEBAS','analytics.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({status:report.status,mode,control,cases:report.results.length,violations:report.violations,errors:report.errors.map(x=>({type:x.type,message:x.message?.slice(0,350)})),library:report.tagLibraries}));
  if(report.status==='FAIL')process.exitCode=1;
 }
})();
