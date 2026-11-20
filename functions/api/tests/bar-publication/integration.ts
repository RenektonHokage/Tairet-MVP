import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createServer, type Server } from "node:http";
import express from "express";
import cors from "cors";

// Never read .env or connect to an existing database. This runner owns all containers it touches.
const root = resolve(__dirname, "../../../..");
const out = process.argv[2];
if (!out || out.startsWith("--")) throw new Error("Pass a persistent evidence directory as the first argument");
mkdirSync(out, { recursive: true });
const prefix = `tairet-b01-${Date.now()}`;
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
const emptyId = "10000000-0000-4000-8000-000000000003";
const clubId = "10000000-0000-4000-8000-000000000004";

async function main() {
  const secret = randomBytes(40).toString("hex");
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role: "service_role", exp: Math.floor(Date.now()/1000) + 7200 })).toString("base64url");
  const unsigned = `${header}.${payload}`;
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
  sql(readFileSync(resolve(root, "infra/sql/migrations/052_add_club_catalog_visibility.sql"), "utf8"));
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
  const restImage = process.env.B01_POSTGREST_IMAGE || "postgrest/postgrest:v12.2.3";
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
  const { publicRouter } = await import("../../src/routes/public");
  const { panelLocalRouter } = await import("../../src/routes/panelLocal");
  const { reviewsRouter } = await import("../../src/routes/reviews");
  const app = express(); app.use(cors()); app.use(express.json());
  let stopServing: (() => void) | undefined;
  app.post("/__b01/stop", (_req,res) => { res.json({ok:true}); setImmediate(() => stopServing?.()); });
  app.use("/public", publicRouter); app.use("/panel/local", panelLocalRouter); app.use("/reviews", reviewsRouter);
  // Tracking is acknowledged locally; no operational mutations run in this harness.
  app.post("/events/:event", (_req,res) => res.json({ ok: true }));
  const api = await listen(createServer(app));
  async function call(path: string, body?: unknown, auth?: string) {
    const response = await fetch(api + path, { method: body === undefined ? "GET" : "PATCH", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cache: response.headers.get("cache-control") };
  }
  const weekly = { version: 1, timezone: "America/Asuncion", days: Object.fromEntries(["mon","tue","wed","thu","fri","sat","sun"].map(day => [day,{ closed:false, ranges:[{ start:"18:00", end:"23:00" }] }])) };
  const profile = { name: "Nombre B2B actualizado", address: "Calle Sintética 456", location: "Centro", city: "Asunción", latitude: -25.28, longitude: -57.63, phone: "000000000", whatsapp: "000000001", opening_hours: weekly, hours: ["Lun: 18:00-23:00"], additional_info: ["Servicio configurado B01"], attributes: ["Terraza","Cocteles"], min_age:21, gallery: ["cover","hero","food"].map((kind,index) => ({ id:`synthetic-${kind}`, url:`http://127.0.0.1:5179/placeholder.svg?${kind}`, path:`synthetic/${kind}.svg`, kind, order:index })) };
  await check("Anonymous profile writes denied; staff cannot publish; owner cannot inject publication with profile fields", async () => {
    assert.equal((await call("/panel/local", { name:"Unauthorized" })).status, 401);
    assert.equal((await call("/panel/local", { is_published:true }, "b01-staff")).status, 403);
    const denied = await call("/panel/local", { ...profile, is_published:true }, "b01-owner");
    assert.equal(denied.status,403); assert.equal(sql(`select is_published from locals where id='${id}'`),"f");
  });
  await check("Owner can read and save unpublished profile without publishing", async () => {
    assert.equal((await call("/panel/local", undefined,"b01-owner")).status,200);
    assert.equal((await call("/panel/local",profile,"b01-owner")).status,200);
    assert.equal(sql(`select is_published from locals where id='${id}'`),"f");
  });
  await check("Unpublished bars excluded from exclusive/mixed lists, direct slug and review names/statistics", async () => {
    assert.deepEqual((await call("/public/locals?type=bar")).body,[]);
    assert.equal((await call("/public/locals")).body.length,1);
    assert.equal((await call("/public/locals/by-slug/b01-nuevo")).status,404);
    const reviews = await call("/reviews"); assert.equal(reviews.status,200); assert.equal(reviews.body.items.length,1); assert.equal(reviews.body.stats.totalReviews,1);
    const hidden = await call(`/reviews?venue_id=${id}`); assert.deepEqual(hidden.body.items,[]); assert.equal(hidden.body.stats.totalReviews,0);
    const create = await fetch(api+"/reviews", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({venue_id:id,venue_type:"bar",display_name:"Synthetic",rating:5,comment:"Hidden target",fingerprint:"b01-hidden-fingerprint"}) });
    assert.equal(create.status,404);
    assert.equal(sql(`select count(*) from reviews where fingerprint='b01-hidden-fingerprint'`),"0");
  });
  await check("Controlled admin publishes only the expected bar; rejects clubs, wrong state and missing id", () => {
    publish(id,true,false);
    assert.throws(() => publish(id,false,false));
    assert.throws(() => publish(clubId,true,false));
    assert.throws(() => publish("10000000-0000-4000-8000-999999999999",true,false));
    assert.equal(sql(`select is_published from locals where id='${id}'`),"t");
  });
  await check("Published detail matches B2B and contains only active current promotions", async () => {
    const detail = await call("/public/locals/by-slug/b01-nuevo"); assert.equal(detail.status,200); assert.equal(detail.cache,"no-store");
    assert.equal(detail.body.is_published,true);
    for (const field of Object.keys(profile)) assert.deepEqual(detail.body[field],profile[field as keyof typeof profile],field);
    assert.equal(detail.body.promotions.length,1); assert.equal(detail.body.promotions[0].title,"Promo de Prueba");
    const list = await call("/public/locals?type=bar"); assert.equal(list.body.length,1); assert.equal(list.body[0].slug,"b01-nuevo");
    assert.equal(list.body[0].is_published,true);
    assert.equal((await call("/public/locals")).body.length,2);
    assert.equal((await call("/reviews")).body.stats.totalReviews,2);
    assert.equal((await call("/panel/local",{name:"Nombre B2B actualizado"},"b01-owner")).status,200);
    assert.equal(sql(`select is_published from locals where id='${id}'`),"t");
  });
  await check("Admin withdrawal hides the same bar immediately without clearing its profile", async () => {
    publish(id,false,true);
    assert.equal((await call("/public/locals/by-slug/b01-nuevo")).status,404);
    assert.deepEqual((await call("/public/locals?type=bar")).body,[]);
    assert.equal((await call(`/reviews?venue_id=${id}`)).body.items.length,0);
    assert.equal((await call("/panel/local",undefined,"b01-owner")).body.local.name,profile.name);
    publish(id,true,false);
  });
  await check("Pagination filters before offset/limit and can discover beyond the first 100 bars", async () => {
    sql("insert into locals(name,slug,type,is_published) select 'Page '||lpad(n::text,3,'0'),'b01-page-'||n,'bar',true from generate_series(1,101) n");
    const first = await call("/public/locals?type=bar&limit=100"); const next = await call("/public/locals?type=bar&limit=100&offset=100");
    assert.equal(first.body.length,100); assert.equal(next.body.length,2);
    assert.equal(new Set([...first.body,...next.body].map(row=>row.id)).size,102);
    assert.equal((await call("/public/locals?offset=-1")).status,400);
    sql("delete from locals where slug like 'b01-page-%'");
  });
  await check("Club detail, legacy catalog and Access public catalog remain readable with default false", async () => {
    assert.equal((await call("/public/locals?type=club")).body.length,1);
    assert.equal((await call("/public/locals/by-slug/morgan")).status,200);
    const legacy = await call("/public/locals/by-slug/morgan/catalog"); assert.equal(legacy.body.tickets.length,1); assert.equal(legacy.body.tables.length,1);
    const access = await call("/public/locals/by-slug/morgan/access-catalog"); assert.equal(access.body.tickets[0].price_gs,60000);
    for (const suffix of ["catalog","access-catalog"]) assert.equal((await call(`/public/locals/by-slug/mckharthys-bar/${suffix}`)).status,400);
  });
  await check("Published bar and existing club can still create reviews with the correct venue identity", async () => {
    for (const [venueId,venueType] of [[id,"bar"],[clubId,"club"]]) {
      const response = await fetch(api+"/reviews", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({venue_id:venueId,venue_type:venueType,display_name:"Visitante sintético",rating:4,comment:"Reseña sintética nueva",fingerprint:`b01-visible-${venueType}`})});
      assert.equal(response.status,201); assert.equal((await response.json()).item.venue_id,venueId);
    }
  });
  publish(emptyId,true,false);
  writeFileSync(resolve(out,"integration-results.json"),JSON.stringify({ results, limits:"PostgreSQL + PostgREST + real Express routes. Auth provider simulated; no production or full Supabase stack." },null,2));
  writeFileSync(resolve(out,"local-runtime.json"),JSON.stringify({ api, pgContainer:pg, postgrestContainer:rest, network, auth:"synthetic provider; real panel middleware", postgrestImage:restImage },null,2));
  if (process.argv.includes("--serve")) {
    console.log(`B01_READY ${api}`);
    await new Promise<void>(done => { stopServing=done; process.once("SIGINT",done); process.once("SIGTERM",done); });
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode=1; }).finally(async () => {
  writeFileSync(resolve(out,"integration-results.json"),JSON.stringify({ results, limits:"PostgreSQL + PostgREST + real Express routes. Auth provider simulated; no production or full Supabase stack." },null,2));
  for (const server of servers) { server.closeAllConnections(); await new Promise<void>(done => server.close(()=>done())); }
  for (const name of [rest,pg]) { try { docker("rm","-f",name); } catch { /* Already stopped. */ } }
  try { docker("network","rm",network); } catch { /* Already removed. */ }
});
