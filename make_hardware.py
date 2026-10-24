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
    ("rtx-4060ti", "GeForce RTX 4060 Ti 8GB", "NVIDIA", 8, 160, 550, (88.0, 58.9, 23.9), None, "nvidia", r"rtx[ -]?4060[ -]?ti", r"16 ?gb"),
    ("rtx-4060", "GeForce RTX 4060", "NVIDIA", 8, 115, 550, (71.5, 47.6, 17.4), None, "nvidia", r"rtx[ -]?4060", r"ti"),
    ("rtx-3090ti", "GeForce RTX 3090 Ti", "NVIDIA", 24, 450, 850, (131.7, 99.9, 59.3), None, "nvidia", r"rtx[ -]?3090[ -]?ti", ""),
    ("rtx-3090", "GeForce RTX 3090", "NVIDIA", 24, 350, 750, (122.9, 91.5, 53.1), None, "nvidia", r"rtx[ -]?3090", r"ti"),
    ("rtx-3080ti", "GeForce RTX 3080 Ti", "NVIDIA", 12, 350, 750, (119.6, 89.1, 51.0), None, "nvidia", r"rtx[ -]?3080[ -]?ti", ""),
    ("rtx-3080", "GeForce RTX 3080", "NVIDIA", 10, 320, 750, (111.6, 82.0, 43.9), None, "nvidia", r"rtx[ -]?3080", r"ti"),
    ("rtx-3070ti", "GeForce RTX 3070 Ti", "NVIDIA", 8, 290, 750, (94.6, 66.9, 26.0), None, "nvidia", r"rtx[ -]?3070[ -]?ti", ""),
    ("rtx-3070", "GeForce RTX 3070", "NVIDIA", 8, 220, 650, (87.2, 58.2, 26.2), None, "nvidia", r"rtx[ -]?3070", r"ti"),
    ("rtx-3060ti", "GeForce RTX 3060 Ti", "NVIDIA", 8, 200, 600, (74.2, 51.0, 19.4), None, "nvidia", r"rtx[ -]?3060[ -]?ti", ""),
    ("rtx-3060", "GeForce RTX 3060 12GB", "NVIDIA", 12, 170, 550, (61.5, 41.9, 22.2), None, "nvidia", r"rtx[ -]?3060", r"ti"),
    ("rtx-3050", "GeForce RTX 3050", "NVIDIA", 8, 130, 550, (44.6, 29.8, 12.6), None, "nvidia", r"rtx[ -]?3050", ""),
    ("rx-9070xt", "Radeon RX 9070 XT", "AMD", 16, 304, 750, (156.6, 116.5, 65.8), (77.8, 55.5), "amd_gpu", r"rx[ -]?9070[ -]?xt", ""),
    ("rx-9070", "Radeon RX 9070", "AMD", 16, 220, 650, (140.9, 104.0, 57.7), (67.6, 47.6), "amd_gpu", r"rx[ -]?9070", r"xt|gre"),
    ("rx-9060xt-16", "Radeon RX 9060 XT 16GB", "AMD", 16, 160, 450, (98.3, 67.3, 35.2), (45.3, 31.0), "amd_gpu", r"rx[ -]?9060[ -]?xt.*16 ?gb|16 ?gb.*rx[ -]?9060[ -]?xt", ""),
    ("rx-9060xt-8", "Radeon RX 9060 XT 8GB", "AMD", 8, 150, 450, (93.2, 62.5, 29.7), (33.0, 20.2), "amd_gpu", r"rx[ -]?9060[ -]?xt.*\b8 ?gb|\b8 ?gb.*rx[ -]?9060[ -]?xt", ""),
    ("rx-7900xtx", "Radeon RX 7900 XTX", "AMD", 24, 355, 800, (161.5, 122.3, 70.6), None, "amd_gpu", r"rx[ -]?7900[ -]?xtx", ""),
    ("rx-7900xt", "Radeon RX 7900 XT", "AMD", 20, 315, 750, (145.4, 108.0, 59.8), None, "amd_gpu", r"rx[ -]?7900[ -]?xt", r"xtx"),
    ("rx-7800xt", "Radeon RX 7800 XT", "AMD", 16, 263, 700, (118.4, 84.7, 45.1), None, "amd_gpu", r"rx[ -]?7800[ -]?xt", ""),
    ("rx-7700xt", "Radeon RX 7700 XT", "AMD", 12, 245, 700, (102.9, 72.7, 38.0), None, "amd_gpu", r"rx[ -]?7700[ -]?xt", ""),
    ("rx-7600", "Radeon RX 7600", "AMD", 8, 165, 550, (69.9, 45.4, 18.4), None, "amd_gpu", r"rx[ -]?7600", r"xt"),
    ("rx-6600", "Radeon RX 6600", "AMD", 8, 132, 450, (51.9, 24.8, 14.5), None, "amd_gpu", r"rx[ -]?6600", r"xt"),
    ("rx-6950xt", "Radeon RX 6950 XT", "AMD", 16, 335, 850, (123.3, 89.5, 48.3), None, "amd_gpu", r"rx[ -]?6950[ -]?xt", ""),
    ("rx-6900xt", "Radeon RX 6900 XT", "AMD", 16, 300, 850, (117.1, 83.9, 44.9), None, "amd_gpu", r"rx[ -]?6900[ -]?xt", ""),
    ("rx-6800xt", "Radeon RX 6800 XT", "AMD", 16, 300, 750, (111.8, 79.6, 42.2), None, "amd_gpu", r"rx[ -]?6800[ -]?xt", ""),
    ("rx-6750xt", "Radeon RX 6750 XT", "AMD", 12, 250, 650, (83.2, 57.6, 29.6), None, "amd_gpu", r"rx[ -]?6750[ -]?xt", ""),
    ("rx-6700xt", "Radeon RX 6700 XT", "AMD", 12, 230, 650, (79.2, 54.3, 28.0), None, "amd_gpu", r"rx[ -]?6700[ -]?xt", ""),
    ("rx-6650xt", "Radeon RX 6650 XT", "AMD", 8, 180, 500, (64.3, 38.0, 19.0), None, "amd_gpu", r"rx[ -]?6650[ -]?xt", ""),
    ("rx-6600xt", "Radeon RX 6600 XT", "AMD", 8, 160, 500, (62.7, 40.7, 17.3), None, "amd_gpu", r"rx[ -]?6600[ -]?xt", ""),
    ("arc-b580", "Intel Arc B580", "Intel", 12, 190, 600, (71.5, 50.7, 27.6), (34.9, 23.1), "intel_gpu", r"arc[ -]?b580", ""),
]

# id, nombre, fabricante, socket, memoria, potencia base/TDP (W), potencia máxima (W), puntaje juegos o None, fuente, regex
# potencia máxima: Intel = "Maximum Turbo Power" (Intel ARK). AMD = TDP x 1,35 (límite PPT estándar de AMD, estimado).
C = [
    # --- AMD AM5 ---
    ("r7-9850x3d", "Ryzen 7 9850X3D", "AMD", "AM5", "DDR5", 120, 162, 100.0, "amd_cpu", r"9850x3d"),
    ("r9-9950x3d", "Ryzen 9 9950X3D", "AMD", "AM5", "DDR5", 170, 230, 95.7, "amd_cpu", r"9950x3d"),
    ("r7-9800x3d", "Ryzen 7 9800X3D", "AMD", "AM5", "DDR5", 120, 162, 97.0, "amd_cpu", r"9800x3d"),
    ("r9-9900x3d", "Ryzen 9 9900X3D", "AMD", "AM5", "DDR5", 120, 162, 86.9, "amd_cpu", r"9900x3d"),
    ("r7-7800x3d", "Ryzen 7 7800X3D", "AMD", "AM5", "DDR5", 120, 162, 85.6, "amd_cpu", r"7800x3d"),
    ("r9-7950x3d", "Ryzen 9 7950X3D", "AMD", "AM5", "DDR5", 120, 162, 83.9, "amd_cpu", r"7950x3d"),
    ("r9-7900x3d", "Ryzen 9 7900X3D", "AMD", "AM5", "DDR5", 120, 162, 77.1, "amd_cpu", r"7900x3d"),
    ("r9-9950x", "Ryzen 9 9950X", "AMD", "AM5", "DDR5", 170, 230, 76.9, "amd_cpu", r"9950x(?!3d)"),
    ("r9-9900x", "Ryzen 9 9900X", "AMD", "AM5", "DDR5", 120, 162, 73.9, "amd_cpu", r"9900x(?!3d)"),
    ("r9-7950x", "Ryzen 9 7950X", "AMD", "AM5", "DDR5", 170, 230, 71.0, "amd_cpu", r"7950x(?!3d)"),
    ("r9-7900x", "Ryzen 9 7900X", "AMD", "AM5", "DDR5", 170, 230, 69.2, "amd_cpu", r"7900x(?![t3])"),
    ("r7-9700x", "Ryzen 7 9700X", "AMD", "AM5", "DDR5", 65, 88, 72.6, "amd_cpu", r"9700x"),
    ("r5-9600x", "Ryzen 5 9600X", "AMD", "AM5", "DDR5", 65, 88, 72.6, "amd_cpu", r"9600x"),
    ("r7-7700x", "Ryzen 7 7700X", "AMD", "AM5", "DDR5", 105, 142, 70.6, "amd_cpu", r"7700x(?![t3])"),
    ("r5-7600x", "Ryzen 5 7600X", "AMD", "AM5", "DDR5", 105, 142, 67.3, "amd_cpu", r"7600x(?![t3])"),
    ("r5-7600", "Ryzen 5 7600", "AMD", "AM5", "DDR5", 65, 88, 66.7, "amd_cpu", r"(ryzen 5|\br5)[ -]?7600(?![x0-9])"),
    # --- AMD AM4 ---
    ("r7-5800x3d", "Ryzen 7 5800X3D", "AMD", "AM4", "DDR4", 105, 142, 66.9, "amd_cpu", r"5800x3d"),
    ("r7-5700x3d", "Ryzen 7 5700X3D", "AMD", "AM4", "DDR4", 105, 142, 63.5, "amd_cpu", r"5700x3d"),
    ("r7-5800xt", "Ryzen 7 5800XT", "AMD", "AM4", "DDR4", 105, 142, 59.3, "amd_cpu", r"5800xt"),
    ("r7-5800x", "Ryzen 7 5800X", "AMD", "AM4", "DDR4", 105, 142, 58.2, "amd_cpu", r"5800x(?![t3])"),
    ("r7-5700x", "Ryzen 7 5700X", "AMD", "AM4", "DDR4", 65, 88, 57.5, "amd_cpu", r"5700x(?![t3])"),
    ("r5-5600x", "Ryzen 5 5600X", "AMD", "AM4", "DDR4", 65, 88, 57.0, "amd_cpu", r"5600x(?!t)"),
    ("r5-5600", "Ryzen 5 5600", "AMD", "AM4", "DDR4", 65, 88, 54.7, "amd_cpu", r"(ryzen 5|\br5)[ -]?5600(?![a-z0-9])"),
    ("r5-5500", "Ryzen 5 5500", "AMD", "AM4", "DDR4", 65, 88, 45.6, "amd_cpu", r"(ryzen 5|\br5)[ -]?5500(?![a-z0-9])"),
    # --- Intel Core Ultra (LGA1851) ---
    ("u9-285k", "Core Ultra 9 285K", "Intel", "LGA1851", "DDR5", 125, 250, 71.8, "intel_cpu", r"285kf?\b"),
    ("u7-265k", "Core Ultra 7 265K", "Intel", "LGA1851", "DDR5", 125, 250, 70.3, "intel_cpu", r"265kf?\b"),
    ("u5-245k", "Core Ultra 5 245K", "Intel", "LGA1851", "DDR5", 125, 159, 67.1, "intel_cpu", r"245kf?\b"),
    ("u5-225f", "Core Ultra 5 225F", "Intel", "LGA1851", "DDR5", 65, 121, 62.5, "intel_cpu", r"ultra ?5.{0,12}\b225f?\b"),
    # --- Intel Core 12.ª a 14.ª (LGA1700) ---
    ("i9-14900k", "Core i9-14900K", "Intel", "LGA1700", "DDR4/DDR5", 125, 253, 78.2, "intel_cpu", r"14900kf?\b"),
    ("i9-13900k", "Core i9-13900K", "Intel", "LGA1700", "DDR4/DDR5", 125, 253, 76.8, "intel_cpu", r"13900kf?\b"),
    ("i7-14700k", "Core i7-14700K", "Intel", "LGA1700", "DDR4/DDR5", 125, 253, 76.4, "intel_cpu", r"14700kf?\b"),
    ("i7-13700k", "Core i7-13700K", "Intel", "LGA1700", "DDR4/DDR5", 125, 253, 75.8, "intel_cpu", r"13700kf?\b"),
    ("i5-14600k", "Core i5-14600K", "Intel", "LGA1700", "DDR4/DDR5", 125, 181, 72.8, "intel_cpu", r"14600kf?\b"),
    ("i5-13600k", "Core i5-13600K", "Intel", "LGA1700", "DDR4/DDR5", 125, 181, 70.9, "intel_cpu", r"13600kf?\b"),
    ("i7-12700k", "Core i7-12700K", "Intel", "LGA1700", "DDR4/DDR5", 125, 190, 65.8, "intel_cpu", r"12700kf?\b"),
    ("i5-12600k", "Core i5-12600K", "Intel", "LGA1700", "DDR4/DDR5", 125, 150, 60.8, "intel_cpu", r"12600kf?\b"),
    ("i5-14400f", "Core i5-14400F", "Intel", "LGA1700", "DDR4/DDR5", 65, 148, 58.0, "intel_cpu", r"14400f?\b"),
    ("i5-13400f", "Core i5-13400F", "Intel", "LGA1700", "DDR4/DDR5", 65, 148, 56.8, "intel_cpu", r"13400f?\b"),
    ("i5-12400f", "Core i5-12400F", "Intel", "LGA1700", "DDR4/DDR5", 65, 117, 47.5, "intel_cpu", r"12400f?\b"),
    ("i3-12100f", "Core i3-12100F", "Intel", "LGA1700", "DDR4/DDR5", 58, 89, None, "intel_cpu", r"12100f?\b"),
]

# Puntajes ESTIMADOS (no figuran en la tabla de Tom's Hardware). Nunca se usan para recomendar una compra:
# solo para evaluar un procesador que la persona YA tiene. Cada uno dice cómo se calculó.
TOM = "Tom's Hardware (jerarquía de CPU, 5-oct-2026)"
TS_B = "TechSpot, repaso de Zen 3 (ene-2026: el 7500F rinde ~17 % más que el 5600X, el 5800XT ~4 % más, el 5600 ~4 % menos y el 12400F con DDR4 ~20 % menos)"
EST = {
    "r5-5600x": ("alta", f"No figura en la tabla de Tom's. Se toma como ancla el Core Ultra 5 225 (62,5 en {TOM}) y se aplica la diferencia con el 5600X que mide TechSpot (ene-2026); el resultado coincide con el cruce por el 7500F y el 12400F con DDR5. Margen aprox. ±3 puntos."),
    "r5-5600": ("alta", "Un 4 % menos que el Ryzen 5 5600X estimado, según TechSpot (ene-2026)."),
    "r7-5800xt": ("alta", "Un 4 % más que el Ryzen 5 5600X estimado, según TechSpot (ene-2026)."),
    "r7-5800x": ("media", "No hay medición propia en nuestras fuentes. Se asume ~2 % por debajo del 5800XT (mismo chip con 200 MHz menos de reloj): es un supuesto nuestro."),
    "r7-5700x": ("baja", "No hay medición en nuestras fuentes. Se asume muy cercano al 5600X/5800X (mismo diseño, 8 núcleos, reloj intermedio): supuesto nuestro."),
    "r7-5800x3d": ("media", "Un 15 % más que el 5800X estimado (TechSpot, abril 2022: promedio de 41 juegos a 1080p con RTX 3090 Ti). Medición vieja y con otra placa: orientativo."),
    "r7-5700x3d": ("baja", "Supuesto nuestro: ~5 % menos que el 5800X3D por menor reloj. No hay medición en nuestras fuentes."),
    "r5-5500": ("baja", "El 5600X rinde entre 15 % y 37 % más según el juego (TechSpot, ene-2026); se toma el punto medio (25 %), por eso el margen es amplio."),
    "r5-7600": ("media", "Se asimila al Ryzen 5 7500F (mismo núcleo y casi el mismo reloj), que TechSpot ubica ~17 % por encima del 5600X estimado. No supera al 7600X medido (67,3)."),
    "r7-9700x": ("media", "No figura en la tabla de Tom's. Se asume igual al 9600X (misma arquitectura y rendimiento en juegos muy parecido): supuesto nuestro."),
    "i5-13400f": ("media", "No figura en la tabla de Tom's. Se asume ~2 % por debajo del i5-14400F medido (mismo diseño, 100 MHz menos): supuesto nuestro."),
    "i5-12400f": ("media", "Con memoria DDR4: el 5600X rinde ~20 % más (TechSpot, ene-2026). Con DDR5 queda cerca del 5600X (~57). Se usa el valor con DDR4, que es el caso más común."),
}


# ---- Placas de generaciones anteriores (rendimiento ESTIMADO) ----
# La tabla actual de Tom's Hardware no las mide. Su tabla heredada (RTX 3090 = 100 %, 9 juegos, Core i9-9900K, sin
# actualizar desde 2022) sí. Se pasa a la escala actual usando la RTX 3060 12GB como ancla común:
#   FPS = FPS_actuales(RTX 3060 12GB) x puntaje_heredado / 54,7
# Control: con esa regla la RTX 3050 da 45,5 FPS a 1080p y la tabla actual mide 44,6 (2 % de diferencia); y la RX 5700 XT
# resulta ~13 % sobre la RTX 2060 Super, igual que lo medido por TechSpot en 2022 (33 juegos a 1440p).
# Nunca se usan para RECOMENDAR una compra: sirven para evaluar la placa que la persona ya tiene.
LEG_ANCHOR = {"score": 54.7, "fps": (61.5, 41.9, 22.2)}
LEG_NOTE = ("No figura en la tabla actual de Tom's Hardware. Se estima escalando su tabla heredada (RTX 3090 = 100 %, 9 juegos, 2022) "
            "con la RTX 3060 12GB como ancla; el control con la RTX 3050 da una diferencia del 2 % a 1080p. A 4K es poco confiable "
            "(la memoria de 6-8 GB limita en juegos nuevos).")
LEG_NOTE_LOWVRAM = " Con solo 4 GB de VRAM puede rendir menos en juegos actuales."
# id, nombre, fabricante, VRAM, consumo W, fuente recomendada W, puntaje heredado, regex, exclusión, (arq, shaders, memoria, bus, Gbps)
LEG = [
    ("rtx-2080ti", "GeForce RTX 2080 Ti", "NVIDIA", 11, 260, 650, 77.4, r"rtx[ -]?2080[ -]?ti", "", ("Turing", 4352, "GDDR6", 352, 14)),
    ("rtx-2080s", "GeForce RTX 2080 SUPER", "NVIDIA", 8, 250, 650, 66.8, r"rtx[ -]?2080[ -]?super", "", ("Turing", 3072, "GDDR6", 256, 15.5)),
    ("rtx-2080", "GeForce RTX 2080", "NVIDIA", 8, 225, 650, 62.5, r"rtx[ -]?2080", r"super|ti\b", ("Turing", 2944, "GDDR6", 256, 14)),
    ("rtx-2070s", "GeForce RTX 2070 SUPER", "NVIDIA", 8, 215, 650, 59.6, r"rtx[ -]?2070[ -]?super", "", ("Turing", 2560, "GDDR6", 256, 14)),
    ("rtx-2070", "GeForce RTX 2070", "NVIDIA", 8, 185, 550, 53.1, r"rtx[ -]?2070", r"super", ("Turing", 2304, "GDDR6", 256, 14)),
    ("rtx-2060s", "GeForce RTX 2060 SUPER", "NVIDIA", 8, 175, 550, 50.6, r"rtx[ -]?2060[ -]?super", "", ("Turing", 2176, "GDDR6", 256, 14)),
    ("rtx-2060", "GeForce RTX 2060", "NVIDIA", 6, 160, 500, 44.9, r"rtx[ -]?2060", r"super", ("Turing", 1920, "GDDR6", 192, 14)),
    ("gtx-1660s", "GeForce GTX 1660 SUPER", "NVIDIA", 6, 125, 450, 37.9, r"gtx[ -]?1660[ -]?super", "", ("Turing", 1408, "GDDR6", 192, 14)),
    ("gtx-1660ti", "GeForce GTX 1660 Ti", "NVIDIA", 6, 120, 450, 37.8, r"gtx[ -]?1660[ -]?ti", "", ("Turing", 1536, "GDDR6", 192, 12)),
    ("gtx-1660", "GeForce GTX 1660", "NVIDIA", 6, 120, 450, 32.8, r"gtx[ -]?1660", r"super|ti\b", ("Turing", 1408, "GDDR5", 192, 8)),
    ("gtx-1650s", "GeForce GTX 1650 SUPER", "NVIDIA", 4, 100, 350, 28.5, r"gtx[ -]?1650[ -]?super", "", ("Turing", 1280, "GDDR6", 128, 12)),
    ("gtx-1650", "GeForce GTX 1650 (GDDR5)", "NVIDIA", 4, 75, 300, 20.9, r"gtx[ -]?1650", r"super|ti\b", ("Turing", 896, "GDDR5", 128, 8)),
    ("gtx-1080ti", "GeForce GTX 1080 Ti", "NVIDIA", 11, 250, 600, 57.8, r"gtx[ -]?1080[ -]?ti", "", ("Pascal", 3584, "GDDR5X", 352, 11)),
    ("gtx-1080", "GeForce GTX 1080", "NVIDIA", 8, 180, 500, 45.2, r"gtx[ -]?1080", r"ti\b", ("Pascal", 2560, "GDDR5X", 256, 10)),
    ("gtx-1070ti", "GeForce GTX 1070 Ti", "NVIDIA", 8, 180, 500, 41.8, r"gtx[ -]?1070[ -]?ti", "", ("Pascal", 2432, "GDDR5", 256, 8)),
    ("gtx-1070", "GeForce GTX 1070", "NVIDIA", 8, 150, 500, 36.7, r"gtx[ -]?1070", r"ti\b", ("Pascal", 1920, "GDDR5", 256, 8)),
    ("gtx-1060", "GeForce GTX 1060 6GB", "NVIDIA", 6, 120, 400, 26.5, r"gtx[ -]?1060", "", ("Pascal", 1280, "GDDR5", 192, 8)),
    ("gtx-1050ti", "GeForce GTX 1050 Ti", "NVIDIA", 4, 75, 300, 16.1, r"gtx[ -]?1050[ -]?ti", "", ("Pascal", 768, "GDDR5", 128, 7)),
    ("rx-5700xt", "Radeon RX 5700 XT", "AMD", 8, 225, 600, 57.0, r"rx[ -]?5700[ -]?xt", "", ("RDNA", 2560, "GDDR6", 256, 14)),
    ("rx-5700", "Radeon RX 5700", "AMD", 8, 185, 550, 51.4, r"rx[ -]?5700", r"xt", ("RDNA", 2304, "GDDR6", 256, 14)),
    ("rx-5600xt", "Radeon RX 5600 XT", "AMD", 6, 150, 450, 46.6, r"rx[ -]?5600[ -]?xt", "", ("RDNA", 2304, "GDDR6", 192, 14)),
    ("rx-5500xt", "Radeon RX 5500 XT 8GB", "AMD", 8, 130, 450, 31.8, r"rx[ -]?5500[ -]?xt", "", ("RDNA", 1408, "GDDR6", 128, 14)),
    ("rx-590", "Radeon RX 590", "AMD", 8, 225, 500, 32.4, r"rx[ -]?590(?!\d)", "", ("Polaris", 2304, "GDDR5", 256, 8)),
    ("rx-580", "Radeon RX 580 8GB", "AMD", 8, 185, 500, 30.9, r"rx[ -]?580(?!\d)", "", ("Polaris", 2304, "GDDR5", 256, 8)),
    ("rx-570", "Radeon RX 570 4GB", "AMD", 4, 150, 450, 25.2, r"rx[ -]?570(?!\d)", "", ("Polaris", 2048, "GDDR5", 256, 7)),
    ("vega-64", "Radeon RX Vega 64", "AMD", 8, 295, 750, 48.4, r"vega[ -]?64", "", ("Vega", 4096, "HBM2", 2048, 1.89)),
    ("vega-56", "Radeon RX Vega 56", "AMD", 8, 210, 650, 42.7, r"vega[ -]?56", "", ("Vega", 3584, "HBM2", 2048, 1.6)),
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
    "rx-6950xt": ("RDNA 2", 5120, "GDDR6", 256, 18), "rx-6900xt": ("RDNA 2", 5120, "GDDR6", 256, 16),
    "rx-6800xt": ("RDNA 2", 4608, "GDDR6", 256, 16), "rx-6750xt": ("RDNA 2", 2560, "GDDR6", 192, 18),
    "rx-6700xt": ("RDNA 2", 2560, "GDDR6", 192, 16), "rx-6650xt": ("RDNA 2", 2048, "GDDR6", 128, 17.5),
    "rx-6600xt": ("RDNA 2", 2048, "GDDR6", 128, 16),
    "arc-b580": ("Xe2 (Battlemage)", 2560, "GDDR6", 192, 19),
}
# CPU: (nucleos, hilos, boost GHz, caché L3 MB, gráficos integrados)
CS = {
    "r7-9850x3d": (8, 16, 5.6, 96, True), "r9-9950x3d": (16, 32, 5.7, 128, True), "r7-9800x3d": (8, 16, 5.2, 96, True),
    "r9-9900x3d": (12, 24, 5.5, 128, True), "r7-7800x3d": (8, 16, 5.0, 96, True), "r9-7950x3d": (16, 32, 5.7, 128, True),
    "r9-7900x3d": (12, 24, 5.6, 128, True), "r9-9950x": (16, 32, 5.7, 64, True), "r9-9900x": (12, 24, 5.6, 64, True),
    "r9-7950x": (16, 32, 5.7, 64, True), "r9-7900x": (12, 24, 5.6, 64, True), "r7-9700x": (8, 16, 5.5, 32, True),
    "r5-9600x": (6, 12, 5.4, 32, True), "r7-7700x": (8, 16, 5.4, 32, True), "r5-7600x": (6, 12, 5.3, 32, True),
    "r5-7600": (6, 12, 5.1, 32, True),
    "r7-5800x3d": (8, 16, 4.5, 96, False), "r7-5700x3d": (8, 16, 4.1, 96, False), "r7-5800xt": (8, 16, 4.8, 32, False),
    "r7-5800x": (8, 16, 4.7, 32, False), "r7-5700x": (8, 16, 4.6, 32, False), "r5-5600x": (6, 12, 4.6, 32, False),
    "r5-5600": (6, 12, 4.4, 32, False), "r5-5500": (6, 12, 4.2, 16, False),
    "u9-285k": (24, 24, 5.7, 36, True), "u7-265k": (20, 20, 5.5, 30, True), "u5-245k": (14, 14, 5.2, 24, True),
    "u5-225f": (10, 10, 4.9, 20, False),
    "i9-14900k": (24, 32, 6.0, 36, True), "i9-13900k": (24, 32, 5.8, 36, True), "i7-14700k": (20, 28, 5.6, 33, True),
    "i7-13700k": (16, 24, 5.4, 30, True), "i5-14600k": (14, 20, 5.3, 24, True), "i5-13600k": (14, 20, 5.1, 24, True),
    "i7-12700k": (12, 20, 5.0, 25, True), "i5-12600k": (10, 16, 4.9, 20, True),
    "i5-14400f": (10, 16, 4.7, 20, False), "i5-13400f": (10, 16, 4.6, 20, False), "i5-12400f": (6, 12, 4.4, 18, False),
    "i3-12100f": (4, 8, 4.3, 12, False),
}
# Campos comprobados contra la ficha oficial del fabricante (resto = "pendiente de verificar").
# Comprobación completa del 24-oct-2026: cada ficha se leyó y se comparó número por número (ver VURL).
# Correcciones que salieron de esa comprobación: RTX 3080 10 GB 350 -> 320 W, RTX 4060 Ti 8 GB 165 -> 160 W,
# RX 9060 XT 8 GB 160 -> 150 W. No se verificaron (quedan "pendiente"): RTX 20, GTX 16/10, RX 5000, Polaris y Vega
# (NVIDIA y AMD ya no publican la ficha en una página que se pueda leer) ni la velocidad de memoria de las NVIDIA (sus fichas no la publican).
VERIFY_DATE = "2026-10-24"
_NV = "https://www.nvidia.com/en-us/geforce/graphics-cards/"
_AG = "https://www.amd.com/en/products/graphics/desktops/radeon/"
_AC = "https://www.amd.com/en/products/processors/desktops/ryzen/"
_IC = "https://www.intel.com/content/www/us/en/products/sku/"
VURL = {
    "rtx-5090": _NV + "50-series/rtx-5090/", "rtx-5080": _NV + "50-series/rtx-5080/",
    "rtx-5070ti": _NV + "50-series/rtx-5070-family/", "rtx-5070": _NV + "50-series/rtx-5070-family/",
    "rtx-5060ti-16": _NV + "50-series/rtx-5060-family/", "rtx-5060ti-8": _NV + "50-series/rtx-5060-family/", "rtx-5060": _NV + "50-series/rtx-5060-family/",
    "rtx-5050": _NV + "50-series/rtx-5050/", "rtx-4090": _NV + "40-series/rtx-4090/",
    "rtx-4080s": _NV + "40-series/rtx-4080-family/", "rtx-4080": _NV + "40-series/rtx-4080-family/",
    "rtx-4070tis": _NV + "40-series/rtx-4070-family/", "rtx-4070ti": _NV + "40-series/rtx-4070-family/",
    "rtx-4070s": _NV + "40-series/rtx-4070-family/", "rtx-4070": _NV + "40-series/rtx-4070-family/",
    "rtx-4060ti": _NV + "40-series/rtx-4060-4060ti/", "rtx-4060": _NV + "40-series/rtx-4060-4060ti/",
    "rtx-3090ti": _NV + "30-series/rtx-3090-3090ti/", "rtx-3090": _NV + "30-series/rtx-3090-3090ti/",
    "rtx-3080ti": _NV + "30-series/rtx-3080-3080ti/", "rtx-3080": _NV + "30-series/rtx-3080-3080ti/",
    "rtx-3070ti": _NV + "30-series/rtx-3070-3070ti/", "rtx-3070": _NV + "30-series/rtx-3070-3070ti/",
    "rtx-3060ti": _NV + "30-series/rtx-3060-3060ti/", "rtx-3060": _NV + "30-series/rtx-3060-3060ti/", "rtx-3050": _NV + "30-series/rtx-3050/",
    "rx-9070xt": _AG + "9000-series/amd-radeon-rx-9070xt.html", "rx-9070": _AG + "9000-series/amd-radeon-rx-9070.html",
    "rx-9060xt-16": _AG + "9000-series/amd-radeon-rx-9060xt.html", "rx-9060xt-8": _AG + "9000-series/amd-radeon-rx-9060xt-8gb.html",
    "rx-7900xtx": _AG + "7000-series/amd-radeon-rx-7900xtx.html", "rx-7900xt": _AG + "7000-series/amd-radeon-rx-7900xt.html",
    "rx-7800xt": _AG + "7000-series/amd-radeon-rx-7800-xt.html", "rx-7700xt": _AG + "7000-series/amd-radeon-rx-7700-xt.html",
    "rx-7600": _AG + "7000-series/amd-radeon-rx-7600.html",
    "rx-6950xt": _AG + "6000-series/amd-radeon-rx-6950-xt.html", "rx-6900xt": _AG + "6000-series/amd-radeon-rx-6900-xt.html",
    "rx-6800xt": _AG + "6000-series/amd-radeon-rx-6800-xt.html", "rx-6750xt": _AG + "6000-series/amd-radeon-rx-6750-xt.html",
    "rx-6700xt": _AG + "6000-series/amd-radeon-rx-6700-xt.html", "rx-6650xt": _AG + "6000-series/amd-radeon-rx-6650-xt.html",
    "rx-6600xt": _AG + "6000-series/amd-radeon-rx-6600-xt.html", "rx-6600": _AG + "6000-series/amd-radeon-rx-6600.html",
    "arc-b580": _IC + "241598/intel-arc-b580-graphics/specifications.html",
    # CPUs AMD (ficha de producto en amd.com)
    "r7-9850x3d": _AC + "9000-series/amd-ryzen-7-9850x3d.html", "r9-9950x3d": _AC + "9000-series/amd-ryzen-9-9950x3d.html",
    "r7-9800x3d": _AC + "9000-series/amd-ryzen-7-9800x3d.html", "r9-9900x3d": _AC + "9000-series/amd-ryzen-9-9900x3d.html",
    "r9-9950x": _AC + "9000-series/amd-ryzen-9-9950x.html", "r9-9900x": _AC + "9000-series/amd-ryzen-9-9900x.html",
    "r7-9700x": _AC + "9000-series/amd-ryzen-7-9700x.html", "r5-9600x": _AC + "9000-series/amd-ryzen-5-9600x.html",
    "r7-7800x3d": _AC + "7000-series/amd-ryzen-7-7800x3d.html", "r9-7950x3d": _AC + "7000-series/amd-ryzen-9-7950x3d.html",
    "r9-7900x3d": _AC + "7000-series/amd-ryzen-9-7900x3d.html", "r9-7950x": _AC + "7000-series/amd-ryzen-9-7950x.html",
    "r9-7900x": _AC + "7000-series/amd-ryzen-9-7900x.html", "r7-7700x": _AC + "7000-series/amd-ryzen-7-7700x.html",
    "r5-7600x": _AC + "7000-series/amd-ryzen-5-7600x.html", "r5-7600": _AC + "7000-series/amd-ryzen-5-7600.html",
    "r7-5800x3d": _AC + "5000-series/amd-ryzen-7-5800x3d.html", "r7-5800xt": _AC + "5000-series/amd-ryzen-7-5800xt.html",
    "r7-5800x": _AC + "5000-series/amd-ryzen-7-5800x.html", "r5-5600x": _AC + "5000-series/amd-ryzen-5-5600x.html",
    "r7-5700x3d": "https://www.amd.com/en/support/downloads/drivers.html/processors/ryzen/ryzen-5000-series/amd-ryzen-7-5700x3d.html",
    "r7-5700x": "https://www.amd.com/content/dam/amd/en/documents/products/processors/ryzen/5000/amd-ryzen-5000-datasheet.pdf",
    "r5-5600": "https://www.amd.com/content/dam/amd/en/documents/products/processors/ryzen/5000/amd-ryzen-5000-datasheet.pdf",
    "r5-5500": "https://www.amd.com/content/dam/amd/en/documents/products/processors/ryzen/5000/amd-ryzen-5000-datasheet.pdf",
    # CPUs Intel (ficha en intel.com)
    "u9-285k": _IC + "241060/intel-core-ultra-9-processor-285k-36m-cache-up-to-5-70-ghz/specifications.html",
    "u7-265k": _IC + "241063/intel-core-ultra-7-processor-265k-30m-cache-up-to-5-50-ghz/specifications.html",
    "u5-245k": _IC + "241067/intel-core-ultra-5-processor-245k-24m-cache-up-to-5-20-ghz/specifications.html",
    "u5-225f": _IC + "241069/intel-core-ultra-5-processor-225f-20m-cache-up-to-4-90-ghz/specifications.html",
    "i9-14900k": _IC + "236773/intel-core-i9-processor-14900k-36m-cache-up-to-6-00-ghz/specifications.html",
    "i9-13900k": _IC + "230496/intel-core-i913900k-processor-36m-cache-up-to-5-80-ghz/specifications.html",
    "i7-14700k": _IC + "236783/intel-core-i7-processor-14700k-33m-cache-up-to-5-60-ghz/specifications.html",
    "i7-13700k": _IC + "230500/intel-core-i713700k-processor-30m-cache-up-to-5-40-ghz/specifications.html",
    "i5-14600k": _IC + "236799/intel-core-i5-processor-14600k-24m-cache-up-to-5-30-ghz/specifications.html",
    "i5-13600k": _IC + "230493/intel-core-i513600k-processor-24m-cache-up-to-5-10-ghz/specifications.html",
    "i7-12700k": _IC + "134594/intel-core-i712700k-processor-25m-cache-up-to-5-00-ghz/specifications.html",
    "i5-12600k": _IC + "134589/intel-core-i512600k-processor-20m-cache-up-to-4-90-ghz/specifications.html",
    "i5-14400f": _IC + "236777/intel-core-i5-processor-14400f-20m-cache-up-to-4-70-ghz/specifications.html",
    "i5-13400f": _IC + "230501/intel-core-i513400f-processor-20m-cache-up-to-4-60-ghz/specifications.html",
    "i5-12400f": _IC + "134587/intel-core-i512400f-processor-18m-cache-up-to-4-40-ghz/specifications.html",
    "i3-12100f": _IC + "132223/intel-core-i312100f-processor-12m-cache-up-to-4-30-ghz/specifications.html",
}
_GPU_V = ["vram", "tgp", "psu"]
VERIFIED = {}
for _i in GS:
    if _i.startswith(("rtx-50", "rtx-40")):
        VERIFIED[_i] = ["arq", "sp", "mt", "bus"] + _GPU_V
    elif _i.startswith("rtx-30"):
        VERIFIED[_i] = ["sp", "mt", "bus"] + _GPU_V + (["arq"] if _i in ("rtx-3090", "rtx-3090ti") else [])
    elif _i.startswith(("rx-9070", "rx-9060", "rx-79", "rx-78", "rx-77", "rx-76", "rx-66", "rx-67", "rx-68", "rx-69")):
        VERIFIED[_i] = ["sp", "mt", "bus", "gbps"] + _GPU_V
VERIFIED["rx-9070xt"] = ["sp", "mt", "bus", "gbps"] + _GPU_V
for _i in ("rx-7900xtx", "rx-7900xt"):
    VERIFIED[_i] = [f for f in VERIFIED[_i] if f != "bus"]       # la ficha de AMD no publica el bus
VERIFIED["rx-7600"].append("arq")
VERIFIED["arc-b580"] = ["mt", "bus", "gbps"] + _GPU_V
for _c in C:
    _i, _v = _c[0], _c[2]
    _f = ["cores", "threads", "boost", "l3", "tdp"]
    if _v == "AMD":
        _f += ["socket", "mem"] if _i not in ("r7-5700x3d", "r7-5700x", "r5-5600", "r5-5500") else []
        if _i not in ("r7-5700x3d", "r7-5700x", "r5-5600", "r5-5500"): _f.append("igpu")
    else:
        _f.append("maxp")
        if _i not in ("i5-12400f", "i5-13400f", "i5-14400f", "i3-12100f"): _f.append("igpu")
    VERIFIED[_i] = _f
assert set(VURL) >= set(VERIFIED), set(VERIFIED) - set(VURL)


def build():
    assert all(k in {c[0] for c in C} for k in EST), "EST con id inexistente"
    gpus = [dict(id=i, name=n, vendor=v, vram=vr, tgp=t, psu=p, p=list(perf), rt=list(rt) if rt else None, src=s, m=m, x=x)
            for i, n, v, vr, t, p, perf, rt, s, m, x in G]
    cpus = [dict(id=i, name=n, vendor=v, socket=so, mem=me, tdp=td, maxp=mp, s=sc, src=s, m=m)
            for i, n, v, so, me, td, mp, sc, s, m in C]
    for i, n, v, vr, t, p, sc, m, x, spec in LEG:
        k = [round(f * sc / LEG_ANCHOR["score"], 1) for f in LEG_ANCHOR["fps"]]
        gpus.append(dict(id=i, name=n, vendor=v, vram=vr, tgp=t, psu=p, p=k, rt=None, src="nvidia" if v == "NVIDIA" else "amd_gpu", m=m, x=x,
                         se={"conf": "baja" if vr <= 4 else "media", "n": LEG_NOTE + (LEG_NOTE_LOWVRAM if vr <= 4 else "")}))
        GS[i] = spec
    for g in gpus:
        a, sp, mt, bus, gb = GS[g["id"]]
        g["spec"] = dict(arq=a, sp=sp, mt=mt, bus=bus, gbps=gb, bw=round(bus / 8 * gb))
        g["ver"] = VERIFIED.get(g["id"], [])
        if g["ver"]: g["vurl"], g["vdate"] = VURL[g["id"]], VERIFY_DATE
    for c in cpus:
        n, t, b, l3, ig = CS[c["id"]]
        c["spec"] = dict(cores=n, threads=t, boost=b, l3=l3, igpu=ig)
        c["ver"] = VERIFIED.get(c["id"], [])
        if c["ver"]: c["vurl"], c["vdate"] = VURL[c["id"]], VERIFY_DATE
        if c["id"] in EST:
            conf, note = EST[c["id"]]
            c["se"] = {"conf": conf, "n": note}      # puntaje estimado: no figura en la tabla de Tom's
    out = {"sources": SOURCES, "gpus": gpus, "cpus": cpus, "games": GAMES,
           "ref": {"gpu_fps_ref": 203.8, "cpu_score_ref": 97.0,
                   "notas": "FPS de CPU estimado = 203,8 x (puntaje del CPU / 97). Ver README."}}
    path = Path(__file__).parent / "site" / "data" / "hardware.json"
    path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(gpus)} placas, {len(cpus)} procesadores, {len(GAMES)} juegos -> {path}")


if __name__ == "__main__":
    build()
