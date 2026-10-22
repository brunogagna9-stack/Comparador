"""Compragamer: usa los mismos archivos JSON públicos que carga su propio sitio."""
import re
from .common import get, product, canon_category

STORE = "Compragamer"
BASE = "https://static.compragamer.com"


def slug(name, pid):
    return "https://compragamer.com/producto/" + re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_") + f"_{pid}"


def parse(items, subcats=None, brands=None):
    subcats = subcats or {}
    out = []
    for it in items:
        name = it.get("nombre")
        pid = it.get("id_producto")
        if not name or pid is None:
            continue
        cash, lst = it.get("precioEspecial"), it.get("precioLista")
        codes = it.get("codigo_principal") or []
        sku = codes[0] if isinstance(codes, list) and codes else (codes or None)
        cat_txt = subcats.get(it.get("id_subcategoria"))
        img = None
        imgs = it.get("imagenes")
        if isinstance(imgs, list) and imgs:
            first = imgs[0]
            first = first.get("nombre") if isinstance(first, dict) else first
            if first and str(first).startswith("http"):
                img = first
        out.append(product(STORE, name, slug(name, pid), cash, lst,
                           stock=(it.get("stock") or 0) > 0, sku=sku, pn=sku, image=img,
                           category=canon_category(cat_txt, name)))
    return out


def scrape():
    items = get(f"{BASE}/productos", as_json=True)
    try:
        subs = get(f"{BASE}/subcategorias", as_json=True)
        subcats = {s.get("id_subcategoria", s.get("id")): s.get("subCate", s.get("nombre")) for s in subs}
    except Exception:
        subcats = {}
    return parse(items, subcats)
