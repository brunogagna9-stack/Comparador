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
- `actualizar.html` – ¿Qué actualizar?: escribís tus componentes y el rendimiento que querés; te dice qué cambiar primero, con precios reales del comparador.
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

## Actualización 5 (diseño y mejoras)
- Se eliminó la página "Tiendas": las tiendas se ven en el filtro lateral de Precios (con cantidad de productos y ⚠ si su último dato falló) y su reputación verificada aparece dentro del detalle de cada producto.
- Nuevo diseño: encabezado fijo translúcido, portada con resumen, tarjetas con efecto, botones con degradé y modo de movimiento reducido.
- **Mi lista de compra**: botón "+ Lista" en cada producto; calcula el total comprando lo más barato y el total en una sola tienda; se guarda solo en el navegador; se puede copiar.
- Indicadores de "dato viejo" (la tienda falló en la última actualización) y "precio inusual" (cambio de -50% o +100%).
- Botón "Copiar enlace de esta comparación" en Comparar hardware.
- Se corrigió que el encabezado tapaba el botón de cerrar de la ventana de detalle.

## Actualización 6 (imágenes, limpieza y cruce de productos)
- **Imágenes:** las fotos de Compragamer pasan de miniatura (100 px) a 750 px; se descartan las imágenes genéricas de "sin foto" (Armytech); si una tienda no tiene foto se usa la de otra tienda que vende el mismo producto; si ninguna tiene, se usa `site/data/imagenes_extra.json` (fotos cargadas a mano desde páginas oficiales de fabricantes, con fuente y enlace); si tampoco hay, la tarjeta muestra el ícono de su categoría. Si una foto grande falla, se usa la miniatura.
- **Cruce de productos corregido:** antes se podían juntar productos distintos (una fuente con placas de video; mothers distintas por compartir chipset; RTX 5060 con RTX 5060 Ti). Ahora dos ofertas se juntan solo si tienen el mismo número de parte, el mismo título, o la misma marca + modelo + capacidad + variante. Es preferible NO comparar a comparar mal.
- Los productos usados / outlet / open box nunca se mezclan con los nuevos.
- Si los precios de un mismo producto difieren 3 veces o más, la tarjeta muestra "precios muy distintos" y se excluye del orden "Mayor diferencia entre tiendas".
- Se ocultan servicios ("Actualización de Bios") y productos que no son hardware (robots, fundas, toners, televisores). Se limpian palabras repetidas en los títulos.
- Un salto de precio sospechoso ya no cuenta en "Bajaron / Subieron de precio".
- Nuevo orden "Más relevante" (categorías principales, comparado en más tiendas, con stock, con foto).
- Celular: encabezado compacto y sin quedar fijo (de 241 px a 144 px), portada baja, menú y pestañas en una sola fila, tarjetas más bajas. Los filtros se pliegan por sección.

## Actualización 7 (4 tiendas nuevas y avisos)
**Tiendas nuevas:** Katech (API de WooCommerce), Venex, Gaming City y NET Gaming (listados HTML). NET Gaming pide en su robots.txt esperar 5 segundos entre pedidos y así se hace, por eso la actualización completa tarda más (el trabajo tiene un límite de 120 minutos). Descartadas: Gamer Factory (API privada con detección de bots). Sin verificar: Maldito Hard y Megatek.
Su reputación quedó vacía a propósito hasta tener una fuente concreta (puntaje, cantidad, enlace y fecha).

**Avisos de bajas de precio (mail y WhatsApp)** — queda desactivado hasta que completes estos pasos:
1. *Mail (gratis, hasta 300 por día):* creá una cuenta en brevo.com → Contactos → creá una lista → Formularios de suscripción → creá un formulario (con confirmación por mail) y copiá el enlace de la página del formulario. Pegalo en `site/data/config.json`, en `"email_form_url"`, entre comillas. Con eso aparece el botón «🔔 Avisos» en la web.
2. *Envío automático semanal:* en Brevo → tu nombre → SMTP y API → Claves API → creá una clave. En GitHub (repositorio → Settings → Secrets and variables → Actions → New repository secret) cargá: `BREVO_API_KEY` (la clave), `BREVO_LIST_ID` (el número de tu lista) y `BREVO_SENDER_EMAIL` (el mail remitente, verificado en Brevo). Cada viernes el sistema arma el resumen y lo deja como BORRADOR en Brevo para que lo revises y lo envíes. Cuando confíes, en Settings → Variables creá `BREVO_ENVIAR_YA` = `1` y se enviará solo.
3. *WhatsApp:* WhatsApp no permite enviar mensajes automáticos gratis. La opción gratuita es un Canal: creá un canal desde la app de WhatsApp, copiá su enlace de invitación y pegalo en `"whatsapp_channel_url"`. Cada viernes el sistema deja el texto listo en la pestaña «Actions» → «Resumen semanal de bajas» (resumen del trabajo), y lo pegás en el canal.
- Nunca pegues claves dentro del código o de config.json: el repositorio es público. Las claves van solo como secretos de GitHub.
- Solo se incluyen bajas confiables (sin saltos sospechosos, sin productos sin stock ni con precios muy distintos entre tiendas).
- Probalo antes: en GitHub → Actions → «Resumen semanal de bajas» → Run workflow.

## Actualización 8: Armado de PC completo y «¿Qué actualizar?»

**Qué se arregló en «Armado de PC»**
- Antes, 8 de 19 procesadores no tenían puntaje y no daban sugerencias, y faltaban modelos muy comunes (como el Ryzen 7 5800X). Ahora hay 40 procesadores y **todos** dan sugerencias, salvo el Core i3-12100F (no encontramos ninguna fuente con su rendimiento y no inventamos un número).
- Se corrigió además un error de lectura: los productos con «Sin Cooler» en el título (muy comunes en las tiendas) no se asociaban al procesador.
- Se agregaron 7 placas de video AMD Radeon RX 6000 (6600 XT a 6950 XT).
- **Puntajes estimados:** Tom's Hardware no mide algunos procesadores (5800X, 5600X, 5800X3D, 5500, 7600, 9700X, 12400F, 13400F…). Para esos usamos un puntaje **estimado**, calculado con comparaciones publicadas por TechSpot. En la pantalla aparece la etiqueta «Estimado», cómo se calculó y qué tan confiable es (alta / media / baja). Todo está en `make_hardware.py` (diccionario `EST`). **Nunca se recomienda comprar un procesador por un puntaje estimado** en «Armado de PC».
- Si encontrás una fuente mejor para alguno, cambiás el número en `make_hardware.py`, ejecutás `python make_hardware.py` y listo.

**Nueva página «¿Qué actualizar?»** (`actualizar.html`)
- Escribís tus componentes (por ejemplo: «Ryzen 7 5800X, RTX 3070, 16 GB DDR4, 650 W, B550»), elegís resolución y objetivo de FPS (y, si querés, presupuesto).
- Te dice qué te limita (placa de video o procesador), qué cambiar primero, si tu fuente alcanza, si conviene sumar RAM o un SSD, y qué productos reales del comparador sirven (con precio y tienda).
- Lo que no reconoce (por ejemplo una GTX 1060 o un Ryzen 5 3600, que no están en las tablas de rendimiento que usamos) lo dice claramente; no inventa números.

## Actualización 9: 6 tiendas nuevas y placas de video anteriores

**Tiendas nuevas** (todas WooCommerce, leídas por la API pública de catálogo que usa su propio sitio; antes de agregarlas se revisó el robots.txt de cada una): Hardloots, BitHard, Try, SCP Hardstore, Click Gaming y The Gamer Shop. Ahora son 18 tiendas. La reputación de las nuevas queda vacía hasta tener una fuente verificable. Se agregan en `scrapers/woo.py` (diccionario `WOO_STORES`): sumar otra tienda WooCommerce es una línea.

**Tiendas revisadas que NO se agregaron (y por qué)**
- *Store GS* (storegs.ar): su robots.txt pide 60 segundos entre pedidos y 6 páginas por hora; con eso es imposible leer un catálogo sin ignorarlo.
- *Gears Store*: su catálogo vive en Libre Opción, cuyo robots.txt prohíbe la paginación (`?page=`).
- *Noxie Store* y *Rocket Hard*: no respondieron a la lectura de su catálogo público; no se insistió.
- *ShopGamer* (Tiendanube) y *HydraXtreme* (otra tecnología): se podrían agregar con lectores de HTML propios; quedan para una próxima etapa.
- No encontramos ninguna tienda llamada «BitBayres». Si querés otra, pasame la dirección web.
- Un dato útil: hay tiendas que se pueden sumar si les pedís permiso por escrito (Store GS, Gears Store).

**Placas de video anteriores** (RTX 20, GTX 16/10, RX 5000, RX 590/580/570, Vega): 27 modelos nuevos en «Armado de PC», «¿Qué actualizar?» y «Encontrá tu equipo». Tom's Hardware no las mide en su tabla actual, así que su rendimiento es **estimado**: se escala su tabla heredada de 2022 con la RTX 3060 como ancla (control: da 2 % de diferencia con la RTX 3050 y reproduce la diferencia de 13 % entre RX 5700 XT y RTX 2060 Super medida por TechSpot). Se marcan como «Estimado» y no se recomiendan como compra, solo sirven para evaluar la placa que ya tenés.

**Error corregido:** los monitores con «HDMI» en el título se clasificaban como accesorios. Los nombres con símbolos HTML (por ejemplo «&#8211;») ahora se muestran bien.
