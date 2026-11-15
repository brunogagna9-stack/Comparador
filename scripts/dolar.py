"""Cotización del dólar para mostrar «≈ US$» junto a los precios (actualización 42).

Fuente: DolarApi.com (https://dolarapi.com, código abierto). Sus condiciones de uso permiten guardar una copia y
publicar un trabajo con esos datos citando el servicio, y recomiendan no consultar más de una vez cada 3 horas:
acá se consulta una vez por actualización de precios (cada 6 horas). Se guarda en site/data/dolar.json.
Si la consulta falla o los datos no son válidos, NO se escribe nada (queda la cotización anterior con su fecha;
la web deja de mostrarla si tiene más de 7 días). Nunca frena la publicación de precios.
"""
import datetime as dt
import json
import sys
from pathlib import Path

URL = "https://dolarapi.com/v1/dolares"
OUT = Path(__file__).resolve().parent.parent / "site" / "data" / "dolar.json"
CASAS = ("oficial", "blue", "tarjeta")


def build(data, now=None):
    """De la respuesta de /v1/dolares arma el archivo. Devuelve None si falta algo o algún valor no es razonable."""
    if not isinstance(data, list):
        return None
    out = {"fuente": "DolarApi.com", "url": "https://dolarapi.com",
           "leido": (now or dt.datetime.now(dt.timezone.utc)).strftime("%Y-%m-%dT%H:%MZ"), "casas": {}}
    for d in data:
        if not isinstance(d, dict) or d.get("moneda") != "USD" or d.get("casa") not in CASAS:
            continue
        v = d.get("venta")
        if not isinstance(v, (int, float)) or not (50 <= v <= 1_000_000):   # fuera de rango = dato roto, no se usa
            continue
        out["casas"][d["casa"]] = {"nombre": str(d.get("nombre") or d["casa"])[:40], "venta": float(v),
                                   "fecha": str(d.get("fechaActualizacion") or "")[:25]}
    return out if "oficial" in out["casas"] else None


def main():
    try:
        import requests
        r = requests.get(URL, timeout=20, headers={"User-Agent": "ComparadorARBot/0.1 (KyraNoHard; cotización para mostrar precios en dólares)"})
        r.raise_for_status()
        out = build(r.json())
    except Exception as e:  # sin internet, servicio caído, JSON roto…
        print(f"Dólar: no se pudo leer la cotización ({str(e)[:120]}). Se conserva la anterior.")
        return 0
    if not out:
        print("Dólar: la respuesta no tenía datos válidos. Se conserva la anterior.")
        return 0
    OUT.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print("Dólar: " + " · ".join(f"{c['nombre']} ${c['venta']:,.2f}" for c in out["casas"].values()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
