# Actualización 47 · Etapa 5 — Fichas técnicas de notebooks (peso y batería)

## Causa en el origen

- Las fichas de notebooks salían de **una sola fuente**: el archivo de características de Compragamer. En el sitio
  publicado solo **48 de 1.698 notebooks** tenían ficha; el resto mostraba «Sin datos» en peso aunque la tienda lo
  escribiera en su página.
- La batería (Wh) estaba fija en «Sin datos» para **todas**: Compragamer no la publica y el código ni siquiera miraba
  otras fuentes.
- Las descripciones de las tiendas se guardaban solo para periféricos; las de notebooks se descartaban al leerlas.

## Cambios (rama `etapa-3`)

1. Lectores WooCommerce (incluye GoldenTech, Dinobyte, Max Tecno, Click Gaming…) y Tiendanube guardan también la
   descripción de las notebooks.
2. `scrapers/descspecs.py` lee de esa descripción solo **peso** (0,5–6 kg; descarta peso del cargador, de la caja o
   del paquete) y **batería** en Wh (20–110) y celdas. **No** convierte mAh (no son comparables) y **no** toma la
   autonomía en horas (es de marketing).
3. Notebook con ficha de Compragamer: solo se **completa lo que falta**; nunca se pisa un dato de la ficha. Notebook
   sin ficha: se arma una con lo que diga la tienda. Si dos tiendas se contradicen, ese dato se descarta.
4. Todo dato así sale «Pendiente de verificar», con la tienda de origen y la nota «Según la descripción de <tienda>;
   no es del fabricante». La comparación y el asistente muestran la batería cuando existe.

## Evidencia con tiendas reales (rama `prueba-fichas`, ejecutada en GitHub)

| Tienda | Notebooks | Con descripción | Con peso | Con batería (Wh) |
|---|---|---|---|---|
| Dinobyte | 446 | 86 | 27 | 23 |
| Max Tecno | 270 | 247 | 32 | 31 |
| Click Gaming | 97 | 95 | 16 | 2 |
| GoldenTech | 41 | 41 | 0 | 0 |
| Nickhard | 256 | 256 | 0 | 0 |
| ShopGamer | 49 | 49 | 0 | 0 |
| SCP Hardstore | 54 | 3 | 0 | 0 |

En total: **75 publicaciones con peso y 56 con batería** que antes decían «Sin datos». En GoldenTech, Nickhard y
ShopGamer las descripciones no mencionan peso ni batería: ahí «Sin datos» es correcto. Un «Peso: 8 g» de GoldenTech
se descartó por estar fuera de rango (no es una notebook).

Muchas descripciones de Dinobyte están redactadas como texto comercial. Por eso los datos quedan marcados como de la
tienda y «a confirmar», no como datos del fabricante.

## Estado

| Punto | Estado |
|---|---|
| Peso y batería desde las descripciones | IMPLEMENTADA NO VERIFICADA en el sitio (lectura VERIFICADA en GitHub; falta una actualización completa publicada) |
| Datos del fabricante (hojas técnicas oficiales) | PENDIENTE: requiere permiso o licencia de cada marca. Icecat (ya conectado para otras categorías) es la vía con licencia abierta; hay que medir cuántas notebooks cubre |
| Pruebas independientes (autonomía medida, ruido, temperaturas) | NO RECOMENDADA por ahora: los sitios que miden autonomía no ofrecen permiso de uso; no se copian |
