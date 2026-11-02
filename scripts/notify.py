"""Avisos por mail a las personas con cuenta (actualización 32).

Corre en GitHub Actions después de leer los precios. Compara el precio actual de cada producto seguido con el último
precio con el que se comparó, y manda UN mail por persona con el resumen (por Brevo).

  python scripts/notify.py            corre de verdad (si faltan los secretos, no hace nada y lo dice)
  python scripts/notify.py --prueba   muestra qué mandaría, sin enviar nada ni modificar la base

Secretos de GitHub (NUNCA en el código ni en config.json):
  SUPABASE_URL, SUPABASE_SECRET_KEY (sb_secret_...), BREVO_API_KEY, NOTIFY_FROM (remitente verificado en Brevo)
Opcionales: NOTIFY_FROM_NAME, SITE_URL, NOTIFY_MAX (mails por corrida; por defecto 50 → 200 por día con 4 corridas,
debajo del límite gratuito de Brevo de 300 por día, que también usan los mails de confirmación de cuenta).

Qué se avisa (según lo que elige cada persona en «Mi cuenta»):
  - baja de precio de 2 % o más · suba de 2 % o más · aparece en cuotas sin interés.
  «Cuotas sin interés» sale SOLO de lo que publica cada tienda (texto de la oferta o la configuración verificada de la tienda);
  no se inventan promociones bancarias.
Se excluyen precios marcados como sospechosos (anom) y productos sin stock: no se manda un aviso dudoso.
"""
import html as _html
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THRESHOLD = 0.02
CSI = re.compile(r"sin\s+inter[eé]s", re.I)


def ars(n):
    return "$" + f"{round(n):,}".replace(",", ".")


def current(group, stores_cfg):
    """→ (mejor precio con stock, oferta, hay_cuotas_sin_interés) o None si no hay un precio confiable."""
    offers = [o for o in group.get("offers", []) if o.get("stock") is not False and not o.get("anom")
              and (o.get("price_cash") or o.get("price_list"))]
    if not offers:
        return None
    price = lambda o: o.get("price_cash") or o.get("price_list")
    best = min(offers, key=price)
    def csi(o):
        if o.get("cuotas") and CSI.search(str(o["cuotas"])):
            return True
        c = (stores_cfg.get(o.get("store")) or {}).get("cuotas") or {}
        return bool(c.get("sin_interes") and c.get("n", 0) > 1 and o.get("price_list"))
    csi_offers = [o for o in offers if csi(o)]
    return price(best), best, (min(csi_offers, key=price) if csi_offers else None)


def evaluate(rows, products, stores_cfg):
    """rows: salida de notify_targets(). → (por_mail {email: [cambios]}, actualizaciones [(user_id, product_id, last_price, last_cuotas)])."""
    by_id = {g["id"]: g for g in products}
    mails, updates = {}, []
    for r in rows:
        g = by_id.get(r["product_id"])
        if not g:
            continue
        cur = current(g, stores_cfg)
        if not cur:
            continue
        price, best, csi_offer = cur
        ref = r.get("last_price") if r.get("last_price") is not None else r.get("price_ref")
        changes = []
        new_last = ref
        if ref:
            d = (price - ref) / ref
            if abs(d) >= THRESHOLD:
                new_last = price                 # solo se mueve la referencia con un cambio real (así se suman las bajas lentas)
                if d < 0 and r.get("notify_down"):
                    changes.append({"type": "baja", "pct": d * 100})
                elif d > 0 and r.get("notify_up"):
                    changes.append({"type": "suba", "pct": d * 100})
        else:
            new_last = price
        has_csi = csi_offer is not None
        if has_csi and r.get("last_cuotas") is False and r.get("notify_cuotas"):
            changes.append({"type": "cuotas", "store": csi_offer.get("store"), "text": csi_offer.get("cuotas") or "cuotas sin interés"})
        if new_last != r.get("last_price") or has_csi != r.get("last_cuotas"):
            updates.append((r["user_id"], r["product_id"], new_last, has_csi))
        if changes:
            mails.setdefault(r["email"], {"user_id": r["user_id"], "items": []})["items"].append({
                "id": g["id"], "name": g.get("name") or r.get("name") or g["id"], "price": price, "ref": ref,
                "store": best.get("store"), "url": best.get("url"), "changes": changes})
    return mails, updates


def render(items, site):
    downs = sum(1 for i in items for c in i["changes"] if c["type"] == "baja")
    subject = (f"Bajó de precio: {items[0]['name'][:60]}" if len(items) == 1 and downs
               else f"ComparáTech: novedades en {len(items)} producto{'s' if len(items) != 1 else ''} que seguís")
    li = []
    for i in items:
        bits = []
        for c in i["changes"]:
            if c["type"] == "baja":
                bits.append(f"<span style='color:#0b6b4a'>▼ bajó {abs(c['pct']):.0f}%</span> (antes {ars(i['ref'])})")
            elif c["type"] == "suba":
                bits.append(f"<span style='color:#b42318'>▲ subió {c['pct']:.0f}%</span> (antes {ars(i['ref'])})")
            else:
                bits.append(f"💳 en {_html.escape(str(c.get('store') or 'una tienda'))}: {_html.escape(str(c['text']))}")
        link = site + "producto.html?id=" + urllib.request.quote(i["id"])
        li.append(f"<li style='margin:0 0 14px'><b><a href='{_html.escape(link)}'>{_html.escape(i['name'])}</a></b><br>"
                  f"Ahora {ars(i['price'])} en {_html.escape(str(i['store']))} · " + " · ".join(bits) + "</li>")
    body = (f"<div style='font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#111'>"
            f"<h2 style='margin:0 0 6px'>Novedades de precios</h2>"
            f"<p style='color:#555'>Cambios en productos que seguís en ComparáTech.</p>"
            f"<ul style='padding-left:18px'>{''.join(li)}</ul>"
            f"<p style='color:#777;font-size:12px'>Los precios y el stock se leen de cada tienda y pueden cambiar: confirmalos antes de comprar. "
            f"Las cuotas son las que publica la tienda; pueden depender del banco o de la tarjeta.</p>"
            f"<p style='color:#777;font-size:12px'>Recibís este mail porque seguís estos productos con tu cuenta. "
            f"<a href='{_html.escape(site)}cuenta.html#avisos'>Cambiar o apagar los avisos</a>.</p></div>")
    return subject, body


def http(method, url, headers, payload=None, timeout=40):
    req = urllib.request.Request(url, method=method, headers=headers,
                                 data=json.dumps(payload).encode() if payload is not None else None)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return json.loads(raw) if raw else None


def main(argv=sys.argv[1:], env=os.environ, call=http, products=None, cfg=None):
    dry = "--prueba" in argv
    url = (env.get("SUPABASE_URL") or "").rstrip("/")
    key, brevo, sender = env.get("SUPABASE_SECRET_KEY"), env.get("BREVO_API_KEY"), env.get("NOTIFY_FROM")
    missing = [n for n, v in (("SUPABASE_URL", url), ("SUPABASE_SECRET_KEY", key)) if not v]
    if not dry:
        missing += [n for n, v in (("BREVO_API_KEY", brevo), ("NOTIFY_FROM", sender)) if not v]
    if missing:
        print("Avisos por mail: no configurados (faltan " + ", ".join(missing) + "). No se envía nada.")
        return 0
    if not re.match(r"^https://[a-z0-9-]+\.supabase\.co$", url):
        print("Avisos por mail: SUPABASE_URL no parece una dirección de Supabase. No se envía nada.")
        return 0
    site = env.get("SITE_URL") or "https://brunogagna9-stack.github.io/Comparador/"
    site = site if site.endswith("/") else site + "/"
    cap = int(env.get("NOTIFY_MAX") or 50)
    sbh = {"apikey": key, "Authorization": "Bearer " + key, "content-type": "application/json", "accept": "application/json"}
    data = ROOT / "site" / "data"
    if products is None:
        products = json.loads((data / "products.json").read_text(encoding="utf-8"))
    if cfg is None:
        cfg = json.loads((data / "config.json").read_text(encoding="utf-8"))
    hidden = {n for n, s in (cfg.get("stores") or {}).items() if (s or {}).get("ocultar")}
    for g in products:
        g["offers"] = [o for o in g.get("offers", []) if o.get("store") not in hidden]
    rows = call("POST", url + "/rest/v1/rpc/notify_targets", sbh, {}) or []
    mails, updates = evaluate(rows, products, cfg.get("stores") or {})
    print(f"Avisos por mail: {len(rows)} seguimientos, {len(mails)} personas con novedades, {len(updates)} referencias para actualizar.")
    sent, failed, sent_users = 0, 0, set()
    for email, m in list(mails.items()):
        if sent >= cap:
            print(f"  Tope de {cap} mails por corrida: el resto se avisa en la próxima.")
            break
        subject, body = render(m["items"], site)
        if dry:
            print(f"  [prueba] {email}: {subject}")
            sent += 1
            continue
        try:
            call("POST", "https://api.brevo.com/v3/smtp/email", {"api-key": brevo, "content-type": "application/json", "accept": "application/json"},
                 {"sender": {"name": env.get("NOTIFY_FROM_NAME") or "ComparáTech", "email": sender}, "to": [{"email": email}],
                  "subject": subject, "htmlContent": body, "tags": ["avisos-precio"]})
            sent += 1
            sent_users.add(m["user_id"])
            try:
                call("POST", url + "/rest/v1/notifications_log", dict(sbh, Prefer="return=minimal"),
                     {"user_id": m["user_id"], "items": [{"id": i["id"], "changes": i["changes"]} for i in m["items"]]})
            except Exception as e:
                print("  (no se pudo anotar el envío en el registro: " + str(e)[:120] + ")")
        except urllib.error.HTTPError as e:
            failed += 1
            print(f"  Brevo rechazó un envío (HTTP {e.code}).")
            if e.code in (401, 403):
                print("  La clave de Brevo o el remitente no son válidos: se cancela el resto.")
                break
        except Exception as e:
            failed += 1
            print("  Error al enviar: " + str(e)[:160])
    # Se actualizan las referencias. A quien le correspondía un mail que no se pudo mandar (tope o error) NO se le
    # actualiza: así recibe el aviso en la próxima corrida.
    pending = {m["user_id"] for m in mails.values()} - sent_users
    upd = [u for u in updates if u[0] not in pending]
    if not dry:
        for uid, pid, last, csi in upd:
            q = f"{url}/rest/v1/follows?user_id=eq.{urllib.request.quote(uid)}&product_id=eq.{urllib.request.quote(pid, safe='')}"
            try:
                call("PATCH", q, dict(sbh, Prefer="return=minimal"), {"last_price": last, "last_cuotas": csi})
            except Exception as e:
                print("  No se pudo actualizar una referencia: " + str(e)[:120])
    print(f"Avisos por mail: {sent} {'simulados' if dry else 'enviados'}, {failed} con error, {len(upd)} referencias {'(sin guardar: prueba)' if dry else 'actualizadas'}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
