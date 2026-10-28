/* ComparáTech · vista rápida de un producto desde cualquier página (Armado de PC, Encontrá tu equipo…).
   - Tocar el nombre de un producto ([data-qv="id"]) abre una ventana con precio, tiendas, «Seguir precio» y «Agregar a mi lista».
   - Botones chicos en cada fila: [data-qf="id"] sigue el precio, [data-ql="id"] agrega o quita de la lista (el carrito del encabezado).
   - [data-qall="id1,id2,…"] agrega varios productos a la lista de una vez (toda la configuración).
   Usa el mismo guardado que la página de Productos («seg» y «lista» en el navegador), así todo queda sincronizado. */
(function (root) {
  "use strict";
  const QV = {};
  let byId = new Map();
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ARS = n => n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");
  const price = o => o.price_cash ?? o.price_list;
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v ?? d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* modo privado: se mantiene en la página */ } };
  let FOLLOW = read("seg", {}), LIST = read("lista", []);
  if (!Array.isArray(LIST)) LIST = [];
  const best = g => { const l = g.offers.filter(o => o.stock !== false && price(o)); return (l.length ? l : g.offers).slice().sort((a, b) => price(a) - price(b))[0]; };

  QV.setData = products => { byId = new Map(products.map(g => [g.id, g])); };
  QV.inList = id => LIST.includes(id);
  QV.following = id => !!FOLLOW[id];
  const announce = t => { const el = document.getElementById("qv-live"); if (el) el.textContent = t; };
  function syncButtons() {
    document.querySelectorAll("[data-qf]").forEach(b => { const on = !!FOLLOW[b.dataset.qf]; b.classList.toggle("on", on); b.textContent = b.dataset.long ? (on ? "★ Siguiendo" : "☆ Seguir precio") : (on ? "★" : "☆");
      b.title = b.ariaLabel = on ? "Dejar de seguir el precio" : "Seguir el precio (te avisamos en Productos si cambia)"; });
    document.querySelectorAll("[data-ql]").forEach(b => { const on = LIST.includes(b.dataset.ql); b.classList.toggle("on", on); b.textContent = b.dataset.long ? (on ? "✓ En mi lista (quitar)" : "+ Agregar a mi lista") : (on ? "✓" : "+");
      b.title = b.ariaLabel = on ? "Quitar de mi lista" : "Agregar a mi lista de compra"; });
    document.querySelectorAll("[data-qall]").forEach(b => { const ids = b.dataset.qall.split(",").filter(Boolean), all = ids.length && ids.every(id => LIST.includes(id));
      b.classList.toggle("on", all); b.textContent = all ? "✓ Configuración en mi lista" : `🛒 Agregar las ${ids.length} piezas a mi lista`; });
  }
  QV.toggleFollow = id => { const g = byId.get(id); if (!g) return;
    if (FOLLOW[id]) { delete FOLLOW[id]; announce("Dejaste de seguir " + g.name); } else { FOLLOW[id] = { price: price(best(g)), name: g.name }; announce("Siguiendo el precio de " + g.name); }
    write("seg", FOLLOW); syncButtons(); };
  const count = () => { if (root.CTL && root.CTL.count) root.CTL.count(LIST.length); };
  QV.toggleList = id => { const i = LIST.indexOf(id); if (i >= 0) LIST.splice(i, 1); else LIST.push(id); write("lista", LIST); count();
    announce(i >= 0 ? "Quitado de tu lista" : "Agregado a tu lista"); syncButtons(); };
  QV.addAll = ids => { const all = ids.every(id => LIST.includes(id));
    if (all) ids.forEach(id => { const i = LIST.indexOf(id); if (i >= 0) LIST.splice(i, 1); }); else ids.forEach(id => { if (!LIST.includes(id)) LIST.push(id); });
    write("lista", LIST); count(); announce(all ? "Quitaste la configuración de tu lista" : "Agregaste la configuración a tu lista"); syncButtons(); };

  /* botones para poner al lado de un producto */
  QV.btns = id => `<span class="qv-b"><button type="button" class="qv-f" data-qf="${esc(id)}">☆</button><button type="button" class="qv-l" data-ql="${esc(id)}">+</button></span>`;
  QV.link = (g, text) => `<a href="producto.html?id=${encodeURIComponent(g.id)}" data-qv="${esc(g.id)}">${esc(text ?? g.name)}</a>`;

  function ensureModal() {
    if (document.getElementById("qv-modal")) return;
    const css = `.qv-b{display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle}
.qv-b button{border:1px solid var(--line2);background:var(--card);color:var(--tx);border-radius:999px;min-width:28px;height:26px;padding:0 8px;font:700 13px system-ui,sans-serif;cursor:pointer;line-height:1}
.qv-b button:hover{border-color:var(--acc)}.qv-b button.on{background:var(--acc);border-color:var(--acc);color:#fff}
[data-qv]{cursor:pointer}
.qv-all{margin-top:10px;border:1px solid var(--acc);background:color-mix(in srgb,var(--acc) 12%,var(--card));color:var(--tx);border-radius:999px;padding:8px 14px;font-weight:700;cursor:pointer}
.qv-all.on{background:var(--acc);color:#fff}
#qv-modal{position:fixed;inset:0;background:rgba(0,0,0,.62);display:none;padding:20px;overflow:auto;z-index:80;overscroll-behavior:contain}
#qv-modal.on{display:flex}#qv-modal .qv-box{background:var(--card);color:var(--tx);border:1px solid var(--line2);border-radius:14px;max-width:640px;width:100%;padding:18px;position:relative;margin:auto}
#qv-modal .qv-x{position:absolute;right:10px;top:10px;border:0;background:var(--soft);color:var(--tx);width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer}
#qv-modal .qv-top{display:flex;gap:14px;align-items:flex-start}#qv-modal .qv-im{flex:none;width:120px;height:120px;background:#fff;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden}
#qv-modal .qv-im img{max-width:100%;max-height:100%;object-fit:contain}#qv-modal h3{margin:0 34px 6px 0;font-size:17px;line-height:1.3}
#qv-modal .qv-p{font-size:24px;font-weight:800}#qv-modal .qv-acts{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
#qv-modal table{width:100%;border-collapse:collapse;font-size:13.5px}#qv-modal td{padding:6px 4px;border-top:1px solid var(--line)}#qv-modal td.n{text-align:right;white-space:nowrap}
@media(max-width:520px){#qv-modal .qv-top{flex-direction:column}#qv-modal .qv-im{width:100%;height:160px}}`;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    document.body.insertAdjacentHTML("beforeend", `<div id="qv-modal" role="dialog" aria-modal="true" aria-label="Producto"><div class="qv-box" id="qv-box"></div></div><div id="qv-live" class="sr" aria-live="polite" style="position:absolute;left:-9999px"></div>`);
    const m = document.getElementById("qv-modal");
    m.addEventListener("click", e => { if (e.target === m) QV.close(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") QV.close(); });
  }
  QV.close = () => { const m = document.getElementById("qv-modal"); if (m) m.classList.remove("on"); };
  QV.open = id => {
    const g = byId.get(id); if (!g) return false;
    ensureModal();
    const b = best(g), rows = g.offers.slice().sort((x, y) => price(x) - price(y)).map(o => `<tr><td><b>${esc(o.store)}</b>${root.REP && root.REP.badge ? root.REP.badge(o.store) : ""}</td>
      <td class="n">${ARS(price(o))}${o.price_list && o.price_cash && o.price_list > o.price_cash ? `<div class="note">lista ${ARS(o.price_list)}</div>` : ""}</td>
      <td>${o.stock === true ? '<span class="okx">● Con stock</span>' : o.stock === false ? '<span class="bx2">● Sin stock</span>' : '<span class="note">stock a confirmar</span>'}</td>
      <td class="n"><a href="${esc(o.url)}" target="_blank" rel="noopener nofollow">Ir a la tienda ↗</a></td></tr>`).join("");
    document.getElementById("qv-box").innerHTML = `<button class="qv-x" type="button" aria-label="Cerrar">×</button>
      <div class="qv-top"><div class="qv-im">${g.image ? `<img src="${esc(g.image)}" alt="" loading="lazy" onerror="this.remove()">` : "📦"}</div>
      <div><h3>${esc(g.name)}</h3><div class="qv-p">${ARS(price(b))}</div><div class="note">Precio más bajo con stock · ${esc(b.store)}</div></div></div>
      <div class="qv-acts"><button type="button" class="btn" data-qf="${esc(g.id)}" data-long="1"></button><button type="button" class="btn pri" data-ql="${esc(g.id)}" data-long="1"></button>
      <a class="btn" href="producto.html?id=${encodeURIComponent(g.id)}">Ver ficha e historial →</a></div>
      <table>${rows}</table>`;
    document.querySelector("#qv-box .qv-x").onclick = QV.close;
    syncButtons();
    document.getElementById("qv-modal").classList.add("on");
    document.querySelector("#qv-box .qv-x").focus();
    return true;
  };

  /* un solo manejador para toda la página (sirve también para lo que se dibuja después) */
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-qf],[data-ql],[data-qall],[data-qv]"); if (!t) return;
    if (t.dataset.qf) { e.preventDefault(); QV.toggleFollow(t.dataset.qf); }
    else if (t.dataset.ql) { e.preventDefault(); QV.toggleList(t.dataset.ql); }
    else if (t.dataset.qall) { e.preventDefault(); QV.addAll(t.dataset.qall.split(",").filter(Boolean)); }
    else if (t.dataset.qv && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) { if (QV.open(t.dataset.qv)) e.preventDefault(); }   // Ctrl+clic: abre la ficha en otra pestaña
  });
  QV.refresh = () => { FOLLOW = read("seg", {}); LIST = read("lista", []); if (!Array.isArray(LIST)) LIST = []; syncButtons(); };
  addEventListener("storage", e => { if (e.key === "seg" || e.key === "lista") QV.refresh(); });   // otra pestaña cambió la lista
  QV.sync = syncButtons;
  document.addEventListener("DOMContentLoaded", ensureModal);
  if (document.readyState !== "loading") ensureModal();
  root.QV = QV;
})(typeof self !== "undefined" ? self : this);
