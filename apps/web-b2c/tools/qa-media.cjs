const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {chromium}=require(process.env.QA_PLAYWRIGHT);
const evidence=process.argv[2],base='http://127.0.0.1:4173',results=[];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
async function scenario(name,opts,fn){let context;try{
 context=await browser.newContext({viewport:{width:opts.width??860,height:950},reducedMotion:opts.reduced?'reduce':'no-preference'});
 const media=[];await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();if(u.pathname.endsWith('.mp4'))media.push(u.pathname);return r.fulfill({status:u.pathname.endsWith('.mp4')?204:200,body:'',contentType:'text/css'});});
 await context.addInitScript(opts=>{
  localStorage.setItem('tairet-theme','dark');if(opts.accepted)localStorage.setItem('tairet-privacy-v1',JSON.stringify({version:1,savedAt:Date.now(),external:true}));
  window.mediaQA={plays:0,pauses:0,hidden:false,reject:!!opts.reject,saveData:!!opts.saveData};
  const connection=new EventTarget();Object.defineProperty(connection,'saveData',{get:()=>window.mediaQA.saveData});Object.defineProperty(navigator,'connection',{value:connection,configurable:true});
  Object.defineProperty(document,'hidden',{get:()=>window.mediaQA.hidden,configurable:true});
  const states=new WeakMap();Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return states.get(this)!==false},configurable:true});
  HTMLMediaElement.prototype.load=function(){};
  HTMLMediaElement.prototype.play=function(){window.mediaQA.plays++;if(window.mediaQA.reject)return Promise.reject(new DOMException('Synthetic autoplay rejection','NotAllowedError'));states.set(this,false);this.dispatchEvent(new Event('playing'));return Promise.resolve();};
  HTMLMediaElement.prototype.pause=function(){window.mediaQA.pauses++;states.set(this,true);this.dispatchEvent(new Event('pause'));};
 },opts);
 const p=await context.newPage();await p.goto(base+'/#/halloween');await p.locator('.hw16-hero').waitFor();await p.waitForTimeout(120);
 await fn(p,media);results.push({name,status:'PASS',mediaRequests:media});
 }catch(e){results.push({name,status:'FAIL',reason:e.stack.slice(0,1200)});}finally{await context?.close();}console.log(JSON.stringify(results.at(-1)));}
await scenario('no MP4 before consent; reduced motion requires explicit play; 860/861 selection',{reduced:true},async(p,media)=>{
 assert.equal(media.length,0);assert.equal(await p.locator('video').getAttribute('src'),null);
 await p.locator('#r4-cookie-banner [data-r4-cookie-accept]').click();await p.waitForTimeout(100);assert.equal(await p.locator('video').getAttribute('src'),null);
 await p.getByRole('button',{name:'Reproducir video de fondo',exact:true}).click();
 assert((await p.locator('video').getAttribute('src')).endsWith('halloween-mobile-18s.mp4'));
 await p.setViewportSize({width:861,height:950});await p.waitForTimeout(150);assert((await p.locator('video').getAttribute('src')).endsWith('halloween-desktop-18s.mp4'));
 await p.getByRole('button',{name:'Pausar video de fondo',exact:true}).click();assert(await p.locator('video').evaluate(v=>v.paused));
 await p.getByRole('button',{name:'Reproducir video de fondo',exact:true}).click();assert(!(await p.locator('video').evaluate(v=>v.paused)));
 await p.evaluate(()=>{window.mediaQA.hidden=true;document.dispatchEvent(new Event('visibilitychange'));});assert(await p.locator('video').evaluate(v=>v.paused));
 await p.evaluate(()=>{window.mediaQA.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
 await p.setViewportSize({width:861,height:300});await p.locator('#tairet-footer').scrollIntoViewIfNeeded();await p.waitForTimeout(200);assert(await p.locator('video').evaluate(v=>v.paused),'pause after hero leaves viewport');
 await p.getByRole('button',{name:'Configurar cookies',exact:true}).click();await p.locator('#r4-cookie-dialog [data-r4-cookie-reject]').click();assert.equal(await p.locator('video').getAttribute('src'),null);
 await p.locator('header.header .brand').click();assert.equal(await p.locator('video').count(),0);
});
await scenario('detectable data saver prevents automatic MP4 loading',{accepted:true,saveData:true},async(p,media)=>{assert.equal(media.length,0);assert.equal(await p.locator('video').getAttribute('src'),null);});
await scenario('autoplay rejection retains poster and permits manual retry',{accepted:true,reject:true},async p=>{
 await p.getByText('El video no está disponible. Se conserva la portada.',{exact:true}).waitFor({state:'attached'});
 assert.equal(await p.locator('.hw16-hero').getAttribute('data-media-frame'),'false');
 await p.evaluate(()=>window.mediaQA.reject=false);await p.getByRole('button',{name:'Reproducir video de fondo',exact:true}).click();assert((await p.evaluate(()=>window.mediaQA.plays))>=2);
});
await scenario('media error keeps fallback',{accepted:true},async p=>{
 await p.locator('video').evaluate(v=>v.dispatchEvent(new Event('error')));assert.equal(await p.locator('.hw16-hero').getAttribute('data-media-frame'),'false');
});
fs.writeFileSync(path.join(evidence,'PRUEBAS','media.json'),JSON.stringify({method:'Controlled HTMLMediaElement fixture and intercepted network; not real MP4 decode or public R2 availability.',results},null,2));
await browser.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
