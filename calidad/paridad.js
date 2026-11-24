/* KyraNoHard · prueba de paridad celular / computadora (actualización 46).
   Hace las MISMAS acciones de una persona en 7 tamaños de pantalla (de 360×800 a 2560×1440) y falla si alguna no se
   puede hacer en alguno: armar una PC desde el inicio, cambiar sus piezas en «Armalo vos», comparar productos,
   ver los precios por tienda de una ficha, filtrar el catálogo y usar «Mi lista».
   También falla si la página se sale de la pantalla (desplazamiento horizontal) o si hay errores de programación.
   Uso: cd calidad && node paridad.js   (sirve la carpeta site/ en un puerto local) */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("playwright");
const SITE = path.resolve(__dirname, "..", "site");
const SIZES = [[360, 800, true], [390, 844, true], [430, 932, true], [768, 1024, true], [1366, 768, false], [1920, 1080, false], [2560, 1440, false]];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const serve = () => new Promise(res => {
  const srv = http.createServer((req, rsp) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
    const f = path.join(SITE, p);
    if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end("no"); }
    rsp.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(rsp);
  }).listen(0, "127.0.0.1", () => res(srv));
});

(async () => {
  const P = JSON.parse(fs.readFileSync(path.join(SITE, "data/products.json"), "utf8"));
  const gpus = P.filter(g => g.category === "placas-de-video" && g.offers.filter(o => o.stock !== false).length >= 2).slice(0, 3).map(g => g.id);
  // BASE=https://… → prueba la web PUBLICADA en vez de la carpeta local (act. 47)
  const srv = process.env.BASE ? null : await serve(), B = process.env.BASE ? process.env.BASE.replace(/\/?$/, "/") : `http://127.0.0.1:${srv.address().port}/`;
  const browser = await chromium.launch();
  const fails = [], rows = [];
  for (const [w, h, touch] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch && w < 600, reducedMotion: "reduce", serviceWorkers: "block" });
    const page = await ctx.newPage(), errs = [];
    page.on("pageerror", e => errs.push(e.message.slice(0, 140)));
    const res = {};
    const step = async (name, fn) => {
      try { await fn(); res[name] = "✓"; }
      catch (e) { res[name] = "✗"; fails.push(`${w}×${h} · ${name}: ${String(e.message || e).split("\n")[0].slice(0, 160)}`); }
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth).catch(() => 0);
      if (ov > 1) fails.push(`${w}×${h} · ${name}: la página se sale ${ov} px de la pantalla`);
    };
    const tap = async sel => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); };
    const visible = async (sel, what) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if (!(await l.isVisible())) throw new Error(what + " no se ve"); };

    await step("Armar una PC desde el inicio", async () => {
      await page.goto(B + "index.html", { waitUntil: "networkidle" });
      await tap('input[name=uso][value=gaming_pesado]'); await tap('input[name=res][value="1440"]');
      await page.fill("#qpc-b", "3500000");
      await Promise.all([page.waitForURL(/encontra\.html/), tap("#qpcf button[type=submit]")]);
      await page.waitForSelector(".bt-act", { timeout: 20000 });
      await visible(".bt-act a", "«Cambiar piezas en Armalo vos»");
    });
    await step("Cambiar piezas en Armalo vos", async () => {
      const href = await page.locator(".bt-act a").first().getAttribute("href");
      await page.goto(B + href, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.querySelectorAll("#slots .sl").length >= 6, null, { timeout: 20000 });
      await visible("#slots .sl button, #slots .sl a", "botón para cambiar una pieza");
    });
    await step("Comparar productos", async () => {
      await page.goto(B + "comparar.html#cat=placas-de-video&ids=" + gpus.join(","), { waitUntil: "networkidle" });
      await page.waitForSelector(".ct", { state: "attached", timeout: 20000 });
      const vis = await page.evaluate(() => [".tw", ".ctm"].some(s => { const e = document.querySelector(s); return e && e.offsetParent !== null && e.getBoundingClientRect().width <= innerWidth; }));
      if (!vis) throw new Error("ni la tabla ni las tarjetas entran en la pantalla");
      await tap("#diff");
    });
    await step("Ver precios por tienda de un producto", async () => {
      await page.goto(B + "producto.html?id=" + encodeURIComponent(gpus[0]), { waitUntil: "networkidle" });
      await page.waitForSelector(".offt", { timeout: 20000 });
      await visible('.offt a[href^="http"]', "«Ir a la tienda»");
      const wide = await page.evaluate(() => { const t = document.querySelector(".offt table"); return t && t.getBoundingClientRect().width > innerWidth + 1; });
      if (wide) throw new Error("la tabla de precios es más ancha que la pantalla");
    });
    await step("Filtrar el catálogo", async () => {
      await page.goto(B + "productos.html?cat=placas-de-video", { waitUntil: "networkidle" });
      await page.waitForSelector("#grid .card", { timeout: 30000 });
      if (await page.locator("#fbtn").isVisible()) await tap("#fbtn");
      await tap("#stock"); await page.waitForTimeout(600);
      if (await page.locator("#fdone").isVisible()) await tap("#fdone");
      await visible("#grid .card", "resultados");
    });
    await step("Usar Mi lista", async () => {
      const add = page.locator('#grid [data-l], #grid button[aria-label*="lista" i]').first();
      await add.scrollIntoViewIfNeeded(); await add.click();
      await page.goto(B + "productos.html?lista=1", { waitUntil: "networkidle" });
      await page.waitForSelector("#box .li", { timeout: 30000 });
      await visible("#lwa", "«Compartir por WhatsApp»");
    });
    if (errs.length) fails.push(`${w}×${h}: errores en la página: ${[...new Set(errs)].join(" | ")}`);
    rows.push([`${w}×${h}`, res]);
    await ctx.close();
  }
  await browser.close(); if (srv) srv.close();
  const names = Object.keys(rows[0][1]);
  console.log("## Paridad celular / computadora\n\n| Pantalla | " + names.join(" | ") + " |\n|---|" + names.map(() => "---").join("|") + "|");
  rows.forEach(([s, r]) => console.log(`| ${s} | ` + names.map(n => r[n] || "—").join(" | ") + " |"));
  if (fails.length) { console.log("\n### ✗ Problemas\n\n" + fails.map(f => "- " + f).join("\n")); process.exit(1); }
  console.log("\n**✅ Todas las acciones se pueden hacer en todos los tamaños.**");
})().catch(e => { console.error(e); process.exit(1); });
