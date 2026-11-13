"""Etiquetas comunes del <head> de todas las páginas (actualización 39): ícono, app instalable, vista previa al
compartir (Open Graph) y descripción para buscadores. Se puede volver a correr sin duplicar nada:
    python3 scripts/head_tags.py
El bloque va entre <!-- head:kyranohard --> y <!-- /head:kyranohard -->."""
import html
import re
from pathlib import Path

SITE = "https://brunogagna9-stack.github.io/Comparador/"
SITE_DIR = Path(__file__).resolve().parent.parent / "site"
START, END = "<!-- head:kyranohard -->", "<!-- /head:kyranohard -->"

# Descripción para las páginas que no tenían una propia.
DESC = {
    "productos.html": "Buscá y filtrá hardware de tiendas argentinas: precios contado y en cuotas, stock y bajas de precio de cada producto, en un solo lugar.",
    "producto.html": "Precios, stock y cuotas de un producto en todas las tiendas argentinas que lo venden, con historial de precios y datos técnicos verificados.",
    "armado.html": "Armado de PC recomendado por presupuesto o juegos, con piezas compatibles y precios reales de tiendas argentinas.",
    "actualizar.html": "Contanos qué PC tenés y te decimos qué conviene actualizar primero, con piezas compatibles y precios reales de tiendas argentinas.",
    "encontra.html": "Respondé unas preguntas simples y te mostramos la notebook, PC o monitor que te conviene, con precios reales de tiendas argentinas.",
    "comparar.html": "Compará procesadores, placas de video, memorias y más, lado a lado: especificaciones de fábrica, ventajas de cada uno y precios.",
    "tiendas.html": "Las tiendas de hardware que compara KyraNoHard: cómo leemos sus precios, reputación verificada, contacto y estado de cada una.",
}
NOINDEX = {"cuenta.html", "historial.html"}   # páginas personales: no tienen sentido en buscadores


def block(name, title, desc):
    url = SITE + ("" if name == "index.html" else name)
    e = lambda s: html.escape(s, quote=True)
    lines = [
        START,
        '<link rel="icon" href="favicon.ico" sizes="48x48">',
        '<link rel="icon" href="img/logo.svg" type="image/svg+xml">',
        '<link rel="apple-touch-icon" href="img/apple-touch-icon.png">',
        '<link rel="manifest" href="manifest.webmanifest">',
        '<meta name="theme-color" content="#2563eb" media="(prefers-color-scheme: light)">',
        '<meta name="theme-color" content="#0b1020" media="(prefers-color-scheme: dark)">',
        '<link rel="preload" href="fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>',
        '<meta property="og:site_name" content="KyraNoHard">',
        '<meta property="og:locale" content="es_AR">',
        '<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:image" content="{SITE}img/og.jpg">',
        '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">',
        '<meta property="og:image:alt" content="Logo de KyraNoHard: comparador de precios de hardware en Argentina">',
        '<meta name="twitter:card" content="summary_large_image">',
    ]
    if name != "producto.html":          # la ficha cambia según el producto: su dirección canónica la pone la página
        lines.insert(1, f'<link rel="canonical" href="{url}">')
        lines.insert(-6, f'<meta property="og:url" content="{url}">')
    if name in NOINDEX:
        lines.insert(1, '<meta name="robots" content="noindex">')
    return "\n".join(lines + [END])


def apply(path):
    s = path.read_text(encoding="utf-8")
    s = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", s, flags=re.S)
    title = html.unescape(re.search(r"<title>(.*?)</title>", s, re.S).group(1).strip())
    m = re.search(r'<meta name="description" content="([^"]*)">', s)
    if not m:
        desc = DESC[path.name]
        s = s.replace("</title>", f'</title>\n<meta name="description" content="{html.escape(desc, quote=True)}">', 1)
    else:
        desc = html.unescape(m.group(1))
    i = s.index('<meta name="description"')
    j = s.index("\n", i) + 1
    s = s[:j] + block(path.name, title, desc) + "\n" + s[j:]
    path.write_text(s, encoding="utf-8")


if __name__ == "__main__":
    for p in sorted(SITE_DIR.glob("*.html")):
        apply(p)
        print("ok", p.name)
