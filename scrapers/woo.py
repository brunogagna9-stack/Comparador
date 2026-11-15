"""Tiendas WooCommerce que publican su catálogo por la API pública de WooCommerce (`/wp-json/wc/store/v1/products`),
la misma que usa el propio sitio. Antes de agregar una tienda se revisa su robots.txt (ninguna de estas prohíbe el
catálogo ni la API ni tiene pausa mínima) y se pide con la pausa normal del proyecto (1,5 s). Si una tienda responde
403/429 se deja de pedir (ver common.get). El SKU es un código interno de cada tienda: no se usa para cruzar productos.
"""
from .goldentech import parse as _parse, fetch_all
from .common import get

# nombre en el comparador -> sitio base
WOO_STORES = {
    "BitHard": "https://bithard.com.ar",
    "Try": "https://try.com.ar",
    "SCP Hardstore": "https://www.scphardstore.com",
    "Click Gaming": "https://clickgaming.com.ar",
    "The Gamer Shop": "https://thegamershop.com.ar",
    # actualización 15 (robots.txt revisado el 2026-10-26: ninguna prohíbe la API ni pide pausa)
    "Backup Computación": "https://backupcomputacion.com.ar",
    "Max Tecno": "https://maxtecno.com.ar",
    "HF Tecnología": "https://hftecnologia.com.ar",
    "Liontech Gaming": "https://www.liontech-gaming.com",
    "Dinobyte": "https://dinobyte.ar",
}


def parse(items, store):
    return _parse(items, store)


def scrape_store(store, base, max_pages=150):   # Max Tecno ~6.000 (60 páginas de 100); The Gamer Shop entrega de a 20 (~137)
    return parse(fetch_all(base, max_pages), store)


# Actualización 42: tiendas cuya API corta el listado general (The Gamer Shop entrega solo 10 páginas de 20 y después
# responde «Usá la búsqueda o las categorías de la tienda»). Se hace lo que la tienda indica: se lee categoría por
# categoría, cada una con su mismo tope de 10 páginas (las que tienen más de 200 productos quedan en 200; no se usan
# trucos para pasar ese límite). Solo las ramas de hardware y periféricos.
BY_CATEGORY = {"The Gamer Shop": ("componentes-de-pc", "perifericos", "monitores", "pcs-y-notebooks", "placas-vga",
                                  "computadoras-cx", "redes-y-conectividad")}
CAT_MAX_PAGES = 10


def categories(base):
    """Todas las categorías de la tienda (API pública /products/categories), de a 100."""
    out = []
    for page in range(1, 11):
        part = get(f"{base}/wp-json/wc/store/v1/products/categories?per_page=100&page={page}", as_json=True)
        if not isinstance(part, list) or not part:
            break
        out += part
        if len(part) < 100:
            break
    return out


def category_ids(cats, roots):
    """Ids de las categorías raíz (por slug) y de todas sus subcategorías, sin las vacías."""
    kids = {}
    for c in cats:
        kids.setdefault(c.get("parent"), []).append(c)
    ids, todo = [], [c for c in cats if c.get("slug") in roots]
    while todo:
        c = todo.pop(0)
        if c["id"] in ids:
            continue
        if c.get("count", 1):
            ids.append(c["id"])
        todo += kids.get(c["id"], [])
    return ids


def scrape_by_category(store, base, roots):
    seen, items = set(), []
    for cid in category_ids(categories(base), roots):
        for it in fetch_all(base, CAT_MAX_PAGES, f"&category={cid}"):
            if it.get("id") not in seen:      # un producto en dos categorías se cuenta una vez
                seen.add(it.get("id"))
                items.append(it)
    return parse(items, store)


def make(store):
    if store in BY_CATEGORY:
        return lambda: scrape_by_category(store, WOO_STORES[store], BY_CATEGORY[store])
    return lambda: scrape_store(store, WOO_STORES[store])
