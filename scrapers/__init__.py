from . import compragamer, mexx, maximus, gezatek, fullh4rd, logg, goldentech, armytech, katech, venex, gamingcity, netgaming

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
    # Mercado Libre: no se recolecta por scraping (ver README, requiere programa de afiliados / API oficial)
}
