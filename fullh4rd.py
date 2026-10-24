"""Fullh4rd: no tiene páginas de categoría legibles; se recorren búsquedas por término."""
from urllib.parse import urljoin, quote
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "Fullh4rd"
BASE = "https://fullh4rd.com.ar"
TERMS = ["ryzen", "intel core", "geforce rtx", "radeon rx", "memoria ram ddr4", "memoria ram ddr5",
         "motherboard", "ssd nvme", "ssd sata", "fuente", "gabinete", "monitor"]


def parse(html, hint=None):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for card in soup.select("article.results-card"):
        a = card.select_one("a.results-card__title-link")
        if not a:
            continue
        cur = card.select_one(".results-card__price-current")
        lst = card.select_one(".results-card__price-list")
        meta = card.select_one(".results-card__meta")
        img = card.select_one("img")
        out.append(product(STORE, a.get_text(" ", strip=True), urljoin(BASE, a.get("href", "")),
                           parse_ars(cur.get_text()) if cur else None,
                           parse_ars(lst.get_text()) if lst else None,
                           stock=None, sku=a.get("href", "").split("/")[2] if a.get("href", "").startswith("/prod/") else None,
                           image=urljoin(BASE, img["src"]) if img and img.get("src") else None,
                           category=canon_category(meta.get_text() if meta else None, a.get_text())))
    return out


def scrape():
    out, seen = [], set()
    for term in TERMS:
        for page in range(1, 10):
            try:
                items = parse(get(f"{BASE}/buscar?q={quote(term)}&page={page}"), term)
            except Exception as e:
                print(f"[Fullh4rd] {term} p{page}: {e}")
                break
            new = [i for i in items if i["url"] not in seen]
            if not new:
                break
            seen.update(i["url"] for i in new)
            out += new
    return out
