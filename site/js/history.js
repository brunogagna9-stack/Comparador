/* KyraNoHard · historial de armados de PC y de comparaciones (actualización 31).
   Se guarda SOLO en el navegador («historial» en el almacenamiento local): no sale de la computadora de la persona.
   Cada entrada: { id, t (fecha ISO), title, sub, url, total? }. Hasta 50 por tipo; la más reciente primero.
   Mientras la persona sigue armando o comparando en la misma visita, se actualiza la misma entrada (no se llena de copias).
   HIST.confirm(texto) muestra una ventana propia «¿Estás seguro…?» y devuelve una promesa true/false. */
(function (root) {
  "use strict";
  const H = {}, KEY = "historial", MAX = 50, KINDS = ["armados", "comparaciones"];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const read = () => { try { const v = JSON.parse(globalThis.localStorage.getItem(KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } };
  const write = v => { try { globalThis.localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const ss = { get: k => { try { return globalThis.sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { globalThis.sessionStorage.setItem(k, v); } catch (e) { } } };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  H.list = kind => { const l = read()[kind]; return Array.isArray(l) ? l.filter(e => e && e.id && e.url) : []; };
  /* Guarda o actualiza. «session» identifica lo que se está editando en esta visita (p. ej. "armar" o "cmp:procesadores"):
     mientras dure la visita se pisa la misma entrada. «dedupe» evita repetir exactamente lo mismo (misma dirección). */
  H.save = (kind, entry, session) => {
    if (!KINDS.includes(kind) || !entry || !entry.url) return null;
    const all = read(), l = Array.isArray(all[kind]) ? all[kind] : [];
    let id = session ? ss.get("hist:" + session) : null;
    if (id && !l.some(e => e.id === id)) id = null;                     // la borraron desde el historial: se empieza otra
    if (!id) { const same = l.find(e => e.url === entry.url); id = same ? same.id : newId(); }   // lo mismo ya guardado: se actualiza esa
    const rest = l.filter(e => e.id !== id && e.url !== entry.url);
    const e = Object.assign({}, entry, { id, t: new Date().toISOString() });
    all[kind] = [e].concat(rest).slice(0, MAX);
    write(all);
    if (session) ss.set("hist:" + session, id);
    return id;
  };
  H.remove = (kind, id) => { const all = read(); all[kind] = H.list(kind).filter(e => e.id !== id); write(all); };
  H.clear = kind => { const all = read(); delete all[kind]; write(all); };
  H.count = () => KINDS.reduce((a, k) => a + H.list(k).length, 0);

  /* ventana de confirmación propia (accesible, con Escape y foco en «Cancelar») */
  H.confirm = (text, okLabel) => new Promise(res => {
    const d = globalThis.document; if (!d) return res(false);
    if (!d.getElementById("hist-css")) {
      const st = d.createElement("style"); st.id = "hist-css";
      st.textContent = `#hist-dlg{position:fixed;inset:0;background:rgba(3,6,15,.6);display:flex;align-items:center;justify-content:center;z-index:99990;padding:16px}
#hist-dlg .b{background:var(--card,#fff);color:var(--tx,#111);border:1px solid var(--line,#ddd);border-radius:16px;max-width:420px;width:100%;padding:20px;box-shadow:0 20px 50px rgba(0,0,0,.35)}
#hist-dlg h2{margin:0 0 8px;font-size:18px}#hist-dlg p{margin:0 0 16px;color:var(--mut,#555);font-size:14px;line-height:1.5}
#hist-dlg .r{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}#hist-dlg button{border-radius:999px;padding:9px 16px;font:700 14px var(--font);cursor:pointer}
#hist-dlg .no{border:1px solid var(--line,#ccc);background:var(--card,#fff);color:var(--tx,#111)}#hist-dlg .si{border:0;background:#c4301f;color:#fff}`;
      d.head.appendChild(st);
    }
    const prev = d.activeElement;
    d.body.insertAdjacentHTML("beforeend", `<div id="hist-dlg" role="alertdialog" aria-modal="true" aria-labelledby="hist-dlg-t" aria-describedby="hist-dlg-d"><div class="b"><h2 id="hist-dlg-t">${esc(text)}</h2><p id="hist-dlg-d">Esta acción no se puede deshacer.</p><div class="r"><button type="button" class="no">Cancelar</button><button type="button" class="si">${esc(okLabel || "Sí, eliminar")}</button></div></div></div>`);
    const dlg = d.getElementById("hist-dlg");
    const done = v => { dlg.remove(); d.removeEventListener("keydown", key, true); try { prev && prev.focus(); } catch (e) { } res(v); };
    const key = e => { if (e.key === "Escape") { e.stopPropagation(); done(false); } else if (e.key === "Tab") { const b = [...dlg.querySelectorAll("button")], i = b.indexOf(d.activeElement); e.preventDefault(); b[(i + (e.shiftKey ? b.length - 1 : 1)) % b.length].focus(); } };
    d.addEventListener("keydown", key, true);
    dlg.querySelector(".no").onclick = () => done(false); dlg.querySelector(".si").onclick = () => done(true);
    dlg.addEventListener("click", e => { if (e.target === dlg) done(false); });
    dlg.querySelector(".no").focus();
  });

  H.KINDS = KINDS;
  if (typeof module !== "undefined" && module.exports) module.exports = H; else root.HIST = H;
})(typeof self !== "undefined" ? self : this);
