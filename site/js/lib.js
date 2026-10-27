/* ComparáTech · núcleo compartido (precios, especificaciones, armado de PC).
   Se usa desde el navegador (window.CT) y desde las pruebas en Node (require). */
(function (root) {
  "use strict";
  const CT = {};

  /* ---------- utilidades ---------- */
  CT.esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  CT.ARS = n => "$" + Math.round(n).toLocaleString("es-AR");
  CT.price = o => o.price_cash ?? o.price_list;
  /* Números de página para el paginador: siempre la primera y la última, la actual con sus vecinas, y "…" en los saltos. */
  CT.pageList = (cur, total) => {
    if (total <= 1) return [1];
    const keep = new Set([1, total, cur - 1, cur, cur + 1]);
    if (cur <= 3) { keep.add(2); keep.add(3); keep.add(4); }
    if (cur >= total - 2) { keep.add(total - 1); keep.add(total - 2); keep.add(total - 3); }
    const out = []; let last = 0;
    [...keep].filter(n => n >= 1 && n <= total).sort((a, b) => a - b).forEach(n => {
      if (n - last === 2) out.push(last + 1); else if (n - last > 2) out.push("…");
      out.push(n); last = n;
    });
    return out;
  };
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
    const mh = n.match(/(\d{3,5})\s?(?:mhz|mt\/?s)\b/i) || n.match(/ddr[45][- ](\d{4})\b/i); if (mh) out.mhz = +mh[1];
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
    if (!o.iface && o.kind === "Memoria flash") { const u = n.match(/uhs-?(i{1,2})\b|usb[ -]?(3\.\d|c)\b/i); if (u) o.iface = u[1] ? "UHS-" + u[1].toUpperCase() : "USB " + u[2].toUpperCase(); }
    const rpm = n.match(/(\d{4,5})\s?rpm/i); if (rpm) o.rpm = +rpm[1];
    // la generación PCIe solo existe en discos NVMe: en SATA, discos rígidos y memorias flash "no aplica"
    const ext = /externo|port[aá]til|usb|micro ?sd/i.test(n);
    if (!o.iface && ext && /externo|port[aá]til/i.test(n) && /usb|tipo[ -]?c|type[ -]?c/i.test(n)) o.iface = "USB (externo)";
    o.genNA = o.kind === "HDD" || o.kind === "Memoria flash" || o.iface === "SATA" || ext;
    o.external = /externo|port[aá]til|usb|micro ?sd/i.test(n);
    return o;
  }
  const CERT = { white: 1, bronze: 2, silver: 3, gold: 4, platinum: 5, titanium: 6 };
  function psuSpec(n) {
    const w = n.match(/(\d{3,4})\s?w\b/i), c = n.match(/80\s?\+?\s?plus\s?(white|bronze|silver|gold|platinum|titanium)?/i);
    const cy = !c && n.match(/cybenetics\s?(bronze|silver|gold|platinum|titanium|diamond)/i);
    const cert = c ? (c[1] ? c[1].toLowerCase() : "white") : null;
    return { w: w ? +w[1] : null, cert, certRank: cert ? CERT[cert] : null, cyb: cy ? "Cybenetics " + cy[1][0].toUpperCase() + cy[1].slice(1).toLowerCase() : null, modular: /modular/i.test(n) && !/no modular|semi/i.test(n), semi: /semi[- ]?modular/i.test(n),
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
    const d = n.match(/ddr([45])/i) || n.match(/\bd([45])\b/i); if (d) o.ddr = "DDR" + d[1];
    else if (o.socket) { const only = { AM4: "DDR4", LGA1200: "DDR4", AM5: "DDR5", LGA1851: "DDR5" }[o.socket]; if (only) { o.ddr = only; o.ddrBySocket = true; } }
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
    const i = n.match(/(\d{2}(?:[.,]\d)?)\s?("|”|“|″|''|´|'|pulg|in\b)/i); if (i) o.inch = num(i[1]);
    else { const j = n.match(/\b(2[0-9]|3[0-9]|4[0-9])(?:[.,]\d)?\s?"/) || n.match(/\b(1[89]|[234]\d)([.,]\d)?\s+(?=led\b|ips\b|va\b|fhd\b|qhd\b|uhd\b|full\b|curvo\b|gamer\b|\d{2,3}\s?hz\b)/i); if (j) o.inch = num(j[1] + (j[2] || "")); }
    const h = n.match(/(\d{2,3})\s?hz/i); if (h) o.hz = +h[1];
    const p = n.match(/\b(qd-?oled|w-?oled|oled|nano ?ips|fast ?ips|ah-?ips|ips|hva|sva|mva|va|tn|pls|mini ?led)\b/i);
    if (p) { const k = p[1].toUpperCase().replace(/\s|-/g, ""); o.panel = { QDOLED: "QD-OLED", WOLED: "OLED (WOLED)", NANOIPS: "IPS (Nano IPS)", FASTIPS: "IPS (Fast IPS)", AHIPS: "IPS", HVA: "VA (HVA)", SVA: "VA (SVA)", MVA: "VA (MVA)", MINILED: "Mini LED" }[k] || k; }
    const m = n.match(/(\d(?:[.,]\d)?)\s?ms/i); if (m) o.ms = num(m[1]);
    const r = n.match(/\b(4k|uhd|wqhd|qhd|1440p|2k|fhd|1080p|full ?hd|ultra ?hd)\b/i);
    if (r) { const e = RESMAP[r[1].toLowerCase().replace(/\s/g, "")]; o.res = e[2]; o.px = e[0] * e[1]; }
    else { const x = n.match(/\b(1920|2560|3440|3840|1366|1600)\s?[x×]\s?(1080|1440|2160|768|900|1200)\b/i);
      if (x) { o.px = +x[1] * +x[2]; o.res = { "1920x1080": "FHD 1080p", "2560x1440": "QHD 1440p", "3840x2160": "4K UHD", "3440x1440": "UWQHD 3440×1440" }[x[1] + "x" + x[2]] || x[1] + "×" + x[2]; } }
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
  /* ---- periféricos: lo que dice el TÍTULO (la ficha de la tienda, si existe, tiene prioridad) ---- */
  const WIRELESS = /inal[aá]mbric|wireless|\bbluetooth\b|2[.,]4 ?ghz|lightspeed|hyperspeed|\bwifi\b/i;
  function mouseSpec(n) {
    const o = { dpi: null, botones: null, peso: null, polling: null, sensor: null, wireless: WIRELESS.test(n) ? true : /\bcable|cableado|usb\b/i.test(n) ? false : null,
      rgb: /\brgb\b|rainbow|argb|lightsync|chroma/i.test(n) ? "RGB" : /retro-?ilumin|retrolumin|\bled\b|colores/i.test(n) ? "Iluminado" : null, clicks: null };
    const d = n.match(/(\d{1,2}[.,]?\d{3}|\d{3,5})\s?(?:dpi|cpi)\b/i); if (d) o.dpi = +d[1].replace(/[.,]/, "");
    const b = n.match(/(\d{1,2})\s?botones/i); if (b) o.botones = +b[1];
    const w = n.match(/\b(\d{2,3})\s?(?:g|gr|gramos)\b/i); if (w && +w[1] >= 30 && +w[1] <= 200) o.peso = +w[1];
    const h = n.match(/(\d{3,4})\s?hz\b/i); if (h) o.polling = +h[1];
    const se = n.match(/\b(hero(?: 2| 25k| 16k)?|focus ?pro(?: 3[05]k)?|paw ?\d{4}|pmw ?\d{4}|true move \w+|tracker|[oó]ptico|l[aá]ser)\b/i);
    if (se) o.sensor = se[1].replace(/^optico$/i, "Óptico").replace(/^laser$/i, "Láser");
    const c = n.match(/(\d{1,3})\s?(?:millones|m)\s?(?:de\s)?(?:clics|clicks)/i); if (c) o.clicks = +c[1];
    return o;
  }
  function keyboardSpec(n) {
    const o = { mec: /mec[aá]nic|mechanical/i.test(n) ? "Mecánico" : /membrana|membrane/i.test(n) ? "Membrana" : /[oó]ptico/i.test(n) ? "Óptico-mecánico" : null,
      switch: null, formato: null, rgb: /\brgb\b|rainbow|argb|lightsync|chroma/i.test(n) ? "RGB" : /retro-?ilumin|retrolumin|\bled\b|\d colores/i.test(n) ? "Retroiluminado" : null, wireless: WIRELESS.test(n) ? true : null, idioma: null };
    const sw = n.match(/\b(outemu|gateron|kailh|cherry ?mx|huano|jixian|akko|tte|redragon)?\s?(red|blue|brown|black|yellow|silver|speed silver|white|banana|lemon)\s?(?:switch(?:es)?)?\b/i);
    if (sw && /switch|outemu|gateron|kailh|cherry|huano|jixian|akko|mec[aá]nic/i.test(n)) o.switch = [sw[1], sw[2]].filter(Boolean).map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(" ");
    const f = n.match(/\b(60|65|75|80|96|98|100)\s?%|\b(tkl|tenkeyless)\b|\bfull ?size\b/i);
    if (f) o.formato = f[1] ? f[1] + " %" : f[2] ? "TKL (sin pad numérico)" : "Completo";
    if (/espa[ñn]ol|\besp?\b|latam|\bla\b|ñ/i.test(n)) o.idioma = "Español"; else if (/ingl[eé]s|\bus\b|english/i.test(n)) o.idioma = "Inglés";
    const c = n.match(/(\d{1,3})\s?(?:millones|m)\s?(?:de\s)?(?:pulsaciones|keystrokes)/i); o.vida = c ? +c[1] : null;
    return o;
  }
  function headsetSpec(n) {
    const o = { wireless: WIRELESS.test(n) ? true : null, surround: /7[.,]1/.test(n) ? "7.1 (virtual o real, según el modelo)" : null,
      driver: null, mic: /micr[oó]fono|\bmic\b|headset/i.test(n) || null, anc: /cancelaci[oó]n (activa )?de ruido|\banc\b|noise cancel/i.test(n) || null,
      conexion: null, rgb: /\brgb\b|argb/i.test(n) || null, tipo: /in-?ear|earbuds|intraural/i.test(n) ? "In-ear" : /headset|vincha|over-?ear|on-?ear/i.test(n) ? "Vincha (over-ear)" : null };
    const d = n.match(/\b(\d{2})\s?mm\b/i); if (d && +d[1] >= 6 && +d[1] <= 60) o.driver = +d[1];
    const con = []; if (/usb/i.test(n)) con.push("USB"); if (/3[.,]5 ?mm|jack|\bp2\b/i.test(n)) con.push("Jack 3,5 mm"); if (/bluetooth/i.test(n)) con.push("Bluetooth"); if (/2[.,]4 ?ghz|receptor|lightspeed|hyperspeed/i.test(n)) con.push("Inalámbrico 2,4 GHz");
    if (con.length) o.conexion = con.join(" + ");
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
      case "mouses": return mouseSpec(name);
      case "teclados": return keyboardSpec(name);
      case "auriculares": return headsetSpec(name);
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
    /* Placas que solo se comparan (sin datos suficientes para recomendarlas). Solo las usan Comparar y la página de producto. */
    const gpuxTests = (HW.gpux || []).map(g => [g, rxm(g.m, g.x)]);
    C.hwGpuX = (name, vram) => { if (NOT_PC.test(name)) return null; const v = vram === undefined ? vramOf(name) : vram;
      const hit = gpuxTests.find(([g, t]) => t(name) && (v == null || v === g.vram)); return hit ? hit[0] : null; };
    /* "Sin Cooler" / "con cooler Wraith" describen al procesador, no lo convierten en un cooler */
    const cpuClean = n => n.replace(/\((?:simil|similar|equivalente|tipo)\b[^)]*\)|\b(?:simil|similar a|equivalente a)\s+\S+(?:\s+\S+)?/ig, " ").replace(/\+?\s*\bwraith\s+(?:stealth|spire|prism|max)\b(?:\s+cooler)?/ig, " ").replace(/\+\s*(?:cooler|disipador)\b/ig, " ").replace(/\b(?:sin|con|incluye|no incluye|s\/|c\/)\s?(?:cooler|disipador|ventilador|fan)(?:\s+(?:wraith|stock|original|stealth|prism))?(?:\s+(?:stealth|spire))?/ig, " ");
    C.hwCpu = name => { name = cpuClean(name); if (/cooler|disipador|fan|pasta|\bkit\b/i.test(name)) return null; const hit = cpuTests.find(([c, t]) => t(name)); return hit ? hit[0] : null; };

    const isPc = n => /^pc\b|\bpc (armada|gamer|powered)|powered by|notebook|combo|\bkit\b|all in one/i.test(n);
    C.findGpu = g => { const t = rxm(g.m, g.x);
      return C.cheapest(inCat("placas-de-video").filter(p => !isPc(p.name) && !NOT_PC.test(p.name) && t(p.name) && (vramOf(p.name) == null || vramOf(p.name) === g.vram))); };
    C.findCpu = c => { const t = rxm(c.m);
      return C.cheapest(inCat("procesadores").filter(p => { const n = cpuClean(p.name); return t(n) && !/cooler|disipador|fan|\bkit\b|combo|pc /i.test(n); })); };
    C.findPsu = w => C.cheapest(inCat("fuentes").filter(p => { const s = psuSpec(p.name); return s.w && s.w >= w && s.w <= w + 250 && s.cert && !/combo|gabinete/i.test(p.name); }));
    C.findMobo = c => C.cheapest(inCat("motherboards").filter(p => moboSpec(p.name).socket === c.socket));
    C.findRam = (c, gb) => { const ddr = c.mem === "DDR5" ? /ddr5/i : c.mem === "DDR4" ? /ddr4/i : /ddr[45]/i;
      return C.cheapest(inCat("memorias-ram").filter(p => { const s = ramSpec(p.name); return ddr.test(p.name) && !s.laptop && s.gb && s.gb >= gb && s.gb <= gb * 2; })); };
    C.findSsd = gb => C.cheapest(inCat("almacenamiento").filter(p => { const s = storageSpec(p.name);
      return s.kind === "SSD" && !s.external && s.gb && s.gb >= gb && s.gb <= gb * 2.1 && /nvme|m\.2|sata/i.test(p.name); }));

    /* ---------- lógica de armado (la misma que usaba armado.html) ---------- */
    C.cpuFps = c => c.s ? HW.ref.gpu_fps_ref * c.s / HW.ref.cpu_score_ref : null;
    C.pickCpu = (Gv, factor, vendor) => {
      /* para RECOMENDAR una compra solo se usan procesadores con puntaje medido (los estimados sirven para evaluar lo que ya se tiene) */
      const l = HW.cpus.filter(c => c.s && !c.se && (!vendor || c.vendor === vendor)).sort((a, b) => a.s - b.s);
      // entre los que alcanzan, el más barato con stock (si ninguno tiene precio, el de menor puntaje que alcanza)
      const okAll = l.filter(c => C.cpuFps(c) >= factor * Gv);
      if (!okAll.length) return { c: l[l.length - 1], short: true };
      const price = c => { const x = C.findCpu ? C.findCpu(c)[0] : null; return x ? x.p : Infinity; };
      const best = okAll.reduce((m, c) => price(c) < price(m) ? c : m, okAll[0]);
      return { c: best, short: false };
    };
    C.psuFor = (g, c) => { const base = (c.maxp || c.tdp * 2) + g.tgp + 100, min = Math.max(g.psu, CT.up50(base)), sug = Math.max(min, CT.up50(base * 1.25)); return { min, sug, base }; };
    /* Procesador para cada nivel (mínimo / sugerido). vendor = "AMD" | "Intel" fuerza la marca; sin vendor se elige
       la plataforma más barata completa (procesador + placa madre + memoria + resto) entre las dos que alcanzan. */
    C.pickPair = (g, res, vendor) => {
      const Gv = g.p[res];
      const mk = (f, kind) => {
        if (vendor) return C.pickCpu(Gv, f, vendor);
        const a = C.pickCpu(Gv, f, "AMD"), b = C.pickCpu(Gv, f, "Intel");
        if (a.short !== b.short) return a.short ? b : a;
        const cost = x => { const t = C.total(C.parts(g, x.c, x.short, kind, res)); return t.missing.length ? Infinity : t.total; };
        const ca = cost(a), cb = cost(b);
        if (ca !== cb) return ca < cb ? a : b;
        return a.c.s <= b.c.s ? a : b;
      };
      return { cMin: mk(.8, "min"), cSug: mk(1.0, "sug") };
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
          why: `${c.socket} · ${c.mem} · ${c.tdp} W base, ${c.maxp ? `hasta ~${c.maxp} W${c.vendor === "AMD" ? " (estimado)" : ""}` : "potencia máxima no publicada"}.` +
            (c.s ? ` Puntaje de juegos ${c.s}/100${c.se ? " (estimado)" : ""} (≈${Math.round(C.cpuFps(c))} FPS máx. en el suite).` : "") +
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
    C.armado = (g, res, vendor) => {
      const { cMin, cSug } = C.pickPair(g, res, vendor);
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
