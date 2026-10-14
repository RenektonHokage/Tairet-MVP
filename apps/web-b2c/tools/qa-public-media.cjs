const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {chromium}=require(process.env.QA_PLAYWRIGHT);
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true}),c=await b.newContext({viewport:{width:860,height:1000},reducedMotion:'no-preference'});
const attempts=[],failures=[],results=[];await c.route('**/*',r=>{
const u=new URL(r.request().url());if(u.origin==='http://127.0.0.1:4173')return r.continue();
if(['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname))return r.continue();
if(u.hostname==='media.tairet.com.py'&&/^\/halloween\/2026\/videos\/videos\/halloween-(mobile|desktop)-18s\.mp4$/.test(u.pathname)){attempts.push(u.pathname);return r.continue();}
return r.fulfill({status:200,body:'',contentType:'text/plain'});
});
const p=await c.newPage();p.setDefaultTimeout(10000);p.on('requestfailed',r=>{const u=new URL(r.url());failures.push({host:u.hostname,path:u.pathname,error:r.failure()?.errorText});});
await p.addInitScript(()=>localStorage.setItem('tairet-theme','dark'));
try{
await p.goto('http://127.0.0.1:4173/#/halloween');await p.locator('.hw16-hero').waitFor();assert.equal(attempts.length,0);
await p.locator('#r4-cookie-banner [data-r4-cookie-accept]').click();
for(const width of [860,861]){
 await p.setViewportSize({width,height:1000});
 await p.waitForFunction(()=>{const v=document.querySelector('video');return v.readyState>=2&&v.videoWidth>0&&v.currentTime>0;},{},{timeout:25000});
 const video=await p.locator('video').evaluate(v=>({src:v.getAttribute('src'),width:v.videoWidth,height:v.videoHeight,duration:v.duration,time:v.currentTime,paused:v.paused}));
 results.push({viewport:width,status:'PASS',video});
 if(width===860)await p.waitForTimeout(100);
}
await p.locator('video').evaluate(v=>v.pause());
}catch(e){results.push({status:'NO_VERIFICADO',reason:e.message.slice(0,300)});}
fs.writeFileSync(path.join(process.argv[2],'PRUEBAS','public-media.json'),JSON.stringify({results,attempts,failures,note:'Only approved R2 MP4 and Google Fonts reads allowed. No files downloaded or changed in R2.'},null,2));console.log(JSON.stringify({results,attempts,failures}));await b.close();
})().catch(e=>{console.error(e.message);process.exitCode=1});
