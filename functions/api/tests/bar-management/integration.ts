import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer, type Server } from "node:http";
import express from "express";
import cors from "cors";
import { z } from "zod";

const receipt = z.object({ id: z.string().uuid(), status: z.literal("en_revision"), date: z.string(), guests: z.number().int(), created_at: z.string() }).strict();
const mutation = z.object({ id: z.string().uuid(), status: z.enum(["en_revision","confirmed","cancelled"]), table_note: z.string().nullable(), cancel_reason: z.string().nullable(), updated_at: z.string() });
const emailPayload = z.object({ to: z.union([z.string(),z.array(z.string())]), subject: z.string(), html: z.string() });

// Never read .env or connect to an existing database. This runner owns all containers it touches.
const root = resolve(__dirname, "../../../..");
const out = process.argv[2];
if (!out || out.startsWith("--")) throw new Error("Pass a persistent evidence directory as the first argument");
mkdirSync(out, { recursive: true });
const prefix = `tairet-b03-${Date.now()}`;
const pg = `${prefix}-pg`;
const rest = `${prefix}-rest`;
const network = `${prefix}-net`;
const results: { name: string; result: string }[] = [];
const servers: Server[] = [];
function docker(...args: string[]) { return execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(); }
function sql(text: string, vars: string[] = []) {
  return execFileSync("docker", ["exec", "-i", pg, "psql", "-X", "-U", "postgres", "-d", "b01", "-v", "ON_ERROR_STOP=1", ...vars, "-At"], { input: text, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}
function publish(id: string, value: boolean, expected: boolean) {
  return sql(readFileSync(resolve(root, "infra/sql/admin/set_bar_publication.sql"), "utf8"), ["-v", `local_id=${id}`, "-v", `publish=${value}`, "-v", `expected=${expected}`]);
}
async function check(name: string, fn: () => unknown | Promise<unknown>) {
  try { await fn(); results.push({ name, result: "PASS" }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, result: "FAIL" }); throw error; }
}
async function listen(server: Server) {
  servers.push(server);
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing local port");
  return `http://127.0.0.1:${address.port}`;
}
const id = "10000000-0000-4000-8000-000000000001";


async function main() {
  const daemon = process.env.DOCKER_HOST || docker("context", "inspect", "--format", "{{.Endpoints.docker.Host}}");
  assert.match(daemon, /^(?:unix:\/\/\/|npipe:\/\/\/\/\.\/pipe\/)/, "Local Docker engine required");
  const secret = randomBytes(40).toString("hex");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const jwtPayload = Buffer.from(JSON.stringify({ role: "service_role", exp: Math.floor(Date.now()/1000) + 7200 })).toString("base64url");
  const unsigned = `${header}.${jwtPayload}`;
  const serviceToken = `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
  docker("network", "create", network);
  docker("run", "--rm", "-d", "--name", pg, "--network", network, "-e", "POSTGRES_DB=b01", "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-bookworm");
  for (let attempt = 0; ; attempt++) {
    try { docker("exec", pg, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", "b01"); break; }
    catch (error) { if (attempt >= 30) throw error; await new Promise(done => setTimeout(done, 500)); }
  }
  const schema = readFileSync(resolve(root, "infra/sql/schema.sql"), "utf8");
  sql(schema.slice(0, schema.indexOf("-- Tabla: orders")));
  sql(readFileSync(resolve(__dirname, "../bar-reservations/fixture.sql"), "utf8"));
  sql(readFileSync(resolve(root, "infra/sql/migrations/021_harden_locals_data_api.sql"), "utf8"));
  sql(readFileSync(resolve(root, "infra/sql/migrations/050_add_bar_publication.sql"), "utf8"));
  sql(schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS reservations"),schema.indexOf("-- Tabla: events_public")));
  sql(readFileSync(resolve(root, "infra/sql/migrations/022_harden_reservations_data_api.sql"), "utf8"));
  const historyId = "90000000-0000-4000-8000-000000000001";
  const clubRow = "90000000-0000-4000-8000-000000000002";
  sql(`insert into reservations(id,local_id,name,email,phone,date,guests,status) values
    ('${historyId}','${id}','Historical','history@example.invalid','0000',now(),1,'cancelled'),
    ('${clubRow}','10000000-0000-4000-8000-000000000004','Club','club@example.invalid','0000',now(),1,'confirmed')`);
  await check("051 applies to the pre-migration table and preserves both legacy rows with NULL reasons", () => {
    assert.equal(sql("select current_database()"), "b01");
    assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='reservations' and column_name='cancel_reason'"), "0");
    const before = sql("select to_jsonb(r) from reservations r order by id");
    const ddl = readFileSync(resolve(root, "infra/sql/migrations/051_add_bar_reservation_cancel_reason.sql"), "utf8");
    sql(ddl);
    assert.equal(sql("select to_jsonb(r) - 'cancel_reason' from reservations r order by id"), before);
    assert.equal(sql("select count(*) from reservations where cancel_reason is null"), "2");
    for (const invalid of ["''", "' '", "E'\\t'", "' padding'", "'tail '", "chr(160)", "repeat('x',161)"]) {
      assert.throws(() => sql(`update reservations set cancel_reason=${invalid} where id='${historyId}'`), /reservations_cancel_reason_valid/);
    }
    assert.throws(() => sql(`update reservations set cancel_reason='text' where id='${clubRow}'`), /reservations_cancel_reason_valid/);
    sql(`begin; update reservations set cancel_reason=repeat('á',160) where id='${historyId}'; rollback;`);
    for (const role of ["anon","authenticated"]) {
      assert.throws(() => sql(`set role ${role}; select cancel_reason from public.reservations`), /permission denied/);
    }
    writeFileSync(resolve(out,"migration.json"), JSON.stringify({
      file:"051_add_bar_reservation_cancel_reason.sql", sha256:createHash("sha256").update(ddl).digest("hex"),
      database:"disposable b01 via docker exec", container:pg, version:sql("show server_version"),
      legacyRows:2, identicalPreexistingFields:true, reasonsAfterMigration:[null,null],
      constraint:sql("select pg_get_constraintdef(oid) from pg_constraint where conname='reservations_cancel_reason_valid'"),
      directClientReadsDenied:true,
    },null,2));
  });
  sql("grant all privileges on reservations to service_role");
  sql(readFileSync(resolve(root, "infra/sql/migrations/025_create_operational_activity_events.sql"), "utf8"));
  sql(readFileSync(resolve(root, "infra/sql/migrations/052_add_club_catalog_visibility.sql"), "utf8"));
  sql("grant insert,select on operational_activity_events to service_role");
  sql("alter table panel_users add column display_name text");
  sql(`insert into panel_users(id, auth_user_id, email, local_id, role) values
    ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','staff@example.invalid','${id}','staff'),
    ('20000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','other@example.invalid','10000000-0000-4000-8000-000000000002','owner'),
    ('20000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000004','club@example.invalid','10000000-0000-4000-8000-000000000004','owner')`);
  const restImage = process.env.B03_POSTGREST_IMAGE || "postgrest/postgrest:v12.2.3";
  docker("run", "--rm", "-d", "--name", rest, "--network", network, "-p", "127.0.0.1::3000", "-e", `PGRST_DB_URI=postgres://authenticator@${pg}:5432/b01`, "-e", "PGRST_DB_SCHEMAS=public", "-e", "PGRST_DB_ANON_ROLE=anon", "-e", `PGRST_JWT_SECRET=${secret}`, restImage);
  const restUrl = `http://${docker("port", rest, "3000/tcp")}`;
  for (let attempt = 0; ; attempt++) {
    try { const response = await fetch(restUrl); if (response.ok) break; throw new Error("PostgREST not ready"); }
    catch (error) { if (attempt >= 30) throw error; await new Promise(done => setTimeout(done, 500)); }
  }
  // Only the Auth provider is simulated; real panelAuth, requireRole, SQL and PostgREST execute.
  let beforeWrite: ((rowId: string | null) => Promise<void>) | undefined;
  const proxy = createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/auth/v1/user")) {
        const token = req.headers.authorization;
        const number = token === "Bearer b03-owner" ? "1" : token === "Bearer b03-staff" ? "2" : token === "Bearer b03-other" ? "3" : token === "Bearer b03-club" ? "4" : null;
        res.writeHead(number ? 200 : 401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(number ? { id: `30000000-0000-4000-8000-00000000000${number}`, aud: "authenticated", role: "authenticated" } : { message: "Synthetic invalid token" }));
      }
      if (!req.url?.startsWith("/rest/v1/")) { res.writeHead(404); return res.end(); }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const headers = { ...req.headers }; delete headers.host; delete headers.connection; delete headers["content-length"];
      if (req.method === "PATCH" && req.url.startsWith("/rest/v1/reservations?")) {
        await beforeWrite?.(new URL(req.url, restUrl).searchParams.get("id"));
      }
      const upstream = await fetch(restUrl + req.url.slice("/rest/v1".length), { method: req.method, headers: headers as Record<string,string>, body: chunks.length ? Buffer.concat(chunks) : undefined });
      const responseHeaders = Object.fromEntries(upstream.headers); delete responseHeaders["content-length"]; delete responseHeaders["content-encoding"];
      res.writeHead(upstream.status, responseHeaders); res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { res.writeHead(500); res.end(); }
  });
  process.env.SUPABASE_URL = await listen(proxy);
  process.env.SUPABASE_SERVICE_ROLE = serviceToken;
  type Attempt = { to: string; html: string; subject: string; savedStatus: string; accepted: boolean };
  const attempts: Attempt[] = [];
  let rejectMail = false;
  const receiver = createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const mail = emailPayload.parse(JSON.parse(Buffer.concat(chunks).toString()));
      const to = typeof mail.to === "string" ? mail.to : mail.to.join(",");
      assert.match(to, /^[a-z0-9-]+@example\.invalid$/);
      attempts.push({
        to, html: mail.html, subject: mail.subject,
        savedStatus: sql(`select status from reservations where email='${to}' order by created_at desc limit 1`),
        accepted: !rejectMail,
      });
      res.writeHead(rejectMail ? 503 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(rejectMail ? { name: "application_error", message: "Synthetic rejection" } : { id: "synthetic-acceptance" }));
    } catch { res.writeHead(500); res.end(); }
  });
  process.env.RESEND_BASE_URL = await listen(receiver);
  process.env.RESEND_API_KEY = "b03-local-transport";
  process.env.EMAIL_ENABLED = "true";
  process.env.EMAIL_FROM_ADDRESS = "test@example.invalid";
  const fetchLocal = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "127.0.0.1") throw new Error("External traffic forbidden in this test");
    return fetchLocal(input, init);
  };
  const { panelRouter } = await import("../../src/routes/panel");
  const { publicRouter } = await import("../../src/routes/public");
  const { createReservationHandler, localsReservationsRouter, reservationsRouter } = await import("../../src/routes/reservations");
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use("/panel", panelRouter);
  app.use("/public", publicRouter);
  app.use("/locals", localsReservationsRouter);
  app.post("/reservations", createReservationHandler({ now: () => new Date("2026-11-06T21:00:00Z") }));
  app.use("/reservations", reservationsRouter);
  let stop: (() => void) | undefined;
  app.post("/__b03/stop", (_req, res) => { res.json({ok:true}); setImmediate(() => stop?.()); });
  const api = await listen(createServer(app));
  async function patch(row: string, body: Record<string, unknown>, role = "owner", prefix = "/panel") {
    const headers: Record<string, string> = { "Content-Type":"application/json" };
    if (role) headers.Authorization = `Bearer b03-${role}`;
    const response = await fetch(`${api}${prefix}/reservations/${row}`, { method:"PATCH", headers, body:JSON.stringify(body) });
    return { status:response.status, body:await response.json() };
  }
  const weekly = { version:1, timezone:"America/Asuncion",days:Object.fromEntries(["mon","tue","wed","thu","fri","sat","sun"].map(day => [day,{ closed:false,ranges:[{start:"18:00",end:"02:00"}] }])) };
  sql(`update locals set opening_hours='${JSON.stringify(weekly)}', name='Bar <B03> & QA' where id='${id}'`);
  publish(id,true,false);
  const privateNote = "PRIVATE-B03-ONLY";
  const customerNote = "CUSTOMER-B03-ONLY";
  async function create(key: string) {
    const email = `${key}@example.invalid`;
    const response = await fetch(api+"/reservations", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({
      local_id:id, name:"<Persona> & QA", email, phone:"000000000", date:"2026-11-07T02:00:00Z", guests:2, notes:customerNote, table_note:privateNote, cancel_reason:"injected", status:"cancelled",
    })});
    assert.equal(response.status,201);
    const row = receipt.parse(await response.json()).id;
    await waitFor(() => attempts.some(mail => mail.to === email) && count(row, "reservation_created") === 1);
    return row;
  }
  function status(row:string) { return sql(`select status from reservations where id='${row}'`); }
  function reason(row:string): string | null {
    return JSON.parse(sql(`select coalesce(to_json(cancel_reason)::text,'null') from reservations where id='${row}'`));
  }
  const cancelConfirmed = (row: string, message: string) =>
    patch(row, {status:"cancelled", expected_status:"confirmed", cancel_reason:message});
  function count(row:string, event:string) {
    return Number(sql(`select count(*) from operational_activity_events where entity_id='${row}' and event_type='${event}'`));
  }
  async function waitFor(predicate:()=>boolean) {
    for(let i=0;i<60;i++) {
      if(predicate()) return;
      await new Promise(resolve => setTimeout(resolve,50));
    }
    throw new Error("Expected test effect did not occur");
  }
  const showsArrival = (html: string) =>
    html.includes("6 de noviembre de 2026") && /23:00|11:00 p\.\s*m\./.test(html);
  const primary = await create("primary");
  await check("B02 received mail follows the committed pending row, correct recipient, escaped data and Asuncion time", () => {
    const [mail] = attempts;
    assert.equal(mail.to,"primary@example.invalid");
    assert.equal(mail.savedStatus,"en_revision");
    assert.ok(mail.accepted && mail.html.includes("&lt;Persona&gt; &amp; QA") && mail.html.includes("Bar &lt;B03&gt; &amp; QA") && showsArrival(mail.html));
    assert.ok(!mail.html.includes(customerNote) && !mail.html.includes(privateNote));
    writeFileSync(resolve(out,"received.html"),mail.html);
  });
  await check("Public PATCH, missing session and foreign owner cannot change the reservation", async () => {
    assert.equal((await patch(primary,{status:"confirmed"},"","")).status,410);
    assert.equal((await patch(primary,{status:"confirmed"},"")).status,401);
    assert.equal((await patch(primary,{status:"confirmed"},"invalid")).status,401);
    assert.equal((await patch(primary,{status:"confirmed"},"other")).status,403);
    assert.equal(status(primary),"en_revision");
    assert.equal(count(primary,"reservation_confirmed"),0);
    assert.equal(attempts.length,1);
  });
  await check("Editing a private note preserves the comment, persists the note and sends no status mail",async()=>{
    const result=await patch(primary,{table_note:privateNote},"staff");
    assert.equal(result.status,200);
    assert.equal(mutation.parse(result.body).table_note,privateNote);
    assert.equal(sql(`select notes from reservations where id='${primary}'`),customerNote);
    await waitFor(()=>count(primary,"reservation_table_note_updated")===1);
    assert.equal(attempts.length,1);
  });
  await check("Staff confirms once, then stale repeat conflicts without new transition effects",async()=>{
    assert.equal((await patch(primary,{status:"confirmed"},"staff")).status,200);
    await waitFor(()=>attempts.length===2 && count(primary,"reservation_confirmed")===1);
    const mail=attempts[1];
    assert.equal(mail.to,"primary@example.invalid");
    assert.equal(mail.savedStatus,"confirmed");
    assert.ok(showsArrival(mail.html) && !mail.html.includes(privateNote) && !mail.html.includes(customerNote));
    writeFileSync(resolve(out,"confirmed.html"),mail.html);
    assert.equal((await patch(primary,{status:"confirmed"})).status,409);
    assert.equal(attempts.length,2);
    assert.equal(count(primary,"reservation_confirmed"),1);
  });
  await check("Confirmed cancellation without valid reason is rejected; stale pending intent stays a conflict", async()=>{
    const before=attempts.length;
    for(const reason of [undefined,"","   ","x".repeat(161)]) {
      assert.equal((await patch(primary,{status:"cancelled",expected_status:"confirmed",cancel_reason:reason})).status,400);
    }
    assert.equal((await patch(primary,{status:"cancelled",expected_status:"en_revision"})).status,409);
    assert.equal(status(primary),"confirmed");
    assert.equal(reason(primary),null);
    assert.equal(count(primary,"reservation_cancelled"),0);
    assert.equal(attempts.length,before);
  });
  await check("Only bar operators can cancel a confirmed row; private reads recover the reason after save", async () => {
    const before = attempts.length;
    const payload = {status:"cancelled", expected_status:"confirmed", cancel_reason:"  Cierre por lluvia  "};
    assert.equal((await patch(clubRow,payload,"club")).status,409);
    assert.equal(status(clubRow),"confirmed");
    assert.equal((await patch(primary,payload,"other")).status,403);
    assert.equal((await patch(primary,payload,"")).status,401);
    assert.equal((await patch(primary,{cancel_reason:"changed", table_note:"must not save"})).status,400);
    assert.equal((await patch(primary,{status:"confirmed",cancel_reason:"changed"})).status,400);
    const response=await patch(primary,payload,"staff");
    assert.equal(response.status,200);
    assert.equal(mutation.parse(response.body).cancel_reason,"Cierre por lluvia");
    const list=api+"/locals/"+id+"/reservations?date=2026-11-06";
    assert.equal((await fetch(list)).status,401);
    assert.equal((await fetch(list,{headers:{Authorization:"Bearer b03-other"}})).status,403);
    const read=await fetch(list,{headers:{Authorization:"Bearer b03-owner"}});
    assert.equal(read.status,200);
    const row=z.array(mutation).parse(await read.json()).find(item=>item.id===primary);
    assert.equal(row?.status,"cancelled");assert.equal(row.cancel_reason,"Cierre por lluvia");
    assert.equal(row.table_note,privateNote);
    await waitFor(()=>attempts.length===before+1 && count(primary,"reservation_cancelled")===1);
    assert.ok(attempts[before].html.includes(row.cancel_reason));
    assert.equal((await cancelConfirmed(primary,"Un motivo diferente")).status,409);
    assert.equal((await patch(primary,{table_note:"nota posterior"})).status,200);
    assert.equal(reason(primary),row.cancel_reason);
    assert.equal(attempts.length,before+1);
  });
  const pending=await create("pending");
  await check("Pending cancellation needs no reason; even a combined private-note update never supplies the public reason",async()=>{
    const before=attempts.length;
    assert.equal((await patch(pending,{status:"cancelled",table_note:privateNote})).status,200);
    await waitFor(()=>attempts.length===before+1 && count(pending,"reservation_cancelled")===1);
    const mail=attempts[before];
    assert.equal(mail.to,"pending@example.invalid");assert.equal(mail.savedStatus,"cancelled");
    assert.equal(reason(pending),null);
    assert.ok(!mail.html.includes(privateNote) && !mail.html.includes(customerNote) && !mail.html.includes("Motivo informado"));
    assert.equal((await patch(pending,{status:"cancelled"})).status,409);
    assert.equal((await patch(pending,{status:"confirmed"})).status,409);
    assert.equal((await patch(pending,{status:"en_revision"})).status,400);
    assert.equal((await patch(pending,{table_note:"private edit after cancellation"})).status,200);
    assert.equal(count(pending,"reservation_cancelled"),1);assert.equal(attempts.length,before+1);
  });
  const explicit=await create("explicit");
  await check("Optional explicit customer-facing reason is escaped, with no private note in cancellation mail",async()=>{
    const before=attempts.length;
    assert.equal((await patch(explicit,{status:"cancelled",cancel_reason:"  Cierre <aviso> & cambio  ",table_note:privateNote})).status,200);
    await waitFor(()=>attempts.length===before+1);
    const mail=attempts[before];
    assert.equal(mail.to,"explicit@example.invalid");assert.ok(mail.html.includes("Cierre &lt;aviso&gt; &amp; cambio") && showsArrival(mail.html));
    assert.ok(!mail.html.includes(privateNote) && !mail.html.includes(customerNote));
    writeFileSync(resolve(out,"cancelled.html"),mail.html);
    await waitFor(() => count(explicit, "reservation_cancelled") === 1);
    const columns = sql("select column_name from information_schema.columns where table_schema='public' and table_name='reservations' order by ordinal_position").split("\n");
    const historyMetadata = sql(`select metadata from operational_activity_events where entity_id='${explicit}' and event_type='reservation_cancelled'`);
    assert.ok(columns.includes("notes") && columns.includes("table_note") && columns.includes("cancel_reason"));
    assert.equal(reason(explicit),"Cierre <aviso> & cambio");
    assert.deepEqual(JSON.parse(historyMetadata), {status:"cancelled"});
    writeFileSync(resolve(out, "reason-storage.json"), JSON.stringify({
      source: "local PostgreSQL instantiated from repository schema",
      reservationColumns: columns, storedCancellationMetadata: JSON.parse(historyMetadata),
      explicitReasonPresentInMail: true, durableReasonColumnPresent: true, savedReason: reason(explicit),
    },null,2));
  });
  async function compete(row: string, requests: () => ReturnType<typeof patch>[]) {
    let arrived=0;
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const timeout=setTimeout(release,5000);
    beforeWrite=async row=>{
      if(row!==expectedFilter)return;
      if(++arrived===2)release();
      await gate;
    };
    const expectedFilter=`eq.${row}`;
    try {
      const pair=await Promise.all(requests());
      assert.equal(arrived,2);assert.deepEqual(pair.map(r=>r.status).sort(),[200,409]);
      return mutation.parse(pair.find(r=>r.status===200)!.body);
    } finally { clearTimeout(timeout);beforeWrite=undefined; }
  }
  const race=await create("race");
  await check("Two pending intents produce one winner, one conflict and one set of effects", async () => {
    const before=attempts.length;
    const winner=await compete(race,()=>[patch(race,{status:"confirmed"}),patch(race,{status:"cancelled"})]);
    assert.equal(status(race),winner.status);
    await waitFor(()=>attempts.length===before+1 && count(race,"reservation_confirmed")+count(race,"reservation_cancelled")===1);
  });
  const duel=await create("duel");
  await check("Competing reasons: only the winning reason is saved, mailed and returned", async () => {
    assert.equal((await patch(duel,{status:"confirmed"})).status,200);
    await waitFor(()=>attempts.some(mail=>mail.to==="duel@example.invalid" && mail.savedStatus==="confirmed"));
    const before=attempts.length;
    const reasons=["Cierre del salón","Cierre por tormenta"];
    const winner=await compete(duel,()=>reasons.map(message=>cancelConfirmed(duel,message)));
    assert.ok(winner.cancel_reason && reasons.includes(winner.cancel_reason));
    assert.equal(reason(duel),winner.cancel_reason);
    await waitFor(()=>attempts.length===before+1 && count(duel,"reservation_cancelled")===1);
    const mail=attempts[before];
    assert.equal(mail.savedStatus,"cancelled");assert.ok(mail.html.includes(winner.cancel_reason));
    assert.ok(!mail.html.includes(reasons.find(value=>value!==winner.cancel_reason)!));
    writeFileSync(resolve(out,"race.json"),JSON.stringify({responses:[200,409],stored:reason(duel),mailed:winner.cancel_reason,
      cancellationEvents:count(duel,"reservation_cancelled"),transportCalls:attempts.length-before},null,2));
  });
  const failed=await create("failed");
  await check("Transport rejects after persistence; caller still receives saved state and retry sends no duplicate",async()=>{
    rejectMail=true;
    const before=attempts.length;
    try {
      const response=await patch(failed,{status:"confirmed"});assert.equal(response.status,200);
      await waitFor(()=>attempts.length===before+1 && count(failed,"reservation_confirmed")===1);
      assert.equal(attempts[before].accepted,false);assert.equal(attempts[before].savedStatus,"confirmed");assert.equal(status(failed),"confirmed");
      assert.equal((await patch(failed,{status:"confirmed"})).status,409);assert.equal(attempts.length,before+1);
      assert.equal((await cancelConfirmed(failed,"Corte de energía")).status,200);
      await waitFor(()=>attempts.length===before+2 && count(failed,"reservation_cancelled")===1);
      assert.equal(attempts[before+1].accepted,false);
      assert.equal(attempts[before+1].savedStatus,"cancelled");
      assert.ok(attempts[before+1].html.includes("Corte de energía"));
      assert.equal(reason(failed),"Corte de energía");
    } finally {rejectMail=false;}
  });
  const hidden=await create("hidden");
  await check("With publication withdrawn, existing rows remain privately manageable and public creation remains closed",async()=>{
    publish(id,false,true);
    assert.equal((await patch(hidden,{status:"confirmed"})).status,200);
    assert.equal(status(hidden),"confirmed");
    assert.equal((await cancelConfirmed(hidden,"Cierre del bar")).status,200);
    assert.equal(reason(hidden),"Cierre del bar");
    assert.equal((await fetch(api+"/public/locals/by-slug/b01-nuevo")).status,404);
    const rejected = await fetch(api+"/reservations", {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ local_id:id, name:"QA", email:"hidden-new@example.invalid", phone:"000000000",
        date:"2026-11-06T21:30:00Z", guests:1 }),
    });
    assert.equal(rejected.status,404);
    assert.equal(sql("select count(*) from reservations where email='hidden-new@example.invalid'"),"0");
    publish(id,true,false);
  });
  await check("Drained transition histories and transport counts contain no duplicate effects", () => {
    assert.equal(sql("select count(*) from (select entity_id, event_type from operational_activity_events where event_type in ('reservation_confirmed','reservation_cancelled') group by entity_id,event_type having count(*) > 1) duplicates"), "0");
    for (const [key,total] of Object.entries({primary:3,pending:2,explicit:2,race:2,failed:3,hidden:3,duel:3,club:0})) {
      assert.equal(attempts.filter(mail => mail.to === key + "@example.invalid").length, total,key);
    }
  });
  writeFileSync(resolve(out,"integration-results.json"),JSON.stringify(results,null,2));
  if(process.argv.includes("--serve")) {
    const desktop = await create("desktop");
    const mobile = await create("mobile");
    const browserConfirm = await create("browser-confirm");
    const confirmedDesktop = await create("confirmed-desktop");
    const confirmedMobile = await create("confirmed-mobile");
    for (const row of [confirmedDesktop,confirmedMobile]) {
      assert.equal((await patch(row,{status:"confirmed",table_note:privateNote})).status,200);
    }
    writeFileSync(resolve(out,"local-runtime.json"),JSON.stringify({
      api, day:"2026-11-06", desktop, mobile, browserConfirm, confirmedDesktop, confirmedMobile, localId:id, pg,
      auth:"simulated provider, actual panelAuth and role checks",
      transport:"actual SDK redirected to loopback",
    }));
    console.log("B03_READY "+api);
    await new Promise<void>(resolve=>{stop=resolve;});
  }
}
main().catch(error=>{console.error(error instanceof Error?error.message:"test failed");process.exitCode=1;}).finally(async()=>{
  writeFileSync(resolve(out,"integration-results.json"),JSON.stringify(results,null,2));
  for (const server of [...servers].reverse()) {
    await new Promise<void>(done => server.close(() => done()));
  }
  for(const name of [rest,pg]) {try{docker("rm","-f",name);}catch{/* May already be stopped. */}}
  try{docker("network","rm",network);}catch{/* May already be removed. */}
});
