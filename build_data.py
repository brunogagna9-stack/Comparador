"""Corre los recolectores, cruza productos entre tiendas y escribe los JSON que lee el sitio.

Uso:  python build_data.py            (todas las tiendas)
      python build_data.py MEXX Logg  (solo algunas)

Archivos que genera en site/data/:
  products.json  un registro por producto con las ofertas de cada tienda
  history.json   historial de precio por oferta (solo se guardan los CAMBIOS de precio)
  meta.json      fecha de actualización y estado de cada tienda
"""
import hashlib
import json
import os
import re
import sys
import time
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "site" / "data"
RAW = ROOT / "raw"
HIST_VERSION = 2
ANOM_DOWN, ANOM_UP = -50, 100  # % de cambio a partir del cual el precio se marca como inusual
RECENT_DAYS = 14  # un cambio de precio se considera "reciente" durante estos días

STOP = {"de", "con", "para", "y", "el", "la", "en", "gb", "tb", "mhz", "ghz", "nucleos", "threads",
        "micro", "placa", "video", "memoria", "ram", "disco", "solido", "ssd", "gaming", "box", "oem",
        "procesador", "motherboard", "mother", "gabinete", "fuente", "monitor", "tray", "kit"}

BRANDS = ["AMD", "Intel", "NVIDIA", "ASUS", "MSI", "Gigabyte", "Aorus", "ASRock", "EVGA", "Zotac", "PNY",
          "Sapphire", "PowerColor", "XFX", "Palit", "Gainward", "Galax", "Colorful", "Corsair", "Kingston", "HyperX",
          "Crucial", "Adata", "XPG", "Patriot", "Team", "TeamGroup", "Lexar", "Samsung", "Western Digital", "WD",
          "Seagate", "Toshiba", "SanDisk", "Netac", "Hiksemi", "Biostar", "Cooler Master", "Thermaltake", "NZXT",
          "Deepcool", "Gamdias", "Aerocool", "Redragon", "Logitech", "Razer", "Genesis", "Fantech", "Noga",
          "Sentey", "Be Quiet", "Seasonic", "Lian Li", "Antec", "Xigmatek", "Gadnic", "LG", "Philips", "AOC",
          "Acer", "Dell", "HP", "Lenovo", "BenQ", "ViewSonic", "Msi", "Teros", "Mexx", "X-Micro", "Hyundai"]
_BRAND_RE = [(b, re.compile(r"(?<![a-z0-9])" + re.escape(b.lower()) + r"(?![a-z0-9])")) for b in BRANDS]


def brand_of(name):
    n = name.lower()
    for b, rx in _BRAND_RE:
        if rx.search(n):
            return {"Msi": "MSI", "Wd": "WD"}.get(b, b)
    return None


def tokens(name):
    return [t for t in re.split(r"[^a-z0-9]+", name.lower()) if t]


_USED = re.compile(r"\busado\b|\boutlet\b|reacondicionad|open ?box|\bexhibici[oó]n|\bdemo\b|\bbulk\b", re.I)


def is_used(name):
    """Unidades usadas / outlet / open box: nunca se mezclan con el producto nuevo."""
    return bool(_USED.search(name or ""))


def pn_tokens(item):
    """Números de parte: tokens largos que mezclan letras y números."""
    cands = set()
    for src in (item.get("pn"), item.get("sku")):
        if src:
            src = re.sub(r"^\s*SKU:\s*", "", str(src))
            if re.search(r"[A-Za-z]", src) and re.search(r"\d", src) and len(src) >= 6:
                cands.add(re.sub(r"[^a-z0-9]", "", src.lower()))
    return cands


# ---- cruce de productos entre tiendas ----
# Principio: es preferible NO comparar (el producto aparece en una sola tienda) que comparar dos productos distintos.
# Dos ofertas son el mismo producto si comparten número de parte, tienen el mismo título exacto, o si (misma marca y
# categoría) coinciden TODOS sus códigos de modelo, capacidades y variantes y, salvo en procesadores, sus palabras de línea.
VARIANT_WORDS = {"ti", "super", "xt", "xtx", "gre", "x3d", "oc", "white", "black", "blanco", "negro", "rgb", "argb",
                 "wifi", "plus", "pro", "max", "evo", "gold", "bronze", "platinum", "titanium", "silver", "rojo",
                 "red", "blue", "azul", "pink", "rosa", "ultra", "mini", "lite", "tray", "box", "oem", "bulk"}
GENERIC_WORDS = STOP | {"gamer", "gaming", "socket", "intel", "amd", "nvidia", "geforce", "radeon", "series", "serie",
                        "cooler", "incluye", "no", "nucleos", "threads", "turbo", "graphics", "graficos", "tarjeta",
                        "de", "con", "la", "el", "full", "hd", "fhd", "ips", "va", "led", "pcie", "gddr6", "gddr7",
                        "gddr6x", "ddr4", "ddr5", "atx", "modular", "80", "plus", "freesync", "gsync", "sync", "hdr", "curvo",
                        "curved", "ms", "g", "pc", "para", "wireless", "inalambrico", "usb", "bluetooth", "mecanico"}
_UNIT = re.compile(r"^\d+(\.\d+)?(ghz|mhz|mt|mm|cm|hz|ms|w|v|mb|kg|mbps|gbps|fps)$")
_CAP = re.compile(r"^\d+(gb|tb|w)$")
SOCKETS = {"1700", "1851", "1200", "1151", "1150", "1155", "1156", "2066", "2011", "4677", "1718", "1954", "4189", "775", "1366", "939", "2011v3"}
NO_LINE_CHECK = {"procesadores"}   # un procesador se identifica solo por su código de modelo


def match_info(item):
    """Datos para decidir si dos ofertas son el mismo producto; None si no hay información suficiente."""
    name = item["name"]
    brand = brand_of(name)
    if not brand:
        return None
    toks = [re.sub(r"^lga(?=\d{4})", "", t) for t in re.split(r"[^a-z0-9]+", name.lower()) if t]   # lga1700 → 1700
    toks = [t for t in toks if t not in SOCKETS]   # el socket no identifica un modelo
    codes = frozenset(t for t in toks if not _UNIT.match(t) and not _CAP.match(t)
                      and (len(re.sub(r"\D", "", t)) >= 3 or (len(t) >= 5 and re.search(r"\d", t) and re.search(r"[a-z]", t))))
    if not codes:
        return None
    caps = frozenset(t for t in toks if _CAP.match(t))
    var = frozenset(t for t in toks if t in VARIANT_WORDS)
    alpha = frozenset(t for t in toks if t.isalpha() and t not in GENERIC_WORDS and t not in VARIANT_WORDS
                      and t != brand.lower() and len(t) >= 1)
    return {"cat": item["category"], "brand": brand, "codes": codes, "caps": caps, "var": var, "alpha": alpha,
            "used": is_used(name)}


def same_product(a, b):
    if (a["cat"], a["brand"], a["codes"], a["caps"], a["var"], a["used"]) != \
            (b["cat"], b["brand"], b["codes"], b["caps"], b["var"], b["used"]):
        return False
    if a["cat"] in NO_LINE_CHECK:
        return True
    u = a["alpha"] | b["alpha"]
    return not u or len(a["alpha"] & b["alpha"]) / len(u) >= 0.7


# Actualización 42: mismas palabras en otro orden. «Fuente 550W Thermaltake Litepower» = «FUENTE THERMALTAKE LITEPOWER
# 550W». Se normaliza (acentos, mayúsculas, «16 GB» = «16GB») y se ignoran palabras de relleno que no cambian el
# producto («gamer», «de», «con»…; NUNCA «sin», que sí lo cambia). Para unir hace falta el MISMO conjunto de palabras
# (ni una más ni una menos), al menos 4 palabras y algún número (modelo, capacidad, potencia), en la misma categoría.
# Revisado con el informe de posibles repetidos: en una muestra de 30 pares, 30 eran el mismo producto.
_FILL = re.compile(r"\b(de|del|con|para|el|la|los|las|y|en|gamer|gaming|nuevo|oferta|garantia|oficial|envio|gratis|cuotas|interes)\b")


def words_key(name):
    import unicodedata
    s = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"(\d)\s+(gb|tb|mhz|w|hz|mm|cm|pulgadas|\")(?![a-z0-9])", r"\1\2", s)
    s = _FILL.sub(" ", s)
    toks = [t for t in re.split(r"[^a-z0-9]+", s) if t]
    if len(toks) < 4 or not any(re.search(r"\d", t) for t in toks):
        return None
    return " ".join(sorted(toks))


def group(items):
    """Agrupa ofertas del mismo producto (número de parte, título exacto o coincidencia estricta de modelo)."""
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    seen = {}
    infos = {}
    for i, it in enumerate(items):
        used = is_used(it["name"])
        keys = [("pn", p, used) for p in pn_tokens(it)]
        norm = re.sub(r"[^a-z0-9]", "", it["name"].lower())
        if len(norm) >= 12:
            keys.append(("name", it["category"], norm))   # mismo título exacto = mismo producto
        wk = words_key(it["name"])
        if wk:
            keys.append(("words", it["category"], used, wk))   # act. 42: mismas palabras en otro orden
        for k in keys:
            if k in seen:
                parent[find(i)] = find(seen[k])
            else:
                seen[k] = i
        mi = match_info(it)
        if mi:
            infos[i] = mi
    blocks = {}
    for i, mi in infos.items():
        blocks.setdefault((mi["cat"], mi["brand"], mi["codes"]), []).append(i)
    for idx in blocks.values():   # comparación de a pares solo dentro de cada bloque (misma marca, categoría y códigos)
        for x in range(len(idx)):
            for y in range(x + 1, len(idx)):
                if find(idx[x]) != find(idx[y]) and same_product(infos[idx[x]], infos[idx[y]]):
                    parent[find(idx[x])] = find(idx[y])
    buckets = {}
    for i in range(len(items)):
        buckets.setdefault(find(i), []).append(items[i])
    return list(buckets.values())


def okey(offer):
    """Clave estable de una oferta (tienda + link) para su historial."""
    return hashlib.md5(offer["url"].encode()).hexdigest()[:10]


def price_of(o):
    return o.get("price_cash") or o.get("price_list")


def offer_rank(o):
    """Orden de las ofertas de un producto: stock confirmado, después sin salto sospechoso, después precio."""
    return (0 if o.get("stock") is True else 1 if o.get("stock") is None else 2, 1 if o.get("anom") else 0, price_of(o) or float("inf"))


def gid(offers):
    pns = sorted(set().union(*[pn_tokens(o) for o in offers])) if offers else []
    base = pns[0] if pns else re.sub(r"[^a-z0-9]+", "-", offers[0]["name"].lower())[:60]
    return base.strip("-")


# ---------- imágenes ----------
# Imágenes "sin foto" que las tiendas ponen en su lugar: no sirven y se descartan.
PLACEHOLDER_RE = re.compile(r"es-default-|no[-_]?image|sin[-_]?imagen|placeholder|noimg|no[-_]?photo|"
                            r"image[-_]?not[-_]?found|default[-_]?image|/default\.(jpg|png|webp)", re.I)
IMG_RANK = ["Compragamer", "Logg", "MEXX", "Venex", "Gaming City", "NET Gaming", "Katech", "Hardloots", "Click Gaming", "SCP Hardstore", "The Gamer Shop", "Try", "BitHard", "GoldenTech", "Maximus", "Armytech"]   # de más a menos nítidas


# actualización 45: Venex publica algunas fotos con la dirección rota (sin el punto de la extensión:
# «…_ddr5_1png»); el servidor responde con error y el navegador la bloquea. Esas se descartan y se usa la foto de otra
# tienda que venda el mismo producto, o el ícono de la categoría.
BROKEN_IMG_RE = re.compile(r"^https?://(www\.)?venex\.com\.ar/(?!.*\.(jpe?g|png|webp|gif|avif)(\?|$))", re.I)


def good_image(url):
    return (url if url and isinstance(url, str) and url.startswith("http") and not PLACEHOLDER_RE.search(url)
            and not BROKEN_IMG_RE.search(url) else None)


def hq_image(url):
    """Compragamer publica miniaturas (-mini, 100 px); la misma foto sin el sufijo mide 750 px."""
    if url and "imagenes.compragamer.com" in url and url.endswith("-mini.jpg"):
        return url[:-len("-mini.jpg")] + ".jpg"
    return url


# Servidores que solo publican la foto original sin achicar (static.nb.com.ar: PNG de 0,5 a 1,5 MB cada una, sin
# versión reducida): se usan solo si ninguna otra tienda tiene foto del producto (actualización 38).
HEAVY_IMG_RE = re.compile(r"^https?://static\.nb\.com\.ar/", re.I)


def pick_image(offers):
    """(imagen, imagen de respaldo): la mejor foto válida entre TODAS las tiendas que venden el producto."""
    cands = sorted((o for o in offers if good_image(o.get("image"))),
                   key=lambda o: (bool(HEAVY_IMG_RE.search(o["image"])), IMG_RANK.index(o["store"]) if o["store"] in IMG_RANK else 99))
    if not cands:
        return None, None
    raw = cands[0]["image"]
    big = hq_image(raw)
    return big, (raw if big != raw else None)


def load_extra_images():
    """Fotos de respaldo cargadas a mano desde páginas oficiales de fabricantes (site/data/imagenes_extra.json)."""
    path = DATA / "imagenes_extra.json"
    try:
        return json.loads(path.read_text()).get("items", {})
    except Exception:
        return {}


def clean_name(name):
    """Quita palabras repetidas de los títulos ('300Mbps Universal 300Mbps 300Mbps Universal')."""
    seen, out = set(), []
    for w in name.split():
        k = re.sub(r"[^a-z0-9]", "", w.lower())
        if k in seen and (len(k) >= 5 or (len(k) >= 4 and re.search(r"\d", k))):
            continue
        seen.add(k)
        out.append(w)
    return " ".join(out)


# ---- actualización 50 (juez de datos): grupos que mezclaban productos incompatibles ----
# El cruce une por número de parte, título o modelo, y una oferta sin un dato (p. ej. «Mother Gigabyte B760M D3HP», sin
# DDR) podía hacer de puente entre la versión DDR4 y la DDR5. Después de agrupar se revisa cada grupo: si sus ofertas
# dicen cosas DISTINTAS sobre un dato que cambia el producto (tipo de memoria, capacidad de la memoria, variante de la
# placa madre), el grupo se separa por ese dato; las ofertas que no lo dicen quedan aparte (mejor no comparar que
# comparar mal).
_DDR = re.compile(r"\bddr ?([345])\b|\b(?:ddr)?d([45])\b(?!\d)", re.I)


def ddr_of(name):
    m = _DDR.search(name or "")
    return ("ddr" + (m.group(1) or m.group(2))) if m else None


def ram_total_gb(name):
    n = (name or "").lower()
    kit = re.search(r"(\d)\s?x\s?(\d{1,3})\s?gb", n)
    if kit:
        return int(kit.group(1)) * int(kit.group(2))
    m = re.search(r"\b(\d{1,3})\s?gb\b", n)
    return int(m.group(1)) if m else None


_MOBO_SUFFIX = {"a", "k", "g", "e", "p", "s", "f", "d2h", "d3h", "d3hp", "ds3h", "s2h", "hd3", "hd3p", "dh", "s3h", "ud", "uda", "ax", "v2", "v3", "ii"}
_MOBO_NOISE = re.compile(r"\(.*?\)|\bddr ?[345]\b|\bd[45]\b|\blga ?\d{4}\b|\b(1700|1851|1200)\b|\bam[45]\b|micro ?atx|\bm?atx\b|\bgen ?\d\b|\d{1,2}(va|°)", re.I)


def mobo_variant(name):
    """«b760m|d3hp», «b760m|a», «h610m|k|v2»… o None si el título no trae chipset."""
    s = _MOBO_NOISE.sub(" ", (name or "").lower())
    m = re.search(r"\b([abhxzq]\d{3}[a-z]?m?)(?:[- ]?([a-z0-9]{1,4}))?(?:[- ]([a-z0-9]{1,4}))?(?:[- ]([a-z0-9]{1,4}))?", s)
    if not m:
        return None
    suf = sorted(t for t in m.groups()[1:] if t and t in _MOBO_SUFFIX)
    return "|".join([m.group(1)] + suf)


def split_conflicts(groups_items):
    """Separa los grupos (listas de ofertas) cuyas ofertas se contradicen. Devuelve la lista nueva y cuántos separó."""
    out, n = [], 0
    for offers in groups_items:
        cat = offers[0].get("category") if offers else None
        keyf = None
        if cat == "memorias-ram":
            keyf = lambda o: (ddr_of(o["name"]), ram_total_gb(o["name"]))
        elif cat == "motherboards":
            keyf = lambda o: (ddr_of(o["name"]), mobo_variant(o["name"]))
        elif cat == "placas-de-video":
            keyf = lambda o: (gpu_chip(o["name"]), (lambda m: int(m.group(1)) if m else None)(re.search(r"\b(\d{1,2})\s?gb?\b", o["name"].lower())))
        if not keyf or len(offers) < 2:
            out.append(offers)
            continue
        keys = [keyf(o) for o in offers]
        # cada componente se compara solo entre las ofertas que lo informan
        conflict = any(len({k[i] for k in keys if k[i] is not None}) > 1 for i in range(len(keys[0])))
        if not conflict:
            out.append(offers)
            continue
        n += 1
        buckets = {}
        for o, k in zip(offers, keys):
            buckets.setdefault(k if all(x is not None for x in k) else ("?",) + tuple(x for x in k), []).append(o)
        out.extend(buckets.values())
    return out, n


# ---- actualización 50 (juez de datos): la misma placa de video repartida en varias fichas ----
# «MSI RTX 5070 Ti Shadow 3X OC 16GB» aparecía en 10 fichas porque cada tienda escribe el título distinto y sin número
# de parte. Se unen las fichas de placas de video que coinciden EXACTAMENTE en: marca, chip (patrones de
# hardware.json), memoria, palabras de línea del modelo (Shadow, Ventus, Windforce, Prime, Dual, TUF…), cantidad de
# ventiladores, «OC» y color. Si a una le falta una palabra (p. ej. «OC»), no se une: mejor no comparar que comparar mal.
GPU_LINE = {"shadow", "ventus", "gaming", "trio", "windforce", "eagle", "aero", "aorus", "elite", "master", "xtreme", "prime",
            "dual", "tuf", "rog", "strix", "astral", "challenger", "legend", "steel", "phantom", "taichi", "pulse", "nitro",
            "hellhound", "devil", "reaper", "twin", "amp", "solid", "inspire", "sakura", "ice", "expert", "suprim", "vanguard",
            "mech", "fighter", "ichill", "frostbite", "gamerock", "jetstream", "infinity", "sff", "lp", "pro", "plus", "x2", "x3",
            "2x", "3x", "ultra", "edge", "core", "speedster", "swift", "merc", "qick", "low", "profile", "itx", "mini", "max", "evo"}
GPU_COLOR = {"white", "blanco", "blanca", "black", "negro", "negra", "pink", "rosa", "silver"}
_GPU_CHIPS = None
MERGED_FROM = {}   # id(lista de ofertas) → ids que tenían las fichas que se le unieron
ALIASES = {}       # id viejo → id nuevo (se publica en data/alias.json: enlaces y avisos viejos siguen andando)


def gpu_chip(name):
    global _GPU_CHIPS
    if _GPU_CHIPS is None:
        try:
            hw = json.loads((ROOT / "site" / "data" / "hardware.json").read_text(encoding="utf-8"))
            _GPU_CHIPS = [(g["id"], re.compile(g["m"], re.I), re.compile(g["x"], re.I) if g.get("x") else None)
                          for g in (hw.get("gpus") or []) + (hw.get("gpux") or []) if g.get("m")]
        except Exception:
            _GPU_CHIPS = []
    n = (name or "").lower()
    for gid_, m, x in _GPU_CHIPS:
        if m.search(n) and not (x and x.search(n)):
            return gid_
    return None


def gpu_key(name):
    n = (name or "").lower()
    chip, brand = gpu_chip(n), brand_of(name)
    vram = re.search(r"\b(\d{1,2})\s?gb?\b", n)
    if not chip or not brand or not vram:
        return None
    toks = set(re.split(r"[^a-z0-9]+", n.replace("x 2", "x2").replace("x 3", "x3")))
    line = frozenset(toks & GPU_LINE)
    if not line:
        return None
    return (brand, chip, int(vram.group(1)), line, "oc" in toks, frozenset(toks & GPU_COLOR), is_used(name))


_CPU_CHIPS = None


def cpu_key(name):
    """(chip, modelo exacto con sufijo, caja/tray) de un procesador, o None si falta algo. «14100» y «14100F» no se unen."""
    global _CPU_CHIPS
    if _CPU_CHIPS is None:
        try:
            hw = json.loads((ROOT / "site" / "data" / "hardware.json").read_text(encoding="utf-8"))
            _CPU_CHIPS = [(c["id"], re.compile(c["m"], re.I)) for c in hw.get("cpus") or [] if c.get("m")]
        except Exception:
            _CPU_CHIPS = []
    n = (name or "").lower()
    chip = next((cid for cid, m in _CPU_CHIPS if m.search(n)), None)
    tok = re.search(r"\b(?:i[3579][ -]?)?(\d{4,5})([a-z]{0,2}\d?[a-z]?)\b", n)
    if re.search(r"\btray\b|\boem\b|\bbulk\b|sin cooler|s/ ?cooler|\bmpk\b", n):
        pack = "tray"
    elif re.search(r"\bbox\b|wraith|con cooler|c/ ?cooler|\bcooler\b", n):
        pack = "box"
    else:
        pack = None
    if not chip or not tok or not pack or is_used(name):
        return None
    return (chip, tok.group(1) + tok.group(2), pack)


def merge_cpu_dupes(groups_items):
    """Como merge_gpu_dupes, para procesadores (mismo chip, mismo sufijo y misma presentación caja/tray)."""
    out, by_key, n = [], {}, 0
    for offers in groups_items:
        if not offers or offers[0].get("category") != "procesadores":
            out.append(offers)
            continue
        keys = {cpu_key(o["name"]) for o in offers}
        if len(keys) != 1 or None in keys:
            out.append(offers)
            continue
        k = keys.pop()
        if k in by_key:
            MERGED_FROM.setdefault(id(by_key[k]), []).append(gid(offers))
            by_key[k].extend(offers)
            n += 1
        else:
            by_key[k] = list(offers)
            out.append(by_key[k])
    return out, n


def merge_gpu_dupes(groups_items):
    """Une fichas de placas de video del mismo modelo exacto. Devuelve la lista nueva y cuántas fichas se unieron."""
    out, by_key, n = [], {}, 0
    for offers in groups_items:
        if not offers or offers[0].get("category") != "placas-de-video":
            out.append(offers)
            continue
        keys = {gpu_key(o["name"]) for o in offers}
        if len(keys) != 1 or None in keys:
            out.append(offers)
            continue
        k = keys.pop()
        if k in by_key:
            MERGED_FROM.setdefault(id(by_key[k]), []).append(gid(offers))   # su id viejo pasa a ser un alias
            by_key[k].extend(offers)
            n += 1
        else:
            by_key[k] = list(offers)
            out.append(by_key[k])
    return out, n


def build(all_items, extra_images=None):
    from scrapers.common import is_service, is_non_hardware, fix_category
    fixed = []
    for i in all_items:
        cat = fix_category(i["name"], i["category"])
        if cat is None:
            continue                       # electrodomésticos u otros productos que no son de PC
        fixed.append(dict(i, category=cat) if cat != i["category"] else i)
    all_items = fixed
    groups = []
    grouped, _ = split_conflicts(group([i for i in all_items if price_of(i) and not is_service(i["name"])
                                         and not is_non_hardware(i["name"], i["category"])]))
    grouped, _ = merge_gpu_dupes(grouped)
    grouped, _ = merge_cpu_dupes(grouped)
    ALIASES.clear()
    src_of = {}
    for offers in grouped:
        offers_all = offers
        src_of[len(groups)] = MERGED_FROM.pop(id(offers), [])
        best = {}  # una oferta por tienda: la más barata
        for o in offers:
            cur = best.get(o["store"])
            if cur is None or price_of(o) < price_of(cur):
                best[o["store"]] = o
        offers = sorted(best.values(), key=price_of)
        main = max(offers, key=lambda o: len(o["name"]))
        brand = next((b for b in (brand_of(o["name"]) for o in offers) if b), None)
        image, image_fb = pick_image(offers_all)
        groups.append({
            "_pns": sorted(set().union(*[pn_tokens(o) for o in offers_all])),
            "id": gid(offers), "name": clean_name(main["name"]), "category": main["category"], "brand": brand,
            "image": image, **({"image_fb": image_fb} if image_fb else {}),
            "offers": [dict({k: o.get(k) for k in ("store", "url", "price_cash", "price_list", "stock",
                                                    "cuotas", "rating", "prev_cash")}, k=okey(o)) for o in offers],
        })
    used = {}
    for g in groups:  # ids únicos
        n = used.get(g["id"], 0)
        used[g["id"]] = n + 1
        if n:
            g["id"] += f"-{n}"
    ids = {g["id"] for g in groups}
    for i, olds in src_of.items():
        for o in olds:
            if o and o != groups[i]["id"] and o not in ids:
                ALIASES[o] = groups[i]["id"]
    MERGED_FROM.clear()
    for g in groups:   # red de seguridad: si los precios difieren 3 veces o más, la web avisa que se verifique
        ps = [price_of(o) for o in g["offers"]]
        if len(ps) > 1 and max(ps) / min(ps) >= 3:
            g["dif"] = True
    for g in groups:
        if not g["image"] and g["id"] in (extra_images or {}):   # foto del fabricante cargada a mano
            e = extra_images[g["id"]]
            g["image"], g["img_src"] = e["url"], e.get("source", "Sitio del fabricante")
    return groups


# ---------- historial y cambios de precio ----------

def load_history():
    path = DATA / "history.json"
    if path.exists():
        try:
            h = json.loads(path.read_text())
            if h.get("_v") == HIST_VERSION:
                return h
        except Exception:
            pass
    return {"_v": HIST_VERSION}


def read_raw(path):
    """Lee una corrida anterior (carpeta raw). Si el archivo está dañado (por ejemplo con marcas de conflicto de Git),
    se ignora en vez de romper toda la actualización: esa tienda se vuelve a leer en la próxima corrida."""
    try:
        d = json.loads(path.read_text())
        return d if isinstance(d, list) else []
    except Exception as e:
        print(f"[aviso] {path.name} ilegible, se ignora: {e}")
        return []


def seed_from_raw(hist):
    """Primera vez con el formato nuevo: usa la corrida anterior (carpeta raw) como punto de partida."""
    if len(hist) > 1 or not RAW.exists():
        return
    meta = DATA / "meta.json"
    try:
        day = json.loads(meta.read_text())["updated"][:10]
    except Exception:
        return
    for f in RAW.glob("*.json"):
        try:
            for it in json.loads(f.read_text()):
                p = price_of(it)
                if p and it.get("url"):
                    hist.setdefault(okey(it), [[day, p]])
        except Exception:
            continue


def update_history(groups, hist, today):
    for g in groups:
        for o in g["offers"]:
            p = price_of(o)
            s = hist.get(o["k"])
            if not s:
                prev = o.get("prev_cash")
                s = [[None, prev], [today, p]] if prev and prev != p else [[today, p]]
            elif s[-1][1] != p:
                s.append([today, p])
            hist[o["k"]] = s[-60:]


def days_ago(date_str, today):
    if not date_str:
        return 0
    return (dt.date.fromisoformat(today) - dt.date.fromisoformat(date_str)).days


def annotate_changes(groups, hist, today):
    """Agrega a cada oferta y producto el último cambio de precio (bajó/subió) y si está en mínimo histórico."""
    for g in groups:
        for o in g["offers"]:
            s = hist.get(o["k"], [])
            o.pop("prev_cash", None)
            if len(s) >= 2 and days_ago(s[-1][0], today) <= RECENT_DAYS:
                prev, now = s[-2][1], s[-1][1]
                o["chg"] = {"prev": prev, "pct": round((now - prev) / prev * 100, 1), "date": s[-1][0]}
                if o["chg"]["pct"] <= ANOM_DOWN or o["chg"]["pct"] >= ANOM_UP:
                    o["anom"] = True   # salto sospechoso (posible error de la tienda): la web avisa que se confirme
            vals = [x[1] for x in s]
            o["low"] = len(vals) >= 3 and vals[-1] <= min(vals)
        # act. 50 (jueces): la primera oferta (el «mejor precio» de la ficha, del listado y de las guías) es la más barata
        # CON STOCK CONFIRMADO y sin salto sospechoso; las de stock sin confirmar o sospechosas van después aunque sean más
        # baratas (antes ganaba un monitor a $196.550 de una tienda que en su página decía «sin stock»).
        g["offers"].sort(key=offer_rank)
        top = g["offers"][0]
        g["chg"] = top.get("chg")
        g["low"] = top.get("low", False)


BUDGET_MIN = float(os.environ.get("BUDGET_MIN", "85"))   # minutos para recolectar (el trabajo de GitHub corta a los 120)


def store_order(scrapers, meta_path):
    """Primero las tiendas que la corrida anterior no llegó a leer; después el resto en el orden de SCRAPERS."""
    try:
        prev = json.loads(meta_path.read_text()).get("stores", {})
    except Exception:
        prev = {}
    first = [s for s in scrapers if (prev.get(s) or {}).get("skipped")]
    return first + [s for s in scrapers if s not in first]


HOME_LEAD = {   # para la foto de cada categoría en la portada: el título tiene que empezar con el tipo de producto
    "procesadores": r"^(micro\s?)?procesador|^micro (amd|intel)", "motherboards": r"^(mother|motherboard|placa madre|mb)\b",
    "placas-de-video": r"^(placa de video|video|vga|tarjeta gr)", "memorias-ram": r"^memoria", "almacenamiento": r"^(disco|ssd)\b",
    "refrigeracion": r"^(water ?cooler|cooler cpu|cooler)", "fuentes": r"^fuente", "gabinetes": r"^gabinete", "monitores": r"^monitor",
    "notebooks": r"^notebook", "pcs-armadas": r"^pc\b", "mouses": r"^mouse", "teclados": r"^teclado", "auriculares": r"^auricular",
}


def home_summary(groups, recent_days=14):
    """Resumen chico para la portada (home.json): así la página principal no descarga todo el catálogo."""
    stores, cats, best = set(), {}, {}
    price = lambda o: o.get("price_cash") or o.get("price_list")
    for g in groups:
        for o in g.get("offers") or []:
            stores.add(o.get("store"))
        c = g.get("category") or "otros"
        cats[c] = cats.get(c, 0) + 1
        lead = HOME_LEAD.get(c)
        if not (lead and g.get("image") and re.search(lead, g.get("name") or "", re.I)) or g.get("dif"):
            continue
        offs = g.get("offers") or []
        if any(o.get("anom") for o in offs) or not any(o.get("stock") is True for o in offs):
            continue
        score = (len(offs), 1 if "compragamer" in (g.get("image") or "") else 0, g["id"])
        if c not in best or score > best[c][0]:
            best[c] = (score, {"id": g["id"], "name": g["name"], "image": g["image"], "image_fb": g.get("image_fb")})
    # en la portada solo bajas de hardware (no cables, accesorios ni «otros») y sin saltos raros de precio
    ok = lambda g: (g.get("chg") and g["offers"] and not g["offers"][0].get("anom") and g["chg"]["pct"] < 0 and not g.get("dif")
                    and g.get("category") not in ("otros", "accesorios", "redes"))
    drops = sorted((g for g in groups if ok(g)), key=lambda g: g["chg"]["pct"])
    slim = lambda g: {"id": g["id"], "name": g["name"], "category": g.get("category"), "image": g.get("image"), "chg": g["chg"],
                      "offers": [{k: g["offers"][0].get(k) for k in ("store", "price_cash", "price_list")}]}
    return {"v": 1, "products": len(groups), "stores": len([s for s in stores if s]), "dropped": sum(1 for g in groups if g.get("chg") and g.get("offers") and not g["offers"][0].get("anom") and g["chg"]["pct"] < 0),
            "cats": cats, "photo": {k: v[1] for k, v in best.items()}, "drops": [slim(g) for g in drops[:8]]}


ARMAR_CATS = ("procesadores", "refrigeracion", "motherboards", "memorias-ram", "almacenamiento", "placas-de-video", "gabinetes", "fuentes", "monitores")
def search_index(groups):
    """Índice liviano para el autocompletado de los buscadores (buscar.json, actualización 36): por producto
    [id, nombre, categoría, foto, precio más bajo con stock (0 si no hay), cantidad de tiendas]. Se descarga recién
    cuando la persona toca un buscador."""
    price = lambda o: o.get("price_cash") or o.get("price_list")
    rows = []
    for g in groups:
        offs = [o for o in g.get("offers") or [] if price(o) and not o.get("anom")]
        if not offs:
            continue
        live = [o for o in offs if o.get("stock") is True] or [o for o in offs if o.get("stock") is not False] or offs   # act. 50
        img = g.get("image") or ""
        if not img.startswith("https://"):
            img = g.get("image_fb") or ""
            if not img.startswith("https://"):
                img = ""
        rows.append([g["id"], g.get("name") or "", g.get("category") or "otros", img, round(min(price(o) for o in live)),
                     len({o.get("store") for o in offs})])
    return {"v": 1, "items": rows}


SHARDS = 64   # actualización 38: la ficha de producto descarga solo su parte del catálogo (site/data/p/NN.json)


def shard_of(pid):
    """Número de parte (0..SHARDS-1) de un producto. La misma cuenta está en site/producto.html (shardOf)."""
    h = 0
    for ch in str(pid):
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h % SHARDS


def product_shards(groups, hist):
    """Parte el catálogo en SHARDS archivos chicos: cada uno con sus productos completos y el historial de sus
    ofertas. Así la ficha de un producto baja ~50 KB en vez de products.json + history.json (~4 MB comprimidos)."""
    parts = [{"v": 1, "g": {}, "h": {}} for _ in range(SHARDS)]
    for g in groups:
        p = parts[shard_of(g["id"])]
        p["g"][g["id"]] = g
        for o in g.get("offers") or []:
            k = o.get("k")
            if k and k in hist:
                p["h"][k] = hist[k]
    return parts


def write_shards(groups, hist, data_dir=None):
    d = Path(data_dir or DATA) / "p"
    d.mkdir(parents=True, exist_ok=True)
    # Se regeneran en cada corrida y solo se publican: no se guardan en el repositorio (no lo engordan cada 6 h).
    (d / ".gitignore").write_text("*.json\n")
    for old in d.glob("*.json"):
        old.unlink()
    for i, part in enumerate(product_shards(groups, hist)):
        (d / f"{i:02d}.json").write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")))


def category_files(groups, hist):
    """Actualización 39: un archivo por categoría (site/data/cat/<categoría>.json) con sus productos completos y el
    historial de sus ofertas. «Productos» abierto en una categoría muestra eso al instante y baja el catálogo entero
    después, en segundo plano (antes esperaba ~4 MB para mostrar el primer resultado)."""
    out = {}
    # actualización 40: los totales de las pestañas (Todos / Bajaron / Subieron) de TODO el catálogo, calculados igual que
    # en la página (un salto sospechoso no cuenta), para no tener que bajar el catálogo entero solo para mostrarlos
    tot = {"todos": len(groups), "bajaron": 0, "subieron": 0}
    for g in groups:
        offs = g.get("offers") or []
        if g.get("chg") and not (offs and offs[0].get("anom")):
            tot["bajaron" if (g["chg"].get("pct") or 0) < 0 else "subieron"] += 1
    # ofertas por tienda en todo el catálogo (los números del menú «Tiendas»)
    tot["sc"] = {}
    for g in groups:
        for o in g.get("offers") or []:
            tot["sc"][o.get("store")] = tot["sc"].get(o.get("store"), 0) + 1
    # actualización 44: productos por categoría (los números de los botones de «Comparar», sin bajar todo el catálogo)
    tot["cc"] = {}
    for g in groups:
        c = g.get("category") or "otros"
        tot["cc"][c] = tot["cc"].get(c, 0) + 1
    for g in groups:
        part = out.setdefault(g.get("category") or "otros", {"v": 1, "t": tot, "g": [], "h": {}})
        part["g"].append(g)
        for o in g.get("offers") or []:
            k = o.get("k")
            if k and k in hist:
                part["h"][k] = hist[k]
    return out


# actualización 44: «Productos» sin categoría muestra al instante su primera página con un archivo chico
# (data/cat/_inicio.json) en vez de bajar el catálogo entero (~3 MB comprimido, ~20 MB al abrirse en el celular).
# El orden es el mismo «Relevancia» de la página (productos.html → sorter). El catálogo entero se baja recién al
# buscar, filtrar, ordenar o pasar de página. Pesos por categoría: los mismos que en la página.
REL_W = {"placas-de-video": 40, "procesadores": 40, "motherboards": 30, "memorias-ram": 30, "almacenamiento": 25,
         "monitores": 25, "notebooks": 25, "fuentes": 20, "pcs-armadas": 20, "gabinetes": 15, "refrigeracion": 15,
         "mouses": 12, "teclados": 12, "auriculares": 12, "perifericos": 10, "redes": 8}
INICIO_N = 50   # la vista que más muestra por página («Lista») muestra 50


def _price(o):
    return o.get("price_cash") if o.get("price_cash") is not None else o.get("price_list")


def inicio_file(groups, hist, tot):
    offs = lambda g: g.get("offers") or []
    chg_ok = lambda g: bool(g.get("chg")) and not (offs(g) and offs(g)[0].get("anom"))
    def rel(g):
        o = offs(g)
        return (REL_W.get(g.get("category"), 0) + min(len(o), 4) * 25 + (20 if any(x.get("stock") is True for x in o) else 0)
                + (10 if g.get("image") else 0) + (8 if chg_ok(g) and (g["chg"].get("pct") or 0) < 0 else 0)
                + (-30 if any(x.get("anom") for x in o) else 0))
    vis = [g for g in groups if offs(g)]
    top = sorted(vis, key=lambda g: (-rel(g), _price(offs(g)[0]) if _price(offs(g)[0]) is not None else float("inf")))[:INICIO_N]
    cc = {}
    for g in vis:
        cc[g.get("category")] = cc.get(g.get("category"), 0) + 1
    h = {o["k"]: hist[o["k"]] for g in top for o in offs(g) if o.get("k") in hist}
    return {"v": 1, "t": tot, "n": len(vis), "cc": cc, "g": top, "h": h}


def write_categories(groups, hist, data_dir=None):
    d = Path(data_dir or DATA) / "cat"
    d.mkdir(parents=True, exist_ok=True)
    (d / ".gitignore").write_text("*.json\n")       # se regeneran en cada corrida y solo se publican
    for old in d.glob("*.json"):
        old.unlink()
    parts = category_files(groups, hist)
    for cat, part in parts.items():
        if re.fullmatch(r"[a-z0-9-]+", cat):
            (d / f"{cat}.json").write_text(json.dumps(part, ensure_ascii=False, separators=(",", ":")))
    if parts:
        tot = next(iter(parts.values()))["t"]
        (d / "_inicio.json").write_text(json.dumps(inicio_file(groups, hist, tot), ensure_ascii=False, separators=(",", ":")))


SITE_URL = os.environ.get("SITE_URL", "https://kyranohard.com.ar/")


def write_sitemap(groups, updated=None, site_dir=None):
    """Actualización 39: mapa con todas las fichas de producto que tienen al menos una oferta con precio
    (site/sitemap-productos.xml, lo enlaza sitemap.xml). Un mapa admite hasta 50.000 direcciones."""
    from urllib.parse import quote
    from xml.sax.saxutils import escape
    day = (updated or "")[:10]
    urls = [g["id"] for g in groups if g.get("id") and any((o.get("price_cash") or o.get("price_list")) for o in g.get("offers") or [])]
    rows = [f"<url><loc>{escape(SITE_URL + 'producto.html?id=' + quote(i, safe=''))}</loc>" + (f"<lastmod>{day}</lastmod>" if day else "") + "</url>"
            for i in urls[:50000]]
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(rows) + "\n</urlset>\n"
    (Path(site_dir or DATA.parent) / "sitemap-productos.xml").write_text(xml, encoding="utf-8")
    return len(rows)


ARMAR_PER_CATS = ("mouses", "teclados", "auriculares")
ENCONTRA_CATS = ("procesadores", "refrigeracion", "motherboards", "memorias-ram", "almacenamiento", "placas-de-video", "gabinetes",
                 "fuentes", "notebooks", "pcs-armadas")   # act. 50: Encontrá ya no baja el catálogo entero (3,3 MB comprimido)   # actualización 35: se descargan aparte, solo al elegir un periférico
ARMAR_OFFER = ("store", "url", "price_cash", "price_list", "stock", "cuotas", "anom")


def armar_catalog(groups, cats=ARMAR_CATS):
    """Catálogo reducido para «Armalo vos» (armar.json): solo las 9 categorías de piezas y los datos de oferta que usa la página.
    Así no descarga ni lee el catálogo entero (17 MB), que traba la página en equipos modestos.
    Con cats=ARMAR_PER_CATS arma armar_per.json (mouse, teclado y auriculares), que la página pide solo si hace falta."""
    out = []
    for g in groups:
        if g.get("category") not in cats:
            continue
        offs = [{k: o[k] for k in ARMAR_OFFER if o.get(k) is not None} for o in g.get("offers") or []]
        if not offs:
            continue
        e = {k: g[k] for k in ("id", "name", "category", "brand", "image", "image_fb", "chg", "low", "dif", "spec") if g.get(k) is not None}
        e["offers"] = offs
        out.append(e)
    return out


def hidden_stores(path=None):
    """Tiendas ocultas en todo el sitio (config.json: "ocultar": true). Sus datos se conservan en raw/ y vuelven al quitar la marca."""
    try:
        cfg = json.loads(Path(path or DATA / "config.json").read_text(encoding="utf-8"))
        return {k for k, v in cfg.get("stores", {}).items() if isinstance(v, dict) and v.get("ocultar")}
    except Exception:
        return set()


class _LineOut:
    """Salida segura con varios hilos: cada hilo junta su texto hasta el fin de renglón y lo escribe entero (los mensajes
    de dos tiendas no se mezclan en el mismo renglón). Cada renglón sale enseguida al registro de GitHub."""
    def __init__(self, out):
        import threading
        self._out, self._lock, self._tl = out, threading.Lock(), threading.local()

    def write(self, txt):
        buf = getattr(self._tl, "b", "") + txt
        *lines, self._tl.b = buf.split("\n")
        if lines:
            with self._lock:
                self._out.write("".join(x + "\n" for x in lines))
                self._out.flush()
        return len(txt)

    def flush(self):
        rest = getattr(self._tl, "b", "")
        with self._lock:
            if rest:
                self._out.write(rest); self._tl.b = ""
            self._out.flush()

    def __getattr__(self, name):
        return getattr(self._out, name)


STORE_WORKERS = int(os.environ.get("STORE_WORKERS", "6"))   # tiendas que se leen al mismo tiempo


def store_lanes(stores):
    """Agrupa las tiendas en «carriles» que se leen uno por hilo. Cada tienda va en su propio carril, salvo las que
    comparten plataforma (Tiendanube, Cardeco): esas van juntas en un solo carril, una después de la otra, para que
    la plataforma no reciba pedidos de varias tiendas al mismo tiempo. Así ningún servidor recibe más pedidos
    por segundo que antes: cada tienda sigue con sus pausas (1,5 s, o lo que pida su robots.txt)."""
    from scrapers import tiendanube, cardeco
    lanes, by_key = [], {}
    for s in stores:
        key = "tiendanube" if s in tiendanube.TN_STORES else "cardeco" if s in cardeco.CE_STORES else s
        if key not in by_key:
            by_key[key] = []
            lanes.append(by_key[key])
        by_key[key].append(s)
    return lanes


def read_one(store, fn, t0):
    """Lee una tienda. Devuelve (productos, estado). Si falla, usa la lectura anterior marcada como desactualizada."""
    from scrapers import common
    raw = RAW / f"{store}.json"
    if (time.monotonic() - t0) / 60 > BUDGET_MIN:
        # Sin tiempo en esta corrida (el trabajo de GitHub tiene un límite): se usan los datos anteriores
        # de la tienda, marcados como desactualizados, y la próxima corrida empieza por ella.
        items = read_raw(raw) if raw.exists() else []
        return items, {"ok": False, "count": len(items), "stale": bool(items), "skipped": True,
                       "error": "No alcanzó el tiempo de esta corrida: se muestran los precios de la lectura anterior."}
    common.LOG.clear()
    t1 = time.monotonic()
    try:
        items = fn()
        if not items:
            raise RuntimeError("0 productos")
        raw.write_text(json.dumps(items, ensure_ascii=False))
        st = {"ok": True, "count": len(items)}
    except Exception as e:
        why = " | ".join(common.LOG[:3]) or str(e)
        print(f"[{store}] ERROR: {why}", flush=True)
        items = read_raw(raw) if raw.exists() else []
        st = {"ok": False, "count": len(items), "error": why[:400], "stale": bool(items)}
    secs = time.monotonic() - t1
    print(f"[tiempo] {store}: {int(secs // 60)} min {int(secs % 60)} s · {'ok' if st['ok'] else 'con error'} · {st['count']} productos", flush=True)
    return items, st


# actualización 45: precios de tiendas que no responden. Pasados STALE_DEMOTE_DAYS sin una lectura buena, ese precio
# deja de contar como «mejor precio» (va a «old_offers», se ve en la ficha con su antigüedad) cuando el producto tiene
# otra tienda al día; pasados STALE_HIDE_DAYS, la tienda no se publica (sus datos siguen en raw/ y vuelven solos).
STALE_DEMOTE_DAYS = 3
STALE_HIDE_DAYS = 7


def load_last_ok(meta_path=None, seed_path=None):
    """Última lectura buena de cada tienda: la guardada en meta.json o, si todavía no está, la de data_src/ultima_lectura.json
    (fechas tomadas del último cambio de raw/<tienda>.json en el repositorio)."""
    out = {}
    for path, key in ((seed_path or Path(__file__).parent / "data_src" / "ultima_lectura.json", None), (meta_path or DATA / "meta.json", "stores")):
        try:
            d = json.loads(Path(path).read_text(encoding="utf-8"))
            d = d.get(key, {}) if key else d
            for s, v in d.items():
                if s.startswith("_"):
                    continue
                v = v.get("last_ok") if isinstance(v, dict) else v
                if isinstance(v, str) and v:
                    out[s] = v
        except Exception:
            pass
    return out


def stale_days(last_ok, now):
    try:
        t = dt.datetime.fromisoformat(last_ok.replace("Z", "+00:00"))
        if t.tzinfo is None:
            t = t.replace(tzinfo=dt.timezone.utc)
        return max(0.0, (now - t).total_seconds() / 86400)
    except Exception:
        return None


def staleness(st, last, now):
    """Anota en el estado de la tienda su última lectura buena y devuelve None (al día), "vieja" (más de
    STALE_DEMOTE_DAYS sin responder) u "ocultar" (más de STALE_HIDE_DAYS)."""
    if st.get("ok"):
        st["last_ok"] = now.isoformat(timespec="minutes")
        return None
    if not last:
        # act. 50: falla y nunca registramos una lectura buena (Fullh4rd): no se puede afirmar que el precio esté al día,
        # así que deja de contar como mejor precio (no se oculta: sin fecha no se sabe cuánto tiempo pasó)
        st["sin_fecha"] = True
        return "vieja"
    st["last_ok"] = last
    age = stale_days(last, now)
    if age is None:
        return None
    st["dias"] = round(age, 1)
    if age > STALE_HIDE_DAYS:
        if st.get("count"):
            st["oculta_por_antiguedad"] = True
        return "ocultar"
    return "vieja" if age > STALE_DEMOTE_DAYS else None


def demote_stale(groups, old_stores):
    """Saca de «offers» los precios de tiendas sin responder hace días cuando el producto tiene otra tienda al día."""
    n = 0
    for g in groups:
        old = [o for o in g["offers"] if o["store"] in old_stores]
        if old and len(old) < len(g["offers"]):
            g["offers"] = [o for o in g["offers"] if o["store"] not in old_stores]
            g["old_offers"] = old
            n += len(old)
    return n


def read_stores(stores, scrapers, t0, workers=None):
    """Lee las tiendas en paralelo (de a STORE_WORKERS carriles a la vez) y devuelve {tienda: (productos, estado)}."""
    from concurrent.futures import ThreadPoolExecutor
    workers = max(1, workers or STORE_WORKERS)
    out = {}

    def lane(names):
        for s in names:
            out[s] = read_one(s, scrapers[s], t0)

    lanes = store_lanes(stores)
    if workers == 1:
        for names in lanes:
            lane(names)
        return out
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for f in [ex.submit(lane, names) for names in lanes]:
            f.result()   # si algo inesperado falla fuera de read_one, que se vea
    return out


def main(only):
    from scrapers import SCRAPERS
    if not isinstance(sys.stdout, _LineOut):
        sys.stdout = _LineOut(sys.stdout)   # renglones enteros aunque escriban varias tiendas a la vez, y al instante
    DATA.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(exist_ok=True)
    hist = load_history()
    seed_from_raw(hist)
    status, all_items = {}, []
    t0 = time.monotonic()
    hidden = hidden_stores()   # se siguen leyendo para saber su estado, pero no se publican
    order = store_order(SCRAPERS, DATA / "meta.json")
    todo = [s for s in order if not only or s in only]
    res = read_stores(todo, SCRAPERS, t0)   # actualización 42: varias tiendas a la vez (ver read_stores)
    now = dt.datetime.now(dt.timezone.utc)
    last_ok = load_last_ok()
    old_stores = set()
    # se arma todo en el mismo orden de siempre, así el resultado es idéntico al de leer de a una
    for store in order:
        raw = RAW / f"{store}.json"
        if store not in res:
            if raw.exists() and store not in hidden:
                all_items += read_raw(raw)
            continue
        items, status[store] = res[store]
        st = status[store]
        verdict = staleness(st, last_ok.get(store), now)
        if store in hidden:                 # oculta a mano (config.json): manda sobre la antigüedad
            st["hidden"] = True
            st.pop("oculta_por_antiguedad", None)
            continue
        if verdict == "ocultar" and items:
            continue
        if verdict == "vieja":
            old_stores.add(store)
        all_items += items
    today = dt.date.today().isoformat()
    groups = build(all_items, load_extra_images())
    if old_stores:
        print(f"[aviso] precios de {', '.join(sorted(old_stores))} sin actualizar hace más de {STALE_DEMOTE_DAYS} días: "
              f"{demote_stale(groups, old_stores)} dejan de contar como mejor precio", flush=True)
    from scrapers import specs
    try:
        spec_items, spec_status = specs.refresh(all_items, RAW, only or None)
    except Exception as e:  # las fichas nunca deben romper la actualización de precios
        spec_items, spec_status = {}, {"ok": False, "error": str(e)[:300]}
    spec_status["vinculadas"] = specs.attach(groups, spec_items)
    # Placas madre: ficha oficial de ASRock/MSI/Gigabyte/ASUS. APAGADO por defecto: los términos de uso de ASRock, MSI y ASUS
    # prohíben los programas automáticos. Solo se enciende (MB_SPECS=1) con permiso escrito del fabricante.
    if os.environ.get("MB_SPECS") == "1":
        try:
            from scrapers import mbspecs
            mb_items, mb_status = mbspecs.refresh(groups, RAW)
            spec_items.update(mb_items)
            spec_status["placas_madre"] = mb_status
        except Exception as e:
            spec_status["placas_madre"] = {"ok": False, "error": str(e)[:300]}
    else:
        spec_status["placas_madre"] = {"ok": True, "apagado": "sin permiso de los fabricantes"}
    try:   # monitores, memorias, almacenamiento y fuentes: Open Icecat (licencia abierta; requiere el secreto ICECAT_USER)
        from scrapers import icecat
        ic_items, ic_status = icecat.refresh(groups, RAW)
        spec_items.update(ic_items)
        spec_status["icecat"] = ic_status
    except Exception as e:
        spec_status["icecat"] = {"ok": False, "error": str(e)[:300]}
    try:   # mouses/teclados/auriculares/notebooks: datos de la descripción de la propia tienda (marcados «según la tienda»); en notebooks con ficha solo completa peso y batería que falten
        from scrapers import descspecs
        ds_items, ds_status = descspecs.refresh(groups, all_items, specs_by_key=spec_items)
        spec_items.update(ds_items)
        spec_status["descripciones_tienda"] = ds_status
    except Exception as e:
        spec_status["descripciones_tienda"] = {"ok": False, "error": str(e)[:300]}
    for g in groups:
        g.pop("_pns", None)
    (DATA / "specs.json").write_text(json.dumps({
        "v": 1, "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
        "sources": {"Compragamer": "https://static.compragamer.com/productos_caracteristicas",
                    "Descripciones de las tiendas": "Texto que cada tienda publica de su producto (no es del fabricante)",
                    "Icecat": "Specs Icecat — Open Icecat (https://icecat.biz), datos «tal cual» (AS IS) bajo la licencia Open Icecat"},
        "items": {k: v for k, v in spec_items.items() if k in {g.get("spec") for g in groups}}},
        ensure_ascii=False, separators=(",", ":")))
    update_history(groups, hist, today)
    annotate_changes(groups, hist, today)
    (DATA / "products.json").write_text(json.dumps(groups, ensure_ascii=False, separators=(",", ":")))
    (DATA / "alias.json").write_text(json.dumps(ALIASES, separators=(",", ":")))   # act. 50
    (DATA / "history.json").write_text(json.dumps(hist, separators=(",", ":")))
    (DATA / "armar.json").write_text(json.dumps(armar_catalog(groups), ensure_ascii=False, separators=(",", ":")))
    (DATA / "armar_per.json").write_text(json.dumps(armar_catalog(groups, ARMAR_PER_CATS), ensure_ascii=False, separators=(",", ":")))
    (DATA / "encontra.json").write_text(json.dumps(armar_catalog(groups, ENCONTRA_CATS), ensure_ascii=False, separators=(",", ":")))
    (DATA / "home.json").write_text(json.dumps(home_summary(groups), ensure_ascii=False, separators=(",", ":")))
    (DATA / "buscar.json").write_text(json.dumps(search_index(groups), ensure_ascii=False, separators=(",", ":")))
    write_shards(groups, hist)
    write_categories(groups, hist)
    write_sitemap(groups, dt.datetime.now(dt.timezone.utc).isoformat())
    pub = {}   # act. 50: ofertas publicadas por tienda (Tiendas ya no baja el catálogo entero, 3,3 MB, para contarlas)
    for g in groups:
        for o in g["offers"] + g.get("old_offers", []):
            pub[o["store"]] = pub.get(o["store"], 0) + 1
    for name, st in status.items():
        if isinstance(st, dict):
            st["en_catalogo"] = pub.get(name, 0)
    (DATA / "meta.json").write_text(json.dumps({
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
        "stores": status, "specs": spec_status, "groups": len(groups), "demo": False}, ensure_ascii=False))
    print(json.dumps(status, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(set(sys.argv[1:]))
