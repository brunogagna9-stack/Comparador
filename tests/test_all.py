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
