/* KyraNoHard · guía rápida (actualización 41).
   Globitos que señalan cada parte de la web y recorren las secciones en orden: Inicio → Productos → Armado de PC →
   ¿Qué actualizar? → Encontrá tu equipo → Comparar hardware. Al terminar una sección, «Siguiente» abre la próxima y la guía
   sigue ahí. Usa Driver.js (github.com/kamranahmedse/driver.js, licencia MIT, js/vendor/driver-1.10.2.js), que se baja
   recién cuando alguien abre la guía.
   Se abre con: el botón «? Guía» (abajo a la izquierda), cualquier elemento con data-guia o un enlace a «#guia».
   Guarda solo dos cosas en el navegador: kn_guia_visto (localStorage: ya se ofreció la guía) y kn_guia (sessionStorage:
   en qué sección sigue mientras cambia de página). */
(function () {
  "use strict";
  if (window.KNGUIA) return;
  const VER = "1.10.2";
  const isMob = () => innerWidth <= 800;
  // [selector, título, texto, "desk" | "mob" (opcional: solo en compu o solo en celular)]
  const SEC = [
    { id: "index", u: "index.html", n: "Inicio", steps: [
      [null, "👋 Bienvenido a KyraNoHard", "En un minuto te mostramos cómo usar la web, sección por sección. Podés salir cuando quieras con la ✕ o la tecla Esc."],
      [".hacts", "⚡ ¿Qué querés hacer?", "Estos botones te llevan directo a cada herramienta: ver precios, armar una PC, saber qué actualizar, encontrar tu equipo o comparar piezas."],
      ["header.site nav", "🧭 Menú de secciones", "Desde acá vas a cada sección en cualquier momento. Las vamos a recorrer en este orden."],
      [".hsearch", "🔎 Buscador", "Escribí lo que buscás (por ejemplo «rtx 4060» o «ryzen 5 5600»). Aunque te equivoques al escribir, te mostramos los más parecidos."],
      ["#lbtn", "🛒 Mi lista", "Juntá acá los productos que te interesan: ves el total y en qué tienda conviene cada uno."],
      [".hist", "🕘 Mi historial", "Tus armados y comparaciones guardados, para volver a verlos cuando quieras."],
      ["#accbtn", "👤 Tu cuenta (opcional)", "No hace falta registrarse. Si creás una cuenta, guardás tu lista y tus productos seguidos en la nube y podés recibir avisos de bajas."],
      ["#cats", "📂 Categorías", "Entrá directo a una categoría: placas de video, procesadores, monitores, notebooks y más."]
    ] },
    { id: "productos", u: "productos.html", n: "Productos", steps: [
      [null, "🛒 Productos", "Acá ves los precios de todas las tiendas juntos. El mismo producto aparece una sola vez, con la oferta más baja primero."],
      ["#side", "🎛️ Filtros", "Elegí la categoría, un rango de precio, la marca o la tienda. Con una categoría elegida aparecen filtros propios (por ejemplo, memoria de la placa de video).", "desk"],
      ["#fbtn", "🎛️ Filtros", "Tocá acá para abrir los filtros: categoría, precio, marca, tienda y filtros propios de cada categoría.", "mob"],
      ["#tabs .tab[data-t=bajaron]", "▼ Bajaron y ▲ subieron", "Mirá solo los productos que cambiaron de precio en los últimos días. En «★ Seguidos» quedan los que marcaste con la estrella."],
      ["#vmenu", "▦ Cambiar la vista", "Elegí cómo ver los productos: íconos grandes, íconos chicos (más productos de un vistazo) o en lista."],
      ["#sort", "↕️ Ordenar", "Ordená por menor precio, mayor baja, cantidad de tiendas y más."],
      ["#grid .card", "🃏 Cada producto", "Tocalo para ver todas las tiendas, cuotas, stock y el historial de precios. ☆ lo sigue, ⚖ lo suma a la comparación y «+ Lista» lo agrega a tu lista."]
    ] },
    { id: "armado", u: "armado.html", n: "Armado de PC", steps: [
      [null, "🧩 Armado de PC", "Elegí una pieza principal y te armamos una PC completa con piezas compatibles del catálogo, sin cuello de botella."],
      ["#mode", "1️⃣ Por dónde empezar", "Empezá por la placa de video o por el procesador."],
      ["#sel", "2️⃣ Elegí el modelo", "Tocá el modelo que querés usar."],
      ["#ven", "3️⃣ Marca del procesador", "Dejá «La más conveniente» o elegí AMD o Intel."],
      ["#res", "4️⃣ Resolución de tu monitor", "Con esto estimamos los cuadros por segundo (FPS) en juegos."],
      ["#out", "✅ Tu PC armada", "Acá aparece cada pieza con su precio más bajo, el total, la fuente que necesitás y el rendimiento estimado."]
    ] },
    { id: "actualizar", u: "actualizar.html", n: "¿Qué actualizar?", steps: [
      [null, "⬆️ ¿Qué actualizar?", "Contanos qué PC tenés y te decimos qué pieza conviene cambiar primero para ganar más rendimiento por tu dinero."],
      ["#slots", "1️⃣ Tu PC actual", "Escribí el procesador, la placa de video y el resto de lo que tenés. Si no sabés algún dato, dejalo vacío."],
      ["#txt", "📋 ¿Tenés la lista de tu PC?", "Pegala acá y tocá «Completar los campos con este texto»: los llenamos solos."],
      ["#fps", "2️⃣ Qué rendimiento querés", "Elegí tu monitor y qué tan fluido querés jugar. El presupuesto es opcional."],
      ["#go", "3️⃣ Ver qué actualizar", "Tocá este botón y te mostramos las mejoras ordenadas, con precios del catálogo."]
    ] },
    { id: "encontra", u: "encontra.html", n: "Encontrá tu equipo", steps: [
      [null, "🎯 Encontrá tu equipo", "Unas pocas preguntas simples y te sugerimos qué comprar según tu uso y tu presupuesto."],
      ["#app", "📝 Respondé las preguntas", "Elegí para qué vas a usar el equipo, el tipo (notebook o PC) y cuánto querés gastar. Podés saltear las que no sepas."],
      ["#nx", "➡️ Avanzá", "Con «Siguiente» pasás a la próxima pregunta; al final ves las opciones con sus puntos fuertes y lo que les falta."]
    ] },
    { id: "comparar", u: "comparar.html", n: "Comparar hardware", steps: [
      [null, "⚖️ Comparar hardware", "Poné hasta 4 piezas de la misma categoría lado a lado: especificaciones, rendimiento, precio y una conclusión."],
      ["#cats", "1️⃣ Elegí la categoría", "Placas de video, procesadores, memorias y más."],
      ["#q", "2️⃣ Buscá y sumá productos", "Escribí el nombre o el modelo y tocá el resultado para sumarlo. También podés sumarlos desde Productos con «⚖ Comparar»."],
      ["#out", "📊 La comparación", "Acá aparecen la tabla, los gráficos y qué conviene según el uso. Con «Copiar enlace» la compartís."],
      ["#kn-guia", "❓ ¿Te perdiste?", "Tocá este botón cuando quieras para volver a ver la guía. Y si tenés dudas, preguntale al asistente."]
    ] }
  ];
  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase().replace(/\.html$/, "") || "index";
  const here = SEC.findIndex(s => s.id === file);
  const ss = { get() { try { return JSON.parse(sessionStorage.getItem("kn_guia") || "null"); } catch (e) { return null; } },
    set(v) { try { v ? sessionStorage.setItem("kn_guia", JSON.stringify(v)) : sessionStorage.removeItem("kn_guia"); } catch (e) { } } };
  const seen = { get() { try { return localStorage.getItem("kn_guia_visto") === "1"; } catch (e) { return true; } }, set() { try { localStorage.setItem("kn_guia_visto", "1"); } catch (e) { } } };

  let LIB = null;
  function lib() {
    if (window.driver && window.driver.js) return Promise.resolve(window.driver.js.driver);
    if (!LIB) LIB = new Promise(res => {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = `js/vendor/driver-${VER}.css`; document.head.appendChild(l);
      const s = document.createElement("script"); s.src = `js/vendor/driver-${VER}.js`; s.async = true;
      s.onload = () => res(window.driver && window.driver.js ? window.driver.js.driver : null);
      s.onerror = () => { LIB = null; res(null); };
      document.head.appendChild(s);
    });
    return LIB;
  }
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(), c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== "hidden" && c.display !== "none"; };
  const okStep = s => !s[3] || (s[3] === "mob") === isMob();
  // espera (hasta ~4 s) a que aparezcan las partes que la página dibuja después de cargar los datos
  function ready(sec) {
    const want = sec.steps.filter(s => s[0] && okStep(s));
    return new Promise(res => { const t0 = Date.now(); (function tick() {
      if (want.every(s => visible(document.querySelector(s[0]))) || Date.now() - t0 > 4000) return res();
      setTimeout(tick, 150); })(); });
  }
  function toast(t) {
    let el = document.getElementById("kn-gtoast"); if (!el) { el = document.createElement("div"); el.id = "kn-gtoast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 4200);
  }
  let D = null, busy = false;
  function go(si, at) { ss.set({ s: si, at }); location.href = SEC[si].u; }
  async function start(si, at) {
    if (busy) return; busy = true;
    try {
      if (si == null || si < 0) si = 0;
      if (si !== here) { go(si, at || "first"); return; }
      closeInvite();
      const p = document.getElementById("ctas-p"); if (p && getComputedStyle(p).display !== "none") { const x = document.getElementById("ctas-x"); if (x) x.click(); }
      const mk = await lib();
      if (!mk) { ss.set(null); toast("No se pudo abrir la guía. Revisá tu conexión y probá de nuevo."); return; }
      const sec = SEC[si]; await ready(sec);
      const steps = sec.steps.filter(okStep).filter(s => !s[0] || visible(document.querySelector(s[0])));
      const last = si === SEC.length - 1, n = steps.length;
      let leaving = false;
      const out = steps.map(([el, title, description], i) => {
        const popover = { title, description };
        if (i === n - 1) {
          popover.nextBtnText = last ? "¡Listo!" : `Ir a ${SEC[si + 1].n} →`;
          if (!last) popover.onNextClick = () => { leaving = true; D.destroy(); go(si + 1, "first"); };
        }
        if (i === 0) {
          if (si > 0) { popover.prevBtnText = `← ${SEC[si - 1].n}`; popover.disableButtons = []; popover.onPrevClick = () => { leaving = true; D.destroy(); go(si - 1, "last"); }; }
          else popover.showButtons = ["next", "close"];
        }
        return el ? { element: el, popover } : { popover };
      });
      if (D) D.destroy();
      D = mk({
        steps: out, showProgress: true, progressText: `${sec.n} · {{current}} de {{total}} · sección ${si + 1} de ${SEC.length}`,
        nextBtnText: "Siguiente →", prevBtnText: "← Atrás", doneBtnText: "¡Listo!", allowClose: true, overlayOpacity: 0.55,
        stagePadding: 6, stageRadius: 12, popoverClass: "kn-tour", smoothScroll: true, disableActiveInteraction: true,
        onDestroyed: () => { D = null; seen.set(); if (leaving) return; ss.set(null);
          toast(last ? "¡Listo! Ya conocés toda la web. La guía la volvés a ver con el botón «? Guía» de abajo a la izquierda." : "Guía cerrada. La volvés a ver con el botón «? Guía» de abajo a la izquierda."); }
      });
      ss.set(null);
      D.drive(at === "last" ? n - 1 : 0);
    } finally { busy = false; }
  }

  function closeInvite() { const v = document.getElementById("kn-ginv"); if (v) v.remove(); }
  function invite() {   // primera visita a la portada: se ofrece la guía una sola vez (nunca arranca sola)
    if (seen.get() || file !== "index" || navigator.webdriver) return;
    setTimeout(() => {
      if (seen.get() || D || document.getElementById("kn-ginv")) return;
      document.body.insertAdjacentHTML("beforeend", `<div id="kn-ginv" role="dialog" aria-label="Guía rápida"><b>¿Primera vez en KyraNoHard?</b><span>Te mostramos en un minuto cómo usar cada sección.</span><div><button type="button" class="pri" data-guia>Ver la guía rápida</button><button type="button" class="sec" id="kn-ginv-no">Ahora no</button></div></div>`);
      document.getElementById("kn-ginv-no").onclick = () => { seen.set(); closeInvite(); };
    }, 2500);
  }
  function mount() {
    if (!document.getElementById("kn-guia")) document.body.insertAdjacentHTML("beforeend",
      '<button type="button" id="kn-guia" data-guia aria-label="Guía rápida: cómo usar la web" title="Guía rápida: cómo usar la web"><span aria-hidden="true">?</span><b>Guía</b></button>');
    document.addEventListener("click", e => {
      const t = e.target.closest && e.target.closest('[data-guia],a[href="#guia"]'); if (!t) return;
      e.preventDefault(); if (t.closest("#kn-ginv")) seen.set();
      // el botón «? Guía» explica la sección donde estás; la invitación y «¿Primera vez?» empiezan desde el principio
      const from = t.dataset.guia === "inicio" || t.closest("#kn-ginv") ? 0 : (here >= 0 ? here : 0);
      start(from, "first");
    });
    const pend = ss.get();
    if (pend && pend.s === here) setTimeout(() => start(here, pend.at), 300); else { if (pend) ss.set(null); invite(); }
  }
  window.KNGUIA = { start, sections: SEC.map(s => s.id) };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
