"""Utilidades compartidas por todos los recolectores."""
import re
import time
import requests

UA = "ComparadorARBot/0.1 (proyecto personal sin fines de lucro; respeta robots.txt)"
DELAY = 1.5  # segundos entre pedidos a una misma tienda (para no molestar)

LOG = []  # mensajes de error de la corrida actual (los lee build_data.py)

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
    LOG.append(f"{url} -> {last}")
    raise RuntimeError(f"No se pudo leer {url}: {last}")


def post(url, data, as_json=False, retries=3):
    """POST de un formulario público (paginación de Logg). Misma pausa, reintentos y respeto a 403/429 que get()."""
    last = None
    for i in range(retries):
        try:
            time.sleep(DELAY)
            r = _session.post(url, data=data, timeout=40)
            if r.status_code == 200:
                return r.json() if as_json else r.text
            last = f"HTTP {r.status_code}"
            if r.status_code in (403, 429):
                break
        except Exception as e:
            last = str(e)
        time.sleep(2 * (i + 1))
    LOG.append(f"{url} -> {last}")
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


CATEGORIES = [  # el orden importa: la primera regla que coincide gana
    ("accesorios", r"\bcable\b|adaptador|conversor|\bhdmi\b|hub usb|alargue"),
    ("almacenamiento", r"micro ?sd|sdhc|sdxc|pendrive|tarjeta de memoria|memoria flash"),
    ("pcs-armadas", r"armad[oa]|^pc\b|\bpc (de escritorio|gamer|powered)|powered by|all in one|kit de actualizaci"),
    ("notebooks", r"notebook|laptop|netbook"),
    ("monitores", r"monitor|pantalla"),
    ("fuentes", r"\bfuente\b|fuentes de alimentaci|power supply"),
    ("gabinetes", r"gabinete"),
    ("refrigeracion", r"cooler|refrigeraci|disipador|water ?cooling|pasta t[eé]rmica|\bfan\b|ventilador"),
    ("procesadores", r"^(procesador(es)?|micro|cpu)\b"),   # "Procesador … Gráficos Radeon" no es una placa de video
    ("placas-de-video", r"placa de video|geforce|radeon|\brtx ?\d|\bgtx ?\d|\brx ?\d{3,4}|\barc ?[ab]\d|video card"),
    ("motherboards", r"\bmother|motherboard|placa madre|mainboard"),
    ("procesadores", r"procesador|ryzen|core i[3579]\b|core ultra|athlon|pentium|celeron|xeon|\bcpu\b"),
    ("memorias-ram", r"memoria ram|\bddr[2345]\b|sodimm|\bdimm\b|memorias?\b(?!.*(sd|flash))"),
    ("almacenamiento", r"\bssd\b|nvme|m\.2|\bhdd\b|disco"),
    ("perifericos", r"teclado|mouse|auricular|headset|joystick|gamepad|webcam|parlante|micr[oó]fono|\bpad\b|silla|volante"),
    ("redes", r"router|placa de red|wifi|wi-fi|access point|\bswitch\b|repetidor"),
]

# Subcategorías de Compragamer -> categoría propia (ver scrapers/compragamer.py)
CG_SUBCATS = {
    "procesadores": "procesadores", "mothers": "motherboards", "placas de video": "placas-de-video",
    "memorias notebook": "memorias-ram", "memorias": "memorias-ram", "discos": "almacenamiento",
    "tarjetas de memorias": "almacenamiento", "fuentes": "fuentes", "gabinetes": "gabinetes",
    "monitores": "monitores", "coolers": "refrigeracion", "pasta": "refrigeracion", "notebooks": "notebooks",
    "armados": "pcs-armadas", "pc de escritorio": "pcs-armadas", "kits de actualiz": "pcs-armadas",
    "mouses": "perifericos", "teclados": "perifericos", "auriculares": "perifericos", "joysticks": "perifericos",
    "webcam": "perifericos", "parlantes": "perifericos", "sillas": "perifericos", "micr": "perifericos",
    "routers": "redes", "placas de red": "redes", "cables": "accesorios",
}


def is_service(name):
    """Servicios que no son productos comparables (p. ej. el 'ARMADO DE PC' de Compragamer)."""
    n = (name or "").lower().strip()
    return bool(re.match(r"^(armado|servic(io|e)|instalaci[oó]n|mano de obra)\b", n)
                or re.search(r"armado (de|express|item|ítem)|armado item|\bitem \d{3,4}\b.*armado", n)
                or re.search(r"actualizaci[oó]n de bios|extensi[oó]n de garant[ií]a|^garant[ií]a\b", n))


_NON_HW = re.compile(r"\brobot\b|transformers|\bfunda\b|\bcelular\b|\btoner\b|cartucho|\btinta\b|\bjuguete|"
                     r"smart ?tv|televisor|\bsoporte (de )?tv\b|soporte tv|\bheladera|\bpeluche|\bperfume", re.I)


def is_non_hardware(name, category):
    """Productos de la categoría 'otros' que no son hardware de PC (robots, fundas, toners, televisores…)."""
    return category == "otros" and bool(_NON_HW.search(name or ""))


def canon_category(*texts):
    blob = " ".join(t for t in texts if t).lower()
    for slug, pat in CATEGORIES:
        if re.search(pat, blob):
            return slug
    return "otros"


def product(store, name, url, price_cash=None, price_list=None, stock=None,
            sku=None, pn=None, image=None, category=None, cuotas=None, rating=None, prev_cash=None):
    return {
        "store": store, "name": " ".join((name or "").split()), "url": url,
        "price_cash": price_cash, "price_list": price_list, "stock": stock,
        "sku": sku, "pn": pn, "image": image,
        "category": category or canon_category(name),
        "cuotas": cuotas, "rating": rating, "prev_cash": prev_cash,
    }
