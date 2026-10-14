const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.QA_PLAYWRIGHT);
const base=process.env.QA_BASE_URL||'http://127.0.0.1:4173';
function prepare(evidence){
 if(!evidence||!/(?:b2_1|b3|b4)/.test(path.resolve(evidence)))throw Error('Use a new b2_1, b3 or b4 evidence directory, never historical evidence.');
 for(const d of ['PRUEBAS','CAPTURAS'])fs.mkdirSync(path.join(evidence,d),{recursive:true});
}
function save(evidence,name,data){fs.writeFileSync(path.join(evidence,'PRUEBAS',name),JSON.stringify(data,null,2),{flag:'wx'});}
async function isolate(context,report,fonts=false){
 await context.route('**/*',async r=>{
  const u=new URL(r.request().url());
  if(u.origin===new URL(base).origin)return r.continue();
  if(fonts&&['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return r.continue();
  report.requests.push({host:u.hostname,path:u.pathname,method:r.request().method(),intercepted:true});
  if(u.port==='4199')return r.fulfill({status:404,contentType:'application/json',body:'{"error":"Synthetic not found"}'});
  return r.fulfill({status:200,body:'',contentType:u.hostname==='fonts.googleapis.com'?'text/css':'text/plain'});
 });
}
function observe(page,report,kind='candidate'){
 page.on('pageerror',e=>report[kind+'Errors'].push({type:'pageerror',message:e.message}));
 page.on('console',m=>{
  if(m.type()!=='error')return;
  const location=m.location();
  if(location.url?.startsWith('http://127.0.0.1:4199/')&&m.text()==='Failed to load resource: the server responded with a status of 404 (Not Found)'){
   report.expectedSynthetic.push({type:'console',message:m.text(),url:location.url});return;
  }
  report[kind+'Errors'].push({type:'console',message:m.text(),location});
 });
}
async function state(page){
 return page.evaluate(()=>({
  effectiveUrl:location.href,title:document.title,viewport:{width:innerWidth,height:innerHeight},
  appliedTheme:document.querySelector('.prelaunch')?.getAttribute('data-theme')||document.documentElement.getAttribute('data-theme'),
  route:document.querySelector('.prelaunch')?.getAttribute('data-route')||document.body.getAttribute('data-route'),
  scrollY,overflow:document.documentElement.scrollWidth>innerWidth,
  scrollWidth:document.documentElement.scrollWidth,fontsStatus:document.fonts.status,
  loadedFonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),
  frameworkOverlay:!!document.querySelector('vite-error-overlay'),
  meaningful:document.body.innerText.trim().length>20
 }));
}
function report(){return {baseUrl:base,status:'RUNNING',records:[],failures:[],candidateErrors:[],referenceErrors:[],environmentErrors:[],expectedSynthetic:[],requests:[]};}
async function inject(page){
 const mode=process.env.QA_CONTROL;
 if(!mode||mode==='clean')return;
 if(mode==='candidate-error')await page.evaluate(()=>{setTimeout(()=>{throw Error('QA_CONTROLLED_CANDIDATE_ERROR')},0);});
 else if(mode==='overflow')await page.evaluate(()=>{const n=document.createElement('div');n.id='qa-controlled-overflow';n.style.cssText='position:absolute;top:0;left:0;width:calc(100vw + 160px);height:1px;pointer-events:none';document.documentElement.append(n);});
 else throw Error('Unknown QA_CONTROL');
 await page.waitForTimeout(50);
}
function finish(r){
 r.failures.push(...r.records.filter(x=>x.kind!=='reference'&&x.overflow).map(x=>({type:'overflow',route:x.route,viewport:x.viewport,control:process.env.QA_CONTROL||null})));
 r.failures.push(...r.records.filter(x=>x.kind!=='reference'&&(x.frameworkOverlay||x.meaningful===false)).map(x=>({type:'incorrect-render',route:x.route})));
 r.referenceErrors.push(...r.records.filter(x=>x.kind==='reference'&&x.overflow).map(x=>({type:'reference-overflow',route:x.route,viewport:x.viewport})));
 r.status=r.failures.length||r.candidateErrors.length||r.referenceErrors.length||r.environmentErrors.length?'FAIL':'PASS';
 return r;
}
module.exports={chromium,base,prepare,save,isolate,observe,state,report,inject,finish};
