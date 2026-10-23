/* ComparáTech · núcleo compartido (precios, especificaciones, armado de PC).
   Se usa desde el navegador (window.CT) y desde las pruebas en Node (require). */
(function (root) {
  "use strict";
  const CT = {};

  /* ---------- utilidades ---------- */
  CT.esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  CT.ARS = n => "$" + Math.round(n).toLocaleString("es-AR");
  CT.price = o => o.price_cash ?? o.price_list;
  CT.up50 = x => Math.ceil(x / 50) * 50;
  CT.RES = ["1080p", "1440p", "4K"];
  const rxm = (m, x) => { const a = new RegExp(m, "i"), b = x ? new RegExp(x, "i") : null; return n => a.test(n) && !(b && b.test(n)); };
  CT.rxm = rxm;
  const num = s => s == null ? null : parseFloat(String(s).replace(",", "."));

  /* ---------- especificaciones leídas del TÍTULO de la tienda ----------
     Son datos "pendientes de verificar": la tienda los escribió, no los comprobamos contra la ficha. */
  const NOT_PC = /\b(cable|adaptador|soporte|riser|kit de herramientas|funda|bolso|mochila|combo)\b/i;
  CT.NOT_PC = NOT_PC;

  function vramOf(name) {
    const m = name.match(/(?<![\d.])(\d{1,2})\s?gb/i);
    return m && [2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 48].includes(+m[1]) ? +m[1] : null;
  }
  CT.vramOf = vramOf;

  function capacity(txt) { // devuelve GB
    const m = txt.match(/(\d+(?:[.,]\d+)?)\s?(tb|gb)\b/i);
    return m ? Math.round(num(m[1]) * (m[2].toLowerCase() === "tb" ? 1000 : 1)) : null;
  }

  function ramSpec(n) {
    const out = { ddr: null, gb: null, mods: null, mhz: null, cl: null, laptop: /sodimm|notebook|laptop/i.test(n) };
    const d = n.match(/ddr([2345])/i); if (d) out.ddr = "DDR" + d[1];
    const k = n.match(/(\d+)\s?x\s?(\d+)\s?gb/i);
    if (k) { out.mods = +k[1]; out.gb = +k[1] * +k[2]; }
    else { const t = n.match(/(\d+)\s?gb/i); if (t) { out.gb = +t[1]; out.mods = 1; } }
    const mh = n.match(/(\d{3,5})\s?mhz/i); if (mh) out.mhz = +mh[1];
    const cl = n.match(/\bcl\s?-?(\d{2})\b/i); if (cl) out.cl = +cl[1];
    if (out.mhz && out.cl) out.lat = Math.round(out.cl * 2000 / out.mhz * 10) / 10; // latencia real en ns
    return out;
  }
  function storageSpec(n) {
    const o = { kind: null, gb: capacity(n), iface: null, gen: null, mbs: null };
    if (/\bssd\b|s[oó]lido/i.test(n)) o.kind = "SSD";
    else if (/\bhdd\b|r[ií]gido|\brpm\b/i.test(n)) o.kind = "HDD";
    else if (/micro ?sd|sdxc|sdhc|pendrive|usb/i.test(n)) o.kind = "Memoria flash";
    if (/nvme|pci-?e|gen ?[345]/i.test(n)) o.iface = "NVMe (M.2)";
    else if (/m\.2/i.test(n)) o.iface = "M.2 (sin especificar)";
    else if (/sata/i.test(n)) o.iface = "SATA";
    const g = n.match(/gen\s?([345])/i); if (g) o.gen = "PCIe " + g[1] + ".0";
    const sp = n.match(/(\d{3,5})\s?mb\/s/i); if (sp) o.mbs = +sp[1];
    o.external = /externo|port[aá]til|usb|micro ?sd/i.test(n);
    return o;
  }
  const CERT = { white: 1, bronze: 2, silver: 3, gold: 4, platinum: 5, titanium: 6 };
  function psuSpec(n) {
    const w = n.match(/(\d{3,4})\s?w\b/i), c = n.match(/80\s?\+?\s?plus\s?(white|bronze|silver|gold|platinum|titanium)?/i);
    const cert = c ? (c[1] ? c[1].toLowerCase() : "white") : null;
    return { w: w ? +w[1] : null, cert, certRank: cert ? CERT[cert] : null, modular: /modular/i.test(n) && !/no modular|semi/i.test(n),
      atx3: (n.match(/atx\s?3\.\d/i) || [null])[0], bulk: /bulk/i.test(n) };
  }
  const CHIPSETS = "a320 a520 b450 b550 x570 a620 b650 b650e x670 x670e b840 b850 x870 x870e h510 b560 z590 h610 b660 b760 z690 z790 h810 b860 z890".split(" ");
  const CHIP_SOCKET = { a620: "AM5", b650: "AM5", b650e: "AM5", x670: "AM5", x670e: "AM5", b840: "AM5", b850: "AM5", x870: "AM5", x870e: "AM5",
    a320: "AM4", a520: "AM4", b450: "AM4", b550: "AM4", x570: "AM4", h610: "LGA1700", b660: "LGA1700", b760: "LGA1700", z690: "LGA1700", z790: "LGA1700",
    h810: "LGA1851", b860: "LGA1851", z890: "LGA1851", h510: "LGA1200", b560: "LGA1200", z590: "LGA1200" };
  function moboSpec(n) {
    const o = { socket: null, chipset: null, ddr: null, form: null, wifi: /wi-?fi|wifi/i.test(n) };
    if (/\bam5\b/i.test(n)) o.socket = "AM5"; else if (/\bam4\b/i.test(n)) o.socket = "AM4";
    else if (/1851/.test(n)) o.socket = "LGA1851"; else if (/1700/.test(n)) o.socket = "LGA1700"; else if (/1200/.test(n)) o.socket = "LGA1200";
    const t = n.toLowerCase().match(/\b([abxhz]\d{3}e?)(?=[a-z\-\/ ]|$)/g);
    if (t) o.chipset = (t.map(x => x.toUpperCase()).find(x => CHIPSETS.includes(x.toLowerCase())) || null);
    if (!o.chipset) { const m = n.match(/\b([ABXHZ]\d{3}E?)M?\b/i); if (m && CHIPSETS.includes(m[1].toLowerCase())) o.chipset = m[1].toUpperCase(); }
    if (!o.socket && o.chipset) o.socket = CHIP_SOCKET[o.chipset.toLowerCase()] || null; // deducido del chipset
    const d = n.match(/ddr([45])/i); if (d) o.ddr = "DDR" + d[1];
    if (/mini[- ]?itx|\bitx\b|\b[abxhz]\d{3}e?i\b/i.test(n)) o.form = "Mini-ITX";
    else if (/e-?atx/i.test(n)) o.form = "E-ATX";
    else if (/m-?atx|micro[- ]?atx|\b[abxhz]\d{3}e?m\b/i.test(n)) o.form = "Micro-ATX";
    else if (/\batx\b/i.test(n)) o.form = "ATX";
    return o;
  }
  const RESMAP = { "fhd": [1920, 1080, "FHD 1080p"], "1080p": [1920, 1080, "FHD 1080p"], "qhd": [2560, 1440, "QHD 1440p"], "wqhd": [2560, 1440, "QHD 1440p"],
    "fullhd": [1920, 1080, "FHD 1080p"], "ultrahd": [3840, 2160, "4K UHD"], "1440p": [2560, 1440, "QHD 1440p"], "2k": [2560, 1440, "QHD 1440p"], "4k": [3840, 2160, "4K UHD"], "uhd": [3840, 2160, "4K UHD"] };
  function monitorSpec(n) {
    const o = { inch: null, hz: null, panel: null, ms: null, res: null, px: null, curved: /curv/i.test(n) };
    const i = n.match(/(\d{2}(?:[.,]\d)?)\s?("|”|''|pulg|in\b)/i); if (i) o.inch = num(i[1]);
    else { const j = n.match(/\b(2[0-9]|3[0-9]|4[0-9])(?:[.,]\d)?\s?"/); if (j) o.inch = num(j[1]); }
    const h = n.match(/(\d{2,3})\s?hz/i); if (h) o.hz = +h[1];
    const p = n.match(/\b(qd-oled|oled|ips|va|tn|mini ?led)\b/i); if (p) o.panel = p[1].toUpperCase();
    const m = n.match(/(\d(?:[.,]\d)?)\s?ms/i); if (m) o.ms = num(m[1]);
    const r = n.match(/\b(4k|uhd|wqhd|qhd|1440p|2k|fhd|1080p|full ?hd|ultra ?hd)\b/i);
    if (r) { const e = RESMAP[r[1].toLowerCase().replace(/\s/g, "")]; o.res = e[2]; o.px = e[0] * e[1]; }
    return o;
  }
  const CPU_RX = /(ryzen\s?(?:ai\s?)?[3579]\s?\d{3,5}\w*|core\s?ultra\s?[579]\s?\w+|core\s?[3579]\s?\d{3}\w*|core\s?i[3579][- ]?\w+|\bi[3579][- ]\w+|\bi[3579]\s\d{4,5}\w*|\br[3579][- ]\d{4}\w*|intel\s?n\d+|celeron\s?\w+|pentium\s?\w+|snapdragon\s?\w+|apple m\d)/i;
  const GPU_RX = /(rtx\s?\d{4}\s?(?:ti\s?super|super|ti)?|gtx\s?\d{4}\s?(?:ti)?|rx\s?\d{4}\s?(?:xtx|xt|gre)?|arc\s?[ab]\d{3})/i;
  function systemSpec(n) { // notebooks y PC armadas
    const o = { cpu: null, gpu: null, ram: null, ssd: null, vram: null, inch: null, hz: null, ddr: null, os: null };
    const c = n.match(CPU_RX); if (c) o.cpu = c[1].replace(/\s+/g, " ").trim();
    const g = n.match(GPU_RX); if (g) o.gpu = g[1].replace(/\s+/g, " ").toUpperCase().trim();
    const d = n.match(/ddr([45])/i); if (d) o.ddr = "DDR" + d[1];
    const ins = n.match(/(\d{2}(?:[.,]\d)?)\s?("|”|''|pulg)/i); if (ins) o.inch = num(ins[1]);
    const hz = n.match(/(\d{2,3})\s?hz/i); if (hz) o.hz = +hz[1];
    if (/win(dows)?\s?11|\bw11\b/i.test(n)) o.os = "Windows 11"; else if (/freedos|sin sistema|sin so/i.test(n)) o.os = "Sin sistema operativo";
    const re = /(\d+(?:[.,]\d+)?)\s?(tb|gb)\b/gi; let m; const nums = [];
    while ((m = re.exec(n))) {
      const val = num(m[1]) * (m[2].toLowerCase() === "tb" ? 1000 : 1), a = Math.max(0, m.index - 11), b = m.index + m[0].length + 11;
      const before = n.slice(a, m.index), after = n.slice(m.index + m[0].length, b);
      nums.push({ val, kb: /(ssd|nvme|m\.2|hdd)\s*$/i.test(before), ka: /^\s*(ssd|nvme|m\.2|hdd)/i.test(after),
        gpu: val <= 48 && /\b(rtx|gtx|rx|arc)[\w\s]{0,14}$/i.test(before) });
    }
    const st = nums.find(x => x.kb) || nums.find(x => x.ka && x.val >= 120);
    if (st) { o.ssd = st.val; st.used = true; }
    const vr = nums.find(x => !x.used && x.gpu); if (vr) { o.vram = vr.val; vr.used = true; }
    const rm = nums.find(x => !x.used && x.val <= 128); if (rm) { o.ram = rm.val; rm.used = true; }
    if (o.ssd == null) { const bare = nums.find(x => !x.used && x.val >= 120); if (bare) o.ssd = bare.val; }
    return o;
  }
  CT.parse = function (name, cat) {
    switch (cat) {
      case "memorias-ram": return ramSpec(name);
      case "almacenamiento": return storageSpec(name);
      case "fuentes": return psuSpec(name);
      case "motherboards": return moboSpec(name);
      case "monitores": return monitorSpec(name);
      case "notebooks": case "pcs-armadas": return systemSpec(name);
      case "placas-de-video": return { vram: vramOf(name) };
      default: return {};
    }
  };
  CT.hasIgpu = function (name) { // ¿el procesador del producto trae gráficos integrados? (null = no se sabe)
    const n = name.toLowerCase();
    let m = n.match(/(?:ryzen\s?[3579]\s?|\br[3579][ -])(\d{4})([a-z0-9]*)/);
    if (m) { if (/f/.test(m[2])) return false; if (/g/.test(m[2])) return true; return +m[1][0] >= 7; }
    m = n.match(/(?:core\s?i[3579][- ]?|\bi[3579][- ]|core\s?ultra\s?[579]\s?)(\d{3,5})([a-z0-9]*)/);
    if (m) return !/f/.test(m[2]);
    return null;
  };

  /* ---------- contexto con el catálogo y la base de hardware ---------- */
  CT.create = function (HW, PR, meta, SPECS) {
    const C = { HW, PR, meta: meta || {}, SPECS: SPECS && SPECS.items ? SPECS : null };
    /* ficha técnica verificada de un notebook (specs.json); devuelve null si la tienda no la publica */
    C.spec = g => (g && g.spec && C.SPECS && C.SPECS.items[g.spec]) || null;
    C.sf = (g, field) => {
      const it = C.spec(g), r = it && it.f[field]; if (!r) return null;
      return { v: r.v, u: r.u || "", tag: r.l || "ver", note: r.n || "", src: it.s, url: it.url, date: it.d, sku: it.sku };
    };
    C.specMissing = (g, field) => { const it = C.spec(g); return !it ? "sin ficha" : (it.miss || []).includes(field) ? "no publicado" : null; };
    const inCat = c => PR.filter(g => g.category === c);
    C.inCat = inCat;
    C.updated = (meta && meta.updated) || null;

    /* ofertas: la más barata con stock (o stock sin confirmar); nunca sin stock confirmado */
    C.bestOffer = g => {
      const l = g.offers.filter(o => o.stock !== false && CT.price(o));
      if (!l.length) return null;
      return l.sort((a, b) => CT.price(a) - CT.price(b))[0];
    };
    C.cheapest = (list, n = 3) => {
      const seen = new Set(), out = [];
      list.map(g => { const o = C.bestOffer(g); return o ? { g, o, p: CT.price(o) } : null; }).filter(Boolean)
        .sort((a, b) => a.p - b.p).forEach(x => { const k = x.g.id + "|" + x.o.url; if (!seen.has(k) && seen.size < n) { seen.add(k); out.push(x); } });
      return out;
    };

    /* coincidencia de productos del catálogo con la base de hardware */
    const gpuTests = HW.gpus.map(g => [g, rxm(g.m, g.x)]);
    const cpuTests = HW.cpus.map(c => [c, rxm(c.m)]);
    C.hwGpu = (name, vram) => { if (NOT_PC.test(name)) return null; const v = vram === undefined ? vramOf(name) : vram; // en PC armadas la VRAM sale del análisis del título, no del primer "GB"
      const hit = gpuTests.find(([g, t]) => t(name) && (v == null || v === g.vram)); return hit ? hit[0] : null; };
    C.hwCpu = name => { if (/cooler|disipador|fan|pasta|\bkit\b/i.test(name)) return null; const hit = cpuTests.find(([c, t]) => t(name)); return hit ? hit[0] : null; };

    const isPc = n => /^pc\b|\bpc (armada|gamer|powered)|powered by|notebook|combo|\bkit\b|all in one/i.test(n);
    C.findGpu = g => { const t = rxm(g.m, g.x);
      return C.cheapest(inCat("placas-de-video").filter(p => !isPc(p.name) && !NOT_PC.test(p.name) && t(p.name) && (vramOf(p.name) == null || vramOf(p.name) === g.vram))); };
    C.findCpu = c => { const t = rxm(c.m);
      return C.cheapest(inCat("procesadores").filter(p => t(p.name) && !/cooler|disipador|fan|\bkit\b|combo|pc /i.test(p.name))); };
    C.findPsu = w => C.cheapest(inCat("fuentes").filter(p => { const s = psuSpec(p.name); return s.w && s.w >= w && s.w <= w + 250 && s.cert && !/combo|gabinete/i.test(p.name); }));
    C.findMobo = c => C.cheapest(inCat("motherboards").filter(p => moboSpec(p.name).socket === c.socket));
    C.findRam = (c, gb) => { const ddr = c.mem === "DDR5" ? /ddr5/i : c.mem === "DDR4" ? /ddr4/i : /ddr[45]/i;
      return C.cheapest(inCat("memorias-ram").filter(p => { const s = ramSpec(p.name); return ddr.test(p.name) && !s.laptop && s.gb && s.gb >= gb && s.gb <= gb * 2; })); };
    C.findSsd = gb => C.cheapest(inCat("almacenamiento").filter(p => { const s = storageSpec(p.name);
      return s.kind === "SSD" && !s.external && s.gb && s.gb >= gb && s.gb <= gb * 2.1 && /nvme|m\.2|sata/i.test(p.name); }));

    /* ---------- lógica de armado (la misma que usaba armado.html) ---------- */
    C.cpuFps = c => c.s ? HW.ref.gpu_fps_ref * c.s / HW.ref.cpu_score_ref : null;
    C.pickCpu = (Gv, factor, vendor) => {
      const l = HW.cpus.filter(c => c.s && (!vendor || c.vendor === vendor)).sort((a, b) => a.s - b.s);
      const ok = l.find(c => C.cpuFps(c) >= factor * Gv);
      return ok ? { c: ok, short: false } : { c: l[l.length - 1], short: true };
    };
    C.psuFor = (g, c) => { const base = c.maxp + g.tgp + 100, min = Math.max(g.psu, CT.up50(base)), sug = Math.max(min, CT.up50(base * 1.25)); return { min, sug, base }; };
    C.pickPair = (g, res) => {
      const Gv = g.p[res], mk = f => { const a = C.pickCpu(Gv, f, "AMD"), b = C.pickCpu(Gv, f, "Intel");
        return !a.short && !b.short ? (a.c.s <= b.c.s ? a : b) : (a.short ? b : a); };
      return { cMin: mk(.8), cSug: mk(1.0) };
    };
    const MOBO_WHY = { AM5: "Chipset A620 (básico) o B650/B850 (recomendado). Solo DDR5.", AM4: "Chipset A520/B450 (básico) o B550 (recomendado). Solo DDR4; verificá la BIOS para el modelo exacto.",
      LGA1851: "Chipset B860 (recomendado) o Z890 (para overclock). Solo DDR5.", LGA1700: "Chipset B660/B760 (recomendado) o Z690/Z790 (para overclock). Acepta DDR4 o DDR5 según la placa: la memoria debe coincidir con ella." };

    /* Devuelve las partes de UNA configuración. Cada parte tiene una clave estable (slot + modelo) para detectar
       cuáles coinciden entre mínimo y sugerido. */
    C.parts = (g, c, short, kind, res, ov = {}) => {
      const ramGb = Math.max(kind === "min" ? 16 : 32, ov.ram || 0), ssdGb = Math.max(kind === "min" ? 500 : 1000, ov.ssd || 0), p = C.psuFor(g, c), psuW = kind === "min" ? p.min : p.sug;
      const ssdLabel = ssdGb >= 1000 ? ssdGb / 1000 + " TB" : ssdGb + " GB";
      return [
        { slot: "gpu", label: "Placa de video", key: "gpu:" + g.id, title: "Placa de video: " + g.name,
          why: `${g.vram} GB de VRAM · consumo ${g.tgp} W (${g.vendor}).`, shop: C.findGpu(g) },
        { slot: "cpu", label: "Procesador", key: "cpu:" + c.id, title: "Procesador: " + c.name,
          why: `${c.socket} · ${c.mem} · ${c.tdp} W base, hasta ~${c.maxp} W${c.vendor === "AMD" ? " (estimado)" : ""}.` +
            (c.s ? ` Puntaje de juegos ${c.s}/100 (≈${Math.round(C.cpuFps(c))} FPS máx. en el suite).` : "") +
            (short ? " Es el más potente de la lista y aun así podría limitar a esta placa." : ""), shop: C.findCpu(c) },
        { slot: "psu", label: "Fuente de poder", key: "psu:" + psuW, title: `Fuente de poder: ${psuW} W o más`,
          why: "Incluye procesador al máximo + placa + ~100 W del resto. " + (kind === "min" ? "Es el piso: no bajes de este valor." : "Con ~25 % de margen para que trabaje holgada y dure más.") +
            " Debe tener los conectores de la placa y certificación 80 Plus.", shop: C.findPsu(psuW), watts: psuW },
        { slot: "mobo", label: "Placa madre", key: "mobo:" + c.socket, title: `Placa madre (socket ${c.socket})`, why: MOBO_WHY[c.socket], shop: C.findMobo(c) },
        { slot: "ram", label: "Memoria RAM", key: "ram:" + ramGb + ":" + c.mem, title: `Memoria RAM: ${ramGb} GB ${c.mem === "DDR4/DDR5" ? "(DDR4 o DDR5 según la placa)" : c.mem}`,
          why: "En dos módulos (dual channel). " + (kind === "min" ? "16 GB es lo que piden hoy los juegos exigentes." : "32 GB da margen para juegos nuevos y varias aplicaciones a la vez."), shop: C.findRam(c, ramGb) },
        { slot: "ssd", label: "Almacenamiento", key: "ssd:" + ssdGb, title: `Almacenamiento: SSD ${ssdLabel} (NVMe preferido)`,
          why: "Cyberpunk 2077 y Black Myth: Wukong exigen SSD; ocupan 70 y 130 GB.", shop: C.findSsd(ssdGb) },
      ];
    };
    /* Separa lo compartido de lo propio de cada configuración (comparando slot por slot). */
    C.split = (minP, sugP) => {
      const shared = [], onlyMin = [], onlySug = [];
      minP.forEach((a, i) => { const b = sugP[i]; if (b && a.slot === b.slot && a.key === b.key) shared.push(a); else { onlyMin.push(a); onlySug.push(b); } });
      return { shared, onlyMin: onlyMin.filter(Boolean), onlySug: onlySug.filter(Boolean) };
    };
    /* Total de UNA configuración: suma lo compartido + lo propio una sola vez cada parte. */
    C.total = parts => {
      let total = 0, priced = 0; const missing = [];
      parts.forEach(p => { const best = p.shop && p.shop[0]; if (best) { total += best.p; priced++; } else missing.push(p.label); });
      return { total, priced, count: parts.length, missing };
    };
    C.armado = (g, res) => {
      const { cMin, cSug } = C.pickPair(g, res);
      const min = C.parts(g, cMin.c, cMin.short, "min", res), sug = C.parts(g, cSug.c, cSug.short, "sug", res);
      const sp = C.split(min, sug);
      return { cMin, cSug, min, sug, ...sp, totalMin: C.total(min), totalSug: C.total(sug) };
    };
    C.bucket = fps => fps >= 100 ? ["c-ok", "Excelente"] : fps >= 60 ? ["c-ok", "Muy bueno"] : fps >= 45 ? ["c-warn", "Jugable"] : ["c-bad", "Justo"];
    return C;
  };

  root.CT = CT;
  if (typeof module !== "undefined" && module.exports) module.exports = CT;
})(typeof self !== "undefined" ? self : this);
