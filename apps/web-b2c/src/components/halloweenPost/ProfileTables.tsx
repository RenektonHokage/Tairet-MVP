import { useRef } from "react";
import { ChevronDown, Users } from "lucide-react";
import { tablePeopleLabel } from "./presentation";
import "./sold-out.css";

export interface TablePresentation {
 id:string;
 name:string;
 capacity?:number;
 includes:readonly string[];
 priceLabel:string;
 requestable?:boolean;
 externalContactHref?:string;
 selected?:boolean;
 availability?:"available"|"sold-out";
 seatingLabel?:string;
 priceCaption?:string;
 note?:string;
}
export function SoldOutRibbons(){return <div className="hp-sold-ribbons" aria-hidden="true">{[0,1].map(n=><div className="hp-sold-ribbon" key={n}>{Array.from({length:18},(_,i)=><span key={i}>SOLD OUT</span>)}</div>)}</div>;}
function TableRow({table,onRequest}:{table:TablePresentation;onRequest?:(id:string)=>void}) {
 const details=useRef<HTMLDetailsElement>(null);
 const showDetails=()=>{
  if(!details.current)return;
  details.current.open=true;
  details.current.querySelector("summary")?.focus({preventScroll:true});
 };
 const soldOut=table.availability==="sold-out",canRequest=!soldOut&&table.requestable===true&&!!onRequest;
 return <article className={"hp-table hp-table-compact"+(soldOut?" hp-table-sold-out":"")+(table.selected&&!soldOut?" hp-table-selected":"")} data-availability={soldOut?"sold-out":"informational"}>
  {soldOut&&<SoldOutRibbons/>}
  <div className="hp-table-name"><h3>{table.name}</h3>{(table.capacity!==undefined||table.seatingLabel)&&<span><Users size={15} aria-hidden="true"/>{table.seatingLabel??tablePeopleLabel(table.capacity,table.includes)}</span>}{table.note&&<p className="hp-table-note">{table.note}</p>}</div>
  <div className="hp-table-action"><div><strong>{table.priceLabel}</strong>{table.priceCaption!==""&&<small>{table.priceCaption??"Precio del paquete por mesa"}</small>}</div>
   {soldOut?<button className="hp-button hp-button-secondary" type="button" disabled aria-label={table.name+": agotada"}>Agotada</button>:!canRequest&&table.externalContactHref?<a className="hp-button hp-button-secondary" href={table.externalContactHref} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Consultar por WhatsApp</a>:<button className="hp-button hp-button-secondary" type="button" onClick={()=>canRequest?onRequest?.(table.id):showDetails()}>{canRequest?(table.selected?"Ver solicitud":"Seleccionar"):"Ver detalles"}</button>}
  </div>
  <details ref={details} className="hp-table-includes"><summary><span>Qué incluye esta mesa</span><ChevronDown size={16} aria-hidden="true"/></summary>
   <div className="hp-table-includes-body"><h4>Incluye</h4><ul>{table.includes.map((line,index)=><li key={index}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg><span>{line}</span></li>)}</ul></div>
  </details>
 </article>;
}
export function ProfileTables({tables,onRequest,availability}:{tables:readonly TablePresentation[];onRequest?:(id:string)=>void;availability?:"available"|"sold-out"}) {
 const visible=availability==="sold-out"?[]:tables.filter(table=>table.availability!=="sold-out");
 if(!visible.length)return null;
 return <section className="hp-section" aria-labelledby="hp-tables-title"><h2 id="hp-tables-title">Mesas</h2>
  {visible.map(table=><TableRow key={table.id} table={table} onRequest={onRequest}/>)}
 </section>;
}
