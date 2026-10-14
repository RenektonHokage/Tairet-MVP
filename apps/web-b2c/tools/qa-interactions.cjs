const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');const {chromium}=require(process.env.QA_PLAYWRIGHT);
const base='http://127.0.0.1:4173',evidence=process.argv[2],results=[],network=[],pageErrors=[];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin===base)return r.continue();network.push({host:u.hostname,path:u.pathname,method:r.request().method()});return r.fulfill({status:u.port==='4199'?404:200,body:u.port==='4199'?'{"error":"Synthetic not found"}':'',contentType:u.port==='4199'?'application/json':'text/css'});});
const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>pageErrors.push(e.message));
await page.addInitScript(()=>localStorage.setItem('tairet-theme','dark'));
async function go(route){await page.goto(base+'/#'+route);await page.locator('.prelaunch').waitFor();}
async function check(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',reason:e.message.slice(0,350)});}console.log(JSON.stringify(results.at(-1)));}
await check('first visit, reject, reload, accept, revoke',async()=>{
 await go('/inicio');assert(await page.locator('#r4-cookie-banner').isVisible());
 await page.locator('#r4-cookie-banner [data-r4-cookie-reject]').click();assert(!(await page.locator('#r4-cookie-banner').isVisible()));
 await page.reload();await page.locator('.prelaunch').waitFor();assert(!(await page.locator('#r4-cookie-banner').isVisible()));
 await page.getByRole('button',{name:'Configurar cookies',exact:true}).click();
 await page.locator('#r4-cookie-dialog [data-r4-cookie-accept]').click();
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tairet-privacy-v1')));assert.equal(saved.external,true);assert.equal(saved.analytics,true);assert.equal(saved.advertising,false);
 await page.getByRole('button',{name:'Configurar cookies',exact:true}).click();await page.locator('#r4-cookie-dialog [data-r4-cookie-reject]').click();
 saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('tairet-privacy-v1')));assert.equal(saved.external,false);
});
await check('root, aliases, navigation, reload, back and forward',async()=>{
 await page.goto(base+'/');await page.locator('.prelaunch').waitFor();assert.equal(new URL(page.url()).hash,'');await page.reload();await page.locator('.cinema-hero').waitFor();
 await go('/');await page.locator('.cinema-copy a[href="#/halloween"]').first().click();await page.waitForURL('**/#/halloween');
 await page.goBack();assert.equal(new URL(page.url()).hash,'#/');
 await page.goForward();assert.equal(new URL(page.url()).hash,'#/halloween');
 await go('/eventos?qa=alias');await page.waitForURL('**/#/halloween?qa=alias');
 await page.reload();await page.locator('.hw16-hero').waitFor();
});
await check('footer return restores scroll',async()=>{
 await go('/inicio');await page.locator('#tairet-footer').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
 const before=await page.evaluate(()=>scrollY);
 await page.locator('#tairet-footer a[href="#/sobre/como-funciona"]').click();await page.locator('.tf-back:visible').click();await page.waitForTimeout(180);
 const after=await page.evaluate(()=>scrollY);assert(Math.abs(before-after)<80,'before='+before+' after='+after);
});
await check('FAQ filters, search and keyboard',async()=>{
 await go('/sobre/preguntas-frecuentes');await page.locator('#tf-faq-search').fill('datos');
 const count=await page.locator('[data-tf-faq]:visible').count();assert(count>0&&count<20);
 await page.locator('[data-tf-faq]:visible summary').first().focus();await page.keyboard.press('Enter');
 assert(await page.locator('[data-tf-faq][open]:visible').count()>0);
 await page.locator('#tf-faq-search').fill('zzzz-synthetic-no-match');assert(await page.locator('#tf-faq-empty').isVisible());
});
await check('local proposal validation, optional permissions and draft without persistence',async()=>{
 await go('/para-locales/solicitud');const f=page.locator('#tf-lead-form');
 await f.locator('button[type=submit]').click();assert(!(await page.locator('#tf-lead-preview').isVisible()));
 await f.locator('[name=venue]').fill('PROPUESTA SINTETICA QA');await f.locator('[name=type]').selectOption('bar');
 await f.locator('[name=city]').fill('Ciudad de prueba');await f.locator('[name=person]').fill('PERSONA SINTETICA');
 await f.locator('[name=terms]').check();await f.locator('[name=representative]').check();
 for(const name of ['material','news','socialPermission','paidPermission'])assert.equal(await f.locator('[name='+name+']').isChecked(),false);
 await f.locator('button[type=submit]').click();assert(await page.locator('#tf-lead-preview').isVisible());
 const href=await page.locator('#tf-lead-whatsapp').getAttribute('href');assert(href.startsWith('https://wa.me/'));assert(href.includes('PROPUESTA%20SINTETICA'));
 const stored=await page.evaluate(()=>JSON.stringify({...localStorage}));assert(!stored.includes('PROPUESTA')&&!stored.includes('PERSONA SINTETICA'));
 const pop=page.waitForEvent('popup');await page.locator('#tf-lead-whatsapp').click();const popup=await pop;await popup.waitForLoadState();await popup.close();
 await f.locator('[name=venue]').fill('PROPUESTA MODIFICADA');assert(!(await page.locator('#tf-lead-preview').isVisible()));
});
await check('Halloween four steps, conditional validation, review and reset',async()=>{
 await go('/halloween');await page.locator('[data-open-party]').first().click();
 const d=page.locator('#party-form-dialog'),f=d.locator('#party-form');assert(await d.isVisible());
 await f.locator('#party-next').click();assert(await f.locator('[data-step="0"]').isVisible());
 for(const [name,value] of Object.entries({event:'FIESTA SINTETICA QA',date:'2026-10-31',start:'23:00',place:'Lugar de prueba',music:'Música de prueba',age:'18'}))await f.locator('[name='+name+']').fill(value);
 await f.locator('#party-next').click();await f.locator('[name=entry]').selectOption('free');await f.locator('#party-next').click();
 await f.locator('[name=tables]').selectOption('no');await f.locator('#party-next').click();
 await f.locator('[name=organizer]').fill('ORGANIZADOR SINTETICO');await f.locator('[name=responsible]').fill('RESPONSABLE SINTETICO');
 await f.locator('[name=contact_phone]').fill('+595 981 000000');await f.locator('#party-unpublished').click();await f.locator('[name=material_mode]').selectOption('whatsapp');
 await f.locator('#party-next').click();assert(await d.locator('#party-review').isVisible());assert((await d.locator('#party-message-preview').innerText()).includes('FIESTA SINTETICA QA'));
 assert.equal(context.pages().length,1,'No auto-open on submit');assert(!(await page.evaluate(()=>JSON.stringify({...localStorage}))).includes('FIESTA SINTETICA'));
 await page.keyboard.press('Escape');assert(!(await d.isVisible()));assert.notEqual(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
 await page.locator('[data-open-party]').first().click();assert.equal(await d.locator('[name=event]').inputValue(),'');await page.keyboard.press('Escape');
});
await check('Asunción owner choice and search notice',async()=>{
 await go('/asuncion');await page.locator('[data-open-owner]').click();const d=page.locator('#owner-dialog');
 await d.locator('input[value=bar]').check();const href=await d.locator('#owner-whatsapp').getAttribute('href');assert(href.startsWith('https://wa.me/'));
 await page.keyboard.press('Escape');await page.locator('[data-search-input]').fill('prueba');await page.locator('[data-search-input]').press('Enter');
 assert(await page.locator('#tu-search-notice').isVisible());await page.keyboard.press('Escape');
});
await check('mobile navigation, footer sections and controls',async()=>{
 await page.setViewportSize({width:390,height:844});await go('/inicio');await page.locator('.dock a[href="#/halloween"]').click();await page.waitForURL('**/#/halloween');
 await page.locator('#tairet-footer').scrollIntoViewIfNeeded();const group=page.locator('.tf-footer-group').filter({has:page.locator('summary',{hasText:'Información'})});await group.locator('summary').click();assert(await group.locator('a[href="#/contacto"]').isVisible());
 await page.getByRole('button',{name:'Configurar cookies',exact:true}).click();assert(await page.locator('#r4-cookie-dialog').isVisible());await page.keyboard.press('Escape');
});
await check('all direct demo routes have pre content without backend requests',async()=>{
 const before=network.filter(n=>n.host==='127.0.0.1').length;
 for(const route of ['/club/demo','/bar/demo','/evento/demo','/discotecas','/bares','/reseñas','/explorar','/zonas','/experiencias/rooftop','/experiencias/after-office','/experiencias/promociones','/zona/ciudad-del-este','/zona/san-bernardino']){await go(route);assert.equal(await page.locator('.prelaunch').count(),1);assert.equal(await page.locator('.mapboxgl-map').count(),0);}
 assert.equal(network.filter(n=>n.host==='127.0.0.1').length,before);
});
await check('category notices, proposal query and paid/table draft branches',async()=>{
 await page.setViewportSize({width:1440,height:1000});await go('/inicio');
 await page.locator('[data-coming-soon=bares]').click();assert(await page.locator('#night-soon-dialog').isVisible());assert(await page.locator('#night-soon-photo').getAttribute('src'));await page.keyboard.press('Escape');
 await go('/para-locales/solicitud?tipo=discoteca');assert.equal(await page.locator('#tf-lead-form [name=type]').inputValue(),'discoteca');
 await go('/halloween');await page.locator('[data-open-party]').first().click();const f=page.locator('#party-form');
 for(const [n,v] of Object.entries({event:'FIESTA SINTETICA CON MESAS',date:'2026-10-31',start:'22:00',place:'Lugar de prueba',music:'Música de prueba',age:'18'}))await f.locator('[name='+n+']').fill(v);
 await f.locator('#party-next').click();await f.locator('[name=entry]').selectOption('paid');await f.locator('[name=ticket_total]').fill('100');await f.locator('[name=sales]').selectOption('door');
 assert(await f.locator('[name=sales_contact]').isDisabled());
 await f.locator('#ticket-rows [data-field=name]').fill('Entrada de prueba');await f.locator('#ticket-rows [data-field=price]').fill('100000');
 await f.locator('[data-add=ticket]').click();assert.equal(await f.locator('#ticket-rows .party-repeat-row').count(),2);await f.locator('#ticket-rows .party-repeat-row').last().locator('.party-remove').click();
 await f.locator('#party-next').click();await f.locator('[name=tables]').selectOption('yes');
 for(const [n,v] of Object.entries({name:'Mesa de prueba',price:'300000',people:'4',qty:'2'}))await f.locator('#table-rows [data-field='+n+']').fill(v);
 const admission=f.locator('#table-rows [data-field=admission]');await admission.selectOption({index:1});await f.locator('[name=table_phones]').fill('+595 981 000000');await f.locator('#party-next').click();
 for(const [n,v] of Object.entries({organizer:'ORGANIZADOR QA',responsible:'RESPONSABLE QA',contact_phone:'+595 981 000000',source:'https://example.invalid/evento'}))await f.locator('[name='+n+']').fill(v);
 await f.locator('[name=material_mode]').selectOption('link');await f.locator('[name=material_url]').fill('https://example.invalid/material');await f.locator('#party-next').click();
 assert(await page.locator('#party-review').isVisible());const text=await page.locator('#party-message-preview').innerText();assert(text.includes('Mesa de prueba')&&text.includes('Entrada de prueba'));
 await page.keyboard.press('Escape');
});


await check('operational route mounts use original components and preserve query',async()=>{
 for(const route of ['/payments/access/status?ref=SYNTHETIC_INVALID&qa=preserve','/access/checkin/SYNTHETIC_INVALID?qa=preserve','/auth/login','/confirmacion-compra','/reservar/synthetic']){
  await page.goto(base+'/#'+route);await page.waitForTimeout(250);assert.equal(await page.locator('.prelaunch').count(),0,route);assert((await page.locator('body').innerText()).trim().length>20,route);assert.equal(await page.locator('vite-error-overlay').count(),0);
  if(route.includes('qa=preserve'))assert(page.url().includes('qa=preserve'));
 }
});
fs.writeFileSync(path.join(evidence,'PRUEBAS','interactions.json'),JSON.stringify({results,pageErrors,network,servicePolicy:'All non-app requests intercepted; only synthetic data; no messages sent.'},null,2));
await browser.close();if(results.some(r=>r.status==='FAIL')||pageErrors.length)process.exitCode=1;
})().catch(e=>{console.error(e.message);process.exitCode=1});
