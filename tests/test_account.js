// Cuentas (actualización 32): configuración, sincronización en tres partes y conversión de filas. node tests/test_account.js
const assert = require("assert");
const A = require("../site/js/account.js");
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FALLÓ:", name, "\n ", e.stack); process.exitCode = 1; } };
const jwt = role => "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".firma";

t("apagado sin configuración", () => {
  assert.strictEqual(A.validCfg(null).why, "off");
  assert.strictEqual(A.validCfg({ supabase_url: null, supabase_publishable_key: null }).why, "off");
});
t("acepta la clave publishable y una dirección de Supabase", () => {
  const v = A.validCfg({ supabase_url: "https://abcdefghijklmnop.supabase.co/", supabase_publishable_key: "sb_publishable_AbC123xyz_456789" });
  assert(v.ok); assert.strictEqual(v.url, "https://abcdefghijklmnop.supabase.co");
  assert(A.validCfg({ supabase_url: "https://abcdefghijklmnop.supabase.co", supabase_publishable_key: jwt("anon") }).ok);
});
t("se NIEGA a usar una clave secreta (nueva o vieja)", () => {
  assert.strictEqual(A.validCfg({ supabase_url: "https://abcdefghijklmnop.supabase.co", supabase_publishable_key: "sb_secret_AbC123xyz_456789" }).why, "secret");
  assert.strictEqual(A.validCfg({ supabase_url: "https://abcdefghijklmnop.supabase.co", supabase_publishable_key: jwt("service_role") }).why, "secret");
});
t("rechaza direcciones que no son de Supabase o claves raras", () => {
  assert.strictEqual(A.validCfg({ supabase_url: "http://abcdefghijklmnop.supabase.co", supabase_publishable_key: "sb_publishable_AbC123xyz_456789" }).why, "url");
  assert.strictEqual(A.validCfg({ supabase_url: "https://evil.example.com", supabase_publishable_key: "sb_publishable_AbC123xyz_456789" }).why, "url");
  assert.strictEqual(A.validCfg({ supabase_url: "https://abcdefghijklmnop.supabase.co", supabase_publishable_key: "hola" }).why, "key");
});
t("primera vez (sin base): se juntan las dos cosas y no se borra nada", () => {
  const m = A.merge3(null, { a: 1, b: 2 }, { b: 2, c: 3 });
  assert.deepStrictEqual(Object.keys(m.out).sort(), ["a", "b", "c"]); assert.deepStrictEqual(m.up, ["a"]); assert.deepStrictEqual(m.del, []);
});
t("borrado acá → se borra de la cuenta; borrado en otro dispositivo → se quita acá", () => {
  const m = A.merge3(["a", "b", "c"], { a: 1, b: 2 }, { a: 1, c: 3 });   // b se borró en otro lado, c se borró acá
  assert.deepStrictEqual(Object.keys(m.out), ["a"]); assert.deepStrictEqual(m.del, ["c"]); assert.deepStrictEqual(m.up, []);
});
t("nuevo en otro dispositivo → se baja; nuevo acá → se sube", () => {
  const m = A.merge3(["a"], { a: 1, x: 9 }, { a: 1, y: 8 });
  assert.deepStrictEqual(Object.keys(m.out).sort(), ["a", "x", "y"]); assert.deepStrictEqual(m.up, ["x"]); assert.deepStrictEqual(m.del, []);
});
t("historial: gana la entrada más reciente", () => {
  const l = { h: { id: "h", t: "2026-11-02T10:00:00Z", title: "local" } }, r = { h: { id: "h", t: "2026-11-02T12:00:00Z", title: "cuenta" } };
  assert.strictEqual(A.merge3(["h"], l, r, A.newerHist).out.h.title, "cuenta");
  const m = A.merge3(["h"], r, l, A.newerHist); assert.strictEqual(m.out.h.title, "cuenta"); assert.deepStrictEqual(m.up, ["h"]);
});
t("filas ↔ datos del navegador", () => {
  const row = A.followToRow("u1", "p1", { price: 123456, name: "RTX 5060" });
  assert.deepStrictEqual(row, { user_id: "u1", product_id: "p1", name: "RTX 5060", price_ref: 123456, last_price: 123456 });
  assert.deepStrictEqual(A.rowToFollow(row), { price: 123456, name: "RTX 5060" });
  const e = { id: "x1", t: "2026-11-02T10:00:00.000Z", title: "Armado", sub: "1080p", url: "armado.html?modo=gpu&id=g1", cat: "_armado" };
  assert.deepStrictEqual(A.rowToHist(A.histToRow("u1", "armados", e)), e);
});
t("solo se aceptan direcciones del propio sitio en el historial de la cuenta", () => {
  assert(A.safeUrl("comparar.html#cat=procesadores&ids=a,b")); assert(A.safeUrl("armar.html?b=cpu%3Dc1"));
  assert(!A.safeUrl("https://evil.example.com/")); assert(!A.safeUrl("javascript:alert(1)")); assert(!A.safeUrl("//evil.com/x.html"));
});
console.log(`cuentas: ${n} pruebas OK`);
