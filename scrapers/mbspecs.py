"""Fichas técnicas de placas madre leídas de la página OFICIAL del fabricante (ASRock, MSI, Gigabyte y ASUS).

Se usa para lo que la tienda no suele decir en el título: socket, chipset, tipo de memoria, formato y si trae Wi-Fi.
Reglas de honestidad:
  · Solo se guarda la ficha si el nombre del modelo en la página del fabricante coincide EXACTO con el del producto.
    Si no coincide (o la página no existe), no se guarda nada y el comparador sigue con lo que dice el título.
  · «Wi-Fi: No» solo se informa cuando la ficha se leyó completa y no lista ninguna fila inalámbrica.
  · No se saltea ningún bloqueo: ante 403/429 se corta ese intento y se anota (common.get ya lo hace).
robots.txt (revisado el 2026-10-27): ASRock solo bloquea /asrockrack/; MSI bloquea /search/, /cart/, /checkout/ y utm.
Límites: MAX_FETCH (150) páginas por corrida, de las placas más vendidas a las menos,, con la pausa normal entre pedidos, y caché para no repetirlas.
"""
import re
import json
import datetime as dt
from pathlib import Path
from urllib.parse import quote
from bs4 import BeautifulSoup

MAX_FETCH = 150
TTL_OK, TTL_NO = 45, 10          # días antes de volver a consultar un modelo (leído / no encontrado)
BRANDS = {"asrock": "ASRock", "msi": "MSI", "gigabyte": "Gigabyte", "asus": "ASUS"}
_STOP = re.compile(r"^(ddr[45]|am[45]|lga\d*|socket|matx|m-?atx|atx|itx|mini|micro|intel|amd|ryzen|"
                   r"box|oem|bulk|1[0-9]{3}|1700|1200|1851|placa|motherboard|mother|mainboard|de|video|para|con)$", re.I)
_CHIP = re.compile(r"^[ABXHZWQ]\d{2,3}[A-Z]?[A-Z]?(?:-|$|[A-Z0-9])", re.I)


def brand_in(name):
    n = name.lower()
    for k, v in BRANDS.items():
        if re.search(rf"\b{k}\b", n):
            return v
    return None


def model_candidates(name, brand):
    """Del título saca los modelos posibles (del más largo al más corto), a partir del chipset."""
    toks = re.sub(r"[(),;]", " ", re.sub(re.escape(brand), " ", name, flags=re.I)).split()
    for i, t in enumerate(toks):
        if _CHIP.match(t) and not _STOP.match(t):
            run = []
            for u in toks[i:i + 6]:
                if _STOP.match(u) and run:
                    break
                run.append(u)
            if brand == "MSI" and i and toks[i - 1].upper() in ("MAG", "MPG", "MEG", "PRO"):
                run = [toks[i - 1]] + run
            if brand == "ASUS":
                j = i
                while j and toks[j - 1].upper() in ("PRIME", "TUF", "GAMING", "ROG", "STRIX", "PROART", "MAXIMUS", "CROSSHAIR"):
                    j -= 1
                run = toks[j:i] + run
            out = [" ".join(run[:k]) for k in range(len(run), 0, -1)]
            return [c for c in out if _CHIP.search(c.split()[-1]) or len(c.split()) > 1 and any(_CHIP.match(w) for w in c.split())]
    return []


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _form(txt):
    t = (txt or "").lower()
    if re.search(r"e-?atx", t):
        return "E-ATX"
    if re.search(r"mini[- ]?itx", t):
        return "Mini-ITX"
    if re.search(r"micro[- ]?atx|m-?atx", t):
        return "Micro-ATX"
    if re.search(r"\batx\b", t):
        return "ATX"
    return None


def _socket(txt):
    m = re.search(r"\b(AM[45]|LGA\s?\d{4})\b", txt or "", re.I)
    return re.sub(r"\s", "", m.group(1)).upper() if m else None


def _ddr(txt):
    m = re.search(r"DDR([45])", txt or "", re.I)
    return "DDR" + m.group(1) if m else None


def _chip(txt):
    m = re.search(r"\b([ABXHZWQ]\d{3}[A-Z]?E?)\b", txt or "")
    return m.group(1) if m else None


def asrock_url(model, segment):
    return f"https://www.asrock.com/mb/{segment}/{quote(model)}/index.asp"


def parse_asrock(html, model):
    """Devuelve {model, socket, chipset, ddr, form, wifi} o None si la página no es EXACTAMENTE ese modelo."""
    soup = BeautifulSoup(html, "lxml")
    h = soup.find("h1")
    opts = [h.get_text(" ", strip=True) if h else "", re.split(r"[>|]", soup.title.get_text() if soup.title else "")[-1].strip()]
    page = next((x for x in opts if x and _norm(x) == _norm(model)), None)
    if not page:
        return None
    rows = {}
    for it in soup.select(".SpecItem"):
        d = it.find_next_sibling(class_="SpecData")
        if d:
            rows[it.get_text(" ", strip=True).lower()] = d.get_text(" ", strip=True)
    if not rows.get("chipset") and not rows.get("cpu"):
        return None
    wl = rows.get("wireless lan") or ""
    return {"model": page.strip(), "socket": _socket(rows.get("cpu")), "chipset": _chip(rows.get("chipset")),
            "ddr": _ddr(rows.get("memory")), "form": _form(rows.get("form factor")),
            "wifi": bool(re.search(r"wi-?fi|802\.11", wl, re.I))}


def msi_url(model):
    return "https://www.msi.com/Motherboard/" + re.sub(r"\s+", "-", model.strip().upper()) + "/Specification"


def parse_msi(html, model):
    soup = BeautifulSoup(html, "lxml")
    lines = [re.sub(r"\s+", " ", x).strip() for x in soup.get_text("\n").split("\n")]
    lines = [x for x in lines if x]
    h = soup.find("h1")
    if not h or _norm(h.get_text(" ", strip=True)) != _norm(model):
        return None
    chip = next((lines[i + 1] for i, x in enumerate(lines[:-1]) if x.lower() == "chipset" and "chipset" in lines[i + 1].lower()), None)
    form = next((f for f in (_form(x) for x in lines if re.search(r"form factor", x, re.I)) if f), None)
    if not chip and not form:
        return None
    lan_listed = any(x.lower() == "lan" for x in lines)
    return {"model": model.upper(), "socket": _socket(next((x for x in lines if re.match(r"(AMD|Intel).*Socket", x, re.I)), "")),
            "chipset": _chip(chip),
            "ddr": _ddr(next((x for x in lines if re.search(r"memory slots", x, re.I)), "")), "form": form,
            "wifi": True if any(re.match(r"^(wi-?fi|wireless)", x, re.I) for x in lines) else (False if lan_listed and form else None)}


_GB_LABELS = {"cpu", "chipset", "memory", "onboard graphics", "audio", "lan", "expansion slots", "storage interface", "usb",
              "internal i/o connectors", "back panel connectors", "i/o controller", "h/w monitoring", "bios", "unique features",
              "bundled software", "operating system", "form factor", "remark"}


def gigabyte_urls(model):
    slug = re.sub(r"\s+", "-", model.strip())
    return f"https://www.gigabyte.com/Motherboard/{slug}", slug


def gigabyte_rev_slug(html, slug):
    """La página base redirige a «…-rev-10-11»; de ahí sale la dirección de la ficha completa."""
    m = re.search(rf"/Motherboard/({re.escape(slug)}-rev-[0-9a-z-]+)", html, re.I)
    return m.group(1) if m else None


def parse_gigabyte(html, model):
    """Ficha de gigabyte.com/Motherboard/<modelo-rev>/sp. El nombre del modelo de la página debe ser EXACTAMENTE el pedido."""
    soup = BeautifulSoup(html, "lxml")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    page = re.split(r"\s*\(Rev|\s+Motherboard", title)[0].strip()
    if _norm(page) != _norm(model):
        return None
    rev = re.search(r"\((Rev\.[^)]*)\)", title)
    lines = [re.sub(r"\s+", " ", x).strip() for x in soup.get_text("\n").split("\n")]
    rows, cur = {}, None
    for x in (x for x in lines if x):
        k = x.lower()
        if k == "specifications":
            rows, cur = {}, None            # el contenido empieza después del título «Specifications»
        elif k in _GB_LABELS or k.startswith("wireless communication"):
            cur = "wireless" if k.startswith("wireless") else k
            rows.setdefault(cur, [])
        elif cur:
            rows[cur].append(x)
    if not rows.get("chipset") or not rows.get("form factor"):
        return None
    mem = " ".join(rows.get("memory", []))
    return {"model": page, "rev": rev.group(1) if rev else None, "socket": _socket(" ".join(rows.get("cpu", []))),
            "chipset": _chip(" ".join(rows["chipset"])), "ddr": _ddr(mem), "form": _form(" ".join(rows["form factor"])),
            "wifi": bool(re.search(r"wi-?fi|802\.11|wlan", " ".join(rows.get("wireless", [])), re.I))}


_ASUS_SERIES = (("rog strix", "rog-strix"), ("rog maximus", "rog-maximus"), ("rog crosshair", "rog-crosshair"), ("tuf gaming", "tuf-gaming"),
                ("proart", "proart"), ("prime", "prime"), ("rog", "rog-strix"))
_ASUS_LABELS = {"cpu", "chipset", "memory", "graphics", "expansion slots", "storage", "raid support", "ethernet", "usb", "audio",
                "back panel i/o ports", "internal i/o connectors", "special features", "software features", "bios", "manageability",
                "accessories", "operating system", "form factor"}


def asus_urls(model):
    """«PRIME B550M-K» -> …/motherboards/prime/prime-b550m-k/techspec/ (la serie sale del nombre)."""
    low = model.lower()
    for key, seg in _ASUS_SERIES:
        if low.startswith(key + " ") or low == key:
            slug = re.sub(r"[^a-z0-9]+", "-", low).strip("-")
            return f"https://www.asus.com/motherboards-components/motherboards/{seg}/{slug}/techspec/"
    return None


def parse_asus(html, model):
    """Tech Specs de asus.com. Si el servidor entrega la página sin armar (JavaScript), no hay etiquetas y devuelve None."""
    soup = BeautifulSoup(html, "lxml")
    lines = [re.sub(r"\s+", " ", x).strip() for x in soup.get_text("\n").split("\n")]
    lines = [x for x in lines if x]
    mi = next((i for i, x in enumerate(lines[:-1]) if x == "Model"), None)
    if mi is None or _norm(lines[mi + 1]) != _norm(model):
        return None
    rows, cur = {}, None
    for x in lines[mi + 2:]:
        k = x.lower()
        if k in _ASUS_LABELS or k.startswith("wireless"):
            cur = "wireless" if k.startswith("wireless") else k
            rows.setdefault(cur, [])
        elif cur:
            rows[cur].append(x)
    if not rows.get("chipset") or not rows.get("form factor"):
        return None
    return {"model": lines[mi + 1], "socket": _socket(" ".join(rows.get("cpu", []))), "chipset": _chip(" ".join(rows["chipset"])),
            "ddr": _ddr(" ".join(rows.get("memory", []))), "form": _form(" ".join(rows["form factor"])),
            "wifi": bool(re.search(r"wi-?fi|802\.11", " ".join(rows.get("wireless", [])), re.I))}


def _key(brand, model):
    return f"mb:{brand.lower()}:{_norm(model)}"


def _item(brand, model, url, d, spec):
    f = {}
    for fld, val in (("socket", spec["socket"]), ("chipset", spec["chipset"]), ("ddr", spec["ddr"]), ("form", spec["form"])):
        if val:
            f[fld] = {"v": val, "u": ""}
    if spec["wifi"] is True:
        f["wifi"] = {"v": True, "u": ""}
    elif spec["wifi"] is False:
        f["wifi"] = {"v": False, "u": "", "n": "La ficha del fabricante no lista Wi-Fi."}
    return {"n": f"{brand} {spec['model']}", "s": brand, "id": None, "url": url, "d": d, "sku": spec["model"] + (f" ({spec['rev']})" if spec.get("rev") else ""),
            "f": f, "miss": [x for x in ("socket", "chipset", "ddr", "form", "wifi") if x not in f], "sheet": True}


def lookup(brand, name, fetch, today):
    """Prueba los modelos candidatos del título; devuelve (key, item) o None. fetch(url) -> html (o lanza)."""
    for model in model_candidates(name, brand):
        if brand == "ASRock":
            for seg in ("AMD", "Intel"):
                url = asrock_url(model, seg)
                try:
                    spec = parse_asrock(fetch(url), model)
                except Exception:
                    continue
                if spec:
                    return _key(brand, spec["model"]), _item(brand, spec["model"], url, today, spec)
        elif brand == "ASUS":
            url = asus_urls(model)
            if not url:
                continue
            try:
                spec = parse_asus(fetch(url), model)
            except Exception:
                continue
            if spec:
                return _key(brand, model), _item(brand, model, url, today, spec)
        elif brand == "Gigabyte":
            base, slug = gigabyte_urls(model)
            try:
                rev = gigabyte_rev_slug(fetch(base), slug)
                if not rev:
                    continue
                url = f"https://www.gigabyte.com/Motherboard/{rev}/sp"
                spec = parse_gigabyte(fetch(url), model)
            except Exception:
                continue
            if spec:
                return _key(brand, model), _item(brand, model, url, today, spec)
        else:
            url = msi_url(model)
            try:
                spec = parse_msi(fetch(url), model)
            except Exception:
                continue
            if spec:
                return _key(brand, model), _item(brand, model, url, today, spec)
    return None


def refresh(groups, raw_dir, fetch=None, today=None, limit=MAX_FETCH):
    """Busca la ficha oficial de cada placa madre de ASRock/MSI. Nunca rompe la actualización."""
    from . import common
    today = today or dt.date.today().isoformat()
    fetch = fetch or common.get
    path = Path(raw_dir) / "mbspecs_cache.json"
    cache = json.loads(path.read_text()) if path.exists() else {}
    used, items, st = 0, {}, {"consultadas": 0, "leidas": 0, "sin_ficha": 0}
    mobos = sorted((g for g in groups if g.get("category") == "motherboards"), key=lambda g: -len(g.get("offers", ())))
    for g in mobos:      # primero las que más tiendas venden (son las que más se comparan)
        brand = brand_in(g["name"])
        if not brand:
            continue
        ck = _norm(g["name"])
        c = cache.get(ck)
        age = (dt.date.fromisoformat(today) - dt.date.fromisoformat(c["t"])).days if c else None
        if c and age is not None and age < (TTL_OK if c.get("k") else TTL_NO):
            hit = (c["k"], c["item"]) if c.get("k") else None
        elif used >= limit:
            hit = None
        else:
            cnt = []
            hit = lookup(brand, g["name"], lambda u: (cnt.append(1), fetch(u))[1], today)
            used += len(cnt)
            cache[ck] = {"t": today, "k": hit[0] if hit else None, "item": hit[1] if hit else None}
            st["consultadas"] += 1
        if hit:
            items[hit[0]] = hit[1]
            g["spec"] = hit[0]
            st["leidas"] += 1
        else:
            st["sin_ficha"] += 1
    try:
        path.write_text(json.dumps(cache, ensure_ascii=False))
    except OSError:
        pass
    st["ok"] = True
    return items, st
