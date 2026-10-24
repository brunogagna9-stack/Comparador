"""Compragamer: usa los mismos archivos JSON públicos que carga su propio sitio."""
import re
from .common import get, product, canon_category, CG_SUBCATS

STORE = "Compragamer"
BASE = "https://static.compragamer.com"


def slug(name, pid):
    return "https://compragamer.com/producto/" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") + f"_{pid}"


IMG = "https://imagenes.compragamer.com/productos/compragamer_Imganen_general_{}-mini.jpg"


def cat_from_subcat(txt, name):
    t = (txt or "").strip().lower()
    for key, slug in CG_SUBCATS.items():
        if t.startswith(key):
            return slug
    return canon_category(name)


def parse(items, subcats=None, brands=None):
    subcats = subcats or {}
    out = []
    for it in items:
        name = it.get("nombre")
        pid = it.get("id_producto")
        if not name or pid is None or it.get("visible_solo_en_combo"):
            continue
        cash, lst = it.get("precioEspecial"), it.get("precioLista")
        codes = it.get("codigo_principal") or []
        sku = codes[0] if isinstance(codes, list) and codes else (codes or None)
        if sku:
            sku = re.sub(r"^\s*SKU:\s*", "", sku).strip()
        imgs = it.get("imagenes") or []
        img = None
        if imgs and isinstance(imgs[0], dict) and imgs[0].get("nombre"):
            img = IMG.format(imgs[0]["nombre"])
        prev = it.get("precioEspecialAnterior")
        pr = (product(STORE, name, slug(name, pid), cash, lst,
                           stock=(it.get("stock") or 0) > 0 and bool(it.get("vendible", 1)),
                           sku=sku, pn=sku, image=img,
                           category=cat_from_subcat(subcats.get(it.get("id_subcategoria")), name),
                           prev_cash=prev if prev and prev != cash else None))
        pr["pid"] = pid
        pr["warranty_months"] = it.get("garantia") or None
        out.append(pr)
    return out


def scrape():
    items = get(f"{BASE}/productos", as_json=True)
    try:
        subs = get(f"{BASE}/subcategorias", as_json=True)
        subcats = {s.get("id_subcategoria", s.get("id")): s.get("subCate", s.get("nombre")) for s in subs}
    except Exception:
        subcats = {}
    return parse(items, subcats)
