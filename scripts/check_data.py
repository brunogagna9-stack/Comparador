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
    return errs


if __name__ == "__main__":
    e = check()
    for x in e:
        print("ERROR:", x)
    if e:
        sys.exit(1)
    print("Datos válidos.")
