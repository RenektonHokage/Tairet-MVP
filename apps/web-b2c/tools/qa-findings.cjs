const assert=require('node:assert/strict'),path=require('node:path');
const q=require('./qa-support.cjs'),evidence=process.argv[2],phase=process.env.QA_PHASE||'final';
q.prepare(evidence);const r=q.report();r.phase=phase;
(async()=>{let browser;
 try{
 browser=await q.chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await q.isolate(context,r,true);
 const page=await context.newPage();page.setDefaultTimeout(7000);q.observe(page,r);
 await page.addInitScript(()=>{localStorage.setItem('tairet-theme','dark');localStorage.setItem('tairet-privacy-v1',JSON.stringify({version:1,savedAt:Date.now(),external:false}));});
 const check=async(name,fn)=>{try{await fn();r.records.push({test:name,result:'PASS'});}catch(e){r.failures.push({test:name,message:e.message});}console.log(name,r.failures.at(-1)?.test===name?'FAIL':'PASS');};
 const go=async route=>{await page.goto(q.base+'/#'+route);await page.reload();await page.locator('.prelaunch').waitFor();await page.evaluate(()=>document.fonts.ready);};
 const theme=async value=>{if(await page.locator('.prelaunch').getAttribute('data-theme')!==value)await page.locator('header [data-theme-toggle]').click();await page.waitForTimeout(80);assert.equal(await page.locator('.prelaunch').getAttribute('data-theme'),value);};
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:1000});
  for(const color of ['dark','light']){
   await check('H01 '+width+' '+color,async()=>{
    await go('/inicio');await theme(color);
    for(const [position,y] of [['top',0],['scrolled',600],['returned-top',0]]){
     await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(120);
     const styles=await page.evaluate(()=>Object.fromEntries(['.brand','.brand img','.catalog-search','[data-search-input]','.catalog-search .icon','.header-join','[data-theme-toggle]'].map(selector=>{
      const n=document.querySelector('header '+selector),s=getComputedStyle(n),box=n.getBoundingClientRect();
      return [selector,{color:s.color,background:s.backgroundColor,border:s.borderColor,filter:s.filter,visible:box.width>0&&box.height>0,font:s.fontFamily,placeholder:selector==='[data-search-input]'?getComputedStyle(n,'::placeholder').color:null}];
     })));
     const actual=await q.state(page);
     const header=await page.locator('header.header').evaluate(n=>{const s=getComputedStyle(n);return {surface:n.dataset.surface,background:s.backgroundColor,image:s.backgroundImage,backdrop:s.backdropFilter,before:getComputedStyle(n,'::before').content,opacity:s.opacity};});

     const locked=await page.locator('header.header').evaluate(n=>n.classList.contains('is-scroll-locked'));
     assert.equal(locked,y>48);
     r.records.push({test:'H01 styles',width,color,position,styles,header,...actual});
     if(position!=='returned-top')await page.screenshot({path:path.join(evidence,'CAPTURAS',phase+'-header-'+width+'-'+color+'-'+position+'.png')});
    }
    await page.evaluate(()=>scrollTo({top:600,behavior:'instant'}));await page.waitForTimeout(80);await theme(color==='dark'?'light':'dark');
    r.records.push({test:'H01 theme-switch-scrolled',...(await q.state(page))});
    await page.locator('header [data-theme-toggle]').click();
    await page.evaluate(()=>{location.hash='#/asuncion'});await page.locator('.pl-asuncion').waitFor();
    await page.evaluate(()=>{location.hash='#/inicio'});await page.locator('.cinema-hero').waitFor();
    const values=r.records.filter(x=>x.test==='H01 styles'&&x.width===width&&x.color===color);
    for(const x of values){
     const lightText=x.header.surface==='photo'||color==='dark';
     for(const control of ['.brand','[data-search-input]','.header-join']){
      if(!x.styles[control].visible)continue;
      assert(x.styles[control].color.match(/\d+/g).slice(0,3).every(n=>lightText?Number(n)>200:Number(n)<80),JSON.stringify({state:x.position,control,header:x.header,actual:x.styles[control]}));
     }
     assert.equal(x.header.background,'rgba(0, 0, 0, 0)');assert.equal(x.header.image,'none');assert.equal(x.header.backdrop,'none');assert.equal(x.header.before,'none');assert.equal(x.header.opacity,'1');
    }
   });
   await check('H06 '+width+' '+color,async()=>{
    await go('/halloween');await theme(color);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.waitForTimeout(120);
    const styles=await page.evaluate(()=>Object.fromEntries(['.h16-cta-primary > span:first-child','.h16-cta-saved','#party-next'].map(sel=>{const n=document.querySelector(sel),s=getComputedStyle(n);return[sel,{font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,width:n.getBoundingClientRect().width,scrollWidth:n.scrollWidth,clientWidth:n.clientWidth}];})));
    r.records.push({test:'H06 typography',styles,...await q.state(page)});
    await page.screenshot({path:path.join(evidence,'CAPTURAS',phase+'-halloween-cta-'+width+'-'+color+'.png')});
    for(const s of Object.values(styles))assert.equal(s.font,styles['#party-next'].font,JSON.stringify(styles));
   });
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 const initial=async()=>page.locator('#party-form-dialog').evaluate(d=>({
  fields:[...d.querySelectorAll('form input,form select,form textarea')].map(n=>({name:n.name||n.dataset.field,value:n.value,checked:n.checked??null,disabled:n.disabled,required:n.required,customError:n.validity.customError})),
  ticketRows:d.querySelectorAll('#ticket-rows .party-repeat-row').length,tableRows:d.querySelectorAll('#table-rows .party-repeat-row').length,
  pressed:d.querySelector('#party-unpublished').getAttribute('aria-pressed'),step:d.querySelector('#party-step-count').textContent,
  reviewHidden:d.querySelector('#party-review').hidden,formHidden:d.querySelector('form').hidden,
  message:d.querySelector('#party-message-preview').textContent,href:d.querySelector('#party-whatsapp-link').getAttribute('href'),
  conditions:[...d.querySelectorAll('[data-condition]')].map(n=>[n.dataset.condition,n.hidden]),
  progress:[...d.querySelectorAll('[data-progress]')].map(n=>[n.getAttribute('aria-current'),n.dataset.complete]),
  openDetails:d.querySelectorAll('details[open]').length
 }));
 async function fillProposal(){
  const f=page.locator('#party-form');
  for(const [name,value] of Object.entries({event:'FIESTA SINTETICA B2_1',date:'2026-10-31',start:'23:00',place:'Lugar sintetico',music:'Musica sintetica',age:'18'}))await f.locator('[name='+name+']').fill(value);
  await f.locator('#party-next').click();await f.locator('[name=entry]').selectOption('paid');
  await f.locator('[name=ticket_total]').fill('100');await f.locator('[name=sales]').selectOption('door');
  const rowEvidence=[];
  for(const kind of ['ticket','table']){
   if(kind==='table'){await f.locator('#party-next').click();await f.locator('[name=tables]').selectOption('yes');}
   for(let i=0;i<3;i++)await f.locator('[data-add='+kind+']').click();
   const rows=f.locator('#'+kind+'-rows .party-repeat-row');
   for(let i=0;i<4;i++){
    const row=rows.nth(i);await row.locator('[data-field=name]').fill(kind+' QA '+(i+1));await row.locator('[data-field=price]').fill('100000');
    if(kind==='table'){await row.locator('[data-field=people]').fill('4');await row.locator('[data-field=qty]').fill('2');await row.locator('[data-field=admission]').selectOption({index:1});}
   }
   await rows.nth(1).locator('.party-remove').click();
   rowEvidence.push({kind,rows:await rows.evaluateAll(nodes=>nodes.map(n=>({label:n.querySelector('.party-repeat-head span').textContent,action:n.querySelector('.party-remove').textContent,aria:n.querySelector('.party-remove').getAttribute('aria-label'),name:n.querySelector('[data-field=name]').value,labelsValid:[...n.querySelectorAll('input,select')].every(f=>f.labels.length>0)})))});
  }
  await f.locator('[name=table_phones]').fill('+595 981 000000');await f.locator('#party-next').click();
  for(const [n,v] of Object.entries({organizer:'ORGANIZADOR SINTETICO',responsible:'RESPONSABLE SINTETICO',contact_phone:'+595 981 000000'}))await f.locator('[name='+n+']').fill(v);
  await f.locator('#party-unpublished').click();await f.locator('[name=material_mode]').selectOption('whatsapp');
  await f.locator('#party-next').click();await page.locator('#party-review').waitFor();
  const message=await page.locator('#party-message-preview').innerText();
  assert(message.includes('ticket QA 3')&&message.includes('table QA 4')&&!message.includes('ticket QA 2')&&!message.includes('table QA 2'));
  r.records.push({test:'H02 rows and message',rowEvidence,messageContainsOnlyRemainingRows:true,autoOpenedPages:context.pages().length});
  assert.equal(context.pages().length,1);
  await page.locator('#party-review button').click();
  assert.equal(await f.locator('[name=event]').inputValue(),'FIESTA SINTETICA B2_1');
  assert.equal(await f.locator('#party-unpublished').getAttribute('aria-pressed'),'true');
  await f.locator('#party-next').click();await page.locator('#party-review').waitFor();
  return rowEvidence;
 }
 for(const close of ['button','Escape']){
  await check('H02 full reset '+close,async()=>{
   await go('/halloween');await page.locator('[data-open-party]').first().click();const before=await initial();
   const rows=await fillProposal();await page.screenshot({path:path.join(evidence,'CAPTURAS',phase+'-form-prepared-'+close+'.png')});
   if(close==='Escape')await page.keyboard.press('Escape');else await page.locator('#party-form-dialog .party-close').click();
   await page.waitForTimeout(100);await page.locator('[data-open-party]').first().click();
   const after=await initial();r.records.push({test:'H02 reset state',close,before,after});
   await page.screenshot({path:path.join(evidence,'CAPTURAS',phase+'-form-reopened-'+close+'.png')});
   assert.deepEqual(after,before);
   for(const x of rows)for(let i=0;i<x.rows.length;i++){assert.equal(x.rows[i].label.trim(),(x.kind==='ticket'?'Entrada ':'Mesa ')+(i+1));assert.equal(x.rows[i].action.trim(),i===0?'Limpiar':'Eliminar');assert(x.rows[i].aria);assert(x.rows[i].labelsValid);}
   await page.keyboard.press('Escape');
  });
 }
 await check('H02 navigation discards state and avoids duplicate listeners',async()=>{
  await go('/halloween');await page.locator('[data-open-party]').first().click();await page.locator('#party-form [name=event]').fill('RESIDUO SINTETICO');
  await page.evaluate(()=>{location.hash='#/asuncion'});await page.locator('.pl-asuncion').waitFor();
  assert.notEqual(await page.evaluate(()=>document.documentElement.style.overflow),'hidden');
  await page.evaluate(()=>{location.hash='#/halloween'});await page.locator('[data-open-party]').first().click();
  assert.equal(await page.locator('#party-form [name=event]').inputValue(),'');
  await page.evaluate(()=>{const n=document.querySelector('#party-form [name=entry]');n.value='paid';n.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#party-form [data-add=ticket]').click();});
  assert.equal(await page.locator('#ticket-rows .party-repeat-row').count(),2);
  await page.keyboard.press('Escape');
 });
 await check('H02 reopened proposal requires announcement and ignores inactive fields',async()=>{
  await go('/halloween');await page.locator('[data-open-party]').first().click();const f=page.locator('#party-form');
  for(const [name,value] of Object.entries({event:'SEGUNDA PROPUESTA SINTETICA',date:'2026-10-31',start:'23:00',place:'Lugar sintetico',music:'Musica sintetica',age:'18'}))await f.locator('[name='+name+']').fill(value);
  await f.locator('#party-next').click();await f.locator('[name=entry]').selectOption('free');await f.locator('#party-next').click();
  await f.locator('[name=tables]').selectOption('no');await f.locator('#party-next').click();
  for(const [name,value] of Object.entries({organizer:'ORGANIZADOR SINTETICO',responsible:'RESPONSABLE SINTETICO',contact_phone:'+595 981 000000'}))await f.locator('[name='+name+']').fill(value);
  await f.locator('[name=material_mode]').selectOption('whatsapp');await f.locator('#party-next').click();
  assert(await f.isVisible());assert(await f.locator('[name=source]').evaluate(n=>n.required&&!n.disabled&&n.validity.valueMissing));
  assert(await f.locator('[data-condition="entry-paid"] input').evaluateAll(nodes=>nodes.every(n=>n.disabled)));
  assert(await f.locator('[data-condition="tables-yes"] input').evaluateAll(nodes=>nodes.every(n=>n.disabled)));
  await f.locator('[name=source]').fill('https://example.invalid/QA_Anuncio');await f.locator('#party-next').click();await page.locator('#party-review').waitFor();
  await page.keyboard.press('Escape');
 });
 await check('H02 clear retained row and discard custom validity',async()=>{
  await go('/halloween');await page.locator('[data-open-party]').first().click();await fillProposal();
  await page.locator('#party-review button').click();const f=page.locator('#party-form');
  await f.locator('#party-prev').click();await f.locator('#party-prev').click();
  const rows=f.locator('#ticket-rows .party-repeat-row');await rows.first().locator('.party-remove').click();
  assert.equal(await rows.count(),3);assert.equal(await rows.first().locator('[data-field=name]').inputValue(),'');
  assert.equal(await rows.nth(1).locator('[data-field=name]').inputValue(),'ticket QA 3');
  await rows.first().locator('[data-field=name]').fill('Entrada QA repuesta');await rows.first().locator('[data-field=price]').fill('100000');
  await f.locator('#party-next').click();await f.locator('#party-next').click();
  await f.locator('[name=contact_phone]').fill('1');await f.locator('#party-next').click();
  assert(await f.locator('[name=contact_phone]').evaluate(n=>n.validity.customError));
  await page.keyboard.press('Escape');await page.waitForTimeout(100);await page.locator('[data-open-party]').first().click();
  const reset=await initial();assert(reset.fields.every(x=>!x.customError));assert.equal(reset.pressed,'false');assert.equal(reset.ticketRows,1);assert.equal(reset.tableRows,1);assert.equal(reset.message,'');assert.equal(reset.href,null);
  r.records.push({test:'H02 custom validity reset',reset});
  await page.keyboard.press('Escape');
 });
 for(const [route,expected] of [['/halloween','halloween'],['/halloween/','halloween'],['/Halloween','halloween'],['/Halloween/','halloween'],['/asuncion','asuncion'],['/asuncion/','asuncion'],['/zona/asuncion/','asuncion'],['/legal/cookies','cookies'],['/legal/cookies/','cookies'],['/Legal/Cookies/','cookies'],['/eventos','halloween'],['/eventos/?origen=QA_Mixto','halloween']]){
  await check('H05 '+route,async()=>{
   await go(route);const actual=await q.state(page);r.records.push({test:'H05 direct',inputRoute:route,expected,...actual});assert.equal(actual.route,expected);
   if(route.startsWith('/eventos'))assert(page.url().includes('#/halloween'+(route.includes('?')?'?origen=QA_Mixto':'')));
   await page.reload();await page.locator('.prelaunch').waitFor();assert.equal(await page.locator('.prelaunch').getAttribute('data-route'),expected);
   assert.equal(await page.getByRole('heading',{name:'Próximamente en TAIRET',exact:true}).count(),0);
  });
 }
 }catch(e){r.environmentErrors.push({message:e.stack});}
 finally{if(browser)await browser.close();q.finish(r);q.save(evidence,'findings.json',r);console.log(JSON.stringify({phase,status:r.status,failures:r.failures.map(x=>({test:x.test,type:x.type,message:x.message?.slice(0,250)})),candidateErrors:r.candidateErrors,environmentErrors:r.environmentErrors}));if(r.status==='FAIL')process.exitCode=1;}
})();
