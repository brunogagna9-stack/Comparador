/* Reputación de los vendedores, mostrada junto a cada oferta.
   Fuente: data/stores.json (puntaje público de Google Maps de la ficha cuyo sitio web coincide con la tienda).
   Nunca se promedian fuentes ni se inventan puntajes: sin dato verificado se dice "sin reputación verificada". */
(function (root) {
  const R = { stores: {}, MIN: 100 };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = (n, d) => Number(n).toLocaleString("es-AR", d ? { minimumFractionDigits: d, maximumFractionDigits: d } : {});
  R.set = d => { R.stores = (d && d.stores) || {}; };
  R.load = async (url) => { try { const r = await fetch(url || "data/stores.json", { cache: "no-cache" }); if (r.ok) R.set(await r.json()); } catch (e) { /* sin datos: se muestra "sin reputación verificada" */ } };
  R.get = s => { const r = ((R.stores[s] || {}).reputation || [])[0]; return r && typeof r.score === "number" && r.count > 0 ? r : null; };
  R.low = r => !!r && r.count < R.MIN;
  R.text = s => { const r = R.get(s); return r ? `★ ${nf(r.score, 1)} (${nf(r.count)} opiniones en ${r.source})` : "sin reputación verificada"; };
  R.badge = s => {
    const r = R.get(s);
    if (!r) return `<span class="rep0" title="No hay una ficha pública verificable de esta tienda; no inventamos puntajes.">sin reputación verificada</span>`;
    const tip = `${r.source} · ficha «${r.listing}» · consultado el ${r.date}${R.low(r) ? " · pocas opiniones: puntaje poco representativo" : ""}`;
    return `<span class="rep1" title="${esc(tip)}">★ ${nf(r.score, 1)} <span class="rn">· ${nf(r.count)} op. Google</span>${R.low(r) ? ' <span class="rlow">pocas opiniones</span>' : ""}</span>`;
  };
  if (typeof document !== "undefined") {
    const st = document.createElement("style");
    st.textContent = ".rep1,.rep0{text-transform:none;letter-spacing:0;font-size:12px;font-weight:400;white-space:normal;display:inline-block;margin-left:6px;max-width:100%;color:var(--mut,#667)}.rep1{color:var(--ink,inherit)}.rep1 .rn{color:var(--mut,#667)}.rlow{color:var(--warn,#b45309);font-weight:600}.rep0{font-style:italic}";
    document.head.appendChild(st);
  }
  if (typeof module !== "undefined" && module.exports) module.exports = R; else root.REP = R;
})(typeof window !== "undefined" ? window : globalThis);
