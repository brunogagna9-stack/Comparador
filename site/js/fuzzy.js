/* KyraNoHard · búsqueda tolerante a errores de tipeo (actualización 40).
   Usa uFuzzy (github.com/leeoniya/uFuzzy, licencia MIT, js/vendor/ufuzzy-1.0.19.min.js), que se baja recién la primera
   vez que una búsqueda no encuentra nada exacto. Acepta un error por palabra (letra de más, de menos, cambiada o dos
   letras invertidas) y separa letras de números: «ryzn 5600», «rtx4060ti» o «logitec g502» encuentran igual.
   FZY.load() → promesa (true si quedó lista) · FZY.search(lista, item => texto, consulta, máximo) → ítems ordenados. */
(function (root) {
  "use strict";
  const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-_/,()+]+/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2").replace(/\s+/g, " ").trim();
  const OPT = { intraMode: 1, intraIns: 1, intraSub: 1, intraTrn: 1, intraDel: 1, interIns: Infinity };
  let P = null, U = null;
  const cache = new WeakMap();   // textos ya normalizados de cada lista (se calculan una sola vez)
  const make = () => { try { if (root.uFuzzy) U = new root.uFuzzy(OPT); } catch (e) { U = null; } return !!U; };
  function load() {
    if (U || make()) return Promise.resolve(true);
    if (!P) P = new Promise(res => {
      const s = document.createElement("script"); s.src = "js/vendor/ufuzzy-1.0.19.min.js"; s.async = true;
      s.onload = () => res(make()); s.onerror = () => { P = null; res(false); };
      document.head.appendChild(s);
    });
    return P;
  }
  function search(list, key, q, max) {
    if (!U || !list) return null;
    const nq = norm(q); if (nq.replace(/\s/g, "").length < 3) return [];
    let hay = cache.get(list); if (!hay) { hay = list.map(x => norm(key(x))); cache.set(list, hay); }
    let r; try { r = U.search(hay, nq, 0, 1000); } catch (e) { return []; }
    const [idx, info, ord] = r; if (!idx || !idx.length) return [];
    const ids = ord && info ? ord.map(i => info.idx[i]) : idx;
    return ids.slice(0, max || ids.length).map(i => list[i]);
  }
  root.FZY = { norm, load, search, ready: () => !!U };
})(typeof window !== "undefined" ? window : globalThis);
