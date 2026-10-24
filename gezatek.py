"""Gezatek: HTML con data-attributes en cada tarjeta."""
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from .common import get, parse_ars, product, canon_category

STORE = "Gezatek"
BASE = "https://gezatek.com.ar"
CATEGORY_URLS = [
    "/procesadores/procesadores-amd/", "/procesadores/procesadores-intel/",
    "/placas-de-video/placas-de-video-nvidia/", "/placas-de-video/placas-de-video-amd/",
    "/memorias-ram/memoria-ram-ddr4/", "/memorias-ram/memoria-ram-ddr5/",
    "/memorias-ram/memoria-ram-sodimm-ddr4/", "/memorias-ram/memoria-ram-sodimm-ddr5/",
    "/motherboards/mothers-amd-am4/", "/motherboards/mothers-amd-am5/",
    "/motherboards/mothers-intel-lga1700/", "/motherboards/mothers-intel-lga1851/",
    "/almacenamiento/discos-ssd-m2-nvme/", "/almacenamiento/discos-ssd-sata3/",
    "/almacenamiento/discos-rigidos/", "/gabinetes-y-fuentes/fuentes/",
    "/gabinetes-y-fuentes/gabinetes/", "/perifericos/monitores/",
]


def parse(html, cat_hint=None):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for card in soup.select("div.prod-cat"):
        a = card.select_one("h4.card-title a") or card.select_one("a[href]")
        if not a:
            continue
        name = card.get("data-nombre") or a.get_text(" ", strip=True)
        final = card.select_one("h4.pecio_final b")
        card_price = card.select_one("h6.precio_mp")
        cash = parse_ars(final.get_text()) if final else None
        lst = parse_ars(card_price.get_text()) if card_price else None
        if cash is None:
            cash = parse_ars(card.get("data-precio"))
        et = card.select_one("font.et")
        code = card.select_one(".articulo_field")
        img = card.select_one("img")
        out.append(product(STORE, name, urljoin(BASE, a.get("href", "")), cash, lst,
                           stock=bool(et and "stock" in et.get_text().lower() and "sin" not in et.get_text().lower()),
                           sku=card.get("data-id"), pn=None,
                           image=urljoin(BASE, img["src"]) if img and img.get("src") else None,
                           category=canon_category(cat_hint, name)))
    return out


def scrape():
    out = []
    for path in CATEGORY_URLS:
        seen = set()
        for page in range(1, 15):
            url = BASE + path + ("" if page == 1 else f"?pagina={page}")
            try:
                items = parse(get(url), path)
            except Exception as e:
                print(f"[Gezatek] {url}: {e}")
                break
            new = [i for i in items if i["url"] not in seen]
            if not new:
                break
            seen.update(i["url"] for i in new)
            out += new
    return out
