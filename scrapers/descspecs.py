"""Datos técnicos de mouses, teclados y auriculares leídos de la DESCRIPCIÓN que cada tienda escribe de su producto.

No se pide nada nuevo: las tiendas WooCommerce ya entregan la descripción en la misma respuesta que usamos para los precios.
Honestidad de los datos:
  · Es texto de la TIENDA (a veces armado con ayuda de IA o copiado), NO la ficha del fabricante. Por eso todo dato sale marcado
    «Pendiente de verificar» y con la nota «Según la descripción de <tienda>; no es del fabricante».
  · Solo se toma lo que el texto dice con claridad (número + unidad, o etiqueta + valor). Lo que no aparece queda «Sin datos».
  · Se necesitan al menos 2 datos para guardar la ficha, y nunca se pisa una ficha de Compragamer.
  · Si dos tiendas del mismo producto se contradicen en un dato, ese dato se descarta.
"""
import re
import unicodedata
import datetime as dt

CATS = ("mouses", "teclados", "auriculares")


def _t(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def _num(x):
    try:
        return float(str(x).replace(".", "").replace(",", ".")) if re.search(r"\.\d{3}\b", str(x)) else float(str(x).replace(",", "."))
    except ValueError:
        return None


def _mouse(t):
    f = {}
    nums = []
    tt = re.sub(r"\d[\d.,]*\s*(?:k)?hz\b", " ", t)               # los Hz (polling) no son DPI
    for m in re.finditer(r"(\d+(?:[.,]\d+)?)\s*(k)?\s*dpi\b", tt):
        v = _num(m.group(1))
        if v is not None:
            nums.append(v * 1000 if m.group(2) else v)
    for m in re.finditer(r"\bdpi\b([^\n]{0,45})", tt):             # «DPI: 800/1600/3200», «DPI ajustable hasta 10000»
        for n, k in re.findall(r"(\d[\d.,]*)\s*(k)?\b", m.group(1)):
            v = _num(n)
            if v is not None:
                nums.append(v * 1000 if k else v)
    nums = [n for n in nums if 200 <= n <= 60000]
    if nums:
        f["dpi_max"] = {"v": int(max(nums)), "u": "DPI"}
    m = re.search(r"(\d{1,2})\s*botones?|botones?[^\n\d]{0,25}?(\d{1,2})\b", t)
    if m:
        f["botones"] = {"v": int(m.group(1) or m.group(2))}
    m = re.search(r"peso[^\n\d]{0,20}(\d+(?:[.,]\d+)?)\s*(kg|g|gr|gramos)\b", t)
    if m:
        v = _num(m.group(1))
        if v is not None:
            f["peso_g"] = {"v": round(v * 1000) if m.group(2) == "kg" else round(v), "u": "g"}
    m = re.search(r"(\d{3,5})\s*hz\b", t)
    if m and re.search(r"polling|sondeo|frecuencia de (respuesta|reporte|muestreo)|tasa de (reporte|sondeo)", t):
        f["polling"] = {"v": int(m.group(1)), "u": "Hz"}
    if re.search(r"sensor[^\n]{0,25}\boptic", t) or re.search(r"\boptic[oa]\b[^\n]{0,15}sensor", t):
        f["sensor"] = {"v": "Óptico"}
    elif re.search(r"sensor[^\n]{0,25}\blaser", t):
        f["sensor"] = {"v": "Láser"}
    f.update(_wireless(t))
    return f


def _wireless(t):
    wl = re.search(r"inalambric|wireless|bluetooth|2\.?4 ?ghz|lightspeed", t)
    wired = re.search(r"\bcon cable\b|\balambric|cableado|cable (usb|mallado|trenzado|de \d)|conexion (por )?(usb|cable)", t)
    if wl and not wired:
        return {"inalambrico": {"v": "Inalámbrico"}}
    if wired and not wl:
        return {"inalambrico": {"v": "Con cable"}}
    return {}


def _teclado(t):
    f = {}
    if re.search(r"mecanic[oa]|switches? mecanic", t):
        f["mecanismo"] = {"v": "Mecánico"}
    elif re.search(r"\bmembrana\b", t):
        f["mecanismo"] = {"v": "Membrana"}
    m = re.search(r"\b(?:switch(?:es)?|interruptor(?:es)?)\b[^\n]{0,30}?\b(red|blue|brown|black|silver|yellow|rojo|azul|marron|negro)\b", t)
    if m:
        f["switch"] = {"v": {"rojo": "Red", "azul": "Blue", "marron": "Brown", "negro": "Black"}.get(m.group(1), m.group(1).capitalize())}
    for pat, name in ((r"\btkl\b|sin (pad|teclado) numeric|tenkeyless", "TKL"), (r"\b60 ?%|\b60 por ciento", "60%"), (r"\b65 ?%", "65%"),
                      (r"\b75 ?%", "75%"), (r"tamano completo|full[- ]?size|con pad numerico|completo", "Completo")):
        if re.search(pat, t):
            f["formato"] = {"v": name}
            break
    if re.search(r"\brgb\b", t):
        f["rgb"] = {"v": "RGB"}
    if re.search(r"espanol|\bñ\b|latam|layout es", t):
        f["idioma"] = {"v": "Español"}
    elif re.search(r"ingles|\bus layout|qwerty us", t):
        f["idioma"] = {"v": "Inglés (US)"}
    f.update(_wireless(t))
    return f


def _aur(t):
    f = {}
    m = re.search(r"(\d{2})\s*mm\b", t)
    if m and re.search(r"driver|controlador|transductor|parlante|altavoz|diafragma|unidad", t):
        f["driver_mm"] = {"v": int(m.group(1)), "u": "mm"}
    m = re.search(r"(\d{1,3})\s*(?:ohm|ohms|ohmios|ω)", t)
    if m and re.search(r"impedancia", t):
        f["impedancia"] = {"v": int(m.group(1)), "u": "Ω"}
    m = re.search(r"(\d{1,5})\s*hz\s*(?:-|–|a|~|hasta)\s*(\d{1,3}(?:[.,]\d+)?)\s*(k)?hz", t)
    if m:
        hi = _num(m.group(2))
        if hi is not None:
            f["f_min"], f["f_max"] = {"v": int(m.group(1)), "u": "Hz"}, {"v": int(hi * 1000) if (m.group(3) or hi < 100) else int(hi), "u": "Hz"}
    if re.search(r"microfono", t) and not re.search(r"sin microfono", t):
        f["mic"] = {"v": True}
    m = re.search(r"\b(7\.1|5\.1)\b", t)
    if m and re.search(r"surround|envolvente|sonido", t):
        f["surround"] = {"v": m.group(1)}
    con = [n for p, n in ((r"\busb\b", "USB"), (r"3[.,]5 ?mm|jack", "Jack 3,5 mm"), (r"bluetooth", "Bluetooth"), (r"2\.?4 ?ghz|inalambric", "Inalámbrico 2,4 GHz")) if re.search(p, t)]
    if con:
        f["conexion"] = {"v": ", ".join(con)}
    if re.search(r"rgb", t):
        f["rgb"] = {"v": "RGB"}
    return f


_PARSERS = {"mouses": _mouse, "teclados": _teclado, "auriculares": _aur}
WANTED = {"mouses": ("dpi_max", "botones", "sensor", "peso_g", "polling"), "teclados": ("mecanismo", "switch", "formato", "rgb"),
          "auriculares": ("impedancia", "f_min", "f_max", "driver_mm", "mic")}


def parse_desc(text, cat):
    """Texto de la descripción -> {campo: {v, u?}} (vacío si no dice nada claro)."""
    if cat not in _PARSERS or not text:
        return {}
    f = _PARSERS[cat](_t(text))
    from .specs import _check_peri
    return _check_peri(f, cat)


def refresh(groups, all_items, today=None):
    """Para cada grupo de mouse/teclado/auriculares SIN ficha, arma una a partir de las descripciones de sus ofertas."""
    today = today or dt.date.today().isoformat()
    by_url = {i.get("url"): i for i in all_items if i.get("desc")}
    items, n = {}, 0
    for g in groups:
        if g.get("category") not in CATS or g.get("spec"):
            continue
        cands = []
        for o in g.get("offers", ()):
            it = by_url.get(o.get("url"))
            if not it:
                continue
            f = parse_desc(it["desc"], g["category"])
            if f:
                cands.append((o, f))
        if not cands:
            continue
        merged, origin = {}, {}
        for o, f in sorted(cands, key=lambda x: -len(x[1])):
            for k, rec in f.items():
                if k in merged:
                    if merged[k]["v"] != rec["v"]:
                        merged[k] = None                  # dos tiendas se contradicen: no se publica ese dato
                    continue
                merged[k], origin[k] = dict(rec), o
        merged = {k: v for k, v in merged.items() if v}
        if len(merged) < 2:
            continue
        store = origin[next(iter(merged))]["store"]
        for k, v in merged.items():
            v["l"] = "pend"
            v["n"] = f"Según la descripción de {origin[k]['store']}; no es del fabricante."
        main = origin[next(iter(merged))]
        key = "ds:" + g["id"]
        items[key] = {"n": g["name"], "s": store, "id": None, "url": main.get("url"), "d": today, "sku": "",
                      "f": merged, "miss": [k for k in WANTED[g["category"]] if k not in merged], "sheet": False}
        g["spec"] = key
        n += 1
    return items, {"ok": True, "vinculadas": n}
