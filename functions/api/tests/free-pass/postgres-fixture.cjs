// Own a fresh PostgreSQL cluster for this run. No DSN or existing database is accepted.
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { once } = require("node:events");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

async function freePort() {
  const probe = net.createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

async function until(check, label) {
  const deadline = Date.now() + 12000;
  do {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 35));
  } while (Date.now() < deadline);
  throw Error("Timed out: " + label);
}

async function withPostgres(bin, run) {
  assert.ok(bin && path.isAbsolute(bin), "Supply the directory containing the local PostgreSQL binaries");
  const program = name => path.join(bin, name + (process.platform === "win32" ? ".exe" : ""));
  const tempRoot = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(tempRoot, "tairet-free-pass-"));
  const data = path.join(dir, "db");
  const passwordFile = path.join(dir, "init-password");
  const env = {};
  for (const name of ["SystemRoot", "WINDIR", "PATH", "PATHEXT", "TMP", "TEMP", "LANG", "LD_LIBRARY_PATH"]) {
    if (process.env[name]) env[name] = process.env[name];
  }
  Object.assign(env, { PGHOST: "127.0.0.1", PGPORT: String(await freePort()), PGDATABASE: "postgres",
    PGUSER: "free_pass_fixture", PGPASSWORD: randomBytes(24).toString("hex"), PGCLIENTENCODING: "UTF8",
    PGCONNECT_TIMEOUT: "4", PGOPTIONS: "-c statement_timeout=20000", LC_MESSAGES: "C" });
  const exec = (name, args) => execFileSync(program(name), args,
    { env, encoding: "utf8", windowsHide: true, stdio: "ignore", timeout: 40000 });
  const psqlArgs = ["-X", "-qAtw", "-v", "ON_ERROR_STOP=1"];
  function session(application = "freepass-test") {
    const child = spawn(program("psql"), psqlArgs, { env: { ...env, PGAPPNAME: application },
      windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
    child.stderr.resume(); // A database diagnostic can contain the row or credential used by a fixture.
    const done = once(child, "close").then(([status]) => {
      assert.equal(status, 0, "psql failed in " + application);
      return output.trim();
    });
    return { child, done };
  }
  function sql(statement, application) {
    const { child, done } = session(application);
    child.stdin.end(statement + "\n");
    return done;
  }
  // Hold a row lock until PostgreSQL itself reports the UPDATE sessions waiting for it.
  async function holdOrder(id) {
    assert.match(id, /^[0-9a-f-]{36}$/);
    const { child, done } = session("freepass-row-lock");
    const ready = new Promise((resolve, reject) => {
      let output = "";
      child.stdout.on("data", chunk => {
        output += chunk;
        if (output.includes("LOCKED")) resolve();
      });
      done.then(() => reject(Error("Lock session closed before acquiring its row")), reject);
    });
    child.stdin.write("BEGIN;\nSELECT 'LOCKED' FROM orders WHERE id='" + id + "' FOR UPDATE;\n");
    await Promise.race([ready, new Promise((_, reject) => {
      const timer = setTimeout(() => reject(Error("Row lock timeout")), 12000);
      timer.unref();
    })]).catch(error => { child.stdin.end("ROLLBACK;\n"); throw error; });
    return {
      waitForWriters: n => until(async () => Number(await sql(
        "SELECT count(distinct pid) FROM pg_stat_activity WHERE application_name='freepass-consume' " +
        "AND state='active' AND wait_event_type='Lock'")) === n, n + " actual PostgreSQL writers"),
      release(change = "") { child.stdin.end(change + "\nCOMMIT;\n"); return done; },
    };
  }

  let started = false;
  try {
    fs.writeFileSync(passwordFile, env.PGPASSWORD + "\n", { mode: 0o600 });
    exec("initdb", ["-D", data, "-U", env.PGUSER, "-A", "scram-sha-256", "--pwfile", passwordFile,
      "--no-locale", "--encoding=UTF8", "--no-sync"]);
    fs.unlinkSync(passwordFile);
    exec("pg_ctl", ["-D", data, "-w", "-t", "25", "-l", path.join(dir, "pg.log"), "-o",
      "-h 127.0.0.1 -p " + env.PGPORT + " -c logging_collector=off -c log_statement=none", "start"]);
    started = true;
    assert.equal(fs.realpathSync(await sql("SHOW data_directory;")), fs.realpathSync(data));
    console.log("PostgreSQL " + await sql("SHOW server_version;") + " / disposable loopback cluster");
    await run({ sql, holdOrder, dir });
  } finally {
    if (started || fs.existsSync(path.join(data, "postmaster.pid"))) {
      exec("pg_ctl", ["-D", data, "-m", "fast", "-w", "-t", "25", "stop"]);
    }
    const target = fs.realpathSync(dir);
    assert.equal(path.dirname(target), tempRoot);
    assert.ok(path.basename(target).startsWith("tairet-free-pass-"));
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 4, retryDelay: 150 });
  }
}
module.exports = { withPostgres, until };
