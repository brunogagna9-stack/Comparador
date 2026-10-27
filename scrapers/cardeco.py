"""Tiendas de una misma plataforma de e-commerce argentina (tarjetas «card-ecommerce», URLs «…-ID.html»):
Rocket Hard, Acuario Insumos, Megasoft, Hyper Gaming y Noxie Store.

Cómo se lee (igual que un visitante): el sitemap.xml de la tienda da las categorías principales («/hardware/»,
«/perifericos/»…) y cada una se recorre con «?page=N» (30 a 48 productos por página). robots.txt de las cinco
(revisado el 2026-10-26): permite todo salvo carrito, cuenta y los parámetros de orden/filtro/búsqueda
(?orden=, ?ordenAZ=, ?filter=, ?search=…), que acá no se usan.

Precios de cada tarjeta:
  · «Precio especial» (h4.pecio_final, atributo data-precio) -> precio contado. En la ficha de Rocket Hard la tienda
    lo explica: «Precio final abonando en Efectivo o Transferencia bancaria». Hyper Gaming lo llama «HYPER PRECIO».
  · «Precio lista» (h6.solo_web) y el precio con tarjeta (h6.precio_mp, oculto) -> precio de lista (el mayor).
Stock: el texto «En stock» de la tarjeta.
"""
import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

CE_STORES = {
    "Rocket Hard": "https://rockethard.com.ar",
    "Acuario Insumos": "https://insumosacuario.com.ar",
    "Megasoft": "https://megasoftargentina.com.ar",
    "Hyper Gaming": "https://hypergaming.com.ar",
    "Noxie Store": "https://noxiestore.com",
}
# páginas del sitemap que no son categorías de producto (o que repiten productos de otras categorías)
_SKIP = re.compile(r"contacto|nosotros|politica|privacidad|lista-de-precios|atencion|garantia|novedades|bajaron|"
                   r"electrodomestico|hogar|domotica|seguridad|smart-watch|butaca|silla|escritorio|impresora|insumos-de", re.I)


def parse(html, store, hint=""):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for card in soup.select(".card-ecommerce"):
        a = card.select_one(".card-title a")
        fin = card.select_one(".pecio_final")
        if not a or not fin or not a.get("href"):
            continue
        cash = parse_ars(fin.get("data-precio")) or parse_ars((fin.select_one("b") or fin).get_text())
        if not cash:
            continue
        lists = [parse_ars(e.get_text()) for e in card.select(".solo_web, .precio_mp")]
        lst = max([x for x in lists if x] or [0]) or None
        st = card.select_one(".card-category .pull-right")
        txt = st.get_text(" ", strip=True).lower() if st else ""
        stock = True if "en stock" in txt else False if ("sin stock" in txt or "agotado" in txt) else None
        img = card.select_one(".imagen img") or card.select_one("a img")
        code = card.select_one(".articulo_field")
        name = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        p = product(store, name, a["href"], cash, lst if lst and lst > cash else None, stock=stock,
                    image=(img.get("data-src") or img.get("src")) if img else None,
                    category=canon_category(name, hint.replace("-", " ")))
        p["store_sku"] = code.get_text(strip=True) if code else None
        out.append(p)
    return out


def categories(base):
    xml = get(f"{base}/sitemap.xml")
    locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
    host = re.escape(base.split("//", 1)[1])
    top = [u for u in locs if re.fullmatch(rf"https?://(www\.)?{host}/[^/]+/", u)]
    return [u for u in dict.fromkeys(top) if not _SKIP.search(u.rstrip("/").rsplit("/", 1)[-1])]


def scrape_store(store, base, max_pages=40):
    out, seen = [], set()
    for cat in categories(base):
        slug, here = cat.rstrip("/").rsplit("/", 1)[-1], set()
        for page in range(1, max_pages + 1):
            html = get(cat if page == 1 else f"{cat}?page={page}")
            got = parse(html, store, slug)
            urls = {i["url"] for i in got}
            if not got or urls <= here:               # página vacía o repetida: fin de la categoría
                break
            here |= urls
            for i in got:
                if i["url"] not in seen:
                    seen.add(i["url"])
                    out.append(i)
    return out


def make(store):
    return lambda: scrape_store(store, CE_STORES[store])
