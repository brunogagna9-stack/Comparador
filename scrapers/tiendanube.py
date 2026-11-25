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
    # actualización 37 (robots.txt revisado el 2026-11-06). Su catálogo completo son ~8.100 productos en páginas de
    # 2,3 MB, con impresoras, TV, cámaras y robots aspiradores: se leen solo sus categorías de computación.
    "Nickhard": ("https://nickhard.com.ar", (
        "/componentes-de-pc/", "/almacenamiento/discos-ssd-11sx5/", "/almacenamiento/discos-rigidos-n5ijp/",
        "/pc-y-notebooks/", "/audio-y-video/monitores-28l43/", "/perifericos-y-gaming/",
        "/redes-y-seguridad/routers-y-wi-fi-1mrp9/")),
    # actualización 47 (robots.txt revisado el 2026-11-23 desde GitHub con el agente ComparadorARBot: permite estos
    # listados). Se leen solo sus categorías de computación; las unidades «OUTLET» quedan separadas como usadas.
    "Quantum Hardstore": ("https://quantumhardstore.com", (
        "/componentes/", "/perifericos/", "/monitor/", "/notebook/", "/pcs-gamers2/")),
}

_LD = re.compile(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', re.S)
_RAW = re.compile(r'data-priceraw-without-shipping="(\d+)"')
_VAR = re.compile(r'price_with_payment_discount_short(?:&quot;|")\s*:\s*(?:&quot;|")([^&"]+)')
# cuotas que muestra la tarjeta del listado (actualización 38): «18 x $19.555,56 sin interés»
_CUO = re.compile(r"js-max-installments product-installments([^\"']*)[\"'][^>]*>\s*<span[^>]*js-installment-amount[^>]*>\s*(\d+)\s*</span>"
                  r".{0,300}?js-installment-price[^>]*>\s*([^<]+?)\s*</span>(.{0,120})", re.S)


# act. 47: temas que no dibujan las cuotas en la tarjeta (Quantum) pero las traen en los datos de la variante:
# installments_data = {"<medio>": {"<n>": {"installment_value": ..., "without_interests": true, ...}}}
_INST = re.compile(r'installments_data(?:&quot;|")\s*:\s*(?:&quot;|")(\{.*?\}\}\})')


def _cuotas_datos(chunk):
    m = _INST.search(chunk)
    if not m:
        return None
    raw = _html.unescape(m.group(1)).replace('\\"', '"').replace("\\/", "/")
    try:
        d = json.loads(raw)
    except ValueError:
        return None
    best = None                                  # (sin interés, n, valor): gana sin interés y después más cuotas
    for plan in (d.values() if isinstance(d, dict) else []):
        for k, v in (plan.items() if isinstance(plan, dict) else []):
            try:
                n, val = int(k), float(v.get("installment_value"))
            except (TypeError, ValueError, AttributeError):
                continue
            sin = bool(v.get("without_interests")) or v.get("interest") in (0, 0.0)
            if n >= 2 and val > 0 and (best is None or (sin, n) > best[:2]):
                best = (sin, n, val)
    if not best:
        return None
    sin, n, val = best
    return f"{n} cuotas{' sin interés' if sin else ''} de $ {round(val):,}".replace(",", ".")


def cuotas_of(chunk):
    """«18 cuotas sin interés de $ 19.556» (mismo formato que las otras tiendas) o None."""
    m = _CUO.search(chunk)
    if not m:
        return _cuotas_datos(chunk)
    n, val = int(m.group(2)), parse_ars(_html.unescape(m.group(3)))
    if n < 2 or not val:
        return None
    sin = "no-interest" in m.group(1) or re.search(r"sin inter", m.group(4), re.I)
    return f"{n} cuotas{' sin interés' if sin else ''} de $ {round(val):,}".replace(",", ".")


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
        p["cuotas"] = cuotas_of(chunk)
        if p["category"] in ("perifericos", "mouses", "teclados", "auriculares", "notebooks") and ld.get("description"):
            p["desc"] = _plain(str(ld["description"]))        # texto de la propia tienda (ver descspecs.py)
        out.append(p)
    return out


def scrape_store(store, base, path, max_pages=150):
    """path: un listado o varios (tupla). Un producto que aparece en dos categorías se cuenta una sola vez."""
    out, seen = [], set()
    for p in ((path,) if isinstance(path, str) else path):
        here = set()
        for page in range(1, max_pages + 1):
            html = get(f"{base}{p}" + (f"?page={page}" if page > 1 else ""))
            fresh = [i for i in parse(html, store) if i["url"] not in here]
            if not fresh:                              # página vacía o repetida: se terminó esa categoría
                break
            here.update(i["url"] for i in fresh)
            out += [i for i in fresh if i["url"] not in seen]
            seen.update(i["url"] for i in fresh)
    return out


def make(store):
    base, path = TN_STORES[store]
    return lambda: scrape_store(store, base, path)
