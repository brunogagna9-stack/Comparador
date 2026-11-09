"""GoldenTech Store (goldentechstore.com.ar): tienda WooCommerce.

Usa la API pública de catálogo de WooCommerce (`/wp-json/wc/store/v1/products`), la misma que usa la tienda en su
propio sitio. El robots.txt de la tienda no la prohíbe. Los precios vienen en centavos (currency_minor_unit=2).
El SKU es un código interno de la tienda, NO un número de parte del fabricante: no se usa para cruzar productos.
"""
import html
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


def _plain(h):
    """Descripción de la tienda en texto plano (una línea por ítem de lista), hasta 1500 caracteres."""
    h = re.sub(r"(?i)</(li|p|h\d|div|tr)>|<br\s*/?>", "\n", h)
    t = html.unescape(re.sub(r"<[^>]+>", " ", h))
    return "\n".join(x for x in (re.sub(r"[ \t\xa0]+", " ", l).strip() for l in t.split("\n")) if x)[:1500]


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
        name = re.sub(r"\s+", " ", html.unescape(it["name"])).strip()
        imgs = it.get("images") or []
        p = product(store, name, it.get("permalink"), cash, reg if reg and cash and reg > cash else None,
                    stock=bool(it.get("is_in_stock")), sku=None, pn=None,
                    image=(imgs[0].get("thumbnail") or imgs[0].get("src")) if imgs else None,
                    category=canon_category(name, cats))
        p["store_sku"] = it.get("sku") or None
        if p["category"] in ("perifericos", "mouses", "teclados", "auriculares"):
            d = _plain(it.get("description") or it.get("short_description") or "")
            if d:
                p["desc"] = d
        out.append(p)
    return out


def fetch_all(base, max_pages=80):
    """Recorre la API página por página (actualización 37). Sigue mientras lleguen productos nuevos:
    - si la tienda entrega menos por página de lo pedido (p. ej. 20 en vez de 100), se toma ese tamaño como página llena;
    - si una página repite productos ya vistos (tiendas cuyo servidor ignora ?page=), se corta para no pedir de más."""
    items_all, seen, per, page, n = [], set(), PER_PAGE, 1, 0
    while n < max_pages:
        n += 1
        try:
            items = get(f"{base}/wp-json/wc/store/v1/products?per_page={per}&page={page}", as_json=True)
        except RuntimeError as e:
            if page > 1 and "HTTP 400" in str(e):     # algunas tiendas responden 400 pasado el final del catálogo
                break
            raise
        if not isinstance(items, list) or not items:
            break
        new = [it for it in items if it.get("id") not in seen]
        if not new:                                    # repite una página ya vista: el servidor ignora ?page=
            break
        seen.update(it.get("id") for it in new)
        items_all += new
        if len(items) < per:
            if page == 1 and per == PER_PAGE:
                # La tienda entrega menos de lo pedido pero avanza de a PER_PAGE (The Gamer Shop: 20 de 100):
                # se sigue pidiendo con su tamaño real para no saltear productos.
                per = len(items)
            else:
                break
        page += 1
    return items_all


def scrape():
    return parse(fetch_all(BASE, max_pages=40))
