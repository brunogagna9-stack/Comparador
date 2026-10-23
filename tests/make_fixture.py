"""Genera tests/fixtures/catalog.json: un catálogo SINTÉTICO (precios inventados, nombres con el formato real
de las tiendas) solo para pruebas automáticas. No se publica ni se usa en el sitio."""
import json, hashlib
items = []
def add(cat, name, price, store="Compragamer", stock=True, store2=None, price2=None):
    k = hashlib.md5(name.encode()).hexdigest()[:10]
    offers = [dict(store=store, url=f"https://ejemplo.invalid/{store}/{k}", price_cash=price, price_list=price * 1.1, stock=stock, k=k)]
    if store2: offers.append(dict(store=store2, url=f"https://ejemplo.invalid/{store2}/{k}", price_cash=price2, price_list=price2, stock=True, k=k + "b"))
    items.append(dict(id=k, name=name, category=cat, brand=None, image=None, offers=sorted(offers, key=lambda o: o["price_cash"])))
G = "placas-de-video"
for n, p in [("Placa de Video Msi Nvidia Geforce RTX 5070 TI Ventus 3X 16GB OC GDDR7", 2322350), ("Placa De Video GeForce RTX 5070Ti 16Gb Gigabyte Eagle Oc SFF Ice", 2652239),
             ("Placa de Video ASUS GeForce RTX 5060 8GB DUAL OC", 790000), ("Placa de Video Gigabyte GeForce RTX 5060 Ti 16GB WINDFORCE", 1010000),
             ("Placa de Video MSI GeForce RTX 4060 8GB VENTUS 2X", 640000), ("Placa de Video Zotac GeForce RTX 3050 6GB", 420000), ("Placa de Video ASUS GeForce RTX 3060 12GB", 560000),
             ("Placa de Video Sapphire Radeon RX 9070 XT 16GB PULSE", 1750000), ("Placa de Video XFX Radeon RX 7600 8GB", 520000), ("Placa de Video PowerColor Radeon RX 6600 8GB", 400000),
             ("Placa de Video Gigabyte GeForce RTX 3060 8GB GDDR6", 500000),
             ("PC Powered by MSI Ultimate Intel Ultra 7 270K Plus B860 32GB RAM 1TB RTX 5070TI 850W Gold", 5581997)]:
    add(G, n, p, stock=True, store2="MEXX" if "5070 TI" in n else None, price2=p * 1.02)
C = "procesadores"
for n, p in [("Procesador Intel Core i5 14400 4.7GHz Turbo Socket 1700 Raptor Lake", 350578), ("Procesador Intel Core i5 14400F 4.7GHz Socket 1700", 280000), ("Procesador AMD Ryzen 5 9600X AM5", 380000),
             ("Procesador AMD Ryzen 7 9800X3D AM5", 800000), ("Procesador AMD Ryzen 5 5500 AM4", 113400), ("Procesador AMD Ryzen 5 5600 AM4", 150000), ("Procesador Intel Core i3 12100F Socket 1700", 120000),
             ("Procesador AMD Ryzen 5 7600 AM5", 260000), ("Procesador AMD Ryzen 7 7800X3D AM5", 640000), ("Procesador Intel Core i7 14700K Socket 1700", 560000),
             ("Procesador AMD Ryzen 5 5600GT AM4", 170000), ("Procesador Intel Core Ultra 5 245K Socket 1851", 350000), ("Procesador AMD Ryzen 7 9700X AM5", 450000), ("Procesador Intel Core i5 12400 Socket 1700", 200000)]:
    add(C, n, p)
for n, p in [("Mother Asrock H610M-HDV/M2 R2.0 DDR4 S1700", 88983), ("Mother Asrock H610M-HDV/M2+ DDR5 S1700 BULK - OUTLET", 89850), ("Mother Gigabyte A520M K V2 DDR4 AM4", 95000),
             ("Mother Asrock B550M-HDV DDR4 AM4", 110000), ("Mother Gigabyte B650M DS3H AM5", 190000), ("Mother MSI PRO B860M-A WIFI LGA1851 DDR5", 260000), ("Mother ASUS PRIME A620M-K AM5", 150000)]:
    add("motherboards", n, p)
for n, p in [("Fuente Antec 750W 80 Plus Bronze ATX 3.1 PCIe 5.1 CSK750DC AR", 77750), ("Fuente XYZ 650W 80 Plus Bronze ARGB Phantom", 62000), ("Fuente Seasonic 850W 80 Plus Gold", 190000),
             ("Fuente Evolabs Power 550W 80 Plus Silver", 55000), ("Fuente Segotep 500W ATX Cables Largos", 30000), ("Fuente Thermaltake 450W 80 Plus Bronze SMART", 45000),
             ("Fuente Corsair 1000W 80 Plus Gold ATX 3.1", 260000), ("Fuente XPG 700W 80 Plus Bronze PYLON", 70000), ("Fuente Gigabyte 600W 80 Plus Bronze", 60000), ("Fuente Antec 550W 80 Plus Bronze", 52000)]:
    add("fuentes", n, p)
for n, p in [("Memoria KingDian DDR4 16GB 2666MHz", 187550), ("Memoria Mancer DDR4 16GB 3200MHz Vant S Black CL19", 191850), ("Memoria G.Skill DDR4 32GB (2x16GB) 3200MHz RIPJAWS V CL16", 330000),
             ("Memoria Team DDR4 8GB 3200MHz T-Force Vulcan Z Grey CL16", 100000), ("Memoria Kingston DDR5 16GB (2x8GB) 5600MHz Fury Beast CL40", 230000), ("Memoria Corsair DDR5 32GB (2x16GB) 6000MHz Vengeance CL30", 420000),
             ("Memoria Kingston DDR5 32GB (2x16GB) 5600MHz CL36", 380000), ("Memoria Patriot Viper DDR4 32GB (2x16GB) 3200Mhz Steel", 340000), ("Memoria Notebook SODIMM DDR4 8GB 3200MHz", 80000)]:
    add("memorias-ram", n, p)
for n, p in [("Disco Sólido SSD M.2 Kingston 500GB NV3 5000MB/s NVMe PCI-E Gen4 x4", 70000), ("Disco Solido SSD M.2 Kingston 1TB NV3 6000MB/s NVMe PCI-E Gen4 x4", 110000), ("Disco Solido SSD M.2 WD 2TB Black SN850X 7300MB/s NVMe PCIe Gen4 x4", 300000),
             ("Disco Solido SSD Kingston 480GB A400 SATA 500MB/s", 50000), ("Disco Solido SSD M.2 ADATA 250GB Legend 700 NVMe Gen3 x4", 45000), ("Disco Rigido WD 8TB Red Plus NAS SATA 5640RPM", 300000),
             ("Disco Solido SSD Externo Portatil Kingston XS1000 1TB USB", 140000)]:
    add("almacenamiento", n, p)
for n, p in [("Monitor Gamer ASUS VY229HF-J 22\" FHD IPS 100Hz", 150000), ("Monitor Gamer AsRock Phantom PG32QF2B 31.5\" VA QHD 1440p 165Hz FreeSync", 380000), ("Monitor Gamer LG UltraGear 27\" IPS QHD 144Hz 1ms", 330000)]:
    add("monitores", n, p)
for n, p in [("Notebook Lenovo Yoga 7 2en1 14AHP9 14\" AMD Ryzen 5 8640HS 8GB DDR5 SSD 512GB Win11", 1100000), ("Notebook Gamer Acer Nitro Lite 16 16\" Intel I5 13420H 16GB DDR5 SSD 512GB RTX 4050 165Hz Win11", 1700000),
             ("Notebook Samsung Book 4 FHD 15.6\" Intel Core i5-1335U 16GB 512GB SSD NVMe W11 Silver", 1200000), ("Notebook Gamer Lenovo LOQ 15IAX9E 15.6\" Intel Core i5 12450HX 8GB DDR5 SSD 512GB RTX 3050 Win11", 1400000),
             ("Notebook Gamer Acer Nitro V 15 15.6\" AMD Ryzen 5 7535HS 8GB DDR5 SSD 512GB RTX 3050 6GB Win11", 1350000), ("Notebook HP 15 15.6\" Intel Core i3 N305 8GB SSD 256GB FreeDOS", 650000),
             ("Notebook ASUS Vivobook 16 16\" Ryzen 7 7730U 16GB SSD 1TB Win11", 1500000), ("Notebook Gamer MSI Thin 15 15.6\" Intel Core i7 13620H 16GB SSD 1TB RTX 4060 144Hz Win11", 2400000)]:
    add("notebooks", n, p)
for n, p in [("PC Gamer AMD Ryzen 5 5600GT 16GB 512GB NVME WIFI", 620000), ("PC Armada AMD Ryzen 5 5500 RTX 3050 16GB 512GB", 950000), ("PC Gamer Intel i3 14100F 16GB RAM DDR5 SSD 1TB RTX 5060 WIFI", 1500000),
             ("PC Gamer AMD Ryzen 7 9800X3D RTX 5080 16GB 32GB RAM 2TB NVMe WATER 360MM WIFI", 4200000), ("PC Gamer R7-7700X 32GB RAM SSD 1TB RX 9070 XT 16GB WIFI", 3100000), ("PC Armada AMD Ryzen 5 4500 RX 7600 16GB 512GB", 1000000),
             ("PC de oficina Intel Core i3 12100 8GB SSD 256GB", 480000), ("PC Gamer AMD Ryzen 5 9600X 32GB RAM SSD 1TB RTX 5060 Ti 16GB", 2300000)]:
    add("pcs-armadas", n, p)
for n, p in [("Gabinete ASUS A21 Mesh Vidrio Templado Black Micro ATX", 90000)]:
    add("gabinetes", n, p)
add("placas-de-video", "Placa de Video ASUS GeForce RTX 5090 32GB ASTRAL", 6000000, stock=False)
json.dump(items, open("tests/fixtures/catalog.json", "w"), ensure_ascii=False)
print(len(items), "productos de prueba")
