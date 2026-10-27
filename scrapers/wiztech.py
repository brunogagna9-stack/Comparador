"""WIZ TECH (wiztech.com.ar): el catálogo del sitio se arma con un JSON público del propio sitio
(/backend/Controller/ProductosController.php?action=getProductosForCatalogo&param=0, ~180 productos), el mismo que pide
la página «Catálogo» al abrirse. El sitio no publica robots.txt (cualquier ruta devuelve la aplicación), así que no hay
restricciones declaradas; se pide una sola vez por corrida.

La tienda muestra UN solo precio por producto, sin aclarar medio de pago: se guarda como precio de lista (no se afirma
que sea contado). Los productos «Consultar» (precio simbólico $1) se descartan; «Encargar» = a pedido (stock sin confirmar).
"""
import re
from .common import get, product, canon_category

STORE = "WIZ TECH"
BASE = "https://wiztech.com.ar"
API = BASE + "/backend/Controller/ProductosController.php?action=getProductosForCatalogo&param=0"
_CAT = {"auricular": "auriculares", "mouse": "mouses", "teclado": "teclados", "placa de video": "placas-de-video",
        "placa madre": "motherboards", "procesador": "procesadores", "ram": "memorias-ram", "ssd": "almacenamiento",
        "fuente": "fuentes", "gabinete": "gabinetes", "monitor": "monitores", "cooler fan": "refrigeracion",
        "refrigeracion liquida": "refrigeracion", "refrigeracion por aire": "refrigeracion",
        "mousepad": "perifericos", "microfono": "perifericos", "parlante": "perifericos"}


def parse(data):
    rows = data.get("Result") if isinstance(data, dict) else None
    out = []
    for r in rows or []:
        if r.get("Consultar") or not r.get("HabilitadoWeb", 1):
            continue
        try:
            price = float(r.get("Precio") or 0)
            offer = float(r.get("PrecioOferta") or 0)
        except (TypeError, ValueError):
            continue
        if offer and offer < price:                    # oferta publicada por la tienda
            price = offer
        if price < 100:                                # precios simbólicos
            continue
        comp = (r.get("Componente") or "").strip()
        cat = _CAT.get(comp.lower())
        if cat is None:
            if re.search(r"celular|apple|on demand", comp, re.I):
                continue                                # no es hardware de PC
            cat = canon_category(comp)
        name = re.sub(r"\s+", " ", f"{comp} {r.get('Marca') or ''} {r.get('Modelo') or ''}").strip()
        stock = None if r.get("Encargar") else (int(r.get("Cantidad") or 0) > 0)
        url = BASE + "/" + str(r.get("ProductUrl") or "catalogo").lstrip("/")
        img = r.get("ImgSrc")
        p = product(STORE, name, url, None, price, stock=stock, image=(BASE + "/" + img.lstrip("/")) if img else None,
                    category=cat)
        p["store_sku"] = r.get("Codigo") or None
        out.append(p)
    return out


def scrape():
    return parse(get(API, as_json=True))
