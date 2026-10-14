const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const q=require('./qa-support.cjs'),evidence=process.argv[2];q.prepare(evidence);fs.mkdirSync(path.join(evidence,'CAPTURAS','DIAGNOSTICO'),{recursive:true});
const r=q.report();r.purpose='P01/P02/P03 integrated visual and interaction checks';r.browser='Playwright Edge: Browser plugin not available';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const luminance=rgb=>rgb.map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
function contrast(fg,bg){const a=luminance(fg),b=luminance(bg);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);

function pixels(png){
 let offset=8,width,height,channels,compressed=[];
 while(offset<png.length){
  const n=png.readUInt32BE(offset),kind=png.toString('ascii',offset+4,offset+8),data=png.subarray(offset+8,offset+8+n);offset+=n+12;
  if(kind==='IHDR'){width=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);channels=({2:3,6:4})[data[9]];assert(channels);}
  if(kind==='IDAT')compressed.push(data);
 }
 const raw=require('node:zlib').inflateSync(Buffer.concat(compressed)),stride=width*channels,out=Buffer.alloc(height*stride);let k=0;
 for(let y=0;y<height;y++){
  const filter=raw[k++];
  for(let x=0;x<stride;x++){
   const pos=y*stride+x,a=x>=channels?out[pos-channels]:0,b=y?out[pos-stride]:0,c=y&&x>=channels?out[pos-stride-channels]:0;
   let predict=0;
   if(filter===1)predict=a;else if(filter===2)predict=b;else if(filter===3)predict=Math.floor((a+b)/2);
   else if(filter===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);predict=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}else assert.equal(filter,0);
   out[pos]=(raw[k++]+predict)&255;
  }
 }
 return out;
}
function compareBackdrop(a,b){
 const x=pixels(a),y=pixels(b);assert.equal(x.length,y.length);let sum=0,max=0,different=0;
 for(let i=0;i<x.length;i++){const delta=Math.abs(x[i]-y[i]);sum+=delta;max=Math.max(max,delta);if(delta)different++;}
 return {maxChannelDifference:max,meanChannelDifference:sum/x.length,differentChannels:different,totalChannels:x.length,withinRasterRounding:max<=1&&sum/x.length<=.05};
}

(async()=>{let browser;try{
 browser=await q.chromium.launch({channel:'msedge',headless:true});
 for(const width of [320,390,768,860,861,1440])for(const theme of ['dark','light']){
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});await q.isolate(context,r,true);
 await context.addInitScript(theme=>{localStorage.setItem('tairet-theme',theme);localStorage.setItem('tairet-privacy-v1',JSON.stringify({version:2,savedAt:Date.now(),necessary:true,external:false,analytics:false,advertising:false}));},theme);
 const page=await context.newPage();q.observe(page,r);page.setDefaultTimeout(8000);
 for(const route of ['inicio','asuncion','halloween']){
 await page.goto(q.base+'/#/'+route);await page.locator('.prelaunch').waitFor();await page.locator('header [data-search-input]').fill('');await page.evaluate(()=>document.fonts.ready);
 for(const [position,y]of [['top',0],['scroll',600],['page',900],['returned',0]]){
 await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.waitForTimeout(100);
 const header=page.locator('.prelaunch > header.header');
 const styles=await header.evaluate(n=>{
 const s=getComputedStyle(n),inner=getComputedStyle(n.querySelector('.header-in')),brand=n.querySelector('.brand');
 const back=n.querySelector(".catalog-back"),backBox=back?.getBoundingClientRect();
 const controls=Object.fromEntries(['.catalog-search','[data-theme-toggle]','.header-join'].map(sel=>{const x=n.querySelector(sel),v=getComputedStyle(x),b=x.getBoundingClientRect();return[sel,{color:v.color,background:v.backgroundColor,visible:b.width>0&&b.height>0}];}));
 return{background:s.backgroundColor,image:s.backgroundImage,backdrop:s.backdropFilter,opacity:s.opacity,before:getComputedStyle(n,'::before').content,after:getComputedStyle(n,'::after').content,innerBackground:inner.backgroundColor,surface:n.dataset.surface,height:n.getBoundingClientRect().height,backColor:back&&backBox.width?getComputedStyle(back).color:null,brandColor:getComputedStyle(brand).color,logoFilter:getComputedStyle(brand.querySelector('img')).filter,controls};
 });
 assert.equal(styles.background,'rgba(0, 0, 0, 0)');assert.equal(styles.image,'none');assert.equal(styles.backdrop,'none');assert.equal(styles.opacity,'1');assert.equal(styles.before,'none');assert.equal(styles.after,'none');assert.equal(styles.innerBackground,'rgba(0, 0, 0, 0)');
 const light=styles.surface==='photo'||theme==='dark';assert(rgb(styles.brandColor).every(n=>light?n>200:n<80),'Brand contrast tone '+route+' '+theme+' '+position);if(styles.backColor)assert(rgb(styles.backColor).every(n=>light?n>200:n<80),'Back link contrast');
 for(const [name,c]of Object.entries(styles.controls))if(c.visible)assert(contrast(rgb(c.color),rgb(c.background))>=4.5,name+' contrast');
 // Verify visible backdrop in the real screenshot, not only the container CSS.
 const clip={x:0,y:2,width:10,height:Math.max(1,Math.floor(styles.height)-4)};
 const visible=await page.screenshot({clip,animations:'disabled'});
 await header.evaluate(n=>n.style.visibility='hidden');let hidden;
 try{hidden=await page.screenshot({clip,animations:'disabled'});}finally{await header.evaluate(n=>n.style.removeProperty('visibility'));}
 const backdrop=compareBackdrop(visible,hidden);
 if(!backdrop.withinRasterRounding){const stem='failed-'+route+'-'+width+'-'+theme+'-'+position;fs.writeFileSync(path.join(evidence,'CAPTURAS','DIAGNOSTICO',stem+'-visible.png'),visible);fs.writeFileSync(path.join(evidence,'CAPTURAS','DIAGNOSTICO',stem+'-hidden.png'),hidden);await page.screenshot({path:path.join(evidence,'CAPTURAS',stem+'.png')});r.records.push({test:'backdrop failure',styles,images:await page.locator('img').evaluateAll(ns=>ns.map(n=>({src:n.currentSrc,complete:n.complete,width:n.naturalWidth})))})}
 assert(backdrop.withinRasterRounding,'Header changed the visible backdrop at '+route+' '+width+' '+theme+' '+position);
 const actual=await q.state(page);assert(!actual.overflow);assert(!actual.frameworkOverlay);assert(actual.meaningful);
 const record={test:'P02 navbar',route,width,theme,position,styles,backdropPixelsEqual:visible.equals(hidden),backdrop,visibleStripSHA256:hash(visible),hiddenStripSHA256:hash(hidden),...actual};r.records.push(record);
 if([390,1440].includes(width)&&position!=='returned'){
 const stem=route+'-'+width+'-'+theme+'-'+position;
 await page.screenshot({path:path.join(evidence,'CAPTURAS',stem+'.png')});fs.writeFileSync(path.join(evidence,'CAPTURAS','DIAGNOSTICO',stem+'-visible.png'),visible,{flag:'wx'});fs.writeFileSync(path.join(evidence,'CAPTURAS','DIAGNOSTICO',stem+'-hidden.png'),hidden,{flag:'wx'});
 }
 }
 await page.evaluate(()=>scrollTo({top:600,behavior:'instant'}));await page.locator('header [data-theme-toggle]').click();assert.equal(await page.locator('.prelaunch').getAttribute('data-theme'),theme==='dark'?'light':'dark');await page.locator('header [data-theme-toggle]').click();
 await page.locator('header [data-search-input]').fill('Consulta sintética QA');await page.locator('header [data-search-input]').press('Enter');await page.locator('#tu-search-notice[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('#tu-search-notice[open]').count(),0);
 if(route==='halloween'){
 assert.equal(await page.locator('.pl-halloween-notice,[data-halloween-notice]').count(),0);assert.equal(await page.getByText('Avisame cuando estén las fiestas',{exact:true}).count(),0);
 assert.equal(await page.locator('.hw16-hero [data-open-party]').count(),1);assert.equal(await page.locator('.hw16-hero [data-social-placement="halloween_hero"]').getAttribute('href'),'https://www.instagram.com/tairetpy/');
 const sections=await page.locator('.hw-page > section').evaluateAll(ns=>ns.map(n=>n.className));assert.equal(sections.length,2);assert(sections[1].includes('launch-intro'));
 }
 r.records.push({test:'P02 search and theme while scrolled',route,width,theme,result:'PASS'});
 }
 await context.close();
 // First-visit Cookies UI, no preselected preference; all categories remain independent.
 const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});await q.isolate(c,r,true);await c.addInitScript(theme=>localStorage.setItem('tairet-theme',theme),theme);
 const p=await c.newPage();q.observe(p,r);await p.goto(q.base+'/#/inicio');await p.locator('.prelaunch').waitFor();await p.evaluate(()=>document.fonts.ready);
 const banner=p.locator('#r4-cookie-banner');assert(await banner.isVisible());
 const labels=await banner.locator('button').allTextContents();assert.deepEqual(labels.map(s=>s.trim()),['Aceptar','Rechazar','Configurar']);
 const box=await banner.boundingBox();assert(box.height<=190&&box.y>=0&&box.y+box.height<=900);assert(!(await q.state(p)).overflow);
 if([320,390,1440].includes(width))await p.screenshot({path:path.join(evidence,'CAPTURAS','cookies-'+width+'-'+theme+'.png')});
 await p.evaluate(()=>scrollTo({top:300,behavior:'instant'}));assert.equal(await p.evaluate(()=>localStorage.getItem('tairet-privacy-v1')),null);
 await banner.getByRole('button',{name:'Configurar',exact:true}).focus();await p.keyboard.press('Enter');await p.locator('#r4-cookie-dialog[open]').waitFor();
 assert(!(await p.locator('#r4-external-toggle').isChecked()));assert(!(await p.locator('#r4-analytics-toggle').isChecked()));
 if([320,1440].includes(width))await p.screenshot({path:path.join(evidence,'CAPTURAS','preferences-'+width+'-'+theme+'.png')});
 await p.keyboard.press('Escape');assert(await banner.isVisible());assert.equal(await p.evaluate(()=>localStorage.getItem('tairet-privacy-v1')),null);
 const accept=width===1440;await banner.getByRole('button',{name:accept?'Aceptar':'Rechazar',exact:true}).click();
 let saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('tairet-privacy-v1')));assert.equal(saved.analytics,accept);assert.equal(saved.external,accept);assert.equal(saved.advertising,false);
 await p.reload();await p.locator('.prelaunch').waitFor();assert(!(await banner.isVisible()));
 await p.getByRole('button',{name:'Configurar cookies',exact:true}).click();await p.locator('#r4-external-toggle').setChecked(true);await p.locator('#r4-analytics-toggle').setChecked(false);await p.locator('[data-r4-cookie-save]').click();
 saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('tairet-privacy-v1')));assert.equal(saved.external,true);assert.equal(saved.analytics,false);
 await p.getByRole('button',{name:'Configurar cookies',exact:true}).click();await p.locator('#r4-external-toggle').setChecked(false);await p.locator('#r4-analytics-toggle').setChecked(true);await p.locator('[data-r4-cookie-save]').click();
 saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('tairet-privacy-v1')));assert.equal(saved.external,false);assert.equal(saved.analytics,true);
 r.records.push({test:'P03 compact banner and independent preferences',width,theme,labels,bannerHeight:box.height,result:'PASS'});await c.close();
 console.log(JSON.stringify({width,theme,status:'PASS'}));
 }
}catch(e){r.failures.push({type:'assertion',message:e.stack});}finally{if(browser)await browser.close();q.finish(r);q.save(evidence,'prelaunch-final.json',r);console.log(JSON.stringify({status:r.status,records:r.records.length,failures:r.failures,errors:r.candidateErrors}));if(r.status==='FAIL')process.exitCode=1;}})();