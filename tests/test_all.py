import json, sys
sys.path.insert(0, ".")
from scrapers.common import parse_ars, canon_category, fix_category
from scrapers import mexx, maximus, gezatek, fullh4rd, logg, compragamer
import build_data as bd

def test_ars():
    assert parse_ars("$49.899") == 49899
    assert parse_ars("$270.920,08") == 270920.08
    assert parse_ars("") is None

MEXX = '''<div class="productos"><h4 class="card-title"><a href="/producto/x">Micro AMD Ryzen 5 5500 AM4</a></h4>
<div class="card-description"><span>Art: 100-100000457BOX</span><span>AMD</span></div>
<span class="enstocklistado">EN STOCK</span><div class="price"><h4><b>$129.900</b></h4></div></div>'''
MAX = '''<article class="mxCardProduct" id="card-55"><a class="mxCardProduct__link" href="/Producto/x.aspx?ITEM=55/PN=100-100000457BOX/"></a>
<div class="mxCardProduct__title">Procesador AMD Ryzen 5 5500 Box</div><div class="mxCardProduct__price">$124.500</div>
<div class="mxCardProduct__oldPrice">$140.000</div><div class="mxCardProduct__installments">3 cuotas sin interés</div>
<span class="mxCardProduct__ratingScore">4,8</span><span class="mxCardProduct__ratingCount">(12)</span></article>'''
GEZA = '''<div class="prod-cat" data-id="7891" data-nombre="Micro AMD Ryzen 5 5500 - 6 Nucleos 12 Threads 4.2Ghz AM4" data-precio="119000">
<h4 class="card-title"><a href="/procesadores/procesadores-amd/micro-7891.html">x</a></h4><font class="et">En stock</font>
<h6 class="precio_mp">$131.000</h6><h4 class="pecio_final"><b>$119.000</b></h4></div>'''
FULL = '''<article class="results-card"><a class="results-card__title-link" href="/prod/123/ryzen-5-5500">Procesador AMD Ryzen 5 5500 AM4</a>
<div class="results-card__meta">Procesadores</div><div class="results-card__price-current">$118.920,08</div><div class="results-card__price-list">$130.000,00</div></article>'''
LOGG = '''<a class="product-card" href="/Products/9"><h5 class="card-title">Micro AMD Ryzen 5 5500 AM4</h5><h5 class="card-price">$127.000</h5>¡Quedan pocas!</a>'''
CG = [{"id_producto": 1, "nombre": "Procesador AMD Ryzen 5 5500 AM4 Box", "precioEspecial": 121000, "precioLista": 133000,
       "stock": 3, "codigo_principal": ["100-100000457BOX"], "id_subcategoria": 5}]

def test_parsers_and_matching():
    items = (mexx.parse(MEXX) + maximus.parse(MAX) + gezatek.parse(GEZA) + fullh4rd.parse(FULL)
             + logg.parse(LOGG) + compragamer.parse(CG, {5: "Procesadores"}))
    assert len(items) == 6 and all(i["price_cash"] for i in items)
    assert items[1]["rating"] == {"score": 4.8, "count": 12}
    assert items[2]["price_cash"] == 119000 and items[2]["price_list"] == 131000
    assert items[3]["price_cash"] == 118920.08
    assert all(i["category"] == "procesadores" for i in items), [i["category"] for i in items]
    groups = bd.build(items)
    # MEXX, Maximus y Compragamer comparten PN; Gezatek/Fullh4rd/Logg se cruzan por nombre (modelo 5500 + am4)
    print(json.dumps([(g["name"], [(o["store"], o["price_cash"]) for o in g["offers"]]) for g in groups], ensure_ascii=False))
    assert len(groups) <= 2


def test_history_and_changes():
    import datetime as dt
    today = "2026-10-22"
    items = (compragamer.parse([{"id_producto": 1, "nombre": "Procesador AMD Ryzen 5 5500 AM4 Box", "precioEspecial": 100000,
                                 "precioEspecialAnterior": 120000, "stock": 2, "vendible": 1,
                                 "codigo_principal": ["SKU: 100-100000457BOX"], "id_subcategoria": 27,
                                 "imagenes": [{"nombre": "1_x_abc"}]}], {27: "Procesadores AMD"}))
    assert items[0]["pn"] == "100-100000457BOX" and items[0]["image"].endswith("1_x_abc-mini.jpg")
    groups = bd.build(items)
    hist = {"_v": 2}
    bd.update_history(groups, hist, today)
    bd.annotate_changes(groups, hist, today)
    assert groups[0]["chg"]["pct"] == -16.7 and groups[0]["brand"] == "AMD"
    # sube mañana
    items[0]["price_cash"] = 110000
    g2 = bd.build(items); bd.update_history(g2, hist, "2026-10-23"); bd.annotate_changes(g2, hist, "2026-10-23")
    assert g2[0]["chg"]["pct"] == 10.0
    # categorías
    from scrapers.common import canon_category
    assert canon_category("Cable Premium Micro Hdmi A Hdmi") == "accesorios"
    assert canon_category("Memoria Micro SDHC Team 16GB") == "almacenamiento"
    assert canon_category("Fuente X-Micro 550W OEM") == "fuentes"
    assert canon_category("Micro AMD Ryzen 5 5500") == "procesadores"
    assert canon_category("ARMADO ITEM 6302 GTX 1050 Ti ATHLON 950 8GB") == "pcs-armadas"


def test_servicios():
    from scrapers.common import is_service
    for n in ["ARMADO DE PC FM2+ A8 A10", "ARMADO ITEM 6302 GTX 1050 Ti ATHLON 950 8GB", "Armado de PC item 5104",
              "ARMADO EXPRESS DE PC", "ARMADO DE BRIX/NOTEBOOK Y AFINES", "ARMADO DE PC ASUS"]:
        assert is_service(n), n
    for n in ["PC Armada Gamer Ryzen 5 5600 RTX 4060", "Procesador AMD Ryzen 5 5500", "Gabinete con fuente"]:
        assert not is_service(n), n


def test_hardware_json():
    import re, subprocess, sys
    import make_hardware as mh
    ids = [g[0] for g in mh.G] + [c[0] for c in mh.C] + [l[0] for l in mh.LEG] + [g[0] for g in mh.GX]
    assert len(ids) == len(set(ids))
    for g in mh.G:
        assert g[4] > 0 and g[5] >= g[4] and all(x > 0 for x in g[6]), g[0]   # la fuente nunca es menor al consumo
        re.compile(g[9]); re.compile(g[10] or "x")
    assert all(k in {c[0] for c in mh.C} for k in mh.EST)
    for k, (conf, note) in mh.EST.items():     # todo puntaje estimado dice cómo se calculó
        assert conf in ("alta", "media", "baja") and len(note) > 30, k
    for l in mh.LEG:                            # placas viejas: estimadas, con datos coherentes y sin pisar a otras
        assert l[4] > 0 and l[5] >= l[4] and 10 < l[6] < 100, l[0]
        re.compile(l[7]); re.compile(l[8] or "x")
    for c in mh.C:
        # sin puntaje de juegos solo si no hay medición (i3-12100F y los agregados por la auditoría, todos con ficha oficial)
        assert c[7] is not None or c[0] == "i3-12100f" or c[0] in mh.NEW_CPU, c[0]
        assert (c[6] is None or c[6] >= c[5]) and c[3] in ("AM4", "AM5", "LGA1700", "LGA1851", "LGA1200", "LGA1151"), c[0]
        re.compile(c[9])
        # el tipo de memoria debe ser coherente con el socket
        assert (c[3] in ("AM5", "LGA1851")) == (c[4] == "DDR5") or c[3] == "LGA1700", c[0]
        assert c[3] != "LGA1200" or c[4] == "DDR4", c[0]
    for g in mh.GX:                              # placas solo para comparar
        assert g[4] > 0 and (g[5] is None or g[5] >= g[4]) and g[0] in mh.VURL and g[0] in mh.GS, g[0]
        re.compile(g[9]); re.compile(g[10] or "x")
    for i in mh.NEW_CPU:                         # cada procesador agregado tiene ficha oficial y especificaciones
        assert i in mh.VURL and i in mh.CS and mh.VERIFIED.get(i), i


def test_categorias_pc_armadas():
    from scrapers.common import canon_category, is_service
    for n in ["PC Armada AMD Ryzen 5 5500 RTX 3050 16GB 512GB", "PC Powered by MSI Ultimate Intel Ultra 5 245KF B860 RTX 5060",
              "PC Gamer R7-7700X 32GB RAM SSD 1TB RX 9070 XT 16GB WIFI"]:
        assert canon_category(n) == "pcs-armadas", n   # antes caían en "placas de video"
    assert canon_category("Placa de Video MSI GeForce RTX 5070 Ti 16GB") == "placas-de-video"
    assert is_service("Service Instalación Cooler CPU en equipos armados")
    assert canon_category("MONITOR 19 PERFORMANCE PF185R VGA/HDMI") == "monitores"   # «HDMI» en el título no lo vuelve accesorio
    assert canon_category("Cable HDMI 2.1 2 metros") == "accesorios"


def test_hardware_especificaciones():
    import json, re
    from pathlib import Path
    hw = json.loads((Path("site/data/hardware.json")).read_text())
    # actualización 15: fichas oficiales nuevas; lo que la ficha no aclara NO figura como verificado
    gx = {g["id"]: g for g in hw["gpux"]}
    assert gx["gt-1030"]["spec"]["bw"] is None and "tgp" not in gx["gt-1030"]["ver"], "ficha de NVIDIA inconsistente: sin verificar"
    assert gx["arc-a380"]["spec"]["bw"] == 186 and "sp" not in gx["arc-a380"]["ver"]
    cp = {c["id"]: c for c in hw["cpus"]}
    assert cp["p-4560"]["socket"] == "LGA1151" and cp["c-4900"]["spec"]["threads"] == 2 and cp["pg-5400"]["s"] is None
    for g in hw["gpus"]:
        sp = g["spec"]
        assert sp["bw"] == round(sp["bus"] / 8 * sp["gbps"]), g["id"]
        assert set(g["ver"]) <= set(sp) | {"vram", "tgp", "psu"}, g["id"]
        re.compile(g["m"])
    for c in hw["cpus"]:
        sp = c["spec"]
        assert sp["threads"] >= sp["cores"] and sp["boost"] > 3, c["id"]
        assert set(c["ver"]) <= set(sp) | {"tdp", "maxp", "socket", "mem"}, c["id"]
        assert not re.search(c["m"], "placa de video rx 7600 8gb", re.I), c["id"]   # "RX 7600" no es el Ryzen 5 7600
    # lo verificado trae enlace oficial y fecha; lo antiguo sin ficha legible no se marca verificado
    from urllib.parse import urlparse
    for x in hw["gpus"] + hw["cpus"]:
        if x["ver"]:
            assert x["vurl"].startswith("https://") and urlparse(x["vurl"]).netloc.endswith(("nvidia.com", "amd.com", "intel.com")), x["id"]
            assert re.match(r"\d{4}-\d\d-\d\d$", x["vdate"]), x["id"]
        else:
            assert "vurl" not in x and "vdate" not in x, x["id"]
    assert all(c["ver"] for c in hw["cpus"]) and all({"cores", "threads", "boost", "l3", "tdp"} <= set(c["ver"]) for c in hw["cpus"])
    by = {g["id"]: g for g in hw["gpus"]}
    assert (by["rtx-3080"]["tgp"], by["rtx-4060ti"]["tgp"], by["rx-9060xt-8"]["tgp"]) == (320, 160, 150), "correcciones contra la ficha oficial"
    assert not any(by[i]["ver"] for i in by if by[i].get("se")), "las placas con rendimiento estimado no figuran como verificadas"
    assert {"tgp", "psu", "vram"} <= set(by["rtx-5070"]["ver"]) and by["rx-7900xtx"]["ver"].count("bus") == 0
    # Intel F no trae gráficos integrados
    for c in hw["cpus"]:
        if c["id"].endswith("f") and c["vendor"] == "Intel":
            assert c["spec"]["igpu"] is False, c["id"]


# ---------- fichas técnicas (actualización 4) ----------
import tempfile, datetime as _dt
from scrapers import specs as _sp

_CHARS = json.load(open("tests/fixtures/specs_cg.json"))
_NB = [
    {"store": "Compragamer", "category": "notebooks", "pid": 17501, "sku": "83DK006HAR", "pn": "83DK006HAR", "warranty_months": 12,
     "name": 'Notebook Lenovo Yoga 7 14" AMD Ryzen 5 8640HS 8GB DDR5 SSD 512GB', "url": "https://compragamer.com/producto/x_17501"},
    {"store": "Compragamer", "category": "notebooks", "pid": 20131, "sku": "ANV15-41-R6NM", "pn": "ANV15-41-R6NM", "warranty_months": 12,
     "name": 'Notebook Gamer Acer Nitro V 15 Ryzen 5 7535HS 8GB RTX 3050', "url": "https://compragamer.com/producto/y_20131"},
    {"store": "Compragamer", "category": "notebooks", "pid": 21080, "sku": "83GS00VXAR", "pn": "83GS00VXAR", "warranty_months": 6,
     "name": "Notebook Gamer Lenovo LOQ 15IAX9 i5 12450HX", "url": "https://compragamer.com/producto/z_21080"},
]


def test_specs_normalize_units_and_provenance():
    items = _sp.build_items(_CHARS, _NB, "2026-10-23")
    a = items["83dk006har"]
    assert a["f"]["peso"] == {"v": 1.61, "u": "kg"}
    assert a["f"]["pantalla"]["v"] == 14 and a["f"]["hz"]["u"] == "Hz"
    assert a["f"]["ram_ampliable"]["v"] is False and a["f"]["ram_instalada"]["v"] == 8
    assert a["f"]["garantia"] == {"v": 12, "u": "meses", "n": "Garantía informada por la tienda."}
    assert a["s"] == "Compragamer" and a["d"] == "2026-10-23" and a["sku"] == "83DK006HAR" and a["url"].endswith("_17501")
    assert "bateria_wh" in a["miss"], "la batería no la publica la fuente: tiene que figurar como sin datos, no inventarse"
    assert "bateria_wh" not in a["f"] and "autonomia_h" not in a["f"]


def test_specs_variants_and_contradictions():
    items = _sp.build_items(_CHARS, _NB, "2026-10-23")
    b = items["anv1541r6nm"]
    assert b["f"]["ram_ampliable"]["v"] is True and b["f"]["ram_instalada"]["v"] == 8
    assert b["f"]["cpu"]["l"] == "pend" and "7535HS" in b["f"]["cpu"]["n"]   # título y ficha se contradicen
    assert "l" not in items["83dk006har"]["f"]["cpu"]                          # sin contradicción: nivel por defecto
    c = items["83gs00vxar"]            # sin ficha en la tienda: solo queda la garantía
    assert c["sheet"] is False and "peso" in c["miss"] and "peso" not in c["f"]


def test_specs_attach_only_exact_sku():
    items = _sp.build_items(_CHARS, _NB, "2026-10-23")
    groups = [{"category": "notebooks", "offers": [], "_pns": ["83dk006har", "otro123abc"]},
              {"category": "notebooks", "offers": [], "_pns": ["anv1541r6nm", "83dk006har"]},   # ambiguo: dos fichas → no se adjunta
              {"category": "notebooks", "offers": [], "_pns": ["zzz999zzz"]},
              {"category": "gpu", "offers": [], "_pns": ["83dk006har"]}]
    assert _sp.attach(groups, items) == 1
    assert groups[0]["spec"] == "83dk006har" and "spec" not in groups[1] and "spec" not in groups[2] and "spec" not in groups[3]


def test_specs_cache_ttl_and_blocked_source():
    d = tempfile.mkdtemp()
    now = _dt.datetime(2026, 10, 23, 12, tzinfo=_dt.timezone.utc)
    calls = []
    def ok():
        calls.append(1); return _CHARS
    it, st = _sp.refresh(_NB, d, fetch=ok, now=now)
    assert st["ok"] and len(calls) == 1 and len(it) == 3
    it, st = _sp.refresh(_NB, d, fetch=ok, now=now + _dt.timedelta(hours=3))      # dentro del TTL: no consulta de nuevo
    assert st.get("cached") and len(calls) == 1
    def blocked():
        raise RuntimeError("HTTP 403")
    it, st = _sp.refresh(_NB, d, fetch=blocked, now=now + _dt.timedelta(hours=30))  # vencido y bloqueado: conserva y avisa
    assert st["ok"] is False and st["stale"] is True and len(it) == 3
    it, st = _sp.refresh(_NB, tempfile.mkdtemp(), fetch=blocked, now=now)         # sin caché: vacío, sin inventar
    assert it == {} and st["ok"] is False


# ---------- tiendas nuevas (actualización 4) ----------
from scrapers import goldentech as _gt, armytech as _at


def test_goldentech_parse():
    items = _gt.parse(json.load(open("tests/fixtures/goldentech.json")))
    assert len(items) == 2, "se descartan las variables y las que no están en pesos"
    a, b = items
    assert a["price_cash"] == 997269.24, "el precio viene en centavos: 99726924 → $997.269,24"
    assert a["category"] == "placas-de-video" and a["stock"] is True and a["store"] == "GoldenTech"
    assert a["sku"] is None and a["pn"] is None and a["store_sku"] == "EL_ASUPDV90YV0GB2X", "el SKU interno no se usa para cruzar"
    assert b["price_cash"] == 87713.35 and b["price_list"] == 95000 and b["stock"] is False and b["category"] == "perifericos"


def test_armytech_parse():
    items = _at.parse(open("tests/fixtures/armytech.html").read())
    assert len(items) == 2
    a = items[0]
    assert a["price_cash"] == 727524.82 and a["category"] == "placas-de-video" and a["store_id"] == "6467"
    assert a["stock"] is None, "el listado no informa stock: no se inventa"
    assert a["price_list"] is None, "no se deduce un precio de lista"
    assert a["cuotas"] == "6 cuotas sin interés de $ 144.292" and a["ean"] == "4719331356743" and a["brand"] == "Gigabyte"
    assert items[1]["price_cash"] == 30000 and items[1]["cuotas"] is None


def test_tiendas_nuevas_no_cruzan_por_sku_interno():
    gt = _gt.parse(json.load(open("tests/fixtures/goldentech.json")))
    at = _at.parse(open("tests/fixtures/armytech.html").read())
    cg = [{"store": "Compragamer", "name": "Placa de Video ASUS GeForce RTX 3060 O12G V2", "url": "https://x/1", "price_cash": 900000,
           "price_list": None, "stock": True, "sku": "90YV0GB2", "pn": "90YV0GB2", "image": None, "category": "placas-de-video", "cuotas": None, "rating": None}]
    groups = bd.build(gt + at + cg)
    names = sorted(g["name"] for g in groups)
    assert len(groups) == len({g["id"] for g in groups}), "ids únicos"
    stores = {o["store"] for g in groups for o in g["offers"]}
    assert {"GoldenTech", "Armytech", "Compragamer"} <= stores


def test_stores_json_reputacion_verificable():
    """Cada puntaje tiene fuente, ficha, fecha y URL; una sola plataforma por tienda; sin ficha verificable no hay puntaje."""
    import re
    d = json.load(open("site/data/stores.json"))["stores"]
    for name, s in d.items():
        for r in s["reputation"]:
            assert r["source"] and r["listing"] and r["url"].startswith("https://") and re.match(r"\d{4}-\d\d-\d\d$", r["date"]), name
            assert isinstance(r["count"], int) and r["count"] > 0 and 1 <= r["score"] <= 5, name
            if r["count"] < 100:   # muestra chica: se avisa en los datos y en la web
                assert any("Pocas opiniones" in n for n in s.get("notes", [])), name + ": falta aviso de muestra chica"
        assert len({r["source"] for r in s["reputation"]}) == len(s["reputation"]), "una puntuación por plataforma; nunca promediadas"
        if not s["reputation"]:
            assert any("ficha" in n.lower() or "reputación" in n.lower() for n in s.get("notes", [])), name + ": explicar por qué no hay puntaje"
    con = {n for n, s in d.items() if s["reputation"]}
    nuevas = {n for n, s in d.items() if s["checked"] == "2026-10-26"}   # actualización 15: reputación todavía sin fuente
    assert len(con) == 17 and {"Gaming City", "Hardloots"} | nuevas == set(d) - con, "solo estas tiendas quedan sin puntaje verificado"
    assert "average" not in json.dumps(d).lower()

def test_logg_marcado_actual():
    from scrapers import logg
    html = '''<a class="product-card " href="/ProductDetail/Ryzen-7-7800X3D-WOF" onclick="callGtagFunction('False','59939','x')"><div class="card-labels"></div>
    <div class="card-img-container"><img src="https://logg.api.cygnus.market/static/a.webp" class="card-img-top" alt="Procesador AMD Ryzen 7 7800X3D 5GHz 96MB Gráficos Radeon Zen4 AM5"></div>
    <div class="card-body"><p class="card-text">Procesador AMD Ryzen 7 7800X3D 5GHz 96MB Gráficos Radeon Zen4 AM5</p><h5 class="card-price"><span class=""> $ 729.999</span></h5></div></a>
    <a class="product-card" href="/ProductDetail/x"><div class="card-body"><p class="card-text">Sin precio</p></div></a>'''
    it = logg.parse(html, "procesadores")
    assert len(it) == 2 and it[0]["name"].startswith("Procesador AMD Ryzen 7 7800X3D") and it[0]["price_cash"] == 729999
    assert it[0]["url"] == "https://logg.com.ar/ProductDetail/Ryzen-7-7800X3D-WOF" and it[0]["category"] == "procesadores" and it[0]["stock"] is None
    assert it[1]["price_cash"] is None   # sin precio: build_data lo descarta, no se inventa


def test_procesador_con_graficos_radeon_no_es_placa():
    assert canon_category("Procesador AMD Ryzen 7 7800X3D 5GHz 96MB Gráficos Radeon Zen4 AM5") == "procesadores"
    assert canon_category("Micro AMD Ryzen 5 5500 AM4") == "procesadores"
    assert canon_category("Placa de Video Radeon RX 7600 8GB") == "placas-de-video"


def test_logg_paginacion():
    from scrapers import logg
    p1 = '''<form method="post"><input type="hidden" name="HeaderCategory.Name" value="Gabinetes"><input name="FilterText" value="">
    <select name="order"><option value="0">Ordenar</option><option value="1" selected>Precio</option></select><input type="hidden" name="__RequestVerificationToken" value="TOK">
    <ul class="pagination"><li class="page-item active"><button formaction="/Products?pageNumber=1&amp;handler=GoToPage">1</button></li>
    <li class="page-item"><button class="page-link" formaction="/Products?pageNumber=2&amp;mode=Vertical&amp;handler=GoToPage">Siguiente</button></li></ul></form>'''
    p2 = '''<ul class="pagination"><li class="page-item active"><button>2</button></li><li class="page-item"><button class="page-link" formaction="/Products?pageNumber=2&amp;handler=GoToPage">Siguiente</button></li></ul>'''
    f = logg.form_fields(p1)
    assert f == {"HeaderCategory.Name": "Gabinetes", "FilterText": "", "order": "1", "__RequestVerificationToken": "TOK"}, f
    assert logg.next_page(p1) == "https://logg.com.ar/Products?pageNumber=2&mode=Vertical&handler=GoToPage"
    assert logg.next_page(p2) is None, "última página: el «Siguiente» apunta a sí misma"
    assert logg.next_page("<p>sin paginación</p>") is None


def test_precio_inusual():
    base = {"store": "X", "name": "Procesador AMD Ryzen 5 5500 AM4 Box", "url": "https://x/1", "price_cash": 100000, "price_list": None,
            "stock": True, "sku": "100-100000457BOX", "pn": "100-100000457BOX", "image": None, "category": "procesadores", "cuotas": None, "rating": None}
    hist = {"_v": 2}
    for day, price in [("2026-10-20", 100000), ("2026-10-21", 30000)]:
        it = dict(base, price_cash=price); g = bd.build([it]); bd.update_history(g, hist, day); bd.annotate_changes(g, hist, day)
    assert g[0]["offers"][0].get("anom") is True and g[0]["offers"][0]["chg"]["pct"] == -70.0
    it = dict(base, price_cash=32000); g = bd.build([it]); bd.update_history(g, hist, "2026-10-22"); bd.annotate_changes(g, hist, "2026-10-22")
    assert not g[0]["offers"][0].get("anom"), "un cambio normal no se marca"


def _it(store, name, cat, image=None, price=100000, pn=None, url=None):
    return {"store": store, "name": name, "url": url or f"https://{store}/{abs(hash(name + store)) % 99999}",
            "price_cash": price, "price_list": None, "stock": True, "sku": pn, "pn": pn, "image": image,
            "category": cat, "cuotas": None, "rating": None}


def test_imagenes():
    mini = "https://imagenes.compragamer.com/productos/compragamer_Imganen_general_1_X_abc-mini.jpg"
    assert bd.hq_image(mini).endswith("_abc.jpg") and "-mini" not in bd.hq_image(mini)
    assert bd.hq_image("https://otra.com/a-mini.jpg") == "https://otra.com/a-mini.jpg", "solo se toca Compragamer"
    ph = "https://www.armytech.com.ar/img/p/es-default-home_default.jpg"
    assert bd.good_image(ph) is None and bd.good_image("https://www.armytech.com.ar/123-home_default/x.jpg")
    # el placeholder de una tienda se descarta y se usa la foto de otra tienda que vende lo mismo
    a = _it("Armytech", "Fuente MSI MAG A650GN 650W 80 Plus Gold", "fuentes", ph, 90000, "A650GN-X1")
    b = _it("Logg", "Fuente MSI MAG A650GN 650W 80 Plus Gold", "fuentes", "https://logg.api.cygnus.market/p.jpg", 95000, "A650GN-X1")
    g = bd.build([a, b])
    assert len(g) == 1 and g[0]["image"] == "https://logg.api.cygnus.market/p.jpg"
    c = _it("Compragamer", "Memoria Team DDR5 16GB 6000 MHz Vulcan CL38", "memorias-ram", mini, 80000, "FLARD516G6000HC38J01")
    g = bd.build([c])
    assert g[0]["image"] == bd.hq_image(mini) and g[0]["image_fb"] == mini, "alta resolución + respaldo"
    # sin foto en ninguna tienda: se usa la cargada a mano del fabricante, con su fuente
    d = _it("Armytech", "Mother Asus Prime B760m-a D4 1700", "motherboards", ph, 150000)
    g = bd.build([d], {"mother-asus-prime-b760m-a-d4-1700": {"url": "https://dlcdnwebimgs.asus.com/x", "source": "Sitio del fabricante (asus.com)"}})
    assert g[0]["image"] == "https://dlcdnwebimgs.asus.com/x" and "asus.com" in g[0]["img_src"]
    g = bd.build([d]); assert g[0]["image"] is None
    import json as _j
    ex = _j.load(open("site/data/imagenes_extra.json"))["items"]
    assert ex and all(v["url"].startswith("https://") and v["page"] and v["source"] for v in ex.values())


def test_limpieza_catalogo():
    from scrapers import common as cm
    assert cm.is_service("Actualización de Bios")
    assert cm.is_non_hardware("Robot Robosen Transformers Optimus Prime", "otros")
    assert cm.is_non_hardware("Funda Celular Samsung Flip Wallet A3", "otros")
    assert cm.is_non_hardware("SMART TV HYUNDAI 32'' HD", "otros")
    assert not cm.is_non_hardware("UPS con Estabilizador Lyonn 800ap", "otros")
    assert not cm.is_non_hardware("Monitor Smart TV Samsung 27", "monitores"), "solo la categoría 'otros'"
    g = bd.build([_it("A", "Robot Robosen Transformers G1 Bumblebee", "otros"), _it("A", "Actualización de Bios", "otros"),
                  _it("A", "UPS Lyonn CTB 800ap 800v Display", "otros")])
    assert [x["name"] for x in g] == ["UPS Lyonn CTB 800ap 800v Display"]
    assert bd.clean_name("Extensor de Red TP-Link TL-WA850RE WIFI 300Mbps White 300Mbps Universal 300Mbps 300Mbps Universal") == \
        "Extensor de Red TP-Link TL-WA850RE WIFI 300Mbps White Universal"
    assert bd.clean_name("Mouse Pad Gamer Pad XL") == "Mouse Pad Gamer Pad XL", "palabras cortas no se tocan"


def test_cruce_entre_tiendas():
    # mismo nombre exacto con distinto URL: un solo producto
    g = bd.build([_it("A", "Teclado Mecanico Redragon Kumara K552 Rainbow", "perifericos", price=50000),
                  _it("B", "Teclado Mecanico Redragon Kumara K552 Rainbow", "perifericos", price=52000)])
    assert len(g) == 1 and len(g[0]["offers"]) == 2
    # cruce flexible: misma marca, modelo y variante aunque el título esté ordenado distinto
    g = bd.build([_it("Compragamer", 'Monitor Gamer ASUS VA27EHF-J 27" FHD IPS 100Hz', "monitores", price=200000),
                  _it("MEXX", 'Monitor Gamer 27" Asus Full Hd Ips 100Hz 1Ms Freesync VA27EHF-J', "monitores", price=190000)])
    assert len(g) == 1 and [o["store"] for o in g[0]["offers"]] == ["MEXX", "Compragamer"]
    # variantes distintas NO se mezclan (Ti / Super / color)
    g = bd.build([_it("A", "Placa de Video MSI GeForce RTX 5060 Ti 16GB Ventus", "placas-de-video", price=1000000),
                  _it("B", "Placa de Video MSI GeForce RTX 5060 16GB Ventus", "placas-de-video", price=900000)])
    assert len(g) == 2
    g = bd.build([_it("A", "Auriculares Redragon Ire PRO H848 Wireless 2.4Ghz Black 7.1", "perifericos", price=100000),
                  _it("B", "Auriculares Redragon Ire PRO H848 Wireless 2.4Ghz White 7.1", "perifericos", price=100000)])
    assert len(g) == 2
    # usado / outlet nunca se mezcla con el nuevo, aunque comparta número de parte
    g = bd.build([_it("A", "Monitor Gamer ASUS VA27EHF-J 27 FHD IPS 100Hz", "monitores", pn="90LM0560-B01170"),
                  _it("A", "Monitor Gamer ASUS VA27EHF-J 27 FHD IPS 100Hz - Usado en evento", "monitores", pn="90LM0560-B01170", price=150000)])
    assert len(g) == 2


def test_cruce_no_mezcla_productos_distintos():
    """Casos reales que el cruce anterior juntaba por error (se vieron en la web publicada)."""
    gpu = _it("Maximus", "Placa de Video MSI Nvidia GeForce RTX 5070 Ventus 2X 12GB OC GDDR7", "placas-de-video", price=1708380)
    psu = _it("Compragamer", "Fuente ASUS PRIME 750W 80 Plus Gold AP-750G Full Modular ATX 3.1 PCIe 5.1", "fuentes", price=166600)
    gpu2 = _it("Armytech", "Placa de Video GeForce RTX 5070 12GB ASUS ROG Strix OC 12GB GDDR7", "placas-de-video", price=1910247)
    assert len(bd.build([gpu, psu, gpu2])) == 3
    m1 = _it("Compragamer", "Mother Asrock A520M HDV AM4", "motherboards", price=81407)
    m2 = _it("Armytech", "Mother Asus Prime A520m-k Am4", "motherboards", price=82246)
    m3 = _it("MEXX", "Motherboard AM4 - Gigabyte A520M K V2", "motherboards", price=97999)
    m4 = _it("A", "Mother Asus Prime A520M-E Am4", "motherboards", price=70000)
    pc = _it("Maximus", "PC Armada AMD Ryzen 5 5600GT 16GB 512GB", "pcs-armadas", price=841590)
    assert len(bd.build([m1, m2, m3, m4, pc])) == 5, "chipset igual no es producto igual"
    # dos placas del mismo chip pero de línea distinta (Dual / TUF / Prime) no se cruzan
    a = _it("A", "Placa de Video ASUS Dual GeForce RTX 5060 Ti 16GB GDDR7 OC", "placas-de-video", price=1000000)
    b = _it("B", "Placa de Video ASUS TUF Gaming GeForce RTX 5060 Ti 16GB GDDR7 OC", "placas-de-video", price=1200000)
    assert len(bd.build([a, b])) == 2
    # el mismo procesador con títulos distintos sí se cruza; tray y box no
    c1 = _it("A", "Procesador AMD Ryzen 5 5500 3.6GHz Turbo 4.2 AM4", "procesadores", price=120000)
    c2 = _it("B", "Micro AMD Ryzen 5 5500 - 6 Nucleos 12 Threads 4.2Ghz AM4", "procesadores", price=125000)
    c3 = _it("C", "Procesador AMD Ryzen 5 5500 Tray AM4", "procesadores", price=100000)
    g = bd.build([c1, c2, c3]); assert sorted(len(x["offers"]) for x in g) == [1, 2]


def test_aviso_precios_muy_distintos():
    a = _it("A", "Teclado Mecanico Redragon Kumara K552 Rainbow", "perifericos", price=50000)
    b = _it("B", "Teclado Mecanico Redragon Kumara K552 Rainbow", "perifericos", price=500000)
    assert bd.build([a, b])[0].get("dif") is True
    b["price_cash"] = 55000
    assert not bd.build([a, b])[0].get("dif")


# ---------- tiendas nuevas (actualización 7) ----------
from scrapers import katech as _kt, venex as _vx, gamingcity as _gc, netgaming as _ng


def test_katech_parse():
    items = _kt.parse(json.load(open("tests/fixtures/katech.json")))
    assert len(items) == 2 and all(i["store"] == "Katech" for i in items)
    a, b = items
    assert a["price_cash"] == 368500 and a["stock"] is True and a["category"] == "perifericos" and a["pn"] is None and a["store_sku"] == "MIC037"
    assert b["price_cash"] == 120000 and b["price_list"] == 135000 and b["stock"] is False and b["category"] == "procesadores"


def test_tiendas_woocommerce_nuevas():
    """Seis tiendas WooCommerce (actualización 9): precios con y sin centavos, nombres con entidades HTML, categoría y registro."""
    from scrapers import woo, SCRAPERS
    F = json.load(open("tests/fixtures/woo_stores.json"))
    assert set(F) == set(woo.WOO_STORES) and all(n in SCRAPERS for n in woo.WOO_STORES)
    got = {n: woo.parse(F[n], n)[0] for n in F}
    assert got["Hardloots"]["price_cash"] == 44102 and got["Hardloots"]["price_list"] == 67849, "minor_unit 0: ya vienen en pesos"
    assert got["SCP Hardstore"]["price_cash"] == 912668.31, "minor_unit 2: centavos"
    assert got["The Gamer Shop"]["price_cash"] == 856100 and got["The Gamer Shop"]["category"] == "pcs-armadas"
    assert got["Try"]["name"].endswith("512GB NVMe – Sin armar") and "&#" not in got["Try"]["name"]
    assert got["Click Gaming"]["category"] == "monitores" and got["Click Gaming"]["pn"] is None and got["Click Gaming"]["store_sku"] == "AIR_215742"
    assert all(g["store"] == n and g["stock"] is True and g["url"].startswith("https://") for n, g in got.items())
    stores = json.load(open("site/data/stores.json"))["stores"]
    cfg = json.load(open("site/data/config.json"))["stores"]
    for n in woo.WOO_STORES:
        assert n in stores and n in cfg, n


def test_tiendas_nuevas_actualizacion_15():
    """Tiendanube, plataforma «card-ecommerce», WooCommerce por HTML, WIZ TECH, XT-PC y Compufan: precios, stock y registro."""
    from scrapers import SCRAPERS, woo, woohtml, tiendanube, cardeco, wiztech, xtpc, compufan
    F = json.load(open("tests/fixtures/woo_stores.json"))
    mt = woo.parse(F["Max Tecno"], "Max Tecno")[0]
    assert mt["price_cash"] == 582804.75 and mt["category"] == "motherboards"
    lt = woo.parse(F["Liontech Gaming"], "Liontech Gaming")[0]
    assert lt["price_cash"] == 101999.99 and lt["price_list"] == 110159.98 and lt["category"] == "gabinetes"
    hf = woo.parse(F["HF Tecnología"], "HF Tecnología")[0]
    assert "&#" not in hf["name"] and fix_category(hf["name"], hf["category"]) == "otros", "una tablet no es almacenamiento"
    # WooCommerce por HTML (HardCore prohíbe la API en robots.txt)
    h = open("tests/fixtures/hardcore.html").read()
    hc = woohtml.parse(h, "HardCore")
    assert woohtml.last_page(h) == 25 and len(hc) == 2, "el «armá tu PC» configurable no tiene precio único"
    assert hc[0]["price_cash"] == 2355 and hc[0]["price_list"] is None and hc[0]["stock"] is True
    assert hc[1]["price_cash"] == 21195 and hc[1]["price_list"] == 25120 and fix_category(hc[1]["name"], hc[1]["category"]) == "mouses"
    # Tiendanube: precio con transferencia (centavos) o desde data-variants; sin descuento -> un solo precio
    tn = tiendanube.parse(open("tests/fixtures/tiendanube.html").read(), "37 Bytes")
    assert [round(i["price_cash"], 2) for i in tn] == [314998.9, 499999.1, 3082.85, 120000]
    assert [i["price_list"] for i in tn] == [384145, 609755, 4742.84, None]
    assert [i["stock"] for i in tn] == [True, True, True, False] and tn[0]["category"] == "almacenamiento"
    assert tn[1]["category"] == "memorias-ram" and tn[0]["url"].startswith("https://www.37bytes.com.ar/productos/")
    # card-ecommerce: «Precio especial» = contado; lista = el mayor entre «Precio lista» y el de tarjeta
    ce = cardeco.parse(open("tests/fixtures/cardeco.html").read(), "Noxie Store", "placas-de-video")
    assert [(i["price_cash"], i["price_list"], i["stock"]) for i in ce] == [(121547, 158011, True), (20404, 24076, True), (15999, None, False)]
    assert [i["category"] for i in ce] == ["placas-de-video", "fuentes", "almacenamiento"] and ce[0]["store_sku"] == "GT 710 2GD3 LP"
    # WIZ TECH: un solo precio -> lista (no se afirma contado); «consultar» y celulares fuera; «a pedido» sin stock confirmado
    wz = wiztech.parse(json.load(open("tests/fixtures/wiztech.json")))
    assert len(wz) == 2 and wz[0]["price_cash"] is None and wz[0]["price_list"] == 84000 and wz[0]["category"] == "auriculares"
    assert wz[1]["stock"] is None and wz[1]["category"] == "placas-de-video" and wz[1]["url"].startswith("https://wiztech.com.ar/catalogo/")
    # XT-PC: precio especial (débito/transferencia/efectivo) = contado; sin stock en el listado
    xt = xtpc.parse(open("tests/fixtures/xtpc.html").read(), "placas-de-video")
    assert xt[0]["price_cash"] == 93477.6 and xt[0]["price_list"] == 102825.31 and xt[0]["stock"] is None
    assert xt[0]["url"] == "https://www.xt-pc.com.ar/prod/31476/placa-de-video-radeon-r5-230-2gb-ddr3-low-profile-akr230d3s2gl1"
    # Compufan: precio sin medio de pago aclarado -> lista; imagen por https
    cf = compufan.parse(open("tests/fixtures/compufan.html").read(), "Con placa de video")
    assert cf[0]["price_list"] == 888599 and cf[0]["price_cash"] is None and cf[0]["category"] == "pcs-armadas" and cf[0]["image"].startswith("https://")
    assert compufan.page_url("https://www.compufanstore.com.ar/ARTICULOS/X/CAT_ID=63/SCAT_ID=3948/m=0/BUS=/compufanstore.aspx", 2) == \
        "https://www.compufanstore.com.ar/ARTICULOS/X;CAT_ID=63;SCAT_ID=3948;m=0;BUS=;A_PAGENUMBER=2;/compufanstore.aspx"
    # registro: cada tienda nueva tiene lector, ficha en stores.json y entrada en config.json
    stores = json.load(open("site/data/stores.json"))["stores"]
    cfg = json.load(open("site/data/config.json"))["stores"]
    nuevas = list(woohtml.HTML_STORES) + list(tiendanube.TN_STORES) + list(cardeco.CE_STORES) + ["WIZ TECH", "XT-PC", "Compufan Store"]
    for n in nuevas + list(woo.WOO_STORES):
        assert n in SCRAPERS and n in stores and n in cfg, n
    assert stores["IgnaTech"]["integration"] == stores["Portal Tech & Gaming"]["integration"] == "no disponible"


def test_xtpc_corta_en_el_relleno():
    """Pasada la última página XT-PC muestra siempre los mismos productos de relleno: no se agregan."""
    from scrapers import xtpc
    fx = open("tests/fixtures/xtpc.html").read()
    pag = lambda n: fx.replace("31476", f"9{n}1").replace("12149", f"9{n}2")
    def fake(u):
        n = int(u.rsplit("/", 1)[1])
        if n == 999 or ("/3/" in u and n > 6):
            return pag(0)                                          # relleno
        return pag(n) * 6 if "/3/" in u else "<html></html>"       # 12 productos por página
    orig, xtpc.get = xtpc.get, fake
    try:
        got = xtpc.scrape()
    finally:
        xtpc.get = orig
    assert len(got) == 12 and not any("/prod/901/" in i["url"] for i in got), "6 páginas reales x 2 productos, sin el relleno"


def test_presupuesto_de_tiempo():
    """Las tiendas que no se leyeron por falta de tiempo van primero en la corrida siguiente."""
    import build_data, tempfile, pathlib
    with tempfile.TemporaryDirectory() as d:
        m = pathlib.Path(d) / "meta.json"
        m.write_text(json.dumps({"stores": {"C": {"ok": False, "skipped": True}, "A": {"ok": True}}}))
        assert build_data.store_order({"A": 1, "B": 2, "C": 3}, m) == ["C", "A", "B"]
        assert build_data.store_order({"A": 1, "B": 2}, pathlib.Path(d) / "no.json") == ["A", "B"]


def test_venex_parse():
    items = _vx.parse(open("tests/fixtures/venex.html").read(), "microprocesadores")
    assert len(items) == 2, "se descarta el que no tiene precio"
    a, b = items
    assert a["name"].endswith("Bulk (Simil 5600GT)"), "nombre completo desde el alt, no el título cortado con «...»"
    assert a["price_cash"] == 259990 and a["category"] == "procesadores" and a["stock"] is None and a["pn"] is None
    assert a["image"] == "https://www.venex.com.ar/products_images/thumb/1787161580_procesador_amd_ryzen_5_pro_5650g_612_44ghz_am4_bulk_2png"
    assert b["price_cash"] == 339999 and b["url"].startswith("https://www.venex.com.ar/componentes-de-pc/")


def test_gamingcity_parse():
    html = open("tests/fixtures/gamingcity.html").read()
    items = _gc.parse(html, "procesadores")
    assert len(items) == 2
    a, b = items
    assert a["price_cash"] == 87399 and a["price_list"] == 91999 and a["stock"] is True and a["category"] == "procesadores"
    assert a["cuotas"] == "12 cuotas de $ 10.733", "no se afirma que sea sin interés"
    assert a["url"] == "https://www.gamingcity.com.ar/micro-amd-procesador-amd-ryzen-3-3200g-radeon-bulk-8-4c-4t---det--18184"
    assert a["image"].endswith("imagen1_400x400.jpg")
    assert b["stock"] is False and b["price_list"] is None and b["category"] == "motherboards"
    assert _gc.next_page(html) == "https://www.gamingcity.com.ar/procesadores-componentes--prod--27--view--grilla-25"


def test_netgaming_parse():
    items = _ng.parse(open("tests/fixtures/netgaming.html").read(), "todas las memorias")
    assert len(items) == 2, "se descarta el producto sin precio"
    a, b = items
    assert a["price_cash"] == 2646 and a["price_list"] == 2940 and a["stock"] is True and a["store_sku"] == "33806" and a["pn"] is None
    assert b["price_cash"] == 90000 and b["stock"] is False and b["category"] == "memorias-ram"
    assert _ng.DELAY >= 5, "su robots.txt pide Crawl-delay: 5"


def test_tiendas_nuevas_se_cruzan_con_cuidado():
    cg = _it("Compragamer", "Procesador Intel Core i5 14400F 4.7GHz Turbo Socket 1700 Raptor Lake", "procesadores", price=350000)
    vx = _vx.parse(open("tests/fixtures/venex.html").read(), "microprocesadores")
    g = bd.build(vx + [cg])
    two = [x for x in g if len(x["offers"]) == 2]
    assert len(two) == 1 and {o["store"] for o in two[0]["offers"]} == {"Venex", "Compragamer"}


# ---------- avisos / resumen semanal ----------
def _load_resumen():
    import importlib.util
    spec = importlib.util.spec_from_file_location("enviar_resumen", "scripts/enviar_resumen.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); return m


def test_resumen_semanal():
    m = _load_resumen()
    def g(name, pct, **o):
        off = dict({"store": "Compragamer", "url": "https://c/x", "price_cash": 90000, "stock": True}, **o)
        return {"name": name, "offers": [off], "chg": {"prev": 100000, "pct": pct, "date": "2026-10-23"}}
    groups = [g("Baja chica", -3), g("Baja buena", -20), g("Baja enorme", -60, anom=True), g("Sin stock", -30, stock=False),
              g("Mas baja", -35), dict(g("Precios raros", -40), dif=True), {"name": "Sin cambio", "offers": [{"store": "A", "url": "u", "price_cash": 1}]}]
    rows = m.top_drops(groups)
    assert [r["name"] for r in rows] == ["Mas baja", "Baja buena"], "solo bajas confiables: sin saltos sospechosos, sin stock agotado, sin precios dudosos"
    subject, html, text = m.render(rows, "2026-10-24")
    assert "2 productos" in subject and "$90.000" in text and "35% menos" in text and "<script" not in html
    assert m.render([], "2026-10-24") is None
    # nombres con HTML se escapan
    h = m.render([dict(rows[0], name="<b>x</b>")], "2026-10-24")[1]
    assert "&lt;b&gt;" in h
    # Brevo: sin secretos no hace nada; con secretos crea BORRADOR y solo envía si se pide
    assert m.crear_campana("a", "<p>x</p>", "2026-10-24", env={}) is None
    calls = []
    fake = lambda path, payload, key, method="POST": (calls.append((path, payload)) or {"id": 7})
    env = {"BREVO_API_KEY": "k", "BREVO_LIST_ID": "3", "BREVO_SENDER_EMAIL": "a@b.com"}
    r = m.crear_campana("a", "<p>x</p>", "2026-10-24", env=env, call=fake)
    assert r == {"id": 7, "estado": "borrador"} and len(calls) == 1 and calls[0][1]["recipients"] == {"listIds": [3]}
    r = m.crear_campana("a", "<p>x</p>", "2026-10-24", env=dict(env, BREVO_ENVIAR_YA="1"), call=fake)
    assert r["estado"] == "enviada" and calls[-1][0] == "/emailCampaigns/7/sendNow"


def test_datos_danados_no_se_publican():
    """Un products.json con marcas de conflicto de Git dejó la web sin productos: ahora se detecta antes de publicar,
    y una corrida anterior dañada no rompe la actualización."""
    import tempfile, importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("check_data", "scripts/check_data.py")
    cd = importlib.util.module_from_spec(spec); spec.loader.exec_module(cd)
    with tempfile.TemporaryDirectory() as t:
        r = Path(t); (r / "site/data").mkdir(parents=True); (r / "raw").mkdir()
        good = json.dumps([{"id": str(i)} for i in range(80)])
        (r / "site/data/products.json").write_text(good)
        assert cd.check(r) == []
        (r / "site/data/products.json").write_text("<<<<<<< HEAD\n" + good + "\n=======\n" + good + "\n>>>>>>> abc")
        e = cd.check(r); assert len(e) == 1 and "conflicto" in e[0]
        (r / "site/data/products.json").write_text(good[:-5])
        assert "JSON inválido" in cd.check(r)[0]
        (r / "site/data/products.json").write_text("[]")
        assert "no se publica" in cd.check(r)[0]
        (r / "site/data/products.json").write_text(good); (r / "raw/X.json").write_text("<<<<<<< HEAD\n[1]")
        assert "raw/X.json" in cd.check(r)[0]
    import build_data
    with tempfile.TemporaryDirectory() as t:
        f = Path(t) / "Tienda.json"
        f.write_text("<<<<<<< HEAD\n[]"); assert build_data.read_raw(f) == []
        f.write_text('[{"a": 1}]'); assert build_data.read_raw(f) == [{"a": 1}]
        f.write_text('{"a": 1}'); assert build_data.read_raw(f) == []
    wf = Path(".github/workflows/actualizar.yml").read_text()
    assert "pull --rebase" not in wf
    assert "check_data.py" in wf and "site_publicar" in wf


def test_estructura_del_sitio():
    """Todas las páginas comparten encabezado/pie; «Productos» es el nombre único; no quedan nombres viejos."""
    import re
    from pathlib import Path
    site = Path(__file__).resolve().parent.parent / "site"
    paginas = ["index", "productos", "armado", "actualizar", "encontra", "comparar", "producto"]
    for n in paginas:
        h = (site / f"{n}.html").read_text(encoding="utf-8")
        assert 'css/layout.css' in h and 'js/layout.js' in h, n
        assert "🛒 Mi lista" not in h and "Comparador de precios</a>" not in h and "<header" not in h, n
        assert f'data-page="{"productos" if n == "producto" else n}"' in h, n
    lay = (site / "js" / "layout.js").read_text(encoding="utf-8")
    assert lay.count("Productos") >= 1 and "Mi lista de compra" in lay and 'id="lcount"' in lay and "Volver arriba" in lay
    for h in ("productos.html", "armado.html", "actualizar.html", "encontra.html", "comparar.html"):
        assert h in lay
    p = (site / "productos.html").read_text(encoding="utf-8")
    assert "const PER=32" in p and "repeat(4,minmax(0,1fr))" in p and "Mostrar más" not in p and "position:sticky" in p and "margin:auto" in p
    # el buscador del encabezado no puede llamarse "q": comparar.html tiene su propio buscador y los dos se pisaban
    assert 'id="qh"' in lay and 'id="q"' not in lay
    assert 'id="q"' in (site / "comparar.html").read_text(encoding="utf-8")
    # abrir un producto en otra pestaña: enlace real en cada tarjeta y botón en la ventana de detalle
    assert 'class="stretch"' in p and "Abrir en otra pestaña" in p and "DET.url" in p
    assert (site / "js" / "detail.js").exists() and "Dónde comprarlo" in (site / "producto.html").read_text(encoding="utf-8")


def test_correccion_de_categorias():
    """Mini PCs, consolas, electrodomésticos y accesorios que las tiendas ponen en categorías de componentes."""
    from scrapers.common import fix_category as f
    assert f("Mini Pc Acemagic Ryzen 5 3500U 8Gb Ssd 256Gb", "procesadores") == "pcs-armadas"
    assert f("Consola Lenovo Legion Go S Ryzen Z2 Go 16Gb", "procesadores") == "otros"
    assert f("Multiprocesadora Atma C/Vaso 9 En 1 650W 1,8L", "procesadores") is None
    assert f("Procesadora Manual Liliana Twistmix Roja", "procesadores") is None
    assert f("Procesador AMD Ryzen 5 5600", "procesadores") == "procesadores"
    assert f("Soporte GPU Gaming City Altura Regulable", "placas-de-video") == "accesorios"
    assert f("Combo Actualización AMD Ryzen 7 8700G 16GB", "procesadores") == "pcs-armadas"
    assert f("Combo Tablet Xiaomi Redmi Pad 2 11\" 8GB 256GB", "almacenamiento") == "otros"
    assert f("Notebook Lenovo IdeaPad", "notebooks") == "notebooks"
    import build_data
    g = build_data.build([
        {"store": "A", "name": "Multiprocesadora Atma 650W", "url": "u1", "price_cash": 100, "price_list": 110, "stock": True,
         "sku": None, "pn": None, "image": None, "category": "procesadores", "cuotas": None, "rating": None, "prev_cash": None},
        {"store": "A", "name": "Mini Pc CX Ryzen 5 3500U 8Gb", "url": "u2", "price_cash": 100, "price_list": 110, "stock": True,
         "sku": None, "pn": None, "image": None, "category": "procesadores", "cuotas": None, "rating": None, "prev_cash": None}])
    assert [x["category"] for x in g] == ["pcs-armadas"]


def test_fichas_perifericos():
    """Mouse, teclados y auriculares: categoría propia y ficha de la tienda normalizada (etiquetas con o sin tildes)."""
    from scrapers import specs
    from scrapers.common import fix_category as f
    assert f("Mouse Gamer Logitech G502 Hero", "perifericos") == "mouses"
    assert f("Mouse Pad Redragon Flick L", "perifericos") == "perifericos"
    assert f("Combo Teclado y Mouse Logitech MK120", "perifericos") == "perifericos"
    assert f("Teclado Mecanico Redragon Kumara K552", "perifericos") == "teclados"
    assert f("Auriculares HyperX Cloud II", "perifericos") == "auriculares"
    m, miss = specs.normalize({"caracteristicas": [
        {"etiqueta": "DPI Máximos", "valor": "25600"}, {"etiqueta": "Cantidad de botones", "valor": "11"},
        {"etiqueta": "Peso", "valor": "121", "unidades": "gr"}, {"etiqueta": "Tipo de sensor", "valor": "Óptico"},
        {"etiqueta": "Frecuencia de respuesta", "valor": "1000"}, {"etiqueta": "Agarre claw grip", "valor": "1"}]}, "Mouse G502", "mouses")
    assert m["dpi_max"]["v"] == 25600 and m["botones"]["v"] == 11 and m["peso_g"]["v"] == 121 and m["claw"]["v"] is True
    assert "vida_util_clicks" in miss, "lo que la tienda no publica queda como faltante, no se inventa"
    m, _ = specs.normalize({"caracteristicas": [{"etiqueta": "Peso", "valor": "900", "unidades": "gr"}]}, "Mouse X", "mouses")
    assert m["peso_g"]["l"] == "pend", "un mouse de 900 g es un error de la ficha: queda pendiente"
    k, _ = specs.normalize({"caracteristicas": [{"etiqueta": "Tipo de switch", "valor": "Outemu Red"},
        {"etiqueta": "Tipo de mecanismo", "valor": "Mecánico"}, {"etiqueta": "N-key rollover", "valor": "1"}]}, "Teclado", "teclados")
    assert k["switch"]["v"] == "Outemu Red" and k["mecanismo"]["v"] == "Mecánico" and k["nkro"]["v"] is True
    a, _ = specs.normalize({"caracteristicas": [{"etiqueta": "Impedancia", "valor": "32", "unidades": "Ω"},
        {"etiqueta": "Respuesta mínima", "valor": "20"}, {"etiqueta": "Respuesta máxima", "valor": "20000"},
        {"etiqueta": "Tamaño de los parlantes", "valor": "53"}]}, "Auriculares", "auriculares")
    assert a["impedancia"]["v"] == 32 and a["f_max"]["v"] == 20000 and a["driver_mm"]["v"] == 53
    # las fichas se ligan a periféricos de Compragamer por su categoría corregida
    items = specs.build_items([{"id_producto": 5, "caracteristicas": [{"etiqueta": "DPI máximos", "valor": "16000"}]}],
        [{"store": "Compragamer", "category": "perifericos", "name": "Mouse Logitech G305", "pid": 5, "sku": "910-005281", "url": "u"}], "2026-10-26")
    assert list(items.values())[0]["f"]["dpi_max"]["v"] == 16000


def test_fichas_placas_madre():
    """Ficha oficial de ASRock/MSI: solo con modelo exacto, Wi-Fi 'No' solo si la ficha se leyó completa, y con caché."""
    import tempfile
    from scrapers import mbspecs as mb
    rd = lambda f: open("tests/fixtures/" + f).read()
    a = mb.parse_asrock(rd("mb_asrock_wifi.html"), "B760M PG Riptide WiFi")
    assert (a["socket"], a["chipset"], a["ddr"], a["form"], a["wifi"]) == ("LGA1700", "B760", "DDR5", "Micro-ATX", True)
    b = mb.parse_asrock(rd("mb_asrock_nowifi.html"), "B450M-HDV R4.0")
    assert (b["socket"], b["ddr"], b["wifi"]) == ("AM4", "DDR4", False)
    assert mb.parse_asrock(rd("mb_asrock_nowifi.html"), "B450M-HDV") is None        # modelo parecido NO alcanza
    m = mb.parse_msi(rd("mb_msi.html"), "B550M-A PRO")
    assert (m["socket"], m["chipset"], m["ddr"], m["form"]) == ("AM4", "B550", "DDR4", "Micro-ATX")
    assert mb.parse_msi(rd("mb_msi.html"), "B550M-A") is None
    assert mb.model_candidates("Mother MSI MAG B650 TOMAHAWK WIFI AM5 DDR5", "MSI")[0] == "MAG B650 TOMAHAWK WIFI"
    calls = []
    def fake(u):
        calls.append(u)
        if "B450M-HDV%20R4.0" in u and "/AMD/" in u:
            return rd("mb_asrock_nowifi.html")
        raise RuntimeError("404")
    groups = [{"name": "Mother ASRock B450M-HDV R4.0 AM4", "category": "motherboards"},
              {"name": "Mother Gigabyte B450M DS3H", "category": "motherboards"}]
    with tempfile.TemporaryDirectory() as d:
        items, st = mb.refresh(groups, d, fetch=fake, today="2026-10-27")
        assert len(items) == 1 and groups[0]["spec"].startswith("mb:asrock:") and "spec" not in groups[1]
        it = next(iter(items.values()))
        assert it["f"]["wifi"]["v"] is False and "no lista Wi-Fi" in it["f"]["wifi"]["n"] and it["url"].startswith("https://www.asrock.com/")
        n = len(calls)
        mb.refresh([dict(g) for g in groups], d, fetch=fake, today="2026-10-28")
        assert len(calls) == n                                                          # segunda corrida: todo sale de la caché


def test_fichas_placas_madre_gigabyte_asus():
    from scrapers import mbspecs as mb
    import tempfile
    rd = lambda f: open("tests/fixtures/" + f).read()
    g = mb.parse_gigabyte(rd("mb_gigabyte_nowifi.html"), "B550M DS3H")
    assert (g["socket"], g["chipset"], g["ddr"], g["form"], g["wifi"]) == ("AM4", "B550", "DDR4", "Micro-ATX", False)
    w = mb.parse_gigabyte(rd("mb_gigabyte_wifi.html"), "B650 EAGLE AX")
    assert (w["socket"], w["ddr"], w["form"], w["wifi"]) == ("AM5", "DDR5", "ATX", True)
    assert mb.parse_gigabyte(rd("mb_gigabyte_wifi.html"), "B650 EAGLE") is None
    assert mb.gigabyte_rev_slug(rd("mb_gigabyte_base.html"), "B550M-DS3H") == "B550M-DS3H-rev-10-11-12-13"
    a = mb.parse_asus(rd("mb_asus.html"), "PRIME B550M-K")
    assert (a["socket"], a["chipset"], a["ddr"], a["form"], a["wifi"]) == ("AM4", "B550", "DDR4", "Micro-ATX", False)
    assert mb.parse_asus(rd("mb_asus.html"), "PRIME B550M") is None
    assert mb.parse_asus("<html><body><div id='app'></div></body></html>", "PRIME B550M-K") is None   # página sin armar: no inventa nada
    assert mb.asus_urls("TUF GAMING B550M-PLUS WIFI II").endswith("/tuf-gaming/tuf-gaming-b550m-plus-wifi-ii/techspec/")
    def fake(u):
        if u.endswith("/Motherboard/B550M-DS3H"):
            return rd("mb_gigabyte_base.html")
        if u.endswith("/sp"):
            return rd("mb_gigabyte_nowifi.html")
        raise RuntimeError("404")
    gr = [{"name": "Mother Gigabyte B550M DS3H AM4", "category": "motherboards"}]
    with tempfile.TemporaryDirectory() as d:
        items, st = mb.refresh(gr, d, fetch=fake, today="2026-10-27")
        it = next(iter(items.values()))
        assert it["url"].endswith("B550M-DS3H-rev-10-11-12-13/sp") and "Rev. 1.0/1.1/1.2/1.3" in it["sku"]


def test_categoria_por_tipo_al_inicio():
    """El tipo con el que EMPIEZA el título manda: un procesador «Sin Cooler» no es refrigeración, un gabinete no es fuente."""
    f = fix_category
    assert f("Procesador Amd Ryzen 7 9800X3D 5.2 Ghz - AM5 (Sin Cooler)", "refrigeracion") == "procesadores"
    assert f("Micro AMD Ryzen 5 5600 Sin Cooler", "refrigeracion") == "procesadores"
    assert f("Memoria RAM DDR4 HIKSEMI 8GB 3200MHz Armor C/ Disipador Black", "refrigeracion") == "memorias-ram"
    assert f("Disco SSD NVMe 1TB WD Black SN850X Sin Disipador", "refrigeracion") == "almacenamiento"
    assert f("Micro SDXC Lexar 633x 64GB", "almacenamiento") == "almacenamiento"
    assert f("Auricular Gamer Cooler Master CH351 Black", "refrigeracion") == "auriculares"
    assert f("SILLA GAMER COOLERMASTER CALIBER R2C BLACK", "refrigeracion") == "perifericos"
    assert f("Gabinete Corsair AIR 5400 LX LINK Mid-Tower TG Black", "fuentes") == "gabinetes"
    assert f("GAB MSI MAG FORGE M100A FAN RGB SIN FUENTE", "fuentes") == "gabinetes"
    assert f("Fan Gamemax 120 Rainbow Infinity C9 ARGB", "gabinetes") == "refrigeracion"
    assert f("Cooler Gabinete Sentey F70 120 Argb", "gabinetes") == "refrigeracion"
    assert f("Combo Placa De Video Rtx 3050 6gb + Fuente Certificada 600w", "fuentes") == "otros"
    assert f("Kit Gabinete Sentey TM10 Mesh Fuente 600W Teclado Mouse", "fuentes") == "otros"
    assert f("Conectores CORSAIR ICHUE LINK Juego de x5", "fuentes") == "accesorios"
    assert f("Proyector Epson PowerLite X49", "monitores") == "otros"
    # lo que sí es de la categoría no se toca
    assert f("Fuente ASUS TUF Gaming 750W 80 Plus Gold", "fuentes") == "fuentes"
    assert f("Gamemax Gx-1050 Pro - Fuente 1050W 80 Plus Platinum", "fuentes") == "fuentes"
    assert f("Cooler Master Hyper 212 Black Edition", "refrigeracion") == "refrigeracion"
    assert f("Water Cooler Corsair H100", "refrigeracion") == "refrigeracion"


def test_fichas_desde_descripcion_de_tienda():
    """Mouses/teclados/auriculares sin ficha: datos de la descripción de la tienda, marcados 'según la tienda', sin pisar nada."""
    from scrapers import descspecs as ds
    m196 = "Intro\nEspecificaciones Técnicas:\nConectividad: Bluetooth\nTecnología del sensor: Óptica\nNúmero de botones: 3\nPeso: 83 g"
    f = ds.parse_desc(m196, "mouses")
    assert f["botones"]["v"] == 3 and f["peso_g"] == {"v": 83, "u": "g"} and f["sensor"]["v"] == "Óptico"
    assert ds.parse_desc("DPI: 800/1600/3200 polling 1000 Hz", "mouses")["dpi_max"]["v"] == 3200      # los Hz no se confunden con DPI
    assert ds.parse_desc("Resolución 26K DPI", "mouses")["dpi_max"]["v"] == 26000
    assert ds.parse_desc("Peso: 0,1 kg", "mouses")["peso_g"]["v"] == 100
    assert ds.parse_desc("Driver 50 mm, impedancia 32 Ohm, 20Hz-20kHz, micrófono", "auriculares")["f_max"]["v"] == 20000
    assert ds.parse_desc("Nada técnico acá", "mouses") == {}
    assert "dpi_max" not in ds.parse_desc("DPI 100000", "mouses")                                       # fuera de rango no entra
    g = lambda i, spec=None: {"id": i, "name": "Mouse Logitech M196", "category": "mouses", "spec": spec,
                              "offers": [{"store": "Click Gaming", "url": "u1"}, {"store": "Try", "url": "u2"}]}
    items = [{"url": "u1", "desc": m196}, {"url": "u2", "desc": "Mouse con 3 botones y 83 gramos. Peso: 83 g"}]
    groups = [g("a"), g("b", "cg1"), {"id": "c", "name": "Fuente", "category": "fuentes", "offers": [{"url": "u1"}]}]
    out, st = ds.refresh(groups, items, today="2026-10-27")
    assert groups[0]["spec"] == "ds:a" and groups[1]["spec"] == "cg1" and "spec" not in groups[2]          # no pisa a Compragamer
    it = out["ds:a"]
    assert it["sheet"] is False and it["f"]["botones"]["l"] == "pend" and "no es del fabricante" in it["f"]["botones"]["n"]
    # contradicción entre tiendas: se descarta ese dato
    items2 = [{"url": "u1", "desc": "Peso: 83 g\n3 botones\nsensor óptico"}, {"url": "u2", "desc": "Peso: 99 g\n3 botones"}]
    out2, _ = ds.refresh([g("x")], items2, today="2026-10-27")
    assert "peso_g" not in out2["ds:x"]["f"] and out2["ds:x"]["f"]["botones"]["v"] == 3
    # con menos de 2 datos no se guarda ninguna ficha
    out3, _ = ds.refresh([g("y")], [{"url": "u1", "desc": "Peso: 83 g"}], today="2026-10-27")
    assert out3 == {}


def test_goldentech_guarda_descripcion_de_perifericos():
    from scrapers import goldentech
    it = {"name": "Mouse Bluetooth Logitech M196 Rosa", "permalink": "x", "type": "simple", "is_in_stock": True, "images": [],
          "prices": {"price": "20000", "regular_price": "20000", "currency_code": "ARS", "currency_minor_unit": 0},
          "categories": [{"name": "Inalambrico"}], "description": "<ul><li>Peso: 83 g</li><li>Número de botones: 3</li></ul>"}
    p = goldentech.parse([it], "Click Gaming")[0]
    assert "Peso: 83 g" in p["desc"] and "\n" in p["desc"]
    it2 = dict(it, name="Placa de video RTX 4060", categories=[{"name": "Placas"}])
    assert "desc" not in goldentech.parse([it2], "Click Gaming")[0]       # solo periféricos: no engorda los datos del resto


def test_icecat():
    """Open Icecat: categoría y capacidad deben coincidir; pago/no está se registran; caché; sin usuario no consulta nada."""
    import tempfile
    from scrapers import icecat as ic
    fx = json.load(open("tests/fixtures/icecat.json"))
    f, info = ic.parse(fx["27GP850-B"], "monitores")
    assert (f["inch"]["v"], f["hz"]["v"], f["panel"]["v"], f["freesync"]["v"], f["hdmi"]["v"]) == (27, 165, "IPS", "FreeSync Premium", 2)
    assert info["id"] == 89731591
    assert ic.parse(fx["AP-750G"], "monitores")[0] is None                                   # categoría distinta: no se usa
    r, _ = ic.parse(fx["KF432C16BB/8"], "memorias-ram")
    assert (r["gb"]["v"], r["ddr"]["v"], r["mhz"]["v"], r["cl"]["v"], r["mods"]["v"]) == (8, "DDR4", 3200, 16, 1)
    p, _ = ic.parse(fx["AP-750G"], "fuentes")
    assert (p["w"]["v"], p["cert"]["v"], p["modular"]["v"], p["atx"]["v"]) == (750, "80 PLUS Gold", "Totalmente modular", "ATX 3.0")
    h, _ = ic.parse(fx["ST1000DM010"], "almacenamiento")
    assert (h["gb"]["v"], h["rpm"]["v"]) == (1000, 7200)
    assert ic.consistent("Memoria Kingston 8GB DDR4", "memorias-ram", r) and not ic.consistent("Memoria Kingston 16GB DDR4", "memorias-ram", r)
    assert not ic.consistent("Monitor LG 32\" 27GP850-B", "monitores", f) and not ic.consistent("Fuente ASUS 850W AP-750G", "fuentes", p)
    assert ic.codes("MONITOR 27 ASUS VA27EHF-J BLACK IPS 100HZ HDMI") == ["VA27EHF-J", "VA27EHF"]
    assert "2x16GB" not in ic.codes("Memoria Team DDR4 32GB (2x16GB) 3200MHz T-Create")
    calls = []
    def fake(brand, code):
        calls.append(code)
        return {"27GP850-B": ("ok", fx["27GP850-B"]), "KF432C16BB/8": ("ok", fx["KF432C16BB/8"]), "G203-PAGO": ("pago", None)}.get(code, ("no", None))
    groups = [{"id": "a", "name": "Monitor Gamer LG UltraGear 27GP850-B 27\" QHD 165Hz", "category": "monitores", "offers": [1, 2]},
              {"id": "b", "name": "Memoria Kingston Fury Beast 16GB DDR4 KF432C16BB/8", "category": "memorias-ram", "offers": [1]},   # 16 ≠ 8: se rechaza
              {"id": "c", "name": "Monitor Samsung LS24C310 24\"", "category": "monitores", "offers": [1]},
              {"id": "d", "name": "Fuente Seasonic 650W", "category": "fuentes", "offers": [1], "spec": "cg1"}]
    with tempfile.TemporaryDirectory() as d:
        assert ic.refresh(groups, d, user="") == ({}, {"ok": True, "apagado": "falta el secreto ICECAT_USER"})
        items, st = ic.refresh(groups, d, fetch=fake, today="2026-10-27")
        assert groups[0]["spec"] == "ic:89731591" and "spec" not in groups[1] and "spec" not in groups[2] and groups[3]["spec"] == "cg1"
        it = items["ic:89731591"]
        assert it["s"] == "Icecat" and it["url"] is None and "Specs Icecat" in it["f"]["hz"]["n"] and "l" not in it["f"]["hz"]
        assert st["vinculadas"] == 1 and st["rechazadas"] == 1 and st["sin_ficha"] == 2
        n = len(calls)
        g2 = [dict(g, spec=None) if g["id"] != "d" else g for g in groups]
        items2, st2 = ic.refresh(g2, d, fetch=fake, today="2026-10-28")
        assert len(calls) == n and st2["consultas"] == 0 and g2[0]["spec"] == "ic:89731591"           # todo sale de la caché
    def stop(brand, code):
        raise ic._Stop("Icecat respondió 429")
    with tempfile.TemporaryDirectory() as d:
        items, st = ic.refresh([dict(groups[0], spec=None)], d, fetch=stop, today="2026-10-27")
        assert items == {} and st["ok"] is False and "429" in st["error"]


def test_limpieza_actualizacion_27():
    """Procesadores que las tiendas ponen en refrigeración («Micro Procesador … S/Cooler», «Proces. …»), coolers en
    procesadores («CPU Cooler …») y productos que no son hardware (sobres, lámparas, heladeras)."""
    from scrapers.common import fix_category as f
    assert f("Micro Procesador AMD Ryzen 5 8500G 5.0 GHz Turbo (OEM) S/Cooler – AM5", "refrigeracion") == "procesadores"
    assert f("Proces. AMD Ryzen 9 7900 AM5 CON VIDEO SIN COOLER", "refrigeracion") == "procesadores"
    assert f("CPU INTEL CORE I3-12100 ALDERLAKE S1700 TRAY (I)", "procesadores") == "procesadores"
    assert f("CPU Cooler MASTER Hyper 212 3DHP Black", "procesadores") == "refrigeracion"
    assert f("Controladora Gamemax Fan Led Rainbow", "refrigeracion") == "accesorios"
    assert f("Controlador de Juegos CORSAIR Novablade Pro", "otros") != "accesorios"
    assert f("Alfombra Gamer Coolermaster Fm510 Halo", "refrigeracion") == "perifericos"
    assert f("DELL Standar fan cuskit - R550 (2 FAN X CPU) X 2", "refrigeracion") == "otros"
    for junk in ("Sobres De Papel Para Cd S/Ventana", "Lampara Velador De Silicona Pera Usb", "HELADERA PORTÁTIL ECOFLOW GLACIER (7950)", "Fee- Derecho A Dropshipping"):
        assert f(junk, "otros") is None, junk
    assert f("Water Cooler CORSAIR NAUTILUS 240 RS ARGB", "refrigeracion") == "refrigeracion"


def test_resumen_portada():
    """home.json: la portada ya no descarga el catálogo entero (17 MB); solo cuentas, una foto por categoría y las bajas."""
    import build_data
    g = lambda i, name, cat, n=1, stock=True, img="https://x/a.jpg", chg=None: {"id": i, "name": name, "category": cat, "image": img,
        "offers": [{"store": f"T{k}", "price_cash": 100 + k, "stock": stock} for k in range(n)], **({"chg": chg} if chg else {})}
    P = [g("a", "Procesador AMD Ryzen 5 5600", "procesadores", 3), g("b", "Procesador Intel i5", "procesadores", 1),
         g("c", "Pasta térmica", "refrigeracion", 5), g("d", "Mouse Logitech", "mouses", 2, stock=False),
         g("e", "Monitor LG 24", "monitores", 1, chg={"prev": 200, "pct": -20.0})]
    h = build_data.home_summary(P)
    assert h["products"] == 5 and h["stores"] == 5 and h["cats"]["procesadores"] == 2
    assert h["photo"]["procesadores"]["id"] == "a"                  # la más comparada
    assert "refrigeracion" not in h["photo"]                         # el título no empieza con el tipo de producto
    assert "mouses" not in h["photo"]                                # sin stock no se usa de foto
    assert h["dropped"] == 1 and h["drops"][0]["id"] == "e" and len(json.dumps(h)) < 5000
