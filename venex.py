"""Venex (venex.com.ar): listados de categoría en HTML, paginados con ?page=N.
Su robots.txt prohíbe ?vmm=, ?sort=, ?limit=, ?keywords= y similares: solo se usa ?page=N. El listado no informa stock
(solo un botón «Comprar»): queda como «stock sin confirmar». El precio es «Contado efectivo». Al pasar la última página
la tienda repite la última: se corta cuando una página no trae productos nuevos."""
import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "Venex"
BASE = "https://www.venex.com.ar"
SKIP = re.compile(r"impresion|televisores|merchandising|cargadores|fundas|cartuchos|toners|lectores-codigo|simuladores|"
                  r"pccomponentes|componentes-de-pccomponentes|proyectores", re.I)


def parse(html, hint=""):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for box in soup.select("div.product-box"):
        a = box.select_one("h3.product-box-title a") or box.select_one("a[href]")
        price = box.select_one(".current-price")
        if not a or not price:
            continue
        img = box.select_one("img")
        # el título del listado viene cortado con «...»: el texto completo está en el alt de la imagen
        name = (img.get("alt") if img and img.get("alt") else a.get_text(" ", strip=True)).strip()
        name = re.sub(r"\s+", " ", name)
        cash = parse_ars(price.get_text())
        if not cash:
            continue
        src = img.get("src") if img else None
        out.append(product(STORE, name, urljoin(BASE + "/", a["href"]), cash, None, stock=None, sku=None, pn=None,
                           image=urljoin(BASE + "/", src) if src else None, category=canon_category(name, hint)))
    return out


def categories():
    soup = BeautifulSoup(get(BASE + "/"), "lxml")
    urls = {a["href"].split("?")[0].split("#")[0] for a in soup.select("a[href]")}
    return sorted(u for u in urls if re.fullmatch(re.escape(BASE) + r"/[a-z0-9-]+/[a-z0-9-]+", u) and not SKIP.search(u))


def scrape():
    out, seen = [], set()
    for url in categories():
        hint = url.rsplit("/", 1)[-1].replace("-", " ")
        for page in range(1, 41):
            try:
                items = parse(get(f"{url}?page={page}"), hint)
            except Exception as e:
                print(f"[Venex] {url} p{page}: {e}")
                break
            new = [i for i in items if i["url"] not in seen]
            if not new:
                break
            seen.update(i["url"] for i in new)
            out += new
    return out
