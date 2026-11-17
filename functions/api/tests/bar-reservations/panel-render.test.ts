import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const appRequire=createRequire(resolve(__dirname,"../../../../apps/web-next/package.json"));
const React=appRequire("react");
const { renderToStaticMarkup }=appRequire("react-dom/server");

test("actual panel card preserves Asuncion civil date/time across process zones and legacy labels",async()=>{
  process.env.NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:1";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="b02-synthetic-local-only";
  const { ReservationCard }=await import("../../../../apps/web-next/components/panel/views/ReservationCard");
  const before=process.env.TZ;
  try {
    for (const tz of ["UTC","Asia/Tokyo","America/Los_Angeles"]) {
      process.env.TZ=tz;
      const html=renderToStaticMarkup(React.createElement(ReservationCard,{showActivityHistory:false,reservation:{id:"synthetic",name:"QA",date:"2026-11-07T02:00:00Z",guests:2,status:"en_revision"}}));
      assert.ok(html.includes("06/11/2026"));assert.ok(html.includes("23:00"));assert.ok(!html.includes("2026-11-07T02:00"));
    }
    const legacy=renderToStaticMarkup(React.createElement(ReservationCard,{showActivityHistory:false,reservation:{id:"synthetic",name:"QA",date:"06/11/2026, 23:00",guests:2,status:"en_revision"}}));
    assert.ok(legacy.includes("06/11/2026"));assert.ok(legacy.includes("23:00"));
  }finally{if(before===undefined)delete process.env.TZ;else process.env.TZ=before;}
});
