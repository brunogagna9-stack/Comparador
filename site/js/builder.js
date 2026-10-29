/* ComparáTech · «Armalo vos»: motor de compatibilidad pieza por pieza (actualización 28).
   Se usa desde armar.html y desde las pruebas en Node.

   Cada dato tiene un origen:
     "fab"    dato del fabricante (base de hardware, tabla verificada con enlace a la ficha oficial, Icecat)
     "regla"  regla fija de la norma (p. ej. AM4 solo usa DDR4; una placa «B650M» es Micro-ATX; un gabinete ATX acepta Micro-ATX)
     "tienda" lo que dice el título de la publicación (solo se usa para identificar el producto: socket, DDR, potencia…)
   Cada control entre dos piezas da:
     "ok"  compatible y comprobado · "no" incompatible (con el motivo) · "unk" no se puede comprobar (falta el dato, con el motivo)
   Un producto se ofrece como COMPATIBLE solo si todos sus controles dan "ok". Si alguno da "unk" va a la sección aparte
   «No pudimos verificar la compatibilidad»; nunca se muestra como compatible algo que no se comprobó. */
(function (root) {
  "use strict";
  const CT = root.CT || (typeof require === "function" ? require("./lib.js") : null);
  const FX = root.FX || (typeof require === "function" ? require("./facets.js") : null);
  const B = {};

  B.SLOTS = [
    { k: "cpu", l: "Procesador", cat: "procesadores", req: true },
    { k: "cooler", l: "Cooler del procesador", cat: "refrigeracion", req: true },
    { k: "mobo", l: "Motherboard", cat: "motherboards", req: true },
    { k: "ram", l: "Memoria RAM", cat: "memorias-ram", req: true },
    { k: "ssd", l: "Almacenamiento", cat: "almacenamiento", req: true },
    { k: "gpu", l: "Placa de video", cat: "placas-de-video", req: true },
    { k: "case", l: "Gabinete", cat: "gabinetes", req: true },
    { k: "psu", l: "Fuente", cat: "fuentes", req: true },
    { k: "monitor", l: "Monitor", cat: "monitores", req: false },
  ];
  B.slot = k => B.SLOTS.find(s => s.k === k);
  const SOCKETS = ["AM4", "AM5", "LGA1700", "LGA1851", "LGA1200"];
  B.SOCKETS = SOCKETS;
  B.FORMS = ["E-ATX", "ATX", "Micro-ATX", "Mini-ITX"];
  // qué placas entran en cada formato de gabinete (norma ATX: los agujeros de Micro-ATX y Mini-ITX son un subconjunto)
  const FORM_FITS = { "E-ATX": ["E-ATX", "ATX", "Micro-ATX", "Mini-ITX"], "ATX": ["ATX", "Micro-ATX", "Mini-ITX"], "Micro-ATX": ["Micro-ATX", "Mini-ITX"], "Mini-ITX": ["Mini-ITX"] };
  B.FORM_FITS = FORM_FITS;
  /* Montajes equivalentes publicados por los fabricantes de procesadores:
     AMD: los coolers de AM4 se montan en AM5 con la placa trasera de fábrica · Intel: LGA1851 usa el mismo montaje que LGA1700. */
  const MOUNT_EQ = { AM5: ["AM4"], LGA1851: ["LGA1700"] };
  B.MOUNT_SRC = { AM5: "https://www.amd.com/en/partner/articles/socket-am5-change-game.html", LGA1851: "https://www.intel.com/content/www/us/en/support/articles/000099700.html" };

  const f = (v, src, extra) => v == null ? null : Object.assign({ v, src }, extra || {});
  const esc = s => String(s ?? "");

  B.create = function (C, VER) {
    const E = { C, VER: VER || {} };
    FX.init(C); FX.clear(C.PR || []);
    const rx = (m, x) => { const a = new RegExp(m, "i"), b = x ? new RegExp(x, "i") : null; return n => a.test(n) && !(b && b.test(n)); };
    const prep = l => (l || []).map(e => Object.assign({ t: rx(e.m, e.x) }, e));
    const VC = prep(E.VER.coolers), VK = prep(E.VER.cases), VG = prep(E.VER.gpus);
    E.verCooler = n => VC.find(e => e.t(n)) || null;
    E.verCase = n => VK.find(e => e.t(n)) || null;
    E.verGpu = (n, chip) => VG.find(e => e.t(n) && (!e.chip || e.chip === chip)) || null;
    const src = e => ({ url: e.src, date: e.d, ref: e.name });

    /* ---------- qué productos pertenecen a cada lugar ---------- */
    const BAD = /\bcombo\b|\bkit\b(?!.*\b(x2|2x)\b.*\b(ddr|gb)\b)|\bpack\b|bundle|\+\s*(mouse|teclado|auricular|fuente|placa)|usado|reacondicionad|exhibici|repuesto|soporte|cable\b/i;
    E.isSlotProduct = (k, g) => {
      const n = g.name;
      if (k !== "ram" && BAD.test(n)) return false;
      if (k === "ram" && /\bcombo\b|usado|reacondicionad/i.test(n)) return false;
      switch (k) {
        case "cpu": return !!FX.cpuFamily(n) && !/cooler|disipador|notebook|\bpc\b/i.test(n) && !/Servidor/.test(FX.cpuFamily(n));
        case "cooler": { const t = FX.val(g, FX.defs("refrigeracion")[0]); return t === "Líquida (watercooler)" || t === "Cooler de aire para procesador"; }
        case "mobo": return !/notebook|\bpc\b/i.test(n);
        case "ram": return /ddr|memoria|ram/i.test(n) && !/^(mb|mother|mainboard|placa madre)\b|\bmother(board)?\b|\b(notebook|pc)\s+(gamer|armada)\b|^(notebook|pc)\b/i.test(n);   // hay placas madre publicadas en la categoría de memorias
        case "ssd": { const t = FX.val(g, FX.defs("almacenamiento")[0]); return !!t && /^(SSD NVMe|SSD SATA|SSD M\.2|SSD \(sin|Disco rígido)/.test(t); }
        case "gpu": return !!(C.hwGpu(n) || C.hwGpuX(n)) && !/^pc\b|notebook|\bkit\b/i.test(n);
        case "case": return /^(gabinete|gab)\b/i.test(n) && !/\bkit\b|combo|tec\+|teclado|mouse/i.test(n);
        case "psu": return !!CT.parse(n, "fuentes").w && !/gabinete|combo|\bkit\b/i.test(n);
        case "monitor": return /monitor/i.test(n);
      }
      return false;
    };

    /* ---------- atributos de cada pieza con su origen ---------- */
    E.attrs = (k, g) => {
      const n = g.name, a = {};
      if (k === "cpu") {
        const hw = C.hwCpu(n);
        if (hw) { a.hw = hw; a.socket = f(hw.socket, "fab", { url: hw.vurl }); a.mem = f(hw.mem, "fab"); a.maxp = f(hw.maxp, "fab"); if (hw.spec && typeof hw.spec.igpu === "boolean") a.igpu = f(hw.spec.igpu, "fab"); }
        if (!a.socket) { const s = FX.cpuSocket(n); if (s && SOCKETS.includes(s)) a.socket = f(s, /am[45]|1700|1851|1200/i.test(n) ? "tienda" : "regla"); }
        if (!a.mem && a.socket) a.mem = f({ AM4: "DDR4", AM5: "DDR5", LGA1851: "DDR5", LGA1200: "DDR4", LGA1700: "DDR4/DDR5" }[a.socket.v], "regla");
        if (!a.igpu) { const t = CT.hasIgpu(n); if (/sin (video|gr[aá]ficos)|s\/\s?video/i.test(n)) a.igpu = f(false, "tienda"); else if (/c\/\s?video|con video/i.test(n)) a.igpu = f(true, "tienda"); else if (t != null) a.igpu = f(t, "regla"); }
        const ci = CT.coolerIncluded(hw || {}, n); if (ci != null) a.cooler = f(ci, /cooler|tray|oem|wraith|laminar/i.test(n) ? "tienda" : "regla");
      } else if (k === "mobo") {
        const s = CT.parse(n, "motherboards");
        if (s.socket) a.socket = f(s.socket, /am[45]|1700|1851|1200/i.test(n) ? "tienda" : "regla");
        if (s.chipset) a.chipset = f(s.chipset, "tienda");
        if (s.ddr) a.ddr = f(s.ddr, s.ddrBySocket ? "regla" : "tienda");
        if (s.form) a.form = f(s.form, /atx|itx/i.test(n) ? "tienda" : "regla");
        // «B650E-I», «Z890-ITX»: Mini-ITX aunque la I vaya separada por guion
        if (!a.form && /\b[abxhz]\d{3}e?[-\s](i|itx)\b/i.test(n)) a.form = f("Mini-ITX", "regla", { note: "la «I» del modelo indica Mini-ITX" });
        // Convención de ASUS, MSI, Gigabyte y ASRock: chipset con «M» = Micro-ATX, con «I» = Mini-ITX, sin letra = ATX.
        // No se aplica a los modelos tope de gama, que a veces son E-ATX.
        if (!a.form && s.chipset && /\b(asus|msi|gigabyte|aorus|asrock|rog|tuf|prime|mag|mpg|pro)\b/i.test(n) && !/extreme|xtreme|godlike|creator|sage|dominus|\bws\b|e-?atx/i.test(n)
          && new RegExp("\\b" + s.chipset + "(?![mi])", "i").test(n)) a.form = f("ATX", "regla", { note: "el modelo no lleva «M» ni «I» después del chipset: es ATX según la convención de nombres del fabricante" });
      } else if (k === "ram") {
        const s = CT.parse(n, "memorias-ram");
        if (s.ddr) a.ddr = f(s.ddr, "tienda");
        a.sodimm = f(!!s.laptop, s.laptop ? "tienda" : "regla");
        if (s.gb) a.gb = f(s.gb, "tienda");
      } else if (k === "gpu") {
        const hw = C.hwGpu(n) || C.hwGpuX(n);
        if (hw) { a.hw = hw; a.tgp = f(hw.tgp, "fab", { url: hw.vurl }); if (hw.psu) a.psurec = f(hw.psu, "fab", { url: hw.vurl }); a.pin16 = f(CT.uses16pin(hw), "regla"); }
        const v = E.verGpu(n, hw && hw.id); if (v) { a.len = f(v.len, "fab", src(v)); if (v.slots) a.slots = f(v.slots, "fab", src(v)); }
      } else if (k === "cooler") {
        const t = FX.val(g, FX.defs("refrigeracion")[0]);
        a.type = f(t === "Líquida (watercooler)" ? "aio" : "aire", "tienda");
        const v = E.verCooler(n);
        if (v) { a.sockets = f(v.sockets, "fab", src(v)); if (v.h) a.h = f(v.h, "fab", src(v)); if (v.rad) a.rad = f(v.rad, "fab", src(v)); if (v.type) a.type = f(v.type, "fab", src(v)); if (v.tdp) a.tdp = f(v.tdp, "fab", src(v)); }
        if (!a.rad && a.type.v === "aio") { const m = n.match(/\b(120|240|280|360|420)\s?(mm)?\b/); if (m) a.rad = f(+m[1], "tienda"); }
      } else if (k === "case") {
        const v = E.verCase(n);
        if (v) { a.forms = f(v.forms, "fab", src(v)); if (v.gpu) a.gpuMax = f(v.gpu, "fab", Object.assign(src(v), { note: v.note })); if (v.gpurad) a.gpuMaxRad = f(v.gpurad, "fab", src(v)); if (v.cpuh) a.coolerMax = f(v.cpuh, "fab", src(v)); if (v.rad) a.rads = f(v.rad, "fab", src(v)); }
        if (!a.forms) { const c = FX.val(g, FX.defs("gabinetes")[0]); const top = { "E-ATX / Full Tower": "E-ATX", "ATX (Mid Tower)": "ATX", "Micro-ATX": "Micro-ATX", "Mini-ITX": "Mini-ITX" }[c];
          if (top) a.forms = f(FORM_FITS[top], "regla", { note: `el título dice ${c}; por norma acepta ${FORM_FITS[top].join(", ")}` }); }
      } else if (k === "psu") {
        const s = CT.parse(n, "fuentes");
        if (s.w) a.w = f(s.w, "tienda");
        a.atx3 = f(!!(s.atx3 || /12vhpwr|12v-?2x6|pcie\s?5/i.test(n)), "tienda");
        if (s.cert) a.cert = f(s.cert, "tienda");
      } else if (k === "ssd") {
        const t = FX.val(g, FX.defs("almacenamiento")[0]); a.kind = f(t, "tienda");
      }
      return a;
    };

    /* atributos de lo que el usuario YA TIENE (eligió el modelo o cargó el dato a mano) */
    E.slotAttrs = (k, entry, byId) => {
      if (!entry || entry.skip) return null;
      let a = {};
      if (entry.id && byId(entry.id)) a = E.attrs(k, byId(entry.id));
      if (entry.attrs) for (const [key, v] of Object.entries(entry.attrs)) if (v != null && v !== "") a[key] = f(key === "forms" ? FORM_FITS[v] || [v] : (typeof v === "string" && /^\d+$/.test(v) ? +v : v), "usuario");
      return a;
    };

    /* ---------- controles entre dos piezas ---------- */
    const OK = (txt, srcs) => ({ s: "ok", txt, srcs }), NO = txt => ({ s: "no", txt }), UNK = txt => ({ s: "unk", txt }), WARN = txt => ({ s: "warn", txt });
    const has = (a, key) => a && a[key] && a[key].v != null;
    const norm = s => /^LGA115/.test(s) ? "LGA115x" : s;
    const mountOk = (cpuSock, list) => list.includes(norm(cpuSock)) || (MOUNT_EQ[cpuSock] || []).some(s => list.includes(s));
    const ANY = (E.VER.rules || {}).gpu_any || null;    // largo de la placa de video más larga que existe
    // estimación de consumo de todo el equipo (procesador a máxima potencia + placa + 75 W del resto)
    E.watts = X => { const c = X.cpu && X.cpu.maxp ? X.cpu.maxp.v : null, g = X.gpu && X.gpu.tgp ? X.gpu.tgp.v : 0; return c == null ? null : Math.round(c + g + 75); };
    E.psuNeed = X => {
      if (X.gpu && X.gpu.psurec) return { w: X.gpu.psurec.v, why: `fuente recomendada por el fabricante del chip para esta placa (${X.gpu.psurec.v} W)`, src: "fab" };
      if (X.gpu && !X.gpu.tgp) return null;                                       // hay placa de video pero sin consumo conocido
      const w = E.watts(X); if (w == null) return null;
      const need = Math.ceil(w * 1.3 / 50) * 50;
      return { w: need, why: `consumo estimado ${w} W + 30 % de margen`, src: "regla" };
    };
    const PAIRS = [
      ["cpu", "mobo", (c, m) => {
        if (!has(c, "socket") || !has(m, "socket")) return UNK("falta el socket de " + (!has(c, "socket") ? "el procesador" : "la motherboard"));
        if (c.socket.v !== m.socket.v) return NO(`socket distinto: el procesador es ${c.socket.v} y la placa ${m.socket.v}`);
        const out = OK(`mismo socket (${c.socket.v})`);
        if (c.hw && has(m, "chipset") && CT.biosNeed(c.hw, m.chipset.v) === "bios") out.warn = `la placa ${m.chipset.v} es anterior al procesador: si es de stock viejo puede necesitar actualizar la BIOS (preguntá a la tienda; muchas se actualizan sin procesador)`;
        return out; }],
      ["cpu", "ram", (c, r) => {
        if (!has(r, "ddr")) return UNK("la memoria no indica si es DDR4 o DDR5");
        if (has(c, "mem") && !c.mem.v.split("/").includes(r.ddr.v)) return NO(`el procesador usa ${c.mem.v} y la memoria es ${r.ddr.v}`);
        return OK(`el procesador acepta ${r.ddr.v}`); }],
      ["mobo", "ram", (m, r) => {
        if (has(r, "sodimm") && r.sodimm.v) return NO("es memoria para notebook (SO-DIMM): no entra en una placa de PC");
        if (!has(r, "ddr") || !has(m, "ddr")) return UNK("falta saber si " + (!has(m, "ddr") ? "la placa" : "la memoria") + " es DDR4 o DDR5");
        return m.ddr.v === r.ddr.v ? OK(`las dos son ${r.ddr.v}`) : NO(`la placa usa ${m.ddr.v} y la memoria es ${r.ddr.v}`); }],
      ["cpu", "cooler", (c, k) => {
        if (!has(c, "socket")) return UNK("falta el socket del procesador");
        if (!has(k, "sockets")) return UNK("no tenemos la ficha del fabricante del cooler con los sockets que soporta");
        if (!mountOk(c.socket.v, k.sockets.v)) return NO(`el cooler no trae soporte para ${c.socket.v} (soporta ${k.sockets.v.join(", ")})`);
        const eq = !k.sockets.v.includes(norm(c.socket.v));
        const out = OK(eq ? `soporta ${MOUNT_EQ[c.socket.v][0]}, que usa el mismo montaje que ${c.socket.v} según ${c.socket.v === "AM5" ? "AMD" : "Intel"}` : `soporta ${c.socket.v}`);
        if (has(k, "tdp") && has(c, "maxp") && k.tdp.v < c.maxp.v) out.warn = `el fabricante lo indica para hasta ${k.tdp.v} W y el procesador llega a ~${c.maxp.v} W: puede quedar justo`;
        else if (k.type && k.type.v === "aire" && has(c, "maxp") && c.maxp.v > 170) out.warn = `procesador de ~${c.maxp.v} W: para este consumo se recomienda refrigeración líquida de 360 mm`;
        return out; }],
      ["mobo", "case", (m, k) => {
        if (!has(m, "form")) return UNK("la motherboard no indica su tamaño (ATX, Micro-ATX…)");
        if (!has(k, "forms")) return UNK("no tenemos la ficha del gabinete con los tamaños de placa que acepta");
        return k.forms.v.includes(m.form.v) ? OK(`el gabinete acepta placas ${m.form.v}`) : NO(`la placa es ${m.form.v} y el gabinete acepta ${k.forms.v.join(", ")}`); }],
      ["gpu", "case", (g, k) => {
        if (!has(k, "gpuMax")) return UNK("no tenemos el largo máximo de placa de video que acepta el gabinete");
        if (!has(g, "len")) return ANY && k.gpuMax.v >= ANY.len ? OK(`el gabinete acepta placas de hasta ${k.gpuMax.v} mm y la más larga que se fabricó mide ${ANY.len} mm`)
          : UNK("no tenemos el largo de esta placa de video en la ficha del fabricante");
        return g.len.v <= k.gpuMax.v ? OK(`la placa mide ${g.len.v} mm y el gabinete acepta hasta ${k.gpuMax.v} mm`) : NO(`la placa mide ${g.len.v} mm y el gabinete acepta hasta ${k.gpuMax.v} mm`); }],
      ["cooler", "case", (c, k) => {
        if (c.type && c.type.v === "aio") {
          if (!has(c, "rad")) return UNK("no sabemos la medida del radiador");
          if (!has(k, "rads")) return UNK("no tenemos la ficha del gabinete con los radiadores que acepta");
          return k.rads.v.includes(c.rad.v) ? OK(`el gabinete acepta radiadores de ${c.rad.v} mm`) : NO(`el radiador es de ${c.rad.v} mm y el gabinete acepta ${k.rads.v.join(", ")} mm`);
        }
        if (!has(c, "h")) return UNK("no tenemos el alto del cooler");
        if (!has(k, "coolerMax")) return UNK("no tenemos el alto máximo de cooler que acepta el gabinete");
        return c.h.v <= k.coolerMax.v ? OK(`el cooler mide ${c.h.v} mm de alto y el gabinete acepta hasta ${k.coolerMax.v} mm`) : NO(`el cooler mide ${c.h.v} mm y el gabinete acepta hasta ${k.coolerMax.v} mm`); }],
    ];
    E.PAIRS = PAIRS;
    // la fuente se controla contra el conjunto (procesador + placa de video)
    const psuCheck = (p, X) => {
      if (!has(p, "w")) return UNK("la fuente no indica su potencia");
      const need = E.psuNeed(X); if (!need) return null;           // todavía no hay datos para calcular (falta procesador o placa)
      if (p.w.v < need.w) return NO(`es de ${p.w.v} W y el equipo necesita ${need.w} W (${need.why})`);
      const out = OK(`${p.w.v} W alcanza: ${need.why}`);
      if (X.gpu && has(X.gpu, "pin16") && X.gpu.pin16.v && has(p, "atx3") && !p.atx3.v) out.warn = "la placa de video usa el conector de 16 pines: esta fuente no dice ser ATX 3.x, vas a usar el adaptador que viene con la placa";
      return out;
    };

    /* Controla un producto candidato (o lo ya elegido) para el lugar k contra el resto del armado.
       X = { cpu: attrs, mobo: attrs, … } de las piezas ya elegidas (sin la del lugar k). */
    E.check = (k, a, X) => {
      const res = [];
      for (const [p, q, fn] of PAIRS) {
        if (p === k && X[q]) res.push(Object.assign({ with: q }, fn(a, X[q])));
        else if (q === k && X[p]) res.push(Object.assign({ with: p }, fn(X[p], a)));
      }
      if (k === "psu") { const r = psuCheck(a, X); if (r) res.push(Object.assign({ with: "cpu+gpu" }, r)); }
      if ((k === "cpu" || k === "gpu") && X.psu) { const Y = Object.assign({}, X, { [k]: a }); const r = psuCheck(X.psu, Y); if (r) res.push(Object.assign({ with: "psu" }, r)); }
      // gabinetes que pierden largo de placa de video si el radiador va adelante: aviso cuando hay refrigeración líquida
      { const G = k === "gpu" ? a : X.gpu, K = k === "case" ? a : X.case, Q = k === "cooler" ? a : X.cooler;
        if (G && K && Q && has(G, "len") && has(K, "gpuMaxRad") && Q.type && Q.type.v === "aio" && G.len.v > K.gpuMaxRad.v && (k === "gpu" || k === "case" || k === "cooler"))
          res.push({ with: "case", s: "ok", txt: "entra con el radiador arriba", warn: `si montás el radiador adelante el gabinete acepta placas de hasta ${K.gpuMaxRad.v} mm y esta mide ${G.len.v} mm: montalo arriba` }); }
      if (k === "ram" && a.sodimm && a.sodimm.v && !res.some(r => r.s === "no")) res.push({ with: "pc", s: "no", txt: "es memoria para notebook (SO-DIMM): no entra en una placa de PC" });
      const st = res.some(r => r.s === "no") ? "no" : res.some(r => r.s === "unk") ? "unk" : "ok";
      return { s: st, res };
    };

    /* Recorre el catálogo para el lugar k: compatibles (comprobados), sin verificar e incompatibles (con conteo por motivo). */
    E.candidates = (k, X, products) => {
      const out = { ok: [], unk: [], no: 0, why: {}, unkWhy: {} };
      for (const g of products) {
        if (g.category !== B.slot(k).cat || !E.isSlotProduct(k, g)) continue;
        const o = C.recOffer(g); if (!o) continue;
        const a = E.attrs(k, g), r = E.check(k, a, X);
        const row = { g, o, p: CT.price(o), a, r };
        if (r.s === "ok") out.ok.push(row);
        else if (r.s === "unk") { out.unk.push(row); r.res.filter(x => x.s === "unk").forEach(x => { out.unkWhy[x.txt] = (out.unkWhy[x.txt] || 0) + 1; }); }
        else { out.no++; const w = r.res.find(x => x.s === "no"); let key = w.txt.replace(/\s*\([^)]*\d[^)]*\)/g, "").trim(); const gen = [[/^es de \d+ W/, "la potencia no alcanza para el equipo"], [/^la placa mide \d+ mm/, "la placa de video es más larga de lo que acepta el gabinete"], [/^el cooler mide \d+ mm/, "el cooler es más alto de lo que acepta el gabinete"]].find(([r]) => r.test(key)); if (gen) key = gen[1]; out.why[key] = (out.why[key] || 0) + 1; }
      }
      const by = (a, b) => a.p - b.p; out.ok.sort(by); out.unk.sort(by);
      return out;
    };

    /* Estado de todo el armado: qué falta, qué se comprobó, avisos y total. */
    E.summary = (build, byId) => {
      const X = {}; for (const s of B.SLOTS) { const a = E.slotAttrs(s.k, build[s.k], byId); if (a) X[s.k] = a; }
      const issues = [], warns = [], checks = [];
      for (const s of B.SLOTS) { if (!X[s.k]) continue; const others = Object.assign({}, X); delete others[s.k];
        const r = E.check(s.k, X[s.k], others);
        r.res.forEach(x => { const key = [s.k, x.with].sort().join("|") + x.txt; if (checks.some(c => c.key === key)) return; checks.push(Object.assign({ key, slot: s.k }, x)); if (x.warn) warns.push(x.warn); }); }
      checks.forEach(c => { if (c.s === "no") issues.push(c); });
      const missing = B.SLOTS.filter(s => s.req && !build[s.k]).map(s => s.k);
      // sin placa de video: el procesador tiene que tener gráficos integrados
      if (build.gpu && build.gpu.skip && X.cpu && X.cpu.igpu && X.cpu.igpu.v === false) issues.push({ s: "no", slot: "gpu", txt: "el procesador no tiene gráficos integrados: sin placa de video no hay imagen" });
      if (build.gpu && build.gpu.skip && X.cpu && !X.cpu.igpu) checks.push({ s: "unk", slot: "gpu", txt: "no sabemos si el procesador tiene gráficos integrados" });
      if (build.cooler && build.cooler.skip === "incl" && X.cpu && X.cpu.cooler && X.cpu.cooler.v === false) issues.push({ s: "no", slot: "cooler", txt: "este procesador no trae cooler en la caja" });
      if (X.ssd && X.ssd.kind && /NVMe|M\.2/.test(X.ssd.kind.v || "")) warns.push("disco M.2: todas las placas de los sockets actuales traen al menos una ranura M.2, pero confirmá cuántas tiene la que elijas si vas a poner más de uno");
      let total = 0, priced = 0;
      for (const s of B.SLOTS) { const e = build[s.k]; if (e && e.id && !e.own) { const g = byId(e.id), o = g && C.recOffer(g); if (o) { total += CT.price(o); priced++; } } }
      const need = E.psuNeed(X);
      return { X, issues, warns, checks, unk: checks.filter(c => c.s === "unk"), missing, total, priced, watts: E.watts(X), need };
    };

    /* armado <-> texto para la dirección de la página (para compartir): cpu=id;gpu=-;case=own:id… */
    E.encode = build => Object.entries(build).filter(([, e]) => e).map(([k, e]) => k + "=" + (e.skip ? "-" + (e.skip === "incl" ? "i" : "") : (e.own ? "o" : "") + (e.id ? encodeURIComponent(e.id) : "") + (e.attrs ? "~" + Object.entries(e.attrs).map(([a, v]) => a + ":" + encodeURIComponent(v)).join(",") : ""))).join(";");
    E.decode = s => { const b = {}; String(s || "").split(";").forEach(p => { const m = p.match(/^(\w+)=(.*)$/); if (!m || !B.slot(m[1])) return; const v = m[2];
      if (v === "-" || v === "-i") { b[m[1]] = { skip: v === "-i" ? "incl" : true }; return; }
      const [idp, at] = v.split("~"); const e = {}; let id = idp; if (id.startsWith("o")) { e.own = true; id = id.slice(1); } if (id) e.id = decodeURIComponent(id);
      if (at) { e.attrs = {}; at.split(",").forEach(x => { const [a, val] = x.split(":"); if (a) e.attrs[a] = decodeURIComponent(val || ""); }); }
      if (e.id || e.attrs) b[m[1]] = e; }); return b; };
    return E;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = B; else root.BLD = B;
})(typeof self !== "undefined" ? self : this);
