const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const q=require('./qa-support.cjs'),evidence=process.argv[2],reference=process.argv[3];q.prepare(evidence);
const r=q.report();r.control=process.env.QA_CONTROL||null;r.method='Same Edge context, actual theme, viewport, reduced motion, public approved fonts; external media mocked empty.';
(async()=>{let browser;
 try{
  browser=await q.chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await q.isolate(context,r,true);
  const ref=await context.newPage(),candidate=await context.newPage();ref.setDefaultTimeout(10000);candidate.setDefaultTimeout(10000);
  q.observe(ref,r,'reference');q.observe(candidate,r);
  await ref.setContent(fs.readFileSync(reference,'utf8'));await ref.locator('#r4-cookie-banner [data-r4-cookie-reject]').click();
  await candidate.addInitScript(()=>{localStorage.setItem('tairet-theme','dark');localStorage.setItem('tairet-privacy-v1',JSON.stringify({version:1,savedAt:Date.now(),external:false}));});
  for(const width of (r.control?[390]:[1440,390])){
   await ref.setViewportSize({width,height:1000});await candidate.setViewportSize({width,height:1000});
   for(const theme of (r.control?['dark']:['dark','light']))for(const route of (r.control?['inicio']:['inicio','asuncion','halloween'])){
    await ref.evaluate(x=>{location.hash='#/'+x},route);await candidate.goto(q.base+'/#/'+route);await candidate.locator('.prelaunch').waitFor();
    if(await ref.locator('html').getAttribute('data-theme')!==theme)await ref.locator('body > header [data-theme-toggle]').click();
    if(await candidate.locator('.prelaunch').getAttribute('data-theme')!==theme)await candidate.locator('header.header [data-theme-toggle]').click();
    for(const [kind,p] of [['reference',ref],['candidate',candidate]]){
     await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(120);
     if(kind==='candidate')await q.inject(p);
     const actual=await q.state(p);
     r.records.push({kind,requestedRoute:route,requestedTheme:theme,...actual});
     try{assert.equal(actual.appliedTheme,theme);assert.equal(actual.route,route==='inicio'?'home':route);
     assert(actual.meaningful);assert(!actual.frameworkOverlay);}catch(e){e.qaKind=kind;throw e;}
     await p.screenshot({path:path.join(evidence,'CAPTURAS',kind+'-'+route+'-'+width+'-'+theme+'-final.png'),fullPage:true});
    }
   }
  }
 }catch(e){if(e.code==='ERR_ASSERTION'){const failure={type:'assertion',message:e.message};if(e.qaKind==='reference')r.referenceErrors.push(failure);else r.failures.push(failure);}else r.environmentErrors.push({type:'executor',message:e.stack});}
 finally{
  if(browser)try{await browser.close();}catch(e){r.environmentErrors.push({type:'browser-close',message:e.message});}
  q.finish(r);q.save(evidence,'visual-final.json',r);console.log(JSON.stringify({status:r.status,captures:r.records.length,failures:r.failures,candidateErrors:r.candidateErrors,referenceErrors:r.referenceErrors,environmentErrors:r.environmentErrors}));
  if(r.status==='FAIL')process.exitCode=1;
 }
})();
