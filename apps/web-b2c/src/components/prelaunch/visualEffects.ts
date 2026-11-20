export function setupVisualEffects(root:HTMLElement,page:string){
 const motion=matchMedia("(prefers-reduced-motion: reduce)");
 const nodes=[...root.querySelectorAll<HTMLElement>(".tf-reveal")];
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-visible");observer.unobserve(entry.target);}}),{threshold:.14});
 const reveal=()=>{if(motion.matches)nodes.forEach(n=>n.classList.add("is-visible"));else nodes.filter(n=>!n.classList.contains("is-visible")).forEach(n=>observer.observe(n));};
 reveal();motion.addEventListener("change",reveal);
 const focus=(e:FocusEvent)=>(e.target as Element).closest(".tf-reveal")?.classList.add("is-visible");root.addEventListener("focusin",focus);
 const images=[...root.querySelectorAll<HTMLImageElement>("[data-scene-img]")];let scene=0;
 const timer=page==="home"&&images.length>1?window.setInterval(()=>{if(!document.hidden&&!motion.matches){scene=(scene+1)%images.length;images.forEach((im,i)=>im.classList.toggle("active",i===scene));}},7000):null;
 return()=>{if(timer!==null)clearInterval(timer);observer.disconnect();motion.removeEventListener("change",reveal);root.removeEventListener("focusin",focus);};
}

