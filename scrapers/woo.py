"""Tiendas WooCommerce que publican su catálogo por la API pública de WooCommerce (`/wp-json/wc/store/v1/products`),
la misma que usa el propio sitio. Antes de agregar una tienda se revisa su robots.txt (ninguna de estas prohíbe el
catálogo ni la API ni tiene pausa mínima) y se pide con la pausa normal del proyecto (1,5 s). Si una tienda responde
403/429 se deja de pedir (ver common.get). El SKU es un código interno de cada tienda: no se usa para cruzar productos.
"""
from .goldentech import parse as _parse, fetch_all

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


def scrape_store(store, base, max_pages=150):   # Max Tecno ~6.000 (60 páginas de 100); The Gamer Shop entrega de a 20 (~137)
    return parse(fetch_all(base, max_pages), store)


def make(store):
    return lambda: scrape_store(store, WOO_STORES[store])
