const assert=require('node:assert/strict'),path=require('node:path');
const q=require('./qa-support.cjs'),evidence=process.argv[2];q.prepare(evidence);const r=q.report();
(async()=>{let browser;
 try{
  browser=await q.chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await q.isolate(context,r);const page=await context.newPage();q.observe(page,r);
  await page.addInitScript(()=>localStorage.setItem('tairet-theme','light'));
  const staticResponses=[];page.on('response',response=>{if(new URL(response.url()).origin===new URL(q.base).origin)staticResponses.push({path:new URL(response.url()).pathname,status:response.status()});});
  for(const [route,expected] of [['/inicio','home'],['/halloween','halloween'],['/Legal/Cookies/','cookies']]){
   await page.goto(q.base+'/#'+route);await page.locator('.prelaunch[data-route="'+expected+'"]').waitFor();await page.evaluate(()=>document.fonts.ready);
   if(await page.locator('#r4-cookie-banner').isVisible())await page.locator('#r4-cookie-banner [data-r4-cookie-reject]').click();
   assert.equal(await page.locator('h1').count()>0,true);r.records.push({test:'built route',requestedRoute:route,...await q.state(page)});
   await page.screenshot({path:path.join(evidence,'CAPTURAS','built-'+expected+'.png')});
  }
  const token='A1b2C3d4-1111-4222-8333-aBcDeF123456',route='/access/checkin/'+token+'?origen=QA_MiXto';
  await page.goto(q.base+'/#'+route);await page.getByRole('heading',{name:'Entrada para validar',exact:true}).waitFor();
  assert.equal(await page.locator('.prelaunch').count(),0);assert.equal(new URL(page.url()).hash,'#'+route);
  r.records.push({test:'built operational synthetic mount',...await q.state(page)});
  assert(staticResponses.some(x=>/\/assets\/.+\.js$/.test(x.path)&&x.status===200));
  assert(staticResponses.some(x=>/\/assets\/.+\.css$/.test(x.path)&&x.status===200));
  assert(!staticResponses.some(x=>x.status>=400));r.staticResponses=staticResponses;
 }catch(e){r.environmentErrors.push({message:e.stack});}
 finally{if(browser)await browser.close();q.finish(r);q.save(evidence,'build-preview.json',r);console.log(JSON.stringify({status:r.status,records:r.records.length,failures:r.failures,candidateErrors:r.candidateErrors,environmentErrors:r.environmentErrors}));if(r.status==='FAIL')process.exitCode=1;}
})();
