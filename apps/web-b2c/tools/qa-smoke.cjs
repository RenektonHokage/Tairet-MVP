const assert=require('node:assert/strict'),path=require('node:path');
const q=require('./qa-support.cjs'),evidence=process.argv[2];q.prepare(evidence);
const r=q.report();r.control=process.env.QA_CONTROL||null;
(async()=>{let browser;
 try{
  browser=await q.chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await q.isolate(context,r);
  const page=await context.newPage();page.setDefaultTimeout(10000);q.observe(page,r);
  await page.addInitScript(()=>{localStorage.setItem('tairet-theme','dark');localStorage.setItem('tairet-privacy-v1',JSON.stringify({version:1,savedAt:Date.now(),external:false}));});
  async function go(route,theme){
   await page.goto(q.base+'/#'+route);await page.locator('.prelaunch').waitFor();
   if(await page.locator('.prelaunch').getAttribute('data-theme')!==theme)await page.locator('header [data-theme-toggle]').click();
   await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(120);
  }
  const widths=r.control?[390]:[320,390,768,860,861,1440],themes=r.control?['dark']:['dark','light'],routes=r.control?['/inicio']:['/inicio','/asuncion','/halloween'];
  for(const width of widths)for(const theme of themes)for(const route of routes){
   await page.setViewportSize({width,height:1000});await go(route,theme);await q.inject(page);
   const actual=await q.state(page),mainCount=await page.locator('main').count();
   r.records.push({requestedRoute:route,requestedTheme:theme,kind:'candidate',mainCount,...actual});
   assert.equal(actual.appliedTheme,theme);assert.equal(actual.route,route==='/inicio'?'home':route.slice(1));assert.equal(mainCount,1);
   if(width===390||width===1440)await page.screenshot({path:path.join(evidence,'CAPTURAS','candidate-'+route.slice(1)+'-'+width+'-'+theme+'.png')});
  }
  if(!r.control)for(const route of ['/informacion','/sobre/que-es-tairet','/sobre/como-funciona','/sobre/preguntas-frecuentes','/para-locales/bares','/para-locales/discotecas','/para-locales/organizadores','/para-locales/solicitud','/contacto','/legal/terminos-condiciones','/legal/politica-privacidad','/legal/cookies','/mapa','/club/demo','/bar/demo','/evento/demo','/explorar','/zona/san-bernardino']){
   await go(route,'dark');const actual=await q.state(page);r.records.push({requestedRoute:route,kind:'candidate',...actual});
   assert.equal(await page.locator('#tairet-footer').count(),1);assert((await page.locator('h1:visible').allTextContents()).join('').length>0);
  }
 }catch(e){if(e.code==='ERR_ASSERTION'){const failure={type:'assertion',message:e.message};if(e.qaKind==='reference')r.referenceErrors.push(failure);else r.failures.push(failure);}else r.environmentErrors.push({type:'executor',message:e.stack});}
 finally{
  if(browser)try{await browser.close();}catch(e){r.environmentErrors.push({type:'browser-close',message:e.message});}
  q.finish(r);q.save(evidence,'smoke.json',r);console.log(JSON.stringify({status:r.status,records:r.records.length,failures:r.failures,candidateErrors:r.candidateErrors,environmentErrors:r.environmentErrors}));
  if(r.status==='FAIL')process.exitCode=1;
 }
})();
