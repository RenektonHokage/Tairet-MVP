import { analytics } from "./analyticsRuntime";

type Field=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;
const CONTACT="595981628109"; // Approved pre reference; ownership is a release gate.
const MAIL="tairet.contacto@gmail.com";
export const whatsappDraft=(message:string)=>"https://wa.me/"+CONTACT+"?text="+encodeURIComponent(message);
export function setupConvocations(root:HTMLElement,search=""){
 const cleanups:(()=>void)[]=[];
 const on=(node:EventTarget|null,event:string,fn:EventListener)=>{node?.addEventListener(event,fn);cleanups.push(()=>node?.removeEventListener(event,fn));};
 const form=root.querySelector<HTMLFormElement>("#tf-lead-form");
 if(form){
  const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
  const requestedType=new URLSearchParams(search).get("tipo");if(requestedType&&["bar","discoteca","evento"].includes(requestedType))field("type").value=requestedType;
  const preview=root.querySelector<HTMLElement>("#tf-lead-preview")!;
  const draft=root.querySelector<HTMLElement>("#tf-lead-text")??root.querySelector<HTMLElement>("#tf-lead-message")??preview?.querySelector<HTMLElement>("pre");
  const clear=()=>{if(preview)preview.hidden=true;for(const id of ["tf-lead-whatsapp","tf-lead-email"])root.querySelector("#"+id)?.removeAttribute("href");};
  const sync=()=>{
   const material=field("material").checked;const permissions=root.querySelector<HTMLElement>("#r4-content-permissions");if(permissions)permissions.hidden=!material;
   field("rights").required=material;if(!material)for(const name of ["rights","socialPermission","paidPermission"])field(name).checked=false;
  };
  on(form,"input",e=>{(e.target as HTMLInputElement).setCustomValidity?.("");clear();});
  on(form,"change",()=>{sync();clear();});
  on(form,"submit",e=>{
   e.preventDefault();
   for(const input of form.querySelectorAll<HTMLInputElement>("[required]"))input.setCustomValidity((input.type==="checkbox"?input.checked:!!input.value.trim())?"":"Completá este campo para continuar.");
   if(!form.reportValidity())return;
   const x=Object.fromEntries(new FormData(form)) as Record<string,string>;
   const lines=["Hola, equipo de TAIRET. Quiero recibir información para sumar mi "+(x.type==="evento"?"evento":"local")+".","",
    "Nombre: "+x.venue.trim(),"Tipo de propuesta: "+({bar:"Bar",discoteca:"Discoteca",evento:"Evento"}[x.type]??x.type),"Ciudad: "+x.city.trim(),"Nombre y cargo: "+x.person.trim()];
   if(x.instagram)lines.push("Instagram: "+x.instagram.trim());if(x.message)lines.push("","Consulta: "+x.message.trim());
   lines.push("","Acepto los términos y conozco la política de privacidad (13/10/2026).","Confirmo que represento al local o evento.");
   if(x.material)lines.push("Voy a compartir material con derechos y permisos para publicarlo en el hub.","Difusión de este material en redes de TAIRET: "+(x.socialPermission?"Autorizada":"No autorizada"),"Uso de este material en anuncios pagos de TAIRET: "+(x.paidPermission?"Autorizado":"No autorizado"));
   lines.push("Novedades de TAIRET por este canal: "+(x.news?"Sí, autorizo":"No autorizo"),"Permisos elegidos el: "+new Date().toISOString());
   const text=lines.join("\n");if(draft)draft.textContent=text;
   root.querySelector("#tf-lead-whatsapp")?.setAttribute("href",whatsappDraft(text));
   root.querySelector("#tf-lead-email")?.setAttribute("href","mailto:"+MAIL+"?subject="+encodeURIComponent("Quiero sumar mi local o evento a TAIRET")+"&body="+encodeURIComponent(text));
   if(preview){preview.hidden=false;preview.focus();preview.scrollIntoView({block:"nearest"});analytics.convocationDraftReady("local");}
  });
  on(root.querySelector("[data-tf-copy-message]"),"click",()=>{if(draft?.textContent){const status=root.querySelector<HTMLElement>("#tf-lead-status");const fallback=()=>{draft.focus();if(status)status.textContent="Seleccioná el mensaje y copialo en el canal que prefieras.";};if(navigator.clipboard)void navigator.clipboard.writeText(draft.textContent).then(()=>{if(status)status.textContent="Mensaje copiado. Pegalo en el canal que prefieras.";}).catch(fallback);else fallback();}});
  sync();
 }
 const dialog=root.querySelector<HTMLDialogElement>("#party-form-dialog"),party=dialog?.querySelector<HTMLFormElement>("form");
 if(dialog&&party){
  const steps=[...party.querySelectorAll<HTMLElement>("[data-step]")],result=dialog.querySelector<HTMLElement>("#party-review")??dialog.querySelector<HTMLElement>(".party-result");
  let step=0;
  const f=(name:string)=>party.elements.namedItem(name) as Field;
  const val=(name:string)=>f(name)?.value??"";
  const sync=()=>{
   const entry=val("entry"),sale=val("sales");
   const active:Record<string,boolean>={"entry-paid":["paid","timed"].includes(entry),"entry-timed":entry==="timed","entry-free":["free","timed"].includes(entry),"entry-pending":entry==="pending","sale-contact":["paid","timed"].includes(entry)&&sale!==""&&sale!=="door","tables-yes":val("tables")==="yes","tables-pending":val("tables")==="pending","material-link":val("material_mode")==="link","material-whatsapp":val("material_mode")==="whatsapp"};
   for(const el of party.querySelectorAll<HTMLElement>("[data-condition]"))el.hidden=!active[el.dataset.condition!];
   for(const el of party.querySelectorAll<Field>("[data-condition] input,[data-condition] select,[data-condition] textarea"))el.disabled=!!el.closest("[data-condition][hidden]");
   const sales=f("sales_contact") as HTMLInputElement;sales.type=sale==="ticketera"?"url":sale==="whatsapp"?"tel":"text";
   const label=party.querySelector("#sales-contact-label");if(label)label.textContent=sale==="ticketera"?"Enlace de venta de la ticketera":sale==="whatsapp"?"WhatsApp de venta de entradas":"Enlace o contacto de venta";
   f("source").disabled=party.querySelector("#party-unpublished")?.getAttribute("aria-pressed")==="true";f("source").required=!f("source").disabled;
  };
  const show=(i:number)=>{step=i;steps.forEach((el,j)=>{el.hidden=j!==i;});
   dialog.querySelectorAll<HTMLElement>("[data-progress]").forEach((el,j)=>{if(i===j)el.setAttribute("aria-current","step");else el.removeAttribute("aria-current");el.dataset.complete=String(j<i);});
   const prev=dialog.querySelector<HTMLElement>("#party-prev")!;prev.hidden=i===0;
   dialog.querySelector("#party-step-count")!.textContent=(i+1)+" de 4";
   dialog.querySelector("#party-next")!.textContent=i===3?"Preparar mensaje →":"Continuar →";dialog.scrollTop=0;
   steps[i]?.querySelector<HTMLElement>("h3")?.focus();
  };
  const validate=(i:number)=>{
   for(const el of steps[i].querySelectorAll<Field>("input,select,textarea")){if(el.disabled)continue;el.setCustomValidity("");
    if(el instanceof HTMLInputElement&&["text","tel","email","url"].includes(el.type))el.value=el.value.trim();
    if(el instanceof HTMLInputElement&&el.type==="tel"&&el.value.replace(/\D/g,"").length<8)el.setCustomValidity("Revisá el número e incluí el código de país.");
    if(!el.checkValidity()){el.closest("details")?.setAttribute("open","");el.reportValidity();return false;}
   }return true;
  };
  const refreshRows=(kind:string)=>{
   party.querySelectorAll<HTMLElement>("#"+kind+"-rows .party-repeat-row").forEach((row,index)=>{
    const title=(kind==="ticket"?"Entrada ":"Mesa ")+(index+1),action=index===0?"Limpiar":"Eliminar";
    row.querySelector(".party-repeat-head span")!.textContent=title;
    row.setAttribute("role","group");row.setAttribute("aria-label",title);
    const button=row.querySelector<HTMLButtonElement>(".party-remove")!;
    button.textContent=action;button.setAttribute("aria-label",action+" "+title.toLocaleLowerCase("es"));
    row.querySelectorAll<Field>("[data-field]").forEach(field=>{
     field.id="party-"+kind+"-"+(index+1)+"-"+field.dataset.field;
     const label=field.closest("label");if(label)label.htmlFor=field.id;
    });
   });
  };
  const clearRow=(row:Element)=>row.querySelectorAll<Field>("input,textarea,select").forEach(field=>{field.value="";field.setCustomValidity("");});
  const resetProposal=()=>{
   for(const kind of ["ticket","table"]){
    party.querySelectorAll("#"+kind+"-rows .party-repeat-row").forEach((row,index)=>{if(index>0)row.remove();});
    refreshRows(kind);
   }
   party.reset();
   party.querySelectorAll<Field>("input,select,textarea").forEach(field=>field.setCustomValidity(""));
   party.querySelector("#party-unpublished")!.setAttribute("aria-pressed","false");
   party.querySelectorAll("details[open]").forEach(details=>details.removeAttribute("open"));
   dialog.querySelector("#party-message-preview")!.textContent="";
   dialog.querySelector("#party-whatsapp-link")!.removeAttribute("href");
   const reminder=dialog.querySelector<HTMLElement>("#party-material-reminder");if(reminder)reminder.hidden=true;
   party.hidden=false;if(result)result.hidden=true;sync();show(0);
  };
  const rows=(kind:string)=>[...party.querySelectorAll<HTMLElement>("#"+kind+"-rows .party-repeat-row")].map(row=>Object.fromEntries([...row.querySelectorAll<Field>("[data-field]")].map(el=>[el.dataset.field,el.value.trim()])));
  on(party,"change",sync);on(party,"input",e=>(e.target as Field).setCustomValidity?.(""));
  on(party,"click",e=>{
   const button=(e.target as Element).closest<HTMLButtonElement>("button");if(!button)return;
   if(button.id==="party-unpublished"){button.setAttribute("aria-pressed",String(button.getAttribute("aria-pressed")!=="true"));sync();}
   if(button.id==="party-prev")show(Math.max(0,step-1));
   if(button.dataset.add){const kind=button.dataset.add,host=party.querySelector("#"+kind+"-rows")!,first=host.querySelector(".party-repeat-row")!;const copy=first.cloneNode(true) as HTMLElement;clearRow(copy);host.append(copy);refreshRows(kind);sync();}
   if(button.classList.contains("party-remove")){const row=button.closest<HTMLElement>(".party-repeat-row")!,kind=row.dataset.kind!;if(row===row.parentElement!.firstElementChild)clearRow(row);else row.remove();refreshRows(kind);sync();}
  });
  on(party,"submit",e=>{
   e.preventDefault();if(!validate(step))return;if(step<3){show(step+1);return;}
   for(let i=0;i<4;i++){show(i);if(!validate(i))return;}
   const x=Object.fromEntries(new FormData(party)) as Record<string,string>;
   const lines=["🎃 TAIRET · HALLOWEEN 2026","Hola, equipo de TAIRET. Quiero sumar mi fiesta a la guía.","",
   "LA FIESTA","Nombre: "+x.event,"Fecha: "+x.date,"Inicio: "+x.start,"Local y ciudad: "+x.place,"Edad mínima: "+x.age,"Música: "+x.music,
   "","ENTRADAS","Modalidad: "+({paid:"Paga",free:"Gratis",timed:"Gratis hasta cierto horario",pending:"Por confirmar"}[x.entry]??x.entry)];
   if(["paid","timed"].includes(x.entry)){lines.push("Entradas previstas: "+x.ticket_total,"Canal de venta: "+x.sales);if(x.sales!=="door")lines.push("Contacto de compra: "+x.sales_contact);for(const row of rows("ticket"))lines.push(Object.entries(row).map(([k,v])=>({name:"Nombre",price:"Precio (₲)",qty:"Cantidad",details:"Incluye / vigencia",people:"Personas por mesa",admission:"Incluye entradas",credit:"Crédito de consumo (₲)",includes:"Incluidos"}[k]??k)+": "+v).join(" · "));if(x.ticket_notes)lines.push(x.ticket_notes);}
   if(x.entry==="timed")lines.push("Gratis hasta: "+x.free_until,"Precio posterior: "+x.later_price);if(x.free_notes)lines.push(x.free_notes);
   lines.push("","MESAS","Disponibilidad: "+({yes:"Sí",no:"No",pending:"Por confirmar"}[x.tables]??x.tables));
   if(x.tables==="yes"){for(const row of rows("table"))lines.push(Object.entries(row).map(([k,v])=>({name:"Nombre",price:"Precio (₲)",qty:"Cantidad",details:"Incluye / vigencia",people:"Personas por mesa",admission:"Incluye entradas",credit:"Crédito de consumo (₲)",includes:"Incluidos"}[k]??k)+": "+v).join(" · "));lines.push("WhatsApp para mesas: "+x.table_phones);}
   lines.push("","MATERIAL","Anuncio oficial: "+(f("source").disabled?"Aún no publiqué. Enlace pendiente.":x.source),"Flyer / fotos: "+(x.material_mode==="link"?x.material_url:"Los adjunto en WhatsApp."),
   "","ORGANIZADOR Y CONTACTO","Organizador: "+x.organizer,"Responsable: "+x.responsible,"WhatsApp privado: "+x.contact_phone);
   if(x.contact)lines.push("Correo: "+x.contact);if(x.notes)lines.push("Observaciones: "+x.notes);
   lines.push("","Gracias. Quedo atento a la revisión de la propuesta.");
   dialog.querySelector("#party-message-preview")!.textContent=lines.join("\n");
   dialog.querySelector("#party-whatsapp-link")!.setAttribute("href",whatsappDraft(lines.join("\n")));
   const reminder=dialog.querySelector<HTMLElement>("#party-material-reminder");if(reminder)reminder.hidden=x.material_mode!=="whatsapp";
   party.hidden=true;if(result){result.hidden=false;result.querySelector<HTMLElement>("h3")?.focus();analytics.convocationDraftReady("halloween_event");}
  });
  on(result?.querySelector("button")??null,"click",()=>{result!.hidden=true;party.hidden=false;show(3);});
  on(dialog,"close",resetProposal);
  for(const kind of ["ticket","table"])refreshRows(kind);
  sync();show(0);
 }
 const owner=root.querySelector<HTMLDialogElement>("#owner-dialog");
 if(owner){
  on(owner,"change",()=>{
   const value=owner.querySelector<HTMLInputElement>("input:checked")?.value;
   const link=owner.querySelector<HTMLAnchorElement>("#owner-whatsapp")??owner.querySelector<HTMLAnchorElement>('a[href*="wa.me"]');
   if(link){link.href=whatsappDraft("Hola, equipo de TAIRET. Quiero sumar mi "+(value==="bar"?"bar":"discoteca")+".");link.removeAttribute("aria-disabled");}
  });
 }
 return ()=>cleanups.forEach(fn=>fn());
}

