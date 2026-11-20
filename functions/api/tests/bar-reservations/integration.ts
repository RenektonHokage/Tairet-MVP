import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer, type Server } from "node:http";
import express from "express";
import cors from "cors";
import { z } from "zod";

const receipt = z.object({ id: z.string().uuid(), status: z.literal("en_revision"), date: z.string(), guests: z.number().int(), created_at: z.string() }).strict();
const privateRows = z.array(z.object({ id: z.string().uuid(), date: z.string(), status: z.string() }));
const catalogRows = z.array(z.object({ slug: z.string(), is_published: z.literal(true) }));

// Never read .env or connect to an existing database. This runner owns all containers it touches.
const root = resolve(__dirname, "../../../..");
const out = process.argv[2];
if (!out || out.startsWith("--")) throw new Error("Pass a persistent evidence directory as the first argument");
mkdirSync(out, { recursive: true });
const prefix = `tairet-b02-${Date.now()}`;
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
const clubId = "10000000-0000-4000-8000-000000000004";

async function main() {
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
  sql(readFileSync(resolve(__dirname, "fixture.sql"), "utf8"));
  sql(readFileSync(resolve(root, "infra/sql/migrations/021_harden_locals_data_api.sql"), "utf8"));
  sql(readFileSync(resolve(root, "infra/sql/migrations/050_add_bar_publication.sql"), "utf8"));
  sql(schema.slice(schema.indexOf("CREATE TABLE IF NOT EXISTS reservations"),schema.indexOf("-- Tabla: events_public")));
  sql(readFileSync(resolve(root, "infra/sql/migrations/051_add_bar_reservation_cancel_reason.sql"), "utf8"));
  sql(readFileSync(resolve(root, "infra/sql/migrations/052_add_club_catalog_visibility.sql"), "utf8"));
  sql("grant all privileges on reservations to service_role");
  await check("Migration keeps existing demos unpublished and defaults new bars to false", () => {
    assert.equal(sql("select count(*) from locals where is_published"), "0");
    sql("insert into locals(name,slug,type) values ('Nuevo default','b01-default','bar')");
    assert.equal(sql("select is_published from locals where slug='b01-default'"), "f");
  });
  await check("anon/authenticated cannot update publication through the Data API role", () => {
    for (const role of ["anon", "authenticated"]) {
      assert.throws(() => sql(`SET ROLE ${role}; UPDATE locals SET is_published=true;`));
      assert.throws(() => sql(`SET ROLE ${role}; SELECT name,slug FROM locals;`));
    }
  });
  const restImage = process.env.B02_POSTGREST_IMAGE || "postgrest/postgrest:v12.2.3";
  docker("run", "--rm", "-d", "--name", rest, "--network", network, "-p", "127.0.0.1::3000", "-e", `PGRST_DB_URI=postgres://authenticator@${pg}:5432/b01`, "-e", "PGRST_DB_SCHEMAS=public", "-e", "PGRST_DB_ANON_ROLE=anon", "-e", `PGRST_JWT_SECRET=${secret}`, restImage);
  const restUrl = `http://${docker("port", rest, "3000/tcp")}`;
  for (let attempt = 0; ; attempt++) {
    try { const response = await fetch(restUrl); if (response.ok) break; throw new Error("PostgREST not ready"); }
    catch (error) { if (attempt >= 30) throw error; await new Promise(done => setTimeout(done, 500)); }
  }
  // Only the Auth provider is simulated; real panelAuth, requireRole, SQL and PostgREST execute.
  const proxy = createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/auth/v1/user")) {
        const token = req.headers.authorization;
        const number = token === "Bearer b01-owner" ? "1" : token === "Bearer b01-staff" ? "2" : null;
        res.writeHead(number ? 200 : 401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(number ? { id: `30000000-0000-4000-8000-00000000000${number}`, aud: "authenticated", role: "authenticated" } : { message: "Synthetic invalid token" }));
      }
      if (!req.url?.startsWith("/rest/v1/")) { res.writeHead(404); return res.end(); }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const headers = { ...req.headers }; delete headers.host; delete headers.connection; delete headers["content-length"];
      const upstream = await fetch(restUrl + req.url.slice("/rest/v1".length), { method: req.method, headers: headers as Record<string,string>, body: chunks.length ? Buffer.concat(chunks) : undefined });
      const responseHeaders = Object.fromEntries(upstream.headers); delete responseHeaders["content-length"]; delete responseHeaders["content-encoding"];
      res.writeHead(upstream.status, responseHeaders); res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { res.writeHead(500); res.end(); }
  });
  process.env.SUPABASE_URL = await listen(proxy);
  process.env.SUPABASE_SERVICE_ROLE = serviceToken;
  delete process.env.RESEND_API_KEY;
  process.env.EMAIL_ENABLED="false";
  const { publicRouter } = await import("../../src/routes/public");
  const { panelLocalRouter } = await import("../../src/routes/panelLocal");
  const app = express(); app.use(cors()); app.use(express.json());
  let stopServing: (() => void) | undefined;
  app.post("/__b02/stop", (_req,res) => { res.json({ok:true}); setImmediate(() => stopServing?.()); });
  app.use("/public", publicRouter); app.use("/panel/local", panelLocalRouter);
  app.get("/reviews", (_req,res) => res.json({items:[],stats:{totalReviews:0,averageRating:0}}));
  // Tracking is acknowledged locally; no operational mutations run in this harness.
  app.post("/events/:event", (_req,res) => res.json({ ok: true }));
  const api = await listen(createServer(app));
  async function call(path: string, body?: unknown, auth?: string) {
    const response = await fetch(api + path, { method: body === undefined ? "GET" : "PATCH", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
  }
  let now = new Date("2026-11-06T21:00:00.000Z");
  const mails: string[] = [];
  let activities = 0;
  const { createReservationHandler, localsReservationsRouter } = await import("../../src/routes/reservations");
  const { renderReservationEmail } = await import("../../src/services/emails");
  app.post("/reservations", createReservationHandler({ now: () => now,
    sendReceived: async input => { mails.push(renderReservationEmail({...input,status:"pending"}).html); },
    recordActivity: async () => { activities++; },
  }));
  app.use("/locals",localsReservationsRouter);
  app.get("/__b02/state", (_req,res) => res.json({ count:Number(sql("select count(*) from reservations")),mails:mails.length,activities }));
  app.post("/__b02/clock", (req,res) => { now=new Date(req.body.now);res.json({now:now.toISOString()}); });
  const weekly = { version:1,timezone:"America/Asuncion",days:Object.fromEntries(["mon","tue","wed","thu","fri","sat","sun"].map(day=>[day,{closed:day!=="fri" && day!=="sat",ranges:day==="fri"?[{start:"18:00",end:"02:00"}]:day==="sat"?[{start:"20:00",end:"23:00"}]:[]}])) };
  sql(`update locals set opening_hours='${JSON.stringify(weekly)}'::jsonb where id='${id}'`);
  publish(id,true,false);
  const payload={local_id:id,name:"Persona sintética",last_name:"QA",email:"qa@example.invalid",phone:"000000000",date:"2026-11-06T21:30:00.000Z",guests:1,notes:"Comentario legítimo"};
  async function post(change:Record<string,unknown>={}) {
    const response=await fetch(api+"/reservations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,...change})});
    return {status:response.status,body:await response.json()};
  }
  const counts=()=>[Number(sql("select count(*) from reservations")),mails.length,activities];
  async function rejected(name:string,change:Record<string,unknown>,status:number,code?:string) {
    await check(name,async()=>{const before=counts();const result=await post(change);assert.equal(result.status,status,JSON.stringify(result.body));if(code)assert.equal(z.object({code:z.string()}).parse(result.body).code,code);assert.deepEqual(counts(),before);});
  }
  await check("same day, exactly 30 minutes and guest bounds 1/15 remain pending",async()=>{
    for(const guests of [1,15]) {const result=await post({guests});assert.equal(result.status,201);const row=receipt.parse(result.body);assert.equal(Date.parse(row.date),Date.parse(payload.date));}
    assert.deepEqual(counts(),[2,2,2]);
  });
  for(const guests of [0,16,-1,1.5,"2",null])await rejected(`invalid guests ${JSON.stringify(guests)} has no persistence or notifications`,{guests},400);
  for(const date of ["2026-11-06T21:29:59.999Z","2026-11-06T20:00:00Z"])await rejected(`minimum notice ${date}`,{date},400,"RESERVATION_MIN_NOTICE");
  for(const date of ["invalid","2026-02-30T21:30:00Z","2026-11-06T25:00:00Z","2026-11-06T18:30:00"])await rejected(`invalid date ${date}`,{date},400,"INVALID_RESERVATION_DATE");
  await rejected("closing instant is excluded",{date:"2026-11-07T05:00:00Z"},409,"LOCAL_CLOSED_TIME");
  await rejected("outside ranges",{date:"2026-11-07T06:00:00Z"},409,"LOCAL_CLOSED_TIME");
  await rejected("closed weekday",{date:"2026-11-08T21:30:00Z"},409,"LOCAL_CLOSED_DAY");
  await check("overnight Saturday 01:00 belongs to Friday; explicit offset normalizes to UTC",async()=>{
    const result=await post({date:"2026-11-07T01:00:00-03:00"});assert.equal(result.status,201);const row=receipt.parse(result.body);assert.equal(Date.parse(row.date),Date.parse("2026-11-07T04:00:00Z"));
    const read=await call(`/locals/${id}/reservations?date=2026-11-07`,undefined,"b01-owner");assert.equal(read.status,200);assert.ok(privateRows.parse(read.body).some(item=>item.id===row.id && Date.parse(item.date)===Date.parse(row.date)));
    assert.ok(mails.at(-1)?.includes("01:00"));writeFileSync(resolve(out,"reservation-email.html"),mails.at(-1)!);
  });
  sql(`insert into local_daily_ops(local_id,day,is_open) values ('${id}','2026-11-07',false)`);
  await check("Saturday closure preserves Friday overnight",async()=>assert.equal((await post({date:"2026-11-07T04:00:00Z"})).status,201));
  await rejected("Saturday closure blocks its own evening",{date:"2026-11-07T23:30:00Z"},409,"LOCAL_CLOSED_DAY");
  sql(`insert into local_daily_ops(local_id,day,is_open) values ('${id}','2026-11-06',false),('${id}','2026-11-08',true)`);
  await rejected("Friday closure blocks Saturday overnight",{date:"2026-11-07T04:00:00Z"},409,"LOCAL_CLOSED_DAY");
  await rejected("true override does not open closed Sunday",{date:"2026-11-08T21:30:00Z"},409,"LOCAL_CLOSED_DAY");
  sql("delete from local_daily_ops");
  await check("internal fields discarded; public comment preserved; response has no private note",async()=>{
    const result=await post({status:"confirmed",table_note:"private injection",cancel_reason:"injected",notes:"Comentario legítimo"});assert.equal(result.status,201);const row=receipt.parse(result.body);assert.equal(Object.hasOwn(row,"table_note"),false);
    assert.equal(sql(`select coalesce(table_note,'NULL')||'|'||notes from reservations where id='${row.id}'`),"NULL|Comentario legítimo");
  });
  publish(id,false,true);
  await rejected("hidden bar denies new requests",{},404,"LOCAL_NOT_FOUND");
  await check("withdrawal preserves existing reservations and authenticated private reading",async()=>{
    const before=counts();const read=await call(`/locals/${id}/reservations`,undefined,"b01-owner");assert.equal(read.status,200);assert.equal(privateRows.parse(read.body).length,before[0]);assert.deepEqual(counts(),before);
  });
  publish(id,true,false);
  await rejected("client cannot disguise a club as published bar",{local_id:clubId,type:"bar",is_published:true},404,"LOCAL_NOT_FOUND");
  await rejected("unknown local",{local_id:"10000000-0000-4000-8000-999999999999"},404,"LOCAL_NOT_FOUND");
  for(const raw of [null,{version:1,days:{}}]){
    sql(`update locals set opening_hours=${raw?"'"+JSON.stringify(raw)+"'::jsonb":"NULL"} where id='${id}'`);
    await rejected("missing or invalid schedule fails closed",{},409,"SCHEDULE_UNAVAILABLE");
  }
  sql(`update locals set opening_hours='${JSON.stringify(weekly)}'::jsonb where id='${id}'`);
  sql("alter table local_daily_ops rename to local_daily_ops_unavailable");
  await rejected("override lookup failure fails closed",{},503,"SCHEDULE_UNAVAILABLE");
  sql("alter table local_daily_ops_unavailable rename to local_daily_ops");
  await check("B01 list and detail still expose only published bars",async()=>{
    const list=await call("/public/locals?type=bar");const rows=catalogRows.parse(list.body);assert.equal(rows.length,1);assert.equal(rows[0].slug,"b01-nuevo");assert.equal((await call("/public/locals/by-slug/b01-nuevo")).status,200);assert.equal((await call("/public/locals/by-slug/mckharthys-bar")).status,404);
  });
  writeFileSync(resolve(out,"integration-results.json"),JSON.stringify({results,clock:now.toISOString(),counts:counts(),limits:"PostgreSQL/PostgREST and routers real; Auth provider, email delivery and activity effects intercepted"},null,2));
  writeFileSync(resolve(out,"local-runtime.json"),JSON.stringify({ api, pgContainer:pg, postgrestContainer:rest, network, auth:"synthetic provider; real panel middleware", processTimezone:Intl.DateTimeFormat().resolvedOptions().timeZone, effects:"intercepted email/activity", postgrestImage:restImage },null,2));
  if (process.argv.includes("--serve")) {
    console.log(`B02_READY ${api}`);
    await new Promise<void>(done => { stopServing=done; process.once("SIGINT",done); process.once("SIGTERM",done); });
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode=1; }).finally(async () => {
  writeFileSync(resolve(out,"integration-results.json"),JSON.stringify({results,limits:"PG/PostgREST real; synthetic Auth; email/activity intercepted"},null,2));
  for (const server of servers) { server.closeAllConnections(); await new Promise<void>(done => server.close(()=>done())); }
  for (const name of [rest,pg]) { try { docker("rm","-f",name); } catch { /* Already stopped. */ } }
  try { docker("network","rm",network); } catch { /* Already removed. */ }
});
