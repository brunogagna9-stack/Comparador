/* ComparáTech · motor de "Comparar hardware": especificaciones por categoría, ventajas y ganador justificado. */
(function (root) {
  "use strict";
  const CT = root.CT || require("./lib.js");
  const { ARS, price } = CT;

  /* Etiquetas de fiabilidad (se usan en las tres secciones) */
  CT.TAGS = {
    ver: ["Verificado", "Dato del fabricante comprobado contra su ficha oficial."],
    bench: ["Benchmark", "Medición independiente (Tom's Hardware, jun 2026). No es un dato oficial."],
    est: ["Estimado", "Calculado por ComparáTech a partir de otros datos; no es una medición."],
    pend: ["Pendiente de verificar", "Tomado del título de la tienda o cargado sin comprobarlo todavía contra la ficha del fabricante."],
    nd: ["Sin datos", "No tenemos este dato: no lo inventamos."],
  };
  const spNote = r => `${r.src}${r.sku ? " · SKU " + r.sku : ""} · ${r.date}` + (r.note ? " · " + r.note : "");
  const ND = { v: null, disp: "Sin datos", tag: "nd" };
  const NA = { v: null, text: "No aplica", disp: "No aplica", tag: null };   // el dato no existe para este tipo de producto (no es un faltante)
  const fmt = (n, d = 0) => n == null ? null : Number(n).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const mk = (v, disp, tag) => v == null ? ND : { v, disp: disp ?? String(v), tag };
  const txt = (v, tag) => v ? { v: null, text: v, disp: v, tag } : ND;
  const onev = (g, f) => (g && g.ver && g.ver.includes(f)) ? "ver" : "pend";

  CT.CATS = {
    "placas-de-video": "Placas de video", procesadores: "Procesadores", motherboards: "Placas madre", "memorias-ram": "Memorias RAM",
    almacenamiento: "SSD y discos", fuentes: "Fuentes", gabinetes: "Gabinetes", refrigeracion: "Refrigeración", monitores: "Monitores",
    notebooks: "Notebooks", "pcs-armadas": "PC armadas", mouses: "Mouse", teclados: "Teclados", auriculares: "Auriculares",
  };

  CT.makeCompare = function (C) {
    const HW = C.HW;
    /* un "ítem" = producto del catálogo + su oferta más barata + datos leídos/ligados */
    C.item = g => {
      const o = C.bestOffer(g) || g.offers.slice().sort((a, b) => price(a) - price(b))[0];
      const it = { g, o, p: o ? price(o) : null, inStock: !!C.bestOffer(g), name: g.name, cat: g.category, sp: CT.parse(g.name, g.category) };
      if (["memorias-ram", "almacenamiento", "monitores", "fuentes"].includes(g.category)) {   // ficha del fabricante (Icecat): manda sobre el título
        const sp = C.spec(g); if (sp && sp.s === "Icecat") { it.sp = Object.assign({}, it.sp); for (const k of ["gb", "mhz", "cl", "w", "inch", "hz", "ms", "rpm", "mbs", "mods"]) if (sp.f[k] && typeof sp.f[k].v === "number") it.sp[k] = sp.f[k].v;
          if (it.sp.mhz && it.sp.cl) it.sp.lat = Math.round(it.sp.cl * 2000 / it.sp.mhz * 10) / 10; }
      }
      if (g.category === "placas-de-video") it.hwg = C.hwGpu(g.name) || C.hwGpuX(g.name);
      if (g.category === "procesadores") it.hwc = C.hwCpu(g.name);
      if (g.category === "pcs-armadas") { it.hwg = C.hwGpu(g.name, it.sp.vram ?? null); it.hwc = C.hwCpu(g.name); }
      return it;
    };

    const perPrice = (v, p, k) => v != null && p ? v / p * k : null;
    const priceRow = {
      id: "price", label: "Precio (efectivo/transferencia)", help: "Precio más bajo con stock entre las tiendas del comparador, en pesos argentinos. Se actualiza cada ~6 horas.", dir: "min", chart: "$",
      get: it => it.p ? mk(it.p, ARS(it.p), "ver") : ND
    };
    const storeRow = {
      id: "store", label: "Tienda", help: "Tienda de la oferta más barata.", get: it => it.o ? { v: null, text: it.o.store, disp: it.o.store, tag: "ver", url: it.o.url } : ND
    };
    const stockRow = {
      id: "stock", label: "Disponibilidad", help: "Según lo que informa la tienda en el momento de la última actualización.",
      get: it => !it.o ? ND : it.inStock ? { v: null, text: it.o.stock ? "Con stock" : "Stock sin confirmar", disp: it.o.stock ? "Con stock" : "Stock sin confirmar", tag: it.o.stock ? "ver" : "pend" } : { v: null, text: "Sin stock", disp: "Sin stock", tag: "ver" }
    };
    const tail = [priceRow, storeRow, stockRow];

    /* ---- filas por categoría ---- */
    const ROWS = {
      "placas-de-video": res => [
        { id: "fps", label: `Rendimiento en juegos a ${CT.RES[res]}`, help: "FPS promedio de 11 juegos exigentes (Ultra, sin DLSS/FSR). Medición independiente, no oficial.", dir: "max", chart: " FPS", get: it => it.hwg && it.hwg.p ? mk(it.hwg.p[res], "~" + fmt(it.hwg.p[res]) + " FPS", "bench") : ND },
        { id: "rt", label: "Con ray tracing (1080p)", help: "FPS promedio con ray tracing en 1080p. Solo existe para algunas placas.", dir: "max", chart: " FPS", get: it => it.hwg && it.hwg.rt ? mk(it.hwg.rt[0], "~" + fmt(it.hwg.rt[0]) + " FPS", "bench") : ND },
        { id: "arq", label: "Arquitectura", help: "Generación de diseño del chip. Generaciones más nuevas suelen sumar tecnologías (DLSS 4, FSR 4, etc.).", get: it => it.hwg ? txt(it.hwg.spec.arq, onev(it.hwg, "arq")) : ND },
        { id: "sp", label: "Procesadores de sombreado", help: "CUDA cores (NVIDIA) o stream processors (AMD/Intel). Solo se pueden comparar con números dentro de una misma arquitectura: no son una medida directa de rendimiento.", dir: "max", chart: "", get: it => it.hwg ? mk(it.hwg.spec.sp, fmt(it.hwg.spec.sp), onev(it.hwg, "sp")) : ND },
        { id: "vram", label: "Memoria de video (VRAM)", help: "Memoria dedicada. Importa para texturas en 1440p/4K y para edición 3D.", dir: "max", chart: " GB", get: it => it.hwg ? mk(it.hwg.vram, it.hwg.vram + " GB", onev(it.hwg, "vram")) : it.sp.vram ? mk(it.sp.vram, it.sp.vram + " GB", "pend") : ND },
        { id: "mt", label: "Tipo de memoria", help: "GDDR7 > GDDR6X > GDDR6 en velocidad por pin.", get: it => it.hwg ? txt(it.hwg.spec.mt, onev(it.hwg, "mt")) : ND },
        { id: "bus", label: "Bus de memoria", help: "Ancho del bus en bits. Junto con la velocidad define el ancho de banda.", dir: "max", chart: " bits", get: it => it.hwg ? mk(it.hwg.spec.bus, it.hwg.spec.bus + " bits", onev(it.hwg, "bus")) : ND },
        { id: "bw", label: "Ancho de banda de memoria", help: "Bus ÷ 8 × velocidad por pin. Es un máximo teórico, no FPS.", dir: "max", chart: " GB/s", get: it => it.hwg ? mk(it.hwg.spec.bw, fmt(it.hwg.spec.bw) + " GB/s", onev(it.hwg, "bus") === "ver" && onev(it.hwg, "gbps") === "ver" ? "ver" : "pend") : ND },
        { id: "tgp", label: "Consumo de la placa (TGP)", help: "Potencia que declara el fabricante para la placa sola. No es el consumo medido en uso.", dir: "min", chart: " W", get: it => it.hwg ? mk(it.hwg.tgp, it.hwg.tgp + " W", onev(it.hwg, "tgp")) : ND },
        { id: "psu", label: "Fuente mínima que pide el fabricante", help: "Potencia de fuente recomendada por el fabricante para todo el equipo.", dir: "min", chart: " W", get: it => it.hwg && it.hwg.psu ? mk(it.hwg.psu, it.hwg.psu + " W", onev(it.hwg, "psu")) : ND },
        { id: "official", label: "Ficha oficial del fabricante", help: "Página del fabricante contra la que se comprobaron los datos marcados como verificados, con la fecha de la comprobación.", get: it => it.hwg && it.hwg.vurl ? { v: null, text: "Ver ficha", disp: "Ver ficha (comprobada el " + it.hwg.vdate + ")", tag: "ver", url: it.hwg.vurl } : it.hwg ? { v: null, text: "Sin verificar", disp: "Sin verificar contra la ficha oficial", tag: "pend" } : ND },
        { id: "fpsw", label: "Eficiencia: FPS por vatio", help: "FPS promedio ÷ TGP. Orientativo: mezcla un benchmark con un consumo declarado.", dir: "max", derived: true, chart: "", get: it => it.hwg && it.hwg.p ? mk(Math.round(it.hwg.p[res] / it.hwg.tgp * 100) / 100, fmt(it.hwg.p[res] / it.hwg.tgp, 2) + " FPS/W", "est") : ND },
        { id: "fpspp", label: "Valor: FPS por cada $100.000", help: "FPS promedio ÷ precio × 100.000. Depende del precio del día.", dir: "max", derived: true, chart: "", get: it => it.hwg && it.hwg.p && it.p ? mk(Math.round(perPrice(it.hwg.p[res], it.p, 1e5) * 10) / 10, fmt(perPrice(it.hwg.p[res], it.p, 1e5), 1), "est") : ND },
      ],
      procesadores: () => [
        { id: "score", label: "Rendimiento en juegos (puntaje 0–100)", help: "Puntaje relativo al Ryzen 7 9850X3D (=100) en 17 juegos a 1080p con una RTX 5090. Medición independiente.", dir: "max", chart: " /100", get: it => it.hwc && it.hwc.s ? mk(it.hwc.s, fmt(it.hwc.s, 1), "bench") : ND },
        { id: "socket", label: "Socket", help: "Debe coincidir con el de la placa madre.", get: it => it.hwc ? txt(it.hwc.socket, onev(it.hwc, "socket")) : ND },
        { id: "mem", label: "Memoria compatible", help: "AM5 y LGA1851 solo usan DDR5; AM4 solo DDR4; LGA1700 depende de la placa.", get: it => it.hwc ? txt(it.hwc.mem, onev(it.hwc, "mem")) : ND },
        { id: "cores", label: "Núcleos", help: "En Intel híbridos incluye núcleos de rendimiento y eficiencia.", dir: "max", chart: "", get: it => it.hwc ? mk(it.hwc.spec.cores, String(it.hwc.spec.cores), onev(it.hwc, "cores")) : ND },
        { id: "threads", label: "Hilos", help: "Tareas simultáneas que puede atender. Ayuda en edición, render y multitarea.", dir: "max", chart: "", get: it => it.hwc ? mk(it.hwc.spec.threads, String(it.hwc.spec.threads), onev(it.hwc, "threads")) : ND },
        { id: "boost", label: "Frecuencia máxima (boost)", help: "No sirve para comparar entre marcas: la arquitectura pesa más que los GHz.", dir: "max", chart: " GHz", get: it => it.hwc ? mk(it.hwc.spec.boost, fmt(it.hwc.spec.boost, 1) + " GHz", onev(it.hwc, "boost")) : ND },
        { id: "l3", label: "Caché L3", help: "Memoria rápida dentro del procesador. La 3D V-Cache de AMD ayuda mucho en juegos.", dir: "max", chart: " MB", get: it => it.hwc ? mk(it.hwc.spec.l3, it.hwc.spec.l3 + " MB", onev(it.hwc, "l3")) : ND },
        { id: "igpu", label: "Gráficos integrados", help: "Permite usar la PC sin placa de video. Los modelos con F (Intel) no los traen.", get: it => { const v = CT.hasIgpu(it.name); return v == null ? ND : { v: null, text: v ? "Sí" : "No", disp: v ? "Sí" : "No", tag: it.hwc && onev(it.hwc, "igpu") === "ver" && v === it.hwc.spec.igpu ? "ver" : "pend" }; } },
        { id: "tdp", label: "Potencia base (TDP)", help: "Dato del fabricante.", dir: "min", chart: " W", get: it => it.hwc ? mk(it.hwc.tdp, it.hwc.tdp + " W", onev(it.hwc, "tdp")) : ND },
        { id: "maxp", label: "Potencia máxima", help: "Intel: 'Maximum Turbo Power' oficial. AMD: TDP × 1,35 (estimado).", dir: "min", chart: " W", get: it => it.hwc && it.hwc.maxp ? mk(it.hwc.maxp, it.hwc.maxp + " W", it.hwc.vendor === "AMD" ? "est" : onev(it.hwc, "maxp")) : ND },
        { id: "official", label: "Ficha oficial del fabricante", help: "Página del fabricante contra la que se comprobaron los datos marcados como verificados, con la fecha de la comprobación.", get: it => it.hwc && it.hwc.vurl ? { v: null, text: "Ver ficha", disp: "Ver ficha (comprobada el " + it.hwc.vdate + ")", tag: "ver", url: it.hwc.vurl } : it.hwc ? { v: null, text: "Sin verificar", disp: "Sin verificar contra la ficha oficial", tag: "pend" } : ND },
        { id: "spp", label: "Valor: puntaje por cada $100.000", help: "Puntaje de juegos ÷ precio × 100.000.", dir: "max", derived: true, chart: "", get: it => it.hwc && it.hwc.s && it.p ? mk(Math.round(perPrice(it.hwc.s, it.p, 1e5) * 100) / 100, fmt(perPrice(it.hwc.s, it.p, 1e5), 2), "est") : ND },
      ],
      "memorias-ram": () => [
        OFF({ id: "gb", label: "Capacidad total", help: "Suma de todos los módulos del kit.", dir: "max", chart: " GB", get: it => it.sp.gb ? mk(it.sp.gb, it.sp.gb + " GB", "pend") : ND }, "gb", v => v + " GB"),
        OFF({ id: "ddr", label: "Generación", help: "DDR4 y DDR5 no son intercambiables: la placa madre define cuál usar.", get: it => txt(it.sp.ddr, "pend") }, "ddr"),
        OFF({ id: "mods", label: "Módulos", help: "Dos módulos funcionan en dual channel (mejor rendimiento).", get: it => it.sp.mods ? { v: it.sp.mods, text: it.sp.mods + (it.sp.mods > 1 ? " módulos" : " módulo"), disp: it.sp.mods + (it.sp.mods > 1 ? " módulos" : " módulo"), tag: "pend" } : ND }, "mods", v => v + (v > 1 ? " módulos" : " módulo")),
        OFF({ id: "mhz", label: "Velocidad", help: "Frecuencia anunciada (MHz o MT/s, es lo mismo en la práctica).", dir: "max", chart: " MHz", get: it => it.sp.mhz ? mk(it.sp.mhz, it.sp.mhz + " MHz", "pend") : ND }, "mhz", v => fmt(v) + " MHz"),
        OFF({ id: "cl", label: "Latencia CAS (CL)", help: "Ciclos de espera. Menor es mejor a igual velocidad.", dir: "min", chart: "", get: it => it.sp.cl ? mk(it.sp.cl, "CL" + it.sp.cl, "pend") : ND }, "cl", v => "CL" + v),
        OFF({ id: "volt", label: "Voltaje", help: "Tensión de trabajo del módulo. 1,35 V en DDR4 o 1,25-1,4 V en DDR5 suelen indicar perfiles de velocidad (XMP/EXPO).", get: () => ND }, "volt", v => String(v).replace(".", ",") + " V"),
        OFF({ id: "xmp", label: "Perfil XMP", help: "Perfil de fábrica para activar la velocidad anunciada desde el BIOS.", get: () => ND }, "xmp", SI),
        { id: "lat", label: "Latencia real", help: "CL × 2000 ÷ MHz, en nanosegundos. Permite comparar memorias de distinta velocidad.", dir: "min", derived: true, chart: " ns", get: it => it.sp.lat ? mk(it.sp.lat, fmt(it.sp.lat, 1) + " ns", "est") : ND },
        { id: "ppg", label: "Precio por GB", help: "Precio ÷ capacidad.", dir: "min", derived: true, chart: "$", get: it => it.sp.gb && it.p ? mk(Math.round(it.p / it.sp.gb), ARS(it.p / it.sp.gb), "est") : ND },
      ],
      almacenamiento: () => [
        OFF({ id: "gb", label: "Capacidad", help: "Espacio total.", dir: "max", chart: " GB", get: it => it.sp.gb ? mk(it.sp.gb, it.sp.gb >= 1000 ? fmt(it.sp.gb / 1000, 2) + " TB" : it.sp.gb + " GB", "pend") : ND }, "gb", v => v >= 1000 ? fmt(v / 1000, 2) + " TB" : v + " GB"),
        { id: "kind", label: "Tipo", help: "SSD (rápido, sin partes móviles), HDD (barato por GB, lento).", get: it => txt(it.sp.kind, "pend") },
        OFF({ id: "iface", label: "Interfaz", help: "NVMe (M.2) es mucho más rápido que SATA; verificá que tu placa tenga ranura M.2.", get: it => txt(it.sp.iface, "pend") }, "iface"),
        { id: "gen", label: "Generación PCIe", help: "Gen4 duplica el máximo teórico de Gen3. Tu placa madre limita la velocidad.", get: it => it.sp.genNA ? NA : txt(it.sp.gen, "pend") },
        OFF({ id: "rpm", label: "Velocidad de giro", help: "Solo en discos rígidos (HDD): 7200 RPM es más rápido que 5400.", dir: "max", chart: " RPM", get: it => it.sp.kind === "HDD" ? (it.sp.rpm ? mk(it.sp.rpm, it.sp.rpm + " RPM", "pend") : ND) : it.sp.kind ? NA : ND }, "rpm", v => v + " RPM"),
        OFF({ id: "mbs", label: "Velocidad anunciada", help: "Velocidad máxima de lectura que publica la tienda/fabricante. Es un pico, no el uso real.", dir: "max", chart: " MB/s", get: it => it.sp.mbs ? mk(it.sp.mbs, fmt(it.sp.mbs) + " MB/s", "pend") : ND }, "mbs", v => fmt(v) + " MB/s"),
        OFF({ id: "mbsw", label: "Velocidad de escritura", help: "Pico de escritura según el fabricante.", dir: "max", chart: " MB/s", get: () => ND }, "mbs_w", v => fmt(v) + " MB/s"),
        OFF({ id: "tbw", label: "Durabilidad (TBW)", help: "Terabytes que se pueden escribir según la garantía del fabricante. Más es mejor.", dir: "max", chart: " TB", get: () => ND }, "tbw", v => fmt(v) + " TB"),
        { id: "ppg", label: "Precio por GB", help: "Precio ÷ capacidad.", dir: "min", derived: true, chart: "$", get: it => it.sp.gb && it.p ? mk(Math.round(it.p / it.sp.gb * 10) / 10, ARS(it.p / it.sp.gb), "est") : ND },
      ],
      fuentes: () => [
        OFF({ id: "w", label: "Potencia", help: "Potencia total que entrega. Elegí según el consumo de tu placa de video y procesador.", dir: "max", chart: " W", get: it => it.sp.w ? mk(it.sp.w, it.sp.w + " W", "pend") : ND }, "w", v => v + " W"),
        OFF({ id: "cert", label: "Certificación de eficiencia", help: "80 Plus: Bronze < Silver < Gold < Platinum < Titanium. Cybenetics es otra certificación, con otra escala: no se compara con 80 Plus. Ninguna mide la calidad de los componentes internos.", dir: "max", chart: "", get: it => it.sp.cyb ? txt(it.sp.cyb, "pend") : it.sp.cert ? { v: it.sp.certRank, text: it.sp.cert[0].toUpperCase() + it.sp.cert.slice(1), disp: it.sp.cert[0].toUpperCase() + it.sp.cert.slice(1), tag: "pend" } : ND }, "cert", null,
          v => ({ white: 1, bronze: 2, silver: 3, gold: 4, platinum: 5, titanium: 6 })[(String(v).match(/white|bronze|silver|gold|platinum|titanium/i) || ["white"])[0].toLowerCase()] || null),
        OFF({ id: "mod", label: "Cables modulares", help: "Los modulares ordenan mejor el gabinete.", get: it => { const t = it.sp.modular ? "Sí" : it.sp.semi ? "Semi-modular" : "No indicado"; return { v: null, text: t, disp: t, tag: it.sp.modular || it.sp.semi ? "pend" : "nd" }; } }, "modular"),
        OFF({ id: "atx", label: "Estándar ATX", help: "ATX 3.x trae el conector 12V-2x6 de las placas de gama alta modernas.", get: it => txt(it.sp.atx3, "pend") }, "atx"),
        OFF({ id: "pcie16", label: "Conector 16 pines (12V-2x6)", help: "Cantidad de conectores de 16 pines para placas de video modernas de gama alta (RTX 4070 Ti en adelante, por ejemplo).", get: () => ND }, "pcie16", v => String(v)),
        { id: "ppw", label: "Precio por vatio", help: "Precio ÷ potencia.", dir: "min", derived: true, chart: "$", get: it => it.sp.w && it.p ? mk(Math.round(it.p / it.sp.w * 10) / 10, ARS(it.p / it.sp.w), "est") : ND },
      ],
      motherboards: () => [
        { id: "socket", label: "Socket", help: "Debe coincidir con el del procesador.", get: it => { const r = C.sf(it.g, "socket"); return r ? Object.assign(txt(r.v, r.tag), { note: spNote(r) }) : txt(it.sp.socket, "pend"); } },
        { id: "chipset", label: "Chipset", help: "Define funciones: overclock, cantidad de PCIe y USB.", get: it => { const r = C.sf(it.g, "chipset"); return r ? Object.assign(txt(r.v, r.tag), { note: spNote(r) }) : txt(it.sp.chipset, "pend"); } },
        { id: "ddr", label: "Memoria", help: "DDR4 o DDR5, según la placa. En AM4 y LGA1200 solo existe DDR4; en AM5 y LGA1851 solo DDR5.", get: it => { const r = C.sf(it.g, "ddr"); if (r) return Object.assign(txt(r.v, r.tag), { note: spNote(r) }); return it.sp.ddr ? Object.assign(txt(it.sp.ddr + (it.sp.ddrBySocket ? " (por el socket)" : ""), "pend"), it.sp.ddrBySocket ? { note: "Deducido del socket: ese socket solo admite " + it.sp.ddr } : {}) : ND; } },
        { id: "form", label: "Formato", help: "Debe entrar en tu gabinete: Mini-ITX < Micro-ATX < ATX < E-ATX.", get: it => { const r = C.sf(it.g, "form"); return r ? Object.assign(txt(r.v, r.tag), { note: spNote(r) }) : txt(it.sp.form, "pend"); } },
        { id: "wifi", label: "Wi-Fi integrado", help: "Si no lo trae necesitás una placa de red aparte.", get: it => { const r = C.sf(it.g, "wifi"); if (r) { const t = r.v ? "Sí" : "No"; return { v: null, text: t, disp: t, tag: r.tag, note: spNote(r) }; }
          return { v: null, text: it.sp.wifi ? "Sí" : "No indicado", disp: it.sp.wifi ? "Sí" : "No indicado", tag: it.sp.wifi ? "pend" : "nd" }; } },
      ],
      monitores: () => [
        OFF({ id: "inch", label: "Tamaño", help: "Diagonal en pulgadas.", dir: "max", chart: '"', get: it => it.sp.inch ? mk(it.sp.inch, fmt(it.sp.inch, 1) + '"', "pend") : ND }, "inch", v => fmt(v, 1) + '"'),
        OFF({ id: "res", label: "Resolución", help: "Más píxeles = más nitidez, pero exige más a la placa de video.", dir: "max", chart: "", get: it => it.sp.px ? { v: it.sp.px, text: it.sp.res, disp: it.sp.res, tag: "pend" } : ND }, "res",
          v => String(v).replace(/\s*x\s*/i, " × "), v => { const m = String(v).match(/(\d+)\s*x\s*(\d+)/i); return m ? +m[1] * +m[2] : null; }),
        OFF({ id: "hz", label: "Tasa de refresco", help: "Imágenes por segundo que puede mostrar. 144 Hz o más se nota en juegos competitivos.", dir: "max", chart: " Hz", get: it => it.sp.hz ? mk(it.sp.hz, it.sp.hz + " Hz", "pend") : ND }, "hz", v => v + " Hz"),
        OFF({ id: "panel", label: "Panel", help: "IPS: mejores colores. VA: mejor contraste. TN: rápido pero con peor imagen. OLED: máximo contraste.", get: it => txt(it.sp.panel, "pend") }, "panel"),
        OFF({ id: "ms", label: "Tiempo de respuesta", help: "Menor es mejor. El valor de la tienda suele ser el más optimista (GtG).", dir: "min", chart: " ms", get: it => it.sp.ms ? mk(it.sp.ms, fmt(it.sp.ms, 1) + " ms", "pend") : ND }, "ms", v => fmt(v, 1) + " ms"),
        OFF({ id: "brillo", label: "Brillo", help: "En nits (cd/m²). 250-300 alcanza en interiores; para HDR real hacen falta 600 o más.", dir: "max", chart: " nits", get: () => ND }, "brillo", v => fmt(v) + " nits"),
        OFF({ id: "hdr", label: "HDR", help: "Alto rango dinámico. Con menos de 400 nits el efecto es limitado.", get: () => ND }, "hdr", SI),
        OFF({ id: "fs", label: "FreeSync (AMD)", help: "Sincroniza la imagen con la placa de video AMD para evitar cortes. Premium y Premium Pro son niveles más exigentes.", get: () => ND }, "freesync"),
        OFF({ id: "gs", label: "G-SYNC (NVIDIA)", help: "Lo mismo para placas NVIDIA. «Compatible» quiere decir que NVIDIA lo validó sin un módulo propio.", get: () => ND }, "gsync"),
        { id: "puertos", label: "Entradas de video", help: "Cantidad de HDMI y DisplayPort según el fabricante.", get: it => { const h = C.sf(it.g, "hdmi"), d = C.sf(it.g, "dp"); if (!h && !d) return ND;
          const t = [h ? h.v + " HDMI" : null, d ? d.v + " DisplayPort" : null].filter(Boolean).join(" · "); return { v: null, text: t, disp: t, tag: (h || d).tag, note: spNote(h || d) }; } },
        OFF({ id: "altura", label: "Altura regulable", help: "Permite subir o bajar la pantalla sin un soporte aparte.", get: () => ND }, "altura", SI),
        OFF({ id: "vesa", label: "Montaje VESA", help: "Agujeros estándar para colgarlo de un brazo o la pared.", get: () => ND }, "vesa", SI),
      ],
      notebooks: () => [
        { id: "cpu", label: "Procesador", help: "Los procesadores de notebook no equivalen a los de escritorio con nombre parecido.", get: it => txt(it.sp.cpu, "pend") },
        { id: "gpu", label: "Placa de video", help: "Si no figura, la notebook usa gráficos integrados. La versión de notebook rinde menos que la de escritorio.", get: it => it.sp.gpu ? txt(it.sp.gpu + (it.sp.vram ? " " + it.sp.vram + " GB" : ""), "pend") : { v: null, text: "No indicada (gráficos integrados)", disp: "No indicada (gráficos integrados)", tag: "nd" } },
        { id: "ram", label: "Memoria RAM", help: "8 GB es lo mínimo hoy; 16 GB es lo cómodo.", dir: "max", chart: " GB", get: it => it.sp.ram ? mk(it.sp.ram, it.sp.ram + " GB", "pend") : ND },
        { id: "ssd", label: "Almacenamiento", help: "Capacidad del SSD.", dir: "max", chart: " GB", get: it => it.sp.ssd ? mk(it.sp.ssd, it.sp.ssd >= 1000 ? fmt(it.sp.ssd / 1000, 2) + " TB" : it.sp.ssd + " GB", "pend") : ND },
        { id: "inch", label: "Pantalla", help: "Diagonal.", get: it => it.sp.inch ? mk(it.sp.inch, fmt(it.sp.inch, 1) + '"', "pend") : ND },
        { id: "hz", label: "Tasa de refresco", help: "Hz de la pantalla.", dir: "max", chart: " Hz", get: it => it.sp.hz ? mk(it.sp.hz, it.sp.hz + " Hz", "pend") : ND },
        { id: "os", label: "Sistema operativo", help: "Sin sistema operativo hay que comprar Windows aparte.", get: it => txt(it.sp.os, "pend") },
        { id: "peso", label: "Peso", help: "Dato de la ficha de la tienda para este modelo exacto (SKU). Menos peso = más cómoda para llevar.", dir: "min", chart: " kg",
          get: it => { const r = C.sf(it.g, "peso"); return r ? Object.assign(mk(r.v, fmt(r.v, 2) + " kg", r.tag), { note: spNote(r) }) : ND; } },
        { id: "dim", label: "Medidas", help: "Ancho × profundidad × alto, en milímetros (ficha de la tienda).",
          get: it => { const a = C.sf(it.g, "ancho"), b = C.sf(it.g, "prof"), c = C.sf(it.g, "alto"); return a && b ? { v: null, text: `${a.v} × ${b.v}` + (c ? ` × ${c.v}` : "") + " mm", disp: `${a.v} × ${b.v}` + (c ? ` × ${c.v}` : "") + " mm", tag: a.tag, note: spNote(a) } : ND; } },
        { id: "ramamp", label: "RAM ampliable", help: "Indica si tiene un slot libre para sumar memoria. Si la RAM está soldada, no se puede ampliar.",
          get: it => { const r = C.sf(it.g, "ram_ampliable"); return r ? { v: null, text: r.v ? "Sí (" + r.note + ")" : "No (" + r.note + ")", disp: r.v ? "Sí (" + r.note + ")" : "No (" + r.note + ")", tag: r.tag, note: spNote(r) } : ND; } },
        { id: "panel", label: "Panel de pantalla", help: "IPS: buenos colores y ángulos. TN/VA: más básicos. OLED: máximo contraste.", get: it => { const r = C.sf(it.g, "panel"); return r ? Object.assign(txt(r.v, r.tag), { note: spNote(r) }) : ND; } },
        { id: "gar", label: "Garantía de la tienda", help: "Meses informados por la tienda. Confirmá si es garantía oficial del fabricante.", dir: "max", chart: " meses", get: it => { const r = C.sf(it.g, "garantia"); return r ? Object.assign(mk(r.v, r.v + " meses", r.tag), { note: spNote(r) }) : ND; } },
        { id: "bat", label: "Batería y autonomía", help: "Ni Compragamer ni las otras tiendas conectadas publican la capacidad (Wh) en su ficha. No usamos la autonomía de marketing como si fuera real: confirmala en la hoja técnica del fabricante.", get: () => ND },
      ],
      mouses: () => [
        P("dpi", "Sensibilidad máxima (DPI)", "Puntos por pulgada. Más DPI no es mejor por sí solo: la mayoría juega entre 400 y 3200. Sirve en monitores grandes o 4K.", "dpi_max", it => it.sp.dpi, v => fmt(v) + " DPI", "max"),
        P("sensor", "Sensor", "Óptico: el estándar actual, preciso en casi cualquier superficie. Láser: funciona sobre vidrio pero suele ser menos preciso para jugar. Los sensores con nombre (HERO, Focus Pro, PAW3395…) son de gama alta.", ["sensor_modelo", "sensor"], it => it.sp.sensor),
        P("polling", "Frecuencia de respuesta (polling)", "Veces por segundo que el mouse informa su posición. 1000 Hz es lo normal en gaming; 4000-8000 Hz solo se nota con monitores muy rápidos.", "polling", it => it.sp.polling, v => fmt(v) + " Hz", "max"),
        P("botones", "Cantidad de botones", "Botones programables extra: útiles en MMO, MOBA o para atajos de trabajo.", "botones", it => it.sp.botones, v => v + " botones", "max"),
        P("peso", "Peso", "Más liviano = más fácil de mover rápido (juegos competitivos). Más pesado = más estable para algunos usuarios.", "peso_g", it => it.sp.peso, v => fmt(v) + " g", "min"),
        P("ips", "Velocidad máxima de seguimiento", "IPS: pulgadas por segundo que el sensor sigue sin perder precisión. Más de 300 IPS sobra para cualquier uso.", "ips", () => null, v => fmt(v) + " IPS", "max"),
        P("accel", "Aceleración máxima", "En G: cuánto movimiento brusco tolera el sensor sin errores.", "accel", () => null, v => fmt(v) + " G", "max"),
        P("switch", "Switches de los clics", "Tipo de interruptor de los botones (mecánico u óptico). Los ópticos no sufren el «doble clic» por desgaste.", "switch", () => null),
        P("clicks", "Vida útil de los clics", "Millones de clics que garantiza el fabricante. La tienda casi nunca lo publica: si figura es porque está en el título.", "vida_util_clicks", it => it.sp.clicks, v => v + " millones", "max"),
        P("wl", "Conexión", "Inalámbrico 2,4 GHz (con receptor) tiene latencia de juego; Bluetooth es para oficina.", "inalambrico", it => it.sp.wireless == null ? null : it.sp.wireless ? "Inalámbrico" : "Con cable", null, null, wlText),
        P("rgb", "Iluminación", "Estética: no cambia el rendimiento.", "rgb", it => it.sp.rgb === true ? "RGB" : it.sp.rgb || null, null, null, boolText),
        { id: "agarre", label: "Agarre recomendado", help: "Palm: toda la mano apoyada. Claw: la palma apoyada y los dedos en garra. Finger: solo las puntas de los dedos.", get: it => { const g = ["palm", "claw", "finger"].filter(k => { const r = C.sf(it.g, k); return r && r.v; }); return g.length ? Object.assign(txt(g.map(x => x[0].toUpperCase() + x.slice(1)).join(", "), "pend"), { note: spNote(C.sf(it.g, g[0])) }) : ND; } },
      ],
      teclados: () => [
        P("mec", "Tipo de teclado", "Mecánico: cada tecla tiene un switch propio, dura más y se siente más preciso. Membrana: más silencioso y barato.", "mecanismo", it => it.sp.mec),
        P("switch", "Switches", "Red: lineal y suave (juegos). Brown: táctil, con un «bump» (escritura y juegos). Blue: táctil y ruidoso (escritura). La marca (Outemu, Gateron, Kailh, Cherry…) cambia la calidad.", ["switch_modelo", "switch"], it => it.sp.switch),
        P("formato", "Formato", "Completo (con pad numérico), TKL (sin pad numérico), 75 %, 65 % o 60 %: cuanto más chico, más espacio libre para el mouse.", "formato", it => it.sp.formato),
        P("rgb", "Iluminación", "RGB permite elegir colores; «Rainbow» suele ser un patrón fijo.", "rgb", it => it.sp.rgb === true ? "RGB" : it.sp.rgb || null, null, null, boolText),
        P("idioma", "Idioma / distribución", "Español trae la Ñ en su lugar. En inglés (US) la Ñ se escribe con combinación de teclas.", ["distribucion", "idioma"], it => it.sp.idioma),
        P("material", "Material", "Una placa de aluminio suele ser más rígida y durable que una de plástico.", "material", () => null),
        P("nkro", "Anti-ghosting / N-key rollover", "Registra varias teclas a la vez sin perder pulsaciones (importante en juegos).", ["nkro", "antighost"], () => null, null, null, null, boolText),
        P("antisalp", "Resistente a salpicaduras", "Protección ante derrames leves. No es sumergible.", "antisalp", () => null, null, null, null, boolText),
        P("wl", "Conexión", "Con cable, inalámbrico 2,4 GHz o Bluetooth.", ["inalambrico", "bluetooth"], it => it.sp.wireless ? "Inalámbrico" : null, null, null, null, wlText),
        P("vida", "Vida útil de las teclas", "Millones de pulsaciones por tecla que garantiza el fabricante del switch. La tienda no lo publica: si figura es porque está en el título.", "vida_util_pulsaciones", it => it.sp.vida, v => v + " millones", "max"),
        P("peso", "Peso", "Un teclado pesado se mueve menos sobre el escritorio.", "peso_g", () => null, v => fmt(v) + " g"),
      ],
      auriculares: () => [
        P("tipo", "Tipo", "Vincha (over-ear): más cómodos para horas y mejor aislamiento. In-ear: livianos y portátiles.", "tipo", it => it.sp.tipo),
        P("driver", "Tamaño de los parlantes (drivers)", "En milímetros. Más grande suele dar graves más llenos, pero la calidad depende del diseño.", "driver_mm", it => it.sp.driver, v => v + " mm", "max"),
        P("imp", "Impedancia", "En ohmios (Ω). Hasta ~64 Ω suenan bien en cualquier PC o celular; más de 150 Ω suelen necesitar un amplificador.", "impedancia", () => null, v => fmt(v) + " Ω"),
        { id: "freq", label: "Respuesta en frecuencia", help: "Rango de sonidos que reproduce, en Hz. 20 Hz – 20.000 Hz cubre todo el oído humano; valores mayores son marketing.", get: it => { const a = C.sf(it.g, "f_min"), b = C.sf(it.g, "f_max"); return a && b ? Object.assign(txt(`${fmt(a.v)} Hz – ${fmt(b.v)} Hz`, "pend"), { note: spNote(a) }) : ND; } },
        P("sens", "Sensibilidad", "Volumen que alcanza con la misma potencia (en dB). Más alto = suena más fuerte con poca potencia.", "sens", () => null, v => fmt(v) + " dB", "max"),
        P("anc", "Cancelación de ruido", "Activa (ANC): un circuito anula el ruido exterior. Pasiva: solo aísla por las almohadillas.", "anc", it => it.sp.anc ? "Sí (según el título)" : null, null, null, boolText),
        P("mic", "Micrófono", "Necesario para hablar en juegos o reuniones.", "mic", it => it.sp.mic ? "Sí" : null, null, null, boolText),
        P("surround", "Sonido envolvente", "7.1 suele ser virtual (por software). Ayuda a ubicar sonidos en juegos.", "surround", it => it.sp.surround),
        P("con", "Conexión", "USB, jack 3,5 mm, Bluetooth o inalámbrico 2,4 GHz. Bluetooth tiene más demora para jugar.", "conexion", it => it.sp.conexion),
        P("rgb", "Iluminación", "Estética: no cambia el sonido.", "rgb", it => it.sp.rgb === true ? "RGB" : it.sp.rgb || null, null, null, boolText),
        P("compat", "Compatible con", "Dispositivos con los que la tienda indica que funcionan.", "compat", () => null),
      ],
      "pcs-armadas": res => [
        { id: "cpu", label: "Procesador", help: "Leído del título de la tienda.", get: it => txt(it.sp.cpu, "pend") },
        { id: "gpu", label: "Placa de video", help: "Leída del título de la tienda.", get: it => txt(it.sp.gpu, "pend") },
        { id: "fps", label: `Rendimiento estimado en juegos a ${CT.RES[res]}`, help: "FPS promedio de la placa (benchmark) limitado por el procesador si tenemos su puntaje. Estimación: la PC puede traer otra versión de la placa.", dir: "max", chart: " FPS", derived: true,
          get: it => { if (!it.hwg) return ND; let v = it.hwg.p[res]; const cf = it.hwc && it.hwc.s ? C.cpuFps(it.hwc) : null; if (cf) v = Math.min(v, cf);
            return mk(Math.round(v), "~" + fmt(v) + " FPS" + (cf ? "" : " (CPU sin puntaje)"), "est"); } },
        { id: "ram", label: "Memoria RAM", help: "Leída del título.", dir: "max", chart: " GB", get: it => it.sp.ram ? mk(it.sp.ram, it.sp.ram + " GB", "pend") : ND },
        { id: "ssd", label: "Almacenamiento", help: "Leído del título.", dir: "max", chart: " GB", get: it => it.sp.ssd ? mk(it.sp.ssd, it.sp.ssd >= 1000 ? fmt(it.sp.ssd / 1000, 2) + " TB" : it.sp.ssd + " GB", "pend") : ND },
      ],
    };
    /* Fila de periférico: primero la FICHA de la tienda (dato publicado para ese SKU), si no, lo que dice el título.
       Las dos quedan "pendiente de verificar" (no es la ficha del fabricante); la nota dice de dónde salió. */
    const boolText = v => v === true ? "Sí" : v === false ? "No" : v;
    /* fila que prefiere el dato de la ficha del fabricante (Icecat, etiqueta «verificado» con fuente) y si no, lo del título */
    const OFF = (row, field, show, num) => Object.assign({}, row, { get: it => { const r = C.sf(it.g, field);
      if (r && r.v != null && r.v !== "") { const d = show ? show(r.v) : String(r.v); return { v: num ? num(r.v) : typeof r.v === "number" && row.dir ? r.v : null, text: d, disp: d, tag: r.tag, note: spNote(r) }; }
      return row.get(it); } });
    const SI = v => v === true ? "Sí" : v === false ? "No" : String(v);
    const wlText = v => v === true ? "Sí" : v === false ? "Con cable" : v;
    function P(id, label, help, fields, fromTitle, fmtv, dir, _x, show) {
      const fs = Array.isArray(fields) ? fields : [fields];
      return { id, label, help, dir: dir || undefined, chart: dir ? "" : undefined, get: it => {
        for (const f of fs) { const r = C.sf(it.g, f); if (r && r.v !== "" && r.v != null) {
          const val = show ? show(r.v) : r.v, isNum = typeof r.v === "number";
          if (r.v === false && !show) continue;
          const d = isNum && fmtv ? fmtv(r.v) : String(val);
          return { v: isNum && dir ? r.v : null, text: d, disp: d, tag: r.tag === "ver" ? "pend" : r.tag, note: "Ficha de la tienda: " + spNote(r) }; } }
        const t = fromTitle(it); if (t == null || t === "") return ND;
        const d = typeof t === "number" && fmtv ? fmtv(t) : String(show ? show(t) : t);
        return { v: typeof t === "number" && dir ? t : null, text: d, disp: d, tag: "pend", note: "Leído del título de la tienda." };
      } };
    }
    const BASIC = [{ id: "name", label: "Producto", help: "Nombre en la tienda.", get: it => ({ v: null, text: it.name, disp: it.name, tag: "ver" }) }];

    /* Criterios de decisión: cada "uso" pondera solo métricas con dato; sin datos suficientes el resultado es inconcluso. */
    const USES = {
      "placas-de-video": [
        { id: "gaming", label: "Jugar (máximo rendimiento)", w: [["fps", .8], ["vram", .2]] },
        { id: "valor", label: "Mejor precio-prestaciones", w: [["fpspp", .8], ["vram", .2]] },
        { id: "consumo", label: "Menor consumo", w: [["fpsw", .7], ["tgp", .3]] },
      ],
      procesadores: [
        { id: "gaming", label: "Jugar", w: [["score", 1]] },
        { id: "multi", label: "Multitarea y trabajo pesado (estimado por núcleos e hilos)", w: [["threads", .5], ["cores", .3], ["l3", .2]] },
        { id: "valor", label: "Mejor precio-prestaciones", w: [["spp", 1]] },
        { id: "consumo", label: "Menor consumo", w: [["maxp", .6], ["tdp", .4]] },
      ],
      "memorias-ram": [
        { id: "cap", label: "Más capacidad", w: [["gb", 1]] },
        { id: "vel", label: "Más velocidad y menor latencia", w: [["mhz", .5], ["lat", .5]] },
        { id: "valor", label: "Menor precio por GB", w: [["ppg", 1]] },
      ],
      almacenamiento: [
        { id: "cap", label: "Más capacidad", w: [["gb", 1]] },
        { id: "vel", label: "Más velocidad", w: [["mbs", 1]] },
        { id: "valor", label: "Menor precio por GB", w: [["ppg", 1]] },
      ],
      fuentes: [
        { id: "pot", label: "Más potencia", w: [["w", 1]] },
        { id: "efi", label: "Mayor eficiencia", w: [["cert", 1]] },
        { id: "valor", label: "Menor precio por vatio", w: [["ppw", 1]] },
      ],
      monitores: [
        { id: "comp", label: "Juego competitivo", w: [["hz", .6], ["ms", .2], ["res", .2]] },
        { id: "img", label: "Imagen y trabajo", w: [["res", .6], ["inch", .4]] },
        { id: "valor", label: "Menor precio", w: [["price", 1]] },
      ],
      notebooks: [
        { id: "multi", label: "Multitarea y almacenamiento", w: [["ram", .5], ["ssd", .5]] },
        { id: "port", label: "Más liviana", w: [["peso", 1]] },
        { id: "valor", label: "Menor precio", w: [["price", 1]] },
      ],
      mouses: [
        { id: "comp", label: "Juego competitivo", w: [["polling", .4], ["peso", .4], ["dpi", .2]] },
        { id: "liviano", label: "Más liviano", w: [["peso", 1]] },
        { id: "botones", label: "Más botones (MMO, trabajo)", w: [["botones", 1]] },
        { id: "valor", label: "Menor precio", w: [["price", 1]] },
      ],
      teclados: [{ id: "valor", label: "Menor precio", w: [["price", 1]] }],
      auriculares: [
        { id: "graves", label: "Parlantes más grandes", w: [["driver", 1]] },
        { id: "valor", label: "Menor precio", w: [["price", 1]] },
      ],
      "pcs-armadas": [
        { id: "gaming", label: "Jugar", w: [["fps", .7], ["ram", .15], ["ssd", .15]] },
        { id: "valor", label: "Menor precio", w: [["price", 1]] },
      ],
      motherboards: [{ id: "valor", label: "Menor precio", w: [["price", 1]] }],
      gabinetes: [{ id: "valor", label: "Menor precio", w: [["price", 1]] }],
      refrigeracion: [{ id: "valor", label: "Menor precio", w: [["price", 1]] }],
    };
    CT.usesFor = cat => USES[cat] || [{ id: "valor", label: "Menor precio", w: [["price", 1]] }];

    /* ---- armado de la tabla ---- */
    C.compare = (items, opts = {}) => {
      const res = opts.res ?? 1, cats = [...new Set(items.map(i => i.cat))], mixed = cats.length > 1, cat = cats[0];
      const defs = mixed ? [...BASIC, ...tail] : [...BASIC, ...(ROWS[cat] ? ROWS[cat](res) : []), ...tail];
      const rows = defs.map(d => {
        const cells = items.map(it => d.get(it));
        const nums = cells.map(c => c.v).filter(v => typeof v === "number");
        const best = d.dir && nums.length >= 2 ? (d.dir === "max" ? Math.max(...nums) : Math.min(...nums)) : null;
        const worst = d.dir && nums.length >= 2 ? (d.dir === "max" ? Math.min(...nums) : Math.max(...nums)) : null;
        const differs = nums.length >= 2 ? (best !== worst) : new Set(cells.map(c => c.disp)).size > 1;
        const real = best != null && worst > 0 && Math.abs(best - worst) / Math.abs(worst) >= .01; // diferencias menores al 1 % se consideran iguales
        cells.forEach(c => { c.win = real && c.v === best; c.lose = real && c.v === worst && items.length === 2; });
        return { id: d.id, label: d.label, help: d.help, dir: d.dir, chart: d.chart, derived: !!d.derived, cells, differs, numeric: nums.length >= 2 };
      });
      const byId = Object.fromEntries(rows.map(r => [r.id, r]));
      const uses = mixed ? [] : CT.usesFor(cat).map(u => C.decide(items, byId, u));
      return { cat, mixed, rows, uses, items };
    };

    /* Decide el mejor para un uso. Solo pondera métricas que TODOS los productos tienen. */
    C.decide = (items, byId, use) => {
      const total = use.w.reduce((a, [, w]) => a + w, 0), used = [], skipped = [];
      use.w.forEach(([id, w]) => {
        const r = byId[id];
        if (!r || !r.dir) return;
        const vals = r.cells.map(c => c.v);
        if (vals.some(v => typeof v !== "number" || !(v > 0))) { skipped.push(r.label); return; }
        used.push({ r, w });
      });
      const usedW = used.reduce((a, u) => a + u.w, 0);
      const out = { use, used: used.map(u => u.r.label), skipped, scores: null, winner: null, runner: null, reason: null, why: [] };
      if (items.length < 2) { out.reason = "se necesitan al menos dos productos"; return out; }
      if (!used.length || usedW < total * .6) {
        out.reason = used.length ? "faltan datos de varias métricas importantes para este criterio" : "no hay datos numéricos comparables para este criterio";
        return out;
      }
      out.scores = items.map((_, i) => used.reduce((a, { r, w }) => {
        const vals = r.cells.map(c => c.v), best = r.dir === "max" ? Math.max(...vals) : Math.min(...vals), v = vals[i];
        return a + w * (r.dir === "max" ? v / best : best / v);
      }, 0) / usedW);
      const order = out.scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
      if (order[0][0] - order[1][0] < .03) { out.reason = "empate técnico: la diferencia es menor al 3 %"; out.tie = [order[0][1], order[1][1]]; return out; }
      out.winner = order[0][1]; out.runner = order[1][1];
      used.slice().sort((a, b) => b.w - a.w).forEach(({ r }) => {
        const a = r.cells[out.winner], b = r.cells[out.runner];
        if (Math.abs(a.v - b.v) / Math.min(a.v, b.v) >= .01) { const pct = Math.round(Math.abs(a.v - b.v) / Math.min(a.v, b.v) * 100); out.why.push(`${r.label}: ${a.disp} contra ${b.disp}${pct >= 1 ? ` (${pct} % de diferencia)` : ""}`); }
      });
      return out;
    };

    /* Notas prácticas (lo que una cifra más alta NO dice por sí sola) */
    C.notes = cmp => {
      const out = [], { items, cat } = cmp;
      if (cmp.mixed) return ["Los productos son de categorías distintas: solo podemos comparar precio, tienda y disponibilidad. Comparar rendimiento o especificaciones entre categorías no tiene sentido (por ejemplo, un procesador contra una fuente)."];
      const r = id => cmp.rows.find(x => x.id === id);
      const nm = i => items[i].name.slice(0, 48);
      if (cat === "placas-de-video" && items.length >= 2) {
        const t = r("tgp"), p = r("psu");
        if (t && t.numeric && p && p.numeric) { const hi = t.cells[0].v >= t.cells[1].v ? 0 : 1, lo = 1 - hi;
          if (t.cells[hi].v - t.cells[lo].v >= 30) out.push(`La que más consume (${nm(hi)}) usa ${t.cells[hi].v - t.cells[lo].v} W más y el fabricante pide una fuente de ${p.cells[hi].v} W (la otra, ${p.cells[lo].v} W): puede obligarte a cambiar la fuente.`); }
        const v = r("vram"); if (v && v.numeric) { const lo = v.cells.findIndex(c => c.v === Math.min(...v.cells.map(x => x.v)));
          if (v.cells[lo].v <= 8) out.push(`${nm(lo)} tiene ${v.cells[lo].v} GB de VRAM: alcanza en 1080p, pero algunos juegos nuevos a 1440p/4K con texturas altas la superan.`); }
        const fp = r("fps"); if (fp && fp.cells.some(c => typeof c.v === "number")) out.push("Los FPS son un promedio de 11 juegos con un procesador de gama alta: en tu juego favorito la diferencia puede ser mayor o menor, y con DLSS/FSR cambia.");
      }
      if (cat === "procesadores") out.push("El puntaje de juegos se midió con una RTX 5090 a 1080p para destacar al procesador; con una placa de video más modesta, la diferencia entre procesadores se achica o desaparece.");
      if (cat === "notebooks") out.push("Procesador, memoria y almacenamiento se leen del título de la tienda; peso, medidas, panel y garantía, de la ficha técnica de la tienda para ese SKU cuando existe. La capacidad de batería no la publica ninguna tienda conectada. El rendimiento real depende de la refrigeración y de los vatios que el fabricante le dé a cada chip.");
      if (cat === "pcs-armadas") out.push("El rendimiento es una estimación a partir de la placa y el procesador del título; confirmá con la tienda la versión exacta y la fuente incluida.");
      if (cat === "almacenamiento" || cat === "memorias-ram") out.push("Las velocidades son las anunciadas por la tienda o el fabricante (picos teóricos); en el uso diario una diferencia grande de cifras suele sentirse poco.");
      if (cat === "mouses") out.push("Más DPI no significa mejor puntería: lo que más se nota en juegos es el sensor, el peso y la forma que le quede cómoda a tu mano.");
      if (cat === "teclados") out.push("El tipo de switch es una preferencia personal: si podés, probá el teclado (o un probador de switches) antes de comprar.");
      if (cat === "auriculares") out.push("La comodidad (peso, almohadillas, presión de la vincha) pesa tanto como el sonido para usarlos varias horas: no figura en ninguna ficha.");
      if (cat === "fuentes") out.push("La potencia y la certificación 80 Plus no garantizan calidad de componentes ni protecciones: priorizá marcas con reseñas independientes.");
      const missing = cmp.rows.filter(x => x.cells.some(c => c.tag === "nd") && !x.cells.every(c => c.tag === "nd") && !["store", "stock"].includes(x.id)).map(x => x.label);
      if (missing.length) out.push("Sin datos para alguno de los productos en: " + missing.slice(0, 6).join(", ") + (missing.length > 6 ? "…" : "") + ". No inferimos esos valores.");
      return out;
    };

    /* Qué datos técnicos tiene cada producto (sin contar nombre, precio, tienda ni disponibilidad). */
    const NO_SPEC = ["name", "price", "store", "stock", "official"];
    C.coverage = cmp => cmp.items.map((it, i) => {
      const spec = cmp.rows.filter(r => !NO_SPEC.includes(r.id) && !r.derived);
      return { name: it.name, have: spec.filter(r => r.cells[i].tag !== "nd").length, total: spec.length };
    });

    /* Lo que SÍ se puede afirmar con los datos que hay: filas numéricas con una diferencia real (>= 1 %). */
    // nombre corto para las frases: el del modelo reconocido ("Ryzen 7 5800XT") o el título sin palabras de relleno
    const shortN = it => (it.hwc && it.hwc.name) || (it.hwg && it.hwg.name) || it.name.replace(/^(placa de video|procesador|memoria( ram)?|disco (s[oó]lido|r[ií]gido)( ssd)?|fuente|mother(board)?|monitor( gamer)?|notebook( gamer)?|gabinete)\s+/i, "").slice(0, 48);
    C.facts = cmp => {
      const out = [];
      cmp.rows.forEach(r => {
        if (!r.numeric || !r.dir || r.derived) return;
        const w = r.cells.findIndex(c => c.win); if (w < 0) return;
        const others = r.cells.filter((_, i) => i !== w).map(c => c.disp).join(" / ");
        out.push({ id: r.id, label: r.label, winner: w, tag: r.cells[w].tag, text: `${r.id === "price" ? "Precio" : r.label}: ${r.id === "price" ? "más barato" : r.dir === "max" ? "mayor" : "menor"} en ${shortN(cmp.items[w])} (${r.cells[w].disp} frente a ${others})` });
      });
      return out;
    };

    /* Radar: solo métricas numéricas con dato en todos; 100 = el mejor de esta comparación */
    C.radar = cmp => {
      const ax = cmp.rows.filter(r => r.numeric && r.dir && r.chart !== "$" && r.cells.every(c => typeof c.v === "number" && c.v > 0) && r.id !== "price").slice(0, 6);
      return ax.map(r => { const v = r.cells.map(c => c.v), best = r.dir === "max" ? Math.max(...v) : Math.min(...v);
        return { label: r.label.replace(/ a (1080p|1440p|4K)$/, ""), vals: v.map(x => Math.round((r.dir === "max" ? x / best : best / x) * 100)) }; });
    };
    return C;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CT;
})(typeof self !== "undefined" ? self : this);
