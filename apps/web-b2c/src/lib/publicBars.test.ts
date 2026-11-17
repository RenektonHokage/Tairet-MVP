import assert from "node:assert/strict";
import { test } from "node:test";
import { getPublicBars, toPublicBars } from "./publicBars";
import type { LocalListItem } from "./locals";

function local(overrides: Partial<LocalListItem> = {}): LocalListItem {
  return { id:"synthetic", slug:"stable-slug", name:"Nombre editado", type:"bar", is_published:true,
    location:null, city:null, cover_url:null, attributes:[], min_age:null, ...overrides };
}

test("only explicit publication permits bars; old API payloads and clubs cannot become bar cards", () => {
  assert.deepEqual(toPublicBars([local({is_published:false}),local({is_published:undefined}),local({type:"club"}),local({slug:""})]),[]);
});

test("renaming preserves slug and empty commercial fields remain empty", () => {
  const [bar] = toPublicBars([local()]);
  assert.equal(bar.slug,"stable-slug"); assert.equal(bar.name,"Nombre editado");
  assert.equal(bar.image,""); assert.equal(bar.location,""); assert.deepEqual(bar.specialties,[]);
  assert.equal(bar.minAge,null); assert.equal(bar.schedule,"Horario no disponible");
  assert.equal("rating" in bar,false);
});

test("all pages are requested, while legacy pagination and transport failures fail closed", async () => {
  const original = globalThis.fetch;
  const pages:number[]=[];
  try {
    globalThis.fetch = async input => {
      const offset = Number(new URL(String(input)).searchParams.get("offset") ?? 0); pages.push(offset);
      return new Response(JSON.stringify(offset===0 ? Array.from({length:100},(_,i)=>local({id:String(i),slug:`bar-${i}`})) : [local({id:"last",slug:"last"})]));
    };
    assert.equal((await getPublicBars()).length,101); assert.deepEqual(pages,[0,100]);
    globalThis.fetch = async () => new Response(JSON.stringify([local({is_published:undefined})]));
    assert.deepEqual(await getPublicBars(),[]);
    globalThis.fetch = async () => new Response(JSON.stringify(Array.from({length:100},(_,i)=>local({id:String(i)}))));
    await assert.rejects(getPublicBars(), /paginación/);
    globalThis.fetch = async () => new Response("unavailable",{status:503});
    await assert.rejects(getPublicBars(), /503/);
  } finally { globalThis.fetch=original; }
});
