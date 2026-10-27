/* Portada: animación 3D del armado de una PC, pieza por pieza (Three.js; todo se dibuja con código, sin modelos externos).
   Versión 2: escenario oscuro tipo vitrina, brillo real del RGB (bloom), reflejos, cámara que acompaña cada pieza,
   placa de video en montaje vertical, refrigeración líquida, encendido con ola de color y vista explotada.
   - Se carga solo con WebGL; si algo falla, la portada queda como estaba.
   - Se pausa fuera de pantalla o con la pestaña oculta; si el equipo va lento, apaga el brillo y baja la resolución.
   - Con «reducir movimiento» se muestra la PC armada y encendida, quieta.
   - Cada paso muestra la pieza con un enlace a esa categoría del comparador. */
import * as THREE from "./vendor/three.module.min.js";
import { RoundedBoxGeometry } from "./vendor/addons/RoundedBoxGeometry.js";
import { RoomEnvironment } from "./vendor/addons/RoomEnvironment.js";
import { EffectComposer } from "./vendor/addons/EffectComposer.js";
import { RenderPass } from "./vendor/addons/RenderPass.js";
import { UnrealBloomPass } from "./vendor/addons/UnrealBloomPass.js";
import { OutputPass } from "./vendor/addons/OutputPass.js";

const host = document.getElementById("pc3d");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const webglOk = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } };

if (host && webglOk()) start();
else if (host) { host.remove(); document.querySelector(".hero")?.classList.remove("has3d"); }

function start() {
  const label = document.getElementById("pc3d-step"), dots = document.getElementById("pc3d-dots");
  const small = Math.min(innerWidth, innerHeight) < 700;
  let dpr = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 1.05;
  host.prepend(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const rig = new THREE.Group(); scene.add(rig);

  /* ---------- escenario: fondo, reflejos, piso con resplandor, partículas ---------- */
  const tex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  scene.background = tex(16, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#1b1446"); g.addColorStop(0.55, "#0d0b24"); g.addColorStop(1, "#060510"); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.HemisphereLight(0xb9c6ff, 0x140c2e, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 5, 6); scene.add(key);
  const rimL = new THREE.DirectionalLight(0x7f5bff, 2.2); rimL.position.set(-5, 2, -3); scene.add(rimL);
  const rimR = new THREE.DirectionalLight(0x3fb8ff, 1.4); rimR.position.set(5, 1, -4); scene.add(rimR);
  const inside = new THREE.PointLight(0xffffff, 2.4, 3.4, 1.3); inside.position.set(-0.2, 0.2, 0.05); rig.add(inside);
  const rgbLight1 = new THREE.PointLight(0x6a7bff, 0, 3.5, 1.5); rgbLight1.position.set(0.2, 0.5, 0.25); rig.add(rgbLight1);
  const rgbLight2 = new THREE.PointLight(0xd04bff, 0, 3.5, 1.5); rgbLight2.position.set(-0.2, -0.35, 0.3); rig.add(rgbLight2);

  const floorGlow = new THREE.Mesh(new THREE.CircleGeometry(2.6, 64), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
    map: tex(256, 256, (x) => { const g = x.createRadialGradient(128, 128, 8, 128, 128, 128); g.addColorStop(0, "rgba(120,90,255,.55)"); g.addColorStop(0.45, "rgba(70,60,200,.18)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }) }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = -1.16; rig.add(floorGlow);
  const floorShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false,
    map: tex(128, 128, (x) => { const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, "rgba(0,0,0,.8)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }) }));
  floorShadow.rotation.x = -Math.PI / 2; floorShadow.position.y = -1.155; rig.add(floorShadow);

  const dust = (() => { const n = small ? 120 : 220, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - 0.5) * 7; p[i * 3 + 1] = (Math.random() - 0.3) * 4; p[i * 3 + 2] = (Math.random() - 0.5) * 5; }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ size: 0.025, color: 0x9fb4ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending,
      map: tex(32, 32, (x) => { const g2 = x.createRadialGradient(16, 16, 0, 16, 16, 16); g2.addColorStop(0, "rgba(255,255,255,1)"); g2.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g2; x.fillRect(0, 0, 32, 32); }) });
    const pts = new THREE.Points(g, m); scene.add(pts); return pts; })();

  /* ---------- materiales ---------- */
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5, metalness: 0.4, envMapIntensity: 0.5 }, o));
  const mat = {
    frame: M(0x14161f, { metalness: 0.75, roughness: 0.32 }),
    frameEdge: M(0x2a2e3e, { metalness: 0.9, roughness: 0.22 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x9fb3ff, transparent: true, opacity: 0.035, roughness: 0.05, metalness: 0, envMapIntensity: 0.15, depthWrite: false }),
    gun: M(0x2b3042, { metalness: 0.85, roughness: 0.3 }),
    dark: M(0x15171f, { metalness: 0.6, roughness: 0.38 }),
    silver: M(0xdfe5f0, { metalness: 1, roughness: 0.15 }),
    fin: M(0x9aa3b8, { metalness: 0.9, roughness: 0.3 }),
    cable: M(0xf2f4fa, { metalness: 0.1, roughness: 0.55 }),
    tube: M(0x111318, { metalness: 0.2, roughness: 0.6 }),
  };
  const rgb = [];  // materiales que brillan al encender (con su orden para la «ola» de color)
  const glow = (hue, k = 1) => { const m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color().setHSL(hue, 1, 0.55), emissiveIntensity: 0, roughness: 0.35, metalness: 0 });
    m.userData = { hue, k, order: rgb.length }; rgb.push(m); return m; };
  const blades = (hue) => { const m = new THREE.MeshStandardMaterial({ color: 0xdfe4f2, transparent: true, opacity: 0.55, roughness: 0.3, metalness: 0, emissive: new THREE.Color().setHSL(hue, 1, 0.5), emissiveIntensity: 0, depthWrite: false });
    m.userData = { hue, k: 0.35, order: rgb.length }; rgb.push(m); return m; };

  const RB = (w, h, d, m, r = 0.02) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01)), m);
  const B = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  /* ---------- ventilador con aro de luz y aspas translúcidas ---------- */
  const fanBlades = [];
  function fan(r, hue, axis = "z") {
    const g = new THREE.Group();
    const frame = RB(r * 2.1, r * 2.1, r * 0.28, mat.dark, r * 0.2);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 40), M(0x05060a, { roughness: 1, metalness: 0 })); hole.position.z = r * 0.141;
    const hole2 = hole.clone(); hole2.position.z = -r * 0.141; hole2.rotation.y = Math.PI;
    const gm = glow(hue), rg = new THREE.TorusGeometry(r * 0.99, r * 0.045, 8, 56);
    const ring = new THREE.Mesh(rg, gm); ring.position.z = r * 0.15;
    const ring2 = new THREE.Mesh(rg, gm); ring2.position.z = -r * 0.15;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.3, r * 0.3, r * 0.3, 28), M(0x1c1f2a, { metalness: 0.7, roughness: 0.3 })); hub.rotation.x = Math.PI / 2;
    const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.24, 28), glow(hue, 0.6)); cap.position.z = r * 0.152;
    const bl = new THREE.Group(), bm = blades(hue);
    for (let i = 0; i < 9; i++) { const b = B(r * 0.64, r * 0.26, r * 0.02, bm); b.position.x = r * 0.6; b.rotation.y = 0.5; b.rotation.x = 0.12;
      const p = new THREE.Group(); p.add(b); p.rotation.z = (i / 9) * Math.PI * 2; bl.add(p); }
    g.add(frame, hole, hole2, ring, ring2, hub, cap, bl);
    if (axis === "x") g.rotation.y = Math.PI / 2;
    if (axis === "y") g.rotation.x = Math.PI / 2;
    fanBlades.push(bl);
    return g;
  }

  /* ---------- gabinete (siempre visible) ---------- */
  // X = frente(+)/atrás(-) · Y = alto · Z = ancho (el vidrio mira a la cámara, en +Z)
  const W = 2.0, H = 2.2, D = 1.0, t = 0.05;
  const caseG = new THREE.Group();
  caseG.add(at(RB(W, t, D, mat.frame, 0.02), 0, H / 2, 0), at(RB(W, t, D, mat.frame, 0.02), 0, -H / 2, 0));
  caseG.add(at(RB(t, H, D, mat.frame, 0.02), -W / 2, 0, 0), at(RB(W, H, t, mat.frame, 0.02), 0, 0, -D / 2));
  caseG.add(at(B(0.012, H - 0.06, D - 0.06, mat.glass), W / 2, 0, 0));                     // vidrio frontal
  caseG.add(at(B(W - 0.06, H - 0.06, 0.012, mat.glass), 0, 0, D / 2));                       // vidrio lateral
  [[0, H / 2, D / 2, W, 0.04, 0.04], [0, -H / 2, D / 2, W, 0.04, 0.04], [W / 2, 0, D / 2, 0.04, H, 0.04], [W / 2, H / 2, 0, 0.04, 0.04, D], [W / 2, -H / 2, 0, 0.04, 0.04, D]]
    .forEach(([x, y, z, a, b, c]) => caseG.add(at(RB(a, b, c, mat.frameEdge, 0.015), x, y, z)));
  // cubierta de la fuente con línea de luz
  caseG.add(at(RB(W - 0.1, 0.05, D - 0.08, mat.frame, 0.015), 0, -0.6, 0));
  caseG.add(at(RB(0.05, 0.48, D - 0.08, mat.frame, 0.015), W / 2 - 0.3, -0.85, 0));
  caseG.add(at(B(W - 0.6, 0.012, 0.012, glow(0.66, 0.9)), -0.25, -0.575, D / 2 - 0.06));
  [[-0.8, 0.35], [0.8, 0.35], [-0.8, -0.35], [0.8, -0.35]].forEach(([x, z]) => caseG.add(at(RB(0.2, 0.05, 0.14, mat.dark, 0.02), x, -H / 2 - 0.035, z)));
  rig.add(caseG);

  /* ---------- piezas ---------- */
  const back = -D / 2 + t / 2;

  // placa madre con textura de pistas
  const pcbTex = tex(512, 548, (x, w, h) => {
    x.fillStyle = "#121a30"; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#24345f"; x.lineWidth = 2;
    for (let i = 0; i < 90; i++) { let px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py);
      for (let k = 0; k < 4; k++) { if (k % 2) px += (Math.random() - 0.5) * 160; else py += (Math.random() - 0.5) * 160; x.lineTo(px, py); } x.stroke(); }
    x.fillStyle = "rgba(201,168,90,.55)"; for (let i = 0; i < 50; i++) x.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    x.fillStyle = "rgba(220,228,255,.55)"; x.font = "bold 22px sans-serif"; x.fillText("CT-B850 GAMING", 300, 500);
  });
  const mobo = new THREE.Group();
  mobo.add(RB(1.45, 1.55, 0.03, M(0xffffff, { map: pcbTex, roughness: 0.6, metalness: 0.3 }), 0.01));
  mobo.add(at(RB(0.3, 0.3, 0.02, M(0x6b7186, { metalness: 0.8, roughness: 0.3 }), 0.01), -0.05, 0.38, 0.025));      // socket
  mobo.add(at(RB(0.16, 0.5, 0.1, mat.gun, 0.03), -0.5, 0.42, 0.06), at(RB(0.5, 0.14, 0.1, mat.gun, 0.03), -0.12, 0.66, 0.06));  // disipadores VRM
  mobo.add(at(B(0.012, 0.44, 0.012, glow(0.6, 0.8)), -0.42, 0.42, 0.11));
  [0.36, 0.43, 0.5, 0.57].forEach(x => mobo.add(at(B(0.035, 0.62, 0.03, M(0x2c3245)), x, 0.35, 0.03)));          // ranuras RAM
  mobo.add(at(RB(1.0, 0.05, 0.035, M(0x8a92a8, { metalness: 0.9, roughness: 0.25 }), 0.01), -0.1, -0.13, 0.03));  // ranura PCIe (blindada)
  mobo.add(at(RB(0.42, 0.22, 0.06, mat.gun, 0.03), 0.3, -0.5, 0.045));                                             // disipador chipset
  mobo.add(at(B(0.3, 0.012, 0.012, glow(0.78, 0.9)), 0.3, -0.5, 0.08));
  mobo.add(at(RB(0.2, 0.36, 0.08, mat.gun, 0.02), -0.62, 0.1, 0.05));                                              // tapa de puertos
  at(mobo, -0.12, 0.2, back + 0.035);

  // procesador
  const cpu = new THREE.Group();
  cpu.add(RB(0.24, 0.24, 0.02, M(0x1f6a3e, { roughness: 0.5 }), 0.008));
  cpu.add(at(RB(0.2, 0.2, 0.03, mat.silver, 0.02), 0, 0, 0.022));
  at(cpu, -0.17, 0.58, back + 0.08);

  // memorias RAM con barra de luz
  const ram = new THREE.Group();
  [0.36, 0.5].forEach((x, i) => {
    const s = new THREE.Group();
    s.add(at(RB(0.032, 0.6, 0.16, mat.gun, 0.012), 0, 0, 0.08));
    s.add(at(RB(0.036, 0.6, 0.012, mat.silver, 0.005), 0, 0, 0.16));
    s.add(at(RB(0.03, 0.58, 0.05, glow(0.55 + i * 0.12), 0.012), 0, 0, 0.19));
    at(s, x - 0.12, 0.55, 0); ram.add(s);
  });
  at(ram, 0, 0, back + 0.065);

  // SSD M.2 con disipador
  const ssd = new THREE.Group();
  ssd.add(RB(0.42, 0.1, 0.012, M(0x0f3d26), 0.004));
  ssd.add(at(RB(0.4, 0.1, 0.02, mat.gun, 0.008), 0, 0, 0.018));
  ssd.add(at(B(0.3, 0.008, 0.004, glow(0.5, 0.6)), 0, 0.03, 0.03));
  at(ssd, -0.1, 0.06, back + 0.06);

  // refrigeración líquida: bomba sobre el procesador + caños + radiador arriba con 3 ventiladores
  const aio = new THREE.Group();
  const pumpP = new THREE.Vector3(-0.17, 0.58, back + 0.15);
  const pump = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 40), mat.dark); body.rotation.x = Math.PI / 2; pump.add(body);
  const pr = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.014, 10, 48), glow(0.72)); pr.position.z = 0.052; pump.add(pr);
  const pd = new THREE.Mesh(new THREE.CircleGeometry(0.1, 40), M(0x0b0c12, { metalness: 1, roughness: 0.08, envMapIntensity: 1.6 })); pd.position.z = 0.053; pump.add(pd);
  const pl = new THREE.Mesh(new THREE.RingGeometry(0.035, 0.05, 6), glow(0.62, 1.2)); pl.position.z = 0.055; pump.add(pl);
  at(pump, pumpP.x, pumpP.y, pumpP.z); aio.add(pump);
  const rad = new THREE.Group();
  rad.add(RB(1.25, 0.06, 0.32, mat.dark, 0.02));
  for (let i = 0; i < 40; i++) rad.add(at(B(0.004, 0.05, 0.3, mat.fin), -0.6 + i * 0.03, -0.01, 0));
  [-0.4, 0, 0.4].forEach(x => { const f = fan(0.19, 0.65 + x * 0.1, "y"); at(f, x, -0.1, 0); rad.add(f); });
  at(rad, -0.05, H / 2 - 0.1, 0.02); aio.add(rad);
  [[-0.03, 0.04], [0.03, -0.04]].forEach(([dx, dz]) => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(pumpP.x + 0.12, pumpP.y + 0.04 + dx, pumpP.z + dz), new THREE.Vector3(0.12, 0.72, 0.15 + dz), new THREE.Vector3(0.5, 0.9, 0.12 + dz), new THREE.Vector3(0.55, H / 2 - 0.16, 0.02 + dz)]);
    aio.add(new THREE.Mesh(new THREE.TubeGeometry(c, 48, 0.022, 10, false), mat.tube));
  });

  // placa de video en montaje vertical (mira al vidrio) con 3 ventiladores
  const gpu = new THREE.Group();
  gpu.add(RB(1.35, 0.56, 0.12, mat.gun, 0.04));                                                       // carcasa
  gpu.add(at(RB(1.37, 0.58, 0.02, mat.dark, 0.02), 0, 0, -0.07));                                     // placa trasera
  [[-0.2, 0.22, 0.4], [0.32, -0.22, 0.5]].forEach(([x, y, w]) => gpu.add(at(RB(w, 0.025, 0.02, mat.silver, 0.01), x, y, 0.065)));   // detalles
  [-0.43, 0, 0.43].forEach(x => { const f = fan(0.19, 0.74 + x * 0.12, "z"); at(f, x, 0, 0.05); gpu.add(f); });
  gpu.add(at(RB(1.2, 0.02, 0.03, glow(0.8), 0.01), 0, 0.29, 0.03));                                  // barra de luz superior
  gpu.add(at(RB(0.06, 0.62, 0.16, mat.silver, 0.01), -0.7, 0, 0));                                   // chapa de conectores
  at(gpu, -0.07, -0.26, 0.2);

  // fuente (en el compartimento)
  const psu = new THREE.Group();
  psu.add(RB(0.76, 0.38, 0.62, M(0x1b1e29, { metalness: 0.7, roughness: 0.35 }), 0.03));
  const pf = fan(0.15, 0.58, "z"); at(pf, 0, 0, 0.32); psu.add(pf);
  psu.add(at(B(0.5, 0.01, 0.01, glow(0.56, 0.8)), 0, 0.17, 0.315));
  at(psu, -0.52, -0.86, 0);

  // ventiladores del gabinete: 3 al frente + 1 atrás
  const caseFans = new THREE.Group();
  [0.6, 0.12, -0.36].forEach((y, i) => { const f = fan(0.2, 0.6 + i * 0.08, "x"); at(f, W / 2 - 0.1, y, 0); caseFans.add(f); });
  const rf = fan(0.19, 0.85, "x"); at(rf, -W / 2 + 0.1, 0.55, 0.06); caseFans.add(rf);

  // cables mallados (blancos): 24 pines, CPU y placa de video
  const cables = new THREE.Group();
  const strands = (pts, n, gap, axis) => { for (let i = 0; i < n; i++) { const o = (i - (n - 1) / 2) * gap;
    const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0] + (axis === "x" ? o : 0), p[1] + (axis === "y" ? o : 0), p[2] + (axis === "z" ? o : 0))));
    cables.add(new THREE.Mesh(new THREE.TubeGeometry(c, 32, 0.008, 6, false), mat.cable)); } };
  const z0 = back + 0.08;
  strands([[0.66, -0.58, z0 + 0.1], [0.72, -0.4, z0 + 0.08], [0.74, 0.05, z0 + 0.03], [0.64, 0.25, z0]], 10, 0.018, "z");     // 24 pines
  strands([[-0.78, -0.58, z0 + 0.06], [-0.84, 0.2, z0 + 0.02], [-0.72, 0.86, z0]], 4, 0.018, "z");                          // CPU
  strands([[0.22, -0.58, 0.18], [0.28, -0.4, 0.2], [0.3, -0.02, 0.2]], 6, 0.018, "x");                                    // placa de video

  /* ---------- guion ---------- */
  const STEPS = [
    { o: mobo, name: "Placa madre", cat: "motherboards", from: [0, 0.1, 1.8], rot: [0, 0.8, 0] },
    { o: cpu, name: "Procesador", cat: "procesadores", from: [0, 0.8, 0.9], rot: [0.8, 0, 0.6] },
    { o: ram, name: "Memorias RAM", cat: "memorias-ram", from: [0, 1.1, 0.35], rot: [0, 0, 0] },
    { o: ssd, name: "Disco SSD M.2", cat: "almacenamiento", from: [1.1, -0.1, 0.7], rot: [0, 0, 0.6] },
    { o: aio, name: "Refrigeración líquida", cat: "refrigeracion", from: [0, 1.2, 0.6], rot: [0, 0, 0] },
    { o: gpu, name: "Placa de video", cat: "placas-de-video", from: [1.4, 0.1, 1.2], rot: [0, -0.7, 0] },
    { o: psu, name: "Fuente", cat: "fuentes", from: [-1.6, 0, 0.4], rot: [0, 0.5, 0] },
    { o: caseFans, name: "Ventiladores", cat: "refrigeracion", from: [1.0, 0, 0.9], rot: [0, 0, 0] },
    { o: cables, name: "Cables", cat: null, from: [0, -0.5, 0.8], rot: [0, 0, 0] },
  ];
  const tmpBox = new THREE.Box3();
  STEPS.forEach((s, i) => {
    s.home = s.o.position.clone(); s.homeRot = s.o.rotation.clone();
    rig.add(s.o); s.o.updateMatrixWorld(true);
    s.focus = tmpBox.setFromObject(s.o).getCenter(new THREE.Vector3());
    s.yaw = [0.25, -0.15, 0.3, -0.25, 0.15, 0.05, -0.35, 0.4, 0][i];
    s.o.visible = false;
  });
  if (dots) dots.innerHTML = STEPS.map(() => "<i></i>").join("");

  const STEP = 1.55, IN = 1.0;
  const T_BUILT = (STEPS.length - 1) * STEP + IN;
  const T_ON = T_BUILT + 0.5, T_EXP = T_ON + 6.5, T_COL = T_EXP + 2.2, T_OUT = T_COL + 0.9, LOOP = T_OUT + 0.5;
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const easeOut = x => 1 - Math.pow(1 - x, 3), easeInOut = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const easeBack = x => { const c = 1.4; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  /* onda de luz cuando una pieza se encastra */
  const waves = [];
  for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.18, 48), new THREE.MeshBasicMaterial({ color: 0x9db4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    w.visible = false; rig.add(w); waves.push({ m: w, t: -1 }); }
  let wi = 0;
  const pulse = (p) => { const w = waves[wi++ % waves.length]; w.m.position.copy(p); w.t = 0; w.m.visible = true; };

  /* ---------- etiqueta ---------- */
  let shownKey = null;
  function setLabel(keyS, html, n) {
    if (!label || keyS === shownKey) return; shownKey = keyS; label.innerHTML = html;
    if (dots) [...dots.children].forEach((d, k) => d.classList.toggle("on", k < n));
  }

  /* ---------- cámara: plano general y acercamientos ---------- */
  const baseDir = new THREE.Vector3(0.42, 0.24, 0.88).normalize(), UP = new THREE.Vector3(0, 1, 0), ORIGIN = new THREE.Vector3();
  const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3(0, -0.05, 0), wantPos = new THREE.Vector3(), wantTgt = new THREE.Vector3();
  let wide = 6.2, near = 3.4, composer = null, narrow = false;
  const dirFor = (yaw) => baseDir.clone().applyAxisAngle(UP, yaw);
  camPos.copy(dirFor(0).multiplyScalar(7)).add(camTgt);
  function resize() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); if (composer) composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    wide = w / h < 1 ? 7.8 : 6.4; near = w / h < 1 ? 4.6 : 3.6; narrow = w < 480; shownKey = null;
  }

  /* ---------- posprocesado: brillo del RGB ---------- */
  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.86));
    composer.addPass(new OutputPass());
    renderer.toneMapping = THREE.ACESFilmicToneMapping;   // OutputPass la aplica al final
  } catch (e) { composer = null; renderer.toneMapping = THREE.ACESFilmicToneMapping; }
  new ResizeObserver(resize).observe(host); resize();

  /* ---------- arrastrar para girar ---------- */
  let drag = null, userYaw = 0, userPitch = 0, lastUser = -10;
  host.addEventListener("pointerdown", e => { if (e.target.closest("a")) return; drag = { x: e.clientX, y: e.clientY, yaw: userYaw, pitch: userPitch }; host.setPointerCapture(e.pointerId); });
  host.addEventListener("pointermove", e => { if (!drag) return; userYaw = drag.yaw + (e.clientX - drag.x) * 0.008; userPitch = clamp(drag.pitch + (e.clientY - drag.y) * 0.005, -0.3, 0.3); lastUser = clock.elapsedTime; });
  const endDrag = () => { drag = null; }; host.addEventListener("pointerup", endDrag); host.addEventListener("pointercancel", endDrag);

  /* ---------- un instante de la animación ---------- */
  const startAt = parseFloat(new URLSearchParams(location.search).get("t3d")) || 0;   // ?t3d=12 salta a ese segundo (para revisar)
  let tAnim = reduce ? T_ON + 2.5 : startAt;
  const arrived = new Set();

  function pose(tt) {
    const exp = tt > T_EXP ? easeInOut(clamp((tt - T_EXP) / 1.1)) * (1 - easeInOut(clamp((tt - T_EXP - 1.6) / 0.6))) : 0;   // vista explotada (va y vuelve)
    const out = tt > T_COL ? clamp((tt - T_COL) / (T_OUT - T_COL)) : 0;                                                      // se desvanece y reinicia
    if (tt < 0.1) arrived.clear();
    let cur = -1;
    STEPS.forEach((s, i) => {
      const t0 = i * STEP, k = clamp((tt - t0) / IN);
      s.o.visible = tt >= t0 && out < 1;
      if (!s.o.visible) return;
      if (tt < T_ON) cur = i;
      if (k >= 0.92 && !arrived.has(i) && tt < T_ON && !reduce) { arrived.add(i); pulse(s.focus); }
      const f = (1 - easeBack(k)) + exp * 0.45;          // 1 = lejos · 0 = en su lugar
      s.o.position.set(s.home.x + s.from[0] * f, s.home.y + s.from[1] * f, s.home.z + s.from[2] * f);
      s.o.rotation.set(s.homeRot.x + s.rot[0] * f, s.homeRot.y + s.rot[1] * f, s.homeRot.z + s.rot[2] * f);
      const sc = (0.7 + 0.3 * clamp(easeOut(k) * 1.15)) * (1 - easeInOut(clamp(out * 1.6 - (STEPS.length - 1 - i) * 0.06)));
      s.o.scale.setScalar(Math.max(sc, 0.0001));
    });
    // encendido: ola de color de atrás hacia adelante
    const onT = tt - T_ON, off = out > 0 ? 1 - out : 1;
    rgb.forEach(m => { const u = m.userData; const a = onT < 0 ? 0 : clamp((onT - (u.order / rgb.length) * 1.1) / 0.35); m.emissiveIntensity = a * off * 2.0 * u.k; });
    const on = onT < 0 ? 0 : clamp(onT / 1.4) * off;
    rgbLight1.intensity = on * 2.2; rgbLight2.intensity = on * 1.8;
    // cámara: se acerca a la pieza que se instala; después, plano general
    if (tt < T_ON && cur >= 0) { const s = STEPS[cur]; wantTgt.copy(s.focus).lerp(ORIGIN, 0.35); wantPos.copy(dirFor(s.yaw).multiplyScalar(near)).add(wantTgt); }
    else { wantTgt.set(0, -0.05, 0); wantPos.copy(dirFor(Math.sin(tt * 0.35) * 0.35).multiplyScalar(wide * (1 + exp * 0.12))).add(wantTgt); }
    // etiqueta
    if (tt < T_ON && cur >= 0) { const s = STEPS[cur];
      setLabel("s" + cur, `<span class="n">Paso ${cur + 1} de ${STEPS.length}</span><b>${s.name}</b>${s.cat ? `<a href="productos.html?cat=${s.cat}">Ver precios →</a>` : `<a href="armado.html">Armado de PC →</a>`}`, cur + 1); }
    else if (exp > 0.05 && out === 0) setLabel("exp", `<span class="n">Vista explotada</span><b>${narrow ? "Todas compatibles" : "Todas las piezas, compatibles"}</b><a href="armado.html">Armá la tuya →</a>`, STEPS.length);
    else if (out === 0) setLabel("on", `<span class="n">Lista</span><b>${narrow ? "¡Encendida!" : "¡PC armada y encendida!"}</b><a href="armado.html">${narrow ? "Armá la tuya →" : "Armá la tuya con precios reales →"}</a>`, STEPS.length);
    else setLabel("", "", 0);
    return on;
  }

  /* ---------- bucle ---------- */
  const clock = new THREE.Clock();
  let running = false, raf = 0, slow = 0, frames = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), now = clock.elapsedTime;
    if (!reduce) tAnim = (tAnim + dt) % LOOP;
    const on = pose(tAnim);
    const hs = now * 0.07;
    rgb.forEach(m => m.emissive.setHSL((m.userData.hue + hs + m.userData.order * 0.004) % 1, 1, 0.55));
    fanBlades.forEach((b, i) => { b.rotation.z += dt * (1 + on * (16 + (i % 3) * 2)); });
    waves.forEach(w => { if (w.t < 0) return; w.t += dt; const k = w.t / 0.5; if (k >= 1) { w.t = -1; w.m.visible = false; return; }
      w.m.scale.setScalar(0.5 + easeOut(k) * 1.4); w.m.material.opacity = (1 - k) * (1 - k) * 0.4; w.m.quaternion.copy(camera.quaternion); });
    dust.rotation.y = now * 0.02; dust.position.y = Math.sin(now * 0.3) * 0.05;
    const idle = now - lastUser > 2.5;
    if (idle && !drag) { userYaw *= 0.96; userPitch *= 0.96; }
    const s = 1 - Math.exp(-dt * (reduce ? 50 : 2.4));
    camPos.lerp(wantPos, s); camTgt.lerp(wantTgt, s);
    rig.rotation.y = userYaw - 0.12; rig.rotation.x = userPitch;
    rig.position.y = reduce ? 0 : Math.sin(now * 0.9) * 0.02;
    camera.position.copy(camPos); camera.lookAt(camTgt);
    if (composer) composer.render(); else renderer.render(scene, camera);
    // si el equipo no da abasto: sin brillo y menos resolución (se decide en los primeros segundos)
    if (++frames > 30 && frames < 240 && !/hq/.test(location.search)) { if (dt > 1 / 28) slow++; if (slow > 60 && composer) { composer = null; dpr = Math.min(dpr, 1); renderer.setPixelRatio(dpr); resize(); } }
  }
  function play() { if (running) return; running = true; clock.getDelta(); frame(); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const vis = { inView: true };
  new IntersectionObserver(es => { vis.inView = es[0].isIntersecting; vis.inView && !document.hidden ? play() : stop(); }, { threshold: 0.05 }).observe(host);
  document.addEventListener("visibilitychange", () => { document.hidden || !vis.inView ? stop() : play(); });
  host.classList.add("ready");
  play();
}
