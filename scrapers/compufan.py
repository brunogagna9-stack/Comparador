"""Compufan Store (compufanstore.com.ar): sitio GlobalBluePoint. robots.txt (revisado el 2026-10-26): «Allow: /».
El sitemap.xml lista las subcategorías («/ARTICULOS/…/CAT_ID=…/SCAT_ID=…/…aspx», ~600) y cada listado se pagina con
«A_PAGENUMBER=N» (30 productos por página), como los botones de la propia tienda.

Precio: el listado muestra un precio y, a veces, uno anterior tachado; la tienda no aclara en el listado a qué medio
de pago corresponde, así que se guarda como precio de LISTA (no se afirma que sea contado). Stock: no se informa.
"""
import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "Compufan Store"
BASE = "https://www.compufanstore.com.ar"
_SKIP = re.compile(r"/ARTICULOS/(Celular|Tablet|Smart|Impres|Consola|Juguete|Hogar|Electro|Camara|Seguridad|Cartucho|Toner)", re.I)


def parse(html, hint=""):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for box in soup.select("div.product"):
        a = box.select_one("a.titprod")
        pr = box.select_one(".price")
        if not a or not pr or not a.get("href"):
            continue
        price = parse_ars(pr.get_text())
        if not price or price < 100:
            continue
        name = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        img = box.select_one(".image img")
        src = img.get("src") if img else None
        if src and src.startswith("http://"):
            src = "https://" + src[len("http://"):]
        ean = box.select_one(".codigoEAN")
        p = product(STORE, name, urljoin(BASE + "/", a["href"]), None, price, stock=None, image=src,
                    category=canon_category(name, hint))
        p["store_sku"] = ean.get_text(strip=True) if ean else None
        out.append(p)
    return out


def listings():
    xml = get(BASE + "/sitemap.xml")
    urls = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
    return [u for u in dict.fromkeys(urls) if "/ARTICULOS/" in u and "SCAT_ID=" in u and not _SKIP.search(u)]


def page_url(u, n):
    """…/ARTICULOS/X/CAT_ID=1/SCAT_ID=2/m=0/BUS=/compufanstore.aspx -> …/ARTICULOS/X;CAT_ID=1;…;A_PAGENUMBER=n;/compufanstore.aspx"""
    head, tail = u.rsplit("/", 1)
    pre, rest = head.split("/ARTICULOS/", 1)
    return f"{pre}/ARTICULOS/{rest.replace('/', ';')};A_PAGENUMBER={n};/{tail}"


def scrape(max_pages=20):
    out, seen = [], set()
    for u in listings():
        hint = u.split("/ARTICULOS/", 1)[1].split("/", 1)[0].replace("-", " ")
        for n in range(1, max_pages + 1):
            got = parse(get(u if n == 1 else page_url(u, n)), hint)
            new = [i for i in got if i["url"] not in seen]
            seen.update(i["url"] for i in new)
            out += new
            if len(got) < 30 or not new:
                break
    return out
