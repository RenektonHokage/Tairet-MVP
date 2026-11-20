// Transport for the Supabase client in these tests. It is in-process and accepts one
// fixture origin only. PostgreSQL evaluates every predicate sent by the application;
// each PATCH uses a separate psql connection. There is no JS lock or unconditional used_at filter.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

const literal = value => value === null ? "NULL" :
  "'" + (typeof value === "object" ? JSON.stringify(value) : String(value)).replaceAll("'", "''") + "'";
function identifier(value) {
  assert.match(value, /^[a-z_]+$/);
  return '"' + value + '"';
}

function installTransport(sql, locals) {
  const origin = "http://127.0.0.1:1";
  process.env.SUPABASE_URL = origin;
  process.env.SUPABASE_SERVICE_ROLE = "free-pass-test-only";
  const users = new Map();
  const actors = {};
  for (const [role, local] of [["owner", locals.club], ["staff", locals.club], ["viewer", locals.club], ["other", locals.other]]) {
    const bearer = randomUUID();
    actors[role] = bearer;
    users.set(bearer, { id: randomUUID(), local_id: local, role: role === "other" ? "staff" : role });
  }
  const counters = { inserts: 0, activities: 0 };
  const faults = { failReloadAfterZero: false };
  let failNextRead = false;
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  const error = (code, status = 500) => json({ code, message: "Fixture database error" }, status);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input);
    assert.equal(url.origin, origin, "Test transport blocked a non-fixture origin");
    const headers = new Headers(init.headers);
    if (url.pathname === "/auth/v1/user") {
      const user = users.get(headers.get("authorization")?.slice(7));
      return user ? json({ id: user.id, email: "operator@example.invalid", aud: "authenticated" }) : error("unauthorized", 401);
    }
    const name = url.pathname.replace(/^\/rest\/v1\//, "");
    const body = init.body ? JSON.parse(init.body) : {};
    const method = init.method || "GET";
    const params = url.searchParams;
    let rows;
    if (name === "panel_users") {
      const user = [...users.values()].find(u => params.get("auth_user_id") === "eq." + u.id);
      rows = user ? [{ ...user, auth_user_id: user.id, email: "operator@example.invalid" }] : [];
    } else if (["local_daily_ops", "promos", "access_ticket_types"].includes(name) && method === "GET") {
      rows = []; // No schedule overrides, promotions or Access Core tickets in this fixture.
    } else if (name === "rpc/get_night_window") {
      rows = JSON.parse(await sql("SELECT json_agg(w) FROM get_night_window(" + literal(body.intended_date) + ") w;"));
    } else {
      assert.ok(["locals", "ticket_types", "table_types", "orders", "operational_activity_events"].includes(name));
      if (name === "orders" && method === "GET" && failNextRead) {
        failNextRead = false;
        return error("08006", 503);
      }
      const filters = [];
      for (const [column, term] of params) {
        if (column === "select" || column === "order" || column === "limit" || column === "offset") continue;
        if (column === "or") {
          assert.equal(term, "(type.eq.club,and(type.eq.bar,is_published.eq.true))");
          filters.push("(type = 'club' OR (type = 'bar' AND is_published = true))");
        } else if (term.startsWith("eq.")) {
          filters.push(identifier(column) + " = " + literal(term.slice(3)));
        } else if (term === "is.null") {
          filters.push(identifier(column) + " IS NULL");
        } else if (term.startsWith("in.(") && term.endsWith(")")) {
          filters.push(identifier(column) + " IN (" + term.slice(4, -1).split(",").map(literal).join(",") + ")");
        } else {
          assert.fail("Unsupported filter in fixture: " + column);
        }
      }
      const projection = (params.get("select") || "id").split(",").map(k => identifier(k.trim())).join(",");
      const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
      const table = identifier(name);
      let query;
      if (method === "GET") {
        query = "SELECT " + projection + " FROM " + table + where;
        if (params.has("order")) {
          const terms = params.get("order").split(",").map(term => {
            const parts = /^([a-z_]+)\.(asc|desc)(?:\.(nullsfirst|nullslast))?$/.exec(term);
            assert.ok(parts, "Unsupported fixture ordering");
            return identifier(parts[1]) + " " + parts[2] +
              (parts[3] ? (parts[3] === "nullsfirst" ? " NULLS FIRST" : " NULLS LAST") : "");
          });
          query += " ORDER BY " + terms.join(",");
        }
        for (const key of ["limit", "offset"]) {
          if (!params.has(key)) continue;
          const amount = params.get(key);
          assert.match(amount, /^\d+$/);
          query += " " + key + " " + amount;
        }
      } else if (method === "PATCH" && name === "orders") {
        assert.deepEqual(Object.keys(body), ["used_at"]);
        query = "UPDATE orders SET used_at=" + literal(body.used_at) + where + " RETURNING " + projection;
      } else {
        assert.equal(method, "POST");
        assert.ok(name === "orders" || name === "operational_activity_events");
        counters[name === "orders" ? "inserts" : "activities"]++;
        const keys = Object.keys(body);
        query = "INSERT INTO " + table + " (" + keys.map(identifier).join(",") + ") VALUES (" +
          keys.map(k => literal(body[k])).join(",") + ") RETURNING " + projection;
      }
      try {
        rows = JSON.parse(await sql("WITH r AS (" + query + ") SELECT coalesce(json_agg(r),'[]') FROM r;",
          method === "PATCH" ? "freepass-consume" : "freepass-data"));
      } catch {
        return error("XX000");
      }
      if (method === "PATCH" && rows.length === 0 && faults.failReloadAfterZero) {
        faults.failReloadAfterZero = false;
        failNextRead = true;
      }
    }
    if (headers.get("accept")?.includes("vnd.pgrst.object")) {
      if (rows.length !== 1) return json({ code: "PGRST116", message: "Row not found", details: "The result contains 0 rows" }, 406);
      return json(rows[0]);
    }
    return json(rows);
  };
  return { actors, counters, faults, fetch: originalFetch, restore: () => { globalThis.fetch = originalFetch; } };
}
module.exports = { installTransport, literal };
