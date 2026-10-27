"""Tiendas hechas con Tiendanube. Se lee el listado público «/productos/?page=N» (o la categoría indicada), igual que
lo ve un visitante. Cada producto del listado trae sus datos estructurados (JSON-LD «Product»: nombre, precio de lista,
disponibilidad, enlace e imagen) y, si la tienda ofrece descuento por medio de pago, el precio con ese descuento:
  · en el atributo data-priceraw-without-shipping (en centavos) junto al texto «con Transferencia»/«Efectivo», o
  · en data-variants (price_with_payment_discount_short), según el tema de la tienda.
Ese precio con descuento se toma como precio contado; el del JSON-LD como precio de lista.

robots.txt de Tiendanube (revisado el 2026-10-26 en las cinco tiendas): solo prohíbe /admin, /checkout, /comprar,
/search y parámetros de vista previa; el listado /productos/ y ?page= están permitidos.
"""
import html as _html
import json
import re
from .common import get, parse_ars, product, canon_category
from .goldentech import _plain

# nombre en el comparador -> (sitio, listado)
TN_STORES = {
    "37 Bytes": ("https://www.37bytes.com.ar", "/productos/"),
    "ShopGamer": ("https://www.shopgamer.com.ar", "/productos/"),
    "Integrados Argentinos": ("https://www.integradosargentinos.com", "/productos/"),
    "Slot One": ("https://www.slot-one.com.ar", "/productos/"),
    "Vertex Retail": ("https://vrx.com.ar", "/computacion-y-gaming/"),   # el resto del sitio son muebles de oficina
}

_LD = re.compile(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
_RAW = re.compile(r'data-priceraw-without-shipping="(\d+)"')
_VAR = re.compile(r'price_with_payment_discount_short(?:&quot;|")\s*:\s*(?:&quot;|")([^&"]+)')


def parse(html, store):
    out, prev = [], 0
    for m in _LD.finditer(html):
        chunk, prev = html[prev:m.end()], m.end()     # el bloque del producto termina en su JSON-LD
        try:
            ld = json.loads(m.group(1))
        except ValueError:
            continue
        if not isinstance(ld, dict) or ld.get("@type") != "Product":
            continue
        off = ld.get("offers") or {}
        if isinstance(off, list):
            off = off[0] if off else {}
        if off.get("priceCurrency") not in (None, "ARS"):
            continue
        try:
            lst = float(off.get("price"))
        except (TypeError, ValueError):
            continue
        if not lst or not ld.get("name"):
            continue
        cash = None
        r = _RAW.search(chunk)
        if r:
            cash = int(r.group(1)) / 100
        else:
            v = _VAR.search(chunk)
            cash = parse_ars(_html.unescape(v.group(1))) if v else None
        if not cash or cash >= lst:
            cash, lst = lst, None
        av = str(off.get("availability") or "")
        stock = True if av.endswith("InStock") else False if av.endswith(("OutOfStock", "SoldOut")) else None
        name = re.sub(r"\s+", " ", _html.unescape(ld["name"])).strip()
        img = ld.get("image")
        img = img[0] if isinstance(img, list) and img else img
        url = off.get("url") or (ld.get("mainEntityOfPage") or {}).get("@id")
        p = product(store, name, url, cash, lst, stock=stock, image=img if isinstance(img, str) else None,
                    category=canon_category(name))
        p["store_sku"] = ld.get("sku") or None
        if p["category"] in ("perifericos", "mouses", "teclados", "auriculares") and ld.get("description"):
            p["desc"] = _plain(str(ld["description"]))        # texto de la propia tienda (ver descspecs.py)
        out.append(p)
    return out


def scrape_store(store, base, path, max_pages=150):
    out, seen = [], set()
    for page in range(1, max_pages + 1):
        html = get(f"{base}{path}" + (f"?page={page}" if page > 1 else ""))
        items = [i for i in parse(html, store) if i["url"] not in seen]
        if not items:                                  # página vacía o repetida: se terminó el catálogo
            break
        seen.update(i["url"] for i in items)
        out += items
    return out


def make(store):
    base, path = TN_STORES[store]
    return lambda: scrape_store(store, base, path)
