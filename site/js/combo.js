/* KyraNoHard · desplegable con buscador y fotos (actualización 35).
   COMBO.mount(input, {items, onPick, limit, empty}) convierte un <input> en un campo con autocompletado:
   - items: lista [{label, value, sub, thumb, keys}] o función que la devuelve (se busca en label + keys).
   - al elegir, el campo queda con item.value (o label) y se llama onPick(item); también se puede escribir libre.
   Se maneja con teclado (↑ ↓ Enter Esc) y funciona en el celular. */
(function (root) {
  "use strict";
  const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-_/]+/g, " ");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let uid = 0;

  function mount(inp, opt) {
    opt = opt || {};
    const id = "cb" + (++uid), limit = opt.limit || 30;
    const wrap = document.createElement("div"); wrap.className = "cb";
    inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
    const dd = document.createElement("div"); dd.className = "cb-dd"; dd.id = id; dd.setAttribute("role", "listbox"); dd.hidden = true;
    wrap.appendChild(dd);
    inp.setAttribute("role", "combobox"); inp.setAttribute("aria-autocomplete", "list"); inp.setAttribute("aria-controls", id);
    inp.setAttribute("aria-expanded", "false"); inp.setAttribute("autocomplete", "off");
    let shown = [], act = -1;
    const all = () => (typeof opt.items === "function" ? opt.items() : opt.items) || [];

    function filter(q) {
      const words = norm(q).split(/\s+/).filter(Boolean), L = all();
      if (!words.length) return L.slice(0, limit);
      const hits = [];
      for (const it of L) {
        const hay = it._n || (it._n = norm(it.label + " " + (it.keys || "")));
        if (words.every(w => hay.includes(w))) hits.push(it);
      }
      const q0 = norm(q);
      hits.sort((a, b) => (b._n.startsWith(q0) - a._n.startsWith(q0)));
      return hits.slice(0, limit);
    }
    function close() { dd.hidden = true; inp.setAttribute("aria-expanded", "false"); act = -1; }
    function draw() {
      shown = filter(inp.value);
      if (!shown.length) { dd.innerHTML = `<div class="cb-m">${esc(opt.empty || "Sin coincidencias: podés dejarlo escrito así.")}</div>`; }
      else dd.innerHTML = shown.map((it, i) => `<button type="button" role="option" id="${id}-${i}" data-i="${i}"${i === act ? ' class="act" aria-selected="true"' : ""}>${it.thumb || ""}<span class="cb-t"><span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span></button>`).join("");
      dd.hidden = false; inp.setAttribute("aria-expanded", "true");
      if (act >= 0) inp.setAttribute("aria-activedescendant", id + "-" + act); else inp.removeAttribute("aria-activedescendant");
    }
    function pick(it) {
      inp.value = it.value ?? it.label; close();
      if (opt.onPick) opt.onPick(it);
      inp.dispatchEvent(new Event("change", { bubbles: true }));
    }
    inp.addEventListener("focus", () => { act = -1; draw(); });
    inp.addEventListener("input", () => { act = -1; draw(); if (opt.onInput) opt.onInput(inp.value); });
    inp.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); if (dd.hidden) draw();
        if (!shown.length) return;
        act = e.key === "ArrowDown" ? Math.min(shown.length - 1, act + 1) : Math.max(0, act - 1); draw();
        const b = dd.querySelector(".act"); if (b) b.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        if (!dd.hidden && act >= 0 && shown[act]) { e.preventDefault(); pick(shown[act]); }
        else close();
      } else if (e.key === "Escape") close();
    });
    // mousedown (no click) para que el campo no pierda el foco antes de elegir
    dd.addEventListener("mousedown", e => { const b = e.target.closest("button[data-i]"); if (b) { e.preventDefault(); pick(shown[+b.dataset.i]); } });
    document.addEventListener("click", e => { if (!wrap.contains(e.target)) close(); });
    inp.addEventListener("blur", () => setTimeout(() => { if (!wrap.contains(document.activeElement)) close(); }, 120));
    return { close, refresh: () => { if (!dd.hidden) draw(); } };
  }

  root.COMBO = { mount, norm };
})(typeof window !== "undefined" ? window : globalThis);
