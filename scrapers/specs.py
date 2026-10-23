"""Fichas técnicas de notebooks: obtiene, normaliza, valida y guarda cada dato con su origen.

Fuente actual: el archivo público `productos_caracteristicas` de Compragamer (el mismo que usa su propio sitio).
MEXX tiene las fichas detrás de un desafío anti-bots de Cloudflare y Maximus no publica características
en la ficha: en esos casos NO se intenta saltear nada y el dato queda como "Sin datos".

Formato de salida (site/data/specs.json):
  {"v": 1, "updated": ISO, "sources": {...}, "items": {<pn>: {
      "n": nombre, "s": "Compragamer", "id": id_producto, "url": ficha, "d": "AAAA-MM-DD", "sku": SKU,
      "f": {campo: {"v": valor, "u": unidad, "l": nivel?, "n": nota?}},     # l: ver|est|pend|nd
      "miss": [campos sin dato]}}}
Cada campo hereda del ítem: tienda, URL de la ficha, fecha de captura y SKU (variante exacta).
Nivel por defecto "ver" = dato publicado por la tienda para ese SKU. "pend" = hay una inconsistencia que
conviene confirmar. "nd" = la fuente no lo publica.
"""
import re
import json
import time
import datetime as dt
from pathlib import Path

TTL_HOURS = 24          # no se vuelve a consultar la fuente antes de este tiempo
SPEC_CATS = {"notebooks"}

# etiqueta de Compragamer -> (campo interno, unidad por defecto, tipo)
LABELS = {
    "peso": ("peso", "kg", "num"),
    "ancho": ("ancho", "mm", "num"), "profundidad": ("prof", "mm", "num"), "alto": ("alto", "mm", "num"),
    "tamaño de la pantalla": ("pantalla", "in", "num"), "resolución": ("resolucion", "", "str"),
    "tipo de display": ("panel", "", "str"), "frecuencia de actualizacion": ("hz", "Hz", "num"),
    "touch": ("touch", "", "bool"),
    "modelo cpu": ("cpu", "", "str"), "familia del procesador": ("cpu_familia", "", "str"),
    "modelo gpu": ("gpu", "", "str"), "tipo de gpu": ("gpu_tipo", "", "str"), "memoria gpu": ("vram", "GB", "num"),
    "ram máxima": ("ram_max", "GB", "num"), "ram soldada": ("ram_soldada", "GB", "num"),
    "ram en el slot 1": ("ram_slot1", "GB", "num"), "ram en el slot 2": ("ram_slot2", "GB", "num"),
    "slot 1 ram disponible": ("slot1_libre", "", "bool"), "slot 2 ram disponible": ("slot2_libre", "", "bool"),
    "generación de memorias": ("ram_tipo", "", "str"), "formato de memorias": ("ram_formato", "", "str"),
    "capacidad sólido": ("ssd", "GB", "num"), "puerto m.2": ("m2_libres", "", "num"), "tipo de m.2": ("m2_tipo", "", "str"),
    "sistema operativo": ("so", "", "str"),
    "puertos hdmi": ("hdmi", "", "num"), "puertos usb 2.0 tipo a": ("usb2", "", "num"),
    "puertos usb 3.0 tipo a": ("usb3", "", "num"), "puertos usb 3.2 tipo a": ("usb32a", "", "num"),
    "puertos usb 3.2 tipo c": ("usbc", "", "num"), "cantidad de puertos thunderbolt": ("tb_puertos", "", "num"),
    "tipo de thunderbolt": ("tb", "", "str"), "puertos ethernet": ("ethernet", "", "str"),
    "wifi": ("wifi", "", "str"), "bluetooth": ("bluetooth", "", "bool"), "webcam": ("webcam", "", "bool"),
    "lector de memorias": ("sd", "", "bool"), "lector de huellas": ("huella", "", "bool"),
    "iluminación del teclado": ("teclado_luz", "", "bool"), "idioma del teclado": ("teclado_idioma", "", "str"),
    "pad númerico": ("numpad", "", "bool"), "batería extraible": ("bat_extraible", "", "bool"),
    "color": ("color", "", "str"),
}

# Campos que la fuente actual NO publica: se registran como "Sin datos" para que la app lo diga con claridad.
NOT_PUBLISHED = ["bateria_wh", "autonomia_h", "peso_cargador"]


def _num(txt):
    try:
        return float(str(txt).replace(",", "."))
    except ValueError:
        return None


def _clean(v):
    return int(v) if isinstance(v, float) and v == int(v) else v


def _model_codes(txt):
    """Códigos de modelo de CPU/GPU (7535HS, 12450HX, 8640HS…) para detectar contradicciones nombre/ficha."""
    return set(re.findall(r"\b\d{4,5}[A-Za-z]{0,3}\b", txt or "", re.I))


def normalize(entry, name):
    """entry: {'caracteristicas': [{etiqueta, valor, unidades, tipo}]} -> (fields, miss)."""
    f = {}
    for e in entry.get("caracteristicas") or []:
        key = LABELS.get((e.get("etiqueta") or "").strip().lower())
        if not key:
            continue
        field, unit, kind = key
        raw = e.get("valor")
        if raw is None or str(raw).strip() == "":
            continue
        if kind == "num":
            val = _num(raw)
            if val is None:
                continue
            val = _clean(val)
        elif kind == "bool":
            val = str(raw).strip().lower() in ("1", "true", "si", "sí")
        else:
            val = str(raw).strip()
        rec = {"v": val}
        u = unit or (e.get("unidades") or "").strip()
        if u and kind == "num":
            rec["u"] = u
        f[field] = rec
    # coherencia y reglas de validación -------------------------------------------------
    if "peso" in f and not (0.3 <= f["peso"]["v"] <= 8):
        f["peso"]["l"], f["peso"]["n"] = "pend", "Peso fuera de rango esperado para un notebook: confirmar en la ficha."
    if "pantalla" in f and not (9 <= f["pantalla"]["v"] <= 21):
        f["pantalla"]["l"], f["pantalla"]["n"] = "pend", "Tamaño de pantalla fuera de rango: confirmar."
    if "ram_soldada" in f or "ram_slot1" in f or "ram_slot2" in f or "slot1_libre" in f:
        total = f.get("ram_soldada", {"v": 0})["v"] + f.get("ram_slot1", {"v": 0})["v"] + f.get("ram_slot2", {"v": 0})["v"]
        libres = int(f.get("slot1_libre", {"v": False})["v"]) + int(f.get("slot2_libre", {"v": False})["v"])
        f["ram_ampliable"] = {"v": libres > 0, "n": f"{libres} slot(s) libre(s)" if libres else "Sin slots libres" +
                              (" (RAM soldada)" if f.get("ram_soldada") else "")}
        if total:
            f["ram_instalada"] = {"v": _clean(total), "u": "GB", "n": "Suma de lo que informa la ficha (soldada + slots)."}
    cpu = f.get("cpu")
    if cpu:
        in_name, in_sheet = _model_codes(name), _model_codes(cpu["v"])
        up = lambda c: c.upper()
        for sc in (x for x in in_sheet if re.search(r"[A-Za-z]$", x)):
            # solo se compara contra códigos del mismo "formato" (misma cantidad de dígitos y de letras): evita confundir la GPU (RTX 3050)
            shape = lambda c: (len(re.sub(r"\D", "", c)), len(re.sub(r"\d", "", c)))
            rivals = {up(n) for n in in_name if shape(n) == shape(sc)}
            if rivals and up(sc) not in rivals:
                cpu["l"] = "pend"
                cpu["n"] = (f"El título del producto menciona {sorted(rivals)[0]} pero la ficha dice «{cpu['v']}»: "
                            "la propia tienda se contradice, confirmalo antes de comprar.")
    miss = [k for k in ("peso", "pantalla", "cpu", "ram_max", "ssd") if k not in f] + NOT_PUBLISHED
    return f, miss


def pn_key(sku):
    s = re.sub(r"^\s*SKU:\s*", "", str(sku or "")).strip()
    return re.sub(r"[^a-z0-9]", "", s.lower()) if re.search(r"[A-Za-z]", s) and re.search(r"\d", s) and len(s) >= 6 else None


def build_items(chars, products, today):
    """chars: lista [{id_producto, caracteristicas}], products: ítems crudos de Compragamer (con pid)."""
    by_id = {c.get("id_producto"): c for c in chars}
    items = {}
    for p in products:
        if p.get("store") != "Compragamer" or p.get("category") not in SPEC_CATS or p.get("pid") is None:
            continue
        key = pn_key(p.get("pn") or p.get("sku"))
        if not key:
            continue
        entry = by_id.get(p["pid"]) or {}
        f, miss = normalize(entry, p["name"])
        if p.get("warranty_months"):
            f["garantia"] = {"v": p["warranty_months"], "u": "meses", "n": "Garantía informada por la tienda."}
        items[key] = {"n": p["name"], "s": "Compragamer", "id": p["pid"], "url": p["url"], "d": today,
                      "sku": re.sub(r"^\s*SKU:\s*", "", p.get("sku") or ""), "f": f, "miss": miss,
                      "sheet": bool(entry.get("caracteristicas"))}
    return items


def refresh(products, raw_dir, only=None, force=False, fetch=None, now=None):
    """Devuelve (items, estado). Usa caché en raw/specs_Compragamer.json con TTL y reintentos."""
    from . import common
    now = now or dt.datetime.now(dt.timezone.utc)
    cache = Path(raw_dir) / "specs_Compragamer.json"
    prev = json.loads(cache.read_text()) if cache.exists() else None
    if only is not None and "Compragamer" not in only and prev:
        return prev["items"], {"ok": True, "cached": True, "count": len(prev["items"])}
    if prev and not force:
        age = (now - dt.datetime.fromisoformat(prev["fetched"])).total_seconds() / 3600
        # si hay notebooks nuevos sin ficha en la caché, se vuelve a consultar aunque no venza el TTL
        cg = [p for p in products if p.get("store") == "Compragamer" and p.get("category") in SPEC_CATS
              and pn_key(p.get("pn") or p.get("sku"))]
        unknown = [p for p in cg if pn_key(p.get("pn") or p.get("sku")) not in prev["items"]]
        if age < TTL_HOURS and not unknown:
            return prev["items"], {"ok": True, "cached": True, "count": len(prev["items"]), "age_h": round(age, 1)}
    try:
        chars = (fetch or (lambda: common.get("https://static.compragamer.com/productos_caracteristicas", as_json=True)))()
        items = build_items(chars, products, now.date().isoformat())
        if not items:
            raise RuntimeError("0 fichas")
        cache.write_text(json.dumps({"fetched": now.isoformat(timespec="minutes"), "items": items}, ensure_ascii=False))
        return items, {"ok": True, "count": len(items), "con_ficha": sum(1 for i in items.values() if i["sheet"])}
    except Exception as e:
        if prev:   # se conserva lo último que se pudo leer y se avisa que está desactualizado
            return prev["items"], {"ok": False, "stale": True, "count": len(prev["items"]), "error": str(e)[:300],
                                   "fetched": prev["fetched"]}
        return {}, {"ok": False, "count": 0, "error": str(e)[:300]}


def attach(groups, items):
    """Marca cada grupo con la ficha que corresponde a su SKU exacto (nunca mezcla variantes)."""
    n = 0
    for g in groups:
        if g.get("category") != "notebooks":
            continue
        hits = {k for k in g.get("_pns", ()) if k in items}
        if len(hits) == 1:
            g["spec"] = next(iter(hits))
            n += 1
    return n
