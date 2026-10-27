from . import compragamer, mexx, maximus, gezatek, fullh4rd, logg, goldentech, armytech, katech, venex, gamingcity, netgaming, woo, woohtml, tiendanube, cardeco, wiztech, xtpc, compufan

SCRAPERS = {
    "Compragamer": compragamer.scrape,
    "MEXX": mexx.scrape,
    "Maximus": maximus.scrape,
    "Gezatek": gezatek.scrape,
    "Fullh4rd": fullh4rd.scrape,
    "Logg": logg.scrape,
    "GoldenTech": goldentech.scrape,
    "Armytech": armytech.scrape,
    "Katech": katech.scrape,
    "Venex": venex.scrape,
    "Gaming City": gamingcity.scrape,
    "NET Gaming": netgaming.scrape,
    **{name: woo.make(name) for name in woo.WOO_STORES},   # tiendas WooCommerce por su API (ver scrapers/woo.py)
    **{name: woohtml.make(name) for name in woohtml.HTML_STORES},   # WooCommerce con la API prohibida en robots.txt
    **{name: tiendanube.make(name) for name in tiendanube.TN_STORES},
    **{name: cardeco.make(name) for name in cardeco.CE_STORES},
    "WIZ TECH": wiztech.scrape,
    "XT-PC": xtpc.scrape,
    "Compufan Store": compufan.scrape,
    # Mercado Libre: no se recolecta por scraping (ver README, requiere programa de afiliados / API oficial)
}
