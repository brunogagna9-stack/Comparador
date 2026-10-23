"""Genera site/data/hardware.json: la base de datos de componentes para la página "Armado de PC".

Todos los números salen de fuentes oficiales o publicadas (ver SOURCES). Para actualizar un dato,
editá este archivo y volvé a correr:  python make_hardware.py

  tgp   = consumo de la placa de video según el fabricante (W)
  psu   = fuente de poder mínima/requerida para el SISTEMA completo según el fabricante (W)
  p     = FPS promedio (1080p / 1440p / 4K, ajustes Ultra, sin upscaling) en el suite de 11 juegos de
          Tom's Hardware, actualizado junio 2026 (probado con un Ryzen 7 9800X3D)
  rt    = FPS promedio con ray tracing (1080p / 1440p) en el suite RT de Tom's Hardware, si existe
  s     = puntaje de juegos del CPU relativo al Ryzen 7 9850X3D (=100), 1080p, 17 juegos, RTX 5090
          (Tom's Hardware, actualizado 5 octubre 2026)
  m / x = expresiones regulares para encontrar el producto en los listados de las tiendas
"""
import json
from pathlib import Path

SOURCES = {
    "nvidia": "https://www.nvidia.com/en-us/geforce/graphics-cards/compare/",
    "amd_gpu": "https://www.amd.com/en/products/graphics/desktops/radeon.html",
    "intel_gpu": "https://www.intel.com/content/www/us/en/products/sku/241598/intel-arc-b580-graphics/specifications.html",
    "amd_cpu": "https://www.amd.com/en/products/processors/desktops/ryzen.html",
    "intel_cpu": "https://www.intel.com/content/www/us/en/ark.html",
    "tom_gpu": "https://www.tomshardware.com/reviews/gpu-hierarchy,4388.html",
    "tom_cpu": "https://www.tomshardware.com/reviews/cpu-hierarchy,4312.html",
}

# id, nombre, fabricante, VRAM, tgp, psu, (p1080,p1440,p4k), (rt1080,rt1440) o None, fuente, regex, exclusión
G = [
    ("rtx-5090", "GeForce RTX 5090", "NVIDIA", 32, 575, 1000, (203.8, 167.3, 110.8), (125.7, 100.8), "nvidia", r"rtx[ -]?5090", ""),
    ("rtx-5080", "GeForce RTX 5080", "NVIDIA", 16, 360, 850, (166.9, 128.3, 77.4), (98.3, 74.0), "nvidia", r"rtx[ -]?5080", ""),
    ("rtx-5070ti", "GeForce RTX 5070 Ti", "NVIDIA", 16, 300, 750, (155.4, 116.8, 68.6), (90.4, 66.2), "nvidia", r"rtx[ -]?5070[ -]?ti", ""),
    ("rtx-5070", "GeForce RTX 5070", "NVIDIA", 12, 250, 650, (132.6, 96.4, 54.3), (74.1, 51.5), "nvidia", r"rtx[ -]?5070", r"5070[ -]?ti"),
    ("rtx-5060ti-16", "GeForce RTX 5060 Ti 16GB", "NVIDIA", 16, 180, 600, (105.2, 73.4, 40.2), (56.2, 38.9), "nvidia", r"rtx[ -]?5060[ -]?ti.*16 ?gb|16 ?gb.*rtx[ -]?5060[ -]?ti", ""),
    ("rtx-5060ti-8", "GeForce RTX 5060 Ti 8GB", "NVIDIA", 8, 180, 600, (100.4, 68.6, 28.1), None, "nvidia", r"rtx[ -]?5060[ -]?ti.*\b8 ?gb|\b8 ?gb.*rtx[ -]?5060[ -]?ti", ""),
    ("rtx-5060", "GeForce RTX 5060", "NVIDIA", 8, 145, 550, (88.5, 59.8, 21.8), (40.9, 24.6), "nvidia", r"rtx[ -]?5060", r"5060[ -]?ti"),
    ("rtx-5050", "GeForce RTX 5050", "NVIDIA", 8, 130, 550, (69.3, 45.2, 17.0), (31.2, 18.7), "nvidia", r"rtx[ -]?5050", ""),
    ("rtx-4090", "GeForce RTX 4090", "NVIDIA", 24, 450, 850, (183.6, 143.4, 89.1), (112.3, 87.7), "nvidia", r"rtx[ -]?4090", ""),
    ("rtx-4080s", "GeForce RTX 4080 SUPER", "NVIDIA", 16, 320, 750, (158.9, 118.6, 69.4), None, "nvidia", r"rtx[ -]?4080[ -]?super", ""),
    ("rtx-4080", "GeForce RTX 4080", "NVIDIA", 16, 320, 750, (157.3, 117.5, 67.5), None, "nvidia", r"rtx[ -]?4080", r"super"),
    ("rtx-4070tis", "GeForce RTX 4070 Ti SUPER", "NVIDIA", 16, 285, 700, (141.2, 104.0, 58.5), None, "nvidia", r"rtx[ -]?4070[ -]?ti[ -]?super", ""),
    ("rtx-4070ti", "GeForce RTX 4070 Ti", "NVIDIA", 12, 285, 700, (135.1, 97.9, 53.9), None, "nvidia", r"rtx[ -]?4070[ -]?ti", r"super"),
    ("rtx-4070s", "GeForce RTX 4070 SUPER", "NVIDIA", 12, 220, 650, (126.7, 91.2, 49.2), None, "nvidia", r"rtx[ -]?4070[ -]?super", r"ti"),
    ("rtx-4070", "GeForce RTX 4070", "NVIDIA", 12, 200, 650, (111.5, 77.8, 41.3), None, "nvidia", r"rtx[ -]?4070", r"super|ti\b"),
    ("rtx-4060ti", "GeForce RTX 4060 Ti 8GB", "NVIDIA", 8, 165, 550, (88.0, 58.9, 23.9), None, "nvidia", r"rtx[ -]?4060[ -]?ti", r"16 ?gb"),
    ("rtx-4060", "GeForce RTX 4060", "NVIDIA", 8, 115, 550, (71.5, 47.6, 17.4), None, "nvidia", r"rtx[ -]?4060", r"ti"),
    ("rtx-3090ti", "GeForce RTX 3090 Ti", "NVIDIA", 24, 450, 850, (131.7, 99.9, 59.3), None, "nvidia", r"rtx[ -]?3090[ -]?ti", ""),
    ("rtx-3090", "GeForce RTX 3090", "NVIDIA", 24, 350, 750, (122.9, 91.5, 53.1), None, "nvidia", r"rtx[ -]?3090", r"ti"),
    ("rtx-3080ti", "GeForce RTX 3080 Ti", "NVIDIA", 12, 350, 750, (119.6, 89.1, 51.0), None, "nvidia", r"rtx[ -]?3080[ -]?ti", ""),
    ("rtx-3080", "GeForce RTX 3080", "NVIDIA", 10, 350, 750, (111.6, 82.0, 43.9), None, "nvidia", r"rtx[ -]?3080", r"ti"),
    ("rtx-3070ti", "GeForce RTX 3070 Ti", "NVIDIA", 8, 290, 750, (94.6, 66.9, 26.0), None, "nvidia", r"rtx[ -]?3070[ -]?ti", ""),
    ("rtx-3070", "GeForce RTX 3070", "NVIDIA", 8, 220, 650, (87.2, 58.2, 26.2), None, "nvidia", r"rtx[ -]?3070", r"ti"),
    ("rtx-3060ti", "GeForce RTX 3060 Ti", "NVIDIA", 8, 200, 600, (74.2, 51.0, 19.4), None, "nvidia", r"rtx[ -]?3060[ -]?ti", ""),
    ("rtx-3060", "GeForce RTX 3060 12GB", "NVIDIA", 12, 170, 550, (61.5, 41.9, 22.2), None, "nvidia", r"rtx[ -]?3060", r"ti"),
    ("rtx-3050", "GeForce RTX 3050", "NVIDIA", 8, 130, 550, (44.6, 29.8, 12.6), None, "nvidia", r"rtx[ -]?3050", ""),
    ("rx-9070xt", "Radeon RX 9070 XT", "AMD", 16, 304, 750, (156.6, 116.5, 65.8), (77.8, 55.5), "amd_gpu", r"rx[ -]?9070[ -]?xt", ""),
    ("rx-9070", "Radeon RX 9070", "AMD", 16, 220, 650, (140.9, 104.0, 57.7), (67.6, 47.6), "amd_gpu", r"rx[ -]?9070", r"xt|gre"),
    ("rx-9060xt-16", "Radeon RX 9060 XT 16GB", "AMD", 16, 160, 450, (98.3, 67.3, 35.2), (45.3, 31.0), "amd_gpu", r"rx[ -]?9060[ -]?xt.*16 ?gb|16 ?gb.*rx[ -]?9060[ -]?xt", ""),
    ("rx-9060xt-8", "Radeon RX 9060 XT 8GB", "AMD", 8, 160, 450, (93.2, 62.5, 29.7), (33.0, 20.2), "amd_gpu", r"rx[ -]?9060[ -]?xt.*\b8 ?gb|\b8 ?gb.*rx[ -]?9060[ -]?xt", ""),
    ("rx-7900xtx", "Radeon RX 7900 XTX", "AMD", 24, 355, 800, (161.5, 122.3, 70.6), None, "amd_gpu", r"rx[ -]?7900[ -]?xtx", ""),
    ("rx-7900xt", "Radeon RX 7900 XT", "AMD", 20, 315, 750, (145.4, 108.0, 59.8), None, "amd_gpu", r"rx[ -]?7900[ -]?xt", r"xtx"),
    ("rx-7800xt", "Radeon RX 7800 XT", "AMD", 16, 263, 700, (118.4, 84.7, 45.1), None, "amd_gpu", r"rx[ -]?7800[ -]?xt", ""),
    ("rx-7700xt", "Radeon RX 7700 XT", "AMD", 12, 245, 700, (102.9, 72.7, 38.0), None, "amd_gpu", r"rx[ -]?7700[ -]?xt", ""),
    ("rx-7600", "Radeon RX 7600", "AMD", 8, 165, 550, (69.9, 45.4, 18.4), None, "amd_gpu", r"rx[ -]?7600", r"xt"),
    ("rx-6600", "Radeon RX 6600", "AMD", 8, 132, 450, (51.9, 24.8, 14.5), None, "amd_gpu", r"rx[ -]?6600", r"xt"),
    ("arc-b580", "Intel Arc B580", "Intel", 12, 190, 600, (71.5, 50.7, 27.6), (34.9, 23.1), "intel_gpu", r"arc[ -]?b580", ""),
]

# id, nombre, fabricante, socket, memoria, potencia base/TDP (W), potencia máxima (W), puntaje juegos o None, fuente, regex
# potencia máxima: Intel = "Maximum Turbo Power" (Intel ARK). AMD = TDP x 1,35 (límite PPT estándar de AMD, estimado).
C = [
    ("r9-9950x3d", "Ryzen 9 9950X3D", "AMD", "AM5", "DDR5", 170, 230, 95.7, "amd_cpu", r"9950x3d"),
    ("r7-9800x3d", "Ryzen 7 9800X3D", "AMD", "AM5", "DDR5", 120, 162, 97.0, "amd_cpu", r"9800x3d"),
    ("r7-9700x", "Ryzen 7 9700X", "AMD", "AM5", "DDR5", 65, 88, None, "amd_cpu", r"9700x"),
    ("r5-9600x", "Ryzen 5 9600X", "AMD", "AM5", "DDR5", 65, 88, 72.6, "amd_cpu", r"9600x"),
    ("r7-7800x3d", "Ryzen 7 7800X3D", "AMD", "AM5", "DDR5", 120, 162, 85.6, "amd_cpu", r"7800x3d"),
    ("r5-7600", "Ryzen 5 7600", "AMD", "AM5", "DDR5", 65, 88, None, "amd_cpu", r"(ryzen 5|\br5)[ -]?7600(?![x0-9])"),
    ("r7-5800x3d", "Ryzen 7 5800X3D", "AMD", "AM4", "DDR4", 105, 142, None, "amd_cpu", r"5800x3d"),
    ("r5-5600", "Ryzen 5 5600", "AMD", "AM4", "DDR4", 65, 88, None, "amd_cpu", r"(ryzen 5|\br5)[ -]?5600(?![a-z0-9])"),
    ("r5-5500", "Ryzen 5 5500", "AMD", "AM4", "DDR4", 65, 88, None, "amd_cpu", r"(ryzen 5|\br5)[ -]?5500(?![a-z0-9])"),
    ("u9-285k", "Core Ultra 9 285K", "Intel", "LGA1851", "DDR5", 125, 250, 71.8, "intel_cpu", r"285kf?\b"),
    ("u7-265k", "Core Ultra 7 265K", "Intel", "LGA1851", "DDR5", 125, 250, 70.3, "intel_cpu", r"265kf?\b"),
    ("u5-245k", "Core Ultra 5 245K", "Intel", "LGA1851", "DDR5", 125, 159, 67.1, "intel_cpu", r"245kf?\b"),
    ("i7-14700k", "Core i7-14700K", "Intel", "LGA1700", "DDR4/DDR5", 125, 253, 76.4, "intel_cpu", r"14700kf?\b"),
    ("i5-14600k", "Core i5-14600K", "Intel", "LGA1700", "DDR4/DDR5", 125, 181, 72.8, "intel_cpu", r"14600kf?\b"),
    ("i5-13600k", "Core i5-13600K", "Intel", "LGA1700", "DDR4/DDR5", 125, 181, 70.9, "intel_cpu", r"13600kf?\b"),
    ("i5-14400f", "Core i5-14400F", "Intel", "LGA1700", "DDR4/DDR5", 65, 148, 58.0, "intel_cpu", r"14400f?\b"),
    ("i5-13400f", "Core i5-13400F", "Intel", "LGA1700", "DDR4/DDR5", 65, 148, None, "intel_cpu", r"13400f?\b"),
    ("i5-12400f", "Core i5-12400F", "Intel", "LGA1700", "DDR4/DDR5", 65, 117, None, "intel_cpu", r"12400f?\b"),
    ("i3-12100f", "Core i3-12100F", "Intel", "LGA1700", "DDR4/DDR5", 58, 89, None, "intel_cpu", r"12100f?\b"),
]

# Juegos: requisitos oficiales (textuales) y tipo
GAMES = [
    {"id": "lol", "name": "League of Legends", "kind": "ligero",
     "min": "CPU Core i3-530 / FX-4100 · GPU GeForce serie 400 / HD 6570 · 2 GB RAM",
     "rec": "CPU Core i5-8250 / Ryzen 3 1200 · GPU GeForce 560 / Radeon HD 6950 · 4 GB RAM",
     "src": "https://support.riotgames.com/en-us/league-of-legends/performance/minimum-and-recommended-system-requirements-league-of-legends"},
    {"id": "dota2", "name": "Dota 2", "kind": "ligero",
     "min": "CPU doble núcleo 2,8 GHz · GPU GeForce 8600/9600GT · 4 GB RAM",
     "rec": "No publica requisitos recomendados",
     "src": "https://store.steampowered.com/app/570/Dota_2/"},
    {"id": "cs2", "name": "Counter-Strike 2", "kind": "cpu",
     "min": "CPU 4 hilos (Core i5 750 o superior) · GPU DirectX 11 con 1 GB · 8 GB RAM",
     "rec": "No publica requisitos recomendados",
     "src": "https://store.steampowered.com/app/730/CounterStrike_2/"},
    {"id": "aion2", "name": "AION 2", "kind": "mmo",
     "min": "CPU Ryzen 5 2600 / Core i5-10500 · GPU GTX 1050 Ti 4GB / RX 470 4GB · 8 GB RAM · SSD recomendado",
     "rec": "CPU Ryzen 7 3700X / Core i7-11700 · GPU RTX 2070 8GB / RX 5700 XT 8GB · 16 GB RAM · SSD recomendado",
     "src": "https://www.eteknix.com/aion-2-is-coming-to-pc-in-2026-gets-official-pc-requirements/",
     "note": "Requisitos publicados antes del lanzamiento global (2.º semestre 2026): confirmalos en el launcher oficial."},
    {"id": "cp2077", "name": "Cyberpunk 2077", "kind": "pesado",
     "min": "CPU Core i7-6700 / Ryzen 5 1600 · GPU GTX 1060 6GB / RX 580 8GB / Arc A380 · 12 GB RAM · SSD obligatorio",
     "rec": "CPU Core i7-12700 / Ryzen 7 7800X3D · GPU RTX 2060 SUPER / RX 5700 XT / Arc A770 · 16 GB RAM · SSD obligatorio",
     "src": "https://store.steampowered.com/app/1091500/Cyberpunk_2077/"},
    {"id": "wukong", "name": "Black Myth: Wukong", "kind": "pesado",
     "min": "CPU Core i5-8400 / Ryzen 5 1600 · GPU GTX 1060 6GB / RX 580 8GB · 16 GB RAM (con DLSS/FSR)",
     "rec": "CPU Core i7-9700 / Ryzen 5 5500 · GPU RTX 2060 / RX 5700 XT / Arc A750 · 16 GB RAM · SSD obligatorio (con DLSS/FSR)",
     "src": "https://store.steampowered.com/app/2358720/Black_Myth_Wukong/"},
]

# ---- Especificaciones ampliadas (para "Comparar hardware") ----
# GPU: arq = arquitectura, sp = procesadores de sombreado (CUDA / stream), mt = tipo de memoria,
#      bus = ancho de bus (bits), gbps = velocidad de memoria (Gbps por pin). Ancho de banda = bus/8 x gbps.
GS = {
    "rtx-5090": ("Blackwell", 21760, "GDDR7", 512, 28), "rtx-5080": ("Blackwell", 10752, "GDDR7", 256, 30),
    "rtx-5070ti": ("Blackwell", 8960, "GDDR7", 256, 28), "rtx-5070": ("Blackwell", 6144, "GDDR7", 192, 28),
    "rtx-5060ti-16": ("Blackwell", 4608, "GDDR7", 128, 28), "rtx-5060ti-8": ("Blackwell", 4608, "GDDR7", 128, 28),
    "rtx-5060": ("Blackwell", 3840, "GDDR7", 128, 28), "rtx-5050": ("Blackwell", 2560, "GDDR6", 128, 20),
    "rtx-4090": ("Ada Lovelace", 16384, "GDDR6X", 384, 21), "rtx-4080s": ("Ada Lovelace", 10240, "GDDR6X", 256, 23),
    "rtx-4080": ("Ada Lovelace", 9728, "GDDR6X", 256, 22.4), "rtx-4070tis": ("Ada Lovelace", 8448, "GDDR6X", 256, 21),
    "rtx-4070ti": ("Ada Lovelace", 7680, "GDDR6X", 192, 21), "rtx-4070s": ("Ada Lovelace", 7168, "GDDR6X", 192, 21),
    "rtx-4070": ("Ada Lovelace", 5888, "GDDR6X", 192, 21), "rtx-4060ti": ("Ada Lovelace", 4352, "GDDR6", 128, 18),
    "rtx-4060": ("Ada Lovelace", 3072, "GDDR6", 128, 17),
    "rtx-3090ti": ("Ampere", 10752, "GDDR6X", 384, 21), "rtx-3090": ("Ampere", 10496, "GDDR6X", 384, 19.5),
    "rtx-3080ti": ("Ampere", 10240, "GDDR6X", 384, 19), "rtx-3080": ("Ampere", 8704, "GDDR6X", 320, 19),
    "rtx-3070ti": ("Ampere", 6144, "GDDR6X", 256, 19), "rtx-3070": ("Ampere", 5888, "GDDR6", 256, 14),
    "rtx-3060ti": ("Ampere", 4864, "GDDR6", 256, 14), "rtx-3060": ("Ampere", 3584, "GDDR6", 192, 15),
    "rtx-3050": ("Ampere", 2560, "GDDR6", 128, 14),
    "rx-9070xt": ("RDNA 4", 4096, "GDDR6", 256, 20), "rx-9070": ("RDNA 4", 3584, "GDDR6", 256, 20),
    "rx-9060xt-16": ("RDNA 4", 2048, "GDDR6", 128, 20), "rx-9060xt-8": ("RDNA 4", 2048, "GDDR6", 128, 20),
    "rx-7900xtx": ("RDNA 3", 6144, "GDDR6", 384, 20), "rx-7900xt": ("RDNA 3", 5376, "GDDR6", 320, 20),
    "rx-7800xt": ("RDNA 3", 3840, "GDDR6", 256, 19.5), "rx-7700xt": ("RDNA 3", 3456, "GDDR6", 192, 18),
    "rx-7600": ("RDNA 3", 2048, "GDDR6", 128, 18), "rx-6600": ("RDNA 2", 1792, "GDDR6", 128, 14),
    "arc-b580": ("Xe2 (Battlemage)", 2560, "GDDR6", 192, 19),
}
# CPU: (nucleos, hilos, boost GHz, caché L3 MB, gráficos integrados)
CS = {
    "r9-9950x3d": (16, 32, 5.7, 128, True), "r7-9800x3d": (8, 16, 5.2, 96, True), "r7-9700x": (8, 16, 5.5, 32, True),
    "r5-9600x": (6, 12, 5.4, 32, True), "r7-7800x3d": (8, 16, 5.0, 96, True), "r5-7600": (6, 12, 5.1, 32, True),
    "r7-5800x3d": (8, 16, 4.5, 96, False), "r5-5600": (6, 12, 4.4, 32, False), "r5-5500": (6, 12, 4.2, 16, False),
    "u9-285k": (24, 24, 5.7, 36, True), "u7-265k": (20, 20, 5.5, 30, True), "u5-245k": (14, 14, 5.2, 24, True),
    "i7-14700k": (20, 28, 5.6, 33, True), "i5-14600k": (14, 20, 5.3, 24, True), "i5-13600k": (14, 20, 5.1, 24, True),
    "i5-14400f": (10, 16, 4.7, 20, False), "i5-13400f": (10, 16, 4.6, 20, False), "i5-12400f": (6, 12, 4.4, 18, False),
    "i3-12100f": (4, 8, 4.3, 12, False),
}
# Campos comprobados contra la ficha oficial del fabricante (resto = "pendiente de verificar").
# Última comprobación: 22-oct-2026 (NVIDIA compare, AMD RX 9070 XT, AMD Ryzen 5 9600X).
VERIFIED = {i: ["arq", "sp", "mt", "bus"] for i in GS if i.startswith(("rtx-50", "rtx-40"))}
VERIFIED["rx-9070xt"] = ["sp", "mt", "bus", "gbps"]
VERIFIED["r5-9600x"] = ["cores", "threads", "boost", "l3", "igpu"]


def build():
    gpus = [dict(id=i, name=n, vendor=v, vram=vr, tgp=t, psu=p, p=list(perf), rt=list(rt) if rt else None, src=s, m=m, x=x)
            for i, n, v, vr, t, p, perf, rt, s, m, x in G]
    cpus = [dict(id=i, name=n, vendor=v, socket=so, mem=me, tdp=td, maxp=mp, s=sc, src=s, m=m)
            for i, n, v, so, me, td, mp, sc, s, m in C]
    for g in gpus:
        a, sp, mt, bus, gb = GS[g["id"]]
        g["spec"] = dict(arq=a, sp=sp, mt=mt, bus=bus, gbps=gb, bw=round(bus / 8 * gb))
        g["ver"] = VERIFIED.get(g["id"], [])
    for c in cpus:
        n, t, b, l3, ig = CS[c["id"]]
        c["spec"] = dict(cores=n, threads=t, boost=b, l3=l3, igpu=ig)
        c["ver"] = VERIFIED.get(c["id"], [])
    out = {"sources": SOURCES, "gpus": gpus, "cpus": cpus, "games": GAMES,
           "ref": {"gpu_fps_ref": 203.8, "cpu_score_ref": 97.0,
                   "notas": "FPS de CPU estimado = 203,8 x (puntaje del CPU / 97). Ver README."}}
    path = Path(__file__).parent / "site" / "data" / "hardware.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(gpus)} placas, {len(cpus)} procesadores, {len(GAMES)} juegos -> {path}")


if __name__ == "__main__":
    build()
