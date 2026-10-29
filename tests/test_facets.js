// Filtros por categoría de la página Productos (actualización 27). Se ejecuta con: node tests/test_facets.js
const assert = require("assert");
const CT = require("../site/js/lib.js");
const FX = require("../site/js/facets.js");
const HW = require("../site/data/hardware.json");
let n = 0;
const t = (name, fn) => { try { fn(); n++; } catch (e) { console.error("FALLÓ:", name, "\n ", e.message); process.exitCode = 1; } };
const P = (name, category) => ({ id: name, name, category, offers: [] });
FX.init(CT.create(HW, [], {}));
const v = (cat, k, name) => { const d = FX.defs(cat).find(x => x.k === k); assert(d, "no existe el filtro " + cat + ":" + k); return FX.val(P(name, cat), d); };

t("procesadores: serie, socket (dicho o deducido del modelo) y gráficos integrados", () => {
  assert.strictEqual(v("procesadores", "serie", "MICRO AMD RYZEN 5 8600G C/VIDEO C/COOLER BOX AM5"), "Ryzen 5");
  assert.strictEqual(v("procesadores", "socket", "Microprocesador Intel Core I5 13600K"), "LGA1700");
  assert.strictEqual(v("procesadores", "socket", "Procesador AMD Ryzen 7 5700X 4.6Ghz"), "AM4");
  assert.strictEqual(v("procesadores", "socket", "Procesador Intel Core Ultra 5 245K"), "LGA1851");
  assert.strictEqual(v("procesadores", "igpu", "MICRO INTEL CORE I5 12400F S/VIDEO C/COOLER BOX S1700"), "Sin gráficos integrados");
  assert.strictEqual(v("procesadores", "igpu", "Procesador AMD Ryzen 5 8600G"), "Con gráficos integrados");
});
t("placas de video: tipo de memoria del título o de la ficha del fabricante del chip", () => {
  assert.strictEqual(v("placas-de-video", "mem", "Placa de Video MSI RTX 4060 Ventus 8GB GDDR6"), "GDDR6");
  assert.strictEqual(v("placas-de-video", "mem", "Placa De Video Gigabyte RTX 5070 12GB Windforce"), "GDDR7");
  assert.strictEqual(v("placas-de-video", "vram", "Placa De Video Asus Dual RTX 5060 Ti 16GB"), "16 GB");
  assert.strictEqual(v("placas-de-video", "chip", "Placa de video Sapphire Pulse RX 9060 XT 8GB"), "AMD (Radeon)");
});
t("RAM, motherboards y almacenamiento", () => {
  assert.strictEqual(v("memorias-ram", "ddr", "Memoria Kingston Fury Beast 16GB DDR5 5600"), "DDR5");
  assert.strictEqual(v("memorias-ram", "gb", "Memoria Corsair Vengeance 2x16GB DDR5 6000"), "32 GB");
  assert.strictEqual(v("memorias-ram", "fmt", "Memoria Sodimm Kingston 8GB DDR4 3200 Notebook"), "Notebook (SO-DIMM)");
  assert.strictEqual(v("motherboards", "form", "Mother Gigabyte B650M Gaming X AX"), "Micro-ATX");
  assert.strictEqual(v("motherboards", "ddr", "Mother Asus Prime B550M-A"), "DDR4");          // AM4 solo usa DDR4
  assert.strictEqual(v("almacenamiento", "tipo", "Disco Solido SSD 1TB WD Black SN770 NVMe M.2"), "SSD NVMe (M.2)");
  assert.strictEqual(v("almacenamiento", "cap", "Disco Rigido WD Blue 2TB 7200rpm"), "2 TB");
  assert.strictEqual(v("almacenamiento", "tipo", "Pendrive Kingston 64GB USB 3.2"), "Pendrive");
});
t("refrigeración, fuentes y gabinetes", () => {
  assert.strictEqual(v("refrigeracion", "tipo", "WATERCOOLER 360MM COOLERMASTER MASTERLIQUID ML360 CORE II ARGB"), "Líquida (watercooler)");
  assert.strictEqual(v("refrigeracion", "size", "WATERCOOLER 360MM COOLERMASTER MASTERLIQUID ML360"), "360 mm");
  assert.strictEqual(v("refrigeracion", "tipo", "Cooler CPU ID-Cooling FROZN A410 Black"), "Cooler de aire para procesador");
  assert.strictEqual(v("refrigeracion", "tipo", "Kit x3 Cooler Fan Gamemax RB300 ARGB 120mm"), "Ventiladores para gabinete");
  assert.strictEqual(v("fuentes", "w", "Fuente Corsair RM850e 850W 80 Plus Gold ATX 3.1"), "751–850 W");
  assert.strictEqual(v("fuentes", "cert", "Fuente Corsair RM850e 850W 80 Plus Gold"), "80 Plus Gold");
  assert.strictEqual(v("gabinetes", "form", "Gabinete Cooler Master Elite 461 mATX 3 Fans ARGB Negro"), "Micro-ATX");
  assert.strictEqual(v("gabinetes", "form", "Gabinete Cooler Master Masterbox 520 Mesh White Mid Tower Argb"), "ATX (Mid Tower)");
  assert.strictEqual(v("gabinetes", "fans", "Gabinete Corsair 4000X RGB fx3"), "3 ventiladores");
});
t("monitores", () => {
  const n = "Monitor Samsung Odyssey G5 27\" QHD 180Hz IPS 1ms";
  assert.strictEqual(v("monitores", "inch", n), "25–27\"");
  assert.strictEqual(v("monitores", "res", n), "QHD 1440p");
  assert.strictEqual(v("monitores", "hz", n), "180–200 Hz");
  assert.strictEqual(v("monitores", "panel", n), "IPS");
  assert.strictEqual(v("monitores", "ms", n), "1 ms o menos");
});
t("periféricos: el color del teclado no se confunde con el switch", () => {
  assert.strictEqual(v("teclados", "sw", "TECLADO REDRAGON KUMARA K552 WHITE RGB SP SWTICH RED"), "Red");
  assert.strictEqual(v("teclados", "sw", "Teclado Mecanico HyperX Alloy Origins Core (Red)"), "Red");
  assert.strictEqual(v("teclados", "sw", "Teclado Gamer Redragon Eisa Pro K686 White"), null);
  assert.strictEqual(v("teclados", "con", "Teclado Logitech MX Keys Wireless"), "Inalámbrico");
  assert.strictEqual(v("mouses", "con", "Mouse Logitech G305 Lightspeed Inalámbrico"), "Inalámbrico");
  assert.strictEqual(v("auriculares", "con", "Auricular HyperX Cloud III Wireless"), "Inalámbrico");
});
t("notebooks y PC armadas: serie de placa de video legible", () => {
  assert.strictEqual(v("notebooks", "gpu", "Notebook MSI Katana 15 i7 16GB 512GB RTX4060"), "NVIDIA RTX 40xx");
  assert.strictEqual(v("pcs-armadas", "gpu", "PC Gamer Ryzen 5 8600G 16GB 1TB"), "Gráficos integrados");
});
t("sin dato no se inventa y las opciones salen ordenadas", () => {
  assert.strictEqual(v("monitores", "panel", "Monitor Philips 24"), null);
  const d = FX.defs("fuentes").find(x => x.k === "w");
  const o = FX.sortOpts(d, [["Más de 1000 W", 1], [FX.NONE, 9], ["451–550 W", 3], ["Hasta 450 W", 2]]).map(x => x[0]);
  assert.deepStrictEqual(o, ["Hasta 450 W", "451–550 W", "Más de 1000 W", FX.NONE]);
});
t("se dejaron afuera los filtros con muy pocos datos", () => {
  assert(!FX.defs("gabinetes").some(d => /largo|placa de video/i.test(d.l)));
  assert(!FX.defs("refrigeracion").some(d => /socket/i.test(d.l)));
  assert(!FX.defs("monitores").some(d => /LED|LCD/.test(d.l)));
});
console.log(`filtros por categoría: ${n} pruebas OK`);
