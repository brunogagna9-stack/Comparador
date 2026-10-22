from . import compragamer, mexx, maximus, gezatek, fullh4rd, logg

SCRAPERS = {
    "Compragamer": compragamer.scrape,
    "MEXX": mexx.scrape,
    "Maximus": maximus.scrape,
    "Gezatek": gezatek.scrape,
    "Fullh4rd": fullh4rd.scrape,
    "Logg": logg.scrape,
    # Mercado Libre: no se recolecta por scraping (ver README, requiere programa de afiliados / API oficial)
}
