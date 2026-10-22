"""Corre los recolectores, cruza productos entre tiendas y escribe los JSON que lee el sitio.

Uso:  python build_data.py            (todas las tiendas)
      python build_data.py MEXX Logg  (solo algunas)
"""
import json
import re
import sys
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "site" / "data"
RAW = ROOT / "raw"

STOP = {"de", "con", "para", "y", "el", "la", "en", "gb", "tb", "mhz", "ghz", "nucleos", "threads",
        "micro", "placa", "video", "memoria", "ram", "disco", "solido", "ssd", "gaming", "box", "oem",
        "procesador", "motherboard", "mother", "gabinete", "fuente", "monitor", "tray", "kit"}


def tokens(name):
    return [t for t in re.split(r"[^a-z0-9]+", name.lower()) if t]


def pn_tokens(item):
    """Números de parte: tokens largos que mezclan letras y números."""
    cands = set()
    for src in (item.get("pn"), item.get("sku")):
        if src and re.search(r"[A-Za-z]", src) and re.search(r"\d", src) and len(src) >= 6:
            cands.add(re.sub(r"[^a-z0-9]", "", src.lower()))
    return cands


def signature(item):
    """Firma por nombre: tokens con dígitos (modelo, capacidad, velocidad) + categoría."""
    toks = [t for t in tokens(item["name"]) if t not in STOP]
    key = sorted({t for t in toks if re.search(r"\d", t) and len(t) >= 3
                  and not re.search(r"(ghz|mhz|mm|cm|hz)$", t)})
    brand = next((t for t in toks if not re.search(r"\d", t)), "")
    return (item["category"], tuple(key)) if len(key) >= 2 else None


def group(items):
    """Agrupa ofertas del mismo producto (unión por PN o por firma de nombre)."""
    parent = list(range(len(items)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a, b):
        parent[find(a)] = find(b)

    seen = {}
    for i, it in enumerate(items):
        keys = [("pn", p) for p in pn_tokens(it)]
        sig = signature(it)
        if sig:
            keys.append(("sig", sig))
        for k in keys:
            if k in seen:
                union(i, seen[k])
            else:
                seen[k] = i
    buckets = {}
    for i in range(len(items)):
        buckets.setdefault(find(i), []).append(items[i])
    return list(buckets.values())


def gid(offers):
    pns = sorted(set().union(*[pn_tokens(o) for o in offers])) if offers else []
    base = pns[0] if pns else re.sub(r"[^a-z0-9]+", "-", offers[0]["name"].lower())[:60]
    return base.strip("-")


def build(all_items, today=None):
    today = today or dt.date.today().isoformat()
    groups = []
    for offers in group([i for i in all_items if i.get("price_cash") or i.get("price_list")]):
        # una sola oferta por tienda: la más barata
        best = {}
        for o in offers:
            cur = best.get(o["store"])
            price = o.get("price_cash") or o.get("price_list")
            if cur is None or price < (cur.get("price_cash") or cur.get("price_list")):
                best[o["store"]] = o
        offers = sorted(best.values(), key=lambda o: o.get("price_cash") or o.get("price_list"))
        main = max(offers, key=lambda o: len(o["name"]))
        groups.append({
            "id": gid(offers), "name": main["name"], "category": main["category"],
            "image": next((o["image"] for o in offers if o.get("image")), None),
            "offers": [{k: o.get(k) for k in ("store", "url", "price_cash", "price_list", "stock", "cuotas", "rating")}
                       for o in offers],
        })
    # ids únicos
    used = {}
    for g in groups:
        n = used.get(g["id"], 0)
        used[g["id"]] = n + 1
        if n:
            g["id"] += f"-{n}"
    return groups


def update_history(groups, today):
    path = DATA / "history.json"
    hist = json.loads(path.read_text()) if path.exists() else {}
    for g in groups:
        h = hist.setdefault(g["id"], {})
        for o in g["offers"]:
            p = o.get("price_cash") or o.get("price_list")
            series = h.setdefault(o["store"], [])
            if series and series[-1][0] == today:
                series[-1][1] = p
            elif not series or series[-1][1] != p or series[-1][0] != today:
                series.append([today, p])
            del series[:-120]  # guarda las últimas 120 mediciones por tienda
    path.write_text(json.dumps(hist, ensure_ascii=False, separators=(",", ":")))


def main(only):
    from scrapers import SCRAPERS
    DATA.mkdir(parents=True, exist_ok=True)
    RAW.mkdir(exist_ok=True)
    status, all_items = {}, []
    for store, fn in SCRAPERS.items():
        if only and store not in only:
            continue
        raw = RAW / f"{store}.json"
        try:
            items = fn()
            if not items:
                raise RuntimeError("0 productos (¿cambió el sitio?)")
            raw.write_text(json.dumps(items, ensure_ascii=False))
            status[store] = {"ok": True, "count": len(items)}
        except Exception as e:
            print(f"[{store}] ERROR: {e}")
            items = json.loads(raw.read_text()) if raw.exists() else []
            status[store] = {"ok": False, "count": len(items), "error": str(e)[:200], "stale": bool(items)}
        all_items += items
    # tiendas que no se corrieron ahora: reutiliza lo último guardado
    for store in SCRAPERS:
        if only and store not in only and (RAW / f"{store}.json").exists():
            all_items += json.loads((RAW / f"{store}.json").read_text())
    today = dt.date.today().isoformat()
    groups = build(all_items, today)
    (DATA / "products.json").write_text(json.dumps(groups, ensure_ascii=False, separators=(",", ":")))
    update_history(groups, today)
    (DATA / "meta.json").write_text(json.dumps({
        "updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
        "stores": status, "groups": len(groups), "demo": False}, ensure_ascii=False))
    print(json.dumps(status, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(set(sys.argv[1:]))
