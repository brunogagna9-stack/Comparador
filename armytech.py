"""Army Tech (armytech.com.ar): tienda PrestaShop. HTML de los listados de categoría.

Solo se leen los listados paginados con ?page=N. El robots.txt de la tienda prohíbe los filtros (?q=), el orden
(?order=) y ?n=, así que NO se usan. El listado no informa el stock: queda como "sin confirmar" (None).
El precio visible es el de contado; la tienda también muestra "N cuotas sin interés" con el valor de cada cuota.
"""
import re
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "Armytech"
BASE = "https://www.armytech.com.ar"
# listados que cubren el catálogo; se deduplica por id de producto
LISTINGS = ["405-hardware", "418-placas-de-video", "419-procesadores", "414-motherboards", "412-memorias",
            "407-fuentes", "421-ssd", "410-hdd", "470-refrigeracion", "365-computadoras", "431-monitores-y-tvs",
            "449-notebooks"]


def parse(html):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for art in soup.select("article.product-miniature"):
        a = art.select_one("h3.product-title a") or art.select_one("a[href]")
        pr = art.select_one(".product-price")
        if not a or not pr:
            continue
        cash = None
        if pr.get("content"):
            try:
                cash = float(pr["content"])
            except ValueError:
                cash = None
        cash = cash or parse_ars(pr.get_text())
        cat = art.select_one(".product-category-name")
        brand = art.select_one(".product-brand a")
        img = art.select_one("img")
        feats = {dt.get_text(" ", strip=True): dd.get_text(" ", strip=True)
                 for dt, dd in zip(art.select("dl.data-sheet dt"), art.select("dl.data-sheet dd"))}
        cu = art.select_one(".cuotas-grid-list")
        cuotas = None
        if cu:
            m = re.search(r"(\d+)\s*cuotas?\s*sin inter[eé]s.*?\$\s*([\d.,]+)", cu.get_text(" ", strip=True), re.I)
            if m:
                v = parse_ars(m.group(2))
                cuotas = f"{m.group(1)} cuotas sin interés de $ {v:,.0f}".replace(",", ".") if v else None
        name = re.sub(r"\s+", " ", a.get_text(" ", strip=True))
        p = product(STORE, name, a["href"], cash, None, stock=None,
                    sku=None, pn=None, image=(img.get("src") if img else None),
                    category=canon_category(name, cat.get_text(" ", strip=True) if cat else ""), cuotas=cuotas)
        p["store_id"] = art.get("data-id-product")
        p["store_ref"] = (art.select_one(".product-reference") or art).get_text(" ", strip=True) if art.select_one(".product-reference") else None
        p["brand"] = brand.get_text(strip=True) if brand else None
        if feats.get("EAN"):
            p["ean"] = feats["EAN"]
        out.append(p)
    return out


def scrape():
    seen, out = set(), []
    for lst in LISTINGS:
        for page in range(1, 15):
            url = f"{BASE}/{lst}" + (f"?page={page}" if page > 1 else "")
            try:
                items = parse(get(url))
            except Exception as e:
                print(f"[Armytech] {url}: {e}")
                break
            new = [i for i in items if i["store_id"] not in seen]
            if not new:
                break
            seen.update(i["store_id"] for i in new)
            out += new
    return out
