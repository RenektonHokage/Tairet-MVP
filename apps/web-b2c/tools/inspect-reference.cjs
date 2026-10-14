const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.QA_PLAYWRIGHT);
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.route('**/*',route=>route.fulfill({status:200,body:'',contentType:'text/plain'}));
 const page=await context.newPage();
 const html=fs.readFileSync(process.argv[2],'utf8');
 await page.setContent(html,{waitUntil:'domcontentloaded'});
 const data=await page.evaluate(()=>{
  const describe=(n)=>({tag:n.tagName,id:n.id,cls:n.className,page:n.getAttribute('data-page'),text:n.textContent.replace(/\s+/g,' ').slice(0,170)});
  const templates=[...document.querySelectorAll('template')].map(t=>({id:t.id,body:[...t.content.querySelectorAll('.tu-body > *,main > *,dialog')].map(describe)}));
  return {pages:[...document.querySelectorAll('main > [data-page]')].map(describe),templates,forms:[...document.querySelectorAll('form')].map(f=>({id:f.id,fields:[...f.querySelectorAll('input,textarea,select,button')].map(x=>({tag:x.tagName,name:x.name,id:x.id,type:x.type,text:x.textContent.slice(0,80),required:x.required}))}))};
 });
 fs.writeFileSync(path.join(process.argv[3],'reference-structure.json'),JSON.stringify(data,null,2));
 console.log(JSON.stringify(data,null,2));
 for(const [route,name] of [['inicio','inicio'],['asuncion','asuncion'],['halloween','halloween']]){
  await page.evaluate(r=>{location.hash='#/'+r},route); await page.waitForTimeout(350);
  await page.screenshot({path:path.join(process.argv[3],'CAPTURAS','reference-'+name+'-1440.png')});
 }
 await browser.close();
})().catch(e=>{console.error(e.message);process.exitCode=1});
