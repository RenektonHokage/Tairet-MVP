// Run with the already installed tsx CLI. Arguments: PostgreSQL bin, optionally
// the installed Playwright module and Chromium executable for the browser cases.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { once } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { mock } = require("node:test");
const express = require("express");
const { withPostgres, until } = require("./postgres-fixture.cjs");
const { installTransport, literal: q } = require("./transport.cjs");

const root = path.resolve(__dirname, "../../../..");
const locals = { club: randomUUID(), other: randomUUID() };
const free = randomUUID(), paid = randomUUID();
const buyer = { customer_name: "Test", customer_last_name: "Fixture", customer_email: "buyer@example.invalid",
  customer_phone: "0000000000", customer_document: "0000000" };
const schemaDir = path.join(root, "infra/sql");
async function seed(sql) {
  // The canonical legacy tables and migrations are loaded into this process's new cluster only.
  const schema = fs.readFileSync(path.join(schemaDir, "schema.sql"), "utf8");
  assert.ok(schema.includes("-- Tabla: payment_events"));
  await sql(schema.split("-- Tabla: payment_events")[0] + "\nCREATE ROLE anon; CREATE ROLE authenticated;");
  for (const file of ["006_create_catalog_tables.sql", "007_money_bigint.sql", "011_add_orders_valid_window.sql",
    "012_add_orders_intended_date_night_window.sql", "025_create_operational_activity_events.sql"]) {
    await sql(fs.readFileSync(path.join(schemaDir, "migrations", file), "utf8"));
  }
  await sql("ALTER TABLE locals ADD COLUMN is_published boolean DEFAULT false;" +
    " INSERT INTO locals(id,slug,name,type,attributes,min_age) VALUES (" + q(locals.club) +
    ",'fixture-discoteca','Discoteca de prueba','club','[\"Jazz\"]',21),(" + q(locals.other) +
    ",'fixture-incompatible','Otro local','bar','[]',null);" +
    " UPDATE locals SET is_published=true WHERE id=" + q(locals.other) + ";" +
    " INSERT INTO ticket_types(id,local_id,name,price) VALUES (" + q(free) + "," + q(locals.club) +
    ",'Free Pass',0),(" + q(paid) + "," + q(locals.club) + ",'Entrada de prueba',50000);");
  await sql("CREATE TABLE fixture_writes(order_id uuid, stamp timestamptz);\n" +
    "CREATE FUNCTION observe_use() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN " +
    "IF OLD.transaction_id = 'fixture-error' THEN RAISE EXCEPTION 'fixture failure'; END IF; " +
    "IF OLD.transaction_id = 'fixture-skip' THEN RETURN NULL; END IF; " +
    "INSERT INTO fixture_writes VALUES(NEW.id,NEW.used_at); RETURN NEW; END; $$;\n" +
    "CREATE TRIGGER observe_use BEFORE UPDATE OF used_at ON orders FOR EACH ROW EXECUTE FUNCTION observe_use();");
}

async function verify({ sql, holdOrder, dir }) {
  await seed(sql);
  const t = installTransport(sql, locals);
  process.env.EMAIL_ENABLED = "false";
  delete process.env.RESEND_API_KEY;
  delete process.env.CLUB_VALID_WINDOW_CUTOFF_ISO;
  const { logger } = require("../../src/utils/logger");
  let mailStubs = 0;
  mock.method(logger, "info", msg => { if (msg === "[EMAIL STUB]") mailStubs++; });
  mock.method(logger, "warn", () => {});
  mock.method(logger, "error", () => {});
  const qr = mock.method(require("qrcode"), "toBuffer"); // call through the real confirmation helper
  const app = express();
  app.use(express.json());
  app.use("/orders", require("../../src/routes/orders").ordersRouter);
  app.use("/panel", require("../../src/routes/panel").panelRouter);
  app.use("/public", require("../../src/routes/public").publicRouter);
  app.get("/reviews", (_req, res) => res.json({ items: [] }));
  app.post("/events/profile_view", (_req, res) => res.sendStatus(204));
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = "http://127.0.0.1:" + server.address().port;
    async function runBrowserCases() {
      assert.ok(process.argv[3] && process.argv[4], "Browser cases require Playwright and a browser executable");
      const { verifyBrowser } = await import(pathToFileURL(path.join(root, "apps/web-b2c/tests/free-pass.browser.mjs")).href);
      const before = mailStubs;
      await verifyBrowser({ api: base, dir, playwrightModule: process.argv[3], executablePath: process.argv[4] });
      await until(() => mailStubs === before + 1, "Free Pass confirmation with mail disabled");
      console.log("PASS FP-05: the browser receipt came from a real order with mail disabled");
    }
    if (process.argv.includes("--only-browser")) {
      await runBrowserCases();
      return;
    }
    async function request(url, method, body, bearer) {
      const response = await t.fetch(base + url, { method, headers: {
        "Content-Type": "application/json", ...(bearer && { Authorization: "Bearer " + bearer }),
      }, body: body && JSON.stringify(body) });
      return { status: response.status, data: await response.json() };
    }
    const payload = { local_id: locals.club, quantity: 1, payment_method: "free_pass", total_amount: 0, ...buyer };
    const item = (ticket, quantity = 1) => ({ ticket_type_id: ticket, quantity });
    const issue = body => request("/orders", "POST", body);
    const count = async table => Number(await sql("SELECT count(*) FROM " + table + ";"));
    for (const items of [[item(paid)], [item(free), item(paid)]]) {
      const invalid = await issue({ ...payload, items });
      assert.equal(invalid.status, 400);
      assert.match(invalid.data.error, /Free Pass/);
      assert.ok(!("checkin_token" in invalid.data));
    }
    assert.deepEqual([t.counters.inserts, t.counters.activities, qr.mock.callCount(), await count("orders")], [0, 0, 0, 0]);
    console.log("PASS FP-01: positive catalog total stopped before insert, credential, activity and mail");

    for (const [fields, quantity] of [[{ items: [item(free, 2)] }, 2], [{ quantity: 3 }, 3], [{ quantity: 4, items: [] }, 4]]) {
      const issued = await issue({ ...payload, ...fields });
      assert.equal(issued.status, 201);
      assert.ok(typeof issued.data.checkin_token === "string" && issued.data.checkin_token.length === 36);
      assert.deepEqual([issued.data.total_amount, issued.data.quantity, issued.data.status], [0, quantity, "paid"]);
      const snapshot = JSON.parse(await sql("SELECT items FROM orders WHERE id=" + q(issued.data.id) + ";"));
      assert.equal(snapshot[0].ticket_type_id, fields.items?.length ? free : null);
    }
    await until(async () => mailStubs === 3 && await count("operational_activity_events") === 3, "creation activity and stub mail");
    const pending = await issue({ local_id: locals.club, quantity: 1, total_amount: 50000, items: [item(paid)] });
    assert.deepEqual([pending.status, pending.data.status, pending.data.total_amount], [201, "pending", 50000]);
    console.log("PASS FP-01/03: free catalog, both legacy fallbacks, existing quantities and pending non-free order");

    async function pass(status = "paid", flag = "") {
      const id = randomUUID();
      const token = await sql("INSERT INTO orders(id,local_id,quantity,total_amount,status,payment_method,transaction_id) VALUES(" +
        [id, locals.club, 1, 0, status, "free_pass", flag].map(q).join(",") + ") RETURNING checkin_token;");
      return { id, token };
    }
    const use = (mode, row, actor = "staff") => request(mode === "QR" ? "/panel/checkin/" + row.token :
      "/panel/orders/" + row.id + "/use", "PATCH", undefined, t.actors[actor]);
    const activity = (row, type) => sql("SELECT count(*) FROM operational_activity_events WHERE entity_id=" +
      q(row.id) + " AND event_type=" + q(type) + ";");

    for (const [first, second] of [["QR", "QR"], ["manual", "manual"], ["QR", "manual"]]) {
      const row = await pass();
      const lock = await holdOrder(row.id);
      const previousActivities = t.counters.activities;
      const requests = Promise.all([use(first, row, "owner"), use(second, row)]);
      try { await lock.waitForWriters(2); } finally { await lock.release(); }
      const responses = await requests;
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      const winner = responses.find(r => r.status === 200).data;
      const loser = responses.find(r => r.status === 409).data;
      assert.equal(loser.error, "Order already used");
      assert.equal(loser.usedAt, winner.used_at);
      assert.equal(await sql("SELECT count(*) FROM fixture_writes WHERE order_id=" + q(row.id) + ";"), "1");
      assert.equal(await sql("SELECT used_at=" + q(winner.used_at) + "::timestamptz FROM orders WHERE id=" + q(row.id) + ";"), "t");
      await until(async () => await activity(row, "order_already_used_attempt") === "1" &&
        await activity(row, "order_checked_in") === "1", "persisted check-in activities");
      assert.equal(t.counters.activities - previousActivities, 2);
      console.log("PASS FP-02 " + first + "+" + second + ": 2 blocked database writers, 200/409, 1 timestamp and 1 success activity");
    }

    for (const mode of ["manual", "QR"]) {
      for (const [cause, change, status] of [
        ["gone", "DELETE FROM orders", 404], ["local", "UPDATE orders SET local_id=" + q(locals.other), 403],
        ["state", "UPDATE orders SET status='cancelled'", 400],
        ...(mode === "QR" ? [["token", "UPDATE orders SET checkin_token=gen_random_uuid()", 404]] : []),
      ]) {
        const row = await pass();
        const lock = await holdOrder(row.id);
        const attempt = use(mode, row);
        try { await lock.waitForWriters(1); } finally { await lock.release(change + " WHERE id=" + q(row.id) + ";"); }
        const result = await attempt;
        assert.equal(result.status, status, mode + " expected classification for " + cause);
        if (cause === "state") assert.equal(result.data.currentStatus, "cancelled");
        assert.ok(!result.data.usedAt);
        assert.equal(await activity(row, "order_checked_in"), "0");
      }
      const valid = await pass(), unpaid = await pass("pending");
      assert.equal((await use(mode, valid, "anonymous")).status, 401);
      assert.equal((await use(mode, valid, "viewer")).status, 403);
      assert.equal((await use(mode, valid, "other")).status, 403);
      assert.equal((await use(mode, unpaid)).status, 400);
      for (const [offset, code] of [["2 days", "not_yet_valid"], ["-2 days", "expired"]]) {
        await sql("UPDATE orders SET valid_from=now()+interval " + q(offset) + ",valid_to=now()+interval " + q(offset) +
          "+interval '1 hour',valid_window_key='fixture' WHERE id=" + q(valid.id) + ";");
        const result = await use(mode, valid);
        assert.deepEqual([result.status, result.data.code], [409, code]);
      }
      assert.equal(await sql("SELECT used_at IS NULL FROM orders WHERE id=" + q(valid.id) + ";"), "t");
      const skipped = await pass("paid", "fixture-skip");
      for (const row of [await pass("paid", "fixture-error"), skipped]) {
        assert.equal((await use(mode, row)).status, 500);
      }
      t.faults.failReloadAfterZero = true;
      const failedRead = await use(mode, skipped);
      assert.equal(failedRead.status, 500);
      assert.ok(!failedRead.data.usedAt);
      console.log("PASS FP-02 " + mode + ": disappearance, tenant, state, permissions, windows, write/read errors and unexplained zero");
    }

    if (process.argv[3] && process.argv[4]) {
      await runBrowserCases();
    } else {
      console.log("Browser acceptance not run (supply Playwright module and browser executable)");
    }
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    t.restore();
    mock.restoreAll();
  }
}

withPostgres(process.argv[2], verify).catch(error => {
  const message = String(error?.stack || error).replace(/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}/gi, "[fixture-id]");
  console.error(message);
  process.exitCode = 1;
});
