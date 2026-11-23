# Actualización 46 · Etapa 2 — El celular a la par de la computadora

## Auditoría ANTES (360 px de ancho)

- Ninguna función estaba oculta en el celular, pero varias eran incómodas:

| Página | Problema |
|---|---|
| Comparar (4 placas) | tabla de 885 px en una pantalla de 326 px: había que desplazarse de costado |
| Ficha de producto | tabla de precios por tienda de 640 px (también en la vista rápida de Productos) |
| Armado de PC | 14.260 px de alto: cada pieza mostraba sus 3 opciones completas |
| Tiendas | 28.070 px de alto: cada tienda mostraba toda su ficha |

## Cambios (solo en pantallas de hasta 640 px; la computadora queda igual)

1. `comparar.html` — la misma comparación en **tarjetas**, una por característica, con los productos uno debajo del
   otro, el «mejor» marcado y «Qué significa» desplegable. Funciona con «Mostrar solo las diferencias».
2. `js/detail.js` + `css/layout.css` — precios por tienda en **tarjetas** (una por tienda, con el botón «Ir a la tienda»
   grande), en la ficha y en la vista rápida de Productos.
3. `armado.html` — la primera opción de cada pieza a la vista y «Ver N opciones más».
4. `tiendas.html` — nombre, estado y reputación a la vista; «Ver los datos de la tienda».
5. `calidad/paridad.js` (nuevo, en el control de calidad automático) — hace las mismas 6 acciones en 7 tamaños
   (360×800, 390×844, 430×932, 768×1024, 1366×768, 1920×1080, 2560×1440) y falla si alguna no se puede hacer, si la
   página se sale de la pantalla o si hay errores: armar una PC desde el inicio, cambiar sus piezas en «Armalo vos»,
   comparar, ver precios por tienda, filtrar el catálogo y usar «Mi lista».

También en esta etapa (confiabilidad de la publicación): `actualizar.yml` reintenta una vez la subida a GitHub Pages
si falla. El 22 y el 23/11 falló («No artifacts named github-pages») y la web quedó con los precios anteriores.

## Auditoría DESPUÉS (360 px)

| Página | Antes | Después |
|---|---|---|
| Comparar (4 placas) | tabla de 885 px, desplazamiento lateral | tarjetas, sin desplazamiento lateral |
| Ficha de producto | tabla de 640 px | tarjetas, sin desplazamiento lateral |
| Armado de PC | 14.260 px de alto | 11.655 px |
| Tiendas | 28.070 px de alto | 11.151 px |

- Paridad: las 6 acciones ✓ en los 7 tamaños.
- Computadora (1366 y 1920 px, 8 páginas): capturas idénticas píxel por píxel a la versión anterior, salvo Armado
  (casilla de outlet y acciones nuevas de las etapas 0 y 1, a propósito).

| Función | Estado |
|---|---|
| Comparar en tarjetas (celular) | VERIFICADA |
| Precios por tienda en tarjetas (celular) | VERIFICADA |
| «Ver más» en Armado y Tiendas (celular) | VERIFICADA |
| Prueba automática de paridad | VERIFICADA (local); en GitHub se verifica en la próxima corrida |
| Reintento de la publicación | IMPLEMENTADA, NO VERIFICADA (solo actúa cuando GitHub Pages falla) |
