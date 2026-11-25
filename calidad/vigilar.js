/* Actualización 45 (idea tomada de SuperBarato): vigilancia diaria de la web PUBLICADA.
   Abre las páginas principales como lo haría una persona (en computadora y en celular) y revisa:
   - que no haya errores de programación en la página;
   - pedidos que fallan (por ejemplo fotos que una tienda dejó de servir), agrupados por sitio;
   - que los precios se hayan actualizado en las últimas 14 horas;
   - tiendas que no responden hace 2 días o más.
   Escribe un resumen en Markdown (salida estándar) y deja «problemas.txt» si encontró algo, para que el proceso de
   GitHub abra o actualice un aviso. Solo lee la web: no cambia nada.
   Uso: node vigilar.js [dirección de la web]   */
const fs = require("fs");
const { chromium, devices } = require("playwright");
const BASE = (process.argv[2] || "https://kyranohard.com.ar/").replace(/\/?$/, "/");
const PAGES = ["index.html", "productos.html", "productos.html?cat=placas-de-video", "comparar.html", "armado.html", "armar.html",
  "actualizar.html", "encontra.html", "tiendas.html", "preguntas.html", "contacto.html"];
const MAX_HORAS = 14, MAX_DIAS_TIENDA = 2;

async function getJson(url) {
  const r = await fetch(url + (url.includes("?") ? "&" : "?") + "v=" + Date.now());
  if (!r.ok) throw new Error(url + " -> HTTP " + r.status);
  return r.json();
}

(async () => {
  const problems = [], notes = [];
  // 1) datos
  let meta = null;
  try { meta = await getJson(BASE + "data/meta.json"); } catch (e) { problems.push("No se pudo leer data/meta.json: " + e.message); }
  if (meta) {
    const h = (Date.now() - Date.parse(meta.updated)) / 36e5;
    if (!(h <= MAX_HORAS)) problems.push(`Los precios no se actualizan hace ${Math.round(h)} horas (última: ${meta.updated}).`);
    else notes.push(`Precios actualizados hace ${h < 1 ? "menos de 1" : Math.round(h)} h · ${meta.groups} productos.`);
    for (const [s, st] of Object.entries(meta.stores || {})) {
      if (st.ok || st.hidden) continue;
      const d = st.last_ok ? (Date.now() - Date.parse(st.last_ok)) / 864e5 : null;
      if (d == null) { if (st.count) problems.push(`${s}: no responde y no sabemos desde cuándo (${(st.error || "").slice(0, 120)}).`); continue; }
      if (d >= MAX_DIAS_TIENDA) problems.push(`${s}: no responde hace ${Math.floor(d)} días${st.oculta_por_antiguedad ? " (ya no se muestran sus precios)" : ""}. Error: ${(st.error || "").slice(0, 120)}`);
    }
  }
  // 2) páginas
  const browser = await chromium.launch();
  const fails = {};
  for (const [dev, opts] of [["computadora", { viewport: { width: 1366, height: 900 } }], ["celular", { ...devices["Pixel 7"] }]]) {
    for (const u of PAGES) {
      const ctx = await browser.newContext(opts), page = await ctx.newPage(), errs = [];
      page.on("pageerror", e => errs.push(e.message.slice(0, 160)));
      page.on("requestfailed", q => { let h = "?"; try { h = new URL(q.url()).hostname; } catch (e) { } (fails[h] = fails[h] || new Set()).add(q.url()); });
      page.on("response", r => { if (r.status() >= 400) { let h = "?"; try { h = new URL(r.url()).hostname; } catch (e) { } (fails[h] = fails[h] || new Set()).add(r.url()); } });
      try {
        await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 60000 });
        await page.waitForTimeout(1500);
        const len = await page.evaluate(() => (document.querySelector("main") || document.body).innerText.trim().length);
        if (len < 200) problems.push(`${u} (${dev}): la página quedó casi vacía.`);
      } catch (e) { problems.push(`${u} (${dev}): no cargó (${e.message.slice(0, 100)}).`); }
      errs.forEach(m => problems.push(`${u} (${dev}): error en la página: ${m}`));
      await ctx.close();
    }
  }
  await browser.close();
  const own = new URL(BASE).hostname;
  for (const [h, set] of Object.entries(fails)) {
    if (h === own) problems.push(`Archivos de la propia web que fallan: ${[...set].slice(0, 5).join(", ")}`);
    else if (set.size >= 3) problems.push(`${h}: ${set.size} pedidos fallidos (fotos u otros archivos de esa tienda). Ejemplo: ${[...set][0]}`);
    else notes.push(`${h}: ${set.size} pedido fallido (aislado).`);
  }
  const out = ["## Vigilancia diaria de KyraNoHard", "", ...notes.map(n => "- " + n), "",
    problems.length ? "### ⚠ Para revisar\n\n" + problems.map(p => "- " + p).join("\n") : "**✅ Todo en orden.**", ""].join("\n");
  console.log(out);
  if (problems.length) fs.writeFileSync("problemas.txt", out);
})().catch(e => { console.log("La vigilancia no pudo terminar: " + e.message); fs.writeFileSync("problemas.txt", "La vigilancia no pudo terminar: " + e.message); });
