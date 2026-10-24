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
    const g = txt(await A.ask("¿Es confiable GoldenTech?", {})); assert(/4,9 sobre 5/.test(g) && /677/.test(g) && /Google Maps/.test(g) && /2026-10-23/.test(g));
    const m = txt(await A.ask("¿Y la reputación de Hardloots?", {})); assert(/No tenemos una puntuación pública verificada/.test(m) && !/\d,\d sobre 5/.test(m));
    const mx = txt(await A.ask("¿Y la reputación de Maximus?", {})); assert(/4,8 sobre 5/.test(mx) && /14\.557/.test(mx));
    const bh = txt(await A.ask("¿Es confiable BitHard?", {})); assert(/5,0 sobre 5/.test(bh) && /pocas opiniones/i.test(bh));
    const a = txt(await A.ask("army tech es confiable?", {})); assert(/4,4 sobre 5/.test(a) && /877/.test(a));
    const all = txt(await A.ask("qué tiendas están conectadas", {})); assert(/GoldenTech/.test(all) && /Armytech/.test(all) && /Fullh4rd/.test(all) && /403/.test(all));
    assert(!/promedi(o|amos) de/.test(g));
  });
  await t("notebook con ficha: peso con fuente y SKU; batería declarada como no publicada", async () => {
    const s = txt(await A.ask("¿cuánto pesa y qué batería tiene la notebook Lenovo Yoga 7?", {}));
    assert(/1,61 kg/.test(s) && /Compragamer, SKU 83DK006HAR/.test(s) && /ninguna de las tiendas conectadas publica la capacidad/.test(s) && /317 × 222 × 17 mm/.test(s));
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
    r = await B.ask("tengo 1.800.000 pesos", {}); const low = txt(r); assert(/No encontré opciones/.test(low) && /\$2\.300\.000/.test(low), "presupuesto insuficiente: lo dice y da el mínimo real: " + low);
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
  console.log(n + " pruebas del asistente OK");
})();
