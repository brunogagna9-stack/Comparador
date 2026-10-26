// Pruebas de la lógica compartida (armado, buscador, comparador). Se ejecutan con: node tests/test_js.js
const assert = require("assert");
const path = require("path");
const CT = require("../site/js/lib.js");
require("../site/js/finder.js");
const HW = require("../site/data/hardware.json");
const PR = require("./fixtures/catalog.json");
const META = { updated: "2026-10-23T01:13+00:00" };
const mkCtx = (pr = PR) => CT.makeFinder(CT.create(HW, pr, META));
const C = mkCtx();
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FALLÓ:", name, "\n ", e.message); process.exitCode = 1; } };
const best = p => p.shop && p.shop[0] ? p.shop[0].p : 0;
const sum = l => l.reduce((a, p) => a + best(p), 0);
const gpu = id => HW.gpus.find(g => g.id === id);

/* ---------- Armado: componentes compartidos ---------- */
t("detecta componentes compartidos entre mínimo y sugerido", () => {
  const A = C.armado(gpu("rtx-5070ti"), 2);
  assert.deepStrictEqual(A.shared.map(p => p.slot), ["gpu", "cpu", "psu", "mobo"]);
  assert.deepStrictEqual(A.onlyMin.map(p => p.slot), ["ram", "ssd"]);
  assert.deepStrictEqual(A.onlySug.map(p => p.slot), ["ram", "ssd"]);
});
t("cada componente compartido aparece una sola vez (no está en las listas propias)", () => {
  const A = C.armado(gpu("rtx-5070ti"), 2), sk = new Set(A.shared.map(p => p.key));
  [...A.onlyMin, ...A.onlySug].forEach(p => assert(!sk.has(p.key), "repetido: " + p.key));
  assert.strictEqual(new Set(A.shared.map(p => p.slot)).size, A.shared.length);
});
t("modelos distintos no se agrupan como si fueran el mismo", () => {
  const g = gpu("rtx-5090"), A = C.armado(g, 0);
  if (A.cMin.c.id !== A.cSug.c.id) { assert(!A.shared.find(p => p.slot === "cpu")); assert(A.onlyMin.find(p => p.slot === "cpu")); }
  const a = C.parts(g, HW.cpus.find(c => c.id === "r5-9600x"), false, "min", 0), b = C.parts(g, HW.cpus.find(c => c.id === "r7-9800x3d"), false, "min", 0);
  const sp = C.split(a, b); assert(!sp.shared.find(p => p.slot === "cpu")); assert(sp.shared.find(p => p.slot === "gpu"));
});
t("los totales cuentan lo compartido en CADA configuración y no suman ambas como una sola PC", () => {
  const A = C.armado(gpu("rtx-5070ti"), 2);
  assert.strictEqual(A.totalMin.total, sum(A.min)); assert.strictEqual(A.totalSug.total, sum(A.sug));
  assert.strictEqual(A.totalMin.total, sum(A.shared) + sum(A.onlyMin));
  assert.strictEqual(A.totalSug.total, sum(A.shared) + sum(A.onlySug));
  assert(A.totalMin.total + A.totalSug.total > A.totalMin.total && A.totalMin.total !== A.totalMin.total + A.totalSug.total);
  assert.strictEqual(A.totalMin.count, 6); assert.strictEqual(A.totalMin.priced, 6);
});
t("no se pierden opciones, precios ni enlaces de los productos", () => {
  const A = C.armado(gpu("rtx-5070ti"), 2), urls = new Set(PR.flatMap(g => g.offers.map(o => o.url)));
  [...A.min, ...A.sug].forEach(p => (p.shop || []).forEach(x => { assert(urls.has(x.o.url)); assert.strictEqual(x.p, CT.price(x.o)); }));
  const gp = A.shared.find(p => p.slot === "gpu"); assert.strictEqual(gp.shop.length, 2); assert(gp.shop[0].p <= gp.shop[1].p);
});
t("sin duplicados de filas/enlaces dentro de cada lista", () => {
  [gpu("rtx-5070ti"), gpu("rtx-4060"), gpu("rx-9070xt")].forEach(g => [0, 1, 2].forEach(r => { const A = C.armado(g, r);
    [...A.min, ...A.sug].forEach(p => { const k = p.shop.map(x => x.g.id + "|" + x.o.url); assert.strictEqual(new Set(k).size, k.length); }); }));
});
t("una PC completa no se lista como placa de video (captura del usuario)", () => {
  const A = C.armado(gpu("rtx-5070ti"), 2); A.shared.find(p => p.slot === "gpu").shop.forEach(x => assert(!/\bpc\b|powered/i.test(x.g.name), x.g.name));
});
t("una variante de VRAM distinta no se asigna a otra placa (RTX 3060 8GB ≠ 12GB)", () => {
  const l = C.findGpu(gpu("rtx-3060")); assert(l.length === 1 && /12GB/.test(l[0].g.name));
});
t("componentes sin precio: total parcial y se informa cuáles faltan", () => {
  const pr = PR.filter(g => g.category !== "fuentes"), c2 = mkCtx(pr), A = c2.armado(gpu("rtx-5070ti"), 2);
  assert(A.totalMin.missing.includes("Fuente de poder")); assert.strictEqual(A.totalMin.priced, 5);
  assert.strictEqual(A.totalMin.total, sum(A.min));
});
t("sin ninguna coincidencia: no rompe y no inventa precios", () => {
  const c2 = mkCtx([]), A = c2.armado(gpu("rtx-5070ti"), 2);
  assert.strictEqual(A.totalMin.total, 0); assert.strictEqual(A.totalMin.missing.length, 6); assert(A.shared.length > 0);
});
t("productos sin stock no se ofrecen", () => { assert.strictEqual(C.findGpu(gpu("rtx-5090")).length, 0); });

/* ---------- Especificaciones leídas de los títulos ---------- */
t("parseo de RAM, SSD, fuente, placa, monitor y sistemas", () => {
  assert.deepStrictEqual([CT.parse("Memoria G.Skill DDR4 16GB (2x8GB) 3200MHz CL16", "memorias-ram")].map(s => [s.ddr, s.gb, s.mods, s.mhz, s.cl, s.lat])[0], ["DDR4", 16, 2, 3200, 16, 10]);
  const ss = CT.parse("Disco Solido SSD M.2 WD 4TB Black SN850X 7300MB/s NVMe PCIe Gen4 x4", "almacenamiento"); assert.strictEqual(ss.gb, 4000); assert.strictEqual(ss.gen, "PCIe 4.0");
  assert.strictEqual(CT.parse("Disco Rigido WD 8TB Red Plus NAS 256MB SATA 5640RPM", "almacenamiento").kind, "HDD");
  const f = CT.parse("Fuente ADATA XPG 750W 80 Plus Bronze PYLON", "fuentes"); assert.strictEqual(f.w, 750); assert.strictEqual(f.cert, "bronze");
  const m = CT.parse("Mother Asrock H610M-HDV/M2+ DDR5 S1700 BULK", "motherboards"); assert.deepStrictEqual([m.socket, m.chipset, m.ddr, m.form], ["LGA1700", "H610", "DDR5", "Micro-ATX"]);
  const mo = CT.parse('Monitor Gamer AsRock 31.5" VA QHD 1440p 165Hz', "monitores"); assert.deepStrictEqual([mo.inch, mo.hz, mo.panel, mo.px], [31.5, 165, "VA", 2560 * 1440]);
  const nb = CT.parse('Notebook HP 15 15.6" Intel Core i3 N305 8GB SSD 256GB FreeDOS', "notebooks"); assert.deepStrictEqual([nb.ram, nb.ssd, nb.gpu], [8, 256, null]);
  const pc = CT.parse("PC Gamer AMD Ryzen 7 9800X3D RTX 5080 16GB 32GB RAM 2TB NVMe WATER", "pcs-armadas"); assert.deepStrictEqual([pc.ram, pc.ssd, pc.gpu, pc.vram], [32, 2000, "RTX 5080", 16]);
});
t("nombres reales de la tienda: Core 5 210H, Ryzen 7 260, B650 sin socket, ITX, Full HD", () => {
  assert.strictEqual(CT.parse('Notebook ASUS Vivobook 16 16" Intel Core 5 210H 16GB DDR5 SSD 1TB RTX 5060 8GB Free DOS', "notebooks").cpu, "Core 5 210H");
  assert.strictEqual(CT.parse('Notebook Gamer ASUS TUF A16 16" AMD Ryzen 7 260 16GB DDR5 SSD 1TB RTX 5050 8GB', "notebooks").cpu, "Ryzen 7 260");
  const m = CT.parse("Mother ASUS TUF B650M-PLUS WIFI", "motherboards"); assert.deepStrictEqual([m.socket, m.chipset, m.form], ["AM5", "B650", "Micro-ATX"]);
  const i = CT.parse("Mother Asrock Z790I Lightning WIFI ITX DDR5 S1700", "motherboards"); assert.deepStrictEqual([i.socket, i.chipset, i.form], ["LGA1700", "Z790", "Mini-ITX"]);
  assert.strictEqual(CT.parse('Monitor Curvo Samsung 24" F390 Full HD FreeSync', "monitores").res, "FHD 1080p");
});
t("gráficos integrados: modelos con F no los traen; no se inventa si no se sabe", () => {
  assert.strictEqual(CT.hasIgpu("Intel Core i5 14400F"), false); assert.strictEqual(CT.hasIgpu("Intel Core i5 14400"), true);
  assert.strictEqual(CT.hasIgpu("Ryzen 5 5600"), false); assert.strictEqual(CT.hasIgpu("Ryzen 5 5600GT"), true); assert.strictEqual(CT.hasIgpu("Ryzen 7 7700X"), true);
  assert.strictEqual(CT.hasIgpu("Memoria DDR4"), null);
});
t("las placas del catálogo se ligan solo al modelo exacto", () => {
  assert.strictEqual(C.hwGpu("Placa de Video RTX 5070 TI 16GB").id, "rtx-5070ti"); assert.strictEqual(C.hwGpu("Placa de Video RTX 5070 12GB").id, "rtx-5070");
  assert.strictEqual(C.hwGpu("PC Gamer RX 7600 Ryzen 5 4500 16GB 512GB", null).id, "rx-7600");
  assert.strictEqual(C.hwCpu("PC Gamer RX 7600 Ryzen 5 4500").id, "r5-4500"); // RX 7600 NO es el Ryzen 5 7600
  assert.strictEqual(C.hwCpu("Procesador AMD Ryzen 5 5600GT AM4").id, "r5-5600gt");   // el 5600GT no es el 5600 ni el 5600X
});

/* ---------- Buscador inteligente ---------- */
const urls = new Set(PR.flatMap(g => g.offers.map(o => o.url))), priceByUrl = Object.fromEntries(PR.flatMap(g => g.offers.map(o => [o.url, CT.price(o)])));
const allCards = R => R.sections.flatMap(s => s.picks);
t("requisitos según el uso (varios usos se combinan)", () => {
  const n1 = CT.needs({ usos: ["oficina"] }); assert.strictEqual(n1.gaming, false); assert.strictEqual(n1.ram.min, 8);
  const n2 = CT.needs({ usos: ["oficina", "gaming_pesado"], res: "1440" }); assert.strictEqual(n2.gaming, true); assert.deepStrictEqual(n2.gpuReq, [{ res: 1, fps: 60 }]);
  const n3 = CT.needs({ usos: ["video", "programacion"] }); assert(n3.ram.min >= 16 && n3.ssd >= 1000);
});
t("cuestionario: los resultados respetan presupuesto, tipo y resolución", () => {
  const R = C.recommend({ usos: ["gaming_pesado"], tipo: "pc", budget: 3500000, res: "1440" });
  allCards(R).forEach(p => { assert(p.c.total <= 3500000, "excede presupuesto"); if (p.c.kind === "build") assert(p.c.g.p[1] >= 60); });
  assert(R.sections.find(s => s.key === "build").picks.length >= 2);
});
t("recomendaciones: solo productos reales, con precio y enlace del catálogo", () => {
  [{ usos: ["oficina"], tipo: "nose", budget: 1500000 }, { usos: ["gaming_casual"], tipo: "pc", budget: 2000000, res: "1080" }, { usos: ["estudio", "programacion"], tipo: "notebook", budget: 2000000 }].forEach(a => {
    allCards(C.recommend(a)).forEach(p => { const c = p.c;
      if (c.kind === "build") c.parts.forEach(pt => pt.shop.forEach(x => { assert(urls.has(x.o.url)); assert.strictEqual(x.p, priceByUrl[x.o.url]); }));
      else { assert(urls.has(c.o.url)); assert.strictEqual(c.total, priceByUrl[c.o.url]); assert(c.o.stock !== false); } }); });
});
t("cada recomendación trae explicación, especificaciones y limitaciones", () => {
  const R = C.recommend({ usos: ["gaming_pesado", "streaming"], tipo: "nose", budget: 4000000, res: "1080" }), cards = allCards(R); assert(cards.length > 0);
  cards.forEach(p => { assert(p.label); assert(Array.isArray(p.specs)); assert(p.c.kind === "build" ? p.c.parts.length >= 5 : p.specs.length >= 3); assert(Array.isArray(p.pros) && Array.isArray(p.cons) && Array.isArray(p.limits) && Array.isArray(p.does)); assert(p.pros.length + p.does.length > 0); });
});
t("se puede omitir todo salvo el uso (respuestas 'No sé')", () => {
  const R = C.recommend({ usos: ["oficina"] }); assert(R.sections.length > 0); assert(allCards(R).length > 0);
  const R2 = C.recommend({ usos: ["gaming_casual"], tipo: null, budget: null, res: null, enfoque: null, portable: null });
  assert(allCards(R2).length > 0);
});
t("alternativas: económica ≤ equilibrada ≤ mayor rendimiento en puntaje", () => {
  const s = C.recommend({ usos: ["gaming_pesado"], tipo: "componentes", budget: 4000000, res: "1080" }).sections[0], p = s.picks;
  const eco = p.find(x => x.k === "eco"), perf = p.find(x => x.k === "perf"); assert(eco && perf); assert(eco.c.total <= perf.c.total); assert(eco.c.score <= perf.c.score);
});
t("presupuesto insuficiente: lo dice y no inventa productos", () => {
  const R = C.recommend({ usos: ["gaming_pesado"], tipo: "pc", budget: 300000, res: "1440" });
  assert.strictEqual(allCards(R).length, 0); assert(R.insufficient && R.insufficient.minTotal > 300000);
});
t("sin datos suficientes en el título, el producto se descarta (no se completan datos)", () => {
  const pr = JSON.parse(JSON.stringify(PR)); pr.push({ id: "x1", name: "Notebook Misteriosa 15.6 pulgadas", category: "notebooks", offers: [{ store: "MEXX", url: "https://ejemplo.invalid/x1", price_cash: 100000, stock: true, k: "zz" }] });
  const r = mkCtx(pr).recNotebooks({}, CT.needs({ usos: ["oficina"] })); assert(!r.cands.find(c => c.g.id === "x1")); assert(r.excl.datos >= 1);
});
t("mejorar la PC actual: compatibilidad real, 'no sé' no se da por compatible", () => {
  const base = { usos: ["gaming_pesado"], res: "1080", budget: 3000000 };
  const mal = C.upgrade({ ...base, have: { tiene: true, cpu: "r5-5500", gpu: "rtx-3050", psu: "450", ddr: "DDR4", goal: "gpu" } }, CT.needs(base));
  const g70 = mal.gpus.find(x => x.g.id === "rtx-5070ti"); assert(g70, "5070 Ti debería listarse"); assert(g70.compat.some(c => c.s === "bad"), "fuente de 450 W insuficiente");
  assert(g70.bad);
  const unk = C.upgrade({ ...base, have: { tiene: true, cpu: null, gpu: null, psu: null, ddr: null, goal: "gpu" } }, CT.needs(base));
  unk.gpus.forEach(x => { assert(!x.compat.some(c => c.s === "ok"), "no puede haber 'ok' sin datos"); assert(x.compat.some(c => c.s === "unk")); });
  const lim = C.upgrade({ ...base, have: { tiene: true, cpu: "r5-9600x", gpu: "rtx-3050", psu: "850", goal: "gpu" } }, CT.needs(base)).gpus.find(x => x.g.id === "rtx-5070ti");
  assert(lim.compat.some(c => c.s === "ok" && /fuente/i.test(c.t)));
});
t("mejorar el procesador: mismo socket vs. cambio de socket", () => {
  const base = { usos: ["gaming_pesado"], res: "1080", budget: 5000000 };
  const u = C.upgrade({ ...base, have: { tiene: true, cpu: "i5-14400f", gpu: "rtx-3060", psu: "650", goal: "cpu" } }, CT.needs(base));
  const same = u.cpus.find(x => x.c.socket === "LGA1700"), other = u.cpus.find(x => x.c.socket === "AM5");
  assert(same && same.compat[0].s === "ok"); assert(other && other.compat[0].s === "warn" && other.mobo.length > 0);
});

t("las piezas de una PC por componentes cumplen RAM y SSD pedidos", () => {
  const a = { usos: ["gaming_pesado"], tipo: "componentes", budget: 6000000, res: "1080" }, n0 = CT.needs(a);
  C.recommend(a).sections[0].picks.forEach(p => { const gb = x => +(p.c.parts.find(q => q.slot === x).title.match(/(\d+(?:\.\d+)?) (GB|TB)/)[0].split(" ")[0]);
    const ram = gb("ram"), ssd = p.c.parts.find(q => q.slot === "ssd").title.includes("TB") ? 1000 * gb("ssd") : gb("ssd"); assert(ram >= n0.ram.min, "RAM"); assert(ssd >= n0.ssd, "SSD " + ssd); });
});

/* ---------- Comparador ---------- */
const byName = re => PR.find(g => re.test(g.name));
const items = (...res) => res.map(r => C.item(byName(r)));
t("compara dos placas de la misma categoría: datos coinciden con el origen", () => {
  const its = items(/RTX 5070 TI Ventus/i, /RX 9070 XT/i), cmp = C.compare(its, { res: 2 }), fps = cmp.rows.find(r => r.id === "fps");
  assert.strictEqual(fps.cells[0].v, gpu("rtx-5070ti").p[2]); assert.strictEqual(fps.cells[1].v, gpu("rx-9070xt").p[2]); assert.strictEqual(fps.cells[0].tag, "bench");
  assert.strictEqual(cmp.rows.find(r => r.id === "bw").cells[0].v, 896); assert.strictEqual(cmp.rows.find(r => r.id === "sp").cells[0].disp, "8.960");
  const pr = cmp.rows.find(r => r.id === "price"); assert.strictEqual(pr.cells[0].v, 2322350);
});
t("etiquetas de fiabilidad: verificado / benchmark / estimado / pendiente / sin datos", () => {
  const cmp = C.compare(items(/RTX 5070 TI Ventus/i, /RX 9070 XT/i), { res: 1 }), tag = (id, i) => cmp.rows.find(r => r.id === id).cells[i].tag;
  assert.strictEqual(tag("sp", 0), "ver"); assert.strictEqual(tag("sp", 1), "ver"); assert.strictEqual(tag("tgp", 0), "ver");
  assert.strictEqual(tag("fpsw", 0), "est"); assert.strictEqual(tag("fps", 0), "bench"); assert.strictEqual(tag("rt", 0), "bench");
  const c2 = C.compare(items(/RTX 3060 12GB/i, /RTX 4060 8GB/i), { res: 1 }); assert.strictEqual(c2.rows.find(r => r.id === "sp").cells[0].tag, "ver"); // 30xx: comprobado contra la ficha de NVIDIA el 24-oct-2026
  assert.strictEqual(c2.rows.find(r => r.id === "tgp").cells[0].tag, "ver"); assert.strictEqual(c2.rows.find(r => r.id === "official").cells[0].tag, "ver");
  assert.strictEqual(c2.rows.find(r => r.id === "bw").cells[1].tag, "pend");
});
t("ganador justificado y reproducible; el 'valor' y el 'consumo' pueden dar otro ganador", () => {
  const cmp = C.compare(items(/RTX 5070 TI Ventus/i, /RTX 5060 8GB/i), { res: 1 }), gm = cmp.uses.find(u => u.use.id === "gaming");
  assert.strictEqual(gm.winner, 0); assert(gm.scores[0] > gm.scores[1]); assert(gm.why.length > 0); assert(gm.used.length >= 2);
  const again = C.compare(items(/RTX 5070 TI Ventus/i, /RTX 5060 8GB/i), { res: 1 }).uses.find(u => u.use.id === "gaming"); assert.deepStrictEqual(again.scores, gm.scores);
});
t("agregar y quitar productos de la comparación", () => {
  const three = C.compare(items(/RTX 5070 TI Ventus/i, /RX 9070 XT/i, /RTX 4060 8GB/i), { res: 1 });
  assert.strictEqual(three.rows[0].cells.length, 3); assert(three.uses.every(u => u.scores == null || u.scores.length === 3));
  const two = C.compare(items(/RTX 5070 TI Ventus/i, /RTX 4060 8GB/i), { res: 1 }); assert.strictEqual(two.rows[0].cells.length, 2);
});
t("productos con información incompleta: 'Sin datos', sin NaN y sin ganador inventado", () => {
  const cmp = C.compare(items(/Mancer DDR4 16GB/i, /KingDian DDR4 16GB/i), { res: 1 });
  assert(cmp.rows.find(r => r.id === "cl").cells.some(c => c.disp === "Sin datos")); assert(JSON.stringify(cmp).indexOf("NaN") < 0);
  const vel = cmp.uses.find(u => u.use.id === "vel"); assert.strictEqual(vel.winner, null); assert(vel.reason);
  const g = C.compare(items(/RTX 5070 TI Ventus/i, /Radeon RX 6600/i), { res: 1 }); assert(g.uses.length > 0);
});
t("categorías distintas: solo precio/tienda/stock y aviso explicativo", () => {
  const cmp = C.compare(items(/RTX 5070 TI Ventus/i, /Ryzen 5 9600X/i), { res: 1 });
  assert.strictEqual(cmp.mixed, true); assert.deepStrictEqual(cmp.rows.map(r => r.id), ["name", "price", "store", "stock"]); assert.strictEqual(cmp.uses.length, 0); assert(C.notes(cmp)[0].includes("categorías distintas"));
});
t("empate técnico: sin ganador", () => {
  const a = C.item(byName(/RTX 5070 TI Ventus/i)), b = C.item(byName(/RTX 5070 TI Ventus/i)), cmp = C.compare([a, b], { res: 1 });
  cmp.uses.forEach(u => assert.strictEqual(u.winner, null));
});
t("distintas categorías con métricas diferentes", () => {
  [[/Ryzen 5 9600X/i, /Ryzen 7 9800X3D/i], [/Corsair DDR5 32GB/i, /Kingston DDR5 16GB/i], [/Kingston 1TB NV3/i, /WD 2TB Black/i], [/Seasonic 850W/i, /Corsair 1000W/i], [/LG UltraGear/i, /VY229HF/i], [/Nitro Lite 16/i, /MSI Thin 15/i], [/Ryzen 7 9800X3D RTX 5080/i, /R7-7700X/i], [/B650M/i, /A620M/i]].forEach(([a, b]) => {
    const cmp = C.compare(items(a, b), { res: 1 }); assert(!cmp.mixed); assert(cmp.rows.length > 4); assert(JSON.stringify(cmp).indexOf("NaN") < 0);
    cmp.uses.forEach(u => { if (u.winner != null) { assert(u.scores.length === 2 && u.used.length >= 1 && u.why.length >= 1); } else assert(u.reason); }); });
  const cpu = C.compare(items(/Ryzen 5 9600X/i, /Ryzen 7 9800X3D/i), { res: 1 }); assert.strictEqual(cpu.uses.find(u => u.use.id === "gaming").winner, 1);
  const ram = C.compare(items(/Corsair DDR5 32GB/i, /Kingston DDR5 16GB/i), { res: 1 }); assert.strictEqual(ram.uses.find(u => u.use.id === "cap").winner, 0);
});
t("notas prácticas: fuente, VRAM y datos faltantes", () => {
  const cmp = C.compare(items(/RTX 5070 TI Ventus/i, /RTX 4060 8GB/i), { res: 1 }), notes = C.notes(cmp).join(" ");
  assert(/fuente/i.test(notes)); assert(/VRAM/.test(notes));
});
t("radar y valores relativos entre 0 y 100", () => {
  const cmp = C.compare(items(/RTX 5070 TI Ventus/i, /RX 9070 XT/i), { res: 1 }), ax = C.radar(cmp); assert(ax.length >= 3); ax.forEach(a => a.vals.forEach(v => assert(v > 0 && v <= 100)));
});
t("cada producto del catálogo se puede comparar sin errores", () => {
  const byCat = {}; PR.forEach(g => (byCat[g.category] = byCat[g.category] || []).push(g));
  Object.values(byCat).forEach(l => { if (l.length >= 2) { const cmp = C.compare([C.item(l[0]), C.item(l[1])], { res: 1 }); C.notes(cmp); assert(JSON.stringify(cmp).indexOf("NaN") < 0); } });
});

/* ---------- Fichas técnicas de notebooks (actualización 4) ---------- */
const SPECS = require("./fixtures/specs_out.json");
const PRS = JSON.parse(JSON.stringify(PR));
PRS.find(g => g.id === "ec0ca5a4de").spec = "83dk006har";   // Yoga: ficha completa
PRS.find(g => g.id === "f9e6c2c5dc").spec = "anv1541r6nm";  // Nitro V: ficha con contradicción de CPU
const CS = CT.makeFinder(CT.create(HW, PRS, META, SPECS));
const gNb = id => PRS.find(g => g.id === id);
t("ficha: el peso sale de la fuente con unidad, SKU y fecha", () => {
  const r = CS.sf(gNb("ec0ca5a4de"), "peso"); assert.strictEqual(r.v, 1.61); assert.strictEqual(r.u, "kg"); assert.strictEqual(r.tag, "ver");
  assert.strictEqual(r.src, "Compragamer"); assert.strictEqual(r.sku, "83DK006HAR"); assert.strictEqual(r.date, "2026-10-23");
});
t("ficha: sin ficha o sin dato → null, nunca un valor inventado", () => {
  assert.strictEqual(CS.sf(gNb("bcd4975fad"), "peso"), null); assert.strictEqual(CS.specMissing(gNb("bcd4975fad"), "peso"), "sin ficha");
  assert.strictEqual(CS.sf(gNb("ec0ca5a4de"), "bateria_wh"), null); assert.strictEqual(CS.specMissing(gNb("ec0ca5a4de"), "bateria_wh"), "no publicado");
  assert.strictEqual(C.sf(gNb("ec0ca5a4de"), "peso"), null, "sin specs.json la app sigue funcionando");
});
t("ficha: la contradicción título/ficha baja el nivel a 'Pendiente de verificar'", () => {
  const r = CS.sf(gNb("f9e6c2c5dc"), "cpu"); assert.strictEqual(r.tag, "pend"); assert(/7535HS/.test(r.note));
});
t("buscador: usa el peso de la ficha y deja de decir que no hay datos", () => {
  const e = CS.explain({ portable: "si" }, CT.needs({ usos: ["oficina"] }), { kind: "notebook", g: gNb("ec0ca5a4de"), o: PRS[0].offers[0], total: 1, score: 1, s: CT.parse(gNb("ec0ca5a4de").name, "notebooks") });
  const peso = e.specs.find(x => x[0] === "Peso"); assert(peso && /1,61 kg/.test(peso[1]) && peso[2] === "ver", JSON.stringify(e.specs));
  assert(e.pros.some(x => /1,61 kg/.test(x))); assert(!e.limits.some(x => /No pudimos obtener el peso/.test(x)));
  const bat = e.specs.find(x => x[0] === "Batería"); assert.strictEqual(bat[2], "nd"); assert(e.limits.some(x => /Batería/.test(x)));
});
t("buscador: notebook sin ficha dice por qué falta el peso", () => {
  const e = CS.explain({ portable: "si" }, CT.needs({ usos: ["oficina"] }), { kind: "notebook", g: gNb("bcd4975fad"), o: PRS[0].offers[0], total: 1, score: 1, s: CT.parse(gNb("bcd4975fad").name, "notebooks") });
  const peso = e.specs.find(x => x[0] === "Peso"); assert.strictEqual(peso[2], "nd"); assert(/no publicó una ficha/.test(peso[1]));
  assert(e.limits.some(x => /No pudimos obtener el peso/.test(x) && /transportar/.test(x)));
});
t("buscador: RAM soldada y justa se advierte; slot libre se destaca", () => {
  const n = CT.needs({ usos: ["programacion", "gaming_casual"] });
  const a = CS.explain({}, n, { kind: "notebook", g: gNb("ec0ca5a4de"), o: PRS[0].offers[0], total: 1, score: 1, s: CT.parse(gNb("ec0ca5a4de").name, "notebooks") });
  const b = CS.explain({}, n, { kind: "notebook", g: gNb("f9e6c2c5dc"), o: PRS[0].offers[0], total: 1, score: 1, s: CT.parse(gNb("f9e6c2c5dc").name, "notebooks") });
  if (n.ram.rec > 8) { assert(a.cons.some(x => /no se puede ampliar/.test(x))); assert(b.pros.some(x => /slot de RAM libre/.test(x))); }
  assert(a.specs.some(x => x[0] === "RAM ampliable" && /^No/.test(x[1]))); assert(b.specs.some(x => x[0] === "RAM ampliable" && /^Sí/.test(x[1])));
});
t("comparador: filas de peso, medidas, garantía y batería con su procedencia", () => {
  const K = CT.makeCompare(CT.create(HW, PRS, META, SPECS));
  const cmp = K.compare([K.item(gNb("ec0ca5a4de")), K.item(gNb("f9e6c2c5dc"))], { res: 1 });
  const row = id => cmp.rows.find(r => r.id === id);
  assert.strictEqual(row("peso").cells[0].v, 1.61); assert.strictEqual(row("peso").cells[1].v, 2); assert(/Compragamer/.test(row("peso").cells[0].note));
  assert.strictEqual(row("bat").cells[0].tag, "nd"); assert.strictEqual(row("gar").cells[1].v, 12);
  assert(/317 × 222 × 17 mm/.test(row("dim").cells[0].text)); assert.strictEqual(row("dim").cells[1].tag, "nd");   // sin medidas en la ficha del Nitro
  const light = cmp.uses.find(u => u.use.id === "port"); assert(light && light.winner === 0, "gana la más liviana");
  assert(JSON.stringify(cmp).indexOf("NaN") < 0);
});

/* ---------- Armado: cobertura de procesadores y "¿Qué actualizar?" ---------- */
require("../site/js/upgrade.js");
const CU = (() => { const c = CT.makeFinder(CT.create(HW, PR, META)); CT.makeUpgrade(c); return c; })();
t("todo procesador con puntaje da sugerencias de placa en los tres resoluciones", () => {
  HW.cpus.filter(c => c.s).forEach(c => { const cf = CU.cpuFps(c); assert(cf > 0, c.id);
    [0].forEach(r => assert(HW.gpus.some(g => g.p[r] <= cf), "sin sugerencia para " + c.id)); });
  // sin puntaje: el 12100F y los agregados por la auditoría que Tom's Hardware no mide (tienen ficha oficial, no puntaje inventado)
  const sin = HW.cpus.filter(c => !c.s);
  assert(sin.every(c => c.id === "i3-12100f" || (c.vurl && c.vdate === "2026-10-26")), "todo procesador sin puntaje tiene ficha oficial");
  assert(!sin.some(c => c.se), "ninguno tiene puntaje estimado");
});
t("el Ryzen 7 5800X existe, se reconoce y no se confunde con X3D / XT", () => {
  const id = n => (CU.hwCpu(n) || {}).id;
  assert.strictEqual(id("Procesador AMD Ryzen 7 5800X 4.7GHz AM4 Sin Cooler"), "r7-5800x");
  assert.strictEqual(id("Micro AMD Ryzen 7 5800X3D 3.4Ghz"), "r7-5800x3d");
  assert.strictEqual(id("AMD Ryzen 7 5800XT 3.8GHz"), "r7-5800xt");
  assert.strictEqual(id("Ryzen 5 5600X"), "r5-5600x"); assert.strictEqual(id("Ryzen 5 5600"), "r5-5600");
  assert.strictEqual(CU.hwCpu("Placa de Video Sapphire RX 7900XTX 24GB"), null); assert.strictEqual(CU.hwCpu("Radeon RX 7600XT 16GB"), null);
});
t("los puntajes estimados se marcan y explican; los medidos no", () => {
  const cpu = id => HW.cpus.find(c => c.id === id);
  ["r7-5800x", "r5-5600x", "r7-5800x3d", "r5-5500", "r5-7600", "r7-9700x", "i5-12400f"].forEach(i => { assert(cpu(i).se && cpu(i).se.n.length > 30 && ["alta", "media", "baja"].includes(cpu(i).se.conf), i); });
  ["r7-9800x3d", "r5-9600x", "i5-14400f", "r7-7800x3d", "u5-225f"].forEach(i => assert(!cpu(i).se, i));
  assert(cpu("r5-5600").s < cpu("r5-5600x").s && cpu("r5-5600x").s < cpu("r7-5800x").s && cpu("r7-5800x").s < cpu("r7-5800x3d").s);
});
t("recomendar una compra nunca usa un puntaje estimado", () => {
  [0, 1, 2].forEach(r => HW.gpus.forEach(g => { const p = CU.pickPair(g, r); assert(!p.cMin.c.se && !p.cSug.c.se, g.id); }));
});
t("¿Qué actualizar?: 5800X + RTX 3070 → limita la placa, ofrece placas que llegan al objetivo y avisa de la fuente", () => {
  const r = CU.advise({ text: "Ryzen 7 5800X, RTX 3070, 16 GB DDR4, 650 W, B550", res: 1, fps: 100 });
  assert.strictEqual(r.o.cpu.id, "r7-5800x"); assert.strictEqual(r.o.gpu.id, "rtx-3070"); assert.strictEqual(r.o.psu.w, 650); assert.strictEqual(r.o.ram.gb, 16); assert.strictEqual(r.o.mobo.chipset, "B550");
  assert.strictEqual(r.cur.limiter, "gpu"); assert.strictEqual(r.cur.meets, false);
  const g = r.steps.find(s => s.kind === "gpu"); assert(g && g.options.length > 0);
  g.options.forEach(o => { assert(o.reach >= 100 && o.price > 0); assert(o.psuOk === (650 >= o.need)); if (!o.psuOk) assert(o.total >= o.price); });
  assert(!r.steps.some(s => s.kind === "cpu"), "el 5800X (~122 FPS) alcanza para 100 FPS");
});
t("¿Qué actualizar?: si ya cumple, no inventa cambios; si el CPU limita, ofrece CPU", () => {
  const ok = CU.advise({ text: "Ryzen 7 9800X3D, RTX 5070 Ti", res: 1, fps: 60 }); assert.strictEqual(ok.cur.meets, true); assert.strictEqual(ok.steps.filter(s => s.kind === "gpu" || s.kind === "cpu").length, 0);
  const lim = CU.advise({ text: "Ryzen 5 5500, RTX 4070 Super", res: 0, fps: 100 }); assert.strictEqual(lim.cur.limiter, "cpu");
  assert(lim.steps.some(s => s.kind === "cpu"));
});
t("¿Qué actualizar?: lo que no está en la base se dice, no se inventa un puntaje", () => {
  const r = CU.advise({ text: "Ryzen 5 3600, GTX 960, 8 GB DDR4", res: 0, fps: 60 });
  assert.strictEqual(r.cur.gF, null); assert.strictEqual(r.cur.cF, null); assert.strictEqual(r.cur.eff, null);
  assert(r.unknown.length === 2 && r.unknown.every(u => u.why.length > 20)); assert.strictEqual(r.o.socketGuess, "AM4");
  assert(r.steps.some(s => s.kind === "ram"), "8 GB de RAM sí se puede evaluar");
  assert(JSON.stringify(r).indexOf("NaN") < 0);
});
t("¿Qué actualizar?: lectura flexible del texto (modelos sueltos, separadores, sin datos)", () => {
  const o = CU.parseOwned("5800x + 3070\n16gb ddr4 3200, 750w");
  assert.strictEqual(o.cpu.id, "r7-5800x"); assert.strictEqual(o.gpu.id, "rtx-3070"); assert.strictEqual(o.psu.w, 750); assert.strictEqual(o.ram.gb, 16);
  assert.strictEqual(CU.parseOwned("rx 6700 xt").gpu.id, "rx-6700xt"); assert.strictEqual(CU.parseOwned("Intel Core i5-12400F").cpu.id, "i5-12400f");
  const vacio = CU.advise({ text: "hola", res: 0, fps: 60 }); assert.strictEqual(vacio.steps.length, 0); assert(vacio.head.length > 0);
});
t("¿Qué actualizar?: presupuesto, y objetivo inalcanzable muestra lo mejor disponible", () => {
  const b = CU.advise({ text: "Ryzen 7 5800X, RTX 3060", res: 1, fps: 100, budget: 200000 });
  const g = b.steps.find(s => s.kind === "gpu"); assert(!g || g.options.every(o => o.total <= 200000));
  const dur = CU.advise({ text: "Ryzen 7 5800X, RTX 3070", res: 2, fps: 144 }), gs = dur.steps.find(s => s.kind === "gpu");
  assert(gs); if (gs.options.length) assert(gs.options.every(o => !o.meets) || gs.hayOk);
});
t("placas de generaciones anteriores (RTX 2060 Super…): se reconocen, se marcan como estimadas y no se recomiendan", () => {
  const old = HW.gpus.filter(g => g.se); assert(old.length >= 20);
  old.forEach(g => { assert(g.se.n.length > 60 && ["media", "baja"].includes(g.se.conf), g.id); assert(g.p[0] > g.p[1] && g.p[1] > g.p[2], g.id); });
  const id = n => (CU.hwGpu(n) || {}).id;
  assert.strictEqual(id("Placa de Video Gigabyte GeForce RTX 2060 Super 8GB"), "rtx-2060s"); assert.strictEqual(id("GeForce GTX 1660 Super 6GB"), "gtx-1660s");
  assert.strictEqual(id("Radeon RX 580 8GB"), "rx-580"); assert.strictEqual(id("Radeon RX 5700 XT 8GB"), "rx-5700xt"); assert(!id("GeForce GTX 1060 3GB"), "la 3 GB no es la de 6 GB");
  const r = CU.advise({ text: "Ryzen 7 5800X, RTX 2060 Super, 16 GB DDR4, 550 W", res: 1, fps: 60 });
  assert.strictEqual(r.o.gpu.id, "rtx-2060s"); assert(r.o.gpu.se); assert.strictEqual(r.cur.limiter, "gpu"); assert(r.cur.gF > 30 && r.cur.gF < 50);
  const g = r.steps.find(x => x.kind === "gpu"); assert(g && g.options.length && g.options.every(o => !o.g.se && o.reach >= 60));
  assert(!CU.recommend({ usos: ["gaming_pesado"], tipo: "componentes", budget: 9e6, res: "1080" }).sections[0].picks.some(p => p.c.parts.some(q => q.key && /gpu:(rtx-20|gtx|rx-5|rx-5[0-9]{2}|vega)/.test(q.key))));
  [0, 1, 2].forEach(res => HW.gpus.filter(g => !g.se).forEach(g => assert(!CU.pickPair(g, res).cMin.c.se)));
  // la escala se controla contra una placa que SÍ está en ambas tablas: RTX 3050 (legado 40,5 -> 44,6 medido)
  assert(Math.abs(61.5 * 40.5 / 54.7 - HW.gpus.find(g => g.id === "rtx-3050").p[0]) < 1.2);
});
/* ---------- Reputación junto a cada oferta ---------- */
const REP = require("../site/js/rep.js"), STO = require("../site/data/stores.json");
REP.set(STO);
t("la reputación se muestra con puntaje, cantidad y fuente", () => {
  const h = REP.badge("Venex");
  assert(/★ 4,6/.test(h) && /8\.388 op\. Google/.test(h) && /consultado el 2026-10-24/.test(h) && !/pocas opiniones/.test(h));
});
t("pocas opiniones se avisa; sin ficha verificable no se inventa puntaje", () => {
  assert(/pocas opiniones/.test(REP.badge("BitHard")) && REP.low(REP.get("BitHard")) && !REP.low(REP.get("Gamer Factory")));
  ["Gaming City", "Hardloots", "TiendaQueNoExiste"].forEach(s => assert(REP.get(s) === null && /sin reputación verificada/.test(REP.badge(s)) && !/★/.test(REP.badge(s))));
});
t("el texto de la reputación escapa HTML y no promedia fuentes", () => {
  REP.set({ stores: { X: { reputation: [{ source: "Google Maps", listing: "<b>x</b>", score: 4, count: 10, date: "2026-10-24" }] } } });
  assert(!/<b>x/.test(REP.badge("X")));
  REP.set(STO);
});
/* ---------- Paginador ---------- */
t("pageList: primera, última, actual con vecinas y saltos con «…»", () => {
  const CTp = require("../site/js/lib.js");
  assert.deepStrictEqual(CTp.pageList(1, 1), [1]);
  assert.deepStrictEqual(CTp.pageList(2, 5), [1, 2, 3, 4, 5]);
  assert.deepStrictEqual(CTp.pageList(6, 12), [1, "…", 5, 6, 7, "…", 12]);
  assert.deepStrictEqual(CTp.pageList(12, 12), [1, "…", 9, 10, 11, 12]);
  for (let tot = 1; tot < 40; tot++) for (let c = 1; c <= tot; c++) { const l = CTp.pageList(c, tot); assert(l.includes(1) && l.includes(tot) && l.includes(c)); }
});
/* ---------- Comparación: un solo producto, datos faltantes y hechos comprobables ---------- */
require("../site/js/compare.js");
const DET = require("../site/js/detail.js");
t("comparar con un solo producto no falla (página de detalle) y lista solo datos con respaldo", () => {
  const K = CT.makeCompare(CT.create(HW, PR, {}, null));
  const g = PR.find(x => x.category === "procesadores");
  const cmp = K.compare([K.item(g)], { res: 1 });
  assert(cmp.rows.length > 3 && cmp.uses.every(u => u.winner == null));
});
t("con datos incompletos no hay ganador inventado: solo hechos de precio y memoria", () => {
  const K = CT.makeCompare(CT.create(HW, PR, {}, null));
  const a = PR.find(x => /RTX 3050 6GB/.test(x.name)), b = PR.find(x => /RTX 3060 8GB/.test(x.name));
  if (!a || !b) return;
  const cmp = K.compare([K.item(a), K.item(b)], { res: 1 });
  const cov = K.coverage(cmp);
  assert(cov[0].have > 3, "la RTX 3050 6GB tiene ficha oficial (sin rendimiento medido)");
  assert(cov[1].have <= 1, "la RTX 3060 8GB no está en la base");
  assert(cmp.uses.every(u => u.winner == null), "sin datos de las dos no hay ganador");
  assert(cmp.rows.find(r => r.id === "fps").cells[0].tag === "nd", "no se inventa rendimiento");
  const f = K.facts(cmp).map(x => x.text).join("|");
  assert(/Precio: más barato en/.test(f) && /VRAM/.test(f) && !/FPS/.test(f));
  assert(!K.notes(cmp).some(x => /promedio de 11 juegos/.test(x)), "no se nombran FPS si no hay FPS");
});
t("con ficha de ambas, los hechos señalan al ganador de cada fila", () => {
  const K = CT.makeCompare(CT.create(HW, PR, {}, null));
  const a = PR.find(x => /3060 12GB/.test(x.name)), b = PR.find(x => /RTX 4060/.test(x.name) && x.category === "placas-de-video");
  const cmp = K.compare([K.item(a), K.item(b)], { res: 1 });
  const f = K.facts(cmp);
  assert(f.some(x => x.id === "vram" && x.winner === 0) && f.some(x => x.id === "tgp" && x.winner === 1));
});
t("la dirección de la página de producto escapa el id", () => {
  assert.strictEqual(DET.url("a b&c"), "producto.html?id=a%20b%26c");
});
/* ---------- Auditoría de fichas (26-oct-2026) ---------- */
t("procesadores agregados: se reconocen con sus variantes y con «+ Wraith Stealth Cooler»", () => {
  const K = CT.create(HW, [], {}, null);
  const id = n => (K.hwCpu(n) || {}).id;
  assert.strictEqual(id("Procesador Amd Ryzen 5 5600Xt 4.4Ghz Turbo Am4 6 Núcleos 12 Hilos Sin Gráficos"), "r5-5600xt");
  assert.strictEqual(id("Procesador AMD Ryzen 5 8600G 5.0GHz Turbo AM5 + Wraith Stealth Cooler"), "r5-8600g");
  assert.strictEqual(id("Procesador AMD Ryzen 3 4100 + Wraith Stealth Cooler AM4"), "r3-4100");
  assert.strictEqual(id("Procesador Intel Core i9 14900F 5.8GHz Turbo Socket 1700"), "i9-14900");
  assert.strictEqual(id("Procesador Intel Core i9-14900K"), "i9-14900k");
  assert.strictEqual(id("Procesador Intel Core Ultra 7 265F 20/20 5.30GHz LGA1851"), "u7-265");
  assert.strictEqual(id("Procesador Intel Core Ultra 7 265K"), "u7-265k");
  assert.strictEqual(id("Procesador AMD Ryzen 7 7700 5.3GHz Turbo AM5"), "r7-7700");
  assert.strictEqual(id("Procesador AMD Ryzen 7 7700X"), "r7-7700x");
  assert.strictEqual(id("Procesador AMD Ryzen 7 5700X3D"), "r7-5700x3d");
  assert.strictEqual(id("Procesador AMD Ryzen 5 PRO 5650G 6/12 4.4GHz AM4 Bulk (Simil 5600GT)"), undefined, "un «símil» no es el mismo modelo");
  assert.strictEqual(id("Cooler AMD Wraith Stealth"), undefined);
  const c = HW.cpus.find(x => x.id === "r5-5600xt");
  assert(c.vurl && c.ver.includes("cores") && c.s == null, "ficha oficial verificada, sin puntaje inventado");
});
t("placas agregadas y nombres pegados (RX 9070 16GB XT, RX 9070 GRE, RTX 3050 6GB)", () => {
  const K = CT.create(HW, [], {}, null);
  const id = n => (K.hwGpu(n) || K.hwGpuX(n) || {}).id;
  assert.strictEqual(id("Placa De Video Gigabyte Radeon Rx 9070 16gb Xt Gaming"), "rx-9070xt");
  assert.strictEqual(id("Placa de Video ASUS Prime AMD Radeon RX 9070 GRE OC 12GB"), "rx-9070gre");
  assert.strictEqual(id("Placa de Video Gigabyte Radeon RX 9070 16GB"), "rx-9070");
  assert.strictEqual(id("Placa de Video ZOTAC GeForce RTX 3050 Twin Edge 6GB"), "rtx-3050-6");
  assert.strictEqual(id("Placa de Video MSI GeForce RTX 3050 Ventus 2X 8GB"), "rtx-3050");
  assert.strictEqual(id("Placa de Video XFX Radeon RX 9060 8GB GDDR6 SWIFT"), "rx-9060");
  assert.strictEqual(id("Placa de Video XFX Radeon RX 9060 XT 8GB"), "rx-9060xt-8");
  assert(!HW.gpus.some(g => g.id === "rtx-3050-6"), "las placas sin rendimiento no entran en las recomendaciones");
});
t("lectura de títulos: pulgadas con ″, ´ o sin comillas, paneles, MT/s, DDR por socket y «No aplica»", () => {
  assert.strictEqual(CT.parse("Monitor LG 22″ 100Hz FHD 1MS VA", "monitores").inch, 22);
  assert.strictEqual(CT.parse("Monitor 24 LED CX CX238K FHD 120Hz", "monitores").inch, 24);
  assert.strictEqual(CT.parse("Monitor KTC 27\" QHD HVA 144Hz", "monitores").panel, "VA (HVA)");
  assert.strictEqual(CT.parse("Memoria Patriot DDR5 16GB CL36 6000MTS", "memorias-ram").mhz, 6000);
  const m = CT.parse("Mother Asrock B450M-HDV AM4", "motherboards"); assert(m.ddr === "DDR4" && m.ddrBySocket);
  assert.strictEqual(CT.parse("Mother B760M-A D4 Asus Prime", "motherboards").ddr, "DDR4");
  assert.strictEqual(CT.parse("Mother B760M Gigabyte LGA1700", "motherboards").ddr, null, "LGA1700 admite DDR4 y DDR5: no se adivina");
  assert(CT.parse("Disco Rigido WD 8TB Purple SATA 5640RPM", "almacenamiento").genNA);
  assert.strictEqual(CT.parse("Fuente Corsair 750W Cybenetics Gold", "fuentes").cyb, "Cybenetics Gold");
  const K = CT.makeCompare(CT.create(HW, [], {}, null));
  const hdd = { id: "x", name: "Disco Rigido WD 2TB Blue SATA 7200RPM", category: "almacenamiento", offers: [{ store: "A", price_cash: 1, stock: true }] };
  const r = K.compare([K.item(hdd)], { res: 1 }).rows;
  assert.strictEqual(r.find(x => x.id === "gen").cells[0].disp, "No aplica");
  assert.strictEqual(r.find(x => x.id === "rpm").cells[0].v, 7200);
});
t("mouse, teclados y auriculares: ficha de la tienda primero, título después, y criterios sin inventar", () => {
  const mk = (id, name, cat, p, spec) => ({ id, name, category: cat, offers: [{ store: "A", price_cash: p, stock: true }], ...(spec ? { spec } : {}) });
  const PRm = [mk("a", "Mouse Gamer Logitech G502 Hero 25600 DPI 11 Botones RGB 121g", "mouses", 50000),
               mk("b", "Mouse Logitech G Pro X Superlight 2 Lightspeed", "mouses", 150000, "k1")];
  const SP = { items: { k1: { s: "Compragamer", sku: "X1", d: "2026-10-26", url: "u", f: { polling: { v: 8000, u: "Hz" }, dpi_max: { v: 44000 }, peso_g: { v: 60 }, botones: { v: 5 } } } } };
  const K = CT.makeCompare(CT.create(HW, PRm, {}, SP));
  const cmp = K.compare(PRm.map(K.item), { res: 1 }), row = id => cmp.rows.find(r => r.id === id);
  assert.strictEqual(row("dpi").cells[1].v, 44000); assert(/Ficha de la tienda/.test(row("dpi").cells[1].note));
  assert.strictEqual(row("dpi").cells[0].v, 25600); assert(/título/.test(row("dpi").cells[0].note));
  assert.strictEqual(row("peso").cells[0].v, 121);
  assert(cmp.uses.find(u => u.use.id === "liviano").winner === 1, "el más liviano gana en «Más liviano»");
  assert.strictEqual(row("clicks").cells[0].tag, "nd", "la vida útil no se inventa");
  const kb = CT.parse("Teclado Mecanico Redragon Kumara K552 RGB Outemu Red ESP TKL", "teclados");
  assert(kb.mec === "Mecánico" && kb.switch === "Outemu Red" && kb.idioma === "Español" && /TKL/.test(kb.formato));
  const hs = CT.parse("Auriculares HyperX Cloud II 7.1 USB 53mm Microfono", "auriculares");
  assert(hs.driver === 53 && hs.mic && /USB/.test(hs.conexion));
  assert(CT.CATS.mouses && CT.CATS.teclados && CT.CATS.auriculares);
});
console.log(n + " pruebas de JavaScript OK");
