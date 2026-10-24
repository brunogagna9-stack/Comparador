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
    ids = [g[0] for g in mh.G] + [c[0] for c in mh.C] + [l[0] for l in mh.LEG]
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
        assert c[7] is not None or c[0] == "i3-12100f", c[0]   # sin puntaje solo si no hay fuente
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
    assert canon_category("MONITOR 19 PERFORMANCE PF185R VGA/HDMI") == "monitores"   # «HDMI» en el título no lo vuelve accesorio
    assert canon_category("Cable HDMI 2.1 2 metros") == "accesorios"


def test_hardware_especificaciones():
    import json, re
    from pathlib import Path
    hw = json.loads((Path("site/data/hardware.json")).read_text())
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
    assert len(con) == 17 and {"Gaming City", "Hardloots"} == set(d) - con, "solo estas dos tiendas quedan sin puntaje verificado"
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
