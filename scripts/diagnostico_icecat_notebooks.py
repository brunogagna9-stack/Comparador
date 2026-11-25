"""Diagnóstico (no publica): cuántas notebooks del catálogo publicado encuentra Open Icecat y qué datos trae."""
import json, os, re, sys, urllib.request, collections
sys.path.insert(0, ".")
from scrapers import icecat as ic
user = os.environ.get("ICECAT_USER", "").strip()
if not user:
    print("Falta ICECAT_USER"); sys.exit(1)
g = json.load(urllib.request.urlopen("https://brunogagna9-stack.github.io/Comparador/data/products.json"))
nb = [x for x in g if x.get("category") == "notebooks"]
nb.sort(key=lambda x: -len(x.get("offers", ())))
BR = ic.BRANDS + ["Apple", "Samsung", "Huawei", "Gateway", "Bangho", "Exo", "Noblex", "Positivo", "Philco", "Hyundai", "Kelyx"]
fetch = ic._http_fetch(user)
res, cats, feats, ejemplos, sin_codigo, req = collections.Counter(), collections.Counter(), collections.Counter(), [], 0, 0
for x in nb:
    if req >= 120:
        break
    name = x["name"]
    brand = next((ic._ALIAS.get(b, b) for b in BR if re.search(rf"(?<![a-z]){re.escape(b.lower())}(?![a-z])", name.lower())), None)
    cs = ic.codes(name)
    if not brand or not cs:
        sin_codigo += 1
        continue
    estado = "no"
    for code in cs:
        req += 1
        try:
            st, resp = fetch(brand, code)
        except Exception as e:
            print("corte:", e); req = 999; break
        if st == "ok":
            d = resp.get("data") or {}
            gi = d.get("GeneralInfo") or {}
            cn = ((gi.get("Category") or {}).get("Name") or {}).get("Value") or ""
            cats[cn] += 1
            fs = {}
            for fid, f in ic._feats(d):
                nm = (((f.get("Feature") or {}).get("Name") or {}).get("Value") or "")
                if re.search(r"peso|bater|autonom|vatio|celda|wh\b", nm, re.I):
                    feats[(fid, nm)] += 1
                    fs[f"{fid} {nm}"] = f.get("PresentationValue") or f.get("Value")
            ejemplos.append({"tienda": name, "codigo": code, "icecat": gi.get("Title"), "categoria": cn, "datos": fs})
            estado = "ok"; break
        if st == "pago":
            estado = "pago"; break
    res[estado] += 1
print(f"notebooks publicadas: {len(nb)}; sin marca o código en el título (no consultadas): {sin_codigo}; consultas: {min(req, 120)}")
print(f"resultado: {dict(res)}")
print(f"categorías Icecat: {dict(cats)}")
print("campos de peso/batería encontrados (ID, nombre, veces):")
for (fid, nm), n in feats.most_common(20):
    print(f"  {fid} | {nm} | {n}")
json.dump(ejemplos, open("icecat_notebooks.json", "w"), ensure_ascii=False, indent=1)
