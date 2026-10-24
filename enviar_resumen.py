"""Resumen semanal de bajas de precio: lo arma desde site/data/products.json y lo entrega por mail y/o como texto
para pegar en un canal de WhatsApp.

  python scripts/enviar_resumen.py            vista previa (no envía nada): escribe resumen.txt y resumen.html
  python scripts/enviar_resumen.py --enviar   además crea la campaña en Brevo (queda como BORRADOR para que la revises)
  BREVO_ENVIAR_YA=1 ... --enviar              y la envía de inmediato

Variables (secretos de GitHub, nunca en el código): BREVO_API_KEY, BREVO_LIST_ID, BREVO_SENDER_EMAIL, [BREVO_SENDER_NAME]
Solo se incluyen bajas confiables: se excluyen los saltos sospechosos, los productos con precios muy distintos entre
tiendas y los que figuran sin stock. No se agrega nada que no esté en los datos publicados.
"""
import html as _html
import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_URL = os.environ.get("SITE_URL", "https://brunogagna9-stack.github.io/Comparador/")
MIN_DROP = 5.0   # solo bajas de al menos 5 %


def ars(n):
    return "$" + f"{round(n):,}".replace(",", ".")


def top_drops(groups, n=10):
    rows = []
    for g in groups:
        o = g["offers"][0]
        c = g.get("chg")
        if not c or c["pct"] > -MIN_DROP or o.get("anom") or g.get("dif") or o.get("stock") is False:
            continue
        price = o.get("price_cash") or o.get("price_list")
        rows.append({"name": g["name"], "store": o["store"], "price": price, "prev": c["prev"], "pct": c["pct"],
                     "url": o["url"], "stores": len(g["offers"])})
    rows.sort(key=lambda r: r["pct"])
    return rows[:n]


def render(rows, today):
    """-> (asunto, html, texto). Si no hay bajas confiables devuelve None."""
    if not rows:
        return None
    subject = f"ComparáTech: {len(rows)} productos bajaron de precio"
    text = [f"📉 Bajas de precio — {today}", ""]
    li = []
    for r in rows:
        text.append(f"• {r['name']}\n  {ars(r['price'])} (antes {ars(r['prev'])}, {abs(r['pct']):.0f}% menos) en {r['store']}\n  {r['url']}")
        li.append(f"<li style='margin:0 0 12px'><b>{_html.escape(r['name'])}</b><br>{ars(r['price'])} "
                  f"<span style='color:#777;text-decoration:line-through'>{ars(r['prev'])}</span> "
                  f"<span style='color:#0b6b4a'>▼ {abs(r['pct']):.0f}%</span> en {_html.escape(r['store'])} · "
                  f"<a href='{_html.escape(r['url'])}'>ver en la tienda</a></li>")
    text += ["", f"Todos los precios y comparaciones: {SITE_URL}",
             "Los precios pueden cambiar o agotarse: confirmalos en la tienda antes de comprar."]
    body = (f"<div style='font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto'>"
            f"<h2>📉 Bajas de precio</h2><p style='color:#555'>Las mayores bajas confirmadas en los últimos días ({today}).</p>"
            f"<ul style='padding-left:18px'>{''.join(li)}</ul>"
            f"<p><a href='{SITE_URL}'>Ver todos los precios en ComparáTech</a></p>"
            f"<p style='color:#777;font-size:12px'>Los precios pueden cambiar o agotarse: confirmalos en la tienda antes de comprar. "
            f"Este mail no incluye envío ni garantías de las tiendas.</p></div>")
    return subject, body, "\n".join(text)


def brevo(path, payload, key, method="POST"):
    req = urllib.request.Request("https://api.brevo.com/v3" + path, method=method,
                                 data=json.dumps(payload).encode() if payload is not None else None,
                                 headers={"api-key": key, "content-type": "application/json", "accept": "application/json"})
    with urllib.request.urlopen(req, timeout=40) as r:
        raw = r.read()
        return json.loads(raw) if raw else {}


def crear_campana(subject, html, today, env=os.environ, call=brevo):
    key, lst, sender = env.get("BREVO_API_KEY"), env.get("BREVO_LIST_ID"), env.get("BREVO_SENDER_EMAIL")
    if not (key and lst and sender):
        return None
    res = call("/emailCampaigns", {
        "name": f"Bajas de precio {today}", "subject": subject, "htmlContent": html,
        "sender": {"email": sender, "name": env.get("BREVO_SENDER_NAME", "ComparáTech")},
        "recipients": {"listIds": [int(lst)]}}, key)
    cid = res.get("id")
    if cid and env.get("BREVO_ENVIAR_YA") == "1":
        call(f"/emailCampaigns/{cid}/sendNow", None, key)
        return {"id": cid, "estado": "enviada"}
    return {"id": cid, "estado": "borrador"}


def main(argv):
    import datetime as dt
    groups = json.loads((ROOT / "site" / "data" / "products.json").read_text())
    today = dt.date.today().isoformat()
    out = render(top_drops(groups), today)
    if not out:
        print("No hay bajas confiables para informar: no se genera resumen.")
        return 0
    subject, html, text = out
    (ROOT / "resumen.txt").write_text(text, encoding="utf-8")
    (ROOT / "resumen.html").write_text(html, encoding="utf-8")
    print(subject)
    print(text)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        Path(summary).write_text("### Texto para el canal de WhatsApp\n\n```\n" + text + "\n```\n", encoding="utf-8")
    if "--enviar" in argv:
        res = crear_campana(subject, html, today)
        print("Brevo:", res if res else "faltan los secretos de Brevo: no se creó la campaña")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
