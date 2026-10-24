"""GoldenTech Store (goldentechstore.com.ar): tienda WooCommerce.

Usa la API pública de catálogo de WooCommerce (`/wp-json/wc/store/v1/products`), la misma que usa la tienda en su
propio sitio. El robots.txt de la tienda no la prohíbe. Los precios vienen en centavos (currency_minor_unit=2).
El SKU es un código interno de la tienda, NO un número de parte del fabricante: no se usa para cruzar productos.
"""
import re
from .common import get, product, canon_category

STORE = "GoldenTech"
BASE = "https://goldentechstore.com.ar"
PER_PAGE = 100


def _money(prices, key):
    try:
        minor = int(prices.get("currency_minor_unit", 2))
        v = int(prices.get(key) or 0) / (10 ** minor)
        return v or None
    except (TypeError, ValueError):
        return None


def parse(items, store=STORE):
    out = []
    for it in items:
        if it.get("type") not in (None, "simple") or not it.get("name"):
            continue
        pr = it.get("prices") or {}
        if pr.get("currency_code") not in (None, "ARS"):
            continue
        cash, reg = _money(pr, "price"), _money(pr, "regular_price")
        cats = " ".join(c.get("name", "") for c in it.get("categories") or [])
        name = re.sub(r"\s+", " ", it["name"]).strip()
        imgs = it.get("images") or []
        p = product(store, name, it.get("permalink"), cash, reg if reg and cash and reg > cash else None,
                    stock=bool(it.get("is_in_stock")), sku=None, pn=None,
                    image=(imgs[0].get("thumbnail") or imgs[0].get("src")) if imgs else None,
                    category=canon_category(name, cats))
        p["store_sku"] = it.get("sku") or None
        out.append(p)
    return out


def scrape():
    out, page, total_pages = [], 1, 1
    while page <= total_pages and page <= 40:
        url = f"{BASE}/wp-json/wc/store/v1/products?per_page={PER_PAGE}&page={page}"
        items = get(url, as_json=True)
        if not isinstance(items, list):
            break
        out += parse(items)
        if len(items) < PER_PAGE:
            break
        page += 1
    return out
