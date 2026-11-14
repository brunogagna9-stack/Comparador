/* KyraNoHard · autocompletado de los buscadores con foto (actualización 36).
   SRCH.mount(input, {go}) muestra hasta 8 productos mientras se escribe. Elegir uno abre su ficha (producto.html?id=…);
   Enter sin elegir, o «Ver todos los resultados», hace la búsqueda en Productos (go). El índice (data/buscar.json:
   [id, nombre, categoría, foto, precio, tiendas]) se descarga recién la primera vez que se toca un buscador. */
(function (root) {
  "use strict";
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-_/,()]+/g, " ");
  const ARS = n => "$" + Math.round(n).toLocaleString("es-AR");
  const CAT = { "placas-de-video": "Placa de video", procesadores: "Procesador", motherboards: "Placa madre", "memorias-ram": "Memoria RAM",
    almacenamiento: "Almacenamiento", fuentes: "Fuente", gabinetes: "Gabinete", refrigeracion: "Refrigeración", monitores: "Monitor",
    notebooks: "Notebook", "pcs-armadas": "PC armada", mouses: "Mouse", teclados: "Teclado", auriculares: "Auriculares",
    perifericos: "Periféricos", redes: "Redes", accesorios: "Accesorios", otros: "Otros" };
  // ante empates, primero el hardware principal y después accesorios
  const RANK = { "placas-de-video": 6, procesadores: 6, notebooks: 5, "pcs-armadas": 5, monitores: 5, motherboards: 4, "memorias-ram": 4, almacenamiento: 4,
    fuentes: 3, gabinetes: 3, refrigeracion: 3, mouses: 3, teclados: 3, auriculares: 3, perifericos: 2, redes: 1, accesorios: 0, otros: 0 };
  let DATA = null, LOADING = null;
  function load() {
    if (DATA) return Promise.resolve(DATA);
    if (!LOADING) LOADING = fetch("data/buscar.json", { cache: "no-cache" }).then(r => { if (!r.ok) throw 0; return r.json(); })
      .then(j => { DATA = (j.items || []).map(r => ({ id: r[0], name: r[1], cat: r[2], img: r[3], p: r[4], n: r[5], k: norm(r[1]) })); return DATA; })
      .catch(() => { LOADING = null; return null; });
    return LOADING;
  }
  function find(q, max) {
    const words = norm(q).split(/\s+/).filter(Boolean); if (!words.length || !DATA) return [];
    const out = [];
    for (const it of DATA) {
      let ok = true, score = 0, last = -1, inOrder = true;
      for (const w of words) {
        const i = it.k.indexOf(w); if (i < 0) { ok = false; break; }
        if (i < last) inOrder = false; last = i;
        if (i === 0 || it.k[i - 1] === " ") score += 2;               // la palabra empieza ahí (no es parte de otra)
        if (it.k.length > i + w.length && /[a-z0-9]/.test(it.k[i + w.length])) score -= 1;   // «4060» dentro de «4060ti»
      }
      if (!ok) continue;
      if (inOrder) score += 2;
      score += (RANK[it.cat] || 0) * 0.4 + Math.min(it.n, 6) * 0.35 + (it.p ? 0 : -3) + (it.img ? 0.5 : 0) - it.k.length / 200;
      out.push([score, it]);
    }
    out.sort((a, b) => b[0] - a[0]);
    // actualización 40: sin coincidencias exactas, se buscan parecidas (errores de tipeo) con uFuzzy (js/fuzzy.js)
    if (!out.length && root.FZY && root.FZY.ready()) {
      const fl = root.FZY.search(DATA, it => it.name, q) || [];
      const sc = fl.map((it, i) => [(RANK[it.cat] || 0) * 0.4 + Math.min(it.n, 6) * 0.35 + (it.p ? 0 : -3) + (it.img ? 0.5 : 0) - i * 0.03, it]).sort((a, b) => b[0] - a[0]);
      return { total: sc.length, list: sc.slice(0, max || 8).map(x => x[1]), fuzzy: true };
    }
    return { total: out.length, list: out.slice(0, max || 8).map(x => x[1]), needFuzzy: !out.length };
  }
  let FZP = null;
  const fuzzy = () => root.FZY ? root.FZY.load() : (FZP || (FZP = new Promise(r => { if (typeof document === "undefined") return r(false);
    const s = document.createElement("script"); s.src = "js/fuzzy.js"; s.async = true; s.onload = () => (root.FZY ? root.FZY.load() : Promise.resolve(false)).then(r);
    s.onerror = () => { FZP = null; r(false); }; document.head.appendChild(s); })));
  const mark = (txt, q) => { let h = esc(txt); norm(q).split(/\s+/).filter(w => w.length > 1).forEach(w => {
    h = h.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); }); return h; };
  const thumb = it => { const ic = root.ICONS ? root.ICONS.svg(it.cat, 22) : "";
    return `<span class="sr-im">${it.img ? `<img loading="lazy" decoding="async" alt="" width="44" height="44" src="${esc(it.img)}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{innerHTML:${esc(JSON.stringify(ic))}}))">` : ic}</span>`; };

  let uid = 0;
  function mount(inp, opt) {
    if (!inp || inp.dataset.srch) return; inp.dataset.srch = "1"; opt = opt || {};
    const id = "sr" + (++uid), host = opt.host || inp.parentNode;
    host.classList.add("sr-host");
    // el desplegable va sobre toda la página (fijo, alineado con el buscador): así no lo corta el recuadro de la portada
    const dd = document.createElement("div"); dd.className = "sr-dd"; dd.id = id; dd.setAttribute("role", "listbox"); dd.hidden = true; document.body.appendChild(dd);
    const place = () => { if (dd.hidden) return; const r = host.getBoundingClientRect(), vw = document.documentElement.clientWidth, w = Math.min(Math.max(r.width, 460), vw - 16);
      let left = opt.alignRight ? r.right - w : r.left; left = Math.max(8, Math.min(left, vw - w - 8));
      Object.assign(dd.style, { top: Math.round(r.bottom + 6) + "px", left: Math.round(left) + "px", width: Math.round(w) + "px", maxHeight: Math.max(160, innerHeight - r.bottom - 16) + "px" }); };
    addEventListener("resize", place); addEventListener("scroll", place, { passive: true });
    inp.setAttribute("role", "combobox"); inp.setAttribute("aria-autocomplete", "list"); inp.setAttribute("aria-controls", id); inp.setAttribute("aria-expanded", "false");
    let res = { list: [], total: 0 }, act = -1, tm;
    const go = q => (opt.go || (x => { location.href = "productos.html" + (x ? "?q=" + encodeURIComponent(x) : ""); }))(q);
    const open = it => { location.href = "producto.html?id=" + encodeURIComponent(it.id); };
    const close = () => { dd.hidden = true; inp.setAttribute("aria-expanded", "false"); act = -1; inp.removeAttribute("aria-activedescendant"); };
    function draw() {
      const q = inp.value.trim();
      if (q.length < 2) { close(); return; }
      if (!DATA) { dd.innerHTML = `<div class="sr-m">Buscando…</div>`; dd.hidden = false; place(); return; }
      res = find(q, innerWidth < 640 ? 5 : 8);
      const rows = res.list.map((it, i) => `<a role="option" id="${id}-${i}" href="producto.html?id=${encodeURIComponent(it.id)}" data-i="${i}" class="${i === act ? "act" : ""}"${i === act ? ' aria-selected="true"' : ""}>${thumb(it)}<span class="sr-t"><span class="sr-n">${mark(it.name, q)}</span><small>${esc(CAT[it.cat] || "")}${it.n > 1 ? " · " + it.n + " tiendas" : ""}</small></span><b>${it.p ? ARS(it.p) : ""}</b></a>`).join("");
      const all = `<button type="button" class="sr-all${act === res.list.length ? " act" : ""}" id="${id}-all">Ver todos los resultados para «${esc(q)}»${res.total ? ` (${res.total.toLocaleString("es-AR")})` : ""} →</button>`;
      if (res.needFuzzy && !(root.FZY && root.FZY.ready())) { dd.innerHTML = `<div class="sr-m">Buscando parecidos…</div>`; dd.hidden = false; place();
        fuzzy().then(ok => { if (document.activeElement === inp && inp.value.trim() === q) { if (ok) draw(); else { dd.innerHTML = `<div class="sr-m">No encontramos productos con «${esc(q)}».</div>` + all; } } }); return; }
      const fz = res.fuzzy && rows ? `<div class="sr-m">No hay coincidencias exactas con «${esc(q)}»: estos son los más parecidos.</div>` : "";
      dd.innerHTML = fz + (rows || `<div class="sr-m">No encontramos productos con «${esc(q)}».</div>`) + all;
      dd.hidden = false; place(); inp.setAttribute("aria-expanded", "true");
      if (act >= 0) inp.setAttribute("aria-activedescendant", act === res.list.length ? id + "-all" : id + "-" + act);
    }
    const kick = () => { clearTimeout(tm); tm = setTimeout(() => { act = -1; if (DATA) draw(); else { draw(); load().then(d => { if (!d) { dd.innerHTML = `<div class="sr-m">No se pudieron cargar las sugerencias. Apretá Enter para buscar.</div>`; return; } if (document.activeElement === inp) draw(); }); } }, 90); };
    inp.addEventListener("focus", () => { load(); if (inp.value.trim().length >= 2) kick(); });
    inp.addEventListener("input", kick);
    inp.addEventListener("keydown", e => {
      const n = res.list.length;
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !dd.hidden) {
        e.preventDefault(); act = e.key === "ArrowDown" ? Math.min(n, act + 1) : Math.max(-1, act - 1); draw();
        const a = dd.querySelector(".act"); if (a) a.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault(); e.stopImmediatePropagation();
        if (!dd.hidden && act >= 0 && act < n) open(res.list[act]); else go(inp.value.trim());
      } else if (e.key === "Escape") close();
    }, true);
    dd.addEventListener("mousedown", e => { if (e.target.closest("a,button")) e.preventDefault(); });   // que el campo no pierda el foco antes del clic
    dd.addEventListener("click", e => { if (e.target.closest(".sr-all")) { e.preventDefault(); go(inp.value.trim()); } });
    document.addEventListener("click", e => { if (!host.contains(e.target) && !dd.contains(e.target)) close(); });
  }
  root.SRCH = { mount, find, load, _set: d => { DATA = d.map(r => ({ id: r[0], name: r[1], cat: r[2], img: r[3], p: r[4], n: r[5], k: norm(r[1]) })); } };
  if (typeof module !== "undefined" && module.exports) module.exports = root.SRCH;
})(typeof window !== "undefined" ? window : globalThis);
