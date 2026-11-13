/* KyraNoHard · cuentas de usuario con Supabase (actualización 32).
   APAGADO mientras data/config.json no tenga "accounts" completo: sin eso no se carga nada y el sitio funciona igual que antes.
   Con cuenta, lo que ya se guarda en el navegador («seg» = productos seguidos, «historial» = armados y comparaciones)
   se copia a la cuenta y vuelve a cualquier dispositivo donde la persona inicie sesión.

   Sincronización en tres partes (base = lo que había la última vez que se sincronizó en este navegador):
     - está acá y no en la cuenta: si estaba en la base, se borró en otro dispositivo → se quita acá; si no, es nuevo → se sube.
     - está en la cuenta y no acá: si estaba en la base, se borró acá → se borra de la cuenta; si no, es nuevo → se baja.
   La primera vez (sin base) se juntan las dos cosas y no se borra nada.

   Seguridad: la web solo usa la clave «publishable» (pública por diseño; las reglas RLS de data_src/supabase.sql impiden ver
   datos ajenos). Si alguien pega por error una clave «secret» en config.json, este archivo se NIEGA a usarla. */
(function (root) {
  "use strict";
  const A = {}, SB_JS = "js/vendor/supabase-2.117.3.js";
  const KINDS = ["armados", "comparaciones"];

  /* ---------- funciones puras (se prueban en tests/test_account.js) ---------- */
  A.validCfg = acc => {
    if (!acc || typeof acc !== "object") return { ok: false, why: "off" };
    let url = typeof acc.supabase_url === "string" ? acc.supabase_url.trim().replace(/\/+$/, "") : "";
    const key = typeof acc.supabase_publishable_key === "string" ? acc.supabase_publishable_key.trim() : "";
    if (!url && !key) return { ok: false, why: "off" };
    if (/^sb_secret_/.test(key) || /service_role/.test(A.jwtRole(key) || "")) return { ok: false, why: "secret" };
    if (!/^https:\/\/[a-z0-9-]{6,63}\.supabase\.co$/.test(url)) return { ok: false, why: "url" };
    const legacyAnon = /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(key) && A.jwtRole(key) === "anon";
    if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key) && !legacyAnon) return { ok: false, why: "key" };
    return { ok: true, url, key };
  };
  A.jwtRole = k => { try { if (!/^eyJ/.test(k)) return null; const p = k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const s = typeof atob === "function" ? atob(p) : Buffer.from(p, "base64").toString(); return JSON.parse(s).role || null; } catch (e) { return null; } };

  /* merge3(base, local, remote, newer?) → { out, up: [ids a subir], del: [ids a borrar de la cuenta] }
     local y remote: objetos {id: valor}. base: lista de ids o null (primera vez). */
  A.merge3 = (base, local, remote, newer) => {
    const B = base ? new Set(base) : null, out = {}, up = [], del = [];
    for (const id of Object.keys(local)) {
      if (id in remote) { const pick = newer ? newer(local[id], remote[id]) : "local"; out[id] = pick === "remote" ? remote[id] : local[id]; if (pick === "local-up") up.push(id); }
      else if (B && B.has(id)) { /* se borró en otro dispositivo */ }
      else { out[id] = local[id]; up.push(id); }
    }
    for (const id of Object.keys(remote)) {
      if (id in local) continue;
      if (B && B.has(id)) del.push(id); else out[id] = remote[id];
    }
    return { out, up, del };
  };
  // historial: gana la entrada más reciente; si la local es más nueva se vuelve a subir
  A.newerHist = (l, r) => { const tl = Date.parse(l.t) || 0, tr = Date.parse(r.t) || 0; return tr > tl ? "remote" : tl > tr ? "local-up" : "local"; };

  A.followToRow = (uid, id, f) => ({ user_id: uid, product_id: String(id).slice(0, 200), name: f && f.name ? String(f.name).slice(0, 300) : null,
    price_ref: f && isFinite(f.price) ? +f.price : null, last_price: f && isFinite(f.price) ? +f.price : null });
  A.rowToFollow = r => ({ price: r.price_ref != null ? +r.price_ref : null, name: r.name || "" });
  A.histToRow = (uid, kind, e) => ({ user_id: uid, id: String(e.id).slice(0, 60), kind, title: String(e.title || "").slice(0, 300), sub: e.sub ? String(e.sub).slice(0, 300) : null,
    url: String(e.url).slice(0, 2000), cat: e.cat ? String(e.cat).slice(0, 60) : null, t: e.t || new Date().toISOString() });
  A.rowToHist = r => { const e = { id: r.id, t: r.t, title: r.title || "", url: r.url }; if (r.sub) e.sub = r.sub; if (r.cat) e.cat = r.cat; return e; };
  // solo direcciones del propio sitio (evita que una fila manipulada lleve a otro lado)
  A.safeUrl = u => typeof u === "string" && /^[a-z0-9_-]+\.html(?:[?#][^\s"'<>]*)?$/i.test(u);

  /* ---------- navegador ---------- */
  if (typeof module !== "undefined" && module.exports) { module.exports = A; return; }
  if (root.ACC) return;              // ya cargado (cuenta.html lo incluye y layout.js también puede inyectarlo)
  root.ACC = A;
  A.initialHash = location.hash;     // se guarda antes de que la librería limpie la dirección (enlaces de confirmación o recuperación)

  const ls = root.localStorage, rawSet = Storage.prototype.setItem, rawDel = Storage.prototype.removeItem;
  const get = (k, d) => { try { const v = JSON.parse(ls.getItem(k) || "null"); return v ?? d; } catch (e) { return d; } };
  const put = (k, v) => { try { rawSet.call(ls, k, JSON.stringify(v)); } catch (e) { } };
  let sb = null, user = null, timer = null, busy = false, again = false;
  A.enabled = false; A.status = "loading"; A.user = () => user; A.client = () => sb;
  const fire = (n, d) => root.dispatchEvent(new CustomEvent(n, { detail: d }));

  // Cualquier cambio en «seg» o «historial» (desde cualquier página) programa una sincronización.
  const touch = k => { if (user && (k === "seg" || k === "historial")) { clearTimeout(timer); timer = setTimeout(A.sync, 1200); } };
  Storage.prototype.setItem = function (k, v) { rawSet.call(this, k, v); if (this === ls) touch(k); };
  Storage.prototype.removeItem = function (k) { rawDel.call(this, k); if (this === ls) touch(k); };
  root.addEventListener("storage", e => touch(e.key));

  const loadScript = src => new Promise((res, rej) => { if (root.supabase && root.supabase.createClient) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("no se pudo cargar " + src)); document.head.appendChild(s); });

  A.ready = (async () => {
    let cfg = null; try { const r = await fetch("data/config.json", { cache: "no-cache" }); cfg = r.ok ? await r.json() : null; } catch (e) { }
    const v = A.validCfg(cfg && cfg.accounts);
    if (!v.ok) { A.status = v.why; if (v.why === "secret") console.error("KyraNoHard: config.json tiene una clave SECRETA de Supabase. No se usa. Borrala de inmediato y rotala en Supabase."); fire("acc:ready", A); return A; }
    try { await loadScript(SB_JS); } catch (e) { A.status = "error"; fire("acc:ready", A); return A; }
    sb = root.supabase.createClient(v.url, v.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    A.enabled = true;
    const { data } = await sb.auth.getSession(); user = data && data.session ? data.session.user : null;
    A.status = user ? "in" : "out"; header(); fire("acc:ready", A);
    sb.auth.onAuthStateChange((ev, session) => {
      const was = user && user.id; user = session ? session.user : null; A.status = user ? "in" : "out"; header();
      fire("acc:auth", { event: ev, user });
      if (user && user.id !== was) setTimeout(A.sync, 0);
    });
    if (user) A.sync();
    return A;
  })();

  function header() {
    const b = document.getElementById("accbtn"); if (!b || !A.enabled) return;
    b.hidden = false; const t = user ? "Mi cuenta (" + (user.email || "") + ")" : "Ingresar o crear cuenta";
    b.title = t; b.setAttribute("aria-label", t); b.classList.toggle("in", !!user);
  }
  document.addEventListener("DOMContentLoaded", header);

  A.sync = async () => {
    if (!sb || !user) return;
    if (busy) { again = true; return; }
    busy = true; fire("acc:sync", { state: "start" });
    const uid = user.id, BK = "acc-base:" + uid;
    try {
      const [rf, rh] = await Promise.all([sb.from("follows").select("product_id,name,price_ref"), sb.from("history").select("id,kind,title,sub,url,cat,t")]);
      if (rf.error) throw rf.error; if (rh.error) throw rh.error;
      const base = get(BK, null), nb = { seg: [], hist: {} };
      // seguimientos
      const locF = get("seg", {}) || {}, remF = {};
      rf.data.forEach(r => { remF[r.product_id] = A.rowToFollow(r); });
      const mf = A.merge3(base && base.seg, locF, remF);
      if (mf.up.length) { const r = await sb.from("follows").upsert(mf.up.map(id => A.followToRow(uid, id, mf.out[id])), { onConflict: "user_id,product_id", ignoreDuplicates: true }); if (r.error) throw r.error; }
      if (mf.del.length) { const r = await sb.from("follows").delete().eq("user_id", uid).in("product_id", mf.del); if (r.error) throw r.error; }
      if (JSON.stringify(mf.out) !== JSON.stringify(locF)) put("seg", mf.out);
      nb.seg = Object.keys(mf.out);
      // historial
      const locAll = get("historial", {}) || {}, outAll = {};
      for (const k of KINDS) {
        const loc = {}, rem = {}, order = Array.isArray(locAll[k]) ? locAll[k] : [];
        order.forEach(e => { if (e && e.id && e.url) loc[e.id] = e; });
        rh.data.filter(r => r.kind === k && A.safeUrl(r.url)).forEach(r => { rem[r.id] = A.rowToHist(r); });
        const m = A.merge3(base && base.hist && base.hist[k], loc, rem, A.newerHist);
        if (m.up.length) { const r = await sb.from("history").upsert(m.up.map(id => A.histToRow(uid, k, m.out[id])), { onConflict: "user_id,id" }); if (r.error) throw r.error; }
        if (m.del.length) { const r = await sb.from("history").delete().eq("user_id", uid).in("id", m.del); if (r.error) throw r.error; }
        outAll[k] = Object.values(m.out).sort((a, b) => (Date.parse(b.t) || 0) - (Date.parse(a.t) || 0)).slice(0, 50);
        nb.hist[k] = outAll[k].map(e => e.id);
      }
      const merged = Object.assign({}, locAll, outAll);
      const changed = JSON.stringify(merged) !== JSON.stringify(locAll);
      if (changed) put("historial", merged);
      put(BK, nb);
      fire("acc:synced", { ok: true, changed: changed || JSON.stringify(mf.out) !== JSON.stringify(locF) });
    } catch (e) {
      console.warn("KyraNoHard: no se pudo sincronizar la cuenta", e); fire("acc:synced", { ok: false, error: e.message || String(e) });
    } finally { busy = false; if (again) { again = false; setTimeout(A.sync, 300); } }
  };

  /* acciones de la página Mi cuenta */
  const here = () => location.href.split("#")[0].split("?")[0];
  A.signUp = (email, password) => sb.auth.signUp({ email, password, options: { emailRedirectTo: here() } });
  A.signIn = (email, password) => sb.auth.signInWithPassword({ email, password });
  A.resetPassword = email => sb.auth.resetPasswordForEmail(email, { redirectTo: here() });
  A.updatePassword = password => sb.auth.updateUser({ password });
  A.signOut = async () => { await sb.auth.signOut(); };
  A.getPrefs = async () => { const r = await sb.from("profiles").select("notify_down,notify_up,notify_cuotas").eq("user_id", user.id).maybeSingle();
    if (r.error) throw r.error; return r.data || { notify_down: true, notify_up: false, notify_cuotas: true }; };
  A.setPrefs = async p => { const r = await sb.from("profiles").upsert(Object.assign({ user_id: user.id }, p), { onConflict: "user_id" }); if (r.error) throw r.error; };
  A.deleteAccount = async () => { const r = await sb.rpc("delete_my_account"); if (r.error) throw r.error;
    try { rawDel.call(ls, "acc-base:" + user.id); } catch (e) { } await sb.auth.signOut({ scope: "local" }); };
})(typeof self !== "undefined" ? self : this);
