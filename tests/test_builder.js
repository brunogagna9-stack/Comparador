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
console.log(`armado pieza por pieza: ${n} pruebas OK`);
