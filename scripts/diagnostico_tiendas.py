"""Actualización 47 · diagnóstico de tiendas (etapa 3). Corre en GitHub Actions, donde corren los lectores.
Para cada tienda candidata o a revisar:
  1. lee su robots.txt y comprueba que los listados que usaríamos estén permitidos para ComparadorARBot;
  2. detecta la plataforma (Tiendanube, WooCommerce, PrestaShop…);
  3. si es viable, lee su catálogo con el MISMO lector que usaría el comparador y mide la calidad de los datos
     (cuántos productos, categorías, precios contado / lista, cuotas, stock, fotos);
  4. compara con lo que la tienda dice tener.
No publica nada: escribe un informe (Markdown + JSON). Pocos pedidos y con pausa (scrapers/common.get).
Uso: python scripts/diagnostico_tiendas.py > informe.md"""
import collections
import json
import re
import statistics
import sys
import urllib.robotparser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scrapers import common, tiendanube  # noqa: E402
from scrapers.common import UA, session  # noqa: E402

OUT = {}


def fetch(url, timeout=30):
    try:
        r = session().get(url, timeout=timeout, allow_redirects=True)
        return r.status_code, r.text, r.url, r.headers
    except Exception as e:  # red, DNS
        return None, str(e)[:160], url, {}


def robots(base):
    st, txt, _, _ = fetch(base.rstrip("/") + "/robots.txt")
    rp = urllib.robotparser.RobotFileParser()
    rp.parse(txt.splitlines() if st == 200 else [])
    return rp, st, (txt if st == 200 else "")


def platform(html, headers):
    h = html.lower()
    if "tiendanube" in h or "nuvemshop" in h or "d26lpennugtm8s.cloudfront.net" in h:
        return "Tiendanube"
    if "wp-content" in h and "woocommerce" in h:
        return "WooCommerce"
    if "prestashop" in h:
        return "PrestaShop"
    if "vtex" in h:
        return "VTEX"
    if "mercadoshops" in h:
        return "MercadoShops"
    return "desconocida"


def quality(items):
    n = len(items)
    if not n:
        return {"productos": 0}
    cash = [i["price_cash"] for i in items if i.get("price_cash")]
    return {
        "productos": n,
        "con_precio_contado": len(cash),
        "con_precio_lista": sum(1 for i in items if i.get("price_list")),
        "con_cuotas": sum(1 for i in items if i.get("cuotas")),
        "stock_confirmado": sum(1 for i in items if i.get("stock") is True),
        "sin_stock": sum(1 for i in items if i.get("stock") is False),
        "con_foto": sum(1 for i in items if i.get("image")),
        "mediana_contado": round(statistics.median(cash)) if cash else None,
        "categorias": dict(collections.Counter(i.get("category") for i in items).most_common(15)),
        "ejemplos": [{k: i.get(k) for k in ("name", "price_cash", "price_list", "cuotas", "stock", "url")} for i in items[:6]],
    }


def nav_links(html, base):
    host = re.sub(r"^https?://(www\.)?", "", base).rstrip("/")
    links = set(re.findall(r'href="(?:https?://(?:www\.)?' + re.escape(host) + r')?(/[a-z0-9\-]+/)"', html))
    return sorted(l for l in links if not re.search(r"^/(productos|cuenta|account|login|carrito|cart|checkout|search|buscar|contacto|blog|politica|terminos|ayuda|faq)", l))[:60]


def candidate_tiendanube(name, base, paths, max_pages=80):
    rp, rst, rtxt = robots(base)
    st, html, final, hd = fetch(base)
    info = {"tienda": name, "sitio": base, "http": st, "url_final": final, "plataforma": platform(html or "", hd),
            "robots_http": rst, "robots_extracto": "\n".join(l for l in rtxt.splitlines() if l.strip() and not l.startswith("#"))[:900],
            "categorias_del_menu": nav_links(html or "", base)}
    allowed = {p: rp.can_fetch(UA, base + p) and rp.can_fetch(UA, base + p + "?page=2") for p in paths}
    info["listados_permitidos"] = allowed
    if st != 200 or not all(allowed.values()):
        info["conclusion"] = "no se lee: sitio caído o listados no permitidos por robots.txt"
        return info
    items = tiendanube.scrape_store(name, base.rstrip("/"), tuple(paths), max_pages=max_pages)
    info["calidad"] = quality(items)
    tot = re.findall(r"(\d[\d.]*)\s*productos? en cat[aá]logo", html or "")
    info["la_tienda_dice"] = tot[:3]
    return info


def check_domain(name, base):
    st, html, final, hd = fetch(base)
    title = re.search(r"<title[^>]*>(.*?)</title>", html or "", re.S | re.I)
    return {"tienda": name, "sitio": base, "http": st, "url_final": final, "plataforma": platform(html or "", hd) if st == 200 else None,
            "titulo": (title.group(1).strip()[:120] if title else None)}


def armytech_coverage():
    """Army Tech: lo que muestran sus listados frente a lo que lee el comparador."""
    from scrapers import armytech
    rp, rst, _ = robots(armytech.BASE)
    res = []
    for l in armytech.LISTINGS:
        url = f"{armytech.BASE}/{l}"
        ok = rp.can_fetch(UA, url)
        st, html, _, _ = fetch(url) if ok else (None, "", url, {})
        m = re.search(r"Hay\s+([\d.]+)\s+productos?", html or "", re.I) or re.search(r"de\s+([\d.]+)\s+(?:art[ií]culos|productos)", html or "", re.I)
        res.append({"listado": l, "permitido": ok, "http": st, "la_tienda_dice": m.group(1) if m else None})
    raw = Path("raw/Armytech.json")
    n = len(json.loads(raw.read_text())) if raw.exists() else None
    return {"listados": res, "leidos_por_el_comparador_ultima_vez": n}


def goldentech_coverage():
    base = "https://goldentechstore.com.ar"
    st, txt, _, hd = fetch(base + "/wp-json/wc/store/v1/products?per_page=1")
    raw = Path("raw/GoldenTech.json")
    n = len(json.loads(raw.read_text())) if raw.exists() else None
    return {"http": st, "total_que_informa_la_tienda": hd.get("X-WP-Total") or hd.get("x-wp-total"), "leidos_por_el_comparador_ultima_vez": n}


if __name__ == "__main__":
    common.DELAY = max(getattr(common, "DELAY", 1.5), 1.5)
    OUT["quantum"] = candidate_tiendanube("Quantum Hardstore", "https://quantumhardstore.com", ["/componentes/", "/perifericos/"])
    OUT["dominios"] = [check_domain(n, u) for n, u in [
        ("Maldito Hard", "https://www.malditohard.com.ar"), ("Mym Computación", "https://www.mymcomputacion.com.ar"),
        ("Hard Vision", "https://www.hardvision.com.ar"), ("Compugarden", "https://www.compugarden.com.ar"),
        ("Biosistemas", "https://www.biosistemas.com.ar")]]
    OUT["armytech"] = armytech_coverage()
    OUT["goldentech"] = goldentech_coverage()
    Path("diagnostico_tiendas.json").write_text(json.dumps(OUT, ensure_ascii=False, indent=1), encoding="utf-8")
    q = OUT["quantum"]
    print("## Diagnóstico de tiendas\n")
    print(f"### Quantum Hardstore\n- HTTP {q['http']} · plataforma {q['plataforma']} · robots.txt HTTP {q['robots_http']}")
    print(f"- Listados permitidos: {q['listados_permitidos']}")
    print(f"- Conclusión: {q.get('conclusion', 'leído')}")
    if q.get("calidad"):
        c = q["calidad"]
        print(f"- Productos: {c['productos']} · con precio contado {c['con_precio_contado']} · lista {c['con_precio_lista']} · cuotas {c['con_cuotas']} · stock confirmado {c['stock_confirmado']} · sin stock {c['sin_stock']} · con foto {c['con_foto']} · mediana ${c['mediana_contado']}")
    print("\n### Dominios candidatos\n" + "\n".join(f"- {d['tienda']}: HTTP {d['http']} · {d['plataforma']} · {d['titulo']} · {d['url_final']}" for d in OUT["dominios"]))
    a = OUT["armytech"]
    print("\n### Army Tech (cobertura)\n" + "\n".join(f"- {x['listado']}: permitido {x['permitido']} · HTTP {x['http']} · la tienda dice {x['la_tienda_dice']}" for x in a["listados"]))
    print(f"- Leídos por el comparador la última vez: {a['leidos_por_el_comparador_ultima_vez']}")
    g = OUT["goldentech"]
    print(f"\n### GoldenTech (cobertura)\n- API HTTP {g['http']} · la tienda informa {g['total_que_informa_la_tienda']} · leídos {g['leidos_por_el_comparador_ultima_vez']}")
