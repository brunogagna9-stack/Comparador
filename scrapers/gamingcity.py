"""Gaming City (gamingcity.com.ar): HTML de los listados de categoría (URLs «…--prod--ID»).
Su robots.txt prohíbe /productos.php?, /detalle.php? y /control/: se usan solo las URLs amigables de categoría y el
enlace «Siguiente » de cada listado. Informa stock («En stock» / cantidad), precio, precio sugerido y cuotas."""
import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "Gaming City"
BASE = "https://www.gamingcity.com.ar"
SKIP = re.compile(r"consola|impres|televis|celular|smart|tinta|toner|juguete|merchandising|promoc", re.I)


def parse(html, hint=""):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for box in soup.select("div.product"):
        a = box.select_one("h4 a.titprod") or box.select_one("h4 a")
        price = box.select_one(".price span")
        if not a or not price:
            continue
        cash = parse_ars(price.get_text())
        if not cash:
            continue
        lst = box.select_one(".precio-sugerido")
        lst = parse_ars(lst.get_text()) if lst else None
        leyenda = (box.select_one(".leyendaConStock") or box.select_one(".stock"))
        txt = leyenda.get_text(" ", strip=True).lower() if leyenda else ""
        stock = True if "en stock" in txt or "disponibles" in txt else False if "sin stock" in txt or "agotado" in txt else None
        cu = box.select_one(".financiacion")
        cuotas = None
        if cu:
            n, m = cu.select_one(".cuotas"), cu.select_one(".montocuota")
            v = parse_ars(m.get_text()) if m else None
            if n and v:
                cuotas = f"{n.get_text(strip=True)} cuotas de $ {v:,.0f}".replace(",", ".")
        img = box.select_one("img")
        src = (img.get("data-src") or img.get("src")) if img else None
        name = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        out.append(product(STORE, name, urljoin(BASE + "/", a["href"]), cash, lst if lst and lst > cash else None,
                           stock=stock, sku=None, pn=None, image=urljoin(BASE + "/", src) if src else None,
                           category=canon_category(name, hint), cuotas=cuotas))
    return out


def next_page(html):
    soup = BeautifulSoup(html, "lxml")
    for a in soup.select(".pagination a"):
        if "siguiente" in a.get_text(" ", strip=True).lower() and a.get("href"):
            return urljoin(BASE + "/", a["href"])
    return None


def categories():
    soup = BeautifulSoup(get(BASE + "/"), "lxml")
    slugs = {a["href"].split("?")[0] for a in soup.select("a[href*='--prod--']")
             if re.fullmatch(r"[a-z0-9-]+--prod--\d+", a["href"].split("?")[0])}
    # solo las hojas: se descarta la categoría "padre" si otra más específica termina con su nombre
    base = lambda s: s.rsplit("--prod--", 1)[0]
    leaves = [s for s in slugs if not any(o != s and base(o).endswith("-" + base(s)) for o in slugs)]
    return sorted(urljoin(BASE + "/", s) for s in leaves if not SKIP.search(s))


def scrape():
    out, seen = [], set()
    for url in categories():
        hint = url.rsplit("/", 1)[-1].split("--prod--")[0].replace("-", " ")
        page, n = url, 0
        while page and n < 40:
            n += 1
            try:
                html = get(page)
            except Exception as e:
                print(f"[Gaming City] {page}: {e}")
                break
            new = [i for i in parse(html, hint) if i["url"] not in seen]
            if not new:
                break
            seen.update(i["url"] for i in new)
            out += new
            page = next_page(html)
    return out
