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
  const fmt = (n, d = 0) => n == null ? null : Number(n).toLocaleString("es-AR", { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const mk = (v, disp, tag) => v == null ? ND : { v, disp: disp ?? String(v), tag };
  const txt = (v, tag) => v ? { v: null, text: v, disp: v, tag } : ND;
  const onev = (g, f) => (g && g.ver && g.ver.includes(f)) ? "ver" : "pend";

  CT.CATS = {
    "placas-de-video": "Placas de video", procesadores: "Procesadores", motherboards: "Placas madre", "memorias-ram": "Memorias RAM",
    almacenamiento: "SSD y discos", fuentes: "Fuentes", gabinetes: "Gabinetes", refrigeracion: "Refrigeración", monitores: "Monitores",
    notebooks: "Notebooks", "pcs-armadas": "PC armadas",
  };

  CT.makeCompare = function (C) {
    const HW = C.HW;
    /* un "ítem" = producto del catálogo + su oferta más barata + datos leídos/ligados */
    C.item = g => {
      const o = C.bestOffer(g) || g.offers.slice().sort((a, b) => price(a) - price(b))[0];
      const it = { g, o, p: o ? price(o) : null, inStock: !!C.bestOffer(g), name: g.name, cat: g.category, sp: CT.parse(g.name, g.category) };
      if (g.category === "placas-de-video") it.hwg = C.hwGpu(g.name);
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
        { id: "fps", label: `Rendimiento en juegos a ${CT.RES[res]}`, help: "FPS promedio de 11 juegos exigentes (Ultra, sin DLSS/FSR). Medición independiente, no oficial.", dir: "max", chart: " FPS", get: it => it.hwg ? mk(it.hwg.p[res], "~" + fmt(it.hwg.p[res]) + " FPS", "bench") : ND },
        { id: "rt", label: "Con ray tracing (1080p)", help: "FPS promedio con ray tracing en 1080p. Solo existe para algunas placas.", dir: "max", chart: " FPS", get: it => it.hwg && it.hwg.rt ? mk(it.hwg.rt[0], "~" + fmt(it.hwg.rt[0]) + " FPS", "bench") : ND },
        { id: "arq", label: "Arquitectura", help: "Generación de diseño del chip. Generaciones más nuevas suelen sumar tecnologías (DLSS 4, FSR 4, etc.).", get: it => it.hwg ? txt(it.hwg.spec.arq, onev(it.hwg, "arq")) : ND },
        { id: "sp", label: "Procesadores de sombreado", help: "CUDA cores (NVIDIA) o stream processors (AMD/Intel). Solo se pueden comparar con números dentro de una misma arquitectura: no son una medida directa de rendimiento.", dir: "max", chart: "", get: it => it.hwg ? mk(it.hwg.spec.sp, fmt(it.hwg.spec.sp), onev(it.hwg, "sp")) : ND },
        { id: "vram", label: "Memoria de video (VRAM)", help: "Memoria dedicada. Importa para texturas en 1440p/4K y para edición 3D.", dir: "max", chart: " GB", get: it => it.hwg ? mk(it.hwg.vram, it.hwg.vram + " GB", onev(it.hwg, "vram")) : it.sp.vram ? mk(it.sp.vram, it.sp.vram + " GB", "pend") : ND },
        { id: "mt", label: "Tipo de memoria", help: "GDDR7 > GDDR6X > GDDR6 en velocidad por pin.", get: it => it.hwg ? txt(it.hwg.spec.mt, onev(it.hwg, "mt")) : ND },
        { id: "bus", label: "Bus de memoria", help: "Ancho del bus en bits. Junto con la velocidad define el ancho de banda.", dir: "max", chart: " bits", get: it => it.hwg ? mk(it.hwg.spec.bus, it.hwg.spec.bus + " bits", onev(it.hwg, "bus")) : ND },
        { id: "bw", label: "Ancho de banda de memoria", help: "Bus ÷ 8 × velocidad por pin. Es un máximo teórico, no FPS.", dir: "max", chart: " GB/s", get: it => it.hwg ? mk(it.hwg.spec.bw, fmt(it.hwg.spec.bw) + " GB/s", onev(it.hwg, "bus") === "ver" && onev(it.hwg, "gbps") === "ver" ? "ver" : "pend") : ND },
        { id: "tgp", label: "Consumo de la placa (TGP)", help: "Potencia que declara el fabricante para la placa sola. No es el consumo medido en uso.", dir: "min", chart: " W", get: it => it.hwg ? mk(it.hwg.tgp, it.hwg.tgp + " W", onev(it.hwg, "tgp")) : ND },
        { id: "psu", label: "Fuente mínima que pide el fabricante", help: "Potencia de fuente recomendada por el fabricante para todo el equipo.", dir: "min", chart: " W", get: it => it.hwg ? mk(it.hwg.psu, it.hwg.psu + " W", onev(it.hwg, "psu")) : ND },
        { id: "official", label: "Ficha oficial del fabricante", help: "Página del fabricante contra la que se comprobaron los datos marcados como verificados, con la fecha de la comprobación.", get: it => it.hwg && it.hwg.vurl ? { v: null, text: "Ver ficha", disp: "Ver ficha (comprobada el " + it.hwg.vdate + ")", tag: "ver", url: it.hwg.vurl } : it.hwg ? { v: null, text: "Sin verificar", disp: "Sin verificar contra la ficha oficial", tag: "pend" } : ND },
        { id: "fpsw", label: "Eficiencia: FPS por vatio", help: "FPS promedio ÷ TGP. Orientativo: mezcla un benchmark con un consumo declarado.", dir: "max", derived: true, chart: "", get: it => it.hwg ? mk(Math.round(it.hwg.p[res] / it.hwg.tgp * 100) / 100, fmt(it.hwg.p[res] / it.hwg.tgp, 2) + " FPS/W", "est") : ND },
        { id: "fpspp", label: "Valor: FPS por cada $100.000", help: "FPS promedio ÷ precio × 100.000. Depende del precio del día.", dir: "max", derived: true, chart: "", get: it => it.hwg && it.p ? mk(Math.round(perPrice(it.hwg.p[res], it.p, 1e5) * 10) / 10, fmt(perPrice(it.hwg.p[res], it.p, 1e5), 1), "est") : ND },
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
        { id: "maxp", label: "Potencia máxima", help: "Intel: 'Maximum Turbo Power' oficial. AMD: TDP × 1,35 (estimado).", dir: "min", chart: " W", get: it => it.hwc ? mk(it.hwc.maxp, it.hwc.maxp + " W", it.hwc.vendor === "AMD" ? "est" : onev(it.hwc, "maxp")) : ND },
        { id: "official", label: "Ficha oficial del fabricante", help: "Página del fabricante contra la que se comprobaron los datos marcados como verificados, con la fecha de la comprobación.", get: it => it.hwc && it.hwc.vurl ? { v: null, text: "Ver ficha", disp: "Ver ficha (comprobada el " + it.hwc.vdate + ")", tag: "ver", url: it.hwc.vurl } : it.hwc ? { v: null, text: "Sin verificar", disp: "Sin verificar contra la ficha oficial", tag: "pend" } : ND },
        { id: "spp", label: "Valor: puntaje por cada $100.000", help: "Puntaje de juegos ÷ precio × 100.000.", dir: "max", derived: true, chart: "", get: it => it.hwc && it.hwc.s && it.p ? mk(Math.round(perPrice(it.hwc.s, it.p, 1e5) * 100) / 100, fmt(perPrice(it.hwc.s, it.p, 1e5), 2), "est") : ND },
      ],
      "memorias-ram": () => [
        { id: "gb", label: "Capacidad total", help: "Suma de todos los módulos del kit.", dir: "max", chart: " GB", get: it => it.sp.gb ? mk(it.sp.gb, it.sp.gb + " GB", "pend") : ND },
        { id: "ddr", label: "Generación", help: "DDR4 y DDR5 no son intercambiables: la placa madre define cuál usar.", get: it => txt(it.sp.ddr, "pend") },
        { id: "mods", label: "Módulos", help: "Dos módulos funcionan en dual channel (mejor rendimiento).", get: it => it.sp.mods ? { v: it.sp.mods, text: it.sp.mods + (it.sp.mods > 1 ? " módulos" : " módulo"), disp: it.sp.mods + (it.sp.mods > 1 ? " módulos" : " módulo"), tag: "pend" } : ND },
        { id: "mhz", label: "Velocidad", help: "Frecuencia anunciada en MHz.", dir: "max", chart: " MHz", get: it => it.sp.mhz ? mk(it.sp.mhz, it.sp.mhz + " MHz", "pend") : ND },
        { id: "cl", label: "Latencia CAS (CL)", help: "Ciclos de espera. Menor es mejor a igual velocidad.", dir: "min", chart: "", get: it => it.sp.cl ? mk(it.sp.cl, "CL" + it.sp.cl, "pend") : ND },
        { id: "lat", label: "Latencia real", help: "CL × 2000 ÷ MHz, en nanosegundos. Permite comparar memorias de distinta velocidad.", dir: "min", derived: true, chart: " ns", get: it => it.sp.lat ? mk(it.sp.lat, fmt(it.sp.lat, 1) + " ns", "est") : ND },
        { id: "ppg", label: "Precio por GB", help: "Precio ÷ capacidad.", dir: "min", derived: true, chart: "$", get: it => it.sp.gb && it.p ? mk(Math.round(it.p / it.sp.gb), ARS(it.p / it.sp.gb), "est") : ND },
      ],
      almacenamiento: () => [
        { id: "gb", label: "Capacidad", help: "Espacio total.", dir: "max", chart: " GB", get: it => it.sp.gb ? mk(it.sp.gb, it.sp.gb >= 1000 ? fmt(it.sp.gb / 1000, 2) + " TB" : it.sp.gb + " GB", "pend") : ND },
        { id: "kind", label: "Tipo", help: "SSD (rápido, sin partes móviles), HDD (barato por GB, lento).", get: it => txt(it.sp.kind, "pend") },
        { id: "iface", label: "Interfaz", help: "NVMe (M.2) es mucho más rápido que SATA; verificá que tu placa tenga ranura M.2.", get: it => txt(it.sp.iface, "pend") },
        { id: "gen", label: "Generación PCIe", help: "Gen4 duplica el máximo teórico de Gen3. Tu placa madre limita la velocidad.", get: it => txt(it.sp.gen, "pend") },
        { id: "mbs", label: "Velocidad anunciada", help: "Velocidad máxima de lectura que publica la tienda/fabricante. Es un pico, no el uso real.", dir: "max", chart: " MB/s", get: it => it.sp.mbs ? mk(it.sp.mbs, fmt(it.sp.mbs) + " MB/s", "pend") : ND },
        { id: "ppg", label: "Precio por GB", help: "Precio ÷ capacidad.", dir: "min", derived: true, chart: "$", get: it => it.sp.gb && it.p ? mk(Math.round(it.p / it.sp.gb * 10) / 10, ARS(it.p / it.sp.gb), "est") : ND },
      ],
      fuentes: () => [
        { id: "w", label: "Potencia", help: "Potencia total que entrega. Elegí según el consumo de tu placa de video y procesador.", dir: "max", chart: " W", get: it => it.sp.w ? mk(it.sp.w, it.sp.w + " W", "pend") : ND },
        { id: "cert", label: "Certificación 80 Plus", help: "Eficiencia: Bronze < Silver < Gold < Platinum < Titanium. No mide la calidad de los componentes internos.", dir: "max", chart: "", get: it => it.sp.cert ? { v: it.sp.certRank, text: it.sp.cert[0].toUpperCase() + it.sp.cert.slice(1), disp: it.sp.cert[0].toUpperCase() + it.sp.cert.slice(1), tag: "pend" } : ND },
        { id: "mod", label: "Cables modulares", help: "Los modulares ordenan mejor el gabinete.", get: it => ({ v: null, text: it.sp.modular ? "Sí" : "No indicado", disp: it.sp.modular ? "Sí" : "No indicado", tag: it.sp.modular ? "pend" : "nd" }) },
        { id: "atx", label: "Estándar ATX", help: "ATX 3.x trae el conector 12V-2x6 de las placas de gama alta modernas.", get: it => txt(it.sp.atx3, "pend") },
        { id: "ppw", label: "Precio por vatio", help: "Precio ÷ potencia.", dir: "min", derived: true, chart: "$", get: it => it.sp.w && it.p ? mk(Math.round(it.p / it.sp.w * 10) / 10, ARS(it.p / it.sp.w), "est") : ND },
      ],
      motherboards: () => [
        { id: "socket", label: "Socket", help: "Debe coincidir con el del procesador.", get: it => txt(it.sp.socket, "pend") },
        { id: "chipset", label: "Chipset", help: "Define funciones: overclock, cantidad de PCIe y USB.", get: it => txt(it.sp.chipset, "pend") },
        { id: "ddr", label: "Memoria", help: "DDR4 o DDR5, según la placa.", get: it => txt(it.sp.ddr, "pend") },
        { id: "form", label: "Formato", help: "Debe entrar en tu gabinete: Mini-ITX < Micro-ATX < ATX < E-ATX.", get: it => txt(it.sp.form, "pend") },
        { id: "wifi", label: "Wi-Fi integrado", help: "Si no lo trae necesitás una placa de red aparte.", get: it => ({ v: null, text: it.sp.wifi ? "Sí" : "No indicado", disp: it.sp.wifi ? "Sí" : "No indicado", tag: it.sp.wifi ? "pend" : "nd" }) },
      ],
      monitores: () => [
        { id: "inch", label: "Tamaño", help: "Diagonal en pulgadas.", dir: "max", chart: '"', get: it => it.sp.inch ? mk(it.sp.inch, fmt(it.sp.inch, 1) + '"', "pend") : ND },
        { id: "res", label: "Resolución", help: "Más píxeles = más nitidez, pero exige más a la placa de video.", dir: "max", chart: "", get: it => it.sp.px ? { v: it.sp.px, text: it.sp.res, disp: it.sp.res, tag: "pend" } : ND },
        { id: "hz", label: "Tasa de refresco", help: "Imágenes por segundo que puede mostrar. 144 Hz o más se nota en juegos competitivos.", dir: "max", chart: " Hz", get: it => it.sp.hz ? mk(it.sp.hz, it.sp.hz + " Hz", "pend") : ND },
        { id: "panel", label: "Panel", help: "IPS: mejores colores. VA: mejor contraste. TN: rápido pero con peor imagen. OLED: máximo contraste.", get: it => txt(it.sp.panel, "pend") },
        { id: "ms", label: "Tiempo de respuesta", help: "Menor es mejor. El valor de la tienda suele ser el más optimista (GtG).", dir: "min", chart: " ms", get: it => it.sp.ms ? mk(it.sp.ms, fmt(it.sp.ms, 1) + " ms", "pend") : ND },
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
    C.facts = cmp => {
      const out = [];
      cmp.rows.forEach(r => {
        if (!r.numeric || !r.dir || r.derived) return;
        const w = r.cells.findIndex(c => c.win); if (w < 0) return;
        const others = r.cells.filter((_, i) => i !== w).map(c => c.disp).join(" / ");
        out.push({ id: r.id, label: r.label, winner: w, tag: r.cells[w].tag, text: `${r.id === "price" ? "Precio" : r.label}: ${r.id === "price" ? "más barato" : r.dir === "max" ? "mayor" : "menor"} en ${cmp.items[w].name.replace(/^(placa de video|procesador|memoria ram|disco (s[oó]lido|r[ií]gido)|fuente|mother(board)?|monitor|notebook|gabinete)\s+/i, "").slice(0, 44)} (${r.cells[w].disp} frente a ${others})` });
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
