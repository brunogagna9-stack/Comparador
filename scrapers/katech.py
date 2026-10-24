"""Katech (katech.com.ar): tienda WooCommerce. Misma API pública de catálogo que usa su propio sitio
(`/wp-json/wc/store/v1/products`). Su robots.txt permite todo a los lectores generales; sus señales de contenido
(ai-train=no) son para entrenar modelos de IA, algo que este proyecto no hace: solo lee precios para compararlos.
Precios en centavos; el SKU es un código interno de la tienda (no se usa para cruzar productos)."""
from .common import get
from .goldentech import parse as _parse, PER_PAGE

STORE = "Katech"
BASE = "https://katech.com.ar"


def parse(items):
    return _parse(items, STORE)


def scrape():
    out, page = [], 1
    while page <= 60:
        items = get(f"{BASE}/wp-json/wc/store/v1/products?per_page={PER_PAGE}&page={page}", as_json=True)
        if not isinstance(items, list):
            break
        out += parse(items)
        if len(items) < PER_PAGE:
            break
        page += 1
    return out
