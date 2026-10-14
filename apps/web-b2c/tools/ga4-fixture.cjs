// A deterministic tag substitute served only by the QA network interceptor.
module.exports=function fixtureSource(control){
 function boot(control){
  const ID="G-L5DRMC7Z1F",key="ga-disable-"+ID;
  const state=window.__ga4Fixture={commands:[],events:[],config:null,consent:null};
  function emit(name,params,force=false){
   if(!force&&(window[key]!==false||state.consent?.analytics_storage!=="granted"))return;
   const data={...params};
   if(control==="pii")data.email="qa.private.email@example.invalid";
   state.events.push({name,params:data});
   if(state.config){const prefix=state.config.cookie_prefix;document.cookie=prefix+"_ga=GA1.1.100.200; Path=/";document.cookie=prefix+"_ga_"+ID.slice(2)+"=GS2.1.100.200; Path=/";}
   fetch("https://www.google-analytics.com/g/collect",{method:"POST",body:JSON.stringify({name,params:data}),keepalive:true}).catch(()=>{});
   if(control==="duplicate-view"&&name==="page_view")fetch("https://www.google-analytics.com/g/collect",{method:"POST",body:JSON.stringify({name,params:data}),keepalive:true}).catch(()=>{});
  }
  function consume(item){
   const args=Array.from(item);state.commands.push(args);
   if(args[0]==="consent")state.consent=args[2];
   if(args[0]==="config")state.config=args[2];
   if(args[0]==="event")emit(args[1],args[2]);
  }
  const queue=window.dataLayer||[];
  for(const item of queue)consume(item);
  const original=queue.push.bind(queue);
  queue.push=function(...items){const length=original(...items);for(const item of items)consume(item);return length;};
  if(control==="operational")addEventListener("hashchange",()=>{
   if(location.hash.startsWith("#/access/"))emit("page_view",{page_key:"halloween",page_location:location.origin+location.hash,page_title:"QA injected operational view",page_referrer:""},true);
  });
 }
 return "("+boot.toString()+")("+JSON.stringify(control||"")+");";
};
