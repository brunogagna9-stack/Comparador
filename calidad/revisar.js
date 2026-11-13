/* KyraNoHard · control de calidad automático (actualización 39).
   Revisa el sitio con herramientas de código abierto y falla si algo empeora:
     1. html-validate  → HTML válido
     2. ESLint         → errores reales en el JavaScript
     3. axe-core       → accesibilidad (WCAG 2.2 AA) en todas las páginas, modo claro y oscuro, computadora y celular
     4. Lighthouse     → accesibilidad, buenas prácticas y SEO (con mínimos); velocidad se informa
   Uso: cd calidad && npm ci && npx playwright install chromium && node revisar.js */
"use strict";
const fs = require("fs"), path = require("path"), http = require("http"), { execFileSync } = require("child_process");
const SITE = path.resolve(__dirname, "..", "site");
const PAGES = ["", "productos.html?cat=placas-de-video", "productos.html", "producto.html?id=PRIMER", "armar.html", "armado.html",
  "encontra.html", "comparar.html", "actualizar.html", "tiendas.html", "cuenta.html", "contacto.html", "preguntas.html",
  "historial.html", "privacidad.html", "terminos.html"];
const LH_PAGES = ["", "productos.html?cat=placas-de-video", "producto.html?id=PRIMER", "armado.html"];
const LH_MIN = { accessibility: 95, "best-practices": 90, seo: 90 };
const out = [], fail = [];
const log = s => { console.log(s); out.push(s); };

// servidor local del sitio (como GitHub Pages, sin dependencias)
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2", ".xml": "application/xml",
  ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
      const f = path.join(SITE, p);
      if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end("no"); }
      rsp.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(rsp);
    }).listen(0, "127.0.0.1", () => res(srv));
  });
}

function htmlValidate() {
  const bin = path.join(__dirname, "node_modules", ".bin", "html-validate");
  const files = fs.readdirSync(SITE).filter(f => f.endsWith(".html")).map(f => path.join(SITE, f));
  let txt = "[]";
  try { txt = execFileSync(bin, ["-c", path.join(__dirname, ".htmlvalidate.json"), "-f", "json", ...files], { encoding: "utf8", maxBuffer: 64e6 }); }
  catch (e) { txt = e.stdout || "[]"; }
  const msgs = JSON.parse(txt || "[]").flatMap(f => f.messages.filter(m => m.severity === 2).map(m => `${path.basename(f.filePath)}:${m.line} ${m.ruleId} ${m.message}`));
  log(`- **html-validate:** ${msgs.length ? msgs.length + " errores" : "sin errores"} en ${files.length} páginas`);
  msgs.slice(0, 15).forEach(m => log("  - " + m)); if (msgs.length) fail.push("HTML");
}

function eslint() {
  const bin = path.join(__dirname, "node_modules", ".bin", "eslint");
  let txt = "[]";
  try { txt = execFileSync(bin, ["-c", path.join(__dirname, "eslint.config.mjs"), "-f", "json", path.join(SITE, "js"), path.resolve(__dirname, "..", "worker")], { encoding: "utf8", maxBuffer: 64e6, cwd: path.resolve(__dirname, "..") }); }
  catch (e) { txt = e.stdout || "[]"; }
  const msgs = JSON.parse(txt || "[]").flatMap(f => f.messages.filter(m => m.severity === 2).map(m => `${path.basename(f.filePath)}:${m.line} ${m.ruleId || "sintaxis"} ${m.message}`));
  const files = JSON.parse(txt || "[]").length;
  log(`- **ESLint:** ${msgs.length ? msgs.length + " errores" : "sin errores"} en ${files} archivos`); if (!files) fail.push("ESLint no revisó ningún archivo");
  msgs.slice(0, 15).forEach(m => log("  - " + m)); if (msgs.length) fail.push("JavaScript");
}

async function axe(base, chromium) {
  const { AxeBuilder } = require("@axe-core/playwright");
  const br = await chromium.launch(); let n = 0; const seen = {};
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    for (const gpu of [false, true]) {
      if (gpu && vp.width < 1000) continue;
      const ctx = await br.newContext({ viewport: vp, serviceWorkers: "block" });
      // con «gpu» se simula una placa de video para revisar también la portada con la animación 3D
      if (gpu) await ctx.addInitScript(() => { for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) { const g = C.prototype.getParameter;
        C.prototype.getParameter = function (x) { return x === 0x9246 || x === 0x1F01 ? "ANGLE (GPU de prueba)" : g.call(this, x); }; } });
      for (const p of gpu ? [""] : PAGES) {
        const pg = await ctx.newPage(); await pg.goto(base + p, { waitUntil: "networkidle" }); await pg.waitForTimeout(gpu ? 3000 : 1200);
        for (const sch of ["light", "dark"]) {
          await pg.emulateMedia({ colorScheme: sch });
          const r = await new AxeBuilder({ page: pg }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
          for (const v of r.violations) { n += v.nodes.length; const k = `${v.id} (${p || "inicio"}${gpu ? ", con 3D" : ""})`; seen[k] = (seen[k] || 0) + v.nodes.length; }
        }
        await pg.close();
      }
      await ctx.close();
    }
  }
  await br.close();
  log(`- **axe-core (accesibilidad WCAG 2.2 AA):** ${n ? n + " fallas" : "sin fallas"} — ${PAGES.length} páginas, claro y oscuro, computadora y celular`);
  Object.entries(seen).slice(0, 15).forEach(([k, v]) => log(`  - ${k}: ${v}`)); if (n) fail.push("accesibilidad");
}

async function lighthouse(base, chromePath) {
  const { default: lh } = await import("lighthouse"); const chromeLauncher = await import("chrome-launcher");
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless=new", "--no-sandbox"] });
  log("\n| Página (celular) | Velocidad | Accesibilidad | Buenas prácticas | SEO |\n|---|---|---|---|---|");
  for (const p of LH_PAGES) {
    const r = await lh(base + p, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: ["performance", "accessibility", "best-practices", "seo"] });
    const c = r.lhr.categories, s = k => Math.round((c[k].score || 0) * 100);
    log(`| ${p.split("?")[0] || "inicio"} | ${s("performance")} | ${s("accessibility")} | ${s("best-practices")} | ${s("seo")} |`);
    for (const [k, min] of Object.entries(LH_MIN)) if (s(k) < min) fail.push(`Lighthouse ${k} ${s(k)} < ${min} en ${p || "inicio"}`);
  }
  log("\n_La velocidad medida en un servidor de pruebas varía de una corrida a otra: se informa pero no hace fallar la revisión._");
  await chrome.kill();
}

(async () => {
  const srv = await serve(), base = `http://127.0.0.1:${srv.address().port}/`;
  // una ficha real para revisar producto.html
  try { const P = JSON.parse(fs.readFileSync(path.join(SITE, "data", "products.json"), "utf8")); const g = P.find(x => x.offers && x.offers.length > 2) || P[0];
    if (g) { const id = encodeURIComponent(g.id); for (const L of [PAGES, LH_PAGES]) L.forEach((p, i) => { L[i] = p.replace("PRIMER", id); }); } } catch (e) { /* sin datos */ }
  log("## Control de calidad de KyraNoHard\n");
  htmlValidate(); eslint();
  const { chromium } = require("playwright");
  await axe(base, chromium);
  try { await lighthouse(base, process.env.CHROME_PATH || chromium.executablePath()); }
  catch (e) { log("- Lighthouse no pudo correr: " + e.message); fail.push("Lighthouse no corrió"); }
  srv.close();
  log(fail.length ? `\n**❌ Falló:** ${fail.join(" · ")}` : "\n**✅ Todo en orden.**");
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join("\n") + "\n");
  process.exit(fail.length ? 1 : 0);
})();
