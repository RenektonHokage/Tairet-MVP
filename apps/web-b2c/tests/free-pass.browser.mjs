import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";
import { createServer } from "vite";

// Called by the acceptance runner against its own Express server and PostgreSQL fixture.
export async function verifyBrowser({ api, dir, playwrightModule, executablePath }) {
  assert.equal(new URL(api).hostname, "127.0.0.1");
  const { chromium } = await import(pathToFileURL(playwrightModule).href);
  const root = fileURLToPath(new URL("../", import.meta.url));
  const previousCwd = process.cwd();
  const envDir = path.join(dir, "empty-vite-env");
  mkdirSync(envDir);
  let vite, browser;
  try {
    process.chdir(root); // Tailwind resolves its config relative to the package, as in the B2C dev script.
    vite = await createServer({
      root, envDir, mode: "test", cacheDir: path.join(dir, "vite-cache"), logLevel: "error",
      define: { "import.meta.env.VITE_API_URL": JSON.stringify("/api") },
      server: { host: "127.0.0.1", port: 0, strictPort: true, hmr: false, watch: null,
        proxy: { "/api": { target: api, rewrite: url => url.slice(4) } } },
    });
    await vite.listen();
    const origin = "http://127.0.0.1:" + vite.httpServer.address().port;
    browser = await chromium.launch({ executablePath, headless: true, args: ["--disable-background-networking",
      "--disable-component-update", "--disable-extensions", "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 },
      timezoneId: "America/Asuncion", serviceWorkers: "block" });
    await context.route("**/*", route => new URL(route.request().url()).origin === origin ?
      route.continue() : route.abort());
    // Verify the Copy action without writing a fixture credential to the host clipboard.
    await context.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async text => { window.fixtureCopy = text; } },
    }));
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const pageErrors = [], consoleErrors = [];
    page.on("pageerror", err => pageErrors.push(err.name));
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    const clubPage = origin + "/#/club/fixture-discoteca";
    await page.goto(clubPage);
    await page.getByRole("heading", { name: "Discoteca de prueba", exact: true }).waitFor();
    assert.equal(page.url(), clubPage);
    assert.ok((await page.title()).trim().length > 0);
    await page.getByText("+21", { exact: true }).waitFor();
    await page.getByText("Jazz", { exact: true }).waitFor();
    await page.getByText("Fotos no disponibles por el momento", { exact: true }).waitFor();
    await page.getByText("Contacto no disponible", { exact: true }).waitFor();
    assert.ok(await page.getByRole("button", { name: "Llamar", exact: true }).isDisabled());
    assert.equal(await page.locator("vite-error-overlay").count(), 0);
    await page.screenshot({ path: path.join(dir, "club-desktop.png") });
    await page.getByRole("button", { name: "Seleccionar", exact: true }).click();
    await page.getByRole("button", { name: "Proceder al pago" }).click();
    for (const [field, value] of Object.entries({ firstName: "Test", lastName: "Fixture",
      email: "browser@example.invalid", phone: "0000000000", cedula: "0000000" })) {
      await page.locator("#" + field).fill(value);
    }
    await page.getByRole("checkbox").check();
    const response = page.waitForResponse(r => r.url() === origin + "/api/orders" && r.request().method() === "POST");
    await page.getByRole("button", { name: /^Pagar / }).click();
    const creation = await response;
    assert.equal(creation.status(), 201);
    const receipt = await creation.json();
    assert.equal(receipt.quantity, 1);
    const title = page.getByRole("heading", { name: "Tu Free Pass está listo" });
    await title.waitFor();
    const confirmation = title.locator("..");
    await confirmation.getByText("Guardá este QR o código para ingresar.", { exact: true }).waitFor();
    assert.ok(await confirmation.locator("svg[width='200']").isVisible());
    assert.ok(await confirmation.locator("code").textContent() === receipt.checkin_token, "Code matches the issued credential");
    assert.doesNotMatch(await confirmation.innerText(), /correo|e-?mail|enviamos|entregad/i);
    await confirmation.locator("code + button").click();
    assert.ok(await page.evaluate(() => window.fixtureCopy) === receipt.checkin_token, "Copy uses the issued credential");
    assert.ok(await confirmation.getByRole("link", { name: "Volver al inicio" }).isVisible());
    await confirmation.getByRole("button", { name: "Cerrar" }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.route("**/fixture-discoteca/access-catalog", route => route.fulfill({
      status: 200, contentType: "application/json", body: "{",
    }));
    await page.reload();
    await page.getByRole("button", { name: "Seleccionar", exact: true }).waitFor();
    await page.getByRole("heading", { name: "Discoteca de prueba" }).waitFor();
    await page.screenshot({ path: path.join(dir, "club-mobile.png") });
    assert.equal(consoleErrors.length, 0, "Valid club and checkout must render without console errors");
    for (const slug of ["fixture-inexistente", "fixture-incompatible"]) {
      await page.goto(origin + "/#/club/" + slug);
      await page.getByRole("heading", { name: "404", exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, "#/404");
      assert.equal(await page.getByRole("button", { name: "Seleccionar", exact: true }).count(), 0);
    }
    assert.deepEqual(pageErrors, []);
    console.log("PASS FP-04/05: real club profile, independent catalogs, two 404s, Free Pass checkout, QR and Copy in Chromium");
  } finally {
    process.chdir(previousCwd);
    try { await browser?.close(); } finally { await vite?.close(); }
  }
}
