const fs=require('node:fs'),path=require('node:path');const {chromium}=require(process.env.QA_PLAYWRIGHT);
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await c.route('**/*',r=>new URL(r.request().url()).origin==='http://127.0.0.1:4173'?r.continue():r.fulfill({status:200,body:'',contentType:'text/css'}));
const p=await c.newPage();await p.setContent(fs.readFileSync(process.argv[2],'utf8'));const q=await c.newPage();await q.addInitScript(()=>localStorage.setItem('tairet-theme','dark'));
const records=[];
for(const route of ['inicio','asuncion','halloween']){await p.evaluate(r=>location.hash='#/'+r,route);await q.goto('http://127.0.0.1:4173/#/'+route);await q.locator('.prelaunch').waitFor();await p.waitForTimeout(100);
for(const [kind,page] of [['reference',p],['candidate',q]])records.push({route,kind,values:await page.evaluate(({route,kind})=>{
const root=kind==='reference'&&route!=='inicio'?document.querySelector('#tu-'+route).shadowRoot:document;
const selectors=route==='inicio'?['.cinema-hero','.cinema-copy','.cinema-scenes','.cinema-next']:route==='asuncion'?['.tu-body','main','.hero','.paths']:['.tu-body','main','.hw16-hero','.h16-content','.h16-actions','.h16-cta','.fixed-video-stage','.h16-topline'];
return selectors.map(s=>{const el=root.querySelector(s);if(!el)return {s};const cs=getComputedStyle(el),r=el.getBoundingClientRect();return {s,cls:el.className,box:{x:r.x,y:r.y,w:r.width,h:r.height},css:Object.fromEntries(['display','position','height','minHeight','paddingTop','paddingBottom','marginTop','gap','justifyContent','alignItems','backgroundColor','fontFamily','lineHeight'].map(k=>[k,cs[k]]))}});},{route,kind})});}
console.log(JSON.stringify(records,null,2));await b.close();})().catch(e=>{console.error(e);process.exitCode=1});
