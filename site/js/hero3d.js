/* Portada: animación 3D del armado de una PC, pieza por pieza (Three.js, sin modelos externos: todo se dibuja con formas simples).
   - Se carga solo si el navegador soporta WebGL; si falla, la portada queda como estaba.
   - Se pausa cuando no está en pantalla o la pestaña está oculta.
   - Con «reducir movimiento» del sistema se muestra la PC armada, quieta.
   - Cada paso muestra el nombre de la pieza con un enlace a esa categoría del comparador. */
import * as THREE from "./vendor/three.module.min.js";

const host = document.getElementById("pc3d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

function webglOk() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
}

if (host && webglOk()) start();
else if (host) { host.remove(); document.querySelector(".hero")?.classList.remove("has3d"); }   // sin WebGL: la portada queda como antes

function start() {
  const label = document.getElementById("pc3d-step");
  const dots = document.getElementById("pc3d-dots");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.prepend(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const rig = new THREE.Group();            // todo lo que gira
  scene.add(rig);

  /* ---------- luces ---------- */
  scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x3a2a66, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.2); key.position.set(3, 5, 6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xc9d8ff, 1.4); fill.position.set(-2, 1, 5); scene.add(fill);
  const inside = new THREE.PointLight(0xffffff, 3.5, 3.2, 1.2); inside.position.set(0.2, 0.4, 0.15); scene.add(inside);
  const rim = new THREE.DirectionalLight(0x9b7bff, 1.6); rim.position.set(-4, 2, -3); scene.add(rim);
  const glowA = new THREE.PointLight(0x5b8cff, 0, 4); glowA.position.set(0.3, 0.3, 0.2); rig.add(glowA);
  const glowB = new THREE.PointLight(0xc04bff, 0, 4); glowB.position.set(-0.4, -0.3, 0.2); rig.add(glowB);

  /* ---------- materiales ---------- */
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.35 }, o));
  const mat = {
    caseDark: M(0xe8ecf5, { metalness: 0.25, roughness: 0.45 }),
    caseEdge: M(0xffffff, { metalness: 0.3, roughness: 0.3 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0.07, roughness: 0.05, metalness: 0.2, depthWrite: false }),
    pcb: M(0x23293d, { roughness: 0.6, metalness: 0.25 }),
    pcbLine: M(0x4a5d8f, { roughness: 0.5 }),
    metal: M(0xb8c2d6, { metalness: 0.9, roughness: 0.25 }),
    gold: M(0xd9b45a, { metalness: 0.95, roughness: 0.25 }),
    black: M(0x1a1e2c, { roughness: 0.45, metalness: 0.45 }),
    grey: M(0x59617a, { roughness: 0.45, metalness: 0.5 }),
    fin: M(0xc9d2e4, { metalness: 0.85, roughness: 0.3 }),
    ram: M(0x2a3047, { metalness: 0.6, roughness: 0.3 }),
    blade: M(0x1b1f2e, { roughness: 0.6, metalness: 0.2, transparent: true, opacity: 0.92 }),
  };
  const rgb = [];                                   // materiales que brillan al encender
  const glow = (hue) => { const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color().setHSL(hue, 0.9, 0.55), emissiveIntensity: 0, roughness: 0.4 }); m.userData.hue = hue; rgb.push(m); return m; };

  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  /* ventilador: aro con luz + aspas que giran */
  const fans = [];
  function fan(r, hue, axis = "z") {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.1, 10, 40), mat.black);
    const gm = glow(hue), rg = new THREE.TorusGeometry(r * 0.97, r * 0.06, 8, 48);
    const ring = new THREE.Mesh(rg, gm); ring.position.z = r * 0.11;          // un aro de luz en cada cara
    const ring2 = new THREE.Mesh(rg, gm); ring2.position.z = -r * 0.11;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.28, r * 0.16, 24), mat.grey); hub.rotation.x = Math.PI / 2;
    const blades = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const b = box(r * 0.62, r * 0.2, r * 0.03, mat.blade); b.position.x = r * 0.5; b.rotation.y = 0.45;
      const p = new THREE.Group(); p.add(b); p.rotation.z = (i / 7) * Math.PI * 2; blades.add(p);
    }
    g.add(frame, ring, ring2, hub, blades);
    if (axis === "x") g.rotation.y = Math.PI / 2;
    if (axis === "y") g.rotation.x = Math.PI / 2;
    fans.push(blades);
    return g;
  }

  /* ---------- gabinete (siempre visible, se arma adentro) ---------- */
  // Medidas: X = frente(+)/atrás(-) 2,0 · Y = alto 2,2 · Z = ancho 1,0 (el vidrio mira a la cámara, en +Z)
  const W = 2.0, H = 2.2, D = 1.0, t = 0.04;
  const caseG = new THREE.Group();
  caseG.add(at(box(W, t, D, mat.caseDark), 0, H / 2, 0), at(box(W, t, D, mat.caseDark), 0, -H / 2, 0));
  caseG.add(at(box(t, H, D, mat.caseDark), -W / 2, 0, 0));
  caseG.add(at(box(W, H, t, mat.caseDark), 0, 0, -D / 2));
  const front = at(box(t, H, D, M(0xdfe5f2, { transparent: true, opacity: 0.22, metalness: 0.2, depthWrite: false })), W / 2, 0, 0); caseG.add(front);
  caseG.add(at(box(W, H, 0.01, mat.glass), 0, 0, D / 2));
  // aristas
  [[0, H / 2, D / 2], [0, -H / 2, D / 2]].forEach(p => caseG.add(at(box(W + 0.02, 0.03, 0.03, mat.caseEdge), ...p)));
  [[W / 2, 0, D / 2], [-W / 2, 0, D / 2]].forEach(p => caseG.add(at(box(0.03, H, 0.03, mat.caseEdge), ...p)));
  // cubierta de la fuente (abajo)
  caseG.add(at(box(W - t, 0.04, D - t, mat.caseEdge), 0, -0.6, 0));
  // patas
  [[-0.8, 0.35], [0.8, 0.35], [-0.8, -0.35], [0.8, -0.35]].forEach(([x, z]) => caseG.add(at(box(0.18, 0.05, 0.12, mat.black), x, -H / 2 - 0.03, z)));
  rig.add(caseG);
  // sombra suave bajo el gabinete (degradado dibujado en un canvas)
  const sc = document.createElement("canvas"); sc.width = sc.height = 128;
  const sx = sc.getContext("2d"), grd = sx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, "rgba(10,6,40,.55)"); grd.addColorStop(1, "rgba(10,6,40,0)"); sx.fillStyle = grd; sx.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.0), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -H / 2 - 0.07; rig.add(shadow);

  /* ---------- piezas ---------- */
  const back = -D / 2 + t / 2;
  // placa madre
  const mobo = new THREE.Group();
  mobo.add(box(1.45, 1.55, 0.03, mat.pcb));
  for (let i = 0; i < 9; i++) mobo.add(at(box(1.2, 0.006, 0.006, mat.pcbLine), 0.05, -0.65 + i * 0.16, 0.017));
  mobo.add(at(box(0.32, 0.32, 0.02, mat.grey), -0.05, 0.38, 0.025));               // socket
  mobo.add(at(box(0.36, 0.5, 0.05, mat.black), -0.5, 0.42, 0.035));                 // disipador VRM
  mobo.add(at(box(0.5, 0.12, 0.05, mat.black), -0.1, 0.68, 0.035));
  [0.36, 0.43, 0.5, 0.57].forEach(x => mobo.add(at(box(0.035, 0.62, 0.03, mat.grey), x, 0.35, 0.03)));   // ranuras RAM
  mobo.add(at(box(1.0, 0.05, 0.035, mat.grey), -0.1, -0.13, 0.03));                 // ranura PCIe
  mobo.add(at(box(0.3, 0.14, 0.03, M(0x2b324a)), 0.35, -0.55, 0.03));               // chipset
  mobo.add(at(box(0.04, 0.6, 0.05, glow(0.62)), 0.7, -0.2, 0.035));                 // tira RGB
  at(mobo, -0.12, 0.2, back + 0.035);

  // procesador
  const cpu = new THREE.Group();
  cpu.add(box(0.24, 0.24, 0.02, M(0x1a6b3c)));
  cpu.add(at(box(0.2, 0.2, 0.025, mat.metal), 0, 0, 0.02));
  at(cpu, -0.17, 0.58, back + 0.08);

  // disipador torre + ventilador
  const cooler = new THREE.Group();
  for (let i = 0; i < 14; i++) cooler.add(at(box(0.012, 0.5, 0.34, mat.fin), -0.13 + i * 0.02, 0, 0.27));
  [-0.06, 0, 0.06].forEach(x => cooler.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 10), M(0xc77d4a, { metalness: 0.9, roughness: 0.25 })), x, 0, 0.2)));
  cooler.add(at(box(0.3, 0.06, 0.34, mat.black), 0, 0.27, 0.27));
  const cf = fan(0.2, 0.75, "x"); at(cf, 0.17, 0, 0.27); cooler.add(cf);
  cooler.add(at(box(0.22, 0.22, 0.05, mat.metal), 0, 0, 0.04));
  at(cooler, -0.17, 0.58, back + 0.08);

  // memorias RAM (2 módulos)
  const ram = new THREE.Group();
  [0.36, 0.5].forEach(x => {
    const s = new THREE.Group();
    s.add(at(box(0.03, 0.6, 0.14, mat.ram), 0, 0, 0.07));
    s.add(at(box(0.034, 0.6, 0.03, glow(0.58 + x * 0.2)), 0, 0, 0.155));
    s.add(at(box(0.02, 0.6, 0.02, mat.gold), 0, 0, -0.005));
    at(s, x - 0.12, 0.55, 0); ram.add(s);
  });
  at(ram, 0, 0, back + 0.065);

  // SSD M.2
  const ssd = new THREE.Group();
  ssd.add(box(0.42, 0.1, 0.012, M(0x0f3d26)));
  ssd.add(at(box(0.14, 0.08, 0.012, mat.black), -0.06, 0, 0.01), at(box(0.1, 0.08, 0.012, mat.black), 0.1, 0, 0.01));
  ssd.add(at(box(0.04, 0.1, 0.014, mat.gold), -0.21, 0, 0));
  at(ssd, -0.1, 0.06, back + 0.06);

  // placa de video
  const gpu = new THREE.Group();
  gpu.add(box(1.25, 0.14, 0.42, M(0x2a3047, { metalness: 0.7, roughness: 0.3 })));                    // carcasa
  gpu.add(at(box(1.27, 0.03, 0.44, M(0x2c3350, { metalness: 0.8, roughness: 0.25 })), 0, 0.085, 0));  // backplate
  gpu.add(at(box(1.0, 0.03, 0.03, glow(0.7)), 0.05, 0.0, 0.215));                                    // tira RGB del costado
  [-0.38, 0, 0.38].forEach(x => { const f = fan(0.17, 0.7, "y"); at(f, x, -0.075, 0); gpu.add(f); });
  gpu.add(at(box(0.06, 0.2, 0.46, mat.metal), -0.64, -0.01, 0));                                   // chapa de los conectores
  at(gpu, 0.0, -0.13 - 0.1, back + 0.28);
  // las piezas de la GPU miran a la cámara un poco: en realidad cuelga de la ranura PCIe
  gpu.position.x = -0.15;

  // fuente (abajo, en el compartimento)
  const psu = new THREE.Group();
  psu.add(box(0.75, 0.38, 0.66, M(0x262c40, { metalness: 0.6 })));
  psu.add(at(box(0.6, 0.02, 0.5, mat.grey), 0, 0.2, 0));
  const pf = fan(0.15, 0.6, "y"); at(pf, 0, -0.2, 0); psu.add(pf);
  psu.add(at(box(0.02, 0.06, 0.3, glow(0.55)), 0.38, 0.1, 0));
  at(psu, -0.55, -0.85, 0);

  // ventiladores del gabinete (3 al frente + 1 atrás)
  const caseFans = new THREE.Group();
  [0.55, 0.05].forEach((y, i) => { const f = fan(0.22, 0.62 + i * 0.08, "x"); at(f, W / 2 - 0.08, y, 0); caseFans.add(f); });
  const rf = fan(0.2, 0.8, "x"); at(rf, -W / 2 + 0.08, 0.6, 0.05); caseFans.add(rf);

  // cables (detalle final)
  const cables = new THREE.Group();
  const cable = (pts, c) => { const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.022, 8, false), M(c, { roughness: 0.8, metalness: 0.1 })); };
  const z0 = back + 0.07;   // pegados a la bandeja de la placa madre, como en un armado prolijo
  cables.add(cable([[-0.35, -0.62, z0 + 0.15], [-0.3, -0.5, z0 + 0.1], [0.62, -0.42, z0 + 0.06], [0.68, 0.0, z0], [0.68, 0.25, z0]], 0x1e2235));   // 24 pines
  cables.add(cable([[-0.75, -0.62, z0 + 0.1], [-0.82, 0.0, z0 + 0.02], [-0.78, 0.85, z0], [-0.6, 0.9, z0]], 0x1e2235));                      // CPU
  cables.add(cable([[-0.15, -0.62, z0 + 0.2], [0.2, -0.5, z0 + 0.32], [0.38, -0.36, z0 + 0.3]], 0x22263a));                                // placa de video
  /* ---------- guion del armado ---------- */
  const STEPS = [
    { o: mobo, name: "Placa madre", cat: "motherboards", from: [0, 0, 1.6], rot: [0, 0.7, 0] },
    { o: cpu, name: "Procesador", cat: "procesadores", from: [0, 0.9, 0.9], rot: [0.6, 0, 0.4] },
    { o: ram, name: "Memorias RAM", cat: "memorias-ram", from: [0, 1.1, 0.4], rot: [0, 0, 0] },
    { o: ssd, name: "Disco SSD M.2", cat: "almacenamiento", from: [1.2, 0, 0.6], rot: [0, 0, 0.5] },
    { o: cooler, name: "Refrigeración", cat: "refrigeracion", from: [0, 0.4, 1.4], rot: [0, -0.6, 0] },
    { o: gpu, name: "Placa de video", cat: "placas-de-video", from: [1.6, 0.2, 0.9], rot: [0, 0.5, 0] },
    { o: psu, name: "Fuente", cat: "fuentes", from: [-1.6, 0, 0.3], rot: [0, 0, 0] },
    { o: caseFans, name: "Ventiladores", cat: "refrigeracion", from: [0.9, 0, 1.0], rot: [0, 0, 0] },
    { o: cables, name: "Cables y encendido", cat: null, from: [0, -0.6, 0.6], rot: [0, 0, 0] },
  ];
  STEPS.forEach(s => {
    s.home = s.o.position.clone(); s.homeRot = s.o.rotation.clone();
    rig.add(s.o); s.o.visible = false;
  });
  if (dots) dots.innerHTML = STEPS.map(() => "<i></i>").join("");

  const STEP = 1.15, IN = 0.85;             // segundos por pieza / duración del vuelo
  const T_BUILT = STEPS.length * STEP;      // fin del armado
  const T_ON = T_BUILT + 0.4, T_HOLD = T_ON + 5.5, T_OUT = T_HOLD + 1.2, LOOP = T_OUT + 0.6;
  const easeOut = x => 1 - Math.pow(1 - x, 3);
  const easeBack = x => { const c = 1.5; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  let shown = -1;
  function setLabel(i, on) {
    if (!label) return;
    if (i === shown && !on) return;
    shown = i;
    if (i < 0) { label.innerHTML = ""; return; }
    const s = STEPS[Math.min(i, STEPS.length - 1)];
    label.innerHTML = on ? `<span class="n">Lista</span><b>¡PC armada!</b><a href="armado.html">Armá la tuya con precios reales →</a>`
      : `<span class="n">Paso ${i + 1} de ${STEPS.length}</span><b>${s.name}</b>${s.cat ? `<a href="productos.html?cat=${s.cat}">Ver precios →</a>` : `<a href="armado.html">Armado de PC →</a>`}`;
    if (dots) [...dots.children].forEach((d, k) => d.classList.toggle("on", on || k <= i));
  }

  /* ---------- tamaño y cámara ---------- */
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = w / h < 1 ? 7.6 : 6.3;
    camera.position.set(dist * 0.42, dist * 0.32, dist * 0.85);
    camera.lookAt(0, -0.3, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  /* ---------- interacción: arrastrar para girar ---------- */
  let drag = null, userYaw = 0, userPitch = 0, lastUser = -10;
  host.addEventListener("pointerdown", e => { if (e.target.closest("a")) return; drag = { x: e.clientX, y: e.clientY, yaw: userYaw, pitch: userPitch }; host.setPointerCapture(e.pointerId); });
  host.addEventListener("pointermove", e => { if (!drag) return; userYaw = drag.yaw + (e.clientX - drag.x) * 0.008; userPitch = Math.max(-0.35, Math.min(0.35, drag.pitch + (e.clientY - drag.y) * 0.005)); lastUser = clock.elapsedTime; });
  host.addEventListener("pointerup", () => { drag = null; });
  host.addEventListener("pointercancel", () => { drag = null; });

  /* ---------- bucle ---------- */
  const clock = new THREE.Clock();
  const startAt = parseFloat(new URLSearchParams(location.search).get("t3d")) || 0;   // ?t3d=12 salta a ese segundo (para revisar)
  let tAnim = reduce ? T_ON + 1 : startAt, running = false, raf = 0;

  function pose(tt) {
    // tt: tiempo dentro del ciclo
    const out = tt > T_HOLD ? Math.min(1, (tt - T_HOLD) / (T_OUT - T_HOLD)) : 0;
    let cur = -1;
    STEPS.forEach((s, i) => {
      const t0 = i * STEP, k = Math.min(1, Math.max(0, (tt - t0) / IN));
      s.o.visible = tt >= t0 && out < 0.98;
      if (!s.o.visible) return;
      if (k < 1 || out === 0) cur = Math.max(cur, i);
      const e = out > 0 ? 1 - easeOut(out) * 0.55 : easeBack(k);     // al desarmar se separan menos (no tapan la portada)
      const f = 1 - e;     // 1 = lejos, 0 = en su lugar
      s.o.position.set(s.home.x + s.from[0] * f, s.home.y + s.from[1] * f, s.home.z + s.from[2] * f);
      s.o.rotation.set(s.homeRot.x + s.rot[0] * f, s.homeRot.y + s.rot[1] * f, s.homeRot.z + s.rot[2] * f);
      const sc = 0.75 + 0.25 * Math.min(1, e * 1.2); s.o.scale.setScalar(sc);
    });
    // encendido: RGB y luces
    const on = tt >= T_ON && out < 1 ? Math.min(1, (tt - T_ON) / 0.8) * (1 - out) : 0;
    rgb.forEach(m => { m.emissiveIntensity = on * 4; });
    glowA.intensity = on * 2.5; glowB.intensity = on * 2;
    if (tt < T_ON) setLabel(Math.min(cur, STEPS.length - 1), false);
    else if (out === 0) setLabel(STEPS.length - 1, true);
    else setLabel(-1, false);
    return on;
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = clock.elapsedTime;
    if (!reduce) tAnim = (tAnim + dt) % LOOP;
    const on = pose(tAnim);
    // color que recorre el arcoíris cuando está encendida
    const hueShift = (now * 0.06) % 1;
    if (on > 0) rgb.forEach(m => m.emissive.setHSL((m.userData.hue + hueShift) % 1, 0.85, 0.55));
    fans.forEach((b, i) => { b.rotation.z += dt * (on > 0 ? 14 + (i % 3) : 0.4); });
    // giro suave automático + el del usuario
    const idle = now - lastUser > 2.5;
    if (idle && !drag) { userYaw *= 0.97; userPitch *= 0.97; }
    rig.rotation.y = (reduce ? -0.25 : Math.sin(now * 0.25) * 0.38 - 0.18) + userYaw;
    rig.rotation.x = userPitch;
    rig.position.y = reduce ? 0 : Math.sin(now * 0.9) * 0.025;            // flota apenas
    camera.zoom = 1 + on * 0.03; camera.updateProjectionMatrix();          // al encender, se acerca un poco
    renderer.render(scene, camera);
  }

  function play() { if (running) return; running = true; clock.getDelta(); frame(); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const vis = { inView: true };
  new IntersectionObserver(es => { vis.inView = es[0].isIntersecting; vis.inView && !document.hidden ? play() : stop(); }, { threshold: 0.05 }).observe(host);
  document.addEventListener("visibilitychange", () => { document.hidden || !vis.inView ? stop() : play(); });
  host.classList.add("ready");
  play();
}
