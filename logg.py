"""Logg Hardstore: HTML con tarjetas a.product-card."""
import re
from urllib.parse import urljoin, quote
from bs4 import BeautifulSoup
from .common import get, post, parse_ars, product, canon_category

STORE = "Logg"
BASE = "https://logg.com.ar"
# Nombres tal como los usa el sitio en la URL (?categoryName=...). Cada categoría muestra TODOS sus productos en una sola página.
CATEGORIES = {"Procesadores": "procesadores", "PlacasdeVideo": "placas de video", "MemoriaRAM": "memoria ram",
              "Motherboards": "motherboards", "Almacenamiento": "ssd disco", "Fuentesdealimentacion": "fuentes de alimentación",
              "Gabinetes": "gabinetes", "Refrigeracion": "refrigeración cooler", "MonitoresyVideo": "monitores",
              "Notebooks": "notebooks", "PCArmada": "pc armada", "CombosdeActualizacion": "kit de actualización"}


def parse(html, hint=None):
    soup = BeautifulSoup(html, "lxml")
    out = []
    for card in soup.select("a.product-card"):
        price = card.select_one("h5.card-price")
        title = card.select_one("p.card-text") or card.select_one(".card-title") or card.select_one("h5:not(.card-price)")
        name = title.get_text(" ", strip=True) if title else (card.select_one("img[alt]") or {}).get("alt", "") or card.get("title", "")
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


def form_fields(html):
    """Campos del formulario de la página (incluye el token anti-falsificación que el sitio exige en la paginación)."""
    soup = BeautifulSoup(html, "lxml")
    form = soup.select_one("form:has(.pagination)") or soup.select_one("form")
    data = {}
    if form:
        for el in form.select("input[name], select[name]"):
            if el.name == "select":
                opt = el.select_one("option[selected]") or el.select_one("option")
                data[el["name"]] = opt.get("value", "") if opt else ""
            elif el.get("type") not in ("submit", "button", "checkbox", "radio") or el.has_attr("checked"):
                data[el["name"]] = el.get("value", "")
    return data


def next_page(html):
    """URL (formaction) del botón «Siguiente», o None si es la última página."""
    soup = BeautifulSoup(html, "lxml")
    for b in soup.select(".pagination button"):
        if "siguiente" in b.get_text().lower() and b.get("formaction"):
            nxt = b["formaction"].replace("&amp;", "&")
            cur = soup.select_one(".page-item.active")
            num = lambda u: int((re.search(r"pageNumber=(\d+)", u) or [0, 0])[1])
            if cur and num(nxt) <= int(re.sub(r"\D", "", cur.get_text()) or 0):
                return None   # el «Siguiente» de la última página apunta a la misma página
            return urljoin(BASE, nxt)
    return None


def scrape():
    out, seen = [], set()
    for cat, hint in CATEGORIES.items():
        try:
            html = get(f"{BASE}/Products?categoryName={quote(cat)}")
            for _ in range(20):                       # tope de seguridad
                items = parse(html, hint)
                new = [i for i in items if i["url"] not in seen]
                if not new:
                    break
                seen.update(i["url"] for i in new)
                out += new
                nxt = next_page(html)
                if not nxt:
                    break
                html = post(nxt, form_fields(html))
        except Exception as e:
            print(f"[Logg] {cat}: {e}")
    return out
