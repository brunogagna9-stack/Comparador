"""XT-PC (xt-pc.com.ar): HTML de los listados de categoría «/cat/supra/{id}/{nombre}/{página}» (12 productos por
página). robots.txt (revisado el 2026-10-26) solo prohíbe /_class, /_func, /_screens, /_special, /css, /feed,
/carrusel, /cart, /order y /checkout: los listados /cat/ están permitidos.

Precios: «.price» es el «Precio especial» que la tienda aclara como pago con débito, transferencia o efectivo
(-> contado) y «.price-promo» el precio de lista. El listado no informa stock (queda sin confirmar).
"""
import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "XT-PC"
BASE = "https://www.xt-pc.com.ar"
# categorías de hardware de PC y periféricos (se dejan afuera impresoras, consolas, tablets, cámaras, software…)
CATS = [(1, "microprocesador"), (2, "motherboard"), (3, "placas-de-video"), (4, "memorias"), (12, "almacenamiento"),
        (26, "fuentes"), (23, "refrigeracion"), (6, "gabinetes"), (18, "monitores"), (32, "notebooks"),
        (5, "equipos"), (8, "teclados"), (14, "mouses"), (28, "auriculares-y-microfonos"), (27, "conectividad-y-redes"),
        (54, "accesorios")]


def parse(html, hint=""):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for box in soup.select("div.item.product-list"):
        a = box.select_one('a[href^="/prod/"]') or box.select_one("a[href*='/prod/']")
        h3 = box.select_one("h3")
        pr = box.select_one(".price")
        if not a or not h3 or not pr:
            continue
        promo = pr.select_one(".price-promo")
        lst = parse_ars(promo.get_text()) if promo else None
        if promo:
            promo.extract()
        cash = parse_ars(pr.get_text())
        if not cash:
            continue
        img = box.select_one("img")
        src = img.get("src") if img else None
        name = re.sub(r"\s+", " ", h3.get_text(" ", strip=True))
        m = re.search(r"/prod/(\d+)/", a["href"])
        p = product(STORE, name, urljoin(BASE + "/", a["href"]), cash, lst if lst and lst > cash else None, stock=None,
                    image=urljoin(BASE + "/", src) if src and "noimage" not in src else None,
                    category=canon_category(name, hint.replace("-", " ")))
        p["store_sku"] = m.group(1) if m else None
        out.append(p)
    return out


PER_PAGE = 12


def scrape(max_pages=60):
    # Pasada la última página, el sitio NO devuelve una lista vacía sino otros productos (siempre los mismos):
    # se aprende ese relleno pidiendo una página inexistente y se corta al encontrarlo o con una página incompleta.
    filler = {i["url"] for i in parse(get(f"{BASE}/cat/supra/{CATS[0][0]}/{CATS[0][1]}/999"))}
    out, seen = [], set()
    for cid, slug in CATS:
        for page in range(1, max_pages + 1):
            got = parse(get(f"{BASE}/cat/supra/{cid}/{slug}/{page}"), slug)
            urls = {i["url"] for i in got}
            if not got or (page > 1 and urls <= filler):
                break
            for i in got:
                if i["url"] not in seen:
                    seen.add(i["url"])
                    out.append(i)
            if len(got) < PER_PAGE:
                break
    return out
