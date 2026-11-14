/* KyraNoHard · encabezado, pie de página y botón «Volver arriba» comunes a TODAS las páginas.
   Así el encabezado es idéntico en cada sección (logo, menú, buscador y carrito siempre visibles). */
(function () {
  "use strict";
  const NAV = [
    ["productos.html", "Productos", "productos"],
    ["armado.html", "Armado de PC", "armado"],
    ["actualizar.html", "¿Qué actualizar?", "actualizar"],
    ["encontra.html", "Encontrá tu equipo", "encontra"],
    ["comparar.html", "Comparar hardware", "comparar"]
  ];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const page = (document.body && document.body.dataset.page) || (file.replace(".html", "") || "index");
  const isProducts = file === "productos.html" || file === "productos";   // solo el listado filtra en vivo; producto.html se comporta como las demás secciones

  const CART = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.7l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7H6"/></svg>';
  const LENS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

const USER_ICO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
const HIST_ICO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>';
  function listCount() { try { const l = JSON.parse(localStorage.getItem("lista") || "[]"); return Array.isArray(l) ? l.length : 0; } catch { return 0; } }

  const header = `<header class="site"><div class="hin">
    <a class="logo" href="index.html" aria-label="KyraNoHard, ir al inicio"><img src="img/logo.svg" width="30" height="30" alt=""><b>Kyra<i>No</i><span>Hard</span></b></a>
    <nav aria-label="Secciones">${NAV.map(([h, t, id]) => `<a href="${h}"${id === page ? ' class="on" aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
    <div class="hsearch">${LENS}<input id="qh" type="search" placeholder="Buscar productos: ryzen 5 5500, rtx 4060…" aria-label="Buscar productos" autocomplete="off"></div>
    <button class="bell" id="abtn" hidden aria-haspopup="dialog" aria-label="Avisos de bajas de precio" title="Avisos de bajas de precio">🔔</button>
    <a class="hist" href="historial.html" aria-label="Mi historial de armados y comparaciones" title="Mi historial de armados y comparaciones"${page === "historial" ? ' aria-current="page"' : ""}>${HIST_ICO}</a>
    <a class="acct" id="accbtn" href="cuenta.html" hidden aria-label="Ingresar o crear cuenta" title="Ingresar o crear cuenta"${page === "cuenta" ? ' aria-current="page"' : ""}>${USER_ICO}</a>
    <button class="cart" id="lbtn" aria-haspopup="dialog" aria-label="Mi lista de compra" title="Mi lista de compra">${CART}<span class="cn" id="lcount" data-n="0">0</span></button>
  </div></header>`;

  const footer = `<footer class="site"><div class="fin">
    <div><div class="flogo"><img src="img/logo.svg" width="26" height="26" alt=""><b>Kyra<i>No</i><span>Hard</span></b></div>
      <p>Comparador independiente de hardware en Argentina: precios, stock y cuotas de varias tiendas en un solo lugar, con datos técnicos verificados.</p>
      <p><b>No vendemos productos.</b> Cada botón «Ir a la tienda» te lleva al sitio del vendedor, donde se hace la compra.</p></div>
    <div><h4>Secciones</h4><ul>${[["index.html", "Inicio"]].concat(NAV.map(n => [n[0], n[1]])).map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join("")}</ul></div>
    <div><h4>Información</h4><ul>
      <li><a href="index.html#como">Cómo funciona</a></li>
      <li><a href="tiendas.html">Tiendas</a></li>
      <li><a href="#guia" data-guia="inicio">Guía rápida</a></li>
      <li><a href="preguntas.html">Preguntas frecuentes</a></li>
      <li><a href="index.html#confianza">Datos y confiabilidad</a></li>
      <li><a href="historial.html">Mi historial</a></li>
      <li id="facct" hidden><a href="cuenta.html">Mi cuenta</a></li>
      <li><a href="https://github.com/brunogagna9-stack/Comparador" target="_blank" rel="noopener">Proyecto en GitHub ↗</a></li></ul></div>
    <div><h4>Legal y contacto</h4><ul>
      <li><a href="privacidad.html">Política de privacidad</a></li>
      <li><a href="terminos.html">Términos y condiciones</a></li>
      <li><a href="contacto.html">Contacto</a></li>
      <li id="fcontact" hidden></li></ul>
      <p>Los precios y el stock se leen automáticamente de cada tienda y pueden cambiar: <b>verificá en la tienda antes de comprar</b>.</p>
      <p id="fupd" class="sub"></p></div>
  </div>
  <div class="fbot"><span>© ${new Date().getFullYear()} KyraNoHard · Proyecto independiente: no está afiliado, asociado ni respaldado por las tiendas ni por los fabricantes que se muestran. Marcas, logos y nombres comerciales: propiedad de sus dueños.</span>
    <button class="up" type="button" id="fup">↑ Volver arriba</button></div></footer>
  <button id="totop" type="button" aria-label="Volver arriba">↑ Volver arriba</button>`;

  function mountHeader() {
    if (document.querySelector("header.site")) return;
    const old = document.querySelector("body > header"); if (old) old.remove();
    document.body.insertAdjacentHTML("afterbegin", header);
    CTL.count(listCount());
    // Fuera de «Productos», el buscador y el carrito llevan a Productos.
    if (!isProducts) {
      const q = document.getElementById("qh");
      q.addEventListener("keydown", e => { if (e.key === "Enter" && q.value.trim()) location.href = "productos.html?q=" + encodeURIComponent(q.value.trim()); });
      document.getElementById("lbtn").onclick = () => { location.href = "productos.html?lista=1"; };
      // actualización 36: sugerencias con foto mientras se escribe (también en el buscador grande de la portada)
      const sc = document.createElement("script"); sc.src = "js/search.js"; sc.async = true;
      sc.onload = () => { if (!window.SRCH) return; SRCH.mount(q, { host: q.parentNode, alignRight: true });
        const hq = document.getElementById("hq"); if (hq) SRCH.mount(hq, { host: hq.closest("form") || hq.parentNode }); };
      document.head.appendChild(sc);
    }
  }
  function mountFooter() {
    if (document.querySelector("footer.site")) return;
    document.body.insertAdjacentHTML("beforeend", footer);
    const top = () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
    document.getElementById("fup").onclick = top; document.getElementById("totop").onclick = top;
    // actualización 41: guía rápida (botón ❓ abajo a la izquierda; Driver.js se baja recién al abrirla)
    if (!document.querySelector('script[src$="js/guia.js"]')) { const g = document.createElement("script"); g.src = "js/guia.js"; g.async = true; document.head.appendChild(g); }
    const tt = document.getElementById("totop"), onScroll = () => tt.classList.toggle("on", window.scrollY > 700);
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    // Datos opcionales del sitio (aviso de actualización, mail de contacto, avisos de bajas).
    fetch("data/config.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null).then(cfg => {
      cfg = cfg || {};
      const c = cfg.contact_email;
      if (typeof c === "string" && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(c)) { const li = document.getElementById("fcontact"); li.hidden = false; li.innerHTML = `<a href="mailto:${esc(c)}">${esc(c)}</a>`; }
      const A = cfg.alerts || {}, ok = u => typeof u === "string" && /^https:\/\//.test(u);
      setupAds(cfg.ads || {});
      // Cuentas (actualización 32): solo si config.json tiene los datos de Supabase; si no, no se carga nada.
      const ac = cfg.accounts || {};
      if (typeof ac.supabase_url === "string" && ac.supabase_url) document.getElementById("facct").hidden = false;
      if (typeof ac.supabase_url === "string" && ac.supabase_url && typeof ac.supabase_publishable_key === "string" && ac.supabase_publishable_key && !window.ACC && !document.querySelector('script[src$="js/account.js"]')) {
        const sc = document.createElement("script"); sc.src = "js/account.js"; document.head.appendChild(sc); }
      if (!isProducts && (ok(A.email_form_url) || ok(A.whatsapp_channel_url))) { const b = document.getElementById("abtn"); b.hidden = false; b.onclick = () => { location.href = "productos.html?avisos=1"; }; }
    });
    fetch("data/meta.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null).then(m => {
      if (m && m.updated) { const d = new Date(m.updated); if (!isNaN(d)) document.getElementById("fupd").textContent = "Última lectura de precios: " + d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }); }
    });
  }

  /* Publicidad y medición: APAGADAS mientras data/config.json no tenga los identificadores (ads.client / ads.analytics_id).
     Los anuncios van solo en lugares fijos marcados con <div class="ad-slot" data-slot="…">; nunca cambian resultados ni orden. */
  function setupAds(ads) {
    const client = typeof ads.client === "string" && /^ca-pub-\d{10,20}$/.test(ads.client) ? ads.client : null;
    const ga = typeof ads.analytics_id === "string" && /^G-[A-Z0-9]{4,}$/.test(ads.analytics_id) ? ads.analytics_id : null;
    if (!client && !ga) return;
    const add = (src, attrs) => { const sc = document.createElement("script"); sc.async = true; sc.src = src; Object.assign(sc, attrs || {}); document.head.appendChild(sc); };
    if (ga) { add("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ga)); window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); }; window.gtag("js", new Date()); window.gtag("config", ga, { anonymize_ip: true }); }
    if (client) {
      add("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(client), { crossOrigin: "anonymous" });
      const slots = ads.slots || {};
      document.querySelectorAll(".ad-slot[data-slot]").forEach(el => { const id = slots[el.dataset.slot]; if (!/^\d{6,12}$/.test(String(id || ""))) return;
        el.hidden = false; el.innerHTML = `<span class="ad-lbl">Publicidad</span><ins class="adsbygoogle" style="display:block" data-ad-client="${esc(client)}" data-ad-slot="${esc(id)}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { } });
    }
    // aviso de cookies (una sola vez por navegador)
    let seen = false; try { seen = localStorage.getItem("cookies-aviso") === "1"; } catch (e) { }
    if (seen) return;
    document.body.insertAdjacentHTML("beforeend", `<div id="ckbar" role="region" aria-label="Aviso de cookies"><p>Usamos cookies de Google para ${client ? "mostrar publicidad" : ""}${client && ga ? " y " : ""}${ga ? "medir las visitas" : ""}. Los anuncios no cambian los resultados. <a href="privacidad.html">Más información</a></p><button type="button" id="ckok">Entendido</button></div>`);
    document.getElementById("ckok").onclick = () => { try { localStorage.setItem("cookies-aviso", "1"); } catch (e) { } document.getElementById("ckbar").remove(); };
  }

  const CTL = window.CTL = {
    // Actualiza el numerito del carrito (se muestra solo si hay productos en la lista).
    count(n) { const el = document.getElementById("lcount"); if (!el) return; const prev = +el.dataset.n || 0;
      el.textContent = n > 99 ? "99+" : String(n); el.dataset.n = String(n);
      if (n > prev) { const b = document.getElementById("lbtn"); [el, b].forEach(x => { x.classList.remove("bump"); void x.offsetWidth; x.classList.add("bump"); }); } },
    listCount
  };
  /* Aparición suave al hacer scroll: tarjetas, paneles y secciones (también lo que se dibuja después con JS).
     Con "reducir movimiento" o en navegadores automatizados (pruebas) no se oculta nada. */
  const RV = ".panel,.col,.card,.tile,.cat,.dp,.how>div,.trust>div,.bc,.rc,.vc,.sec-h,.hero .stat,table.gt tr,.part,.opts>*";
  function setupReveal() {
    const off = matchMedia("(prefers-reduced-motion:reduce)").matches || navigator.webdriver && !/[?&]anim=1/.test(location.search);
    if (off || !("IntersectionObserver" in window)) { document.documentElement.classList.add("noanim"); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("ct-in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
    /* late = lo que se dibuja después por una acción de la persona (elegir una opción, filtrar, cambiar de paso…):
       si ya está a la vista aparece directamente, sin desvanecerse (solo se anima lo que entra al desplazar). */
    const scan = (root, late) => { const els = [...(root.querySelectorAll ? root.querySelectorAll(RV) : [])]
        .filter(el => !el.classList.contains("ct-rv") && !el.closest(".modal,#ctas-p,header.site,footer.site,[data-norv]"));
      const vh = innerHeight, show = late ? els.map(el => el.getBoundingClientRect().top < vh) : [];   // primero se mide todo…
      els.forEach((el, i) => { if (show[i]) return;                                                     // …después se escribe
        const sib = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
        el.style.setProperty("--d", Math.min(sib, 8) * 45 + "ms"); el.classList.add("ct-rv"); io.observe(el); }); };
    scan(document, false);
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(nd => { if (nd.nodeType === 1) { if (nd.matches && nd.matches(RV)) { scan(nd.parentElement || document, true); } else scan(nd, true); } })))
      .observe(document.body, { childList: true, subtree: true });
    // red de seguridad: si algo quedó oculto (por ejemplo, al imprimir), se muestra
    addEventListener("beforeprint", () => document.querySelectorAll(".ct-rv").forEach(e => e.classList.add("ct-in")));
  }
  /* Mientras la página (o una ventana con desplazamiento propio) se desliza, se pausan los efectos de «pasar el mouse» de las
     tarjetas: si no, cada tarjeta que pasa bajo el puntero se vuelve a dibujar y el desplazamiento se traba. */
  (function () {
    let t = 0; const root = document.documentElement;
    const on = () => { if (!t) root.classList.add("ct-scrolling"); clearTimeout(t); t = setTimeout(() => { root.classList.remove("ct-scrolling"); t = 0; }, 160); };
    document.addEventListener("scroll", on, { passive: true, capture: true });
  })();
  // actualización 39: app instalable y apertura sin conexión (sw.js). Se registra después de cargar para no demorar nada.
  /* actualización 40: precarga la página a la que probablemente vas (al apoyar el mouse ~0,2 s o al tocar con el dedo),
     con las «Speculation Rules» del navegador (la técnica del proyecto quicklink de Google, sin librerías). Solo páginas de
     este sitio y solo el HTML (no ejecuta nada); los navegadores que no lo soportan lo ignoran. */
  try {
    if (HTMLScriptElement.supports && HTMLScriptElement.supports("speculationrules")) {
      const sr = document.createElement("script"); sr.type = "speculationrules";
      sr.textContent = JSON.stringify({ prefetch: [{ where: { and: [{ href_matches: "/*" }, { not: { href_matches: "*cuenta.html*" } },
        { not: { selector_matches: "a.stretch, [data-open], [target=_blank], [download]" } }] }, eagerness: "moderate" }] });
      document.head.appendChild(sr);
    }
  } catch (e) { /* sin precarga */ }
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => null); });
  if (document.body) mountHeader(); else document.addEventListener("DOMContentLoaded", mountHeader);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { mountFooter(); setupReveal(); }); else { mountFooter(); setupReveal(); }
})();
