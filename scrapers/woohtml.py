"""Tiendas WooCommerce cuyo robots.txt PROHÍBE la API (/wp-json/wc/) pero permite las páginas del catálogo.
Se lee el listado HTML «/tienda/page/N/» (30 productos por página), con la pausa normal del proyecto.

HardCore Computación (hardcorecomputacion.com.ar): robots.txt con «Disallow: /wp-json/wc/» y sin restricción para
/tienda/; también prohíbe los filtros (?orderby=, ?filter_…, ?s=…) que acá no se usan. Bloquea a bots de IA por nombre
(ClaudeBot, GPTBot…), pero nuestro recolector se identifica como ComparadorARBot y cae en «User-agent: *».
El precio que muestra la tienda se toma como precio contado (igual que en las demás WooCommerce); el tachado como lista.
"""
import re
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

HTML_STORES = {"HardCore": "https://hardcorecomputacion.com.ar"}


def _amount(el):
    return parse_ars(el.get_text(" ", strip=True)) if el else None


def parse(html, store):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for box in soup.select(".product.type-product"):
        cls = " ".join(box.get("class") or [])
        if "product-type-simple" not in cls:          # armados a medida, variables: sin un precio único
            continue
        a = box.select_one(".product-title a, .woocommerce-loop-product__title a, a.woocommerce-LoopProduct-link")
        price = box.select_one(".price")
        if not a or not price:
            continue
        ins, dele = price.select_one("ins .amount"), price.select_one("del .amount")
        cash = _amount(ins) if ins else _amount(price.select_one(".amount"))
        lst = _amount(dele)
        if not cash:
            continue
        st = box.select_one(".stock")
        txt = st.get_text(" ", strip=True).lower() if st else ""
        stock = False if ("outofstock" in cls or "sin stock" in txt or "agotado" in txt) else True if ("instock" in cls or "disponible" in txt) else None
        img = box.select_one("img")
        cats = " ".join(c[len("product_cat-"):].replace("-", " ") for c in (box.get("class") or []) if c.startswith("product_cat-"))
        name = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        p = product(store, name, a["href"], cash, lst if lst and lst > cash else None, stock=stock,
                    image=(img.get("data-src") or img.get("src")) if img else None, category=canon_category(name, cats))
        b = box.select_one("[data-product_sku]")
        p["store_sku"] = (b.get("data-product_sku") or None) if b else None
        out.append(p)
    return out


def last_page(html):
    nums = [int(n) for n in re.findall(r"/page/(\d+)/", html)]
    return max(nums) if nums else 1


def scrape_store(store, base, max_pages=60):
    first = get(f"{base}/tienda/")
    out, seen = [], set()
    for page in range(1, min(last_page(first), max_pages) + 1):
        html = first if page == 1 else get(f"{base}/tienda/page/{page}/")
        items = [i for i in parse(html, store) if i["url"] not in seen]
        seen.update(i["url"] for i in items)
        out += items
    return out


def make(store):
    return lambda: scrape_store(store, HTML_STORES[store])
