"""Informe de posibles productos repetidos entre tiendas (actualización 42). SOLO INFORMA: no une nada.

Busca pares de productos de la misma categoría, de tiendas distintas, con nombres casi iguales y los mismos números
(capacidad, modelo, potencia…), que el cruce automático dejó separados. Sirve para revisar a mano y, si corresponde,
mejorar las reglas del cruce. Usa RapidFuzz (https://github.com/rapidfuzz/RapidFuzz, licencia MIT).
El resultado va al resumen de la corrida en GitHub Actions (y a la consola). Nunca frena la publicación.
"""
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "site" / "data" / "products.json"
CUTOFF = 93          # parecido mínimo (0–100) entre nombres normalizados
MAX_POR_CAT = 1500   # por categoría se comparan como mucho estos productos (los de una sola tienda primero)
RUIDO = r"\b(de|con|para|el|la|los|las|y|en|sin|gamer|gaming|nuevo|oferta|garantia|oficial|envio|gratis|cuotas|interes)\b"


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    s = re.sub(r"(\d)\s+(gb|tb|mhz|w|hz|mm|cm|pulgadas|\")\b", r"\1\2", s)   # «16 GB» = «16GB»
    s = re.sub(RUIDO, " ", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def numeros(s):
    return frozenset(re.findall(r"\d+", s))


def pares(groups, cutoff=CUTOFF, limit=MAX_POR_CAT):
    from rapidfuzz import fuzz, process
    porcat = {}
    for g in groups:
        if g.get("offers") and g.get("category") not in (None, "otros"):
            porcat.setdefault(g["category"], []).append(g)
    out = []
    for cat, gs in porcat.items():
        gs = sorted(gs, key=lambda g: len(g["offers"]))[:limit]
        names = [norm(g["name"]) for g in gs]
        nums = [numeros(n) for n in names]
        stores = [{o["store"] for o in g["offers"]} for g in gs]
        for i in range(len(gs)):
            # sin numpy: process.extract compara contra todos y devuelve (texto, puntaje, posición)
            for _, score, j in process.extract(names[i], names, scorer=fuzz.token_sort_ratio, score_cutoff=cutoff, limit=None):
                if j <= i or stores[i] & stores[j] or not nums[i] or nums[i] != nums[j]:
                    continue    # misma tienda en ambos, o números distintos (RTX 4060 ≠ 4060 Ti 16GB…): no es el mismo
                bi, bj = (gs[i].get("brand") or "").lower(), (gs[j].get("brand") or "").lower()
                if bi and bj and bi != bj:
                    continue
                out.append((int(round(score)), cat, gs[i], gs[j]))
    return sorted(out, key=lambda x: (-x[0], x[1]))


def main():
    try:
        groups = json.loads(DATA.read_text(encoding="utf-8"))
        found = pares(groups)
    except Exception as e:
        print(f"Cruces dudosos: no se pudo armar el informe ({str(e)[:150]}).")
        return 0
    lines = ["## Posibles productos repetidos entre tiendas (solo informe)", "",
             f"{len(found)} pares con nombres casi iguales y los mismos números que quedaron separados "
             f"({sum(1 for f in found if f[0] == 100)} con exactamente las mismas palabras en otro orden). "
             "Revisar a mano: el cruce automático no se cambia solo.", "",
             "| Parecido | Categoría | Producto A (tiendas) | Producto B (tiendas) |", "|---|---|---|---|"]
    cell = lambda g: (g["name"][:70] + " (" + ", ".join(sorted({o["store"] for o in g["offers"]}))[:60] + ")").replace("|", "/")
    for s, cat, a, b in found[:40]:
        lines.append(f"| {s} | {cat} | {cell(a)} | {cell(b)} |")
    txt = "\n".join(lines) + "\n"
    print(txt)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
            f.write(txt)
    return 0


if __name__ == "__main__":
    sys.exit(main())
