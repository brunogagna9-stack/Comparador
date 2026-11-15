"""Páginas de precios por categoría para buscadores (actualización 43).

Genera una página fija por categoría (site/precios-<categoría>.html) con texto y tablas reales: los productos más
comparados, los más baratos con stock y los que bajaron. Todo sale de site/data/products.json: no se inventa nada.
También escribe site/sitemap-guias.xml (lo enlaza sitemap.xml). Se generan en cada actualización de precios y solo
se publican (no se guardan en el repositorio). Si algo falla, no frena la publicación.
"""
import html
import json
import sys
from pathlib import Path
from urllib.parse import quote

SITE = Path(__file__).resolve().parent.parent / "site"
URL = "https://brunogagna9-stack.github.io/Comparador/"
CATS = {"placas-de-video": ("Placas de video", "placas de video"), "procesadores": ("Procesadores", "procesadores"),
        "motherboards": ("Placas madre", "placas madre (motherboards)"), "memorias-ram": ("Memorias RAM", "memorias RAM"),
        "almacenamiento": ("SSD y discos", "discos SSD y rígidos"), "fuentes": ("Fuentes", "fuentes de alimentación"),
        "gabinetes": ("Gabinetes", "gabinetes"), "refrigeracion": ("Refrigeración", "coolers y refrigeración"),
        "monitores": ("Monitores", "monitores"), "notebooks": ("Notebooks", "notebooks"), "pcs-armadas": ("PC armadas", "PC armadas"),
        "mouses": ("Mouse", "mouse"), "teclados": ("Teclados", "teclados"), "auriculares": ("Auriculares", "auriculares")}
MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()

e = lambda s: html.escape(str(s if s is not None else ""), quote=True)
ars = lambda n: "$" + f"{round(n):,}".replace(",", ".")
price = lambda o: o.get("price_cash") or o.get("price_list")


def best(g):
    """Mejor oferta con stock y sin precio inusual (o None)."""
    ok = [o for o in g.get("offers", []) if o.get("stock") is not False and not o.get("anom") and price(o)]
    return min(ok, key=price) if ok else None


def fecha(iso):
    try:
        y, m, d = (int(x) for x in iso[:10].split("-"))
        return f"{d} de {MESES[m - 1]} de {y}"
    except Exception:
        return ""


def rows(items):
    out = []
    for g, o in items:
        n = len({x["store"] for x in g["offers"]})
        chg = g.get("chg") or {}
        baja = f' <span class="dn">▼ {abs(chg["pct"]):g}%</span>'.replace(".", ",") if chg.get("pct", 0) < 0 and not o.get("anom") else ""
        out.append(f'<tr><td><a href="producto.html?id={quote(g["id"], safe="")}">{e(g["name"])}</a></td>'
                   f'<td class="n">{ars(price(o))}{baja}</td><td>{e(o["store"])}</td><td class="n">{n}</td></tr>')
    return "\n".join(out)


def table(title, intro, items):
    if not items:
        return ""
    return (f'<h2>{e(title)}</h2>\n<p>{e(intro)}</p>\n<div class="tw" tabindex="0" role="region" aria-label="{e(title)}"><table>\n'
            f'<tr><th>Producto</th><th class="n">Mejor precio</th><th>Tienda</th><th class="n">Tiendas</th></tr>\n{rows(items)}\n</table></div>')


def page(cat, groups, updated, others=()):
    title, lower = CATS[cat]
    priced = [(g, best(g)) for g in groups if g.get("category") == cat]
    priced = [(g, o) for g, o in priced if o]
    if len(priced) < 10:
        return None
    stores = sorted({o["store"] for g, _ in priced for o in g["offers"]})
    multi = sorted([x for x in priced if len({o["store"] for o in x[0]["offers"]}) >= 2],
                   key=lambda x: (-len({o["store"] for o in x[0]["offers"]}), price(x[1])))[:40]
    cheap = sorted(priced, key=lambda x: price(x[1]))[:15]
    down = sorted([x for x in priced if (x[0].get("chg") or {}).get("pct", 0) <= -3], key=lambda x: x[0]["chg"]["pct"])[:15]
    ps = sorted(price(o) for _, o in priced)
    lo, mid = ps[0], ps[len(ps) // 2]      # el máximo no se muestra: suele ser un precio mal cargado por alguna tienda
    f = fecha(updated)
    h1 = f"Precios de {lower} en Argentina"
    desc = (f"Comparamos {len(priced):,} {lower} en {len(stores)} tiendas argentinas".replace(",", ".")
            + f": desde {ars(lo)}. Precios, stock y cuotas actualizados el {f}.")
    canon = f"{URL}precios-{cat}.html"
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": h1, "numberOfItems": len(multi or cheap),
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": g["name"],
                               "url": URL + "producto.html?id=" + quote(g["id"], safe="")} for i, (g, _) in enumerate((multi or cheap)[:20])]}
    body = f"""<main class="doc">
<nav class="crumb" aria-label="Ruta"><a href="./">Inicio</a> › <a href="productos.html">Productos</a> › {e(title)}</nav>
<h1>{e(h1)}</h1>
<p class="lead">Hoy comparamos <b>{len(priced):,}</b> {e(lower)} con precio en <b>{len(stores)}</b> tiendas argentinas. Los precios arrancan en <b>{ars(lo)}</b> y la mitad cuesta menos de <b>{ars(mid)}</b>. Última actualización: {e(f)}.</p>
<p><a class="btn pri" href="productos.html?cat={e(cat)}">Ver, filtrar y ordenar todos los {e(lower)} →</a></p>
{table("Los más comparados", f"Los {lower} que se pueden comparar en más tiendas, con su mejor precio con stock.", multi)}
{table("Bajaron de precio", "Bajas recientes según nuestro historial. En la ficha de cada producto se ve si la baja es real o solo volvió a su precio habitual.", down)}
{table("Los más baratos con stock", f"Los {lower} de menor precio hoy. Ojo: en las categorías grandes, lo más barato suelen ser accesorios o modelos de entrada.", cheap)}
<h2>Cómo leemos estos precios</h2>
<p>Los datos salen de la página pública de cada tienda, varias veces por día. El precio que vale es siempre el de la tienda al momento de comprar: confirmá precio, stock y cuotas antes de pagar. Más detalles en <a href="preguntas.html">Preguntas frecuentes</a> y en <a href="tiendas.html">Tiendas</a>.</p>
<p class="upd">Tiendas con {e(lower)}: {e(", ".join(stores))}.</p>
{('<h2>Precios de otras categorías</h2><p class="more">' + " · ".join(f'<a href="precios-{c}.html">{e(CATS[c][0])}</a>' for c in others if c != cat) + "</p>") if others else ""}
</main>""".replace(f"<b>{len(priced):,}</b>", f"<b>{len(priced):,}</b>".replace(",", "."))
    head = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">
<title>{e(h1)} · KyraNoHard</title>
<meta name="description" content="{e(desc)}">
<!-- head:kyranohard -->
<link rel="canonical" href="{canon}">
<link rel="icon" href="favicon.ico" sizes="48x48">
<link rel="icon" href="img/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="img/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0f1e" media="(prefers-color-scheme: dark)">
<link rel="preload" href="fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<meta property="og:site_name" content="KyraNoHard">
<meta property="og:locale" content="es_AR">
<meta property="og:type" content="website">
<meta property="og:url" content="{canon}">
<meta property="og:title" content="{e(h1)} · KyraNoHard">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{URL}img/og.jpg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Logo de KyraNoHard: comparador de precios de hardware en Argentina">
<meta name="twitter:card" content="summary_large_image">
<!-- /head:kyranohard -->
<link rel="stylesheet" href="css/shared.css">
<link rel="stylesheet" href="css/layout.css">
<style>
.doc{{max-width:980px}}.doc h2{{margin:30px 0 6px;font-size:20px}}.doc p{{line-height:1.6}}.doc .upd{{color:var(--mut);font-size:13px}}
.crumb{{font-size:13px;color:var(--mut);margin-bottom:6px}}.crumb a,.doc p a:not(.btn){{text-decoration:underline}}.tw{{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}}
.tw table{{width:100%;border-collapse:collapse;font-size:14px}}.tw th,.tw td{{padding:9px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}}
.tw tr:last-child td{{border-bottom:0}}.tw th{{font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:var(--mut)}}.tw .n{{text-align:right;white-space:nowrap}}.tw .dn{{color:var(--ok);font-weight:700;font-size:12.5px}}
.btn.pri{{display:inline-block;text-decoration:none}}
</style>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False).replace("</", "<\\/")}</script>
</head>
<body data-page="precios">
<script src="js/layout.js"></script>
"""
    return head + body + "\n</body>\n</html>\n"


def main(site=SITE):
    try:
        groups = json.loads((site / "data" / "products.json").read_text(encoding="utf-8"))
        meta = json.loads((site / "data" / "meta.json").read_text(encoding="utf-8"))
        updated = meta.get("updated") or ""
        done = [c for c in CATS if page(c, groups, updated)]          # primero, cuáles tienen datos suficientes
        for old in site.glob("precios-*.html"):                         # una categoría que quedó vacía no deja su página vieja
            old.unlink()
        for cat in done:
            (site / f"precios-{cat}.html").write_text(page(cat, groups, updated, done), encoding="utf-8")
        day = updated[:10]
        xml = ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               + "\n".join(f"<url><loc>{URL}precios-{c}.html</loc>" + (f"<lastmod>{day}</lastmod>" if day else "") + "<changefreq>daily</changefreq><priority>0.8</priority></url>" for c in done)
               + "\n</urlset>\n")
        (site / "sitemap-guias.xml").write_text(xml, encoding="utf-8")
        print(f"Guías de precios: {len(done)} páginas ({', '.join(done)})")
    except Exception as ex:
        print(f"Guías de precios: no se pudieron generar ({str(ex)[:160]}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
