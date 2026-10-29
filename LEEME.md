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

## Actualización 10: fiabilidad de vendedores y de datos de componentes

**Reputación de los vendedores, junto a cada oferta.** No hay una sección aparte: en cada producto (tarjetas del catálogo, detalle de precios, lista, «Encontrá tu equipo», «Armado de PC», «¿Qué actualizar?» y comparador) el vendedor aparece con «★ puntaje · N opiniones Google» o, si no hay dato confiable, «sin reputación verificada». Todo sale de un solo componente (`site/js/rep.js`) que lee `site/data/stores.json`.
- Fuente: puntaje público de Google Maps, consultado el 24-oct-2026, **solo de fichas cuyo sitio web coincide con el de la tienda** (se descartaron fichas homónimas: «Tienda Bit», «Astrohard», «ClickCenter»). Nunca se promedian fuentes.
- Menos de 100 opiniones (hoy: BitHard 43 y Click Gaming 46): se avisa «pocas opiniones».
- Sin puntaje a propósito: **Gaming City** (Google muestra muchas sucursales y ninguna ficha única de la tienda online) y **Hardloots** (no hay ficha con su sitio). Maximus tiene dos fichas; se muestra solo la de Galería Jardín, sin sumarlas. La ficha de Try figura «cerrada temporalmente» por mudanza.
- Se sumaron dirección y teléfono verificados en la ficha y, para BitHard, Click Gaming y The Gamer Shop, lo que su sitio publica (Ley 24.240, botón de arrepentimiento, QR de AFIP). **Ninguna de esas tiendas muestra razón social ni CUIT en la página que se leyó**: no lo inventamos.
- Los puntajes cambian con el tiempo. Para actualizarlos: editar `reputation` en `stores.json` (score, count, url, date).

**Datos de componentes contra la ficha oficial** (comprobación del 24-oct-2026, número por número):
- **Procesadores: 40 de 40** contra AMD e Intel (núcleos, hilos, boost, caché L3, TDP; potencia máxima de Intel; socket y memoria de AMD). Sin diferencias.
- **Placas de video: 44 de 71** contra NVIDIA, AMD e Intel (RTX 50/40/30, RX 9000/7000/6000, Arc B580): memoria, tipo, bus, consumo (TGP) y fuente recomendada.
- **Errores encontrados y corregidos**: RTX 3080 10 GB figuraba con 350 W (oficial 320 W); RTX 4060 Ti 8 GB con 165 W (oficial 160 W); RX 9060 XT 8 GB con 160 W (oficial 150 W).
- **Sin verificar (siguen «pendiente de verificar»)**: las 27 placas anteriores (RTX 20, GTX 16/10, RX 5000, Polaris, Vega): NVIDIA y AMD ya no publican su ficha en una página legible. Tampoco están verificados el socket y la memoria de los Intel, la potencia máxima de los AMD (es un cálculo: TDP × 1,35) ni la velocidad de memoria de las NVIDIA (su ficha no la publica).
- En el comparador hay una fila nueva «Ficha oficial del fabricante» con el enlace a la página consultada y la fecha. Antes, el consumo, la fuente, la VRAM, el socket y el TDP aparecían como «verificado» por defecto aunque no lo estuvieran: ahora la etiqueta depende de lo realmente comprobado.
- `make_hardware.py`: `VERIFIED` (campos comprobados) y `VURL` (ficha de cada producto).

**Pruebas nuevas**: cada puntaje con fuente/ficha/fecha/URL; aviso de muestra chica; tiendas sin puntaje con su explicación; las correcciones de las fichas; que nada verificado carezca de enlace oficial y que lo estimado no figure como verificado.

### Arreglo: la web quedó sin productos (24-oct-2026)
**Qué pasó:** el `products.json` publicado tenía marcas de conflicto de Git (`<<<<<<< HEAD`), así que no era un JSON válido y la página mostraba 0 productos. Ocurre cuando dos corridas automáticas (o una corrida y una subida manual) tocan los datos a la vez y el paso «Guardar datos» hacía `git pull --rebase`: el conflicto dejaba el archivo roto y justo ese archivo se publicaba.
**Qué cambió:** (1) el flujo ya no usa rebase: si el repositorio avanzó, se une dejando siempre los datos recién generados; (2) `scripts/check_data.py` revisa los datos antes de publicar y, si algo está dañado, **no publica** (la web conserva la versión anterior en vez de quedar vacía); (3) el sitio se copia a una carpeta aparte antes de tocar git; (4) `build_data.py` ignora una corrida anterior dañada en vez de romperse. Hay un test nuevo que lo cubre.
**Cómo recuperar la web ahora:** subí estos archivos (en especial `.github/workflows/actualizar.yml`); la subida dispara sola una actualización que reescribe `products.json` completo. Si no arranca sola: pestaña **Actions → «Actualizar precios y publicar» → Run workflow**.

## Actualización 11: rediseño (inicio, encabezado único, páginas numeradas)

- **Página de inicio nueva** (`index.html`): buscador grande, accesos a las 5 secciones, categorías con cantidad de productos, bajas de precio recientes, «Cómo funciona» y «Datos en los que podés confiar». Muestra datos reales solo si existen (si no hay productos, no inventa números).
- **«Precios» pasó a llamarse «Productos»** (`productos.html`) en todo el sitio.
- **Encabezado único** (`js/layout.js` + `css/layout.css`): logo, menú, buscador y carrito (ícono con contador) iguales en todas las secciones y más bajo. Buscar o abrir el carrito desde otra sección lleva a Productos. En el celular queda en dos filas (logo + buscador + carrito / menú deslizable).
- **Productos**: páginas numeradas de 32 productos (4 columnas × 8 filas; 3 y 2 columnas en pantallas chicas), filtros fijos a la izquierda mientras se desliza solo la lista, y ventana de detalle centrada. La página, la búsqueda y la categoría quedan en la dirección (`productos.html?cat=procesadores&p=2`).
- **Más contraste** entre fondo y tarjetas (claro y oscuro), botones de ejemplo de «¿Qué actualizar?» y «Encontrá tu equipo» con aspecto de botón.
- **Pie de página** común: qué es el sitio, secciones, información (cómo funciona, confiabilidad, GitHub) y avisos importantes. Si querés agregar un mail de contacto, ponelo en `site/data/config.json` como `"contact_email": "tu@mail.com"` y aparece solo.
- **«Volver arriba»**: botón flotante al bajar y botón en el pie.
- Corregido: el cartelito «Actualizado hace X h» aparecía tachado.
- Pruebas nuevas: `pageList` (paginador) y estructura común de todas las páginas.

## Actualización 12: comparar hardware, producto en otra pestaña y legibilidad

- **Comparar hardware**: el desplegable de búsqueda no se abría porque el buscador nuevo del encabezado tenía el mismo nombre interno (`q`) que el de esta página. Ahora el del encabezado se llama `qh`. El listado resalta lo escrito, se maneja con ↑ ↓ Enter, avisa si hay más resultados o ninguno.
- **Comparación más clara**: si falta la ficha técnica de un producto se explica arriba (y cuáles son); las filas sin ningún dato se agrupan en un desplegable en vez de ocupar la tabla; cuando no hay ganador seguro se muestra «Lo que sí podemos afirmar con los datos que hay» (precio, memoria, etc.). La nota de FPS solo aparece si hay FPS. El gráfico de radar tiene etiquetas legibles.
- **Producto en otra pestaña**: cada tarjeta es un enlace real (`producto.html?id=…`): rueda del mouse, clic derecho → «Abrir en pestaña nueva» y Ctrl/Cmd+clic funcionan; el clic normal sigue abriendo la ventana de detalle, que ahora tiene el botón «↗ Abrir en otra pestaña». La página nueva muestra dónde comprarlo, historial de precio y especificaciones (solo las que tienen respaldo).
- **Legibilidad**: revisión automática de contraste (WCAG AA) y tamaño de letra en las 7 páginas, en claro/oscuro y en 3 anchos de pantalla: textos mínimos de 12 px, etiquetas, botón del asistente, botones principales al pasar el mouse, «✓ En lista» y colores de advertencia corregidos. La tabla de juegos de «Armado de PC» pasa a tarjetas en el celular.
- Pruebas nuevas: comparación con un solo producto, sin ficha técnica, hechos por fila, enlaces de producto y que el id del buscador del encabezado no choque.

## Actualización 13: auditoría de fichas técnicas (26-oct-2026)

Se auditaron los 5.900 productos publicados para ver cuáles no tenían ficha técnica para comparar.

- **Procesadores**: la base tenía 40 modelos; ahora 75. Se agregaron 35 (Ryzen 5 5600XT/5600GT/5600G/5600T, 5700G, 5700, 5900X/5900XT/5950X, 4500, 4100, 3200G, 3400G, 7600X3D, 7700, 7900, 9600, 8400F/8500G/8600G/8700G/8700F; Core i9-14900/F, i7-14700/F, i3-14100/F, i3-13100/F, i7-12700/F, i9-12900/F/K, i5-10400, Ultra 9 285, Ultra 7 265/F, Ultra 7 270K Plus, Ultra 5 250K/KF Plus, Pentium Gold G7400). Cada uno con su ficha oficial de amd.com o intel.com (enlace y fecha). El puntaje de juegos solo figura si lo mide Tom's Hardware (7600X3D, 270K Plus, 250K Plus); el resto dice «Sin datos» y no se usa para recomendar.
- Se reconocen títulos con «+ Wraith Stealth Cooler» y se descartan los «símil» (un Ryzen 5 PRO 5650G «símil 5600GT» no es un 5600GT).
- **Placas de video**: RX 9070 GRE (con rendimiento medido), y para comparar (sin entrar en recomendaciones): RTX 3050 6GB, Arc B570, RX 9060 y RX 9050. Se arregló «RX 9070 16GB XT» (se leía como RX 9070).
- **Categorías**: mini PCs, consolas, combos de actualización, tablets, soportes y kits que las tiendas ponían como «procesador», «placa de video», etc. ahora van a su categoría; las procesadoras/licuadoras de cocina se descartan (`fix_category` en `scrapers/common.py`).
- **Lectura de títulos**: pulgadas con ″ ´ ' o sin comillas, paneles HVA/WOLED/Fast IPS, resolución 1920x1080, memorias en MT/s, «D4» en motherboards, memoria deducida del socket (AM4 y LGA1200 solo DDR4; AM5 y LGA1851 solo DDR5), certificación Cybenetics, RPM de discos rígidos.
- **«No aplica» en vez de «Sin datos»** cuando el dato no existe para ese producto (por ejemplo, generación PCIe en un disco SATA o rígido).
- Resultado con los datos del 26-oct: procesadores con ficha 87 de 240 → 121 de 134 (los 106 restantes no eran procesadores); placas de video 349 → 389 de 427. Lo que sigue faltando (modelos viejos u OEM, placas profesionales, datos que la tienda no pone en el título) está listado en `fichas_incompletas.csv`.

## Actualización 14: mouse, teclados y auriculares; animaciones; AMD en Armado

- **Nuevas categorías comparables: Mouse, Teclados y Auriculares** (antes estaban mezclados en «Periféricos»; los combos, mousepads y accesorios siguen ahí). Se comparan con la **ficha técnica que publica Compragamer** para ese producto exacto (DPI, sensor, polling, botones, peso, agarre; tipo de teclado, switches, formato, idioma, material, anti-ghosting; impedancia, respuesta en frecuencia, drivers, sensibilidad, micrófono, cancelación de ruido…) y, si no hay ficha, con lo que dice el título. Todo figura como «pendiente de verificar» con su origen. La vida útil de clics y teclas casi ninguna tienda la publica: dice «Sin datos». Las fichas se descargan en la próxima actualización automática.
- **Armado de PC con AMD o Intel**: nuevo selector «Marca del procesador» (la más conveniente / AMD / Intel) y un cuadro que muestra cuánto cuesta cada plataforma completa. «La más conveniente» elige la plataforma más barata con stock, y entre los procesadores que alcanzan, el más barato (antes elegía siempre el de menor puntaje, que casi siempre era Intel). Solo se recomiendan procesadores con rendimiento medido: los Ryzen AM4 (5600X, 5700X3D…) tienen puntaje estimado y por eso no entran como recomendación.
- Radeon AI PRO R9700 (profesional) agregada para comparar.
- **Animaciones**: aparición suave de tarjetas y paneles al hacer scroll, ventana de detalle con efecto de entrada, carrito que «salta» al agregar, contadores de la portada, fondo del encabezado en movimiento, barras y radar que crecen en Comparar, historial de precio que se dibuja, tarjetas «esqueleto» mientras cargan los productos. Se desactivan solas si el sistema pide reducir el movimiento.

## Actualización 15: 19 tiendas nuevas y más fichas oficiales (26-oct-2026)

De la lista de 30 tiendas pedida, 7 ya estaban (ArmyTech, SCP Hardstore, Click Gaming, Katech, The Gamer Shop, Gaming City y Full H4rd, esta última sigue bloqueada por la tienda). Antes de sumar cada una se revisó su robots.txt y se leyó el catálogo como lo ve un visitante.

**Se agregan 19 tiendas** (ahora son 37 lectores):
- WooCommerce por la API pública (`scrapers/woo.py`): Backup Computación, Max Tecno, HF Tecnología, Liontech Gaming, Dinobyte.
- WooCommerce por el listado HTML porque su robots.txt prohíbe la API (`scrapers/woohtml.py`): HardCore.
- Tiendanube (`scrapers/tiendanube.py`): 37 Bytes, ShopGamer, Integrados Argentinos, Slot One, Vertex Retail (vrx.com.ar, solo «Computación y Gaming»). Contado = el precio «con Transferencia» que publica la tienda.
- Una misma plataforma de tarjetas «card-ecommerce» (`scrapers/cardeco.py`): Rocket Hard, Acuario Insumos, Megasoft, Hyper Gaming, Noxie Store. Contado = «Precio especial» (Rocket Hard aclara en la ficha que es efectivo o transferencia; en las otras se avisa que hay que confirmarlo).
- WIZ TECH (`scrapers/wiztech.py`, catálogo JSON del sitio), XT-PC (`scrapers/xtpc.py`) y Compufan Store (`scrapers/compufan.py`). WIZ TECH y Compufan publican un solo precio sin decir el medio de pago: se muestra como precio de **lista**, no como contado.

**No se agregan**: IgnaTech (su robots.txt prohíbe recorrer los listados por página), Portal Tech & Gaming (responde 403 y su robots.txt bloquea lectores automáticos), Gamer Factory (API privada con detección de bots), Full H4rd (403). «Space» no se pudo identificar: falta el sitio web exacto.

**Reputación**: las tiendas nuevas quedan «Sin datos» hasta cargar un puntaje público verificable.

**Tiempo de la actualización**: con 37 tiendas la recolección tarda más. `build_data.py` tiene un presupuesto de 85 minutos (variable `BUDGET_MIN`); si no alcanza, las tiendas que faltan muestran los precios de la lectura anterior (marcadas como desactualizadas) y la corrida siguiente empieza por ellas. No hace falta tocar `actualizar.yml`.

**Fichas oficiales nuevas**: Pentium Gold G5400, Pentium G4560 y Celeron G4900 (LGA1151, intel.com); Intel Arc A380 (intel.com); GeForce GT 1030 GDDR5 y DDR4 (nvidia.com). En la GT 1030 la ficha de NVIDIA tiene la potencia y el ancho de banda de las dos versiones cruzados: esos datos quedan «pendientes» (se usa 30 W, el mayor, para calcular la fuente). El Ryzen 5 3500X sigue sin ficha: la página de AMD no publica sus especificaciones.

Lo que falta en `fichas_incompletas.csv` es sobre todo el **puntaje de rendimiento medido** (no se inventa) y datos que la tienda no pone en el título (motherboards, fuentes, discos, monitores).


## Actualización 16 — Fichas de placas madre oficiales + corrección de categorías
- Nuevo `scrapers/mbspecs.py`: para placas madre **ASRock, MSI, Gigabyte y ASUS** lee la ficha en la página oficial del fabricante
  y guarda socket, chipset, tipo de memoria, formato y Wi-Fi. Solo se guarda si el nombre del modelo en la página coincide **exacto**.
  «Wi-Fi: No» únicamente cuando la ficha se leyó completa y no lista fila inalámbrica.
- Hasta 150 páginas por corrida (de las placas que más tiendas venden a las que menos), con pausa y caché
  (45 días si se leyó, 10 si no existe) en `raw/mbspecs_cache.json`. Un error nunca frena la actualización de precios
  (se anota en meta.json → specs → placas_madre: consultadas, leidas, sin_ficha).
- `compare.js`: las filas Socket/Chipset/Memoria/Formato/Wi-Fi usan la ficha oficial (con fuente y fecha) y, si no hay, el título.
- **Corrección importante de categorías** (`fix_category`): ahora manda el tipo con el que empieza el título.
  Antes ~470 procesadores («Sin Cooler»), memorias, SSD, sillas y auriculares figuraban en Refrigeración, y ~150 gabinetes y
  combos en Fuentes; los combos/kits mezclados pasan a «otros». También se corrigió «Auricular» (singular) que no se detectaba.
- Fuentes: «Semi-modular» ya no figura como «No indicado».
- **Pendiente de confirmar en vivo:** desde el entorno de desarrollo no se pueden abrir asrock.com, msi.com, gigabyte.com ni asus.com;
  los lectores se probaron con páginas guardadas desde el navegador. ASUS arma su ficha con JavaScript: si el servidor no la entrega
  lista, no se guarda nada (no se inventa). La primera corrida en GitHub mostrará cuántas se leyeron.
- **No hecho:** ficha oficial de fuentes. Cada marca (Cooler Master, Corsair, Thermaltake…) tiene direcciones que no se pueden
  deducir del título; el título ya trae potencia (97 %) y certificación (89 %). Queda para cuando haya una fuente con códigos exactos.


## Actualización 18 — Fichas desde la descripción de la tienda + placas madre apagadas por términos de uso
- **Corrección de rumbo:** se leyeron las condiciones de uso de los fabricantes. Las de **ASRock, MSI y ASUS prohíben «data mining, robots
  o herramientas similares»** (Gigabyte no lo menciona pero restringe copiar su contenido). Aunque robots.txt lo permite, el lector de
  fichas de placas madre (`scrapers/mbspecs.py`) queda **APAGADO por defecto**. Solo se enciende con `MB_SPECS=1` y permiso escrito.
  Lo mismo vale para Logitech, Razer, HyperX/HP, Corsair, Fantech y MSI monitores: no se leen sin permiso (ver el informe de fuentes).
- Nuevo `scrapers/descspecs.py`: mouses, teclados y auriculares que no tienen ficha de Compragamer toman sus datos (DPI, botones, peso,
  sensor, conexión; switch, formato, RGB; driver, impedancia, respuesta, micrófono…) de la **descripción que la propia tienda escribe**.
  No se pide nada nuevo: WooCommerce (goldentech/woo) y Tiendanube ya entregan ese texto junto con el precio (se guarda en `desc`, solo
  para periféricos, hasta 1.500 caracteres).
- Todo dato sale **«Pendiente de verificar»** con la nota «Según la descripción de <tienda>; no es del fabricante». Hacen falta al menos 2
  datos para guardar una ficha, nunca se pisa una ficha de Compragamer, y si dos tiendas del mismo producto se contradicen en un dato, ese
  dato se descarta. Estado en meta.json → specs → descripciones_tienda → vinculadas.
- Aún no cubre las tiendas con plataformas propias (cardeco, XT-PC, Compufan, WIZ TECH, Logg, Venex…): se suman si sus fichas de producto lo permiten.


## Actualización 19 — Fichas de Open Icecat (monitores, memorias, almacenamiento y fuentes)
- Nuevo `scrapers/icecat.py`: consulta la API documentada de Open Icecat (https://live.icecat.biz/api) por **marca + código de
  producto** tomado del título. No necesita contraseña: alcanza con el **nombre de usuario de Icecat**, que se guarda como secreto
  de GitHub `ICECAT_USER` (no va en el sitio). Sin ese secreto, no se consulta nada.
- **Paso que hace el dueño (una sola vez):**
  1. En GitHub: Settings → Secrets and variables → Actions → New repository secret. Nombre `ICECAT_USER`, valor: tu usuario de Icecat.
  2. En `.github/workflows/actualizar.yml`, debajo de `run: python build_data.py`, agregar:
     ```
             env:
               ICECAT_USER: ${{ secrets.ICECAT_USER }}
     ```
     (la versión completa del archivo está en este zip, en `.github/workflows/actualizar.yml`).
- Solo se acepta una ficha si la **categoría de Icecat coincide** con la del producto y si **capacidad / pulgadas / potencia** del
  título coinciden con la ficha. Etiqueta «Verificado» con la nota «Specs Icecat (Open Icecat): datos del fabricante, se muestran
  tal cual», que exige la licencia (atribución, «AS IS», sin cobrar por los datos, sin entrenar modelos, lo derivado con la misma licencia).
- Hasta 400 consultas por corrida (pausa de 1 s), de los productos más vendidos a los menos, con caché `raw/icecat_cache.json`
  (60 días si se encontró, 20 si no). Ante 429/5xx o usuario inválido se corta solo Icecat; los precios se publican igual.
  Estado: meta.json → specs → icecat (consultas, vinculadas, sin_ficha, solo_pago, rechazadas).
- Cobertura medida el 2026-10-27 con 240 productos reales del sitio y este mismo procedimiento (usuario público de prueba):
  **monitores ~30 %**, memorias ~3 %, almacenamiento ~2 %, fuentes ~3 %. El límite principal es que muchos títulos de las tiendas
  no traen el código del fabricante (y la API no busca por nombre). Cuando el título sí lo trae, Icecat lo tiene casi siempre
  para Kingston, LG, AOC, BenQ, Philips, ViewSonic, Gigabyte y Seagate. Los periféricos casi no figuran (Logitech, Corsair, Razer y Redragon solo
  están en el plan pago de Icecat).
- `compare.js`: memorias (capacidad, generación, módulos, velocidad, CL, voltaje, XMP, latencia real), almacenamiento (capacidad,
  interfaz, lectura, escritura, TBW, RPM), fuentes (potencia, 80 Plus, modular, ATX, conector 16 pines) y monitores (tamaño,
  resolución, Hz, panel, ms, brillo, HDR, FreeSync, G-SYNC, entradas, altura, VESA) usan la ficha de Icecat y, si no hay, el título.


## Actualización 20 — Animación 3D del armado de una PC en la portada
- `site/js/hero3d.js` + `site/js/vendor/three.module.min.js` (Three.js 0.160.0, licencia MIT en `three.LICENSE.txt`, copiado al sitio
  para no depender de otro servidor). La PC se dibuja con formas simples, sin modelos ni imágenes externas.
- En el espacio libre de la derecha del encabezado se arma un gabinete pieza por pieza: placa madre, procesador, memorias, SSD M.2,
  refrigeración, placa de video, fuente, ventiladores y cables. Al final «se enciende» (luces RGB y ventiladores girando), se desarma
  y vuelve a empezar (~18 s). Cada paso muestra el nombre de la pieza con un enlace a sus precios. Se puede girar arrastrando.
- Rendimiento: se carga después de la página, se pausa fuera de pantalla o con la pestaña oculta, resolución limitada.
  No se carga con «ahorro de datos». Con «reducir movimiento» del sistema se muestra la PC armada y quieta.
  Sin WebGL o si falla la carga, la portada queda exactamente como antes.
- En celulares aparece debajo del buscador (290 px de alto). `?t3d=12` en la dirección salta a ese segundo (para revisar).


## Actualización 21 — Animación 3D, versión 2 (más vistosa)
- Escenario oscuro tipo vitrina (tarjeta con bordes redondeados a la derecha del encabezado), brillo real del RGB (*bloom*),
  reflejos metálicos, piezas con bordes redondeados, textura de pistas en la placa madre y partículas de fondo.
- Nuevas piezas y detalles: refrigeración líquida (bomba con aro de luz, caños y radiador arriba con 3 ventiladores), placa de video
  en montaje vertical mirando al vidrio con 3 ventiladores, ventiladores con aspas translúcidas que toman el color de la luz,
  cables mallados blancos, línea de luz en la cubierta de la fuente.
- La cámara se acerca a cada pieza mientras se instala y hace un pulso de luz al encastrar; al terminar se aleja, la PC se enciende
  con una ola de color de atrás hacia adelante, muestra una «vista explotada» y vuelve a empezar (~25 s).
- Archivos nuevos de Three.js 0.160.0 (licencia MIT) en `site/js/vendor/addons/` (posprocesado, reflejos y bordes redondeados).
- Si el equipo va lento (primeros segundos), se apaga el brillo y baja la resolución automáticamente. `?hq=1` lo desactiva (para revisar).


## Actualización 22 — Animación 3D versión 3 + fluidez a 120 Hz
- Más efectos: piso espejado que refleja la PC, chispas cuando cada pieza encastra, líquido que circula por los caños de la
  refrigeración, pulsos de luz que viajan por los cables de la placa de video, RGB arcoíris en movimiento (memorias, placa de video,
  cubierta), logo «ComparáTech» iluminado en la cubierta de la fuente, botón de encendido con luz, destello que recorre el vidrio
  al encender, aspas curvas, antialiasing con el brillo activado y una órbita de cámara más cinematográfica.
- **Fluidez:** la animación siempre corre a la frecuencia de la pantalla (60, 120, 144 Hz…): el navegador la marca, no se puede
  forzar más de lo que da el monitor. Para sostener 120 cuadros por segundo:
  - mide la frecuencia real de la pantalla y, si no llega a dibujar cada cuadro a tiempo, baja la calidad de a un escalón
    (sin piso espejado → 80 % de resolución → resolución 1x → sin brillo); si después va holgada, prueba volver a subir una vez;
  - compila todos los sombreadores antes de empezar (evita «tirones» cuando aparece cada pieza) y comparte geometrías;
  - no crea objetos nuevos en cada cuadro;
  - se sacó el desenfoque (`backdrop-filter`) de la etiqueta de la animación y de las insignias de Productos, que obligaban al
    navegador a recalcular el desenfoque en cada cuadro/desplazamiento.
- En celulares arranca sin piso espejado (ahorra batería). `?hq=1` fuerza la máxima calidad (para revisar).


## Actualización 23 — Desplazamiento fluido
- Medido el 2026-10-27 en la PC del dueño (RTX 2060 SUPER, pantalla de ~165 Hz) con la versión 3 publicada: el hilo principal de la
  página no se traba (sin tareas largas, 163-165 cuadros por segundo con la animación). La traba al desplazar viene de que la placa
  de video tiene que dibujar la animación (brillo, piso espejado, antialiasing) y, a la vez, mover la página: en Chrome las dos cosas
  pasan por el mismo proceso de la placa de video.
- Cambios:
  - mientras se desplaza la página (rueda, barra o dedo) la animación no dibuja; retoma 0,18 s después de parar;
  - la animación solo corre si se ve al menos un cuarto de la vitrina;
  - cada pieza se une en una sola malla por material: de ~400 a ~145 dibujos por cuadro (mismo aspecto);
  - se quitó el desenfoque (`backdrop-filter`) del encabezado fijo de todas las páginas (el fondo ya era 92 % opaco; ahora 97 %),
    que la placa de video recalculaba en cada cuadro del desplazamiento;
  - destello del vidrio más suave.
- Diagnóstico: `?perf=1` en la dirección de la portada escribe en la consola del navegador los cuadros por segundo, el tiempo de
  dibujo y la cantidad de dibujos. `tests/run_tests.py` ahora revisa también la sintaxis de `site/js/hero3d.js`.


## Actualización 24 — «Encontrá tu equipo»: sin parpadeo, siempre con resultado y tres columnas
- **Parpadeo:** al elegir una opción, el panel se volvía a dibujar y la animación de aparición lo hacía desvanecerse y volver.
  Ahora (en todo el sitio) lo que se redibuja por una acción de la persona y ya está a la vista aparece directo; solo se anima lo que
  entra al desplazar. El asistente de preguntas además queda excluido (`data-norv`).
- **Sin resultado / mensaje de presupuesto equivocado:** con usos como edición de video + muchos FPS por componentes no aparecía
  nada, y el aviso decía «Con tu presupuesto no alcanza» aunque no se había puesto presupuesto. Causa: el armado elegía el
  procesador más barato que no limita a la placa, sin mirar que el uso pedía 8 núcleos y puntaje alto, y descartaba todo.
  Ahora, si ese procesador no cumple, se busca el más barato con stock que sí cumpla (si ninguno alcanza a la placa, el más rápido
  de los que cumplen, avisado). Probado con el catálogo real del 27/10: 24 armados posibles. Sin presupuesto, el aviso ya no
  habla de presupuesto y dice qué combinación de requisitos no se encontró.
- **Se quitó la pregunta «¿Qué preferís?».** Los resultados se muestran siempre en tres columnas, en el mismo orden:
  económica · equilibrada · mayor rendimiento (precios crecientes). Cada columna dice cuánto más cuesta que la económica y,
  en juegos, cuántos FPS más rinde (estimado), con una conclusión: «la mejora acompaña al precio», «mejora moderada» o
  «pagás bastante más por poca mejora». Sin presupuesto, «mayor rendimiento» se busca hasta 2,5 veces el precio de la económica.
- Los botones de presupuesto ($600.000, $1.000.000…) ahora quedan marcados al elegirlos.


## Actualización 25 — Seguir precio y agregar al carrito desde Armado de PC y Encontrá tu equipo
- Nuevo `site/js/quickview.js` (vista rápida compartida). En **Armado de PC** y en los resultados de **Encontrá tu equipo**:
  - tocar el nombre de un producto abre una ventana con precio, tiendas, stock, **☆ Seguir precio**, **+ Agregar a mi lista** y
    «Ver ficha e historial» (Ctrl+clic abre la ficha completa en otra pestaña);
  - cada fila tiene botones chicos ☆ (seguir) y + (agregar a la lista del carrito);
  - cada configuración (mínima, sugerida, y cada armado de Encontrá tu equipo) tiene «🛒 Agregar las N piezas a mi lista»;
  - el nombre de la tienda sigue llevando directo a la tienda (↗).
- Usa el mismo guardado que Productos («seg» y «lista» en el navegador): el contador del carrito se actualiza al instante, los
  precios seguidos avisan en Productos y la lista se ve al tocar el carrito. Se sincroniza entre pestañas abiertas.


## Actualización 26 — Compatibilidad del armado: disipador, BIOS, gabinete, conector de la fuente
Vale para **Armado de PC** y para las PC por componentes de **Encontrá tu equipo** (misma lógica, `site/js/lib.js`).
- **Disipador:** `CT.coolerIncluded` decide si el procesador trae cooler (manda el título de la publicación: «tray/OEM/S/Cooler»
  = no, «C/Cooler/Wraith» = sí; si no, por modelo: X, X3D y K no lo traen; los Intel sin K y los Ryzen sin X sí; si no se sabe,
  se suma con «(si no lo trae)»). Se elige por consumo: hasta ~95 W aire común con potencia declarada suficiente o torre conocida;
  hasta ~170 W torre o líquida de 240 mm; más, líquida de 360 mm. Si el título nombra sockets, tiene que incluir el del procesador
  (AM5 acepta los de AM4; LGA1851, los de LGA1700). Se excluyen pastas, ventiladores de gabinete y procesadores.
- **BIOS:** `CT.biosNeed` marca las combinaciones donde la placa es anterior al procesador (Ryzen 8000/9000 en A620/B650/X670,
  Ryzen 4000/5000 en placas 300/400, Intel 13/14 en H610/B660/H670/Z690). Se elige una placa que lo soporte de fábrica si no
  cuesta mucho más (+50 % o +$60.000); si no, se avisa con ⚠ y qué preguntar a la tienda (BIOS Flashback / Q-Flash Plus).
  Medido con el catálogo real del 27/10 (92 armados): ninguna placa elegida queda con aviso de BIOS.
- **Placas de entrada:** con procesadores de más de ~160 W no se eligen A620/H610/A520 (alimentación justa).
- **Gabinete:** se suma según el tamaño de la placa madre (si el título no lo dice, se asume ATX para no quedarse corto), sin kits
  ni gabinetes con fuente incluida. Se avisa medir el largo de la placa de video y el lugar del radiador.
- **Fuente:** para placas que usan el conector de 16 pines (RTX 40/50 de ≥200 W) se prefieren fuentes ATX 3.x (hasta +20 % de
  precio); si no, se avisa que se usa el adaptador incluido con la placa.
- **Precios dudosos:** para recomendar no se usa un precio 3 veces menor o mayor que el resto de las tiendas (p. ej. una
  ROG Strix X870-A a $120.150 cuando las demás la tienen a ~$600.000): con 3 o más tiendas se descarta el que se aleja de la
  mediana; con 2, el producto no se recomienda.
- Los totales ahora incluyen disipador (cuando hace falta) y gabinete, así que son más altos y más reales.

## Actualización 27 — Filtros por categoría, íconos nuevos, limpieza del catálogo y portada más liviana
- **Filtros por categoría en Productos** (`site/js/facets.js`): al elegir una categoría aparecen filtros propios con la cantidad
  de productos de cada opción; se combinan con los de siempre, se ven como «chips» quitables arriba de la grilla y quedan en la
  dirección de la página (`?cat=monitores&f_res=QHD%201440p`). El dato sale de la ficha guardada, de la base de hardware de los
  fabricantes (socket y gráficos de los procesadores, tipo de memoria de las placas de video) o del título; si no aparece en
  ninguna parte va a «Sin dato» (nunca se inventa).
  - Procesadores: serie, socket, gráficos integrados, cooler en la caja · Placas de video: chip, memoria, GDDR
  - RAM: DDR, capacidad, velocidad, PC o notebook · Motherboards: socket, chipset, DDR, tamaño, Wi-Fi (la marca es el filtro Marca)
  - Almacenamiento: tipo (NVMe, SATA, HDD, externo, pendrive…) y capacidad · Refrigeración: aire / líquida / ventiladores / pasta y medida
  - Fuentes: potencia, certificación, modular, ATX 3 · Gabinetes: placa que entra, ventiladores incluidos
  - Monitores: tamaño, resolución, Hz, panel, tiempo de respuesta · Notebooks y PC armadas: procesador, RAM, almacenamiento, placa de video
  - Mouse: conexión y uso · Teclados: tipo, switch, iluminación, conexión, formato · Auriculares: conexión, tipo, uso
  - Quedaron afuera los que casi no tienen datos en las tiendas (socket de coolers, largo de placa de video en gabinetes,
    LED/LCD, micrófono / 7.1 / USB-jack / cancelación de ruido, DPI, RGB en mouse). Se van a sumar con las fichas verificadas.
- **Íconos:** los emoji se reemplazaron por íconos de línea de Lucide (licencia ISC, guardados dentro del sitio en
  `site/js/icons.js`). En la portada cada categoría muestra además la foto real de un producto del catálogo (el más comparado,
  con stock, cuyo título empieza con el tipo de producto); si la foto no carga, queda el ícono.
- **Portada más liviana:** la actualización de datos genera `site/data/home.json` (unos 8 KB con cuentas, fotos y bajas). Antes la
  portada descargaba y procesaba el catálogo entero (17 MB) mientras arrancaba la animación, y eso la trababa.
- **Animación:** ya no se congela mientras se desplaza la página (antes se dejaba de dibujar y después «saltaba», que se veía
  trabado): se dibuja un cuadro sí y uno no. En pantallas de 120/144 Hz, si no llega, primero baja a la mitad de cuadros de forma
  pareja antes de bajar calidad. Nuevo botón «Pausar» (se recuerda en el navegador).
- **Limpieza del catálogo** (`scrapers/common.py`): «Micro Procesador …» y «Proces. …» que caían en Refrigeración por decir
  «S/Cooler» (143) vuelven a Procesadores; «CPU Cooler …» va a Refrigeración; controladoras ARGB y soportes van a Accesorios;
  repuestos de servidores a Otros; sobres de papel, lámparas, heladeras y cargos de envío se descartan. En la portada, las bajas
  de precio muestran solo hardware (sin cables ni «otros»).
- **Productos:** el orden por defecto es «Más relevante» (con stock, con foto y en más tiendas primero) en vez de «Menor precio»,
  que llenaba la primera página de accesorios baratos.
- Pruebas nuevas: `tests/test_facets.js` y dos en `tests/test_all.py`.

## Actualización 28 — «Armalo vos»: armado pieza por pieza, solo con piezas compatibles
- **Dos caminos en Armado de PC**: pestañas «Armado recomendado» (`armado.html`, el de siempre) y «Armalo vos (pieza por pieza)»
  (`armar.html`). En el nuevo se eligen procesador, cooler, motherboard, memoria, almacenamiento, placa de video, gabinete,
  fuente y monitor (opcional) en cualquier orden.
- **Solo se ofrecen piezas compatibles y comprobadas** con lo ya elegido. Lo incompatible se oculta (con el conteo y el motivo).
  Lo que no se puede comprobar porque falta un dato del fabricante **nunca se muestra como compatible**: va aparte, plegado, en
  «No pudimos verificar la compatibilidad», con el motivo.
- **«Ya lo tengo»**: se elige el modelo propio (no suma al total) o se cargan los datos clave (socket, DDR, tamaño de placa, largo
  máximo de placa de video, potencia…). **«No la necesito»** para la placa de video solo aparece si el procesador tiene gráficos
  integrados; **«Uso el del procesador»** solo si trae cooler en la caja.
- **Controles**: socket procesador–placa (con aviso de BIOS), DDR y SO-DIMM, socket del cooler según su fabricante (AMD: AM5 acepta
  coolers de AM4; Intel: LGA1851 usa los de LGA1700, con enlace a ambas fuentes), tamaño de placa–gabinete, largo de la placa de
  video, alto del cooler de aire, medida del radiador, y potencia de la fuente (la que recomienda el fabricante del chip o
  consumo + 30 %). Un gabinete que acepta 381 mm o más entra cualquier placa (la más larga fabricada según CORSAIR).
- **Datos verificados a mano** (`data_src/verified_src.py` → `site/data/verified.json`): coolers, gabinetes y largos de placas de
  video, cada uno con el enlace a la ficha oficial del fabricante y la fecha de revisión. Para sumar modelos se agrega una línea
  ahí y se corre `python data_src/verified_src.py`. No se usan PCPartPicker, BuildCores ni TechPowerUp (sus condiciones no lo
  permiten).
- El armado queda en la dirección (`armar.html?b=…`) para compartirlo y en el navegador para volver después; botón para agregar
  todas las piezas a «Mi lista».
- Motor en `site/js/builder.js`; pruebas en `tests/test_builder.js`.
