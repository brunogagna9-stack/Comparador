"""Fichas técnicas de Open Icecat (catálogo abierto y gratuito de fichas de fabricantes) por marca + código de producto.

Cómo se usa (permitido por su licencia): la API documentada https://live.icecat.biz/api con el usuario de Icecat del dueño
del sitio (secreto ICECAT_USER en GitHub; NO va en el sitio público). No hace falta contraseña para el catálogo abierto.
Sin ICECAT_USER no se consulta nada.
Licencia Open Icecat: se cita «Specs Icecat» en cada dato, los datos se muestran «tal cual» (AS IS), no se cobran, no se usan
para entrenar modelos y lo derivado mantiene la misma licencia. Las marcas que Icecat solo ofrece en su plan pago (Logitech,
Corsair, Razer, Redragon…) responden «contenido completo» y se saltean.

Reglas de honestidad:
  · El código se toma del título de la tienda. Solo se acepta la ficha si la categoría de Icecat coincide con la del producto
    y si la capacidad / pulgadas / potencia del título coinciden con la ficha (si el título las dice).
  · Se guarda nivel «ver» (dato del fabricante vía Icecat) con la fuente y la fecha de consulta.
  · Hasta MAX_REQ consultas por corrida, con pausa, de los productos que más tiendas venden a los que menos, y caché
    (60 días si se encontró, 20 si no está) en raw/icecat_cache.json. Ante 429/5xx se corta la corrida de Icecat.
"""
import os
import re
import json
import time
import datetime as dt
from pathlib import Path
from urllib.parse import quote

API = "https://live.icecat.biz/api"
MAX_REQ = 400
DELAY = 1.0
TTL_OK, TTL_NO = 60, 20
CATS = {"monitores": r"pantalla|monitor", "memorias-ram": r"memoria", "almacenamiento": r"estado s[oó]lido|discos? duros?|ssd",
        "fuentes": r"fuente[s]? de alimentaci"}
BRANDS = ["Western Digital", "Kingston", "Seagate", "Samsung", "Crucial", "ADATA", "XPG", "Corsair", "Patriot", "Team", "Hiksemi",
          "Netac", "SanDisk", "Lexar", "PNY", "Toshiba", "LG", "ASUS", "MSI", "Gigabyte", "AOC", "ViewSonic", "Philips", "Acer",
          "BenQ", "Dell", "HP", "Lenovo", "Thermaltake", "Cooler Master", "Seasonic", "EVGA", "Antec", "be quiet", "DeepCool",
          "Sentey", "WD", "Hikvision", "Asrock", "Xiaomi", "Huawei", "Zowie", "Dahua", "Gamemax", "Aerocool", "Mushkin", "Kingdian"]
_ALIAS = {"Zowie": "BenQ", "WD": "Western Digital", "XPG": "ADATA", "be quiet": "be quiet!", "Asrock": "ASRock"}
_BAD = re.compile(r"^(\d+x\d+(gb|tb)?|\d+(\.\d+)?(gb|tb|mhz|hz|w|mm|ms|cm|mb/s|gb/s|mt/s|mts|rpm|k|v|in)|ddr\d.*|pcie.*|pci-e.*|gen\d.*|"
                  r"usb.*|sata.*|nvme|m\.2|2\.4ghz|x\d+|cl\d+|\d+in\d+|rgb|argb|wifi\d*|hdmi.*|ips|qhd|fhd|uhd|4k|wqhd|\d{3,4}p|"
                  r"12vhpwr.*|12v-2x6|atx\d.*|dp\d.*|\d+\.\d+v)$", re.I)

# Feature.ID de Icecat -> (campo interno, tipo)
FEAT = {
    "monitores": {"944": ("inch", "num"), "1585": ("res", "str"), "7450": ("hz", "num"), "15285": ("panel", "str"), "1516": ("ms", "num"),
                  "36441": ("brillo", "num"), "34": ("contraste", "str"), "36310": ("hdr", "bool"), "42449": ("freesync", "str"),
                  "29607": ("freesync_si", "bool"), "42448": ("gsync", "str"), "20783": ("gsync_si", "bool"), "3566": ("hdmi", "num"),
                  "6611": ("dp", "num"), "1954": ("altura", "bool"), "16767": ("vesa", "bool")},
    "memorias-ram": {"11381": ("gb", "num"), "16023": ("mods", "layout"), "427": ("ddr", "str"), "37536": ("mhz", "num"), "1635": ("cl", "num"),
                     "6266": ("volt", "num"), "21116": ("xmp", "bool")},
    "almacenamiento": {"5586": ("gb", "num"), "7": ("gb", "num"), "21731": ("formato", "str"), "21": ("iface", "str"), "29388": ("nvme", "bool"),
                       "1644": ("mbs", "num"), "1645": ("mbs_w", "num"), "17534": ("tbw", "num"), "430": ("rpm", "num"), "37958": ("buffer", "num")},
    "fuentes": {"10713": ("w", "num"), "8110": ("cert", "str"), "8529": ("modular", "pres"), "8107": ("atx", "str"), "45531": ("pcie16", "num"),
                "34322": ("formato", "str"), "5676": ("eficiencia", "num")},
}
WANTED = {"monitores": ("inch", "res", "hz", "panel", "ms"), "memorias-ram": ("gb", "ddr", "mhz", "cl"),
          "almacenamiento": ("gb", "iface", "mbs"), "fuentes": ("w", "cert", "modular", "atx")}


def brand_of(name, group_brand=None):
    low = name.lower()
    for b in BRANDS:
        if re.search(rf"(?<![a-z]){re.escape(b.lower())}(?![a-z])", low):
            return _ALIAS.get(b, b)
    return None


def codes(name):
    """Códigos de producto posibles del título (los que tienen guion o barra primero)."""
    toks = re.findall(r"[A-Za-z0-9][A-Za-z0-9\-/.]{3,}[A-Za-z0-9]", name)
    out = []
    for t in toks:
        if re.search(r"\d", t) and re.search(r"[A-Za-z]", t) and not _BAD.match(t) and t not in out:
            out.append(t)
    out.sort(key=lambda t: (not re.search(r"[-/]", t), -len(t)))
    res = []
    for t in out[:2]:
        res.append(t)
        if re.search(r"-J$", t, re.I):                 # variante para Argentina de ASUS: se prueba también sin el sufijo
            res.append(t[:-2])
    return res[:3]


def _feats(data):
    for g in data.get("FeaturesGroups") or []:
        for f in g.get("Features") or []:
            yield str((f.get("Feature") or {}).get("ID")), f


def _val(f, kind):
    v = f.get("Value")
    if kind == "num":
        try:
            x = float(str(v).replace(",", "."))
            return int(x) if x == int(x) else round(x, 2)
        except (TypeError, ValueError):
            return None
    if kind == "bool":
        return {"Y": True, "N": False}.get(str(v))
    if kind == "layout":
        m = re.match(r"\s*(\d+)\s*x", str(v))
        return int(m.group(1)) if m else None
    if kind == "pres":
        return str(f.get("PresentationValue") or v or "").strip() or None
    return str(v).strip() or None


def _title_nums(name, unit):
    return [float(x.replace(",", ".")) for x in re.findall(rf"(\d+(?:[.,]\d+)?)\s*{unit}\b", name, re.I)]


def consistent(name, cat, f):
    """El título y la ficha no se contradicen en lo principal (si el título lo dice)."""
    if cat in ("memorias-ram", "almacenamiento") and "gb" in f:
        caps = _title_nums(name, "gb") + [x * 1000 for x in _title_nums(name, "tb")]
        kit = re.search(r"(\d)\s*x\s*(\d+)\s*gb", name, re.I)
        if kit:
            caps.append(int(kit.group(1)) * int(kit.group(2)))
        if caps and not any(abs(c - f["gb"]["v"]) <= max(2, 0.03 * c) or (cat == "almacenamiento" and abs(c * 1.024 - f["gb"]["v"]) < 0.05 * c)
                            for c in caps):
            return False
    if cat == "monitores" and "inch" in f:
        ins = [float(x.replace(",", ".")) for x in re.findall(r"(\d{2}(?:[.,]\d)?)\s*(?:\"|”|''|pulgadas|pulg\b|in\b)", name, re.I)]
        if ins and not any(abs(i - f["inch"]["v"]) <= 0.6 for i in ins):
            return False
    if cat == "fuentes" and "w" in f:
        ws = _title_nums(name, "w")
        if ws and f["w"]["v"] not in ws:
            return False
    return True


def parse(resp, cat):
    """Respuesta JSON de Icecat -> (campos, info) o (None, motivo)."""
    d = (resp or {}).get("data") or {}
    gi = d.get("GeneralInfo") or {}
    cname = ((gi.get("Category") or {}).get("Name") or {}).get("Value") or ""
    if not re.search(CATS[cat], cname, re.I):
        return None, f"categoría distinta en Icecat: {cname}"
    f = {}
    for fid, feat in _feats(d):
        spec = FEAT[cat].get(fid)
        if not spec or spec[0] in f:
            continue
        v = _val(feat, spec[1])
        if v is None or v == "":
            continue
        unit = (((feat.get("Feature") or {}).get("Measure") or {}).get("Signs") or {}).get("_") or ""
        rec = {"v": v}
        if spec[1] == "num" and unit and unit != '"':
            rec["u"] = unit
        f[spec[0]] = rec
    if cat == "monitores":            # «Sí» genérico solo si no hay el tipo exacto
        for a, b in (("freesync", "freesync_si"), ("gsync", "gsync_si")):
            if b in f:
                if a not in f and f[b]["v"]:
                    f[a] = {"v": "Sí"}
                elif a not in f and f[b]["v"] is False:
                    f[a] = {"v": "No"}
                f.pop(b)
    if cat == "fuentes" and "atx" in f and re.match(r"^\d", str(f["atx"]["v"])):
        f["atx"]["v"] = "ATX " + str(f["atx"]["v"])
    return f, {"title": gi.get("Title"), "id": gi.get("IcecatId"), "pn": gi.get("BrandPartCode"), "brand": gi.get("Brand")}


class _Stop(Exception):
    pass


def _http_fetch(user):
    from . import common
    def fetch(brand, code):
        time.sleep(DELAY)
        url = f"{API}?lang=ES&shopname={quote(user)}&Brand={quote(brand)}&ProductCode={quote(code, safe='')}"
        r = common._session.get(url, timeout=40)
        if r.status_code == 200:
            return "ok", r.json()
        try:
            j = r.json()
        except ValueError:
            j = {}
        sc = j.get("StatusCode")
        if r.status_code == 429 or r.status_code >= 500:
            raise _Stop(f"Icecat respondió {r.status_code}")
        if sc in (1, 3, 18, 19):
            raise _Stop(f"Icecat rechazó el usuario (código {sc}): revisar el secreto ICECAT_USER")
        if sc == 9:
            return "pago", None
        return "no", None
    return fetch


def _item(name, cat, f, info, brand, code, today):
    for rec in f.values():
        rec["n"] = "Specs Icecat (Open Icecat): datos del fabricante, se muestran tal cual."
    return {"n": info.get("title") or name, "s": "Icecat", "id": info.get("id"), "d": today, "sku": info.get("pn") or code,
            "url": None,   # la ficha pública de icecat.biz está detrás de un control anti-robots: no se enlaza
            "icecat_id": info.get("id"),
            "f": f, "miss": [k for k in WANTED[cat] if k not in f], "sheet": True}


def refresh(groups, raw_dir, fetch=None, user=None, today=None, limit=MAX_REQ):
    user = user if user is not None else os.environ.get("ICECAT_USER", "").strip()
    if not user and fetch is None:
        return {}, {"ok": True, "apagado": "falta el secreto ICECAT_USER"}
    today = today or dt.date.today().isoformat()
    fetch = fetch or _http_fetch(user)
    path = Path(raw_dir) / "icecat_cache.json"
    try:
        cache = json.loads(path.read_text()) if path.exists() else {}
    except ValueError:
        cache = {}
    st = {"ok": True, "consultas": 0, "vinculadas": 0, "sin_ficha": 0, "solo_pago": 0, "rechazadas": 0}
    items, used = {}, 0
    todo = sorted((g for g in groups if g.get("category") in CATS and not g.get("spec")), key=lambda g: -len(g.get("offers", ())))
    try:
        for g in todo:
            cat, name = g["category"], g["name"]
            brand = brand_of(name)
            if not brand:
                continue
            for code in codes(name):
                ck = f"{brand}|{code}".lower()
                c = cache.get(ck)
                fresh = c and (dt.date.fromisoformat(today) - dt.date.fromisoformat(c["t"])).days < (TTL_OK if c["r"] == "ok" else TTL_NO)
                if fresh:
                    res, resp = c["r"], c.get("resp")
                else:
                    if used >= limit:
                        break
                    res, resp = fetch(brand, code)
                    used += 1
                    st["consultas"] += 1
                    cache[ck] = {"t": today, "r": res, "resp": resp if res == "ok" else None}
                if res == "pago":
                    st["solo_pago"] += 1
                    break
                if res != "ok":
                    continue
                f, info = parse(resp, cat)
                if f is None or len(f) < 2 or not consistent(name, cat, f):
                    st["rechazadas"] += 1
                    continue
                key = "ic:" + str(info.get("id") or ck)
                items[key] = _item(name, cat, f, info, brand, code, c["t"] if fresh else today)
                g["spec"] = key
                st["vinculadas"] += 1
                break
            else:
                st["sin_ficha"] += 1
    except _Stop as e:
        st["ok"], st["error"] = False, str(e)
    try:
        path.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")))
    except OSError:
        pass
    return items, st
