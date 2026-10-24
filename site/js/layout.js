/* ComparáTech · encabezado, pie de página y botón «Volver arriba» comunes a TODAS las páginas.
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
  const isProducts = page === "productos";

  const CART = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.7l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.6a1.6 1.6 0 0 0 1.6-1.2L21 7H6"/></svg>';
  const LENS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  function listCount() { try { const l = JSON.parse(localStorage.getItem("lista") || "[]"); return Array.isArray(l) ? l.length : 0; } catch { return 0; } }

  const header = `<header class="site"><div class="hin">
    <a class="logo" href="index.html" aria-label="ComparáTech, ir al inicio">Compará<span>Tech</span></a>
    <nav aria-label="Secciones">${NAV.map(([h, t, id]) => `<a href="${h}"${id === page ? ' class="on" aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
    <div class="hsearch">${LENS}<input id="q" type="search" placeholder="Buscar productos: ryzen 5 5500, rtx 4060…" aria-label="Buscar productos" autocomplete="off"></div>
    <button class="bell" id="abtn" hidden aria-haspopup="dialog" aria-label="Avisos de bajas de precio" title="Avisos de bajas de precio">🔔</button>
    <button class="cart" id="lbtn" aria-haspopup="dialog" aria-label="Mi lista de compra" title="Mi lista de compra">${CART}<span class="cn" id="lcount" data-n="0">0</span></button>
  </div></header>`;

  const footer = `<footer class="site"><div class="fin">
    <div><div class="flogo">Compará<span>Tech</span></div>
      <p>Comparador independiente de hardware en Argentina: precios, stock y cuotas de varias tiendas en un solo lugar, con datos técnicos verificados.</p>
      <p><b>No vendemos productos.</b> Cada botón «Ir a la tienda» te lleva al sitio del vendedor, donde se hace la compra.</p></div>
    <div><h4>Secciones</h4><ul>${[["index.html", "Inicio"]].concat(NAV.map(n => [n[0], n[1]])).map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join("")}</ul></div>
    <div><h4>Información</h4><ul>
      <li><a href="index.html#como">Cómo funciona</a></li>
      <li><a href="index.html#confianza">Datos y confiabilidad</a></li>
      <li><a href="https://github.com/brunogagna9-stack/Comparador" target="_blank" rel="noopener">Proyecto en GitHub ↗</a></li>
      <li id="fcontact" hidden></li></ul></div>
    <div><h4>Importante</h4>
      <p>Los precios y el stock se leen automáticamente de cada tienda y pueden cambiar en cualquier momento: <b>verificá en la tienda antes de comprar</b>.</p>
      <p>Las reseñas de las tiendas son el puntaje público de Google Maps, con su fecha. Si una tienda no tiene reseñas verificables, lo decimos.</p>
      <p id="fupd" class="sub"></p></div>
  </div>
  <div class="fbot"><span>© ${new Date().getFullYear()} ComparáTech · Proyecto independiente, sin relación comercial con las tiendas. Marcas y logos: propiedad de sus dueños.</span>
    <button class="up" type="button" id="fup">↑ Volver arriba</button></div></footer>
  <button id="totop" type="button" aria-label="Volver arriba">↑ Volver arriba</button>`;

  function mountHeader() {
    if (document.querySelector("header.site")) return;
    const old = document.querySelector("body > header"); if (old) old.remove();
    document.body.insertAdjacentHTML("afterbegin", header);
    CTL.count(listCount());
    // Fuera de «Productos», el buscador y el carrito llevan a Productos.
    if (!isProducts) {
      const q = document.getElementById("q");
      q.addEventListener("keydown", e => { if (e.key === "Enter" && q.value.trim()) location.href = "productos.html?q=" + encodeURIComponent(q.value.trim()); });
      document.getElementById("lbtn").onclick = () => { location.href = "productos.html?lista=1"; };
    }
  }
  function mountFooter() {
    if (document.querySelector("footer.site")) return;
    document.body.insertAdjacentHTML("beforeend", footer);
    const top = () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth" });
    document.getElementById("fup").onclick = top; document.getElementById("totop").onclick = top;
    const tt = document.getElementById("totop"), onScroll = () => tt.classList.toggle("on", window.scrollY > 700);
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    // Datos opcionales del sitio (aviso de actualización, mail de contacto, avisos de bajas).
    fetch("data/config.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null).then(cfg => {
      cfg = cfg || {};
      const c = cfg.contact_email;
      if (typeof c === "string" && /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i.test(c)) { const li = document.getElementById("fcontact"); li.hidden = false; li.innerHTML = `<a href="mailto:${esc(c)}">Contacto: ${esc(c)}</a>`; }
      const A = cfg.alerts || {}, ok = u => typeof u === "string" && /^https:\/\//.test(u);
      if (!isProducts && (ok(A.email_form_url) || ok(A.whatsapp_channel_url))) { const b = document.getElementById("abtn"); b.hidden = false; b.onclick = () => { location.href = "productos.html?avisos=1"; }; }
    });
    fetch("data/meta.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null).then(m => {
      if (m && m.updated) { const d = new Date(m.updated); if (!isNaN(d)) document.getElementById("fupd").textContent = "Última lectura de precios: " + d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) + "."; }
    });
  }

  const CTL = window.CTL = {
    // Actualiza el numerito del carrito (se muestra solo si hay productos en la lista).
    count(n) { const el = document.getElementById("lcount"); if (!el) return; el.textContent = n > 99 ? "99+" : String(n); el.dataset.n = String(n); },
    listCount
  };
  if (document.body) mountHeader(); else document.addEventListener("DOMContentLoaded", mountHeader);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountFooter); else mountFooter();
})();
