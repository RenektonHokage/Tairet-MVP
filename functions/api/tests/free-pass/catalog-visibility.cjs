// Run via the installed tsx CLI with PostgreSQL's bin directory. Optional browser
// arguments: an installed playwright-core module and a Chromium executable.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { mock } = require("node:test");
const express = require("express");
const { withPostgres } = require("./postgres-fixture.cjs");
const { installTransport, literal: q } = require("./transport.cjs");

const root = path.resolve(__dirname, "../../../..");
const schemaDir = path.join(root, "infra/sql");
const migration = name => readFileSync(path.join(schemaDir, "migrations", name), "utf8");
const visibility = "052_add_club_catalog_visibility.sql";

async function verify({ sql, dir }) {
  const schema = readFileSync(path.join(schemaDir, "schema.sql"), "utf8");
  assert.ok(schema.includes("-- Tabla: payment_events"));
  await sql(schema.split("-- Tabla: payment_events")[0] + "\nCREATE ROLE anon; CREATE ROLE authenticated;");
  for (const file of ["006_create_catalog_tables.sql", "007_money_bigint.sql", "011_add_orders_valid_window.sql",
    "012_add_orders_intended_date_night_window.sql", "021_harden_locals_data_api.sql",
    "025_create_operational_activity_events.sql", "050_add_bar_publication.sql"]) {
    await sql(migration(file));
  }

  // API-only uses a new, unlisted slug. The browser run uses two local editorial
  // fixture keys so removal is observable there too. All database records are synthetic.
  const [trialSlug, controlSlug] = process.argv[3]
    ? require(path.join(root, "apps/web-b2c/src/lib/mvpSlugs.ts")).MVP_CLUB_SLUGS
    : ["lab-retiro-" + randomUUID().slice(0, 8), "lab-visible-0"];
  const controls = Array.from({ length: 5 }, (_, n) => ({
    id: randomUUID(), slug: n === 0 ? controlSlug : "lab-visible-" + n,
  }));
  const trial = { id: randomUUID(), slug: trialSlug };
  const bar = { id: randomUUID(), slug: "lab-bar-visible" }, draft = { id: randomUUID(), slug: "lab-bar-draft" };
  async function addLocal(row, type, published) {
    await sql("INSERT INTO locals(id,slug,name,type,is_published,attributes) VALUES (" +
      [row.id, row.slug, "Ficha de laboratorio " + row.slug, type, published, ["Fixture"]].map(q).join(",") + ");");
  }
  for (const c of controls) await addLocal(c, "club", false);
  await addLocal(bar, "bar", true);
  await addLocal(draft, "bar", false);
  const originalIds = [...controls, bar, draft].map(r => q(r.id)).join(",");
  const originals = () => sql("SELECT jsonb_agg(jsonb_build_array(to_jsonb(l)-'is_club_catalog_hidden', " +
    "l.xmin::text,l.ctid::text) ORDER BY l.id) FROM locals l WHERE id IN (" + originalIds + ");");
  const before = await originals();
  await sql(migration(visibility));
  assert.ok(await originals() === before, "Migration must preserve all original fields and tuple versions");
  assert.equal(await sql("SELECT count(*) FROM locals WHERE type='club' AND NOT is_published AND NOT is_club_catalog_hidden;"), "5");
  await sql("DO $$ BEGIN UPDATE locals SET is_club_catalog_hidden=true WHERE id=" + q(bar.id) +
    "; RAISE EXCEPTION 'Unexpected hidden bar'; EXCEPTION WHEN check_violation THEN NULL; END $$;");
  console.log("PASS migration 052: five existing clubs, both bars, original values and tuple versions preserved");

  await addLocal(trial, "club", false); // no value supplied for the new flag
  const ticket = randomUUID(), order = randomUUID(), created = randomUUID(), used = randomUUID();
  const document = "LAB-" + randomUUID().slice(0, 8);
  const stamp = "2025-03-12T00:23:45.678Z";
  await sql("INSERT INTO ticket_types(id,local_id,name,price) VALUES (" + q(ticket) + "," + q(trial.id) + ",'Free Pass de prueba',0);" +
    " INSERT INTO orders(id,local_id,customer_document,quantity,total_amount,status,payment_method,used_at) VALUES (" +
    [order, trial.id, document, 2, 0, "paid", "free_pass", stamp].map(q).join(",") + ");" +
    " INSERT INTO operational_activity_events(id,local_id,entity_type,entity_id,event_type,actor_type,message,created_at) VALUES (" +
    [created, trial.id, "order", order, "order_created", "customer", "Alta sintética", "2025-03-11T20:00:00Z"].map(q).join(",") +
    "),(" + [used, trial.id, "order", order, "order_checked_in", "panel_user", "Consumo sintético", stamp].map(q).join(",") + ");");
  // This fingerprint covers the complete order (including its credential), catalog and history without logging them.
  const historyHash = () => sql("SELECT encode(digest(jsonb_build_array(" +
    "(SELECT to_jsonb(o) FROM orders o WHERE id=" + q(order) + " AND local_id=" + q(trial.id) + ")," +
    "(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM operational_activity_events a WHERE local_id=" + q(trial.id) + " AND entity_id=" + q(order) + ")," +
    "(SELECT to_jsonb(t) FROM ticket_types t WHERE id=" + q(ticket) + " AND local_id=" + q(trial.id) + "))::text,'sha256'),'hex');");
  const historyBefore = await historyHash();
  const t = installTransport(sql, { club: trial.id, other: controls[0].id });
  process.env.EMAIL_ENABLED = "false";
  delete process.env.RESEND_API_KEY;
  const { logger } = require("../../src/utils/logger");
  for (const level of ["info", "warn", "error"]) mock.method(logger, level, () => {});
  const app = express();
  app.use("/public", require("../../src/routes/public").publicRouter);
  app.use("/panel", require("../../src/routes/panel").panelRouter);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    async function get(route, actor) {
      const res = await t.fetch(base + route, { headers: actor ? { Authorization: "Bearer " + t.actors[actor] } : {} });
      return { status: res.status, data: await res.json(), cache: res.headers.get("cache-control") };
    }
    const detail = slug => "/public/locals/by-slug/" + slug;
    async function lists(hidden) {
      const clubs = hidden ? controls : [...controls, trial];
      for (const [suffix, expected] of [["?type=club", clubs], ["?type=bar", [bar]], ["", [...clubs, bar]]]) {
        const result = await get("/public/locals" + suffix);
        assert.equal(result.status, 200);
        assert.equal(result.cache, "no-store");
        assert.deepEqual(result.data.map(r => r.id).sort(), expected.map(r => r.id).sort());
      }
      // Compare multiple real result pages with the full ordered list.
      const all = (await get("/public/locals?type=club")).data.map(r => r.id);
      const pages = [];
      for (let offset = 0; offset < all.length; offset += 2) {
        const page = await get("/public/locals?type=club&limit=2&offset=" + offset);
        assert.equal(page.status, 200);
        pages.push(...page.data.map(r => r.id));
      }
      assert.deepEqual(pages, all);
    }
    async function publicCycle(hidden) {
      await lists(hidden);
      const profile = await get(detail(trial.slug)), catalog = await get(detail(trial.slug) + "/catalog");
      for (const route of [profile, catalog]) {
        assert.equal(route.status, hidden ? 404 : 200);
        assert.equal(route.cache, "no-store");
        if (hidden) assert.equal(route.data.error, "LOCAL_NOT_FOUND");
      }
      if (!hidden) {
        assert.equal(profile.data.id, trial.id);
        assert.equal(catalog.data.local_id, trial.id);
        assert.deepEqual(catalog.data.tickets.map(t => [t.id, t.price]), [[ticket, 0]]);
      }
      assert.equal((await get(detail(controlSlug))).data.id, controls[0].id);
      assert.equal((await get(detail(controlSlug) + "/catalog")).status, 200);
      assert.equal((await get(detail(bar.slug))).status, 200);
      assert.equal((await get(detail(draft.slug))).status, 404);
      for (const b of [bar, draft]) {
        const res = await get(detail(b.slug) + "/catalog");
        assert.deepEqual([res.status, res.data.error], [400, "NOT_A_CLUB"]);
      }
      assert.equal((await get(detail(trial.slug) + "/access-catalog")).status, 200);
      assert.ok(await originals() === before, "Other venues changed");
      assert.equal(await historyHash(), historyBefore);
    }

    for (const c of controls) {
      assert.equal((await get(detail(c.slug))).data.id, c.id);
      assert.equal((await get(detail(c.slug) + "/catalog")).status, 200);
    }
    const orders = "/panel/orders/search?document=" + document;
    const activity = "/panel/activity/entity?entity_type=order&entity_id=" + order;
    async function checkHistory() {
      const receipt = await get(orders, "staff");
      assert.equal(receipt.status, 200);
      assert.deepEqual(receipt.data.items.map(r => [r.id, r.quantity, r.status, r.checkin_state, new Date(r.used_at).toISOString()]),
        [[order, 2, "paid", "used", stamp]]);
      const log = await get(activity, "staff");
      assert.equal(log.status, 200);
      assert.deepEqual(log.data.items.map(a => [a.id, a.entity_id, a.event_type]), [
        [created, order, "order_created"], [used, order, "order_checked_in"],
      ]);
      for (const route of [orders, activity]) {
        assert.equal((await get(route)).status, 401);
        const foreign = await get(route, "other");
        assert.equal(foreign.status, 200);
        assert.equal(foreign.data.items.length, 0);
      }
    }

    async function cycle(checkBrowser) {
      for (const phase of ["default", "hidden", "visible"]) {
        const hidden = phase === "hidden";
        if (phase !== "default") {
          assert.equal(await sql("UPDATE locals SET is_club_catalog_hidden=" + q(hidden) +
            " WHERE id=" + q(trial.id) + " AND type='club' AND is_club_catalog_hidden=" + q(!hidden) + " RETURNING id;"), trial.id);
        }
        await publicCycle(hidden);
        if (hidden) await checkHistory();
        if (checkBrowser) await checkBrowser({ trialSlug, controlSlug, hidden });
        console.log("PASS " + phase + ": public list and pages, profile, legacy catalog, bars, sibling venues and stored history");
      }
      console.log("PASS hidden history: staff can read the same used order and both activity rows; anonymous and other local excluded");
    }
    const [, , , playwrightModule, executablePath] = process.argv;
    if (playwrightModule || executablePath) {
      assert.ok(playwrightModule && executablePath, "Supply both Playwright module and browser executable");
      const url = pathToFileURL(path.join(root, "apps/web-b2c/tests/club-catalog.browser.mjs")).href;
      await (await import(url)).withCatalogBrowser({ base, dir, playwrightModule, executablePath }, cycle);
    } else {
      await cycle();
      console.log("Browser checks not requested");
    }
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    t.restore();
    mock.restoreAll();
  }
}

withPostgres(process.argv[2], verify).catch(error => {
  console.error(String(error?.stack || error).replace(/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}/gi, "[fixture-id]"));
  process.exitCode = 1;
});
