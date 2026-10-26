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
import re
import sys
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


def gid(offers):
    pns = sorted(set().union(*[pn_tokens(o) for o in offers])) if offers else []
    base = pns[0] if pns else re.sub(r"[^a-z0-9]+", "-", offers[0]["name"].lower())[:60]
    return base.strip("-")


# ---------- imágenes ----------
# Imágenes "sin foto" que las tiendas ponen en su lugar: no sirven y se descartan.
PLACEHOLDER_RE = re.compile(r"es-default-|no[-_]?image|sin[-_]?imagen|placeholder|noimg|no[-_]?photo|"
                            r"image[-_]?not[-_]?found|default[-_]?image|/default\.(jpg|png|webp)", re.I)
IMG_RANK = ["Compragamer", "Logg", "MEXX", "Venex", "Gaming City", "NET Gaming", "Katech", "Hardloots", "Click Gaming", "SCP Hardstore", "The Gamer Shop", "Try", "BitHard", "GoldenTech", "Maximus", "Armytech"]   # de más a menos nítidas


def good_image(url):
    return url if url and isinstance(url, str) and url.startswith("http") and not PLACEHOLDER_RE.search(url) else None


def hq_image(url):
    """Compragamer publica miniaturas (-mini, 100 px); la misma foto sin el sufijo mide 750 px."""
    if url and "imagenes.compragamer.com" in url and url.endswith("-mini.jpg"):
        return url[:-len("-mini.jpg")] + ".jpg"
    return url


def pick_image(offers):
    """(imagen, imagen de respaldo): la mejor foto válida entre TODAS las tiendas que venden el producto."""
    cands = sorted((o for o in offers if good_image(o.get("image"))),
                   key=lambda o: IMG_RANK.index(o["store"]) if o["store"] in IMG_RANK else 99)
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
    for offers in group([i for i in all_items if price_of(i) and not is_service(i["name"])
                         and not is_non_hardware(i["name"], i["category"])]):
        offers_all = offers
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
        top = g["offers"][0]
        g["chg"] = top.get("chg")
        g["low"] = top.get("low", False)


def main(only):
    from scrapers import SCRAPERS, common
    DATA.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(exist_ok=True)
    hist = load_history()
    seed_from_raw(hist)
    status, all_items = {}, []
    for store, fn in SCRAPERS.items():
        raw = RAW / f"{store}.json"
        if only and store not in only:
            if raw.exists():
                all_items += read_raw(raw)
            continue
        common.LOG.clear()
        try:
            items = fn()
            if not items:
                raise RuntimeError("0 productos")
            raw.write_text(json.dumps(items, ensure_ascii=False))
            status[store] = {"ok": True, "count": len(items)}
        except Exception as e:
            why = " | ".join(common.LOG[:3]) or str(e)
            print(f"[{store}] ERROR: {why}")
            items = read_raw(raw) if raw.exists() else []
            status[store] = {"ok": False, "count": len(items), "error": why[:400], "stale": bool(items)}
        all_items += items
    today = dt.date.today().isoformat()
    groups = build(all_items, load_extra_images())
    from scrapers import specs
    try:
        spec_items, spec_status = specs.refresh(all_items, RAW, only or None)
    except Exception as e:  # las fichas nunca deben romper la actualización de precios
        spec_items, spec_status = {}, {"ok": False, "error": str(e)[:300]}
    spec_status["vinculadas"] = specs.attach(groups, spec_items)
    for g in groups:
        g.pop("_pns", None)
    (DATA / "specs.json").write_text(json.dumps({
        "v": 1, "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
        "sources": {"Compragamer": "https://static.compragamer.com/productos_caracteristicas"},
        "items": {k: v for k, v in spec_items.items() if k in {g.get("spec") for g in groups}}},
        ensure_ascii=False, separators=(",", ":")))
    update_history(groups, hist, today)
    annotate_changes(groups, hist, today)
    (DATA / "products.json").write_text(json.dumps(groups, ensure_ascii=False, separators=(",", ":")))
    (DATA / "history.json").write_text(json.dumps(hist, separators=(",", ":")))
    (DATA / "meta.json").write_text(json.dumps({
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
        "stores": status, "specs": spec_status, "groups": len(groups), "demo": False}, ensure_ascii=False))
    print(json.dumps(status, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(set(sys.argv[1:]))
