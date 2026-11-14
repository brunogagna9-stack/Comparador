/* KyraNoHard · service worker (actualización 39): permite instalar el sitio como app y abrirlo sin conexión.
   Reglas, pensadas para que NUNCA se muestren precios ni código viejos cuando hay internet:
   - Páginas, JavaScript, CSS y datos (precios): primero la red; lo guardado solo se usa si no hay conexión.
   - Tipografía, logo e íconos (no cambian): se sirven desde lo guardado.
   - Nada de otros sitios (fotos de las tiendas, cuentas de Supabase) pasa por acá. */
"use strict";
const VER = "kyra-v2";
const STATIC = ["fonts/inter-latin.woff2", "img/logo.svg", "img/icon-192.png", "favicon.ico"];
const OFFLINE_SHELL = ["./", "index.html", "productos.html", "css/layout.css", "css/shared.css", "js/layout.js", "js/icons.js", "manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(STATIC.concat(OFFLINE_SHELL)).catch(() => null)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const isStatic = p => /\/(fonts|img)\/|favicon\.ico$/.test(p);

async function networkFirst(req) {
  const c = await caches.open(VER);
  try {
    const r = await fetch(req);
    if (r.ok && r.type === "basic") c.put(req, r.clone()).catch(() => null);
    return r;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: req.mode === "navigate" });
    if (hit) return hit;
    if (req.mode === "navigate") { const home = await c.match("index.html"); if (home) return home; }
    throw err;
  }
}
async function cacheFirst(req) {
  const c = await caches.open(VER), hit = await c.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) c.put(req, r.clone()).catch(() => null);
  return r;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return;          // fotos de tiendas, Supabase, etc.: directo, sin tocar
  e.respondWith(isStatic(u.pathname) ? cacheFirst(req) : networkFirst(req));
});
