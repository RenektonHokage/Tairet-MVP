import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

// One fresh process per mode: the Resend client is initialized at module import.
async function main() {
  const [mode, out] = process.argv.slice(2);
  assert.ok(["disabled","missing-key","network-error"].includes(mode));
  process.env.EMAIL_ENABLED = mode === "disabled" ? "false" : "true";
  process.env.RESEND_BASE_URL = "http://127.0.0.1:1";
  if (mode === "missing-key") delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = "b03-synthetic-only";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("Synthetic transport failure; payload must stay private");
  };
  const { sendReservationReceivedEmail, sendReservationConfirmedEmail, sendReservationCancelledEmail } = await import("../../src/services/emails");
  const original = console.log;
  const log: string[] = [];
  try {
    console.log = (...parts: unknown[]) => { log.push(parts.join(" ")); };
    for (const send of [sendReservationReceivedEmail, sendReservationConfirmedEmail, sendReservationCancelledEmail]) {
      const attempt = send({email:"test@example.invalid",name:"SYNTHETIC-PERSON",localName:"Bar QA",date:"2026-11-07T02:00:00Z",people:2});
      if (mode === "network-error") await assert.rejects(attempt);
      else await attempt;
    }
  } finally { console.log = original; }
  assert.equal(calls,mode === "network-error" ? 3 : 0);
  assert.ok(log.every(line => !line.includes("test@example.invalid") && !line.includes("SYNTHETIC-PERSON") && !line.includes("<html") && !line.includes("payload must stay private")));
  if (mode === "network-error") assert.ok(log.some(line => line.includes("errorCode")));
  else assert.equal(log.filter(line => line.includes("[EMAIL STUB]")).length,3);
  writeFileSync(resolve(out,`mail-${mode}.json`),JSON.stringify({mode,result:"PASS",calls,log:log.map(line=>JSON.parse(line))},null,2));
  original(`PASS ${mode}: ${calls} intercepted transport calls`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
