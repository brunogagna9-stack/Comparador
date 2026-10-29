/* ComparáTech · filtros propios de cada categoría (actualización 27).
   Cada filtro saca su valor de: 1) la ficha técnica guardada (specs.json), 2) la base de hardware
   (procesadores y placas de video, datos de los fabricantes) o 3) el título que publicó la tienda.
   Si el dato no aparece en ninguna parte, el producto cae en «Sin dato»: nunca se inventa.
   Se dejaron afuera los filtros con muy pocos datos (socket de coolers, largo de placa de video en
   gabinetes, LED/LCD en monitores, micrófono / 7.1 / USB-jack / cancelación de ruido en auriculares,
   RGB en mouse), porque mostrarían casi todo como «Sin dato». */
(function (root) {
  "use strict";
  const CT = root.CT || (typeof require === "function" ? require("./lib.js") : null);
  const FX = {};
  let C = null;
  FX.NONE = "Sin dato";
  FX.init = ctx => { C = ctx; };   // ctx = CT.create(HW, productos, meta, specs) (opcional)

  const bucket = (v, steps) => { if (v == null || isNaN(v)) return null; for (const [max, l] of steps) if (v <= max) return l; return null; };
  const gbLabel = gb => gb >= 1000 ? (gb % 1000 ? (gb / 1000).toLocaleString("es-AR") : gb / 1000) + " TB" : gb + " GB";
  const sp = (g, f) => { const r = C && C.sf ? C.sf(g, f) : null; return r ? r.v : null; };
  const yes = v => v === true || v === 1 || v === "1" || v === "True" || v === "true";
  const no = v => v === false || v === 0 || v === "0" || v === "False" || v === "false";

  /* procesadores: serie, socket y gráficos integrados */
  function cpuFamily(n) {
    const l = n.toLowerCase();
    let m = l.match(/ryzen\s?(?:ai\s?)?([3579])\b/) || l.match(/\br([3579])[- ]\d{4}/); if (m) return "Ryzen " + m[1];
    m = l.match(/core\s?ultra\s?([579])\b/); if (m) return "Core Ultra " + m[1];
    m = l.match(/core\s?i([3579])\b|\bi([3579])[- ]\d{4,5}/); if (m) return "Core i" + (m[1] || m[2]);
    m = l.match(/\bcore\s?([3579])\s?\d{3}/); if (m) return "Core " + m[1];
    if (/athlon/.test(l)) return "Athlon"; if (/pentium|celeron|intel\s?n\d{2,3}\b/.test(l)) return "Pentium / Celeron / N";
    if (/xeon|epyc|threadripper/.test(l)) return "Servidor / workstation";
    if (/apple\s?m\d|\bm[1-4]\s?(pro|max)?\b.*apple|macbook/.test(l)) return "Apple M";
    if (/snapdragon/.test(l)) return "Snapdragon";
    return null;
  }
  FX.cpuFamily = cpuFamily;
  function cpuSocket(n) {
    const l = n.toLowerCase();
    if (/\bam5\b/.test(l)) return "AM5"; if (/\bam4\b/.test(l)) return "AM4";
    if (/1851/.test(l)) return "LGA1851"; if (/1700/.test(l)) return "LGA1700"; if (/\b1200\b|s1200|lga\s?1200/.test(l)) return "LGA1200";
    if (/115[01]/.test(l)) return "LGA1151 / 1150";
    const hw = C && C.hwCpu ? C.hwCpu(n) : null; if (hw && hw.socket) return hw.socket;
    // deducido del número de modelo (regla fija de cada generación)
    let m = l.match(/ryzen\s?[3579]\s?(\d{4})|\br[3579][- ](\d{4})/);
    if (m) { const d = +(m[1] || m[2])[0]; return d >= 7 ? "AM5" : d >= 1 ? "AM4" : null; }
    m = l.match(/core\s?ultra\s?[579]\s?2\d{2}/); if (m) return "LGA1851";
    m = l.match(/(?:core\s?i[3579][- ]?|\bi[3579][- ])(\d{4,5})/);
    if (m) { const s = m[1]; if (s.length === 5) { const gen = +s.slice(0, 2); return gen >= 12 && gen <= 14 ? "LGA1700" : gen >= 10 && gen <= 11 ? "LGA1200" : null; } const gen = +s[0]; return gen >= 8 && gen <= 9 ? "LGA1151 / 1150" : null; }
    return null;
  }
  FX.cpuSocket = cpuSocket;
  function cpuIgpu(n) {
    if (/sin (video|gr[aá]ficos)|s\/\s?video|sin gpu/i.test(n)) return "Sin gráficos integrados";
    if (/c\/\s?video|con (video|gr[aá]ficos)/i.test(n)) return "Con gráficos integrados";
    const hw = C && C.hwCpu ? C.hwCpu(n) : null;
    if (hw && hw.spec && typeof hw.spec.igpu === "boolean") return hw.spec.igpu ? "Con gráficos integrados" : "Sin gráficos integrados";
    const t = CT.hasIgpu(n); return t == null ? null : t ? "Con gráficos integrados" : "Sin gráficos integrados";
  }
  /* placas de video: chip, memoria y tipo de memoria (el tipo sale de la ficha del fabricante del chip) */
  function gpuHw(n) { if (!C) return null; return (C.hwGpu && C.hwGpu(n)) || (C.hwGpuX && C.hwGpuX(n)) || null; }
  function gpuMem(n) {
    const m = n.match(/gddr\s?(\d)(x)?/i); if (m) return "GDDR" + m[1] + (m[2] ? "X" : "");
    const hw = gpuHw(n); return hw && hw.spec && hw.spec.mt ? hw.spec.mt : null;
  }
  function gpuBrand(n) {
    if (/\b(rtx|gtx|geforce|nvidia|gt\s?\d{3,4})\b/i.test(n)) return "NVIDIA (GeForce)";
    if (/\brx\s?\d{3,4}|radeon/i.test(n)) return "AMD (Radeon)";
    if (/\barc\s?[ab]\d{3}/i.test(n)) return "Intel (Arc)";
    return null;
  }
  /* refrigeración: tipo */
  function coolType(n) {
    if (/pasta|grasa|t[eé]rmica\b.*(gr|g\b)|thermal (paste|compound)|compuesto t[eé]rmico/i.test(n)) return "Pasta térmica";
    if (/water|l[ií]quid|\baio\b|watercool/i.test(n)) return "Líquida (watercooler)";
    if (/\bfan\b|ventilador|\bkit\s?x?\d|pack\s?x?\d|x\s?\d\s?(fan|cooler)|\d\s?x\s?120|gabinete/i.test(n) && !/cpu|procesador|disipador|torre|tower/i.test(n)) return "Ventiladores para gabinete";
    if (/cooler\s?(cpu|para procesador)|cpu\s?cooler|disipador|torre|tower|heatpipe|\bak\d{3}|hyper\s?212|frozn|assassin|peerless|gammaxx/i.test(n)) return "Cooler de aire para procesador";
    return null;
  }
  function coolSize(n) { const t = coolType(n); if (t === "Pasta térmica" || t === "Cooler de aire para procesador") return null;
    const m = n.match(/\b(120|140|240|280|360|420)\s?mm\b/i) || (t === "Líquida (watercooler)" && n.match(/\b(120|240|280|360|420)\b/)); return m ? m[1] + " mm" : null; }
  /* gabinetes: qué placa madre entra (lo que dice el título; "Mid Tower" es el formato ATX estándar) */
  function caseForm(n) {
    if (/e-?atx|full[- ]?tower/i.test(n)) return "E-ATX / Full Tower";
    if (/mini[- ]?itx|\bitx\b/i.test(n) && !/m-?atx|micro/i.test(n)) return "Mini-ITX";
    if (/m-?atx|micro[- ]?atx|mini[- ]?tower|\bmatx\b/i.test(n)) return "Micro-ATX";
    if (/\batx\b|mid[- ]?tower|media torre/i.test(n)) return "ATX (Mid Tower)";
    return null;
  }

  // el color tiene que estar pegado a «switch» o a la marca del switch (si no, suele ser el color del teclado)
  const SW_C = "(red|blue|brown|black|yellow|silver|banana|lemon|white)", SWW = "(?:switch(?:es)?|swtich|swicht|sw|interruptor|outemu|gateron|kailh|cherry|mlx|qx2|huano|jixian|akko|tte)";
  const SWITCH_RX = new RegExp(`\\b${SW_C}\\s?${SWW}\\b|\\b${SWW}(?:\\s(?:box|mx|silent|linear|lineal|sp|pro|hybrid|v2))*\\s?${SW_C}\\b|mec[aá]nic.*\\((red|blue|brown|yellow|black|silver)\\)`, "i");
  FX.SWITCH_RX = SWITCH_RX;
  // serie de la placa de video de notebooks y PC armadas («RTX 4060» -> «NVIDIA RTX 40xx»)
  function gpuSeries(s) { if (!s) return null; const m = s.match(/(RTX|GTX)\s?(\d{2})(\d{2})/i);
    if (m) return m[3] === "00" && +m[2] <= 20 ? "NVIDIA RTX profesional" : `NVIDIA ${m[1].toUpperCase()} ${m[2]}xx`;
    return /^RX/i.test(s) ? "AMD Radeon RX" : /^ARC/i.test(s) ? "Intel Arc" : null; }
  FX.gpuSeries = gpuSeries;
  const F = {
    procesadores: [
      { k: "serie", l: "Serie", get: g => cpuFamily(g.name) },
      { k: "socket", l: "Socket", get: g => cpuSocket(g.name) },
      { k: "igpu", l: "Gráficos integrados", get: g => cpuIgpu(g.name) },
      { k: "cooler", l: "Cooler en la caja", get: g => { const hw = C && C.hwCpu ? C.hwCpu(g.name) : null; const t = CT.coolerIncluded ? CT.coolerIncluded(hw || {}, g.name) : null;
        return t == null ? null : t ? "Incluye cooler" : "Sin cooler"; } },
    ],
    "placas-de-video": [
      { k: "chip", l: "Chip", get: g => gpuBrand(g.name) },
      { k: "vram", l: "Memoria", get: g => { const v = CT.vramOf(g.name); return v ? v + " GB" : null; }, num: true },
      { k: "mem", l: "Tipo de memoria", get: g => gpuMem(g.name), note: "Si la tienda no lo dice, se toma de la ficha del fabricante del chip." },
    ],
    "memorias-ram": [
      { k: "ddr", l: "Tipo", get: g => CT.parse(g.name, "memorias-ram").ddr },
      { k: "gb", l: "Capacidad total", get: g => { const v = CT.parse(g.name, "memorias-ram").gb; return v && v <= 256 ? v + " GB" : null; }, num: true },
      { k: "mhz", l: "Velocidad", get: g => bucket(CT.parse(g.name, "memorias-ram").mhz, [[2666, "Hasta 2666 MHz"], [3200, "2667–3200 MHz"], [3600, "3201–3600 MHz"], [5600, "3601–5600 MHz"], [6400, "5601–6400 MHz"], [99999, "Más de 6400 MHz"]]) },
      { k: "fmt", l: "Para", get: g => /sodimm|so-dimm|notebook|laptop/i.test(g.name) ? "Notebook (SO-DIMM)" : /\budimm\b|\bdimm\b|desktop|\bpc\b/i.test(g.name) ? "PC de escritorio" : null },
    ],
    motherboards: [
      { k: "socket", l: "Socket", get: g => CT.parse(g.name, "motherboards").socket },
      { k: "chipset", l: "Chipset", get: g => CT.parse(g.name, "motherboards").chipset },
      { k: "ddr", l: "Memoria", get: g => CT.parse(g.name, "motherboards").ddr, note: "AM4 y LGA1200 solo usan DDR4; AM5 y LGA1851 solo DDR5." },
      { k: "form", l: "Tamaño", get: g => CT.parse(g.name, "motherboards").form, note: "El tamaño sale del título (por ejemplo «B650M» = Micro-ATX)." },
      { k: "wifi", l: "Wi-Fi", get: g => CT.parse(g.name, "motherboards").wifi ? "Con Wi-Fi" : null },
    ],
    almacenamiento: [
      { k: "tipo", l: "Tipo", get: g => { const s = CT.parse(g.name, "almacenamiento"), n = g.name;
        if (/pendrive|pen drive/i.test(n)) return "Pendrive"; if (/micro ?sd|\bsdxc|\bsdhc|tarjeta/i.test(n)) return "Tarjeta de memoria";
        if (/extern|port[aá]til/i.test(n)) return s.kind === "SSD" ? "SSD externo" : "Disco externo";
        if (s.kind === "SSD") return s.iface === "NVMe (M.2)" ? "SSD NVMe (M.2)" : s.iface === "SATA" ? "SSD SATA" : s.iface ? "SSD M.2 (sin especificar)" : "SSD (sin especificar)";
        if (s.kind === "HDD") return "Disco rígido (HDD)"; return null; } },
      { k: "cap", l: "Capacidad", get: g => bucket(CT.parse(g.name, "almacenamiento").gb, [[128, "Hasta 128 GB"], [256, "240–256 GB"], [512, "480–512 GB"], [1024, "1 TB"], [2048, "2 TB"], [4096, "3–4 TB"], [1e6, "Más de 4 TB"]]) },
    ],
    refrigeracion: [
      { k: "tipo", l: "Tipo", get: g => coolType(g.name) },
      { k: "size", l: "Medida (radiador o ventilador)", get: g => coolSize(g.name), num: true },
    ],
    fuentes: [
      { k: "w", l: "Potencia", get: g => bucket(CT.parse(g.name, "fuentes").w, [[450, "Hasta 450 W"], [550, "451–550 W"], [650, "551–650 W"], [750, "651–750 W"], [850, "751–850 W"], [1000, "851–1000 W"], [1e5, "Más de 1000 W"]]) },
      { k: "cert", l: "Certificación", get: g => { const s = CT.parse(g.name, "fuentes"); return s.cert ? "80 Plus " + s.cert[0].toUpperCase() + s.cert.slice(1) : s.cyb || (/sin certificaci|generica|gen[eé]rica/i.test(g.name) ? "Sin certificación" : null); },
        order: ["80 Plus White", "80 Plus Bronze", "80 Plus Silver", "80 Plus Gold", "80 Plus Platinum", "80 Plus Titanium"] },
      { k: "mod", l: "Cables", get: g => { const s = CT.parse(g.name, "fuentes"); return s.semi ? "Semi modular" : s.modular ? "Modular" : /no modular|non modular/i.test(g.name) ? "No modular" : null; } },
      { k: "atx3", l: "Norma ATX 3", get: g => /atx\s?3|12vhpwr|12v-?2x6|pcie\s?5/i.test(g.name) ? "ATX 3.x (conector 16 pines)" : null },
    ],
    gabinetes: [
      { k: "form", l: "Placa madre que entra", get: g => caseForm(g.name), note: "Un gabinete ATX también acepta placas Micro-ATX y Mini-ITX." },
      { k: "fans", l: "Ventiladores incluidos", get: g => { const m = g.name.match(/(?:fan|fans|cooler|coolers|ventiladores?)\s?x\s?(\d)|\bx\s?(\d)\s?(?:fan|cooler)|(\d)\s?x?\s?(?:fans?|coolers|ventiladores)\b|\bfx(\d)\b|(\d)x\s?120/i);
        if (!m) return /sin (fan|cooler|ventilador)/i.test(g.name) ? "Sin ventiladores" : null; const k = +(m[1] || m[2] || m[3] || m[4] || m[5]); return k ? (k >= 4 ? "4 o más" : k + (k === 1 ? " ventilador" : " ventiladores")) : null; } },
    ],
    monitores: [
      { k: "inch", l: "Tamaño", get: g => bucket(CT.parse(g.name, "monitores").inch, [[22, "Hasta 22\""], [24.5, "23–24\""], [27, "25–27\""], [32, "28–32\""], [100, "34\" o más"]]) },
      { k: "res", l: "Resolución", get: g => CT.parse(g.name, "monitores").res },
      { k: "hz", l: "Frecuencia", get: g => bucket(CT.parse(g.name, "monitores").hz, [[75, "60–75 Hz"], [120, "100–120 Hz"], [170, "144–170 Hz"], [200, "180–200 Hz"], [300, "240–300 Hz"], [1000, "Más de 300 Hz"]]) },
      { k: "panel", l: "Panel", get: g => { const p = CT.parse(g.name, "monitores").panel; if (!p) return null; return /OLED/.test(p) ? "OLED" : /^IPS|PLS/.test(p) ? "IPS" : /^VA/.test(p) ? "VA" : p === "TN" ? "TN" : p === "Mini LED" ? "Mini LED" : null; } },
      { k: "ms", l: "Tiempo de respuesta", get: g => bucket(CT.parse(g.name, "monitores").ms, [[1, "1 ms o menos"], [4, "2–4 ms"], [100, "5 ms o más"]]) },
    ],
    notebooks: [
      { k: "cpu", l: "Procesador", get: g => cpuFamily(g.name) },
      { k: "ram", l: "RAM", get: g => { const v = CT.parse(g.name, "notebooks").ram; return v ? v + " GB" : null; }, num: true },
      { k: "ssd", l: "Almacenamiento", get: g => bucket(CT.parse(g.name, "notebooks").ssd, [[256, "Hasta 256 GB"], [512, "512 GB"], [1024, "1 TB"], [1e6, "Más de 1 TB"]]) },
      { k: "inch", l: "Pantalla", get: g => bucket(CT.parse(g.name, "notebooks").inch || (g.name.match(/\b(1[1-8](?:[.,]\d)?)\s?(?:"|”|pulg|''|fhd|hd\b)/i) || [])[1]?.replace(",", "."), [[13.9, "Hasta 13\""], [14.9, "14\""], [16.1, "15–16\""], [30, "17\" o más"]]) },
      { k: "gpu", l: "Placa de video dedicada", get: g => gpuSeries(CT.parse(g.name, "notebooks").gpu), note: "Solo se listan las que la tienda nombra en el título." },
    ],
    "pcs-armadas": [
      { k: "cpu", l: "Procesador", get: g => cpuFamily(g.name) },
      { k: "ram", l: "RAM", get: g => { const v = CT.parse(g.name, "pcs-armadas").ram; return v ? v + " GB" : null; }, num: true },
      { k: "ssd", l: "Almacenamiento", get: g => bucket(CT.parse(g.name, "pcs-armadas").ssd, [[256, "Hasta 256 GB"], [512, "480–512 GB"], [1024, "1 TB"], [1e6, "Más de 1 TB"]]) },
      { k: "gpu", l: "Placa de video", get: g => { const s = gpuSeries(CT.parse(g.name, "pcs-armadas").gpu); if (s) return s;
        return /gr[aá]ficos? integrad|video integrad|radeon graphics|vega|uhd graphics|iris|\b\d{4}g\b/i.test(g.name) ? "Gráficos integrados" : null; } },
    ],
    mouses: [
      { k: "con", l: "Conexión", get: g => { const v = sp(g, "inalambrico"); if (yes(v)) return "Inalámbrico"; if (no(v)) return "Con cable";
        const w = CT.parse(g.name, "mouses").wireless; return w === true ? "Inalámbrico" : w === false ? "Con cable" : null; } },
      { k: "uso", l: "Uso", get: g => /gamer|gaming|\bg\d{3}\b|razer|hyperx|redragon|logitech g/i.test(g.name) ? "Gamer" : /oficina|office|ergon/i.test(g.name) ? "Oficina / ergonómico" : null },
    ],
    teclados: [
      { k: "mec", l: "Tipo", get: g => { const v = sp(g, "mecanismo"); if (v) return /magn/i.test(v) ? "Magnético (Hall)" : /opto|ó?ptico/i.test(v) ? "Óptico-mecánico" : /membrana/i.test(v) ? "Membrana" : "Mecánico";
        return CT.parse(g.name, "teclados").mec; } },
      { k: "sw", l: "Switch", get: g => { const m = g.name.match(SWITCH_RX); if (m) { const c = (m[1] || m[2] || m[3]).toLowerCase(); return c[0].toUpperCase() + c.slice(1); }
        const v = sp(g, "switch"); return v && /lineal|linear/i.test(v) ? "Lineal" : null; }, note: "Red/Black/Yellow/Silver = lineales · Brown = táctil · Blue = clicky." },
      { k: "rgb", l: "Iluminación", get: g => { const v = sp(g, "rgb"); if (v) return /sin/i.test(v) || no(v) ? "Sin iluminación" : /rgb|rainbow/i.test(v) || yes(v) ? "RGB" : "Un color";
        const k = CT.parse(g.name, "teclados").rgb; return k === "RGB" ? "RGB" : k ? "Un color" : null; } },
      { k: "con", l: "Conexión", get: g => { const v = sp(g, "bluetooth"); if (yes(v)) return "Inalámbrico";
        return CT.parse(g.name, "teclados").wireless ? "Inalámbrico" : /\bcable|usb\b/i.test(g.name) && !/inal|wireless|bluetooth/i.test(g.name) ? "Con cable" : (v != null && no(v) ? "Con cable" : null); } },
      { k: "fmt", l: "Formato", get: g => { const v = sp(g, "formato"); const s = v || CT.parse(g.name, "teclados").formato; if (!s) return null;
        return /60/.test(s) ? "60 %" : /65/.test(s) ? "65 %" : /75/.test(s) ? "75 %" : /tkl|80/i.test(s) ? "TKL (sin pad numérico)" : /96|98/.test(s) ? "96–98 %" : /complet|100/i.test(s) ? "Completo" : null; } },
    ],
    auriculares: [
      { k: "con", l: "Conexión", get: g => { const v = sp(g, "conexion"); if (v) return /inal/i.test(v) ? "Inalámbrico" : "Con cable";
        return CT.parse(g.name, "auriculares").wireless ? "Inalámbrico" : null; } },
      { k: "tipo", l: "Tipo", get: g => { const v = sp(g, "tipo"); if (v) return /in-?ear/i.test(v) ? "In-ear" : "Vincha (headset)";
        const t = CT.parse(g.name, "auriculares").tipo; return t === "In-ear" ? "In-ear" : t ? "Vincha (headset)" : /gamer|gaming/i.test(g.name) ? "Vincha (headset)" : null; } },
      { k: "uso", l: "Uso", get: g => /gamer|gaming/i.test(g.name) ? "Gamer" : null },
    ],
  };
  FX.defs = cat => F[cat] || [];
  FX.cats = () => Object.keys(F);
  /* valor de un filtro para un producto (con memoria: se calcula una sola vez) */
  FX.val = (g, def) => { const c = g._fx || (g._fx = {}); if (!(def.k in c)) { let v = null; try { v = def.get(g); } catch (e) { v = null; } c[def.k] = v == null || v === "" ? null : String(v); } return c[def.k]; };
  FX.clear = list => list.forEach(g => { delete g._fx; });
  /* orden de las opciones: el definido, o numérico si los valores son números, o por cantidad */
  FX.sortOpts = (def, entries) => {
    if (def.order) return entries.sort((a, b) => { const ia = def.order.indexOf(a[0]), ib = def.order.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || b[1] - a[1]; });
    const lead = s => { const m = String(s).match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) * (/TB/.test(s) ? 1000 : 1) : null; };
    if (def.num || entries.every(([v]) => lead(v) != null || v === FX.NONE)) {
      return entries.sort((a, b) => (a[0] === FX.NONE) - (b[0] === FX.NONE) || (lead(a[0]) ?? 1e9) - (lead(b[0]) ?? 1e9) || /^hasta/i.test(b[0]) - /^hasta/i.test(a[0]));
    }
    return entries.sort((a, b) => (a[0] === FX.NONE) - (b[0] === FX.NONE) || b[1] - a[1]);
  };
  FX.gbLabel = gbLabel;
  if (typeof module !== "undefined" && module.exports) module.exports = FX; else root.FX = FX;
})(typeof self !== "undefined" ? self : this);
