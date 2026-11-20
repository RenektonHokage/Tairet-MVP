import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";

export async function withCatalogBrowser({ base, dir, playwrightModule, executablePath }, cycle) {
  assert.equal(new URL(base).hostname, "127.0.0.1");
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  const root = fileURLToPath(new URL("../", import.meta.url)), previousCwd = process.cwd();
  const envDir = path.join(dir, "empty-vite-env");
  mkdirSync(envDir);
  let vite, browser;
  try {
    process.chdir(root);
    vite = await createServer({
      root, envDir, mode: "test", cacheDir: path.join(dir, "vite-cache"), logLevel: "error",
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") },
      server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false, watch: null,
        proxy: { "/api": { target: base, rewrite: url => url.slice(4) } } },
    });
    await vite.listen();
    const origin = "http://127.0.0.1:" + vite.httpServer.address().port;
    browser = await chromium.launch({ executablePath, headless: true, args: ["--disable-background-networking",
      "--disable-component-update", "--disable-extensions", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/events/profile_view") return route.fulfill({ status: 204, body: "" });
      if (url.pathname === "/api/reviews") return route.fulfill({ json: { items: [] } });
      return route.continue();
    });

    let checkedPagination = false;
    await cycle(async ({ trialSlug, controlSlug, hidden }) => {
      const page = await context.newPage(); // Each phase makes fresh public requests.
      page.setDefaultTimeout(18000);
      const errors = [];
      page.on("pageerror", err => errors.push(err.name));
      try {
        for (const route of ["/discotecas", "/explorar?type=club", "/zona/asuncion"]) {
          await page.goto(origin + "/#" + route);
          const card = slug => page.locator('a[href="#/club/' + slug + '"]');
          await card(controlSlug).first().waitFor({ state: "attached" });
          assert.equal((await card(trialSlug).count()) > 0, !hidden, "Club card membership on " + route);
          if (route === "/discotecas") {
            const search = page.locator('input[aria-label="Buscar"]:visible').first();
            const suggestion = slug => page.getByRole("button", { name: new RegExp(slug + ".*Discoteca", "i") });
            await search.fill(controlSlug);
            await suggestion(controlSlug).first().waitFor(); // The navbar loaded its own public selection.
            await search.fill(trialSlug);
            await page.getByRole("button", { name: new RegExp("Ver todos los resultados.*" + trialSlug, "i") }).waitFor();
            assert.equal((await suggestion(trialSlug).count()) > 0, !hidden, "Club membership in navbar suggestions");
          }
        }
        await page.goto(origin + "/#/club/" + trialSlug);
        if (hidden) {
          await page.getByRole("heading", { name: "404", exact: true }).waitFor();
          assert.equal(new URL(page.url()).hash, "#/404");
        } else {
          await page.getByRole("heading", { name: "Ficha de laboratorio " + trialSlug, exact: true }).waitFor();
          await page.getByRole("button", { name: "Seleccionar", exact: true }).waitFor();
        }
        if (!checkedPagination) {
          // Exercise only the client's offset handling with controlled pages. The visibility cycle uses the API.
          const row = slug => ({ id: slug, slug, name: slug, type: "club", attributes: [] });
          const first = Array.from({ length: 100 }, (_, i) => row("page-fixture-" + i));
          const overlap = [first[99], row(controlSlug), row(trialSlug)];
          let repeatPage = false;
          await page.route("**/api/public/locals?*", request => {
            const params = new URL(request.request().url()).searchParams;
            if (params.get("type") !== "club") return request.fallback();
            return request.fulfill({ json: repeatPage || !Number(params.get("offset")) ? first : overlap });
          });
          await page.goto(origin + "/#/discotecas");
          await page.locator('a[href="#/club/' + trialSlug + '"]').first().waitFor();
          repeatPage = true;
          await page.reload();
          await page.getByText("No encontramos discotecas con esos filtros", { exact: true }).waitFor();
          assert.equal(await page.locator('a[href^="#/club/"]').count(), 0);
          checkedPagination = true;
          console.log("PASS browser pagination (HTTP fixtures): overlapping pages retain members; repeated full page stops");
        }
        assert.deepEqual(errors, []);
        console.log("PASS Chromium: listing, Explore, zone, navbar and direct profile (" + (hidden ? "hidden" : "visible") + ")");
      } finally {
        await page.close();
      }
    });
  } finally {
    process.chdir(previousCwd);
    try { await browser?.close(); } finally { await vite?.close(); }
  }
}
