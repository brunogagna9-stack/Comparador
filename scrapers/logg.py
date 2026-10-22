"""Logg Hardstore: HTML con tarjetas a.product-card."""
from urllib.parse import urljoin, quote
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "Logg"
BASE = "https://logg.com.ar"
CATEGORIES = ["Procesadores", "Placas de Video", "Memorias RAM", "Motherboards", "Discos SSD",
              "Fuentes", "Gabinetes", "Monitores"]


def parse(html, hint=None):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for card in soup.select("a.product-card"):
        price = card.select_one("h5.card-price")
        title = card.select_one(".card-title") or card.select_one("h5:not(.card-price)")
        name = title.get_text(" ", strip=True) if title else card.get("title", "")
        if not name:
            continue
        img = card.select_one("img")
        low = "quedan pocas" in card.get_text().lower()
        out.append(product(STORE, name, urljoin(BASE, card.get("href", "")),
                           parse_ars(price.get_text()) if price else None, None,
                           stock=True if low else None,
                           image=urljoin(BASE, img["src"]) if img and img.get("src") else None,
                           category=canon_category(hint, name)))
    return out


def scrape():
    out = []
    for cat in CATEGORIES:
        seen = set()
        for page in range(1, 15):
            try:
                items = parse(get(f"{BASE}/Products?categoryName={quote(cat)}&page={page}"), cat)
            except Exception as e:
                print(f"[Logg] {cat} p{page}: {e}")
                break
            new = [i for i in items if i["url"] not in seen]
            if not new:
                break
            seen.update(i["url"] for i in new)
            out += new
    return out
