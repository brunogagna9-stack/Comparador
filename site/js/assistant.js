/* ComparáTech · asistente virtual.
   Motor local (reglas + datos de la página y del catálogo) con respaldo opcional de una IA a través de un proxy propio.
   Orden de confianza de cada respuesta:  1) estado de la página  2) catálogo verificado (productos, fichas, tiendas)
   3) explicación general (marcada como tal)  4) "no tengo ese dato".
   NO es una IA generativa por sí mismo: sin proxy configurado responde con reglas y lo dice. No lleva claves privadas. */
(function (root) {
  "use strict";
  const CT = root.CT || (typeof require !== "undefined" ? require("./lib.js") : null);

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const has = (q, re) => re.test(q);
  const P = text => ({ t: "p", text });
  const UL = items => ({ t: "ul", items });
  const fmtN = (n, d = 0) => Number(n).toLocaleString("es-AR", { maximumFractionDigits: d });

  /* ---------------- glosario (explicación general, no datos de tiendas) ---------------- */
  const GLOSSARY = [
    { re: /nucleo|hilo|thread|core\b/, term: "Núcleos e hilos", text: "Los núcleos son las unidades que ejecutan tareas en el procesador; los hilos permiten que cada núcleo atienda dos tareas a la vez en muchos modelos. Más núcleos ayudan en edición de video, render y multitarea. Para jugar suele importar más la velocidad de cada núcleo que la cantidad." },
    { re: /vram|memoria de (la )?(placa|video)|memoria de video/, term: "VRAM", text: "Es la memoria propia de la placa de video: guarda texturas y datos del juego. 8 GB alcanza para 1080p, pero algunos juegos nuevos a 1440p o 4K con texturas altas piden más. Más VRAM no hace más rápida a una placa por sí sola." },
    { re: /ddr4|ddr5|\bddr\b/, term: "DDR4 y DDR5", text: "Son generaciones de memoria RAM y no son intercambiables: la placa madre define cuál usa. DDR5 es más nueva y rápida, pero suele costar más y exige plataformas más nuevas (por ejemplo AM5). En uso diario la diferencia se nota menos que la capacidad: 16 GB de cualquiera suele rendir mejor que 8 GB de la más nueva." },
    { re: /tdp|tgp|consumo|vatios|watts?\b/, term: "Consumo (TDP/TGP)", text: "Es la potencia en vatios que declara el fabricante. Sirve para dimensionar la fuente, pero no es el consumo exacto: depende del uso. Al elegir fuente conviene dejar margen (alrededor de un 25 %) y respetar la fuente recomendada por el fabricante de la placa de video." },
    { re: /socket|zocalo/, term: "Socket", text: "Es el conector donde se instala el procesador en la placa madre, y deben coincidir (por ejemplo AM4, AM5, LGA1700 o LGA1851). Un mismo socket no garantiza que todos los procesadores funcionen: a veces hace falta actualizar el BIOS de la placa." },
    { re: /nvme|sata|\bm\.?2\b|ssd|disco solido/, term: "SSD: SATA, NVMe y M.2", text: "M.2 es el formato físico (una plaquita) y NVMe el protocolo rápido; existen M.2 que son SATA. Un SSD SATA llega a unos 550 MB/s y un NVMe a varios miles. En el uso diario la diferencia se siente menos que pasar de un disco rígido a cualquier SSD." },
    { re: /\bhz\b|hertz|tasa de refresco|frecuencia de actualizacion/, term: "Hz (tasa de refresco)", text: "Son las imágenes por segundo que puede mostrar el monitor. 60 Hz es lo estándar; 144 Hz o más se nota en juegos competitivos, pero solo si tu PC logra esos FPS." },
    { re: /80 ?plus|certificacion de (la )?fuente/, term: "80 Plus", text: "Mide la eficiencia de la fuente (Bronze < Silver < Gold < Platinum < Titanium), no la calidad de sus componentes ni sus protecciones. Una Gold eficiente puede ser peor que una Bronze de mejor fabricación: conviene mirar reseñas independientes." },
    { re: /1080|1440|\b4k\b|resolucion|full ?hd|qhd/, term: "Resolución", text: "Es la cantidad de píxeles de la imagen: 1080p (Full HD) < 1440p (QHD) < 4K. A más resolución, más nitidez pero más exigencia para la placa de video; por eso los FPS bajan al subirla." },
    { re: /\bips\b|\bva\b|\btn\b|oled|panel/, term: "Tipos de panel", text: "IPS: buenos colores y ángulos de visión. VA: mejor contraste y negros. TN: muy rápido pero con peor imagen. OLED: contraste máximo, con más precio y cuidado por el riesgo de quemado en usos estáticos." },
    { re: /dual ?channel|doble canal/, term: "Dual channel", text: "Usar dos módulos de RAM iguales en vez de uno solo duplica el ancho de banda de la memoria. Mejora el rendimiento, sobre todo si usás gráficos integrados." },
    { re: /gr[aá]ficos integrados|igpu|integrada|apu/, term: "Gráficos integrados", text: "Son la unidad de video dentro del procesador. Alcanzan para oficina, estudio y videos, y para juegos livianos en algunos modelos. Los Intel con sufijo F no los traen y necesitan placa de video aparte." },
    { re: /cuello de botella|bottleneck/, term: "Cuello de botella", text: "Ocurre cuando un componente limita el rendimiento de otro, por ejemplo un procesador lento que no deja lucirse a una placa de video potente. No es una falla: se resuelve equilibrando las piezas." },
    { re: /\bfps\b|cuadros por segundo/, term: "FPS", text: "Son los cuadros por segundo del juego. Alrededor de 30 es jugable pero poco fluido, 60 es lo cómodo y 100 o más se aprecia en juegos competitivos con monitor de alta frecuencia." },
    { re: /dlss|fsr|frame ?gen|escalado/, term: "DLSS, FSR y generación de cuadros", text: "Son técnicas que renderizan a menor resolución y escalan la imagen, o inventan cuadros intermedios, para dar más FPS. Ayudan, pero dependen de cada juego y de la placa, y no reemplazan la potencia bruta." },
    { re: /\bwh\b|\bmah\b|autonomia|bateria/, term: "Batería y autonomía", text: "La capacidad se mide en Wh (vatios-hora); los mAh no son comparables sin conocer el voltaje. La autonomía que anuncia un fabricante se mide en pruebas livianas y casi nunca coincide con el uso real. ComparáTech no la usa como si fuera un dato medido." },
    { re: /garantia oficial|garantia de la tienda|garantia/, term: "Garantía", text: "La garantía oficial la da el fabricante y se rige por sus plazos. Muchas tiendas suman una garantía propia más corta, o una prueba de pocos días. Conviene leer la política de la tienda antes de comprar." },
    { re: /cuota|precio de lista|contado|efectivo/, term: "Precio de contado y de lista", text: "El precio de contado (efectivo o transferencia) suele ser menor que el de lista, que es el que se usa para las cuotas. Mostramos el de contado como referencia y marcamos las cuotas que cada tienda informa." },
    { re: /pc armada|armar|por componentes/, term: "PC armada o por componentes", text: "Una PC armada llega lista y con garantía del conjunto; por componentes suele rendir más por el mismo dinero y se puede mejorar pieza por pieza, pero hay que cuidar la compatibilidad y armarla." },
  ];

  const STORE_ALIASES = {
    Compragamer: /compra ?gamer/, MEXX: /\bmexx\b/, Maximus: /maximus/, Gezatek: /gezatek/, Fullh4rd: /full ?h4rd|fullhard|full hard/,
    Logg: /\blogg\b/, GoldenTech: /golden ?tech/, Armytech: /army ?tech/,
    Katech: /\bkatech\b/, Venex: /\bvenex\b/, "Gaming City": /gaming ?city/, "NET Gaming": /net ?gaming/,
  };

  const USO_WORDS = [
    [/oficina|office|excel|trabajo de oficina/, "oficina"], [/estudi|facultad|universidad|colegio|clases|tareas/, "estudio"],
    [/program|desarroll|codigo/, "programacion"], [/multitarea|muchas (cosas|aplicaciones|pesta)/, "multitarea"],
    [/dise[nñ]o|photoshop|ilustrator|ilustraci/, "diseno"], [/video|premiere|davinci|editar/, "video"],
    [/3d|render|blender|autocad|\bcad\b|arquitect/, "render3d"], [/stream|twitch|grabar|youtube/, "streaming"],
    [/valorant|cs ?2|counter|\blol\b|league|dota|free ?fire|rocket|competitiv/, "gaming_comp"],
    [/cyberpunk|alan wake|black myth|elden|hogwarts|exigente|ultra|aaa|gr[aá]ficos altos/, "gaming_pesado"],
    [/fortnite|minecraft|gta|roblox|fifa|ea fc|casual/, "gaming_casual"],
  ];

  function parseBudget(raw) {
    const q = norm(raw);
    if (!/presupuesto|\$|pesos|hasta|gastar|gasto|tengo|millon|\bmil\b|\d{2,3}[.,]\d{3}|\d+ ?k\b/.test(q)) return null;
    const m = q.match(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(millones|millon|mill|mil|k)?\b/);
    if (!m) return null;
    let s = m[1], n;
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) n = parseFloat(s.replace(/[.,]/g, ""));
    else n = parseFloat(s.replace(",", "."));
    const u = m[2];
    if (u && /^mill?(on|ones)?$|^millon/.test(u)) n *= 1e6; else if (u === "mil" || u === "k") n *= 1e3;
    return n >= 100000 ? Math.round(n) : null;
  }

  function parseRec(raw) {
    const q = norm(raw), r = {};
    const usos = USO_WORDS.filter(([re]) => re.test(q)).map(([, id]) => id);
    if (usos.length) r.usos = [...new Set(usos)];
    else if (/jug|gamer|gaming|juego/.test(q)) r.vagueGaming = true;
    if (/notebook|laptop|portatil/.test(q)) r.tipo = "notebook";
    else if (/pc armada|armada|ya armada/.test(q)) r.tipo = "armada";
    else if (/por componentes|armar(la)? yo|armarla/.test(q)) r.tipo = "componentes";
    else if (/\bpc\b|computadora|compu\b/.test(q)) r.tipo = "pc";
    const b = parseBudget(raw); if (b) r.budget = b;
    if (/4k/.test(q)) r.res = "4k"; else if (/1440|2k|qhd/.test(q)) r.res = "1440"; else if (/1080|full ?hd/.test(q)) r.res = "1080";
    if (/transport|llev|viaj|mochila|portatil/.test(q)) r.portable = "si";
    if (/no se|ni idea|cualquiera|me da igual|no importa/.test(q)) r.dunno = true;
    return r;
  }

  /* ---------------- motor ---------------- */
  CT.makeAssistant = function (data, opts) {
    opts = opts || {};
    const { HW, PR, META, SPECS, STORES } = data;
    const C = CT.create(HW, PR, META || {}, SPECS || null);
    if (CT.makeFinder && !C.recommend) CT.makeFinder(C); else if (CT.makeCompare && !C.compare) CT.makeCompare(C);
    const A = { C, state: opts.state || {}, endpoint: (data.CFG && data.CFG.assistant && data.CFG.assistant.endpoint) || opts.endpoint || null };
    const byId = id => PR.find(g => g.id === id);

    /* ---- antigüedad de los datos ---- */
    A.freshness = () => {
      const u = META && META.updated; if (!u) return { text: "No tengo la fecha de la última actualización de precios.", old: true };
      const h = (Date.now() - new Date(u).getTime()) / 36e5, when = new Date(u).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
      const ago = h < 1 ? "hace menos de 1 hora" : h < 48 ? `hace ${Math.round(h)} h` : `hace ${Math.round(h / 24)} días`;
      return { text: `Los precios se actualizaron el ${when} (${ago}).`, old: h > 24, hours: h };
    };
    const stale = () => { const f = A.freshness(); return f.old ? "Ojo: pasó más de un día desde la última actualización, así que precios y stock pueden haber cambiado." : "Los precios y el stock pueden cambiar en cualquier momento: confirmalos en la tienda antes de comprar."; };

    /* ---- búsqueda de productos en el catálogo ---- */
    const STOP = new Set(["el", "la", "los", "las", "de", "del", "un", "una", "que", "es", "cuanto", "sale", "cuesta", "precio", "stock", "tiene", "tienen", "hay", "en", "para", "con", "y", "o", "me", "mi", "quiero", "busco", "donde", "comprar", "mas", "barato", "barata", "mejor", "por", "favor", "peso", "pesa", "bateria", "notebook", "este", "esta", "ese", "esa"]);
    A.findProducts = (q, n = 3) => {
      const toks = norm(q).split(/[^a-z0-9.]+/).filter(t => t && !STOP.has(t) && t.length > 1);
      if (!toks.length) return [];
      const strong = toks.filter(t => /\d/.test(t));
      return PR.map(g => {
        const nm = norm(g.name); const hit = toks.filter(t => nm.includes(t)).length;
        const sh = strong.filter(t => nm.includes(t)).length;
        return { g, hit, sh, score: hit / toks.length + sh * 0.3 };
      }).filter(x => x.hit >= Math.min(2, toks.length) && (!strong.length || x.sh >= 1) && x.hit / toks.length >= 0.6)
        .sort((a, b) => b.score - a.score || (CT.price(C.bestOffer(a.g) || {}) || 9e12) - (CT.price(C.bestOffer(b.g) || {}) || 9e12)).slice(0, n).map(x => x.g);
    };
    const offerLine = g => {
      const all = g.offers.filter(o => CT.price(o)).sort((a, b) => CT.price(a) - CT.price(b));
      return all.slice(0, 4).map(o => `${o.store}: ${CT.ARS(CT.price(o))} (${o.stock === true ? "con stock" : o.stock === false ? "sin stock" : "stock sin confirmar"})`);
    };

    /* ---- contexto de la página ---- */
    A.ctxGroups = ctx => (ctx.ids || []).map(byId).filter(Boolean);
    A.contextLines = ctx => {   // resumen mínimo que se enviaría a una IA externa (nunca datos personales)
      const L = [`Sección: ${ctx.section || "desconocida"}`];
      A.ctxGroups(ctx).slice(0, 4).forEach(g => { const o = C.bestOffer(g); L.push(`Producto: ${g.name}` + (o ? ` — ${o.store} ${CT.ARS(CT.price(o))}` : " — sin stock")); });
      if (ctx.cat) L.push(`Categoría: ${ctx.cat}`);
      if (ctx.res != null) L.push(`Resolución elegida: ${CT.RES[ctx.res] || ctx.res}`);
      if (ctx.answers) L.push("Respuestas del cuestionario: " + JSON.stringify({ usos: ctx.answers.usos, tipo: ctx.answers.tipo, budget: ctx.answers.budget, res: ctx.answers.res }));
      L.push(A.freshness().text);
      return L;
    };

    const reply = (blocks, o = {}) => Object.assign({ blocks, links: [], follow: [], src: "local", basis: "general" }, o);
    const BASIS = { app: "Basado en lo que ves en la página", cat: "Basado en el catálogo de ComparáTech", gen: "Explicación general (no es un dato de una tienda)", none: "Sin datos suficientes" };

    /* ---- respuestas por tema ---- */
    function aboutTags() {
      const T = CT.TAGS || {};
      return reply([P("Cada dato lleva una etiqueta que indica qué tan confiable es:"), UL(Object.keys(T).map(k => `${T[k][0]}: ${T[k][1]}`)),
        P("Por ejemplo, «Estimado» significa que lo calculamos nosotros a partir de otros datos, así que conviene tomarlo como orientación.")], { basis: "app" });
    }

    function aboutStores(q, wanted) {
      const S = (STORES && STORES.stores) || {}, names = wanted.length ? wanted : null;
      if (!names) {
        const live = Object.keys(S).filter(k => S[k].integration !== "no disponible"), down = Object.keys(S).filter(k => S[k].integration === "no disponible");
        return reply([P("Tiendas con precios en ComparáTech: " + (live.join(", ") || "ninguna") + "."), down.length ? P("Por ahora sin datos: " + down.map(k => `${k} (${S[k].how})`).join("; ") + ".") : P(""),
          P("Preguntame por una tienda en particular (por ejemplo «¿es confiable GoldenTech?») y te cuento su reputación verificada, contacto y garantía.")], { basis: "cat" });
      }
      const blocks = [];
      names.forEach(n => {
        const s = S[n]; if (!s) { blocks.push(P(`No tengo información cargada sobre ${n}.`)); return; }
        const wantRep = has(q, /confi|reputa|opini|resena|puntaj|calific|estrell|bueno|segur|recomend/), wantW = has(q, /garant|devol|cambio/), wantShip = has(q, /envio|despach|entrega/), wantContact = has(q, /contact|telefon|whatsapp|direccion|donde|ubic|local|sucursal|mail/);
        const any = wantRep || wantW || wantShip || wantContact;
        const lines = [];
        if (wantRep || !any) {
          if (s.reputation && s.reputation.length) s.reputation.forEach(r => lines.push(`Reputación en ${r.source}: ${fmtN(r.score, 1)} sobre 5 con ${fmtN(r.count)} opiniones (ficha «${r.listing}», consultada el ${r.date}).`));
          else lines.push("No tenemos una puntuación pública verificada de esta tienda, y no la inventamos.");
        }
        if (wantW || !any) lines.push(s.warranty ? s.warranty : "Garantía: no tenemos la política verificada; consultala en el sitio de la tienda.");
        if (wantShip || !any) lines.push(s.shipping ? s.shipping : "Envíos: el costo y los plazos no están en nuestros datos; se calculan en el carrito de la tienda y no están incluidos en los precios que mostramos.");
        if (wantContact || !any) { const c = s.contact || {}; const bits = [c.address, c.phone, c.email].filter(Boolean); lines.push(bits.length ? "Contacto: " + bits.join(" · ") : "Contacto: no lo tenemos verificado."); }
        if (!any) lines.push(`Integración: ${s.integration}. ${s.how}`);
        blocks.push(P(n + ":"), UL(lines));
        (s.notes || []).filter(x => /trustpilot|no pudimos/i.test(x) || wantRep).slice(0, 2).forEach(x => blocks.push(P(x)));
      });
      blocks.push(P("La reputación es un dato de una sola plataforma, tomado en la fecha indicada, y puede cambiar. No promediamos plataformas distintas."));
      return reply(blocks, { basis: "cat" });
    }

    function notebookFacts(g) {
      const sp = CT.parse(g.name, "notebooks"), lines = [], o = C.bestOffer(g);
      const sf = f => C.sf(g, f);
      const src = r => `${r.src}, SKU ${r.sku}, ${r.date}`;
      const peso = sf("peso");
      lines.push(peso ? `Peso: ${fmtN(peso.v, 2)} kg (${src(peso)}${peso.tag === "pend" ? "; a confirmar" : ""}).` : `Peso: no pude obtenerlo — ${C.specMissing(g, "peso") === "sin ficha" ? "la tienda no publicó una ficha técnica de este modelo" : "la ficha de la tienda no lo informa"}.`);
      const a = sf("ancho"), b = sf("prof"), c = sf("alto");
      if (a && b) lines.push(`Medidas: ${a.v} × ${b.v}${c ? " × " + c.v : ""} mm (${src(a)}).`);
      lines.push("Batería y autonomía: ninguna de las tiendas conectadas publica la capacidad (Wh) ni una autonomía medida. Buscala en la hoja técnica del fabricante; no usamos la autonomía de marketing como dato real.");
      const am = sf("ram_ampliable"); if (am) lines.push(`RAM ampliable: ${am.v ? "sí" : "no"} (${am.note}).`);
      const pn = sf("panel"); if (pn) lines.push(`Panel: ${pn.v}.`);
      const gr = sf("garantia"); if (gr) lines.push(`Garantía informada por la tienda: ${gr.v} meses.`);
      const cpu = sf("cpu"); if (cpu && cpu.tag === "pend" && cpu.note) lines.push("Atención: " + cpu.note);
      if (sp.cpu || sp.ram || sp.ssd) lines.push(`Del título de la tienda: ${[sp.cpu, sp.ram && sp.ram + " GB de RAM", sp.ssd && (sp.ssd >= 1000 ? sp.ssd / 1000 + " TB" : sp.ssd + " GB") + " SSD", sp.gpu].filter(Boolean).join(", ")}.`);
      return { title: g.name, lines, o };
    }

    function aboutNotebook(q, ctx) {
      let gs = A.findProducts(q).filter(g => g.category === "notebooks");
      if (!gs.length) gs = A.ctxGroups(ctx).filter(g => g.category === "notebooks");
      if (!gs.length) return reply([P("¿De qué notebook hablás? Elegí una en la página o escribí el modelo (por ejemplo «Lenovo Yoga 7 14AHP9») y te cuento el peso, las medidas y lo que figure de la batería.")], { basis: "none", follow: ["Notebooks con ficha de peso"] });
      const blocks = []; gs.slice(0, 2).forEach(g => { const f = notebookFacts(g); blocks.push(P(f.title), UL(f.lines)); });
      blocks.push(P("Los datos técnicos salen de la ficha pública de la tienda para ese SKU exacto (otra variante del modelo puede ser distinta). " + stale()));
      return reply(blocks, { basis: "cat", links: [{ label: "Comparar hardware", href: "comparar.html" }] });
    }

    function aboutPrice(q, ctx) {
      let gs = A.findProducts(q);
      if (!gs.length && has(q, /\b(este|esta|ese|esa|estos|estas|seleccionad\w*|elegid\w*|vemos|veo)\b/)) gs = A.ctxGroups(ctx);
      if (!gs.length) return null;
      const blocks = []; gs.forEach(g => { const l = offerLine(g); blocks.push(P(g.name), l.length ? UL(l) : P("Sin ofertas con precio en este momento.")); });
      blocks.push(P(A.freshness().text + " " + stale()));
      if (gs.some(g => g.offers.length > 1)) blocks.push(P("El precio no incluye el envío: se calcula en cada tienda."));
      return reply(blocks, { basis: "cat", links: gs.slice(0, 1).map(g => ({ label: "Ver en la tienda más barata", href: (C.bestOffer(g) || g.offers[0] || {}).url })).filter(l => l.href) });
    }

    function comparison(ctx) {
      const gs = A.ctxGroups(ctx);
      if (gs.length < 2) return reply([P("Elegí al menos dos productos de la misma categoría en el comparador y te resumo las diferencias, qué conviene según el uso y qué datos faltan.")], { basis: "app", links: [{ label: "Ir al comparador", href: "comparar.html" }] });
      const cmp = C.compare(gs.map(C.item), { res: ctx.res ?? 1 });
      const blocks = [];
      if (cmp.mixed) return reply([P("Son productos de categorías distintas: solo se pueden comparar precio, tienda y disponibilidad.")], { basis: "app" });
      const diffs = cmp.rows.filter(r => r.differs && !["name", "price", "store", "stock"].includes(r.id)).slice(0, 6);
      if (diffs.length) blocks.push(P("Diferencias principales:"), UL(diffs.map(r => `${r.label}: ` + r.cells.map((c, i) => `${gs[i].name.slice(0, 28)}… ${c.disp}`).join(" · "))));
      const dec = cmp.uses.filter(u => u.winner != null);
      if (dec.length) blocks.push(P("Qué conviene según lo que busques:"), UL(dec.map(u => `${u.use.label}: ${gs[u.winner].name.slice(0, 40)}… (${u.why[0] || "mejor puntaje relativo"})`)));
      const ties = cmp.uses.filter(u => u.winner == null);
      if (ties.length) blocks.push(P("Sin ganador claro: " + ties.map(u => `${u.use.label} (${u.reason})`).join("; ") + "."));
      const missing = cmp.rows.filter(r => r.cells.some(c => c.tag === "nd") && !["store", "stock"].includes(r.id)).map(r => r.label);
      if (missing.length) blocks.push(P("Datos que faltan para alguno: " + missing.slice(0, 6).join(", ") + ". No los inferimos."));
      C.notes(cmp).slice(0, 2).forEach(n => blocks.push(P(n)));
      return reply(blocks, { basis: "app" });
    }

    function armadoCtx(ctx) {
      const gpu = (HW.gpus || []).find(g => g.id === ctx.gpuId);
      if (!gpu) return reply([P("Elegí una placa de video en la página y te explico qué procesador, fuente y memoria conviene para ella y cuánto cuesta cada configuración.")], { basis: "app" });
      const ar = C.armado(gpu, ctx.res || 0), part = (parts, slot) => ((parts.find(p => p.slot === slot) || {}).title || "").replace(/^[^:]{3,22}:\s*/, "") || null;
      const lines = [`Placa elegida: ${gpu.name}.`, `Mínima sin cuello de botella: procesador ${part(ar.min, "cpu") || "sin dato"}, fuente ${part(ar.min, "psu") || "sin dato"}. Total estimado ${CT.ARS(ar.totalMin.total)}.`,
        `Sugerida: procesador ${part(ar.sug, "cpu") || "sin dato"}, fuente ${part(ar.sug, "psu") || "sin dato"}. Total estimado ${CT.ARS(ar.totalSug.total)}.`];
      return reply([UL(lines), P("Los totales suman los componentes más baratos con stock en el catálogo; no incluyen envío. " + stale())], { basis: "app" });
    }

    /* ---- recomendación guiada con preguntas de seguimiento ---- */
    function recommend(q, ctx) {
      const st = A.state.rec = Object.assign({}, A.state.rec);
      const p = parseRec(q);
      if (p.usos) st.usos = p.usos; if (p.tipo) st.tipo = p.tipo; if (p.budget) st.budget = p.budget; if (p.res) st.res = p.res; if (p.portable) st.portable = p.portable;
      if (p.vagueGaming && !st.usos) {
        return reply([P("Para recomendarte bien necesito saber qué juegos querés correr, porque cambia mucho lo que necesitás:"), UL(["Livianos (Fortnite, Minecraft, GTA V): gaming casual.", "Competitivos (Valorant, CS2, LoL): muchos FPS.", "Exigentes (Cyberpunk, Hogwarts Legacy, juegos nuevos a gráficos altos): requieren más placa de video."]), P("¿Cuál se parece más a lo tuyo? Podés nombrar un juego.")], { basis: "app", follow: ["Valorant y Fortnite", "Cyberpunk en 1440p", "No sé"] });
      }
      if (!st.usos) return reply([P("¿Para qué lo vas a usar principalmente? (por ejemplo: estudiar, programar, editar video, jugar a Valorant, diseñar…)")], { basis: "app", follow: ["Estudiar y oficina", "Editar video", "Jugar a Cyberpunk"] });
      if (!st.budget && !p.dunno) return reply([P("Tengo claro el uso. ¿Qué presupuesto aproximado tenés, en pesos? Si no lo sabés, decime «no sé» y te muestro opciones de distintos precios.")], { basis: "app", follow: ["1.500.000", "3 millones", "No sé"] });
      const a = { usos: st.usos, tipo: st.tipo || null, budget: st.budget || null, res: st.res || (st.usos.some(u => /gaming/.test(u)) ? "1080" : null), portable: st.portable || null, enfoque: null };
      if (!C.recommend) return reply([P("Abrí «Encontrá tu equipo» para ver las opciones.")], { links: [{ label: "Encontrá tu equipo", href: "encontra.html" }] });
      const R = C.recommend(a); A.state.rec = null;
      const out = [];
      R.sections.forEach(s => (s.picks || []).slice(0, 2).forEach(pk => out.push(`${pk.label}: ${pk.c.g ? pk.c.g.name : "PC por componentes"} — ${CT.ARS(pk.c.total)}${pk.c.o ? " en " + pk.c.o.store : ""}`)));
      if (!out.length) return reply([P(R.insufficient ? `No encontré opciones que cumplan lo que necesitás: ${R.insufficient.reason}.` + (R.insufficient.minTotal ? ` La opción más económica que cumple cuesta unos ${CT.ARS(R.insufficient.minTotal)}.` : "") : "No encontré opciones con stock que cumplan eso en el catálogo.")], { basis: "cat", links: [{ label: "Encontrá tu equipo", href: "encontra.html" }] });
      return reply([P("Según el catálogo actual, estas serían buenas opciones para lo que me contaste:"), UL(out.slice(0, 4)), P("Para ver el detalle (qué hace bien, limitaciones, datos pendientes) y ajustar prioridades, usá el cuestionario completo. " + stale())], { basis: "cat", links: [{ label: "Ver recomendaciones completas", href: "encontra.html" }] });
    }

    function glossary(q) {
      const hits = GLOSSARY.filter(e => e.re.test(q));
      if (!hits.length) return null;
      return reply(hits.slice(0, 2).flatMap(e => [P(e.term + ":"), P(e.text)]), { basis: "gen" });
    }

    function compat() {
      return reply([P("Para que dos piezas sean compatibles hay que revisar:"), UL(["Procesador y placa madre: mismo socket (AM4, AM5, LGA1700, LGA1851…) y a veces versión de BIOS.", "Memoria: la placa define si usa DDR4 o DDR5.", "Placa de video: espacio en el gabinete y fuente con vatios y conectores suficientes.", "Gabinete y placa: formato (ATX, Micro-ATX, Mini-ITX)."]), P("En «Armado de PC» elegís una placa de video y te mostramos una configuración sin cuello de botella con los componentes del catálogo."), P("Esto es una guía general: confirmá la compatibilidad exacta de tus modelos en la ficha del fabricante.")], { basis: "gen", links: [{ label: "Armado de PC", href: "armado.html" }] });
    }

    /* ---- punto de entrada local ---- */
    A.local = (question, ctx) => {
      ctx = ctx || {};
      const q = norm(question).trim();
      if (!q) return reply([P("Escribí tu pregunta y te ayudo.")], { basis: "none" });
      if (has(q, /^(hola|buenas|buen dia|buenas tardes|buenas noches|hey|que tal)\b/) && q.length < 25) return reply([P("¡Hola! Soy el asistente de ComparáTech. Puedo explicarte términos técnicos, comparar productos, contarte qué datos tenemos de las tiendas y recomendarte un equipo. ¿Qué necesitás?")], { basis: "gen", follow: A.suggestions(ctx) });
      const stores = Object.keys(STORE_ALIASES).filter(k => STORE_ALIASES[k].test(q));
      if (A.state.rec && !has(q, /^(que es|cuanto|precio)/)) return recommend(question, ctx);
      if (has(q, /etiqueta|verificado|estimado|pendiente de verif|sin datos|que significa (el|la) (cartel|marca)/)) return aboutTags();
      if (stores.length || has(q, /(que )?tiendas|donde (compro|conviene)|confiable|reputacion|opiniones de la tienda/)) {
        if (stores.length || has(q, /tiendas|confiable|reputacion/)) return aboutStores(q, stores);
      }
      if (has(q, /actualiz|desactualiz|cuando se actualiz|que tan viejo|datos viejos|frescos/)) return reply([P(A.freshness().text), P(stale())], { basis: "app" });
      if (has(q, /peso|pesa|bateria|autonomia|medidas|liviana|ampliable|garantia/) && (has(q, /notebook|laptop/) || A.ctxGroups(ctx).some(g => g.category === "notebooks") || A.findProducts(question).some(g => g.category === "notebooks"))) return aboutNotebook(question, ctx);
      if (has(q, /^(que|qu[eé]) (es|son|significa)|para que sirve|explic|diferencia (entre|de)|vale la pena|no entiendo/) && !has(q, /diferencias? (entre|de) (estos|los dos|ambos)/)) { const g = glossary(q); if (g) return g; }
      if (ctx.section === "comparar" && has(q, /diferenc|resum|compar|cual (conviene|es mejor|gana|elijo)|conclusi|quien gana|cual me|que me conviene|que dato|falta/)) return comparison(ctx);
      if (ctx.section === "armado" && has(q, /fuente|procesador|que necesito|cuanto cuesta|total|minim|sugerid|recomendad|esta placa|compatib/)) return armadoCtx(ctx);
      if (ctx.section === "encontra" && has(q, /por que|como funciona|que respond|mis respuestas|que me falta/)) {
        const an = ctx.answers || {}; return reply([P("Las recomendaciones salen de lo que respondiste:"), UL([`Usos: ${(an.usos || []).join(", ") || "sin elegir"}`, `Tipo: ${an.tipo || "sin definir"}`, `Presupuesto: ${an.budget ? CT.ARS(an.budget) : "sin definir"}`]), P("Cuanto más completes, más ajustadas son las opciones. Cada una indica qué datos faltan.")], { basis: "app" });
      }
      if (has(q, /compatib|va con|funciona con|entra en|sirve con/)) return compat();
      if (has(q, /recomend|que (compro|me conviene|notebook|pc|placa|procesador)|quiero (una|un|jugar|armar|comprar) |quiero jugar|busco jugar|\bjugar\b|busco (una|un) |necesito (una|un) |armame|presupuesto|para (jugar|estudiar|trabajar|programar|editar)/)) return recommend(question, ctx);
      const pr = aboutPrice(question, ctx); if (pr) return pr;
      const g = glossary(q); if (g) return g;
      if (has(q, /compar|diferenc/)) return ctx.section === "comparar" ? comparison(ctx) : reply([P("Podés comparar hasta 4 productos de la misma categoría, con tabla, gráficos y una conclusión según el uso.")], { basis: "gen", links: [{ label: "Comparar hardware", href: "comparar.html" }] });
      return null;
    };

    A.suggestions = ctx => {
      const s = ctx && ctx.section, nb = A.ctxGroups(ctx || {}).some(g => g.category === "notebooks");
      const base = { precios: ["¿Es confiable GoldenTech?", "¿Qué tiendas están conectadas?", "¿Cuándo se actualizaron los precios?"], armado: ["¿Qué es la VRAM?", "¿DDR4 o DDR5?", "¿Qué fuente necesito para esta placa?"],
        encontra: ["Quiero una notebook para estudiar", "¿Qué conviene para jugar en 1440p?", "¿Qué significa «Pendiente de verificar»?"], comparar: ["Resumime las diferencias", "¿Cuál conviene y por qué?", "¿Qué datos faltan?"], }[s] || ["¿Qué tiendas están conectadas?", "Quiero una notebook para estudiar"];
      return nb ? ["¿Cuánto pesa y qué batería tiene?"].concat(base).slice(0, 4) : base;
    };

    /* ---- respaldo con IA (opcional, vía proxy propio) ---- */
    A.remote = async (question, ctx, history) => {
      if (!A.endpoint) return null;
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null, to = ctrl && setTimeout(() => ctrl.abort(), 20000);
      try {
        const r = await (opts.fetch || root.fetch)(A.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl && ctrl.signal,
          body: JSON.stringify({ q: String(question).slice(0, 500), context: A.contextLines(ctx).slice(0, 12), history: (history || []).slice(-4) }) });
        if (r.status === 429) return reply([P("Se alcanzó el límite de consultas a la IA por ahora. Probá de nuevo en unos minutos; mientras tanto puedo ayudarte con los datos del catálogo.")], { src: "ai", basis: "none" });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json(); if (!j || typeof j.answer !== "string" || !j.answer.trim()) throw new Error("respuesta vacía");
        return reply(j.answer.split(/\n{2,}/).slice(0, 6).map(t => P(t.trim())), { src: "ai", basis: "ai" });
      } catch (e) {
        return reply([P("No pude conectar con el servicio de IA (" + (e.name === "AbortError" ? "tardó demasiado" : e.message) + "). Puedo seguir respondiendo con los datos del catálogo.")], { src: "error", basis: "none" });
      } finally { if (to) clearTimeout(to); }
    };

    A.ask = async (question, ctx, history) => {
      const l = A.local(question, ctx);
      if (l) return l;
      const r = await A.remote(question, ctx, history);
      if (r) return r;
      const near = A.findProducts(question, 2);
      return reply([P("No tengo ese dato y prefiero no inventarlo."), P("Puedo ayudarte con: precios y stock del catálogo, fichas de notebooks (peso, medidas, garantía), reputación verificada de las tiendas, explicaciones de términos técnicos y recomendaciones según tu uso y presupuesto."),
        near.length ? P("¿Quizás buscabas: " + near.map(g => g.name.slice(0, 50)).join(" · ") + "?") : P("")], { basis: "none", follow: A.suggestions(ctx) });
    };
    A.BASIS = BASIS;
    return A;
  };

  /* ---------------- widget (solo navegador) ---------------- */
  const CSS = `
#ctas-btn{position:fixed;right:16px;bottom:16px;z-index:9998;display:flex;align-items:center;gap:8px;padding:12px 16px;border:0;border-radius:999px;background:var(--acc,#1f6feb);color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.25)}
#ctas-btn:focus-visible,#ctas-p button:focus-visible,#ctas-p input:focus-visible,#ctas-p a:focus-visible{outline:3px solid #ffb703;outline-offset:2px}
#ctas-p{position:fixed;right:16px;bottom:16px;z-index:9999;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100dvh - 32px));display:none;flex-direction:column;background:var(--card,#fff);color:var(--tx,#16191f);border:1px solid var(--line,#e3e6ea);border-radius:14px;box-shadow:0 10px 36px rgba(0,0,0,.3);font:14px/1.45 system-ui,sans-serif;overflow:hidden}
#ctas-p.open{display:flex}#ctas-p.min{height:auto}#ctas-p.min #ctas-body,#ctas-p.min #ctas-form,#ctas-p.min #ctas-chips{display:none}
#ctas-h{display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--acc,#1f6feb);color:#fff}#ctas-h b{flex:1}
#ctas-h button{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:6px;width:30px;height:30px;font-size:16px;cursor:pointer}
#ctas-mode{font-size:11px;padding:6px 12px;background:var(--soft,#eef0f3);color:var(--mut,#6a7280);border-bottom:1px solid var(--line,#e3e6ea)}
#ctas-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.ctas-m{max-width:92%;padding:8px 11px;border-radius:12px;word-wrap:break-word}.ctas-m p{margin:0 0 6px}.ctas-m p:last-child{margin:0}.ctas-m ul{margin:4px 0 6px;padding-left:18px}
.ctas-u{align-self:flex-end;background:var(--acc,#1f6feb);color:#fff}.ctas-b{align-self:flex-start;background:var(--soft,#eef0f3)}
.ctas-src{display:block;margin-top:6px;font-size:11px;color:var(--mut,#6a7280)}.ctas-ai{border-left:3px solid var(--warn,#b7791f)}
#ctas-chips{display:flex;gap:6px;flex-wrap:wrap;padding:0 12px 8px}
#ctas-chips button{border:1px solid var(--line,#e3e6ea);background:var(--card,#fff);color:var(--tx,#16191f);border-radius:999px;padding:5px 10px;font:inherit;font-size:12.5px;cursor:pointer}
#ctas-form{display:flex;gap:6px;padding:10px;border-top:1px solid var(--line,#e3e6ea)}
#ctas-form input{flex:1;min-width:0;padding:10px;border:1px solid var(--line,#e3e6ea);border-radius:8px;background:var(--card,#fff);color:var(--tx,#16191f);font:inherit}
#ctas-form button{padding:0 14px;border:0;border-radius:8px;background:var(--acc,#1f6feb);color:#fff;font-weight:600;cursor:pointer}
.ctas-a a{display:inline-block;margin:4px 8px 0 0;font-weight:600}
@media(max-width:560px){#ctas-p{right:0;bottom:0;width:100vw;height:min(78dvh,640px);border-radius:14px 14px 0 0}#ctas-btn{right:12px;bottom:12px}}
@media(prefers-reduced-motion:no-preference){#ctas-p.open{animation:ctasin .18s ease-out}@keyframes ctasin{from{opacity:0;transform:translateY(8px)}}}`;

  CT.CTAssistant = {
    mount(cfg) {
      if (typeof document === "undefined" || document.getElementById("ctas-btn")) return;
      cfg = cfg || {};
      const esc = CT.esc, section = cfg.section || "precios";
      let eng = null, loading = null, history = [];
      const j = async (u, d) => { try { const r = await fetch(u); if (!r.ok) throw 0; return await r.json(); } catch { return d; } };
      const ensureScripts = async () => {
        for (const f of ["compare.js", "finder.js"]) if (!(f === "compare.js" ? CT.makeCompare : CT.makeFinder)) await new Promise(res => { const s = document.createElement("script"); s.src = "js/" + f; s.onload = s.onerror = res; document.head.appendChild(s); });
      };
      const load = () => loading || (loading = (async () => {
        await ensureScripts();
        const [HW, PR, META, SPECS, STORES, CFG] = cfg.data ? [cfg.data.HW, cfg.data.PR, cfg.data.META, cfg.data.SPECS, cfg.data.STORES, cfg.data.CFG]
          : await Promise.all([j("data/hardware.json", null), j("data/products.json", []), j("data/meta.json", {}), j("data/specs.json", null), j("data/stores.json", null), j("data/config.json", {})]);
        if (!HW) throw new Error("no se pudo cargar la base de hardware");
        let st = {}; try { st = JSON.parse(sessionStorage.getItem("ctas-state") || "{}"); } catch { }
        eng = CT.makeAssistant({ HW, PR, META, SPECS, STORES, CFG }, { state: st });
        return eng;
      })());
      const ctx = () => { try { return Object.assign({ section }, cfg.context ? cfg.context() : {}); } catch { return { section }; } };

      const st = document.createElement("style"); st.textContent = CSS; document.head.appendChild(st);
      const btn = document.createElement("button"); btn.id = "ctas-btn"; btn.type = "button"; btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Asistente';
      const p = document.createElement("section"); p.id = "ctas-p"; p.setAttribute("role", "dialog"); p.setAttribute("aria-label", "Asistente virtual de ComparáTech");
      p.innerHTML = '<div id="ctas-h"><b>Asistente ComparáTech</b><button type="button" id="ctas-min" aria-label="Minimizar">–</button><button type="button" id="ctas-x" aria-label="Cerrar asistente">×</button></div><div id="ctas-mode"></div><div id="ctas-body" role="log" aria-live="polite"></div><div id="ctas-chips"></div><form id="ctas-form"><input id="ctas-in" type="text" maxlength="500" autocomplete="off" placeholder="Preguntame lo que quieras…" aria-label="Tu pregunta"><button type="submit">Enviar</button></form>';
      document.body.append(btn, p);
      const body = p.querySelector("#ctas-body"), chips = p.querySelector("#ctas-chips"), input = p.querySelector("#ctas-in"), mode = p.querySelector("#ctas-mode");

      const render = (m, who) => {
        const d = document.createElement("div"); d.className = "ctas-m " + (who === "u" ? "ctas-u" : "ctas-b" + (m.src === "ai" ? " ctas-ai" : ""));
        if (who === "u") d.textContent = m; else {
          d.innerHTML = m.blocks.map(b => b.t === "ul" ? "<ul>" + b.items.map(i => "<li>" + esc(i) + "</li>").join("") + "</ul>" : b.text ? "<p>" + esc(b.text) + "</p>" : "").join("") +
            (m.links.length ? '<div class="ctas-a">' + m.links.filter(l => l.href && l.href !== "#").map(l => `<a href="${esc(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank" rel="noopener nofollow"' : ""}>${esc(l.label)}</a>`).join("") + "</div>" : "") +
            `<span class="ctas-src">${m.basis === "ai" ? "Respuesta generada por IA: puede equivocarse. Verificá los datos en el catálogo." : esc(eng ? eng.BASIS[m.basis] || "" : "")}</span>`;
        }
        body.appendChild(d); body.scrollTop = body.scrollHeight;
      };
      const setChips = list => { chips.innerHTML = ""; (list || []).slice(0, 4).forEach(t => { const b = document.createElement("button"); b.type = "button"; b.textContent = t; b.onclick = () => send(t); chips.appendChild(b); }); };
      const send = async text => {
        text = (text || "").trim(); if (!text) return; input.value = ""; render(text, "u"); history.push({ r: "user", c: text.slice(0, 300) });
        const wait = document.createElement("div"); wait.className = "ctas-m ctas-b"; wait.textContent = "Pensando…"; body.appendChild(wait);
        try {
          const e = await load(), c = ctx();
          const a = await e.ask(text, c, history); wait.remove(); render(a, "b"); setChips(a.follow && a.follow.length ? a.follow : e.suggestions(c));
          history.push({ r: "assistant", c: a.blocks.map(b => b.text || (b.items || []).join("; ")).join(" ").slice(0, 300) });
          try { sessionStorage.setItem("ctas-state", JSON.stringify(e.state)); } catch { }
        } catch (err) { wait.remove(); render({ blocks: [P("No pude cargar los datos del catálogo (" + err.message + "). Probá recargar la página.")], links: [], basis: "none", src: "error" }, "b"); }
      };
      const open = async () => {
        p.classList.add("open"); p.classList.remove("min"); btn.style.display = "none"; btn.setAttribute("aria-expanded", "true");
        if (!body.children.length) {
          mode.textContent = "Cargando…";
          try { const e = await load(); mode.textContent = e.endpoint ? "Asistente con reglas del catálogo + IA opcional (puede equivocarse). Se envía solo tu pregunta y un resumen de la página." : "Asistente local con reglas y datos del catálogo. No usa IA generativa y no envía tus datos a ningún servicio."; render(e.local("hola", ctx()), "b"); setChips(e.suggestions(ctx())); }
          catch (err) { mode.textContent = "Sin conexión al catálogo"; }
        }
        input.focus();
      };
      const close = () => { p.classList.remove("open"); btn.style.display = ""; btn.setAttribute("aria-expanded", "false"); btn.focus(); };
      btn.onclick = open; p.querySelector("#ctas-x").onclick = close;
      p.querySelector("#ctas-min").onclick = () => p.classList.toggle("min");
      p.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
      p.querySelector("#ctas-form").onsubmit = e => { e.preventDefault(); send(input.value); };
      CT.CTAssistant.open = open; CT.CTAssistant.ask = send;
    },
  };

  if (!root.CT) root.CT = CT;
  if (typeof module !== "undefined" && module.exports) module.exports = CT;
})(typeof self !== "undefined" ? self : this);
