// QA-only preload to reproduce the parent executors' missing failure gates.
const {chromium}=require(process.env.QA_PLAYWRIGHT);
const launch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{
 const browser=await launch(...args),newContext=browser.newContext.bind(browser);
 browser.newContext=async(...contextArgs)=>{
  const context=await newContext(...contextArgs),newPage=context.newPage.bind(context);
  context.newPage=async(...pageArgs)=>{
   const page=await newPage(...pageArgs);
   await page.addInitScript(()=>{
    addEventListener('DOMContentLoaded',()=>{
     if(location.origin!=='http://127.0.0.1:4173')return;
     const n=document.createElement('div');n.style.cssText='position:absolute;top:0;left:0;width:calc(100vw + 160px);height:1px';document.documentElement.append(n);
     setTimeout(()=>{throw Error('QA_PARENT_CONTROLLED_CANDIDATE_ERROR')},20);
    });
   });
   return page;
  };
  return context;
 };
 return browser;
};
