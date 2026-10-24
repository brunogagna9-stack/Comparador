"""Maximus Gaming: HTML. Trae el número de parte (PN=) en la URL, ideal para cruzar productos."""
import re
from urllib.parse import urljoin, unquote
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "Maximus"
BASE = "https://www.maximus.com.ar"


def parse(html, cat_hint=None):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for card in soup.select("article.mxCardProduct"):
        a = card.select_one("a.mxCardProduct__link")
        title = card.select_one(".mxCardProduct__title")
        if not a or not title:
            continue
        href = a.get("href", "")
        pn = re.search(r"PN=([^/&]+)", href)
        item = re.search(r"ITEM=(\d+)", href)
        price = parse_ars((card.select_one(".mxCardProduct__price") or {}).get_text() if card.select_one(".mxCardProduct__price") else None)
        old = card.select_one(".mxCardProduct__oldPrice")
        inst = card.select_one(".mxCardProduct__installments")
        rs = card.select_one(".mxCardProduct__ratingScore")
        rc = card.select_one(".mxCardProduct__ratingCount")
        rating = None
        if rs:
            try:
                rating = {"score": float(rs.get_text().strip().replace(",", ".")),
                          "count": int(re.sub(r"\D", "", rc.get_text())) if rc else None}
            except ValueError:
                rating = None
        img = card.select_one("img")
        out.append(product(STORE, title.get_text(" ", strip=True), urljoin(BASE, href),
                           price_cash=price, price_list=parse_ars(old.get_text()) if old else None,
                           stock=None, sku=item.group(1) if item else None,
                           pn=unquote(pn.group(1)) if pn else None,
                           image=urljoin(BASE, img["src"]) if img and img.get("src") else None,
                           category=canon_category(cat_hint, title.get_text()),
                           cuotas=inst.get_text(" ", strip=True) if inst else None, rating=rating))
    return out


def categories():
    soup = BeautifulSoup(get(BASE + "/"), "lxml")
    found = {}
    for a in soup.select("a[href*='CAT=']"):
        m = re.search(r"CAT=(\d+)", a["href"])
        if m:
            found[m.group(1)] = a.get_text(" ", strip=True)
    return found


def scrape():
    out = []
    for cat, label in categories().items():
        for page in range(1, 40):
            url = f"{BASE}/Productos/x/maximus.aspx?/CAT={cat}/SCAT=-1/M=-1/OR=1/PAGE={page}/"
            try:
                items = parse(get(url), label)
            except Exception as e:
                print(f"[Maximus] {url}: {e}")
                break
            if not items:
                break
            out += items
            if len(items) < 28:
                break
    return out
