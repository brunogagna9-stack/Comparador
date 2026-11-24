"""Mercado Libre por su API oficial (etapa 4, actualización 47). TODAVÍA NO ESTÁ CONECTADO AL COMPARADOR.

Credenciales: solo como secretos de GitHub (ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REFRESH_TOKEN). Nunca en archivos,
nunca en la web. Si falta alguna, el lector no hace ninguna consulta y devuelve una lista vacía con el motivo.

Flujo (documentación oficial de developers.mercadolibre.com.ar):
  1. POST /oauth/token con grant_type=refresh_token -> access_token (vale unas horas) y un refresh_token NUEVO.
     Mercado Libre invalida el refresh_token anterior al usarlo: el nuevo se informa en `nuevo_refresh` para que el
     flujo de GitHub lo guarde como secreto (ver docs/auditorias/47-4-mercadolibre.md).
  2. GET /products/search?site_id=MLA&status=active&q=<modelo>: productos de catálogo que coinciden con un modelo.
  3. GET /products/<id>/items: publicaciones que venden ese producto de catálogo; se toma la más barata nueva.
Solo se consultan los modelos que el comparador ya tiene (no se recorre Mercado Libre entero), con pausa entre pedidos.
"""
import os
import time
from .common import session

API = "https://api.mercadolibre.com"
PAUSA = 0.5            # segundos entre pedidos: muy por debajo de los límites publicados
MAX_MODELOS = 300      # tope por corrida


def credenciales(env=None):
    env = os.environ if env is None else env
    faltan = [k for k in ("ML_CLIENT_ID", "ML_CLIENT_SECRET", "ML_REFRESH_TOKEN") if not env.get(k)]
    return (None, faltan) if faltan else ({k: env[k] for k in ("ML_CLIENT_ID", "ML_CLIENT_SECRET", "ML_REFRESH_TOKEN")}, [])


def token(cred, http=None):
    http = http or session()
    r = http.post(API + "/oauth/token", data={"grant_type": "refresh_token", "client_id": cred["ML_CLIENT_ID"],
                                              "client_secret": cred["ML_CLIENT_SECRET"],
                                              "refresh_token": cred["ML_REFRESH_TOKEN"]}, timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"Mercado Libre no entregó el token (HTTP {r.status_code})")   # sin mostrar la respuesta
    d = r.json()
    return d["access_token"], d.get("refresh_token")


def mejor_publicacion(items):
    """La publicación nueva más barata con precio en pesos, o None."""
    ok = [i for i in items if i.get("currency_id") == "ARS" and i.get("price") and i.get("condition", "new") == "new"]
    return min(ok, key=lambda i: i["price"]) if ok else None


def leer(modelos, env=None, http=None, dormir=time.sleep):
    """modelos: lista de textos de búsqueda (p. ej. «Ryzen 5 7600»). Devuelve {"productos": [...], "motivo": str|None,
    "nuevo_refresh": str|None}. Nunca lanza por falta de credenciales."""
    cred, faltan = credenciales(env)
    if not cred:
        return {"productos": [], "motivo": "faltan secretos: " + ", ".join(faltan), "nuevo_refresh": None}
    http = http or session()
    acc, nuevo = token(cred, http)
    h = {"Authorization": "Bearer " + acc}
    out = []
    for q in modelos[:MAX_MODELOS]:
        r = http.get(API + "/products/search", params={"site_id": "MLA", "status": "active", "q": q, "limit": 1},
                     headers=h, timeout=30)
        dormir(PAUSA)
        if r.status_code in (401, 403, 429):
            return {"productos": out, "motivo": f"Mercado Libre respondió HTTP {r.status_code}; se cortó la lectura",
                    "nuevo_refresh": nuevo}
        res = ((r.json() or {}).get("results") or []) if r.status_code == 200 else []
        if not res:
            continue
        pid, nombre = res[0]["id"], res[0].get("name") or q
        r = http.get(f"{API}/products/{pid}/items", headers=h, timeout=30)
        dormir(PAUSA)
        if r.status_code != 200:
            continue
        best = mejor_publicacion((r.json() or {}).get("results") or [])
        if best:
            out.append({"store": "Mercado Libre", "name": nombre, "query": q, "catalog_id": pid,
                        "item_id": best.get("item_id") or best.get("id"), "price_list": float(best["price"]),
                        "url": f"https://www.mercadolibre.com.ar/p/{pid}"})
    return {"productos": out, "motivo": None, "nuevo_refresh": nuevo}
