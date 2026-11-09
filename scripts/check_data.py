"""Verifica que los datos generados sean válidos ANTES de publicar la web.
Si algo está dañado (JSON roto, marcas de conflicto de Git, catálogo vacío) sale con error y no se publica:
así la web nunca queda sin productos por un archivo roto. Uso: python scripts/check_data.py"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARK = re.compile(r"^(<<<<<<<|=======|>>>>>>>)", re.M)


def check(root=ROOT):
    errs = []
    for folder in ("site/data", "raw"):
        for f in sorted((root / folder).glob("*.json")) if (root / folder).exists() else []:
            txt = f.read_text(encoding="utf-8")
            if MARK.search(txt):
                errs.append(f"{f.relative_to(root)}: tiene marcas de conflicto de Git (<<<<<<< / >>>>>>>)")
                continue
            try:
                json.loads(txt)
            except Exception as e:
                errs.append(f"{f.relative_to(root)}: JSON inválido ({e})")
    p = root / "site/data/products.json"
    if p.exists() and not errs:
        d = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(d, list) or len(d) < 50:
            errs.append(f"products.json tiene {len(d) if isinstance(d, list) else '?'} productos (se esperan cientos): no se publica")
    elif not p.exists():
        errs.append("falta site/data/products.json")
    # actualización 38: si están las partes del catálogo (site/data/p/NN.json), tienen que estar todas y tener
    # todos los productos; si no existen, las fichas usan el catálogo completo y no es un error.
    sh = root / "site/data/p"
    if sh.exists() and p.exists() and not errs:
        files = sorted(sh.glob("*.json"))
        try:
            ids = set()
            for f in files:
                ids.update(json.loads(f.read_text(encoding="utf-8")).get("g", {}))
            want = {g["id"] for g in json.loads(p.read_text(encoding="utf-8"))}
            if files and (len(files) != 64 or ids != want):
                errs.append(f"site/data/p: {len(files)} partes con {len(ids)} productos (se esperan 64 con {len(want)}): no se publica")
        except Exception as e:
            errs.append(f"site/data/p: parte ilegible ({e})")
    return errs


if __name__ == "__main__":
    e = check()
    for x in e:
        print("ERROR:", x)
    if e:
        sys.exit(1)
    print("Datos válidos.")
