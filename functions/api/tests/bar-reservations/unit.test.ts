import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateReservationSchedule } from "../../src/services/barReservationSchedule";
import { createReservationSchema } from "../../src/schemas/reservations";
import { arrivalIsoInAsuncion, barArrivalWithinHours, barReservationSlots } from "../../../../apps/web-b2c/src/lib/barReservationTime";
import { reservationDateLabel } from "../../../../apps/web-next/lib/reservationDate";

function matchingOpeningDates(raw: unknown, instant: Date) {
  const result = evaluateReservationSchedule(raw, instant);
  return result.ok ? result.openingDates : result.code === "SCHEDULE_UNAVAILABLE" ? null : [];
}

const hours={version:1 as const,timezone:"America/Asuncion" as const,days:{
  mon:{closed:false,ranges:[{start:"01:00",end:"04:00"}]},tue:{closed:true,ranges:[]},wed:{closed:true,ranges:[]},thu:{closed:true,ranges:[]},
  fri:{closed:false,ranges:[{start:"18:00",end:"02:00"}]},sat:{closed:false,ranges:[{start:"20:00",end:"23:00"}]},sun:{closed:true,ranges:[]},
}};

test("overnight uses opening date while Monday early opening is its own civil date",()=>{
  assert.deepEqual(matchingOpeningDates(hours,new Date("2026-11-07T04:00:00Z")),["2026-11-06"]);
  assert.deepEqual(matchingOpeningDates(hours,new Date("2026-11-09T04:00:00Z")),["2026-11-09"]);
  assert.deepEqual(matchingOpeningDates(hours,new Date("2026-11-07T05:00:00Z")),[]);
  assert.deepEqual(matchingOpeningDates(hours,new Date("2026-11-07T23:00:00Z")),["2026-11-07"]);
});
test("multiple/overlapping ranges retain every eligible opening date",()=>{
  const overlapping={...hours,days:{...hours.days,sat:{closed:false,ranges:[{start:"00:00",end:"03:00"},{start:"20:00",end:"23:00"}]}}};
  assert.deepEqual(matchingOpeningDates(overlapping,new Date("2026-11-07T04:00:00Z")),["2026-11-06","2026-11-07"]);
});
test("absent/malformed schedule never invents opening times",()=>{
  for(const bad of [null,{}, {...hours,days:{...hours.days,fri:{closed:false,ranges:[{start:"25:00",end:"02:00"}]}}}])assert.equal(matchingOpeningDates(bad,new Date("2026-11-06T22:00:00Z")),null);
  assert.deepEqual(barReservationSlots(null,new Date(2026,10,6),new Date("2026-11-06T21:00:00Z")),[]);
});
test("civil date to instant conversion rejects invalid dates and interprets Asuncion explicitly",()=>{
  assert.equal(arrivalIsoInAsuncion("2026-11-07","01:00"),"2026-11-07T04:00:00.000Z");
  assert.equal(arrivalIsoInAsuncion("2026-02-30","18:00"),null);
  assert.equal(arrivalIsoInAsuncion("2026-11-07","25:00"),null);
  assert.ok(barArrivalWithinHours(hours,"2026-11-07","01:00"));
  assert.equal(barArrivalWithinHours(hours,"2026-11-07","02:00"),false);
});
test("UI slots use exactly thirty minutes; stale/short notice no longer qualifies",()=>{
  const date=new Date(2026,10,6);
  assert.ok(barReservationSlots(hours,date,new Date("2026-11-06T21:00:00Z")).includes("18:30"));
  assert.ok(!barReservationSlots(hours,date,new Date("2026-11-06T21:00:00.001Z")).includes("18:30"));
  assert.ok(!barReservationSlots(hours,date,new Date("2026-11-07T21:00:00Z")).length);
});
test("public schema strips internal fields and retains the legitimate customer note",()=>{
  const base={local_id:"10000000-0000-4000-8000-000000000001",name:"QA",email:"qa@example.invalid",phone:"00000000",date:"2026-11-07T01:00:00-03:00",guests:15,notes:"customer"};
  const parsed=createReservationSchema.parse({...base,table_note:"private",status:"confirmed",cancel_reason:"reason"});
  assert.deepEqual(parsed,base);
  for(const guests of [0,16,1.5,"1",null]) assert.equal(createReservationSchema.safeParse({...base,guests}).success,false);
  for(const date of ["2026-02-30T01:00:00Z","2026-11-07T01:00:00","2026-11-07T99:00:00Z"]) assert.equal(createReservationSchema.safeParse({...base,date}).success,false);
});
test("browser/process timezone does not change UTC arrival, panel date or email rendering",async()=>{
  delete process.env.RESEND_API_KEY;process.env.EMAIL_ENABLED="false";
  const {renderReservationEmail}=await import("../../src/services/emails");
  const original=process.env.TZ;
  const outputs:string[]=[];
  try{
    for(const timezone of ["UTC","America/Asuncion","America/Los_Angeles","Asia/Tokyo"]){
      process.env.TZ=timezone;
      const date=new Date(2026,10,7);
      assert.ok(barReservationSlots(hours,date,new Date("2026-11-06T21:00:00Z")).includes("01:00"));
      const instant=arrivalIsoInAsuncion("2026-11-07","01:00")!;
      assert.deepEqual(matchingOpeningDates(hours,new Date(instant)),["2026-11-06"]);
      assert.equal(reservationDateLabel(instant),"07/11/2026");
      const email=renderReservationEmail({email:"qa@example.invalid",name:"QA",status:"pending",date:instant});
      assert.ok(email.html.includes("01:00"));outputs.push(email.html);
    }
    assert.ok(outputs.every(value=>value===outputs[0]));
  }finally{if(original===undefined)delete process.env.TZ;else process.env.TZ=original;}
});
