"""Utilidades compartidas por todos los recolectores."""
import re
import time
import requests

UA = "ComparadorARBot/0.1 (proyecto personal sin fines de lucro; respeta robots.txt)"
DELAY = 1.5  # segundos entre pedidos a una misma tienda (para no molestar)

_session = requests.Session()
_session.headers.update({"User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9"})


def get(url, as_json=False, retries=3):
    """Descarga una URL con pausa y reintentos. Devuelve texto o JSON."""
    last = None
    for i in range(retries):
        try:
            time.sleep(DELAY)
            r = _session.get(url, timeout=40)
            if r.status_code == 200:
                return r.json() if as_json else r.text
            last = f"HTTP {r.status_code}"
            if r.status_code in (403, 429):
                break  # nos pidieron que paremos: no insistimos
        except Exception as e:  # red caída, timeout, etc.
            last = str(e)
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"No se pudo leer {url}: {last}")


def parse_ars(text):
    """'$49.899' -> 49899.0 ; '$270.920,08' -> 270920.08 ; devuelve None si no hay número."""
    if text is None:
        return None
    s = re.sub(r"[^\d.,]", "", str(text))
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    else:
        # sin coma: el punto es separador de miles ("49.899"), salvo decimales tipo "12.5"
        if re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
            s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


CATEGORIES = [
    ("procesadores", r"procesador|micro\b|ryzen|core i[3579]|core ultra|athlon"),
    ("placas-de-video", r"placa de video|geforce|radeon|\brtx\b|\bgtx\b|\brx ?\d{4}|video card|gpu"),
    ("memorias-ram", r"memoria ram|\bddr[345]\b|sodimm|udimm"),
    ("motherboards", r"mother|motherboard|placa madre|\blga ?\d{4}\b.*\b(b|h|z|x)\d{3}"),
    ("almacenamiento", r"\bssd\b|disco|nvme|m\.2|hdd|pendrive|micro ?sd"),
    ("fuentes", r"\bfuente\b|power supply|80 ?plus"),
    ("gabinetes", r"gabinete|case\b"),
    ("monitores", r"monitor"),
    ("refrigeracion", r"cooler|refrigeraci|watercooling|water cooling|fan\b"),
]


def canon_category(*texts):
    blob = " ".join(t for t in texts if t).lower()
    for slug, pat in CATEGORIES:
        if re.search(pat, blob):
            return slug
    return "otros"


def product(store, name, url, price_cash=None, price_list=None, stock=None,
            sku=None, pn=None, image=None, category=None, cuotas=None, rating=None):
    return {
        "store": store, "name": " ".join((name or "").split()), "url": url,
        "price_cash": price_cash, "price_list": price_list, "stock": stock,
        "sku": sku, "pn": pn, "image": image,
        "category": category or canon_category(name),
        "cuotas": cuotas, "rating": rating,
    }
