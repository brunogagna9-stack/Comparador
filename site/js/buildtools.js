/* Actualización 46 · etapa 1 — herramientas conectadas.
   Un armado recomendado («Encontrá tu equipo» o «Armado de PC») se puede:
   - abrir completo en «Armalo vos» para cambiar piezas con el control de compatibilidad (armar.html?b=…);
   - compartir con un enlace;
   - ver «dónde comprar todo»: pieza por pieza, todo en una tienda o repartido en dos;
   - comparar las opciones de cada pieza en «Comparar» (comparar.html#cat=…&ids=…).
   No calcula nada nuevo: usa las piezas y los precios que ya eligió el recomendador. */
(function (root) {
  const BT = {};
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const price = o => (root.CT && root.CT.price ? root.CT.price(o) : (o.price_cash || o.price_list || 0));
  const ars = n => (root.CT && root.CT.ARS ? root.CT.ARS(n) : "$" + Math.round(n));
  const first = pt => pt && pt.shop && pt.shop[0];

  /* mismo formato que usa «Armalo vos» para sus enlaces (pieza=id;pieza=id) */
  BT.param = parts => parts.filter(first).map(pt => pt.slot + "=" + encodeURIComponent(first(pt).g.id)).join(";");
  BT.armarUrl = parts => "armar.html?b=" + encodeURIComponent(BT.param(parts));

  /* dónde comprar todo, con los productos elegidos (una unidad de cada uno) */
  BT.plan = parts => {
    const items = parts.filter(first).map(pt => first(pt));
    if (!items.length) return null;
    const sum = items.reduce((a, x) => a + x.p, 0);
    const stores = new Set(items.map(x => x.o.store));
    const P = items.map(x => { const m = {}; (x.g.offers || []).forEach(o => { const p = price(o); if (o.stock !== false && p && (m[o.store] == null || p < m[o.store])) m[o.store] = p; }); return m; });
    const all = [...new Set(P.flatMap(m => Object.keys(m)))];
    let one = null;
    all.forEach(s => { if (P.every(m => m[s] != null)) { const t = P.reduce((a, m) => a + m[s], 0); if (!one || t < one.t) one = { s, t }; } });
    let pair = null;
    if (all.length <= 60) for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j]; let t = 0;
      for (const m of P) { const x = m[a], y = m[b]; if (x == null && y == null) { t = -1; break; } t += x == null ? y : y == null ? x : Math.min(x, y); }
      if (t >= 0 && (!pair || t < pair.t)) pair = { a, b, t };
    }
    return { n: items.length, sum, stores: stores.size, one, pair };
  };

  BT.planH = parts => {
    const p = BT.plan(parts); if (!p || p.n < 2) return "";
    const li = [`<li>Cada pieza donde está más barata: <b>${ars(p.sum)}</b> <span class="note">(${p.stores} ${p.stores === 1 ? "tienda" : "tiendas"})</span></li>`];
    if (p.one) li.push(`<li>Todo en una sola tienda: <b>${ars(p.one.t)}</b> en ${esc(p.one.s)}</li>`);
    if (p.pair && p.stores > 2 && (!p.one || p.pair.t < p.one.t)) li.push(`<li>Repartido en dos tiendas: <b>${ars(p.pair.t)}</b> en ${esc(p.pair.a)} + ${esc(p.pair.b)}</li>`);
    if (!p.one && !(p.pair && p.stores > 2)) li.push(`<li class="note">Ninguna tienda tiene todas las piezas con stock.</li>`);
    return `<details class="bt-plan"><summary>🛒 Dónde comprar todo</summary><ul>${li.join("")}</ul><p class="note">Con el precio de contado de hoy de las mismas piezas; sin envío. Comprar en menos tiendas suele ahorrar envíos.</p></details>`;
  };

  BT.actionsH = (parts, opts) => {
    if (!parts || !parts.some(first)) return "";
    const url = BT.armarUrl(parts), o = opts || {};
    return `<div class="bt-act"><a class="btn" href="${esc(url)}">🔧 Cambiar piezas en «Armalo vos»</a>`
      + `<button type="button" class="btn" data-bshare="${esc(url)}" data-btitle="${esc(o.title || "Armado de PC en KyraNoHard")}">🔗 Compartir este armado</button></div>`
      + BT.planH(parts);
  };

  /* comparar la pieza elegida con sus alternativas (misma categoría, hasta 4) */
  BT.cmpHref = pt => {
    const l = (pt.shop || []).filter(x => x && x.g); if (l.length < 2) return "";
    const cat = l[0].g.category, ids = [...new Set(l.filter(x => x.g.category === cat).map(x => x.g.id))].slice(0, 4);
    return ids.length < 2 ? "" : `comparar.html#cat=${encodeURIComponent(cat)}&ids=${ids.map(encodeURIComponent).join(",")}`;
  };
  BT.cmpH = pt => { const h = BT.cmpHref(pt); return h ? ` <a class="bt-cmp" href="${esc(h)}">⇄ Comparar opciones</a>` : ""; };

  /* compartir: el menú del teléfono si existe; si no, se copia el enlace */
  BT.wire = () => {
    if (BT._wired || typeof document === "undefined") return; BT._wired = true;
    document.addEventListener("click", async e => {
      const b = e.target.closest && e.target.closest("[data-bshare]"); if (!b) return;
      e.preventDefault();
      const url = new URL(b.dataset.bshare, location.href).href, title = b.dataset.btitle || document.title;
      try { if (root.goatcounter && root.goatcounter.count) root.goatcounter.count({ path: "armado-compartir", title: "Compartir armado", event: true }); } catch (x) { }
      if (navigator.share) { try { await navigator.share({ title, url }); return; } catch (x) { if (x && x.name === "AbortError") return; } }
      try { await navigator.clipboard.writeText(url); b.textContent = "✓ Enlace copiado"; } catch (x) { b.textContent = "No se pudo copiar"; }
    });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = BT; else { root.BT = BT; BT.wire(); }
})(typeof self !== "undefined" ? self : this);
