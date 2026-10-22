"""Genera datos de EJEMPLO (inventados) para ver cómo luce el sitio antes de la primera corrida real."""
import json, random, datetime as dt
from pathlib import Path
random.seed(3)
D = Path("site/data"); D.mkdir(parents=True, exist_ok=True)
items = [("AMD Ryzen 5 5500 AM4","procesadores",125000),("Intel Core i5-12400F LGA1700","procesadores",160000),
 ("Placa de Video RTX 4060 8GB GDDR6","placas-de-video",520000),("Memoria RAM 16GB DDR4 3200MHz","memorias-ram",48000),
 ("SSD NVMe 1TB Gen4","almacenamiento",85000),("Fuente 650W 80 Plus Bronze","fuentes",70000)]
stores = ["Compragamer","MEXX","Maximus","Gezatek","Fullh4rd","Logg"]
groups, hist = [], {}
today = dt.date.today()
for i,(n,c,base) in enumerate(items):
    offers=[]
    for s in random.sample(stores, random.randint(3,6)):
        cash = round(base*random.uniform(.95,1.1),-2)
        offers.append({"store":s,"url":"#","price_cash":cash,"price_list":round(cash*1.1,-2),
                       "stock":random.choice([True,True,False]),"cuotas":None,"rating":None})
    offers.sort(key=lambda o:o["price_cash"])
    gid=f"demo-{i}"; groups.append({"id":gid,"name":n+" (EJEMPLO)","category":c,"image":None,"offers":offers})
    hist[gid]={o["store"]:[[(today-dt.timedelta(days=30-d*5)).isoformat(),round(o["price_cash"]*random.uniform(.97,1.06),-2)] for d in range(7)] for o in offers}
(D/"products.json").write_text(json.dumps(groups,ensure_ascii=False))
(D/"history.json").write_text(json.dumps(hist))
(D/"meta.json").write_text(json.dumps({"updated":dt.datetime.now(dt.timezone.utc).isoformat(timespec="minutes"),
  "stores":{s:{"ok":True,"count":0} for s in stores},"groups":len(groups),"demo":True}))
