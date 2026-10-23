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

## Secciones del sitio (actualización 3)
- `armado.html` – Armado de PC. Los componentes iguales en "mínimo" y "sugerido" se muestran una sola vez, y cada configuración tiene su propio total.
- `encontra.html` – Encontrá tu equipo: cuestionario guiado → PC armadas, PC por componentes o notebooks reales del catálogo.
- `comparar.html` – Comparar hardware: tabla, gráficos, ventajas y ganador justificado.
- `site/js/lib.js`, `compare.js`, `finder.js` – lógica compartida. Se prueba con `node tests/test_js.js` (también corre dentro de `python tests/run_tests.py`).
- Etiquetas de datos: **Verificado** (ficha oficial), **Benchmark** (medición independiente), **Estimado** (calculado), **Pendiente de verificar** (del título de la tienda o aún sin comprobar), **Sin datos**.
- Para actualizar especificaciones de placas/procesadores: editá `make_hardware.py` (tablas GS y CS, y VERIFIED) y corré `python make_hardware.py`.


## Actualización 4: fichas de notebooks, tiendas nuevas y asistente

**Por qué el buscador decía "sin datos" de peso y batería.** El lector de Compragamer solo leía el listado de productos, que no trae especificaciones. Compragamer sí publica peso, medidas, pantalla y RAM ampliable en otro archivo público (`productos_caracteristicas`), que ahora se lee (`scrapers/specs.py`). Ninguna tienda conectada publica la **capacidad de batería (Wh)**: ese dato queda como "Sin datos" y no se reemplaza por la autonomía de marketing. MEXX protege las fichas con Cloudflare y Maximus no publica características: no se intenta saltear nada.

- `site/data/specs.json`: fichas por SKU exacto (valor, unidad, tienda, URL, fecha, nivel, nota). Caché de 24 h en `raw/specs_Compragamer.json`; si la fuente falla se conserva lo último y se avisa.
- Si el título de la tienda y su ficha se contradicen (ej. Ryzen 7535HS vs 7335HS) el dato baja a "Pendiente de verificar".
- `site/data/stores.json`: información verificada de cada tienda y reputación (puntaje, cantidad, fuente, enlace, fecha). Se edita a mano; no promediar plataformas ni inventar datos.
- Tiendas nuevas: **GoldenTech** (API pública de WooCommerce) y **Armytech** (listados paginados; su robots.txt prohíbe filtros y orden, no se usan). Su stock: GoldenTech lo informa; Armytech no (queda "sin confirmar").
- Asistente (`site/js/assistant.js`, botón flotante en todas las secciones): motor local con reglas y datos del catálogo, sin IA generativa y sin enviar datos. IA opcional: ver `worker/assistant-proxy.js` (la clave va como secreto del Worker, nunca en el sitio) y poner su URL en `site/data/config.json` → `assistant.endpoint`. Por defecto está desactivada.
- Pruebas: `python tests/run_tests.py` (incluye JavaScript, asistente y proxy; requiere Node).
