"""NET Gaming (netgaming.ar): HTML de los listados de categoría, paginados con ?page=N.
Su robots.txt pide «Crawl-delay: 5»: se espera 5 segundos entre pedidos (más lento que el resto). Prohíbe los filtros
(?orderby=, ?search=, ?min_price=…): solo se usa ?page=N. Muestra «Precio especial» (contado) y un precio mayor tachado.
El código de artículo que muestra es interno de la tienda (no es número de parte)."""
import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "NET Gaming"
BASE = "https://netgaming.ar"
DELAY = 5  # segundos entre pedidos: lo pide su robots.txt
SKIP = re.compile(r"consola|impresora|estabilizador|cargador|mini-pc|arma-tu-pc|notebook-repuesto", re.I)


def parse(html, hint=""):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for card in soup.select("div.card-ecommerce"):
        a = card.select_one("h4.card-title a")
        fin = card.select_one(".pecio_final")
        if not a or not fin:
            continue
        cash = parse_ars(fin.get("data-precio")) or parse_ars((fin.select_one("b") or fin).get_text())
        if not cash:
            continue
        lst = card.select_one(".price h6.solo_web")
        lst = parse_ars(lst.get_text()) if lst else None
        st = card.select_one("h6.card-category .et")
        txt = st.get_text(" ", strip=True).lower() if st else ""
        stock = True if "en stock" in txt else False if "sin stock" in txt or "agotado" in txt else None
        img = card.select_one("img")
        name = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        p = product(STORE, name, urljoin(BASE + "/", a["href"]), cash, lst if lst and lst > cash else None,
                    stock=stock, sku=None, pn=None, image=img.get("src") if img else None,
                    category=canon_category(name, hint))
        code = card.select_one(".articulo_field")
        p["store_sku"] = code.get_text(strip=True) if code else None
        out.append(p)
    return out


def categories():
    soup = BeautifulSoup(get(BASE + "/", delay=DELAY), "lxml")
    urls = {a["href"].split("?")[0] for a in soup.select("a[href]")}
    two = [u for u in urls if re.fullmatch(re.escape(BASE) + r"/[a-z0-9-]+/[a-z0-9-]+/", u) and not SKIP.search(u)]
    by_parent = {}
    for u in two:
        by_parent.setdefault(u.split("/")[3], []).append(u)
    out = []
    for parent, subs in by_parent.items():
        alls = [u for u in subs if re.match(r"to(do|da)s?", u.rstrip("/").rsplit("/", 1)[-1])]
        out += alls or subs   # si existe el listado «todo en …» alcanza con ese
    return sorted(out)


def scrape():
    out, seen = [], set()
    for url in categories():
        hint = url.rstrip("/").rsplit("/", 1)[-1].replace("-", " ")
        for page in range(1, 41):
            try:
                items = parse(get(f"{url}?page={page}", delay=DELAY), hint)
            except Exception as e:
                print(f"[NET Gaming] {url} p{page}: {e}")
                break
            new = [i for i in items if i["url"] not in seen]
            if not new:
                break
            seen.update(i["url"] for i in new)
            out += new
    return out
