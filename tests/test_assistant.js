// Pruebas del asistente virtual (motor local + respaldo con IA simulada). Se ejecutan con: node tests/test_assistant.js
const assert = require("assert");
const CT = require("../site/js/lib.js");
require("../site/js/compare.js"); require("../site/js/finder.js"); require("../site/js/assistant.js");
const HW = require("../site/data/hardware.json"), PR0 = require("./fixtures/catalog.json"), STORES = require("../site/data/stores.json");
const SPECS = require("./fixtures/specs_out.json");
const PR = JSON.parse(JSON.stringify(PR0));
PR.find(g => g.id === "ec0ca5a4de").spec = "83dk006har"; PR.find(g => g.id === "f9e6c2c5dc").spec = "anv1541r6nm";
const META = { updated: new Date(Date.now() - 3 * 36e5).toISOString() };
const mk = (extra = {}, o = {}) => CT.makeAssistant({ HW, PR, META, SPECS, STORES, CFG: extra }, o);
const txt = r => r.blocks.map(b => b.text || (b.items || []).join(" | ")).join(" ");
let n = 0;
const t = async (name, fn) => { try { await fn(); n++; } catch (e) { console.error("FALLÓ:", name, "\n ", e.message); process.exitCode = 1; } };

(async () => {
  const A = mk();
  await t("glosario: explica VRAM y lo marca como explicación general", async () => {
    const r = await A.ask("¿Qué es la VRAM?", { section: "armado" }); assert(/VRAM/.test(txt(r))); assert.strictEqual(r.basis, "gen");
    assert(/DDR5/.test(txt(await A.ask("diferencia entre DDR4 y DDR5", {}))));
    assert(/núcleo/i.test(txt(await A.ask("qué son los núcleos e hilos", {}))));
  });
  await t("precio: usa solo el catálogo, con tienda, stock y fecha; avisa que el envío no está incluido", async () => {
    const r = await A.ask("¿cuánto sale la RTX 5060 Ti 16GB?", {}); const s = txt(r);
    assert(/RTX 5060 Ti/.test(s) && /\$1\.010\.000/.test(s) && /Compragamer/.test(s) && /actualizaron/.test(s) && r.basis === "cat");
    const sin = txt(await A.ask("precio RTX 5090 ASTRAL", {})); assert(/sin stock/.test(sin), "no inventa disponibilidad: " + sin);
  });
  await t("producto inexistente: no inventa y dice qué sí puede hacer", async () => {
    const r = await A.ask("cuánto sale la RTX 9999 Quantum", {}); assert(/No tengo ese dato/.test(txt(r))); assert.strictEqual(r.basis, "none");
  });
  await t("tiendas: reputación con fuente, fecha y sin promediar; sin datos si no hay", async () => {
    const g = txt(await A.ask("¿Es confiable GoldenTech?", {})); const R = n => STORES.stores[n].reputation[0], sc = n => R(n).score.toLocaleString("es-AR", { minimumFractionDigits: 1 }) + " sobre 5",
      cn = n => Number(R(n).count).toLocaleString("es-AR");   // act. 42: los números salen de stores.json (se actualizan)
    assert(g.includes(sc("GoldenTech")) && g.includes(cn("GoldenTech")) && /Google Maps/.test(g) && g.includes(R("GoldenTech").date));
    const m = txt(await A.ask("¿Y la reputación de Hardloots?", {})); assert(/No tenemos una puntuación pública verificada/.test(m) && !/\d,\d sobre 5/.test(m));
    const mx = txt(await A.ask("¿Y la reputación de Maximus?", {})); assert(mx.includes(sc("Maximus")) && mx.includes(cn("Maximus")));
    const bh = txt(await A.ask("¿Es confiable BitHard?", {})); assert(/5,0 sobre 5/.test(bh) && /pocas opiniones/i.test(bh));
    const a = txt(await A.ask("army tech es confiable?", {})); assert(a.includes(sc("Armytech")) && a.includes(cn("Armytech")));
    const all = txt(await A.ask("qué tiendas están conectadas", {})); assert(/GoldenTech/.test(all) && /Armytech/.test(all) && /Fullh4rd/.test(all) && /403/.test(all));
    assert(!/promedi(o|amos) de/.test(g));
  });
  await t("notebook con ficha: peso con fuente y SKU; batería declarada como no publicada", async () => {
    const s = txt(await A.ask("¿cuánto pesa y qué batería tiene la notebook Lenovo Yoga 7?", {}));
    assert(/1,61 kg/.test(s) && /Compragamer, SKU 83DK006HAR/.test(s) && /ninguna tienda conectada la informa/.test(s) && /317 × 222 × 17 mm/.test(s));
    assert(!/\bWh\b.*\d+ ?Wh/.test(s), "no inventa una capacidad");
  });
  await t("notebook con contradicción de CPU: lo avisa; sin ficha: explica por qué falta", async () => {
    assert(/7535HS/.test(txt(await A.ask("peso y batería de la notebook Acer Nitro V 15", {}))));
    const s = txt(await A.ask("peso de la notebook Lenovo LOQ 15IAX9E", {})); assert(/no publicó una ficha técnica/.test(s) && !/\d kg/.test(s));
  });
  await t("contexto: usa el producto seleccionado en la página", async () => {
    const s = txt(await A.ask("¿cuánto pesa?", { section: "comparar", ids: ["ec0ca5a4de"] })); assert(/1,61 kg/.test(s));
    assert(/De qué notebook/.test(txt(await A.ask("¿cuánto pesa la notebook?", { section: "precios" }))));
  });
  await t("comparador: resume diferencias, conclusión por uso y datos faltantes con los productos elegidos", async () => {
    const ids = [PR.find(g => /RTX 5070 TI Ventus/i.test(g.name)).id, PR.find(g => /RX 9070 XT/i.test(g.name)).id];
    const r = await A.ask("resumime las diferencias y cuál conviene", { section: "comparar", ids, res: 1 }); const s = txt(r);
    assert(/Diferencias principales/.test(s) && /conviene según/.test(s) && r.basis === "app");
    assert(/al menos dos productos/.test(txt(await A.ask("resumime las diferencias", { section: "comparar", ids: [ids[0]] }))));
  });
  await t("el contexto de cada sección cambia la respuesta", async () => {
    const arm = txt(await A.ask("¿qué fuente necesito?", { section: "armado", gpuId: "rtx-5070ti", res: 1 })); assert(/Placa elegida/.test(arm) && /Total estimado/.test(arm));
    assert(/Elegí una placa/.test(txt(await A.ask("¿qué fuente necesito?", { section: "armado" }))));
    assert(/Respuestas|Usos/.test(txt(await A.ask("por qué me recomendó eso", { section: "encontra", answers: { usos: ["oficina"], budget: 900000 } }))));
    assert.notDeepStrictEqual(A.suggestions({ section: "comparar" }), A.suggestions({ section: "armado" }));
    assert(A.suggestions({ section: "precios", ids: ["ec0ca5a4de"] })[0].includes("pesa"));
  });
  await t("pedido vago: pregunta antes de recomendar; luego recomienda solo productos del catálogo", async () => {
    const B = mk(); const urls = new Set(PR.flatMap(g => g.offers.map(o => o.url)));
    let r = await B.ask("quiero jugar", { section: "encontra" }); assert(/qué juegos/.test(txt(r)) && r.follow.length);
    r = await B.ask("Valorant y Fortnite", {}); assert(/presupuesto/.test(txt(r)));
    r = await B.ask("tengo 1.800.000 pesos", {}); const low = txt(r); assert(/No encontré opciones/.test(low) && /\$2\.030\.000/.test(low), "presupuesto insuficiente: lo dice y da el mínimo real: " + low);   // armado RTX 5060 Ti + Ryzen 5 9600X + disipador + gabinete (act. 24: procesador que cumpla el puntaje; act. 26: se suman disipador y gabinete)
    const B2 = mk(); await B2.ask("quiero jugar", {}); await B2.ask("Valorant y Fortnite", {}); r = await B2.ask("presupuesto 3 millones", {}); const s = txt(r); assert(/opciones/.test(s) && /\$/.test(s), s);
    const prices = [...s.matchAll(/\$([\d.]+)/g)].map(m => +m[1].replace(/\./g, "")); assert(prices.length && prices.every(p => p <= 3000000), "respeta el presupuesto: " + prices);
    assert(r.links[0].href === "encontra.html");
    const C2 = mk(); await C2.ask("quiero una notebook para estudiar", {}); r = await C2.ask("no sé", {}); assert(/opciones|encontré/.test(txt(r)));
  });
  await t("compatibilidad: guía general sin afirmar modelos concretos", async () => {
    const r = await A.ask("¿un Ryzen 5 5600 va con una B650?", {}); assert(r.basis === "gen" && /socket/i.test(txt(r)) && /confirmá/.test(txt(r)));
  });
  await t("sin IA configurada: lo dice; con IA simulada: etiqueta la respuesta y envía solo lo mínimo", async () => {
    assert.strictEqual(A.endpoint, null);
    let sent = null;
    const B = mk({ assistant: { endpoint: "https://proxy.invalid/ask" } }, { fetch: async (u, o) => { sent = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ answer: "Respuesta de prueba.\n\nSegundo párrafo." }) }; } });
    const r = await B.ask("contame una anécdota sobre la historia de los procesadores", { section: "precios", ids: ["ec0ca5a4de"] });
    assert.strictEqual(r.src, "ai"); assert.strictEqual(r.basis, "ai"); assert.strictEqual(r.blocks.length, 2);
    assert(sent && sent.q && Array.isArray(sent.context) && !JSON.stringify(sent).match(/localStorage|cookie|email|@/i), JSON.stringify(sent));
    assert(sent.context.length <= 12);
    const C3 = mk({ assistant: { endpoint: "https://proxy.invalid/ask" } }, { fetch: async () => ({ ok: false, status: 429, json: async () => ({}) }) });
    assert(/límite/.test(txt(await C3.ask("contame algo sin relación con el catálogo", {}))));
    const D = mk({ assistant: { endpoint: "https://proxy.invalid/ask" } }, { fetch: async () => { throw new Error("red caída"); } });
    const e = await D.ask("pregunta rara sin relación alguna", {}); assert.strictEqual(e.src, "error"); assert(/No pude conectar/.test(txt(e)));
    const L = await B.ask("¿cuánto sale la RTX 5060 Ti 16GB?", {}); assert.strictEqual(L.src, "local", "los datos del catálogo no se delegan a la IA");
  });
  await t("sin specs.json el asistente igual responde", async () => {
    const X = CT.makeAssistant({ HW, PR: PR0, META, SPECS: null, STORES: null, CFG: {} }, {});
    assert(/no publicó una ficha/.test(txt(await X.ask("peso de la notebook Lenovo Yoga 7", {}))));
    assert(/No tengo información/.test(txt(await X.ask("¿Es confiable GoldenTech?", {}))) || /no tiene|no tengo/i.test(txt(await X.ask("¿Es confiable GoldenTech?", {}))));
  });
  await t("antigüedad: avisa si los datos están viejos", async () => {
    const old = CT.makeAssistant({ HW, PR, META: { updated: new Date(Date.now() - 80 * 36e5).toISOString() }, SPECS, STORES, CFG: {} }, {});
    assert(/más de un día/.test(txt(await old.ask("¿están actualizados los precios?", {}))));
    assert(/hace 3 h/.test(txt(await A.ask("¿cuándo se actualizaron los precios?", {}))));
  });
  /* ---- actualización 49: más preguntas con datos reales ---- */
  await t("act. 49: lo más barato por categoría, con tope, sin usados ni accesorios", async () => {
    const P2 = JSON.parse(JSON.stringify(PR));
    const cpu = P2.find(g => g.category === "procesadores");
    P2.push({ id: "acc1", name: "Grasa Siliconada Pastermax Para CPU", category: "procesadores", offers: [{ store: "Nickhard", price_cash: 1000, stock: true, url: "u", k: "acc1" }] });
    P2.push({ id: "out1", name: "Procesador AMD Ryzen 5 5500 AM4 (OUTLET)", category: "procesadores", offers: [{ store: "Quantum Hardstore", price_cash: 2000, stock: true, url: "u", k: "out1" }] });
    const X = CT.makeAssistant({ HW, PR: P2, META, SPECS, STORES, CFG: {} }, {});
    const r = await X.ask("procesador más barato", {}), s = txt(r);
    assert(/Lo más barato en procesadores/.test(s) && !/Grasa/.test(s) && !/OUTLET/.test(s) && r.basis === "cat", s);
    const precios = P2.filter(g => g.category === "procesadores" && !/grasa|outlet/i.test(g.name)).map(g => X.C.bestOffer(g)).filter(o => o && CT.price(o) && o.stock !== false).map(CT.price).sort((a, b) => a - b);
    assert(s.includes(CT.ARS(precios[0])), "el primero es el más barato real");
    const tope = txt(await X.ask("procesador más barato hasta 50 mil", {}));
    assert(/hasta \$50\.000/.test(tope), "«50 mil» son 50.000, no 50 millones: " + tope);
    assert(/OUTLET/.test(txt(await X.ask("procesador outlet más barato", {}))), "si pide usados, se incluyen");
    assert(/No encontré/.test(txt(await X.ask("monitor más barato hasta 1000 pesos", {}))));
  });
  await t("act. 49: «A vs B» busca los dos, da la diferencia y enlaza al comparador", async () => {
    const r = await A.ask("Ryzen 5 7600 vs Core i5 14400F", {}), s = txt(r);
    assert(/Ryzen 5 7600/.test(s) && /14400F/.test(s) && /comparar\.html#cat=procesadores&ids=/.test(r.links[0].href), s);
    assert(!(await A.ask("Ryzen 5 7600 vs RTX 9999 Quantum", {})).links.some(l => /comparar/.test(l.href || "")), "si no encuentra uno, no inventa la comparación");
  });
  await t("act. 49: cuotas por producto, primero las sin interés", async () => {
    const P2 = JSON.parse(JSON.stringify(PR)), g = P2.find(x => /RTX 5060 Ti 16GB/i.test(x.name));
    g.offers[0].cuotas = "6 cuotas de $ 200.000"; if (g.offers[1]) g.offers[1].cuotas = "12 cuotas sin interés de $ 90.000"; else g.offers.push(Object.assign({}, g.offers[0], { store: "Otra", cuotas: "12 cuotas sin interés de $ 90.000" }));
    const X = CT.makeAssistant({ HW, PR: P2, META, SPECS, STORES, CFG: {} }, {});
    const s = txt(await X.ask("¿tiene cuotas sin interés la RTX 5060 Ti 16GB?", {}));
    assert(s.indexOf("12 cuotas sin interés") >= 0 && s.indexOf("12 cuotas sin interés") < s.indexOf("6 cuotas"), s);
    assert(/no informa cuotas|Ninguna tienda/.test(txt(await A.ask("cuotas del Ryzen 5 7600", {}))));
  });
  await t("act. 49: historial de precio (mejor precio por día), sin predicciones; se carga solo si se pregunta", async () => {
    const g = PR.find(x => /Ryzen 5 7600/.test(x.name)), k = g.offers[0].k, k2 = (g.offers[1] || {}).k;
    const H = { [k]: [["2026-11-01", 300000], ["2026-11-10", 280000], ["2026-11-20", 290000]] };
    if (k2) H[k2] = [["2026-11-10", 999999]];
    let cargado = 0;
    const X = CT.makeAssistant({ HW, PR, META, SPECS, STORES, CFG: {} }, { loadHistory: async () => { cargado++; return H; } });
    await X.ask("placa de video más barata", {}); assert.strictEqual(cargado, 0, "no baja el historial si no hace falta");
    const s = txt(await X.ask("¿bajó de precio?", { section: "precios", ids: [g.id] }));
    assert.strictEqual(cargado, 1);
    // act. 50: el precio de hoy es el de la ficha (mejor oferta actual), no el último cambio registrado
    assert(/01\/11\/2026/.test(s) && /hasta hoy/.test(s) && /Mínimo registrado/.test(s) && /No predecimos/.test(s), s);
    assert(/no tengo suficientes registros/.test(txt(await X.ask("historial de precio del Ryzen 5 5500", {}))));
  });
  await t("act. 49: sugerencias según la página", async () => {
    const g = PR.find(x => x.category === "procesadores");
    assert(A.suggestions({ section: "precios", ids: [g.id] }).includes("¿Bajó de precio?"));
    assert(A.suggestions({ section: "inicio" }).some(x => /más barata/.test(x)));
  });
  /* ---- actualización 50: correcciones de los jueces ---- */
  await t("act. 50: historial con el último precio conocido de cada tienda (antes daba «subió» cuando había bajado)", async () => {
    const P2 = JSON.parse(JSON.stringify(PR)), g = P2.find(x => /Ryzen 5 7600/.test(x.name));
    g.offers = [{ store: "Compragamer", price_cash: 310000, stock: true, url: "u1", k: "k1" }, { store: "Gezatek", price_cash: 280000, stock: true, url: "u2", k: "k2" }];
    const H = { k1: [["2026-11-01", 300000], ["2026-11-20", 310000]], k2: [["2026-11-05", 280000]] };
    const X = CT.makeAssistant({ HW, PR: P2, META: { updated: "2026-11-27T19:00+00:00" }, SPECS, STORES, CFG: {} }, { loadHistory: async () => H });
    const s = txt(await X.ask("¿bajó de precio?", { section: "precios", ids: [g.id] }));
    assert(/hasta hoy \(\$280\.000\) bajó un 7%/.test(s) && /Hoy está en el precio más bajo/.test(s) && !/subió/.test(s), s);
  });
  await t("act. 50: mejor oferta = stock confirmado antes que «sin confirmar», aunque sea más cara", async () => {
    const C2 = CT.create(HW, PR, META);
    const g = { offers: [{ store: "XT-PC", price_cash: 100, stock: null }, { store: "Compragamer", price_cash: 120, stock: true }, { store: "Otra", price_cash: 90, stock: false }] };
    assert.strictEqual(C2.bestOffer(g).store, "Compragamer");
    assert.strictEqual(C2.bestOffer({ offers: [{ store: "XT-PC", price_cash: 100, stock: null }] }).store, "XT-PC", "si no hay otra, se usa la sin confirmar");
    const C3 = CT.create(HW, PR, { stores: { Fullh4rd: { ok: false } } });
    assert.strictEqual(C3.bestOffer({ offers: [{ store: "Fullh4rd", price_cash: 90, stock: true }, { store: "Gezatek", price_cash: 95, stock: true }] }).store, "Gezatek", "tienda que no responde va después");
  });
  await t("act. 50: placa de video según presupuesto responde con placas (no con una PC entera)", async () => {
    const s = txt(await A.ask("qué placa de video me conviene para jugar en 1080p con 5 millones", {}));
    assert(/placas de video más rápidas en 1080p que entran en \$5\.000\.000/.test(s) && !/PC armada/i.test(s), s);
  });
  await t("act. 50: «¿es compatible con DDR4?» y «¿trae cooler?» sobre el producto abierto", async () => {
    const g = PR.find(x => /Ryzen 5 7600/.test(x.name) && x.category === "procesadores");
    const s = txt(await A.ask("¿es compatible con DDR4?", { section: "precios", ids: [g.id] }));
    assert(/No: según el fabricante/.test(s) && /DDR5/.test(s), s);
    const c = txt(await A.ask("¿tiene cooler?", { section: "precios", ids: [g.id] }));
    assert(/título de la tienda/.test(c) && !/Cable/.test(c), c);
  });
  await t("act. 50: «A vs B» con chips conocidos compara piezas de la misma categoría", async () => {
    const r = await A.ask("Ryzen 5 7600 vs Ryzen 7 7800X3D", {});
    assert(/comparar\.html#cat=procesadores/.test((r.links[0] || {}).href || ""), txt(r));
  });
  console.log(n + " pruebas del asistente OK");
})();
