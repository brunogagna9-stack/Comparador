import json, sys
sys.path.insert(0, ".")
from scrapers.common import parse_ars, canon_category
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
    ids = [g[0] for g in mh.G] + [c[0] for c in mh.C]
    assert len(ids) == len(set(ids))
    for g in mh.G:
        assert g[4] > 0 and g[5] >= g[4] and all(x > 0 for x in g[6]), g[0]   # la fuente nunca es menor al consumo
        re.compile(g[9]); re.compile(g[10] or "x")
    for c in mh.C:
        assert c[6] >= c[5] and c[3] in ("AM4", "AM5", "LGA1700", "LGA1851"), c[0]
        re.compile(c[9])
        # el tipo de memoria debe ser coherente con el socket
        assert (c[3] in ("AM5", "LGA1851")) == (c[4] == "DDR5") or c[3] == "LGA1700", c[0]


def test_categorias_pc_armadas():
    from scrapers.common import canon_category, is_service
    for n in ["PC Armada AMD Ryzen 5 5500 RTX 3050 16GB 512GB", "PC Powered by MSI Ultimate Intel Ultra 5 245KF B860 RTX 5060",
              "PC Gamer R7-7700X 32GB RAM SSD 1TB RX 9070 XT 16GB WIFI"]:
        assert canon_category(n) == "pcs-armadas", n   # antes caían en "placas de video"
    assert canon_category("Placa de Video MSI GeForce RTX 5070 Ti 16GB") == "placas-de-video"
    assert is_service("Service Instalación Cooler CPU en equipos armados")


def test_hardware_especificaciones():
    import json, re
    from pathlib import Path
    hw = json.loads((Path("site/data/hardware.json")).read_text())
    for g in hw["gpus"]:
        sp = g["spec"]
        assert sp["bw"] == round(sp["bus"] / 8 * sp["gbps"]), g["id"]
        assert set(g["ver"]) <= set(sp) , g["id"]
        re.compile(g["m"])
    for c in hw["cpus"]:
        sp = c["spec"]
        assert sp["threads"] >= sp["cores"] and sp["boost"] > 3, c["id"]
        assert set(c["ver"]) <= set(sp), c["id"]
        assert not re.search(c["m"], "placa de video rx 7600 8gb", re.I), c["id"]   # "RX 7600" no es el Ryzen 5 7600
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
    d = json.load(open("site/data/stores.json"))["stores"]
    for name, s in d.items():
        for r in s["reputation"]:
            assert r["source"] and r["url"].startswith("http") and r["date"] and r["count"] > 0 and 0 < r["score"] <= 5, name
        assert len({r["source"] for r in s["reputation"]}) == len(s["reputation"]), "una puntuación por plataforma; nunca promediadas"
    assert d["Maximus"]["reputation"] == [] and d["Gezatek"]["integration"] == "no disponible"
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
