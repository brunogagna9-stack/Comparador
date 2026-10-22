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


def pn_tokens(item):
    """Números de parte: tokens largos que mezclan letras y números."""
    cands = set()
    for src in (item.get("pn"), item.get("sku")):
        if src:
            src = re.sub(r"^\s*SKU:\s*", "", str(src))
            if re.search(r"[A-Za-z]", src) and re.search(r"\d", src) and len(src) >= 6:
                cands.add(re.sub(r"[^a-z0-9]", "", src.lower()))
    return cands


def signature(item):
    """Firma por nombre: tokens con dígitos (modelo, capacidad, velocidad) + categoría."""
    toks = [t for t in tokens(item["name"]) if t not in STOP]
    key = sorted({t for t in toks if re.search(r"\d", t) and len(t) >= 3
                  and not re.search(r"(ghz|mhz|mm|cm|hz)$", t)})
    return (item["category"], tuple(key)) if len(key) >= 2 else None


def group(items):
    """Agrupa ofertas del mismo producto (unión por PN o por firma de nombre)."""
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    seen = {}
    for i, it in enumerate(items):
        keys = [("pn", p) for p in pn_tokens(it)]
        sig = signature(it)
        if sig:
            keys.append(("sig", sig))
        for k in keys:
            if k in seen:
                parent[find(i)] = find(seen[k])
            else:
                seen[k] = i
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


def build(all_items):
    groups = []
    for offers in group([i for i in all_items if price_of(i)]):
        best = {}  # una oferta por tienda: la más barata
        for o in offers:
            cur = best.get(o["store"])
            if cur is None or price_of(o) < price_of(cur):
                best[o["store"]] = o
        offers = sorted(best.values(), key=price_of)
        main = max(offers, key=lambda o: len(o["name"]))
        brand = next((b for b in (brand_of(o["name"]) for o in offers) if b), None)
        groups.append({
            "id": gid(offers), "name": main["name"], "category": main["category"], "brand": brand,
            "image": next((o["image"] for o in offers if o.get("image")), None),
            "offers": [dict({k: o.get(k) for k in ("store", "url", "price_cash", "price_list", "stock",
                                                    "cuotas", "rating", "prev_cash")}, k=okey(o)) for o in offers],
        })
    used = {}
    for g in groups:  # ids únicos
        n = used.get(g["id"], 0)
        used[g["id"]] = n + 1
        if n:
            g["id"] += f"-{n}"
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
                all_items += json.loads(raw.read_text())
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
            items = json.loads(raw.read_text()) if raw.exists() else []
            status[store] = {"ok": False, "count": len(items), "error": why[:400], "stale": bool(items)}
        all_items += items
    today = dt.date.today().isoformat()
    groups = build(all_items)
    update_history(groups, hist, today)
    annotate_changes(groups, hist, today)
    (DATA / "products.json").write_text(json.dumps(groups, ensure_ascii=False, separators=(",", ":")))
    (DATA / "history.json").write_text(json.dumps(hist, separators=(",", ":")))
    (DATA / "meta.json").write_text(json.dumps({
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
        "stores": status, "groups": len(groups), "demo": False}, ensure_ascii=False))
    print(json.dumps(status, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(set(sys.argv[1:]))
