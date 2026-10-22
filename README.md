# Comparador
Compara hardware
[LEEME.md](https://github.com/user-attachments/files/33844711/LEEME.md)
# Comparador de tiendas — guía paso a paso (sin programar)

Todo es gratis. Necesitás una cuenta de GitHub (gratis). Eso no lo puedo crear yo por vos.

## Publicarlo (≈10 minutos)
1. Entrá a https://github.com y creá una cuenta gratis (o iniciá sesión).
2. Arriba a la derecha: **+ → New repository**. Nombre: `comparador`. Dejalo **Public** (obligatorio para Pages gratis). **Create repository**.
3. En el repositorio nuevo: **uploading an existing file** y arrastrá **todo el contenido** de la carpeta del proyecto (incluida la carpeta oculta `.github`; si no la ves, usá el ZIP y descomprimilo primero). **Commit changes**.
4. **Settings → Pages → Source: GitHub Actions**.
5. **Actions → "Actualizar precios y publicar" → Run workflow**. Tarda unos minutos.
6. Tu página queda en `https://TU-USUARIO.github.io/comparador/`. Se actualiza sola cada 6 horas.

## Qué esperar la primera vez
- Los lectores se escribieron mirando cada tienda, pero **no pude probarlos en vivo** (mi entorno no tiene acceso a esas tiendas). Es probable que alguno falle o traiga pocos datos.
- En la página, arriba, cada tienda muestra ✅ o ⚠️ con la cantidad de productos leídos. Si alguna sale ⚠️, abrí la corrida en **Actions** y pegámela acá: la ajusto.
- Las pausas entre pedidos son de 1,5 s y se frena ante bloqueos (403/429) para no molestar a las tiendas.

## Qué falta / límites conocidos
- **Mercado Libre**: no se lee con scraping. Requiere la API oficial o el programa de afiliados (gratis, pero con cuenta tuya). Queda para la etapa 2.
- **Cuotas**: cada tienda las informa distinto. Solo Maximus las muestra en el listado. Para las demás completá `site/data/config.json` (cantidad de cuotas y si son sin interés) cuando lo verifiques en cada tienda.
- **Cruce de productos**: se une por número de parte (Compragamer, Maximus, MEXX) y, si no, por modelo del nombre. Puede haber falsos cruces o productos sin cruzar.
- **Reseñas de vendedores y productos**: por ahora solo se muestra la calificación de Maximus. Reseñas propias necesitan un servicio de comentarios (opción gratis: Giscus sobre GitHub) y moderación; es la etapa 3.
- **Términos de uso**: revisá los términos de cada tienda antes de hacerlo público a gran escala; si una tienda lo pide, se la saca de `scrapers/__init__.py`.
- La página de ejemplo (datos inventados) se reemplaza por datos reales en la primera corrida.

## Estructura
- `scrapers/` un lector por tienda · `build_data.py` cruza y genera datos · `site/` la página · `.github/workflows/` la actualización automática · `tests/` pruebas.
