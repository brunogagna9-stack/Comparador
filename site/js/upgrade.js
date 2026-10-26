/* ComparáTech · motor de "¿Qué actualizar?": lee los componentes que la persona escribe, los ubica en la base de hardware
   y dice qué conviene cambiar para llegar a un objetivo (resolución + FPS), con productos REALES del catálogo.
   Regla de oro: lo que no sabemos se dice ("sin datos"); nunca se inventa un puntaje. */
(function (root) {
  "use strict";
  const CT = root.CT || require("./lib.js");

  CT.UPG_FPS = [[60, "Fluido (60 FPS)"], [100, "Muy fluido (100 FPS)"], [144, "Competitivo (144 FPS)"]];
  const SOCKET_MEM = { AM4: "DDR4", AM5: "DDR5", LGA1851: "DDR5" };

  /* socket deducido SOLO por el número del modelo, para procesadores que no están en la base (se avisa que es deducido) */
  function guessSocket(txt) {
    const t = txt.toLowerCase();
    let m = t.match(/ryzen\s?(?:[3579])\s?(\d)\d{3}/);
    if (m) return +m[1] <= 5 ? "AM4" : "AM5";
    m = t.match(/(?:i[3579][- ]?|core\s?i[3579][- ]?)(\d{4,5})/);
    if (m) {
      const n = m[1];
      if (n.length === 4) return +n[0] >= 6 && +n[0] <= 9 ? "LGA1151" : null;
      const g = +n.slice(0, 2);
      return g === 10 || g === 11 ? "LGA1200" : g >= 12 && g <= 14 ? "LGA1700" : null;
    }
    return null;
  }
  CT.guessSocket = guessSocket;

  CT.makeUpgrade = function (C) {
    const HW = C.HW, price = CT.price, ARS = CT.ARS;
    const best = l => (l && l[0]) ? l[0] : null;

    /* ---------- 1. de texto libre a componentes ---------- */
    C.parseOwned = function (text) {
      const o = { cpu: null, gpu: null, cpuText: null, gpuText: null, ram: null, psu: null, mobo: null, storage: null, socketGuess: null, unknown: [], seen: [] };
      const toks = String(text || "").split(/[\n,;+·|]|\s\/\s|\sy\s/i).map(s => s.trim()).filter(Boolean);
      const lenientGpu = tok => {
        const m = tok.match(/^(\d{4})\s*(ti super|ti|super|xtx|xt|gre)?$/i);
        if (!m) return null;
        return C.hwGpu("rtx " + tok, null) || C.hwGpu("rx " + tok, null);
      };
      for (const tok of toks) {
        const g = C.hwGpu(tok) || lenientGpu(tok);
        const c = g ? null : C.hwCpu(tok);
        if (g) { if (!o.gpu) { o.gpu = g; o.seen.push(["Placa de video", g.name, tok]); } else o.unknown.push(tok); continue; }
        if (c) { if (!o.cpu) { o.cpu = c; o.seen.push(["Procesador", c.name, tok]); } else o.unknown.push(tok); continue; }
        if (/\b(ssd|nvme|hdd|m\.2|sata|disco)\b/i.test(tok)) { const s = CT.parse(tok, "almacenamiento"); o.storage = { text: tok, kind: s.kind || (/hdd|disco r[ií]gido|mec[aá]nic/i.test(tok) ? "HDD" : null), gb: s.gb }; o.seen.push(["Almacenamiento", tok, tok]); continue; }
        const pw = tok.match(/(\d{3,4})\s?w(?:atts?)?\b/i);
        if (pw) { o.psu = { w: +pw[1], text: tok }; o.seen.push(["Fuente", pw[1] + " W", tok]); continue; }
        const mb = CT.parse(tok, "motherboards");
        if (mb.chipset || mb.socket) { o.mobo = { chipset: mb.chipset, socket: mb.socket, ddr: mb.ddr, text: tok }; o.seen.push(["Placa madre", (mb.chipset || "") + (mb.socket ? " · " + mb.socket : ""), tok]); continue; }
        // una placa que conocemos pero sin rendimiento medido (p. ej. RTX 3050 6GB): no confundir sus "6 GB" con la RAM
        if (/\brtx\b|\bgtx\b|radeon|geforce|\brx\s?\d|\barc\b|vega|\bgt\s?\d/i.test(tok)) { const gx = C.hwGpuX ? C.hwGpuX(tok) : null; o.gpuText = o.gpuText || (gx ? gx.name : tok); continue; }
        if (/ddr[345]|\b\d{1,3}\s?gb\b|\b\d\s?x\s?\d{1,2}\b/i.test(tok)) {
          const r = CT.parse(tok, "memorias-ram");
          if (r.gb) { o.ram = { gb: r.gb, ddr: r.ddr, mhz: r.mhz, text: tok }; o.seen.push(["Memoria", r.gb + " GB" + (r.ddr ? " " + r.ddr : ""), tok]); continue; }
        }
        if (/ryzen|core\s?i[3579]|\bi[3579][- ]\d|intel|ultra|athlon|pentium|celeron/i.test(tok) && !/rtx|gtx|radeon|geforce/i.test(tok)) { o.cpuText = o.cpuText || tok; o.socketGuess = guessSocket(tok); continue; }
        if (/\brtx\b|\bgtx\b|radeon|geforce|\brx\s?\d|\barc\b|vega|\bgt\s?\d/i.test(tok)) { o.gpuText = o.gpuText || tok; continue; }
        o.unknown.push(tok);
      }
      return o;
    };

    /* ---------- 2. diagnóstico ---------- */
    const priceOf = l => { const b = best(l); return b ? b.p : null; };
    const plat = (c, ramGb) => { // procesador + placa madre + memoria: costo de cambiar de plataforma
      const sc = best(C.findCpu(c)), sm = best(C.findMobo(c)), sr = best(C.findRam(c, ramGb));
      const parts = { cpu: sc, mobo: sm, ram: sr };
      const ok = !!(sc && sm && sr);
      return { c, parts, total: ok ? sc.p + sm.p + sr.p : null, partial: !ok };
    };

    C.advise = function (opts) {
      const o = opts.owned || C.parseOwned(opts.text), res = opts.res ?? 0, target = opts.fps || 60, budget = opts.budget > 0 ? +opts.budget : null;
      const gpu = o.gpu, cpu = o.cpu;
      const gF = gpu ? gpu.p[res] : null, cF = cpu && cpu.s ? C.cpuFps(cpu) : null;
      const out = { o, res, target, budget, steps: [], notes: [], cur: { gF, cF, eff: null, limiter: null, meets: null }, unknown: [], head: "" };
      const socket = cpu ? cpu.socket : (o.mobo && o.mobo.socket) || o.socketGuess || null;
      const mem = o.ram && o.ram.ddr || (o.mobo && o.mobo.ddr) || (socket && SOCKET_MEM[socket]) || null;

      if (!gpu && !cpu) { out.head = "Todavía no pudimos identificar ni tu procesador ni tu placa de video."; }
      if (o.cpuText && !cpu) out.unknown.push({ slot: "Procesador", text: o.cpuText, why: "No está en nuestra base de rendimiento" + (o.socketGuess ? ` (por el número del modelo parece ser socket ${o.socketGuess})` : "") + ". No inventamos un puntaje: por eso no podemos decir si limita a tu placa." });
      if (o.gpuText && !gpu) out.unknown.push({ slot: "Placa de video", text: o.gpuText, why: "No está en la tabla de rendimiento que usamos (solo mide placas de las últimas generaciones). No inventamos un puntaje." });
      if (cpu && !cpu.s) out.unknown.push({ slot: "Procesador", text: cpu.name, why: "Lo conocemos pero no tiene un puntaje de juegos comparable." });

      /* estado actual */
      if (gF != null && cF != null) {
        out.cur.eff = Math.min(gF, cF);
        out.cur.limiter = cF < gF * 0.9 ? "cpu" : gF < cF * 0.9 ? "gpu" : "balanced";
        out.cur.meets = out.cur.eff >= target;
      } else if (gF != null) { out.cur.eff = gF; out.cur.meets = gF >= target; } else if (cF != null) { out.cur.eff = cF; out.cur.meets = cF >= target; }

      /* PSU de lo que ya tiene */
      if (o.psu && gpu && cpu) {
        const need = C.psuFor(gpu, cpu).min;
        if (o.psu.w < need) out.steps.push({ kind: "psu", prio: 1, title: `Tu fuente (${o.psu.w} W) queda justa para lo que ya tenés`, why: `Con ${cpu.name} y ${gpu.name} el cálculo pide al menos ${need} W (procesador al máximo + placa + ~100 W del resto).`, options: C.findPsu(CT.up50(need * 1.15)).map(x => ({ shop: [x] })), need });
      }

      /* ----- placa de video ----- */
      const gpuStep = () => {
        const min = gF != null ? gF * 1.25 : target;
        let cands = HW.gpus.filter(g => !g.se && g.p[res] >= min); // no se recomienda comprar una placa de rendimiento estimado
        const items = [];
        let sinStock = 0, fueraPresup = 0;
        cands.forEach(g => {
          const shop = C.findGpu(g), pr = priceOf(shop);
          if (pr == null) { sinStock++; return; }
          const reach = cF != null ? Math.min(g.p[res], cF) : g.p[res];
          const capped = cF != null && cF < g.p[res] * 0.9;
          const ref = cpu || null, need = ref ? C.psuFor(g, ref).min : g.psu;
          const psuOk = o.psu ? o.psu.w >= need : null;
          const psuShop = psuOk === false ? best(C.findPsu(CT.up50(need * 1.15))) : null;
          const extra = psuShop ? psuShop.p : 0;
          if (budget && pr + extra > budget) { fueraPresup++; return; }
          items.push({ kind: "gpu", g, shop, price: pr, reach, capped, need, psuOk, psuShop, total: pr + extra, meets: reach >= target });
        });
        items.sort((a, b) => a.price - b.price);
        const ok = items.filter(x => x.meets);
        const pick = [];
        const add = x => { if (x && !pick.includes(x)) pick.push(x); };
        add(ok[0]); add(ok.find(x => x.reach >= target * 1.2)); add(ok.find(x => x.reach >= target * 1.45)); add(ok[ok.length - 1]);
        if (!ok.length) items.slice().sort((a, b) => b.reach - a.reach || a.price - b.price).slice(0, 2).forEach(add); // nada llega al objetivo: lo mejor disponible
        return { options: pick, sinStock, fueraPresup, hayOk: ok.length > 0 };
      };

      /* ----- procesador ----- */
      const cpuStep = () => {
        const base = cF, same = [], other = [];
        const gCap = gF != null ? gF : target;
        HW.cpus.forEach(c => {
          if (!c.s || c === cpu) return;
          if (cpu && c.s < cpu.s * 1.1) return;
          const f = C.cpuFps(c), reach = Math.min(gCap, f);
          if (cpu && c.socket === cpu.socket) {
            const shop = C.findCpu(c); // precio
            same.push({ kind: "cpu", c, f, reach, shop, price: priceOf(shop), meets: reach >= target });
          } else if (!c.se) other.push(c);
        });
        const sameBuy = same.filter(x => x.price != null).sort((a, b) => a.price - b.price);
        const sameNoStock = same.filter(x => x.price == null);
        const useful = sameBuy.filter(x => x.reach > (out.cur.eff || 0) * 1.08);
        const ramGb = o.ram && o.ram.gb >= 32 ? 32 : 16;
        let platform = [];
        if (!useful.some(x => x.meets) || !cpu) {
          platform = other.filter(c => C.cpuFps(c) >= Math.max(target, (base || 0) * 1.15) && (!socket || c.socket !== socket))
            .map(c => ({ kind: "plat", ...plat(c, ramGb), f: C.cpuFps(c), reach: Math.min(gCap, C.cpuFps(c)) }))
            .filter(x => !x.partial).sort((a, b) => a.total - b.total);
          const seenSock = new Set(), pk = [];
          platform.forEach(x => { if (pk.length < 3 && (!seenSock.has(x.c.socket) || pk.length < 2)) { seenSock.add(x.c.socket); pk.push(x); } });
          platform = pk;
        }
        return { same: useful.slice(0, 3), sameNoStock: sameNoStock.slice(0, 2), platform };
      };

      const cpuTooSlow = cF != null && (cF < target || (gF != null && cF < gF * 0.9));
      const gpuTooSlow = gF != null && gF < target;

      if (gpu && cpu && cF != null) {
        out.head = out.cur.meets
          ? `Con ${cpu.name} y ${gpu.name} ya llegás a ~${Math.round(out.cur.eff)} FPS a ${CT.RES[res]}: cumplís el objetivo de ${target} FPS. No hace falta cambiar nada para eso.`
          : out.cur.limiter === "gpu"
            ? `Lo que más te limita es la placa de video: hoy llegás a ~${Math.round(gF)} FPS a ${CT.RES[res]}, y tu ${cpu.name} podría mover ~${Math.round(cF)}.`
            : out.cur.limiter === "cpu"
              ? `Lo que más te limita es el procesador: tu ${cpu.name} mueve ~${Math.round(cF)} FPS y tu ${gpu.name} podría dar ~${Math.round(gF)} a ${CT.RES[res]}.`
              : `Procesador y placa están parejos (~${Math.round(out.cur.eff)} FPS a ${CT.RES[res]}); para llegar a ${target} FPS hay que mejorar ambos.`;
      } else if (gpu && gF != null) {
        out.head = `Tu ${gpu.name} da ~${Math.round(gF)} FPS a ${CT.RES[res]}.` + (cpu ? "" : " Sin el dato de tu procesador no podemos saber si limita.");
      } else if (cpu && cF != null) {
        out.head = `Tu ${cpu.name} puede mover placas de hasta ~${Math.round(cF)} FPS a ${CT.RES[res]}.` + " Sin el dato de tu placa de video no podemos saber cuál limita.";
      }

      const steps = [];
      if (gpu || !o.gpuText) {
        if (gpuTooSlow) { const r = gpuStep(); steps.push({ kind: "gpu", need: true, ...r, gpuLimits: out.cur.limiter !== "cpu" }); }
      } else if (cF != null) { // placa no identificada: ofrecemos qué placa aprovecharía este procesador
        const r = gpuStep(); steps.push({ kind: "gpu", need: false, ...r, unknownGpu: true });
      }
      if (cpuTooSlow) { const r = cpuStep(); steps.push({ kind: "cpu", need: true, ...r }); }
      const first = out.cur.limiter === "cpu" ? "cpu" : "gpu";
      steps.sort((a, b) => (a.kind === first ? -1 : 1) - (b.kind === first ? -1 : 1));
      out.steps.push(...steps);

      /* memoria */
      if (o.ram) {
        if (o.ram.gb < 16) out.steps.push({ kind: "ram", need: true, title: `Memoria: ${o.ram.gb} GB es poco para jugar hoy`, why: "Los juegos exigentes piden 16 GB; con 32 GB tenés margen.", shop: C.findRam({ mem: o.ram.ddr || mem || "DDR4" }, 16) });
        else if (o.ram.gb === 16 && target >= 100) out.notes.push("Tus 16 GB de RAM alcanzan; 32 GB solo se justifica si hacés muchas cosas a la vez.");
      } else out.notes.push("No dijiste cuánta memoria RAM tenés: no podemos evaluarla.");
      if (o.psu == null && (gpuTooSlow || cpuTooSlow)) out.notes.push("No dijiste qué fuente tenés: en cada placa te mostramos los watts que hacen falta para que la verifiques.");
      if (o.storage && o.storage.kind === "HDD") out.steps.push({ kind: "ssd", need: true, title: "Almacenamiento: pasá el sistema y tus juegos a un SSD", why: "Un disco mecánico (HDD) alarga las cargas y algunos juegos lo piden SSD. No cambia los FPS promedio.", shop: C.findSsd(1000) });

      if (opts.owned == null || true) {
        if (o.mobo && o.mobo.socket && cpu && o.mobo.socket !== cpu.socket) out.notes.push(`Ojo: tu placa madre parece ser socket ${o.mobo.socket} y tu procesador es ${cpu.socket}. Revisá que hayas escrito bien los modelos.`);
        if (socket && cpuTooSlow) out.notes.push(`Tu socket es ${socket}: un procesador del mismo socket entra en tu placa madre (confirmá en el sitio del fabricante la lista de compatibilidad y la versión de BIOS necesaria); cambiar de socket implica cambiar placa madre y, si pasás a DDR5, la memoria.`);
      }
      out.mem = mem; out.socket = socket;
      return out;
    };
  };

  root.CT = CT;
  if (typeof module !== "undefined" && module.exports) module.exports = CT;
})(typeof self !== "undefined" ? self : this);
