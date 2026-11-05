// «Armalo vos»: motor de compatibilidad pieza por pieza (actualización 28). Se ejecuta con: node tests/test_builder.js
const assert = require("assert");
const CT = require("../site/js/lib.js");
const BLD = require("../site/js/builder.js");
const HW = require("../site/data/hardware.json");
const VER = require("../site/data/verified.json");
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FALLÓ:", name, "\n ", e.stack); process.exitCode = 1; } };
const P = (id, name, category, price) => ({ id, name, category, offers: [{ store: "Tienda", price_cash: price || 100000, stock: true, url: "https://example.com/" + id }] });
const PR = [
  P("c1", "Procesador AMD Ryzen 5 7600X AM5", "procesadores"),
  P("c2", "Microprocesador Intel Core I5 13600K", "procesadores"),
  P("c3", "Procesador Intel Core Ultra 5 245K", "procesadores"),
  P("m1", "Mother Gigabyte B650M Gaming X AX", "motherboards"),
  P("m2", "Mother Asus Prime B550M-A", "motherboards"),
  P("m3", "Motherboard MSI MAG B650 Tomahawk WiFi", "motherboards"),
  P("m4", "Mother Asus ROG Strix B650E-I Gaming WiFi", "motherboards"),
  P("r1", "Memoria Kingston Fury Beast 16GB DDR5 5600", "memorias-ram"),
  P("r2", "Memoria Kingston Fury Beast 16GB DDR4 3200", "memorias-ram"),
  P("r3", "Memoria Sodimm Kingston 8GB DDR5 5600 Notebook", "memorias-ram"),
  P("k1", "Cooler CPU ID-Cooling FROZN A410 ARGB Black", "refrigeracion"),
  P("k2", "Cooler CPU Cooler Master Hyper 212 Black Edition", "refrigeracion"),
  P("k3", "Cooler CPU Marca Desconocida X100 120mm", "refrigeracion"),
  P("g1", "Placa de Video MSI RTX 5060 Ventus 2X OC 8GB", "placas-de-video"),
  P("g2", "Placa de Video MSI RTX 5070 Ti Gaming Trio OC 16GB", "placas-de-video"),
  P("g3", "Placa de Video Zotac RTX 5060 Twin Edge 8GB", "placas-de-video"),
  P("ca1", "Gabinete Corsair FRAME 4000D RS ARGB", "gabinetes"),
  P("ca2", "Gabinete Thermaltake The Tower 300 Mini-ITX", "gabinetes"),
  P("ca3", "Gabinete Generico X ATX Mid Tower", "gabinetes"),
  P("ca4", "Gabinete MSI MAG Forge M100A mATX", "gabinetes"),
  P("p1", "Fuente Corsair RM850e 850W 80 Plus Gold ATX 3.1", "fuentes"),
  P("p2", "Fuente Generica 450W", "fuentes"),
];
const C = CT.create(HW, PR, {});
const E = BLD.create(C, VER);
const byId = id => PR.find(g => g.id === id);
const A = (k, id) => E.attrs(k, byId(id));
const chk = (k, id, X) => E.check(k, A(k, id), X);

t("datos verificados: todos con enlace oficial y fecha, y las expresiones compilan", () => {
  for (const k of ["coolers", "cases", "gpus"]) for (const e of VER[k]) {
    assert(/^https:\/\//.test(e.src), k + " sin fuente: " + e.name); assert(e.d, k + " sin fecha: " + e.name);
    new RegExp(e.m, "i"); if (e.x) new RegExp(e.x, "i");
  }
  assert.strictEqual(VER.rules.gpu_any.len, 381);
});
t("procesador y motherboard: socket", () => {
  assert.strictEqual(chk("mobo", "m1", { cpu: A("cpu", "c1") }).s, "ok");
  const r = chk("mobo", "m2", { cpu: A("cpu", "c1") });
  assert.strictEqual(r.s, "no"); assert(/socket distinto/.test(r.res[0].txt));
});
t("tamaño de placa: letra del modelo (M, I) y convención de nombres (sin letra = ATX)", () => {
  assert.strictEqual(A("mobo", "m1").form.v, "Micro-ATX");
  assert.strictEqual(A("mobo", "m3").form.v, "ATX");
  assert.strictEqual(A("mobo", "m4").form.v, "Mini-ITX");
});
t("memoria: DDR y SO-DIMM", () => {
  const X = { cpu: A("cpu", "c1"), mobo: A("mobo", "m1") };
  assert.strictEqual(chk("ram", "r1", X).s, "ok");
  assert.strictEqual(chk("ram", "r2", X).s, "no");
  assert.strictEqual(chk("ram", "r3", X).s, "no");
});
t("cooler: socket según el fabricante, equivalencias oficiales AM5←AM4 y LGA1851←LGA1700", () => {
  assert.strictEqual(chk("cooler", "k1", { cpu: A("cpu", "c1") }).s, "ok");
  assert.strictEqual(chk("cooler", "k1", { cpu: A("cpu", "c3") }).s, "ok");
  const r = chk("cooler", "k2", { cpu: A("cpu", "c1") });      // Hyper 212 Black Edition: el fabricante lista LGA115x y AM4
  assert.strictEqual(r.s, "ok"); assert(/mismo montaje/.test(r.res[0].txt));
  assert.strictEqual(chk("cooler", "k2", { cpu: A("cpu", "c2") }).s, "no");
  assert.strictEqual(chk("cooler", "k3", { cpu: A("cpu", "c1") }).s, "unk");   // sin ficha: nunca se ofrece como compatible
});
t("gabinete: tamaños aceptados (ficha o norma), largo de placa de video y alto de cooler", () => {
  assert.strictEqual(chk("case", "ca1", { mobo: A("mobo", "m3") }).s, "ok");
  assert.strictEqual(chk("case", "ca4", { mobo: A("mobo", "m3") }).s, "no");
  assert.strictEqual(chk("case", "ca3", { mobo: A("mobo", "m1") }).s, "ok");          // por norma: ATX acepta Micro-ATX
  assert.strictEqual(chk("case", "ca3", { gpu: A("gpu", "g1") }).s, "unk");           // sin ficha no sabemos el largo máximo
  assert.strictEqual(chk("case", "ca1", { gpu: A("gpu", "g2") }).s, "ok");
  assert.strictEqual(chk("case", "ca4", { gpu: A("gpu", "g2") }).s, "no");            // 338 mm en un gabinete de 300 mm
  assert.strictEqual(chk("case", "ca1", { cooler: A("cooler", "k1") }).s, "ok");
});
t("regla del largo máximo: si el gabinete acepta 381 mm o más entra cualquier placa", () => {
  const gpu = A("gpu", "g3"); assert(!gpu.len, "la Twin Edge no está en la tabla");
  const big = { gpuMax: { v: 405, src: "fab" } }, small = { gpuMax: { v: 330, src: "fab" } };
  assert.strictEqual(E.check("case", big, { gpu }).s, "ok");
  assert.strictEqual(E.check("case", small, { gpu }).s, "unk");
});
t("fuente: potencia recomendada por el fabricante del chip", () => {
  const X = { cpu: A("cpu", "c1"), gpu: A("gpu", "g2") };
  assert.strictEqual(chk("psu", "p1", X).s, "ok");
  assert.strictEqual(chk("psu", "p2", X).s, "no");
  assert(E.psuNeed(X).w >= 700);
});
t("candidatos: compatibles, sin verificar e incompatibles van separados", () => {
  const R = E.candidates("cooler", { cpu: A("cpu", "c1") }, PR);
  assert(R.ok.some(r => r.g.id === "k1")); assert(R.unk.some(r => r.g.id === "k3")); assert(!R.ok.some(r => r.g.id === "k3"));
  const M = E.candidates("mobo", { cpu: A("cpu", "c1") }, PR);
  assert(!M.ok.some(r => r.g.id === "m2")); assert(M.no >= 1);
});
t("resumen: falta, sin video integrado, ya lo tengo y datos cargados", () => {
  let S = E.summary({ cpu: { id: "c2" }, mobo: { id: "m2" } }, byId);
  assert(S.issues.length); assert(S.missing.includes("ram"));
  S = E.summary({ cpu: { id: "c1" }, mobo: { own: true, id: "m1" }, gpu: { skip: true } }, byId);
  assert.strictEqual(S.total, 100000);                        // la placa que ya tiene no suma
  S = E.summary({ cpu: { id: "c1" }, case: { own: true, attrs: { forms: "Micro-ATX", gpuMax: "300" } }, mobo: { id: "m3" }, gpu: { id: "g2" } }, byId);
  assert(S.issues.some(c => /Micro-ATX/.test(c.txt))); assert(S.issues.some(c => /338/.test(c.txt)));
});
t("el armado se guarda en la dirección y se recupera igual", () => {
  const b = { cpu: { id: "c1" }, gpu: { skip: true }, cooler: { skip: "incl" }, case: { own: true, id: "ca1" }, psu: { own: true, attrs: { w: "650" } } };
  assert.deepStrictEqual(E.decode(E.encode(b)), b);
  assert.deepStrictEqual(E.decode("zzz=1;cpu="), {});
});
t("sin excepción: procesadores sin placas a la venta y memorias que no entran en ninguna PC actual", () => {
  const old = { id: "c9", name: "Procesador Intel Pentium G4560 LGA1151 Kaby Lake", category: "procesadores", offers: [{ store: "T", price_cash: 1, stock: true }] };
  const r = E.check("cpu", E.attrs("cpu", old), {});
  assert.strictEqual(r.s, "no"); assert(/ya no hay motherboards/.test(r.res[0].txt));
  assert.strictEqual(chk("cpu", "c1", {}).s, "ok");
  const ddr3 = { id: "r9", name: "Memoria Kingston 8GB DDR3 1600", category: "memorias-ram", offers: [] };
  assert.strictEqual(E.check("ram", E.attrs("ram", ddr3), {}).s, "no");
  const sodimm = { id: "r8", name: "Memoria Kingston 16GB DDR5 5600 Notebook", category: "memorias-ram", offers: [] };
  assert.strictEqual(E.check("ram", E.attrs("ram", sodimm), {}).s, "no");
  assert.strictEqual(chk("ram", "r1", {}).s, "ok");
});
t("marca para las pestañas y generación para «Recomendados»", () => {
  assert.strictEqual(E.brand("cpu", byId("c1")), "AMD"); assert.strictEqual(E.brand("cpu", byId("c3")), "Intel");
  assert.strictEqual(E.brand("mobo", byId("m3")), "AMD"); assert.strictEqual(E.brand("gpu", byId("g1")), "NVIDIA");
  assert(E.gen("cpu", A("cpu", "c1")) > E.gen("cpu", A("cpu", "c2")));      // AM5 antes que LGA1700
  const R = E.candidates("cpu", {}, PR); assert(R.ok.every(r => r.b && typeof r.n === "number" && typeof r.gen === "number"));
});
t("gráficos integrados según el modelo exacto del título (la ficha agrupa 12700 y 12700F)", () => {
  const c = (id, name) => E.attrs("cpu", { id, name, category: "procesadores", offers: [] });
  assert.strictEqual(c("x1", "Procesador Intel Core i7 12700F 4.9GHz Socket 1700").igpu.v, false);
  assert.strictEqual(c("x2", "Procesador Intel Core i7 12700 4.9GHz Socket 1700").igpu.v, true);
  assert.strictEqual(c("x3", "Procesador Intel Core I5 12400 12gen").igpu.v, true);
  assert.strictEqual(c("x4", "Procesador Intel Core i5 12400F").igpu.v, false);
  assert.strictEqual(c("x5", "Procesador Intel Core Ultra 5 245KF").igpu.v, false);
  // sin placa de video, un procesador F no puede quedar como armado válido
  const b = { id: "x1", name: "Procesador Intel Core i7 12700F Socket 1700", category: "procesadores", offers: [{ store: "T", price_cash: 1, stock: true }] };
  const S = E.summary({ cpu: { id: "x1" }, gpu: { skip: true } }, id => id === "x1" ? b : null);
  assert(S.issues.some(i => /gráficos integrados/.test(i.txt)));
});
t("placas de video: la ficha de un modelo no se aplica a sus variantes MAX o PLUS (otro largo)", () => {
  assert(E.verGpu("Placa de Video Gigabyte RTX 5060 Ti Eagle OC 8GB", "rtx-5060ti-8"));
  const mx = E.verGpu("Placa De Video Gigabyte Rtx 5060ti Eagle Max Oc 8 Gb Gddr7", "rtx-5060ti-8");
  assert(mx && mx.len === 281, "la EAGLE MAX mide 281 mm (ficha propia), no los 215 mm de la EAGLE OC");
  assert.strictEqual(E.verGpu("Placa de Video Gigabyte RTX 5060 Ti Eagle OC 8GB", "rtx-5060ti-8").len, 215);
});
t("almacenamiento: nada externo, carcasas ni adaptadores", () => {
  const s = name => E.isSlotProduct("ssd", { id: "s", name, category: "almacenamiento", offers: [] });
  assert(s("Disco SSD Kingston NV3 1TB M.2 NVMe PCIe 4.0"));
  ["Disco Ssd Ext 1Tb Kingston Xs1000R Usb 3.2", "Carry Disk SSD M.2 Hiksemi MDR1 RGB (Usb 3.2)", "SSD M.2 ADAPTADOR EXTENSION UNIVERSAL", "Disco SSD SANDISK 2TB Portable USB-C"].forEach(n => assert(!s(n), n));
});
t("fuentes con dos potencias en el título: se toma la menor", () => {
  assert.strictEqual(CT.parse("FUENTE 600W LNZ NP600-LX (SIMIL 500W-550W) (OEM)", "fuentes").w, 500);
  assert.strictEqual(CT.parse("Fuente Corsair RM850e 850W 80 Plus Gold", "fuentes").w, 850);
});
t("armado recomendado: coolers y gabinetes con ficha verificada primero; los demás dicen qué confirmar", () => {
  const P2 = [P("ck1", "Cooler CPU Marca Desconocida X100 Tower 4 heatpipe 150W", "refrigeracion", 20000), P("ck2", "Cooler CPU ID-Cooling FROZN A410 SE ARGB 180W", "refrigeracion", 40000),
    P("cs1", "Gabinete Generico X ATX Mid Tower", "gabinetes", 30000), P("cs2", "Gabinete Corsair FRAME 4000D RS ARGB", "gabinetes", 90000), P("cs3", "Gabinete MSI MAG Forge M100A mATX", "gabinetes", 50000)];
  const C2 = CT.create(HW, P2, {}, null, VER);
  const cpu = HW.cpus.find(c => c.socket === "AM5" && (c.maxp || 0) < 120);
  const k = C2.findCooler(cpu);
  assert.strictEqual(k[0].g.id, "ck2"); assert(k[0].ver && /verificado/.test(k[0].note));
  assert(k.some(x => x.g.id === "ck1" && /confirmá/.test(x.note)));
  const g = C2.findCase("Mother Gigabyte B650 Eagle AX ATX", "Placa de Video MSI RTX 5070 Ti Gaming Trio OC 16GB", "rtx-5070ti");
  assert.strictEqual(g[0].g.id, "cs2"); assert(/338 mm/.test(g[0].note));
  assert(!g.some(x => x.g.id === "cs3"));                          // Micro-ATX y 300 mm: no entra
  assert(g.some(x => x.g.id === "cs1" && /confirmá/.test(x.note)));
});
t("procesadores cuyo título menciona el cooler siguen teniendo ficha; los disipadores no", () => {
  assert.strictEqual(C.hwCpu("Procesador AMD Ryzen 5 5600GT 6 Núcleos 4.6GHz AM4 Radeon Vega 7 Cooler").name, "Ryzen 5 5600GT");
  assert(C.hwCpu("Procesador Intel Core I9-12900k 16 Nucleos Lga1700 S-coolers Y S-video"));
  assert.strictEqual(C.hwCpu("Cooler para procesador Intel Core i5 12400"), null);
});
console.log(`armado pieza por pieza: ${n} pruebas OK`);
