/* ComparáTech · motor de "Encontrá tu equipo": traduce respuestas sencillas en requisitos y busca productos REALES del catálogo. */
(function (root) {
  "use strict";
  const CT = root.CT || require("./lib.js");
  if (!CT.makeCompare) require("./compare.js");
  const { ARS, price } = CT;

  CT.USOS = [
    { id: "oficina", label: "Oficina, navegación y videollamadas", g: "Trabajo y estudio" },
    { id: "estudio", label: "Estudio, clases y universidad", g: "Trabajo y estudio" },
    { id: "programacion", label: "Programación y desarrollo", g: "Trabajo y estudio" },
    { id: "multitarea", label: "Multitarea y trabajo exigente", g: "Trabajo y estudio" },
    { id: "diseno", label: "Diseño gráfico y edición de imágenes", g: "Creación" },
    { id: "video", label: "Edición de video y producción audiovisual", g: "Creación" },
    { id: "render3d", label: "Modelado 3D, render, arquitectura y CAD", g: "Creación" },
    { id: "streaming", label: "Streaming, grabación y creación de contenido", g: "Creación" },
    { id: "gaming_casual", label: "Gaming casual", g: "Juegos" },
    { id: "gaming_comp", label: "Gaming competitivo y muchos FPS", g: "Juegos" },
    { id: "gaming_pesado", label: "Juegos exigentes (gráficos altos)", g: "Juegos" },
    { id: "eficiencia", label: "Bajo consumo, poco ruido o portabilidad", g: "Preferencias" },
  ];
  const USO_TXT = {
    oficina: "navegar, usar Office y hacer videollamadas", estudio: "clases virtuales, apuntes y trabajos", programacion: "programar y compilar proyectos",
    multitarea: "tener muchas aplicaciones abiertas", diseno: "editar imágenes y diseñar", video: "editar video", render3d: "modelar y renderizar en 3D",
    streaming: "transmitir y grabar", gaming_casual: "jugar sin exigencias altas", gaming_comp: "jugar a muchos FPS", gaming_pesado: "jugar títulos exigentes",
    eficiencia: "uso general con bajo consumo",
  };
  const RESIDX = { "1080": 0, "1440": 1, "4k": 2 };

  /* ---------- 1. de respuestas a requisitos ---------- */
  CT.needs = a => {
    const u = new Set(a.usos || []), n = { ram: { min: 8, rec: 16 }, ssd: 256, gpu: "none", gpuReq: [], cpuScore: null, cores: null, res: RESIDX[a.res] ?? 0, notes: [], why: [] };
    const up = (k, min, rec) => { n.ram.min = Math.max(n.ram.min, min); n.ram.rec = Math.max(n.ram.rec, rec); n.ssd = Math.max(n.ssd, k); };
    const gpu = (level, req) => { if (level === "gaming" || n.gpu === "none") n.gpu = level === "gaming" ? "gaming" : (n.gpu === "gaming" ? "gaming" : level); if (req) n.gpuReq.push(req); };
    if (u.has("programacion")) { up(512, 16, 32); n.cores = Math.max(n.cores || 0, 6); }
    if (u.has("multitarea")) { up(512, 16, 32); n.cores = Math.max(n.cores || 0, 6); }
    if (u.has("diseno")) { up(512, 16, 32); gpu("basic"); }
    if (u.has("video")) { up(1000, 16, 32); gpu("gaming", { res: 0, fps: 60 }); n.cores = Math.max(n.cores || 0, 8); }
    if (u.has("render3d")) { up(1000, 32, 32); gpu("gaming", { res: 0, fps: 70 }); n.cores = Math.max(n.cores || 0, 8); }
    if (u.has("streaming")) { up(512, 16, 32); gpu("gaming", { res: 0, fps: 45 }); n.cores = Math.max(n.cores || 0, 6); }
    if (u.has("gaming_casual")) { up(512, 16, 16); gpu("gaming", { res: n.res, fps: 45 }); }
    if (u.has("gaming_pesado")) { up(1000, 16, 32); gpu("gaming", { res: n.res, fps: 60 }); }
    if (u.has("gaming_comp")) { up(512, 16, 16); gpu("gaming", { res: 0, fps: 100 }); n.cpuScore = 70; }
    n.gaming = n.gpu === "gaming";
    if (n.gaming) n.why.push("tu uso necesita una placa de video dedicada");
    if (n.res > 0 && n.gaming) n.why.push("a " + CT.RES[n.res] + " la placa debe ser más potente que para 1080p");
    return n;
  };

  CT.makeFinder = function (C) {
    CT.makeCompare(C);
    const HW = C.HW, gpuRank = n => { const m = /(rtx|gtx|rx|arc)\s?([a-z]?)(\d)(\d{2})/i.exec(n || ""); return m ? (+m[3]) * 10 + ({ 3: 1, 4: 2, 5: 3 }[Math.floor(+m[4] / 10)] || ({ 5: 1, 6: 2, 7: 3, 8: 4, 9: 5 })[+m[4][0]] || 1) : null; };
    const gpuLine = n => { const m = /(rtx|gtx)\s?(\d)(\d)(\d{2})/i.exec(n || ""); return m ? (+m[2]) * 10 + ({ 5: 1, 6: 2, 7: 3, 8: 4, 9: 5 }[+m[3]] || 0) : null; };
    CT.gpuLine = gpuLine;
    const upd = C.updated;
    const lbl = { eco: "Opción económica", bal: "Opción equilibrada", perf: "Opción de mayor rendimiento", one: "Opción encontrada" };

    /* elige hasta 3 alternativas distintas; cands = [{score,total,...}] ya válidas para los requisitos */
    C.pick3 = (cands, budget, enfoque) => {
      const under = budget ? cands.filter(c => c.total <= budget) : cands.slice();
      if (!under.length) return { picks: [], under: 0 };
      const byTotal = under.slice().sort((a, b) => a.total - b.total || b.score - a.score);
      const eco = byTotal[0];
      const perfPool = budget ? under : under.filter(c => c.total <= eco.total * 1.8);
      const perf = perfPool.slice().sort((a, b) => b.score - a.score || a.total - b.total)[0];
      const rest = under.filter(c => c !== eco && c !== perf);
      const bal = rest.slice().sort((a, b) => b.score / b.total - a.score / a.total)[0];
      const picks = [];
      const add = (k, c) => { if (c && !picks.find(p => p.c === c)) picks.push({ k, label: lbl[k], c }); };
      add("eco", eco); add("bal", bal); add("perf", perf);
      if (picks.length === 1) picks[0].label = lbl.one;
      const pref = { barato: "eco", equilibrado: "bal", rendimiento: "perf" }[enfoque];
      if (pref) picks.sort((x, y) => (y.k === pref) - (x.k === pref));
      picks.forEach(p => { p.similar = byTotal.filter(c => c !== p.c).sort((x, y) => Math.abs(x.total - p.c.total) - Math.abs(y.total - p.c.total)).slice(0, 3); });
      return { picks, under: under.length };
    };

    /* ---------- 2. notebooks ---------- */
    C.recNotebooks = (a, n) => {
      const all = C.inCat("notebooks"), cands = [], excl = { datos: 0, ram: 0, ssd: 0, gpu: 0, stock: 0 };
      all.forEach(g => {
        const o = C.bestOffer(g); if (!o) { excl.stock++; return; }
        const s = CT.parse(g.name, "notebooks");
        if (!s.ram || !s.ssd) { excl.datos++; return; }
        if (s.ram < n.ram.min) { excl.ram++; return; }
        if (s.ssd < n.ssd) { excl.ssd++; return; }
        const rank = gpuLine(s.gpu); if (n.gaming && !s.gpu) { excl.gpu++; return; }
        if (n.gpuReq.some(r => r.fps >= 60) && (rank == null || rank < 22 && !/rx|arc/i.test(s.gpu || ""))) { excl.gpu++; return; }
        const pw = a.portable === "si" ? C.sf(g, "peso") : null;   // si la va a llevar de un lado a otro, se prefiere la liviana (solo con peso publicado)
        const score = s.ram / 16 + s.ssd / 512 + (s.gpu ? 1.5 + (rank || 20) / 20 : 0) + (s.hz ? s.hz / 240 : 0) + (pw ? Math.max(0, (2.4 - pw.v)) * 0.5 : 0);
        cands.push({ kind: "notebook", g, o, total: CT.price(o), score, s });
      });
      return { cands, excl };
    };

    /* ---------- 3. PC armadas ---------- */
    C.recPcs = (a, n) => {
      const cands = [], excl = { datos: 0, ram: 0, ssd: 0, gpu: 0, stock: 0 }, res = n.res;
      C.inCat("pcs-armadas").forEach(g => {
        if (/combo|service|servicio|instalaci/i.test(g.name)) return;
        const o = C.bestOffer(g); if (!o) { excl.stock++; return; }
        const s = CT.parse(g.name, "pcs-armadas"), hg = C.hwGpu(g.name, s.vram ?? null), hc = C.hwCpu(g.name);
        if (!s.ram || !s.ssd) { excl.datos++; return; }
        if (s.ram < n.ram.min) { excl.ram++; return; }
        if (s.ssd < n.ssd) { excl.ssd++; return; }
        let fps = null, cpuKnown = false;
        if (n.gaming) {
          if (!hg) { excl.gpu++; return; }
          if (n.gpuReq.some(r => hg.p[r.res] < r.fps)) { excl.gpu++; return; }
          fps = hg.p[res]; const cf = hc && hc.s ? C.cpuFps(hc) : null; cpuKnown = !!cf; if (cf) fps = Math.min(fps, cf);
          if (n.cpuScore && !(hc && hc.s >= n.cpuScore)) { excl.gpu++; return; }
        } else if (!s.gpu) { const ig = CT.hasIgpu(g.name); if (ig !== true) { excl.gpu++; return; } }
        const score = n.gaming ? fps : s.ram / 16 + s.ssd / 512 + (hc ? hc.spec.threads / 8 : 0);
        cands.push({ kind: "pc", g, o, total: CT.price(o), score, s, hg, hc, fps, cpuKnown });
      });
      return { cands, excl };
    };

    /* ---------- 4. PC por componentes (reusa la lógica del armado) ---------- */
    const finalize = (title, parts, extra) => { const t = C.total(parts); return { kind: "build", title, parts, total: t.total, priced: t.priced, missing: t.missing, ...extra }; };
    C.recBuilds = (a, n) => {
      const cands = [], res = n.res;
      if (n.gaming) {
        HW.gpus.forEach(g => {
          if (n.gpuReq.some(r => g.p[r.res] < r.fps)) return;
          if (!C.findGpu(g).length) return;
          const { cMin, cSug } = C.pickPair(g, res);
          [["min", cMin], ["sug", cSug]].forEach(([kind, cc]) => {
            if (n.cpuScore && !(cc.c.s >= n.cpuScore)) return;
            if (n.cores && cc.c.spec.cores < n.cores) return;
            const parts = C.parts(g, cc.c, cc.short, kind, res, { ram: kind === "min" ? n.ram.min : n.ram.rec, ssd: n.ssd });
            const b = finalize("", parts, { g, c: cc.c, cfg: kind, short: cc.short });
            const cf = cc.c.s ? C.cpuFps(cc.c) : null, fps = cf ? Math.min(g.p[res], cf) : g.p[res];
            Object.assign(b, { score: fps, fps });
            if (b.priced >= parts.length - 1 && !b.missing.some(m => ["Placa de video", "Procesador", "Fuente de poder"].includes(m))) cands.push(b);
          });
        });
      } else {
        const psuRam = [["min", n.ram.min <= 8 ? 8 : 16], ["rec", Math.max(16, n.ram.rec)]];
        HW.cpus.forEach(c => {
          if (!c.spec.igpu || (n.cores && c.spec.cores < n.cores)) return;
          const cpuShop = C.findCpu(c).filter(x => CT.hasIgpu(x.g.name) === true); if (!cpuShop.length) return;
          psuRam.forEach(([kind, gb]) => {
            const w = CT.up50(c.maxp + 150), ram = gb;
            const parts = [
              { slot: "cpu", label: "Procesador", title: "Procesador: " + c.name, why: `${c.socket} · ${c.cores || c.spec.cores} núcleos · gráficos integrados (sin placa de video).`, shop: cpuShop, key: "cpu:" + c.id },
              { slot: "mobo", label: "Placa madre", title: `Placa madre (socket ${c.socket})`, why: "Verificá que la BIOS soporte este procesador.", shop: C.findMobo(c), key: "mobo:" + c.socket },
              { slot: "ram", label: "Memoria RAM", title: `Memoria RAM: ${ram} GB ${c.mem}`, why: "En dos módulos si es posible.", shop: C.findRam(c, ram), key: "ram:" + ram },
              { slot: "ssd", label: "Almacenamiento", title: `SSD ${n.ssd >= 1000 ? "1 TB" : n.ssd >= 500 ? "500 GB" : "250 GB"}`, why: "NVMe preferido.", shop: C.findSsd(n.ssd >= 1000 ? 1000 : n.ssd >= 500 ? 500 : 250), key: "ssd" },
              { slot: "psu", label: "Fuente de poder", title: `Fuente de poder: ${w} W o más`, why: "Procesador al máximo + resto del equipo; 80 Plus.", shop: C.findPsu(w), key: "psu:" + w },
            ];
            const b = finalize("", parts, { c, cfg: kind });
            Object.assign(b, { score: c.spec.threads + ram / 4 });
            if (b.priced >= 4) cands.push(b);
          });
        });
      }
      return { cands };
    };

    /* ---------- 5. mejorar la PC que ya tiene ---------- */
    C.upgrade = (a, n) => {
      const h = a.have || {}, out = { gpus: [], cpus: [], notes: [] };
      const cpu = HW.cpus.find(c => c.id === h.cpu) || null, cur = HW.gpus.find(g => g.id === h.gpu) || null, psuW = +h.psu || null, res = n.res;
      const goal = h.goal || "gpu";
      if (goal === "gpu" || goal === "todo") {
        HW.gpus.filter(g => C.findGpu(g).length && (!cur || g.p[res] >= cur.p[res] * 1.25) && !n.gpuReq.some(r => g.p[r.res] < r.fps)).forEach(g => {
          const compat = [];
          if (psuW) compat.push(psuW >= g.psu ? { s: "ok", t: `Tu fuente de ${psuW} W cumple el mínimo del fabricante (${g.psu} W). Igual verificá que tenga los conectores de la placa.` }
            : { s: "bad", t: `Tu fuente de ${psuW} W es menor a los ${g.psu} W que pide el fabricante: tendrías que cambiarla.` });
          else compat.push({ s: "unk", t: `No sabemos qué fuente tenés: el fabricante pide ${g.psu} W y los conectores de la placa. Verificalo antes de comprar.` });
          if (cpu && cpu.s) { const cf = C.cpuFps(cpu); compat.push(cf >= g.p[res] * .8 ? { s: "ok", t: `Tu ${cpu.name} alcanza para esta placa sin un cuello de botella importante (a ${CT.RES[res]}).` }
            : { s: "warn", t: `Tu ${cpu.name} limitaría a esta placa (≈${Math.round(cf)} FPS contra ~${Math.round(g.p[res])}): conviene mejorar también el procesador.` }); }
          else compat.push({ s: "unk", t: cpu ? `No tenemos puntaje de juegos de tu ${cpu.name}: no podemos descartar un cuello de botella.` : "No sabemos qué procesador tenés: no podemos estimar si limitaría a la placa." });
          compat.push({ s: "unk", t: "No podemos comprobar el espacio en tu gabinete ni la ranura PCIe: medí el largo de la placa." });
          out.gpus.push({ g, shop: C.findGpu(g), compat, bad: compat.some(c => c.s === "bad"), warn: compat.some(c => c.s === "warn") });
        });
        out.gpus.sort((x, y) => x.shop[0].p - y.shop[0].p);
        if (n.budget || a.budget) { const b = a.budget; out.gpus = out.gpus.filter(x => !b || x.shop[0].p <= b); }
      }
      if ((goal === "cpu" || goal === "todo") && cpu) {
        HW.cpus.filter(c => c.id !== cpu.id && c.s && cpu.s && c.s > cpu.s * 1.1 && C.findCpu(c).length).forEach(c => {
          const same = c.socket === cpu.socket, compat = [];
          compat.push(same ? { s: "ok", t: `Mismo socket (${c.socket}) que tu ${cpu.name}: entra en tu placa madre si su chipset y BIOS lo soportan. Verificalo en el sitio del fabricante de tu placa.` }
            : { s: "warn", t: `Cambia el socket (${cpu.socket} → ${c.socket}): necesitás placa madre nueva${cpu.mem !== c.mem ? " y memoria " + c.mem : ""}.` });
          if (psuW && cur) compat.push(psuW >= c.maxp + cur.tgp + 100 ? { s: "ok", t: `Tu fuente de ${psuW} W alcanza para este procesador con tu placa actual.` } : { s: "warn", t: `Con tu placa actual y este procesador, el consumo máximo estimado supera tu fuente de ${psuW} W.` });
          const total = same ? C.findCpu(c)[0].p : C.findCpu(c)[0].p + (C.findMobo(c)[0] ? C.findMobo(c)[0].p : 0);
          out.cpus.push({ c, shop: C.findCpu(c), mobo: same ? [] : C.findMobo(c), compat, total, cost: same ? "solo el procesador" : "procesador + placa madre" });
        });
        out.cpus.sort((x, y) => x.total - y.total);
        if (a.budget) out.cpus = out.cpus.filter(x => x.total <= a.budget);
      } else if (goal === "cpu" && !cpu) out.notes.push("Elegí tu procesador actual para poder ver qué mejoras entran en tu placa madre.");
      else if (goal === "cpu" && cpu && !cpu.s) out.notes.push(`No tenemos un puntaje de juegos de tu ${cpu.name}, así que no podemos asegurar qué procesadores lo mejorarían. Elegí otra opción o empezá por la placa de video.`);
      return out;
    };

    /* ---------- 6. explicación de cada resultado ---------- */
    C.explain = (a, n, c) => {
      const pros = [], cons = [], does = [], limits = [], specs = [], p = [];
      const T = { ver: "ver", pend: "pend", est: "est", bench: "bench" };
      let ram = null, ssd = null, fps = c.fps ?? null;
      if (c.kind === "notebook" || c.kind === "pc") {
        const s = c.s; ram = s.ram; ssd = s.ssd;
        specs.push(["Procesador", s.cpu || "Sin datos", s.cpu ? "pend" : "nd"], ["Placa de video", s.gpu ? s.gpu + (s.vram ? " " + s.vram + " GB" : "") : (c.kind === "notebook" ? "No indicada (gráficos integrados)" : "No indicada"), s.gpu ? "pend" : "nd"],
          ["Memoria RAM", s.ram + " GB", "pend"], ["Almacenamiento", (s.ssd >= 1000 ? s.ssd / 1000 + " TB" : s.ssd + " GB") + " SSD", "pend"]);
        if (s.inch) specs.push(["Pantalla", s.inch + '"' + (s.hz ? " · " + s.hz + " Hz" : ""), "pend"]);
        if (c.kind === "notebook") {
          const pw = C.sf(c.g, "peso"), amp = C.sf(c.g, "ram_ampliable"), gr = C.sf(c.g, "garantia"), pn = C.sf(c.g, "panel"), cpuF = C.sf(c.g, "cpu");
          const why = C.specMissing(c.g, "peso") === "sin ficha" ? "la tienda no publicó una ficha técnica de este modelo" : "la ficha de la tienda no lo informa";
          const src = r => ` (${r.src}, SKU ${r.sku}, ${r.date})`;
          if (pw) {
            specs.push(["Peso", pw.v.toString().replace(".", ",") + " kg" + src(pw), pw.tag]);
            if (a.portable === "si") { if (pw.v <= 1.7) pros.push(`Pesa ${pw.v.toString().replace(".", ",")} kg según la ficha de la tienda: cómoda para llevar.`); else if (pw.v >= 2.2) cons.push(`Pesa ${pw.v.toString().replace(".", ",")} kg: pesada para transportar todos los días.`); }
          } else {
            specs.push(["Peso", "Sin datos (" + why + ")", "nd"]);
            limits.push("No pudimos obtener el peso: " + why + (a.portable === "si" ? ". Dijiste que la vas a transportar, así que confirmalo con la tienda o en la hoja técnica del fabricante." : "."));
          }
          specs.push(["Batería", "Sin datos: ninguna tienda conectada publica la capacidad (Wh) ni la autonomía medida", "nd"]);
          limits.push("Batería: la capacidad no figura en las fichas de las tiendas y no usamos la autonomía de marketing como si fuera real. Buscala en la hoja técnica del fabricante" + (a.portable === "si" ? " (dijiste que la vas a transportar)." : "."));
          if (amp) specs.push(["RAM ampliable", (amp.v ? "Sí" : "No") + " (" + amp.note + ")", amp.tag]);
          if (pn) specs.push(["Panel", pn.v, pn.tag]);
          if (gr) specs.push(["Garantía de la tienda", gr.v + " meses", gr.tag]);
          if (cpuF && cpuF.tag === "pend" && cpuF.note) limits.push(cpuF.note);
          if (amp && !amp.v && s.ram < n.ram.rec) cons.push(`Su RAM no se puede ampliar (${amp.note.toLowerCase()}): conviene que ya venga con los ${n.ram.rec} GB que necesitás.`);
          if (amp && amp.v && s.ram < n.ram.rec) pros.push("Tiene un slot de RAM libre: podés ampliarla más adelante.");
        }
        if (c.kind === "pc" && c.hg) specs.push(["Rendimiento en juegos a " + CT.RES[n.res], "~" + Math.round(fps) + " FPS (estimado)", "est"]);
        if (c.kind === "pc" && n.gaming && !c.cpuKnown) limits.push("No tenemos el puntaje de juegos de este procesador: el rendimiento podría ser menor al estimado.");
        if (c.kind === "notebook" && s.gpu) limits.push("No hay benchmarks de notebooks en nuestras fuentes: no sabemos cuántos FPS dará esa placa (la versión móvil rinde menos que la de escritorio).");
      } else if (c.kind === "build") {
        const sp = c.parts; ram = c.parts.find(x => x.slot === "ram").title.match(/(\d+) GB/)[1] * 1;
        if (c.g) specs.push(["Rendimiento en juegos a " + CT.RES[n.res], "~" + Math.round(fps) + " FPS (estimado)", "est"]);
      }
      if (ram != null) { if (ram >= n.ram.rec) pros.push(`Memoria de ${ram} GB: cómoda para lo que elegiste.`); else cons.push(`Memoria de ${ram} GB: alcanza para empezar, pero con tus usos conviene llegar a ${n.ram.rec} GB.`); }
      if (c.kind !== "build" && ssd != null) { if (ssd >= n.ssd) pros.push(`Almacenamiento de ${ssd >= 1000 ? ssd / 1000 + " TB" : ssd + " GB"} SSD, suficiente para empezar.`); }
      if (n.gaming && fps) {
        const need = Math.max(...n.gpuReq.filter(r => r.res === n.res).map(r => r.fps), 0);
        if (need && fps >= need * 1.3) pros.push(`Rinde ~${Math.round(fps)} FPS promedio a ${CT.RES[n.res]} en juegos exigentes: supera con margen lo que necesitás (~${need}).`);
        else if (need && fps >= need) pros.push(`Rinde ~${Math.round(fps)} FPS promedio a ${CT.RES[n.res]}: cumple lo que necesitás (~${need}), sin mucho margen.`);
        const g = c.g && c.g.vram ? c.g : (c.hg || null);
        if (g && g.vram <= 8 && n.res >= 1) cons.push(`${g.vram} GB de VRAM: justo para ${CT.RES[n.res]} con texturas altas en juegos nuevos.`);
        if (c.short) cons.push("El procesador más potente de nuestra lista igual podría limitar a la placa.");
      }
      if (c.kind === "build") { if (c.cfg === "min") limits.push("Es la configuración mínima sin cuello de botella: deja poco margen de fuente y de memoria para ampliar."); else pros.push("Configuración sugerida: fuente con ~25 % de margen y memoria holgada."); }
      (a.usos || []).forEach(u => {
        const ok = (!n.gaming || !["gaming_casual", "gaming_comp", "gaming_pesado", "video", "render3d", "streaming"].includes(u) || (fps && fps >= 45)) && (ram == null || ram >= (["video", "render3d", "programacion", "multitarea", "diseno"].includes(u) ? 16 : 8));
        const unk = c.kind === "notebook" && ["gaming_casual", "gaming_comp", "gaming_pesado", "video", "render3d"].includes(u);
        (unk ? limits : ok ? does : limits).push(unk ? `Para ${USO_TXT[u]} no podemos asegurar el resultado: faltan benchmarks de esta placa de notebook.` : ok ? `Puede ${USO_TXT[u]} (estimado según sus especificaciones).` : `Para ${USO_TXT[u]} queda justo con estas especificaciones.`);
      });
      if ((a.usos || []).includes("video") || (a.usos || []).includes("render3d")) limits.push("No tenemos benchmarks de render/edición: la potencia del procesador para esos programas no está medida en nuestras fuentes.");
      if (a.usos && a.usos.includes("gaming_comp") && !c.cpuKnown && c.kind === "pc") limits.push("Para muchos FPS importa el procesador y el monitor de alta frecuencia (Hz).");
      return { pros, cons, does, limits, specs };
    };

    /* ---------- 7. orquestador ---------- */
    C.recommend = (a, extras = true) => {
      const n = CT.needs(a); n.budget = a.budget || null;
      const tipo = a.tipo || "nose", out = { n, sections: [], insufficient: null, upgrade: null, notes: [] };
      if (a.have && a.have.tiene) { out.upgrade = C.upgrade(a, n); return out; }
      const mk = (key, title, cands, excl) => ({ key, title, cands, excl, ...C.pick3(cands, a.budget, a.enfoque) });
      const want = tipo === "nose" ? (n.gaming ? ["armada", "componentes"] : ["armada", "notebook"]) : tipo === "pc" ? ["armada", "componentes"] : [tipo];
      if (want.includes("armada")) { const r = C.recPcs(a, n); out.sections.push(mk("pc", "PC armada", r.cands, r.excl)); }
      if (want.includes("componentes")) { const r = C.recBuilds(a, n); out.sections.push(mk("build", "PC por componentes", r.cands)); }
      if (want.includes("notebook")) { const r = C.recNotebooks(a, n); out.sections.push(mk("notebook", "Notebook", r.cands, r.excl)); }
      out.sections.forEach(s => s.picks.forEach(p => { Object.assign(p, C.explain(a, n, p.c)); }));
      const any = out.sections.some(s => s.picks.length);
      if (!any) { /* presupuesto insuficiente: decir qué falta y qué alternativas reales hay */
        const noBud = { ...a, budget: null }, all = [];
        out.sections.forEach(s => { s.cands.forEach(c => all.push(c)); });
        const minTotal = all.length ? Math.min(...all.map(c => c.total)) : null;
        const alt = [];
        if (n.gaming && a.budget) { /* ¿qué sí se puede jugar con ese presupuesto? */
          const r = CT.needs({ usos: ["gaming_casual"], res: "1080" }); r.budget = a.budget;
          const cs = [...C.recBuilds({ usos: ["gaming_casual"], res: "1080" }, r).cands, ...C.recPcs({ usos: ["gaming_casual"], res: "1080" }, r).cands].filter(c => c.total <= a.budget).sort((x, y) => y.score - x.score);
          if (cs[0]) alt.push({ c: cs[0], n: r });
        }
        out.insufficient = { minTotal, budget: a.budget, alt, reason: all.length ? "con tu presupuesto no hay productos que cumplan lo que necesitás" : "no encontramos en el catálogo productos con stock que cumplan esos requisitos" };
      }
      out.updated = upd;
      return out;
    };
    return C;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CT;
})(typeof self !== "undefined" ? self : this);
