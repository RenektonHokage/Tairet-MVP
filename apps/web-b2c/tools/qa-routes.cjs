const assert=require('node:assert/strict'),path=require('node:path');
const q=require('./qa-support.cjs'),evidence=process.argv[2];q.prepare(evidence);const r=q.report();
(async()=>{let browser;
 try{
  browser=await q.chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  await q.isolate(context,r);const page=await context.newPage();page.setDefaultTimeout(10000);q.observe(page,r);
  await page.addInitScript(()=>{localStorage.setItem('tairet-theme','dark');localStorage.setItem('tairet-privacy-v1',JSON.stringify({version:1,savedAt:Date.now(),external:false}));});
  async function pre(route){await page.goto(q.base+'/#'+route);await page.locator('.prelaunch').waitFor();}
  await pre('/inicio');
  await page.locator('.cinema-copy a[href="#/halloween"]').click();await page.locator('.pl-halloween').waitFor();
  await page.goBack();await page.locator('.cinema-hero').waitFor();await page.goForward();await page.locator('.pl-halloween').waitFor();
  await page.evaluate(()=>{location.hash='#/inicio'});await page.locator('.cinema-hero').waitFor();
  await page.evaluate(()=>{location.hash='#/eventos/?origen=QA_Mixto'});await page.waitForURL('**/#/halloween?origen=QA_Mixto');
  await page.goBack();assert.equal(new URL(page.url()).hash,'#/inicio','Events alias must replace its history entry');
  await page.goForward();assert.equal(new URL(page.url()).hash,'#/halloween?origen=QA_Mixto');
  r.records.push({test:'real navigation, Events replace and history',...(await q.state(page))});
  await page.evaluate(()=>{location.hash='#/Legal/Cookies/'});await page.locator('.prelaunch[data-route=cookies]').waitFor();
  await page.reload();await page.locator('.prelaunch[data-route=cookies]').waitFor();await page.goBack();assert.equal(new URL(page.url()).hash,'#/halloween?origen=QA_Mixto');
  await page.goForward();assert.equal(new URL(page.url()).hash,'#/Legal/Cookies/');
  r.records.push({test:'equivalent legal direct reload history',...(await q.state(page))});
  for(const route of ['/halloween/no-existe','/halloweenish','/asuncion-extra','/legal/no-existe','/access/no-existe']){
   await page.goto(q.base+'/#'+route);if(route==='/legal/no-existe'){await page.locator('main article.prose').waitFor();await page.waitForFunction(()=>document.title==='Contenido | Tairet');}else await page.getByRole('heading',{name:'404',exact:true}).waitFor();
   assert.equal(await page.locator('.prelaunch').count(),0,route);assert.equal(new URL(page.url()).hash,'#'+route);
   r.records.push({test:'unknown remains unknown',input:route,preLayout:false,...await q.state(page)});
  }
  const expected404=new Set(['/halloween/no-existe','/halloweenish','/asuncion-extra','/access/no-existe'].map(p=>'404 Error: User attempted to access non-existent route: '+p));
  r.candidateErrors=r.candidateErrors.filter(e=>{if(e.type==='console'&&e.location.url===q.base+'/src/pages/NotFound.tsx'&&expected404.has(e.message)){r.expectedSynthetic.push({...e,reason:'Explicit unknown-route negative control; original NotFound component'});return false;}return true;});
  const operational=[
   ['/auth/login?origen=QA_MiXto','Iniciar sesión'],
   ['/payments/access/status?ref=QA_aBc123456&origen=QA_MiXto',/No encontramos esta referencia de pago\.|No pudimos consultar el estado\./],
   ['/access/checkin/A1b2C3d4-1111-4222-8333-aBcDeF123456?origen=QA_MiXto','Entrada para validar'],
   ['/confirmacion-compra?origen=QA_MiXto','¡Compra Exitosa!'],
   ['/reservar/Bar_QA_aBc?origen=QA_MiXto','Solicitud de reserva']
  ];
  for(const [route,heading] of operational){
   await pre('/halloween');await page.locator('[data-open-party]').first().click();assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
   await page.evaluate(route=>{location.hash='#'+route},route);await page.getByRole('heading',{name:heading,exact:true}).waitFor();
   assert.equal(await page.locator('.prelaunch').count(),0);assert.equal(new URL(page.url()).hash,'#'+route);
   assert.equal(await page.locator('dialog[open]').count(),0);assert.notEqual(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
   assert.equal(await page.locator('link[data-prelaunch-fonts]').count(),0);
   r.records.push({test:'original operational component mounted with synthetic response',input:route,heading:(await page.getByRole('heading',{name:heading,exact:true}).innerText()),...await q.state(page)});
   await page.reload();await page.getByRole('heading',{name:heading,exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'#'+route);
   await page.evaluate(()=>{location.hash='#/halloween'});await page.locator('.pl-halloween').waitFor();
   await page.locator('[data-open-party]').first().click();assert.equal(await page.locator('#party-form [name=event]').inputValue(),'');await page.keyboard.press('Escape');
  }
  await pre('/inicio');await page.evaluate(()=>scrollTo({top:600,behavior:'smooth'}));await page.waitForTimeout(700);assert(await page.locator('header.header').evaluate(n=>n.classList.contains('is-scroll-locked')));
  await page.screenshot({path:path.join(evidence,'CAPTURAS','normal-motion-scrolled-header.png')});
  r.records.push({test:'normal motion real smooth scroll',reducedMotion:await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),...await q.state(page)});
 }catch(e){r.environmentErrors.push({type:'executor-or-assertion',message:e.stack});}
 finally{if(browser)await browser.close();q.finish(r);q.save(evidence,'routes.json',r);console.log(JSON.stringify({status:r.status,records:r.records.length,candidateErrors:r.candidateErrors,environmentErrors:r.environmentErrors,failures:r.failures}));if(r.status==='FAIL')process.exitCode=1;}
})();
