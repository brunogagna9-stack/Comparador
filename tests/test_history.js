// «Mi historial» (actualización 31): se guarda en el navegador, se actualiza sin duplicar y se borra. node tests/test_history.js
const assert = require("assert");
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
global.localStorage = mem(); global.sessionStorage = mem();
const H = require("../site/js/history.js");
let n = 0;
const t = (name, fn) => { try { localStorage.clear(); sessionStorage.clear(); fn(); n++; } catch (e) { console.error("FALLÓ:", name, "\n ", e.stack); process.exitCode = 1; } };

t("guarda y lista lo más reciente primero", () => {
  H.save("armados", { title: "A", url: "armado.html?id=a" });
  H.save("armados", { title: "B", url: "armado.html?id=b" });
  assert.deepStrictEqual(H.list("armados").map(e => e.title), ["B", "A"]);
  assert(H.list("armados").every(e => e.id && !isNaN(new Date(e.t))));
});
t("lo mismo dos veces no se duplica (misma dirección)", () => {
  H.save("armados", { title: "A", url: "armado.html?id=a" });
  H.save("armados", { title: "A otra vez", url: "armado.html?id=a" });
  assert.strictEqual(H.list("armados").length, 1); assert.strictEqual(H.list("armados")[0].title, "A otra vez");
});
t("mientras se edita en la misma visita se actualiza la misma entrada", () => {
  H.save("armados", { title: "1 pieza", url: "armar.html?b=cpu=x" }, "armar");
  H.save("armados", { title: "2 piezas", url: "armar.html?b=cpu=x;gpu=y" }, "armar");
  H.save("comparaciones", { title: "C1", url: "comparar.html#cat=procesadores&ids=a,b" }, "cmp:procesadores");
  H.save("comparaciones", { title: "G1", url: "comparar.html#cat=placas-de-video&ids=c,d" }, "cmp:placas-de-video");
  assert.strictEqual(H.list("armados").length, 1); assert.strictEqual(H.list("armados")[0].title, "2 piezas");
  assert.strictEqual(H.list("comparaciones").length, 2, "cada tipo de producto es su propia comparación");
});
t("eliminar uno y eliminar todo", () => {
  const a = H.save("comparaciones", { title: "A", url: "comparar.html#a" }), b = H.save("comparaciones", { title: "B", url: "comparar.html#b" });
  H.remove("comparaciones", a); assert.deepStrictEqual(H.list("comparaciones").map(e => e.id), [b]);
  H.save("armados", { title: "X", url: "armado.html?x" }); H.clear("comparaciones");
  assert.strictEqual(H.list("comparaciones").length, 0); assert.strictEqual(H.list("armados").length, 1, "borrar comparaciones no toca armados");
});
t("si se borró la entrada que se estaba editando, se empieza otra", () => {
  const id = H.save("armados", { title: "1", url: "armar.html?b=1" }, "armar"); H.remove("armados", id);
  const id2 = H.save("armados", { title: "2", url: "armar.html?b=2" }, "armar");
  assert.notStrictEqual(id, id2); assert.strictEqual(H.list("armados").length, 1);
});
t("tope de 50 por tipo y tipos desconocidos se ignoran", () => {
  for (let i = 0; i < 60; i++) H.save("armados", { title: "A" + i, url: "armado.html?i=" + i });
  assert.strictEqual(H.list("armados").length, 50); assert.strictEqual(H.list("armados")[0].title, "A59");
  assert.strictEqual(H.save("otra", { title: "x", url: "y" }), null);
});
t("almacenamiento dañado o bloqueado: no rompe", () => {
  localStorage.setItem("historial", "{roto"); assert.deepStrictEqual(H.list("armados"), []);
  const real = global.localStorage; global.localStorage = { getItem() { throw new Error("bloqueado"); }, setItem() { throw new Error("bloqueado"); } };
  try { assert.deepStrictEqual(H.list("armados"), []); H.save("armados", { title: "x", url: "y" }); } finally { global.localStorage = real; }
});
console.log(`historial: ${n} pruebas OK`);
