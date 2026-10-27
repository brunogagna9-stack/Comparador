"""Tiendas WooCommerce que publican su catálogo por la API pública de WooCommerce (`/wp-json/wc/store/v1/products`),
la misma que usa el propio sitio. Antes de agregar una tienda se revisa su robots.txt (ninguna de estas prohíbe el
catálogo ni la API ni tiene pausa mínima) y se pide con la pausa normal del proyecto (1,5 s). Si una tienda responde
403/429 se deja de pedir (ver common.get). El SKU es un código interno de cada tienda: no se usa para cruzar productos.
"""
from .common import get
from .goldentech import parse as _parse, PER_PAGE

# nombre en el comparador -> sitio base
WOO_STORES = {
    "Hardloots": "https://hardloots.com.ar",
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


def scrape_store(store, base, max_pages=80):   # Max Tecno tiene ~6.000 productos (61 páginas de 100)
    out, page = [], 1
    while page <= max_pages:
        items = get(f"{base}/wp-json/wc/store/v1/products?per_page={PER_PAGE}&page={page}", as_json=True)
        if not isinstance(items, list):
            break
        out += parse(items, store)
        if len(items) < PER_PAGE:
            break
        page += 1
    return out


def make(store):
    return lambda: scrape_store(store, WOO_STORES[store])
