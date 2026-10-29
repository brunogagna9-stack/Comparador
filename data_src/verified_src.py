"""Tabla verificada a mano (actualización 28): datos de compatibilidad tomados de las fichas OFICIALES de cada fabricante.
Cada entrada lleva la página de la que salió el dato y la fecha de consulta. Se genera site/data/verified.json con:
    python3 data_src/verified_src.py
Reglas: solo páginas oficiales del fabricante (o su tienda oficial); nada de sitios que lo prohíben (PCPartPicker, BuildCores,
TechPowerUp). Si el fabricante publica la ficha por modelo, el patrón agrupa solo variantes del MISMO modelo (color, LCD, ARGB),
que comparten el bloque y los soportes. Los sockets van con el nombre normalizado: AM4, AM5, LGA1200, LGA1700, LGA1851, LGA115x.
"""
import json, re
from pathlib import Path
D = "2026-10-29"
I5 = ["LGA1851", "LGA1700", "LGA1200", "LGA115x", "AM5", "AM4"]      # lo más común en coolers actuales
COOLERS = [
    # ---------------- ASUS / ROG (asus.com, rog.asus.com) ----------------
    dict(name="ASUS ROG Strix LC III", m=r"strix\s?lc\s?(iii|3)\b", type="aio", sockets=I5, src="https://rog.asus.com/us/cooling/cpu-liquid-coolers/rog-strix-lc/rog-strix-lc-iii-240-argb"),
    dict(name="ASUS ROG Strix LC IV", m=r"strix\s?s?lc\s?(iv|4)\b", type="aio", sockets=["LGA1851", "LGA1700", "AM5", "AM4"], src="https://rog.asus.com/cooling/cpu-liquid-coolers/rog-strix-lc/rog-strix-lc-iv-360-argb-lcd"),
    dict(name="ASUS ROG Ryujin III", m=r"ryujin\s?(iii|3)\b", type="aio", sockets=I5, src="https://rog.asus.com/cooling/cpu-liquid-coolers/rog-ryujin/rog-ryujin-iii-360-argb/spec"),
    dict(name="ASUS ROG Ryuo IV", m=r"ryuo\s?(iv|4)\b", type="aio", sockets=I5, src="https://rog.asus.com/cooling/cpu-liquid-coolers/rog-ryuo/rog-ryuo-iv-360-argb"),
    dict(name="ASUS TUF Gaming LC III", m=r"tuf\b.*\blc\s?(iii|3)\b", type="aio", sockets=["LGA1851", "LGA1700", "LGA1200", "AM5", "AM4"], src="https://www.asus.com/motherboards-components/cooling/tuf-gaming/tuf-gaming-lc-iii-360-argb-lcd"),
    dict(name="ASUS Prime LC (240/360 ARGB)", m=r"prime\s?lc\b(?!\s?(ii|2)\b)", type="aio", sockets=I5, src="https://www.asus.com/me-en/motherboards-components/cooling/prime/prime-lc-360-argb-lcd"),
    dict(name="ASUS ROG Ryuo III", m=r"ryuo\s?(iii|3)\b", type="aio", sockets=I5, src="https://rog.asus.com/cooling/cpu-liquid-coolers/rog-ryuo/rog-ryuo-iii-240-argb-model"),
    dict(name="ASUS Prime LC II", m=r"prime\s?s?lc\s?(ii|2)\b", type="aio", sockets=["LGA1851", "LGA1700", "AM5", "AM4"], src="https://www.asus.com/motherboards-components/cooling/prime/prime-lc-ii-360-argb-lcd/techspec"),
    # ---------------- Cooler Master (coolermaster.com: ficha de cada serie y tabla «CPU Compatibility») ----------------
    dict(name="Cooler Master MasterLiquid Atmos II (240/360, LCD, VRM, Pixel)", m=r"atmos\s?(ii|2)\b", type="aio", sockets=I5, src="https://www.coolermaster.com/en-global/products/masterliquid-atmos-ii-series.html"),
    dict(name="Cooler Master MasterLiquid Core Nex (y Digital)", m=r"core\s?nex\b", type="aio", sockets=I5, src="https://www.coolermaster.com/en-global/products/masterliquid-core-nex-series.html"),
    dict(name="Cooler Master MasterLiquid Core II", m=r"masterliquid.*\bcore\s?(ii|2)\b|\b(240|360)l?\s?core\s?(ii|2)\b", type="aio", sockets=I5, src="https://www.coolermaster.com/en-global/products/masterliquid-core-ii-series.html"),
    dict(name="Cooler Master Hyper 212 Spectrum V3", m=r"hyper\s?212\s?spectrum\s?v3", type="aire", h=152, tdp=200, sockets=I5, src="https://www.coolermaster.com/en-global/products/hyper-212-spectrum-v3.html"),
    dict(name="Cooler Master Hyper 212 3DHP", m=r"hyper\s?212\s?3dhp", type="aire", h=158, tdp=230, sockets=I5, src="https://www.coolermaster.com/en-global/products/hyper-212-3dhp-black.html"),
    dict(name="Cooler Master Hyper 612 APEX", m=r"hyper\s?612\s?apex(?!\s?pro)", type="aire", h=159, tdp=260, sockets=I5, src="https://www.coolermaster.com/en-global/products/hyper-612-apex.html"),
    # «Hyper 212 Black Edition» existe en dos versiones (R1 sin LGA1700/AM5 y R2 con LGA1700; el soporte AM5 viene solo en parte
    # de la producción): se dejan solo los sockets que traen las dos.
    dict(name="Cooler Master Hyper 212 Black Edition (R1 o R2)", m=r"hyper\s?212\s?black\s?edition", type="aire", h=159, sockets=["LGA115x", "AM4"], src="https://www.coolermaster.com/en-global/products/hyper-212-black-edition-with-lga1700.html",
         note="sin LGA1700 ni AM5 garantizados: depende de la versión y del lote"),
    # ---------------- Corsair (corsair.com, ficha de cada modelo) ----------------
    dict(name="Corsair NAUTILUS RS (ARGB / LCD)", m=r"nautilus\b(?!\s?(ii|2)\b)", type="aio", sockets=["LGA1851", "LGA1700", "AM5", "AM4"], src="https://www.corsair.com/us/en/p/cpu-coolers/cw-9060092-ww/nautilus-240-rs-argb-liquid-cpu-cooler-cw-9060092-ww"),
    dict(name="Corsair iCUE LINK TITAN RX (RGB / LCD)", m=r"titan\b.*\brx\b|titan\s?(link\s?)?(240|360)\s?rx", type="aio", sockets=["LGA1851", "LGA1700", "AM5", "AM4"], src="https://www.corsair.com/us/en/p/cpu-coolers/cw-9061023-ww/icue-link-titan-360-rx-lcd-liquid-cpu-cooler-cw-9061023-ww"),
    # ---------------- Thermaltake (thermaltake.com) ----------------
    dict(name="Thermaltake LA240 / LA360 ARGB Sync (y -S)", m=r"\bla\s?(240|360)(-s)?\b", type="aio", sockets=I5, src="https://www.thermaltake.com/la360-argb-sync-aio-liquid-cooler.html"),
    dict(name="Thermaltake TH V2 Ultra (EX) ARGB Sync", m=r"\bth\s?(240|280|360|420)\s?v2\s?ultra", type="aio", sockets=I5, src="https://thermaltakeusa.com/products/th360-v2-ultra-ex-argb-sync-all-in-one-liquid-cooler-cl-w415-pl12sw-a"),
    dict(name="Thermaltake UX200 SE ARGB", m=r"\bux\s?200\s?se\b", type="aire", h=156, sockets=I5, src="https://www.thermaltake.com/products/ux200-se-argb-lighting-cpu-cooler"),
    dict(name="Thermaltake ASTRIA 400 ARGB", m=r"astria\s?400", type="aire", h=160, tdp=230, sockets=I5, src="https://thermaltakeusa.com/products/astria-400-argb-lighting-cpu-cooler-cl-p120-ca12sw-a"),
    # ---------------- MSI (msi.com, página «Specification» de cada modelo) ----------------
    dict(name="MSI MAG CORELIQUID E240 / E360", m=r"coreliquid\s?e\s?(240|360)", type="aio", sockets=I5, src="https://www.msi.com/Liquid-Cooling/MAG-CORELIQUID-E360/Specification"),
    dict(name="MSI MAG CORELIQUID A15 240", m=r"coreliquid\s?a15", type="aio", sockets=["LGA1851", "LGA1700", "AM5", "AM4"], src="https://www.msi.com/Liquid-Cooling/MAG-CORELIQUID-A15-240/Specification"),
    dict(name="MSI MAG CORELIQUID A13 240", m=r"coreliquid\s?a13", type="aio", sockets=["LGA1851", "LGA1700", "AM5", "AM4"], src="https://www.msi.com/Liquid-Cooling/MAG-CORELIQUID-A13-240/Specification"),
    dict(name="MSI MAG CORELIQUID I240", m=r"coreliquid\s?i\s?240", type="aio", sockets=I5, src="https://www.msi.com/Liquid-Cooling/MAG-CORELIQUID-I240/Specification"),
    dict(name="MSI MAG CORELIQUID C240", m=r"coreliquid\s?c\s?240", type="aio", sockets=I5, src="https://www.msi.com/Liquid-Cooling/MAG-CORELIQUID-C240/Specification"),
    dict(name="MSI MAG COREFROZR AA13", m=r"corefrozr\s?aa13", type="aire", sockets=["LGA1851", "LGA1700", "AM5", "AM4"], src="https://www.msi.com/Air-Cooling/MAG-COREFROZR-AA13/Specification"),
    # ---------------- Gigabyte (gigabyte.com, pestaña «Specifications») ----------------
    dict(name="Gigabyte AORUS WATERFORCE X II", m=r"waterforce\s?x\s?(ii|2)\b", type="aio", sockets=I5, src="https://www.gigabyte.com/CPU-Cooler/AORUS-WATERFORCE-X-II-240/sp"),
    dict(name="Gigabyte GAMING 360 (GME 360 / 360I)", m=r"gigabyte\b.*\bgaming\b.*\b360\b|gigabyte\b.*\bgme\s?360", type="aio", sockets=I5, src="https://www.gigabyte.com/CPU-Cooler/GIGABYTE-GAMING-360/sp"),
    # ---------------- ID-COOLING (idcooling.com) ----------------
    dict(name="ID-COOLING FROZN A410 SE", m=r"frozn\s?a410\s?se\b", type="aire", h=152, tdp=200, sockets=I5, src="https://www.idcooling.com/product/detail?id=501&name=FROZN%20A410%20SE"),
    dict(name="ID-COOLING FROZN A410 ARGB", m=r"frozn\s?a410\s?argb", type="aire", h=152, tdp=220, sockets=I5, src="https://www.idcooling.com/product/detail?id=417&name=FROZN%20A410%20ARGB"),
    dict(name="ID-COOLING FROZN A620 PRO SE", m=r"frozn\s?a620\s?pro\s?se", type="aire", h=157, tdp=260, sockets=I5, src="https://www.idcooling.com/product/detail?id=496"),
    # ---------------- be quiet! (bequiet.com) ----------------
    dict(name="be quiet! DARK ROCK 5", m=r"dark\s?rock\s?5\b", type="aire", h=161, tdp=210, sockets=I5, src="https://www.bequiet.com/en/cpucooler/5110"),
    dict(name="be quiet! SILENT LOOP 3", m=r"silent\s?loop\s?3\b", type="aio", sockets=I5, src="https://www.bequiet.com/en/watercooler/5398"),
    dict(name="be quiet! PURE LOOP 3", m=r"pure\s?loop\s?3\b(?!.*\bfx\b)", type="aio", sockets=I5, src="https://www.bequiet.com/en/watercooler/6139"),
    dict(name="be quiet! LIGHT LOOP", m=r"light\s?loop\b", type="aio", sockets=I5, src="https://www.bequiet.com/en/watercooler/5186"),
]
CASES = [
    # Formas: lo que dice «Case Supported» / «Motherboard Support» del fabricante. gpu: largo máximo de placa de video CON los
    # ventiladores frontales puestos cuando el fabricante lo distingue (es como viene armado). cpuh: alto máximo de cooler de aire.
    # rad: medidas de radiador que acepta en alguna posición.
    # ---------------- Corsair (corsair.com: ficha «Tech Specs» y tabla de largo máximo de GPU por gabinete) ----------------
    dict(name="Corsair FRAME 4000D", m=r"frame\s?4000d|4000d\s?frame", forms=["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], gpu=405, cpuh=170, rad=[120, 140, 240, 280, 360],
         src="https://www.corsair.com/us/en/p/pc-cases/cc-9011312-ww/frame-4000d-rs-modular-mid-tower-pc-case-cc-9011312-ww"),
    dict(name="Corsair FRAME 5000D", m=r"frame\s?5000d|5000d\s?frame", forms=["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], gpu=425, cpuh=175, rad=[120, 140, 240, 280, 360, 420],
         src="https://www.corsair.com/us/en/p/pc-cases/cc-9011307-ww/frame-5000d-rs-high-airflow-mid-tower-pc-case-cc-9011307-ww"),
    dict(name="Corsair FRAME 4500X", m=r"frame\s?4500x|4500x\s?frame", forms=["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], gpu=460, cpuh=185, rad=[120, 140, 240, 280, 360],
         src="https://www.corsair.com/us/en/p/pc-cases/cc-9011315-ww/frame-4500x-rs-r-argb-panoramic-glass-mid-tower-pc-case-white-cc-9011315-ww"),
    dict(name="Corsair 3200D", m=r"\b3200d\b", forms=["Mini-ITX", "Micro-ATX", "ATX"], gpu=375, cpuh=165, rad=[120, 240, 280, 360],
         src="https://www.corsair.com/uk/en/p/pc-cases/cc-9011344-ww/3200d-rs-argb-mid-tower-pc-case-cc-9011344-ww"),
    dict(name="Corsair 3500X", m=r"\b3500x\b", forms=["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], gpu=425, cpuh=170, rad=[120, 240, 280, 360],
         src="https://www.corsair.com/us/en/p/pc-cases/cc-9011276-ww/3500x-mid-tower-pc-case-cc-9011276-ww"),
    dict(name="Corsair 2500X / 2500D", m=r"\b2500[xd]\b", forms=["Mini-ITX", "Micro-ATX"], gpu=375, cpuh=180, rad=[120, 240, 280, 360],
         src="https://www.corsair.com/eu/en/p/pc-cases/cc-9011265-ww/2500x-mid-tower-dual-chamber-pc-case-black-cc-9011265-ww"),
    dict(name="Corsair AIR 5400", m=r"\bair\s?5400\b", forms=["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], gpu=360, cpuh=180, rad=[120, 240, 360],
         src="https://www.corsair.com/ww/en/p/pc-cases/cc-9011318-ww/air-5400-rs-r-argb-triple-chamber-mid-tower-pc-case-cc-9011318-ww"),
    {"name": "Cooler Master Elite 600", "m": "elite\\s?600\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 425, "cpuh": 160, "rad": [120, 240, 280, 360], "src": "https://www.coolermaster.com/en-global/products/elite-600.html"},
    {"name": "Cooler Master Elite 502 (y Lite)", "m": "elite\\s?502\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], "gpu": 360, "cpuh": 170, "rad": [120, 140, 240, 280, 360, 420], "src": "https://www.coolermaster.com/en-global/products/elite-502.html", "note": "360 mm con el radiador o los ventiladores frontales; 410 mm sin ellos"},
    {"name": "Cooler Master Elite 681", "m": "elite\\s?681\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 410, "cpuh": 160, "rad": [120, 240, 280, 360], "src": "https://www.coolermaster.com/en-global/products/elite-681.html"},
    {"name": "Cooler Master Elite 490", "m": "elite\\s?490\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 425, "cpuh": 170, "rad": [120, 240, 360], "src": "https://www.coolermaster.com/en-global/products/elite-490.html"},
    {"name": "Cooler Master Elite 301", "m": "elite\\s?301\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 340, "cpuh": 163, "rad": [120, 140, 240, 280], "src": "https://www.coolermaster.com/en-global/products/elite-301.html", "note": "el fabricante da 365 mm SIN los 3 ventiladores frontales que trae; se restan 25 mm (su espesor)"},
    {"name": "Cooler Master Elite 302", "m": "elite\\s?302\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 340, "cpuh": 163, "rad": [120, 140, 240, 280, 360], "src": "https://www.coolermaster.com/en-global/products/elite-302.html", "note": "el fabricante da 365 mm SIN los 3 ventiladores frontales que trae; se restan 25 mm (su espesor)"},
    {"name": "Cooler Master MasterBox 600 (y Lite)", "m": "masterbox\\s?600\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], "gpu": 360, "cpuh": 170, "rad": [120, 140, 240, 280, 360, 420], "src": "https://www.coolermaster.com/en-global/products/masterbox-600.html", "note": "360 mm con radiador frontal; 410 mm sin él"},
    {"name": "Cooler Master MasterFrame 600 (y Mesh)", "m": "masterframe\\s?600\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 485, "cpuh": 190, "rad": [120, 140, 240, 280, 360, 420], "src": "https://www.coolermaster.com/en-global/products/masterframe-600-mesh.html"},
    {"name": "Cooler Master MasterFrame 400 Mesh", "m": "masterframe\\s?400\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 390, "cpuh": 190, "rad": [120, 240, 280, 360], "src": "https://www.coolermaster.com/en-in/products/masterframe-400-mesh.html"},
    {"name": "Thermaltake S200 TG ARGB", "m": "\\bs200\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 330, "cpuh": 166, "rad": [120, 140, 240, 280, 360], "src": "https://www.thermaltake.com/s200-tg-argb-mid-tower-chassis.html", "gpurad": 300, "note": "330 mm; 300 mm si se monta un radiador adelante"},
    {"name": "Thermaltake View 200 TG ARGB", "m": "view\\s?200\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 330, "cpuh": 166, "rad": [120, 140, 240, 280, 360], "src": "https://www.thermaltake.com/view-200-tg-snow-argb-mid-tower-chassis.html", "gpurad": 300, "note": "330 mm; 300 mm si se monta un radiador adelante"},
    {"name": "Thermaltake View 170 TG ARGB", "m": "view\\s?170\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 340, "cpuh": 160, "rad": [120, 140, 240, 280], "src": "https://thermaltake.com/products/view-170-tg-argb-micro-chassis"},
    {"name": "Thermaltake View 290 TG ARGB", "m": "view\\s?290\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 450, "cpuh": 180, "rad": [120, 140, 240, 280, 360], "src": "https://file.thermaltake.com/file/qig/View_290_TG_ARGB_Manual.pdf"},
    {"name": "Thermaltake Divider 170 TG ARGB", "m": "divider\\s?170\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 350, "cpuh": 160, "rad": [120, 140, 240, 280], "src": "https://file.thermaltake.com/file/qig/Divider170TGARGB_Manual.pdf"},
    {"name": "XPG VALOR AIR PLUS", "m": "valor\\s?air\\s?plus", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 340, "cpuh": 160, "rad": [120, 240, 360], "src": "https://www.xpg.com/en/xpg/pc-components-valor-air-plus?tab=spec"},
    {"name": "XPG VALOR AIR PRO", "m": "valor\\s?air\\s?pro", "forms": ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], "gpu": 400, "cpuh": 167, "rad": [120, 240, 280, 360], "src": "https://www.xpg.com/us/xpg/pc-components-valor-air-pro?tab=spec"},
    {"name": "XPG VALOR AIR", "m": "valor\\s?air\\b(?!\\s?(plus|pro|nano))", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 305, "cpuh": 166, "rad": [120, 240, 280, 360], "src": "https://www.xpg.com/en/xpg/pc-component-valor-air-compact-mid-tower-chassis?tab=spec"},
    {"name": "XPG VALOR MESH", "m": "valor\\s?mesh\\b(?!\\s?nano)", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 305, "cpuh": 166, "rad": [120, 240, 280, 360], "src": "https://webapi3.adata.com/storage/downloadfile/xpg_valor_mesh_datasheet.pdf"},
    {"name": "XPG LANDER 500", "m": "lander\\s?500\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 340, "cpuh": 160, "rad": [120, 240, 360], "src": "https://www.xpg.com/rs/xpg/pc-components-lander-500?tab=spec"},
    {"name": "Thermaltake The Tower 600", "m": "the\\s?tower\\s?600|\\btt\\b.*tower\\s?600", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 280, "cpuh": 210, "rad": [120, 140, 240, 280, 360, 420], "src": "https://file.thermaltake.com/file/qig/TheTower600_Manual.pdf", "note": "280 mm con la cubierta de la fuente puesta; 400 mm sin ella"},
    {"name": "Thermaltake The Tower 300", "m": "the\\s?tower\\s?300", "gpu": 280, "cpuh": 210, "rad": [120, 140, 240, 280, 360, 420], "src": "https://www.thermaltake.com/the-tower-300-micro-tower-chassis.html", "note": "280 mm con la cubierta de la fuente puesta; 400 mm sin ella"},
    {"name": "Thermaltake View 270 TG ARGB (y Plus)", "m": "view\\s?270\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], "gpu": 420, "cpuh": 180, "rad": [120, 240, 360], "src": "https://thermaltake.com/products/view-270-tg-argb-mid-tower-chassis"},
    {"name": "Thermaltake View 380 TG ARGB", "m": "view\\s?380\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX"], "gpu": 415, "cpuh": 160, "rad": [120, 140, 240, 280, 360], "src": "https://file.thermaltake.com/file/qig/View_380_TG_ARGB_Manual.pdf"},
    {"name": "Thermaltake Ceres 300 TG ARGB", "m": "ceres\\s?300\\b", "forms": ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], "gpu": 370, "cpuh": 185, "rad": [120, 140, 240, 280, 360], "src": "https://thermaltakeusa.com/products/ceres-300-tg-argb-snow-mid-tower-chassis-ca-1y2-00m6wn-00", "gpurad": 340, "note": "370 mm; 340 mm con radiador adelante"},
    {"name": "Gigabyte C102 GLASS (y ICE)", "m": "\\bc102\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 410, "cpuh": 165, "rad": [120, 240, 360], "src": "https://www.gigabyte.com/PC-Case/GB-C102G-GLOBAL/sp"},
    {"name": "MSI MAG FORGE M100A", "m": "forge\\s?m100a", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 300, "cpuh": 160, "rad": [120, 240], "src": "https://www.msi.com/PC-Case/MAG-FORGE-M100A/Specification"},
    {"name": "ASUS ROG Hyperion GR701", "m": "hyperion|gr701", "forms": ["Mini-ITX", "Micro-ATX", "ATX", "E-ATX"], "gpu": 460, "cpuh": 190, "rad": [120, 140, 240, 280, 360, 420], "src": "https://rog.asus.com/us/cases/rog-hyperion-gr701-model/wtb"},
    {"name": "ASUS Prime AP202 (y ARGB)", "m": "\\bap202\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 420, "cpuh": 175, "rad": [360], "src": "https://www.asus.com/motherboards-components/cases/prime/asus-prime-ap202/techspec/"},
    {"name": "ASUS Prime AP201", "m": "\\bap201\\b", "forms": ["Mini-ITX", "Micro-ATX"], "gpu": 338, "cpuh": 170, "rad": [120, 140, 240, 280, 360], "src": "https://www.asus.com/motherboards-components/cases/prime/asus-prime-ap201-microatx-case/techspec"},
]
GPUS = [
    # Largo de la placa (mm) según la ficha del fabricante de la placa, por familia + chip (la familia sola no alcanza: el
    # mismo «VENTUS 2X» mide distinto según el chip). chip = id de la base de hardware del sitio.
    dict(name="MSI RTX 5060 VENTUS 2X", m=r"msi.*ventus\s?2x|ventus\s?2x.*msi", chip="rtx-5060", len=197, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5060-8G-VENTUS-2X-OC/Specification"),
    dict(name="MSI RTX 5060 Ti VENTUS 2X (8 GB)", m=r"msi.*ventus\s?2x|ventus\s?2x.*msi", chip="rtx-5060ti-8", len=227, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-8G-VENTUS-2X-OC-PLUS/Specification"),
    dict(name="MSI RTX 5060 Ti VENTUS 2X (16 GB)", m=r"msi.*ventus\s?2x|ventus\s?2x.*msi", chip="rtx-5060ti-16", len=227, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-16G-VENTUS-2X-OC-PLUS/Specification"),
    dict(name="MSI RTX 5050 VENTUS 2X", m=r"msi.*ventus\s?2x|ventus\s?2x.*msi", chip="rtx-5050", len=197, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5050-8G-VENTUS-2X-OC/Specification"),
    dict(name="MSI RTX 3060 VENTUS 2X 12G", m=r"msi.*ventus\s?2x|ventus\s?2x.*msi", chip="rtx-3060", len=235, src="https://www.msi.com/Graphics-Card/GeForce-RTX-3060-VENTUS-2X-12G-OC/Specification"),
    dict(name="MSI RTX 3050 VENTUS 2X 6G", m=r"msi.*ventus\s?2x|ventus\s?2x.*msi", chip="rtx-3050-6", len=189, src="https://www.msi.com/Graphics-Card/GeForce-RTX-3050-VENTUS-2X-6G-OC/Specification"),
    dict(name="MSI RTX 3050 VENTUS 2X 8G", m=r"msi.*ventus\s?2x|ventus\s?2x.*msi", chip="rtx-3050", len=235, src="https://www.msi.com/Graphics-Card/GeForce-RTX-3050-VENTUS-2X-8G-OC/Specification"),
    dict(name="MSI RTX 5060 SHADOW 2X", m=r"msi.*shadow\s?2x|shadow\s?2x.*msi", chip="rtx-5060", len=197, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5060-8G-SHADOW-2X-OC/Specification"),
    dict(name="ASUS Dual RTX 5060 Ti 16GB (OC y EVO: se toma la más larga)", m=r"asus.*\bdual\b|\bdual-rtx|\bdual-rx", chip="rtx-5060ti-16", len=229, src="https://www.asus.com/motherboards-components/graphics-cards/dual/dual-rtx5060ti-o16g/techspec/"),
    dict(name="ASUS Dual RTX 5060", m=r"asus.*\bdual\b|\bdual-rtx|\bdual-rx", chip="rtx-5060", len=228, src="https://www.asus.com/motherboards-components/graphics-cards/dual/dual-rtx5060-o8g/techspec"),
    dict(name="ASUS Dual RTX 5070", m=r"asus.*\bdual\b|\bdual-rtx|\bdual-rx", chip="rtx-5070", len=249, src="https://www.asus.com/motherboards-components/graphics-cards/dual/dual-rtx5070-o12g/techspec/"),
    dict(name="ASUS Dual RTX 3050 6GB", m=r"asus.*\bdual\b|\bdual-rtx|\bdual-rx", chip="rtx-3050-6", len=201, src="https://www.asus.com/us/motherboards-components/graphics-cards/dual/dual-rtx3050-6g/techspec"),
    dict(name="Gigabyte RTX 5060 Ti EAGLE OC 8G", m=r"gigabyte.*\beagle\b|\beagle\b.*gigabyte", chip="rtx-5060ti-8", len=215, src="https://www.gigabyte.com/Graphics-Card/GV-N506TEAGLE-OC-8GD/sp"),
    dict(name="Gigabyte RTX 5060 EAGLE OC", m=r"gigabyte.*\beagle\b|\beagle\b.*gigabyte", chip="rtx-5060", len=208, src="https://www.gigabyte.com/Graphics-Card/GV-N5060EAGLE-OC-8GD/sp"),
    dict(name="Gigabyte RTX 5070 EAGLE OC SFF", m=r"gigabyte.*\beagle\b|\beagle\b.*gigabyte", chip="rtx-5070", len=290, src="https://www.gigabyte.com/Graphics-Card/GV-N5070EAGLE-OC-12GD/sp"),
    dict(name="Gigabyte RTX 5060 Ti WINDFORCE OC 8G", m=r"gigabyte.*windforce|windforce.*gigabyte|\bwindforce\b", chip="rtx-5060ti-8", len=208, src="https://www.gigabyte.com/Graphics-Card/GV-N506TWF2OC-8GD/sp"),
    dict(name="Gigabyte RTX 5070 WINDFORCE OC SFF", m=r"gigabyte.*windforce|windforce.*gigabyte|\bwindforce\b", chip="rtx-5070", len=282, src="https://www.gigabyte.com/Graphics-Card/GV-N5070WF3OC-12GD/sp"),
    dict(name="Gigabyte RTX 5050 WINDFORCE OC", m=r"gigabyte.*windforce|windforce.*gigabyte|\bwindforce\b", chip="rtx-5050", len=199, src="https://www.gigabyte.com/Graphics-Card/GV-N5050WF2OC-8GD/sp"),
    dict(name="MSI RTX 5060 Ti 8G GAMING TRIO", m=r"msi.*gaming\s?trio|gaming\s?trio.*msi", chip="rtx-5060ti-8", len=300, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5060-Ti-8G-GAMING-TRIO-OC/Specification"),
    dict(name="MSI RTX 5070 Ti GAMING TRIO", m=r"msi.*gaming\s?trio|gaming\s?trio.*msi", chip="rtx-5070ti", len=338, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5070-Ti-16G-GAMING-TRIO-OC/Specification"),
    dict(name="MSI RTX 5070 Ti SHADOW 3X", m=r"msi.*shadow\s?3x|shadow\s?3x.*msi", chip="rtx-5070ti", len=303, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5070-Ti-16G-SHADOW-3X-OC/Specification"),
    dict(name="MSI RTX 5070 Ti VENTUS 3X", m=r"msi.*ventus\s?3x|ventus\s?3x.*msi", chip="rtx-5070ti", len=303, src="https://www.msi.com/Graphics-Card/GeForce-RTX-5070-Ti-16G-VENTUS-3X-OC/Specification"),
    dict(name="ASUS Prime RX 9070 XT", m=r"asus.*\bprime\b|\bprime-rx", chip="rx-9070xt", len=312, src="https://www.asus.com/motherboards-components/graphics-cards/prime/prime-rx9070xt-o16g/techspec"),
    dict(name="Gigabyte RX 9070 XT GAMING OC", m=r"gigabyte.*gaming\s?oc|gaming\s?oc.*gigabyte", chip="rx-9070xt", len=288, src="https://www.gigabyte.com/Graphics-Card/GV-R9070XTGAMING-OC-16GD/sp"),
    dict(name="Sapphire PULSE RX 9070 XT", m=r"sapphire.*\bpulse\b|\bpulse\b.*sapphire", chip="rx-9070xt", len=320, src="https://www.sapphiretech.com/en/consumer/pulse-radeon-rx-9070-xt-16g-gddr6"),
    dict(name="PowerColor Reaper RX 9070 XT (con soporte)", m=r"powercolor.*reaper|reaper.*powercolor", chip="rx-9070xt", len=304, src="https://www.powercolor.com/product-detail212.htm"),
]


def main():
    out = {"v": 1, "updated": D,
           # La placa de video más larga fabricada hasta hoy mide 381 mm (CORSAIR, «Which GPU is the Biggest?», actualizado 23/03/2026):
           # un gabinete que acepta 381 mm o más entra cualquier placa, aunque no tengamos su largo exacto.
           "rules": {"gpu_any": {"len": 381, "src": "https://www.corsair.com/us/en/explorer/diy-builder/blogs/which-gpu-is-the-biggest/", "d": "2026-10-29"}},
           "note": "Datos de compatibilidad tomados a mano de las fichas oficiales de cada fabricante (enlace y fecha en cada entrada).",
           "coolers": [], "cases": [], "gpus": []}
    for key, lst in (("coolers", COOLERS), ("cases", CASES), ("gpus", GPUS)):
        for e in lst:
            re.compile(e["m"], re.I)
            e = dict(e); e.setdefault("d", D)
            out[key].append(e)
    p = Path(__file__).resolve().parent.parent / "site" / "data" / "verified.json"
    p.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
    print(p, {k: len(out[k]) for k in ("coolers", "cases", "gpus")})


if __name__ == "__main__":
    main()
