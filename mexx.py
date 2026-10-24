"""MEXX: HTML. Las categorías se descubren desde el menú del sitio."""
import re
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "MEXX"
BASE = "https://www.mexx.com.ar"


def parse(html, cat_hint=None):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for card in soup.select("div.productos"):
        a = card.select_one("h4.card-title a")
        if not a:
            continue
        name = a.get_text(" ", strip=True)
        sku = None
        for sp in card.select(".card-description span"):
            t = sp.get_text(" ", strip=True)
            if t.startswith("Art:"):
                sku = t.replace("Art:", "").strip()
        price = parse_ars((card.select_one(".price h4 b") or card.select_one(".price")).get_text()) \
            if card.select_one(".price") else None
        stock_el = card.select_one(".enstocklistado")
        img = card.select_one("img")
        out.append(product(STORE, name, urljoin(BASE, a.get("href", "")), price_cash=price,
                           stock=bool(stock_el and "STOCK" in stock_el.get_text().upper()),
                           sku=sku, pn=sku, image=urljoin(BASE, img["src"]) if img and img.get("src") else None,
                           category=canon_category(cat_hint, name)))
    return out


def categories():
    soup = BeautifulSoup(get(BASE + "/"), "lxml")
    urls = {urljoin(BASE, a["href"]).split("?")[0] for a in soup.select("a[href*='productos-rubro']")}
    return sorted(urls)


def scrape():
    out = []
    for url in categories():
        hint = url.rstrip("/").split("/")[-1].replace("-", " ")
        try:
            out += parse(get(url + "?all=1"), hint)
        except Exception as e:
            print(f"[MEXX] {url}: {e}")
    return out
