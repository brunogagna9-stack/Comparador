"""Genera datos de EJEMPLO (inventados) usando el mismo motor real, para ver el diseño sin correr las tiendas."""
import json, random, datetime as dt
from pathlib import Path
import build_data as bd
random.seed(5)
today = dt.date.today()
prods = [("Procesador AMD Ryzen 5 5500 AM4","procesadores",125000),("Procesador Intel Core i5-12400F LGA1700","procesadores",160000),
 ("Placa de Video MSI GeForce RTX 4060 8GB GDDR6","placas-de-video",520000),("Placa de Video ASUS Radeon RX 9060 XT 16GB","placas-de-video",780000),
 ("Memoria RAM Kingston Fury 16GB DDR4 3200MHz","memorias-ram",48000),("Memoria RAM Corsair 32GB DDR5 6000MHz","memorias-ram",150000),
 ("Disco SSD NVMe Kingston 1TB Gen4","almacenamiento",85000),("Mother MSI A520M-A PRO AM4","motherboards",78000),
 ("Fuente Gigabyte 650W 80 Plus Bronze","fuentes",70000),("Gabinete Gamdias Talos E3 ARGB","gabinetes",65000),
 ("Monitor LG 24 pulgadas 144Hz","monitores",230000),("Cooler CPU Deepcool AK400","refrigeracion",42000)]
stores = ["Compragamer","MEXX","Maximus","Gezatek","Fullh4rd","Logg"]
items = []; hist = {"_v": 2}
for n, c, base in prods:
    for s in random.sample(stores, random.randint(3, 6)):
        cash = round(base * random.uniform(.95, 1.1), -2)
        it = bd.__dict__  # noqa
        from scrapers.common import product
        p = product(s, n, f"https://ejemplo.invalid/{s}/{abs(hash(n))}", cash, round(cash*1.1,-2), stock=random.choice([True,True,False]), category=c)
        items.append(p)
        # historial inventado: 8 puntos en 40 días, y a veces un cambio reciente
        k = bd.okey(p); v = cash * random.uniform(.95, 1.08); series = []
        for d in range(40, 3, -5):
            v = round(v * random.uniform(.97, 1.03), -2); series.append([(today - dt.timedelta(days=d)).isoformat(), v])
        r = random.random()
        last = round(cash * (1.12 if r < .25 else .88 if r < .55 else 1.0), -2)
        series.append([(today - dt.timedelta(days=random.randint(0, 6))).isoformat(), last])
        p["price_cash"] = last; p["price_list"] = round(last*1.1, -2)
        hist[k] = series
groups = bd.build(items)
bd.update_history(groups, hist, today.isoformat()); bd.annotate_changes(groups, hist, today.isoformat())
D = Path("site/data"); D.mkdir(parents=True, exist_ok=True)
(D/"products.json").write_text(json.dumps(groups, ensure_ascii=False, separators=(",", ":")))
(D/"history.json").write_text(json.dumps(hist, separators=(",", ":")))
(D/"meta.json").write_text(json.dumps({"updated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
  "stores": {s: {"ok": True, "count": 0} for s in stores}, "groups": len(groups), "demo": True}))
