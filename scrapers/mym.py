"""MyM Computación (mymcomputacion.com, Caballito, CABA) — actualización 49.

Plataforma Qloud. Cada listado de categoría trae un bloque JSON-LD «CollectionPage → ItemList» con los productos de la
página: nombre, URL, foto, código de barras (gtin13/sku), precio y disponibilidad. Se usa solo eso.
robots.txt (revisado el 25/11/2026 con el agente ComparadorARBot) permite las categorías y la paginación ?page=N; prohíbe
?filter=, ?search=, ?orden=, precios mín./máx. y el carrito: no se usan.
El precio publicado es el «Precio especial pagando en efectivo/transferencia» (contado). El de cuotas está en cada ficha y
no se lee (serían cientos de pedidos más): queda sin precio de lista.
"""
import json
import re
from .common import get, product, canon_category

STORE = "MyM Computación"
BASE = "https://mymcomputacion.com"
# categorías de computación (las de cables, cargadores, impresoras, insumos y «varios» no se leen)
CATS = ["placa-de-video", "procesador", "motherboard", "memoria-ram", "almacenamiento", "fuente", "gabinete", "refrigeracion",
        "monitor", "notebook", "pc-armada", "combo-actualizacion", "perifericos", "conectividad"]
MAX_PAGES = 40
# categoría de la tienda -> categoría del comparador (el título solo no alcanza: «Procesador … Sin Cooler» caía en
# refrigeración). Periféricos, conectividad y combos se clasifican por el título.
CAT_MAP = {"placa-de-video": "placas-de-video", "procesador": "procesadores", "motherboard": "motherboards", "memoria-ram": "memorias-ram",
           "almacenamiento": "almacenamiento", "fuente": "fuentes", "gabinete": "gabinetes", "refrigeracion": "refrigeracion",
           "monitor": "monitores", "notebook": "notebooks", "pc-armada": "pcs-armadas"}
_LD = re.compile(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', re.S)
_TOTAL = re.compile(r"(\d+)\s*art(?:&iacute;|í)culos en total")


def parse(html, cat=None):
    """Productos del ItemList de la página (lista vacía si no hay)."""
    out = []
    for raw in _LD.findall(html):
        try:
            d = json.loads(raw)
        except ValueError:
            continue
        if not isinstance(d, dict) or d.get("@type") != "CollectionPage":
            continue
        for li in ((d.get("mainEntity") or {}).get("itemListElement") or []):
            it = (li or {}).get("item") or {}
            off = it.get("offers") or {}
            if it.get("@type") != "Product" or off.get("priceCurrency") not in (None, "ARS"):
                continue
            try:
                price = float(off.get("price"))
            except (TypeError, ValueError):
                continue
            name, url = " ".join(str(it.get("name") or "").split()), it.get("url") or li.get("url")
            if not name or not url or price <= 0:
                continue
            av = str(off.get("availability") or "")
            stock = True if av.endswith("InStock") else False if av.endswith(("OutOfStock", "SoldOut")) else None
            p = product(STORE, name, url, price, None, stock=stock, image=it.get("image") if isinstance(it.get("image"), str) else None,
                        category=CAT_MAP.get(cat) or canon_category(name))
            p["store_id"] = url
            p["store_sku"] = it.get("gtin13") or (str(it.get("sku") or "").lstrip("0") or None)
            out.append(p)
    return out


def total_of(html):
    m = _TOTAL.search(html)
    return int(m.group(1)) if m else None


def scrape():
    seen, out = set(), []
    for cat in CATS:
        total = None
        for page in range(1, MAX_PAGES + 1):
            if total is not None and len([i for i in out if i.get("_cat") == cat]) >= total:
                break                                  # la tienda responde 404 después de la última página
            url = f"{BASE}/{cat}/" + (f"?page={page}" if page > 1 else "")
            try:
                html = get(url)
            except Exception as e:
                print(f"[MyM] {url}: {e}")
                break
            if page == 1:
                total = total_of(html)
            new = [i for i in parse(html, cat) if i["store_id"] not in seen]
            if not new:
                break
            for i in new:
                i["_cat"] = cat
            seen.update(i["store_id"] for i in new)
            out += new
    for i in out:
        i.pop("_cat", None)
    return out
