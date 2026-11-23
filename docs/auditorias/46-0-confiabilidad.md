# Actualización 46 · Etapa 0 — Confiabilidad de las recomendaciones

Fecha: 24/11/2026 · Rama de respaldo antes de empezar: `respaldo-antes-46` (igual a la versión publicada).

## Auditoría ANTES

Prueba: «Encontrá tu equipo» → juegos exigentes · PC por componentes · $1.500.000 · 1440p (celular y computadora, mismo resultado).

| Pieza | Elegida | Problema |
|---|---|---|
| Memoria RAM | «Board Asus Prime A520m-k / Am4 / DDR4 64 GB» | **Es una placa madre** que una tienda publicó como memoria |
| Placa de video | EVGA RTX 3070 Ti … «- Outlet» | Pieza de outlet elegida **sin avisar** (hay 180 piezas así) |
| Gabinete | Gigabyte C102 en Venex | Venex **no responde hace 4 días**: precio viejo |

Además: GitHub corría la actualización programada «cada 6 h» solo 2 o 3 veces por día desde el 19/11 (precios de hasta 13 h).

## Cambios

1. `js/lib.js` — `CT.WRONG_TYPE` (productos de otro tipo publicados en una categoría: placa madre como RAM, combos,
   carcasas de disco…), `CT.USED_RE` / `CT.okToRecommend` (outlet, usado, reacondicionado, open box: fuera salvo que se
   pida), `C.staleStore` y oferta al día dentro de `C.cheapest` (las tiendas que no responden hace más de un día van
   después). Solo afecta a lo que se RECOMIENDA; el catálogo sigue mostrando todo.
2. `js/finder.js` — notebooks y PC armadas también respetan `CT.okToRecommend`.
3. `encontra.html`, `armado.html` — casilla «Incluir outlet y reacondicionados» (se guarda en el navegador).
4. `scrapers/common.py` — «Board …» / «Mainboard …» → placas madre.
5. `.github/workflows/despertador.yml` — cada hora mira la fecha de los precios publicados y, solo si tienen más de 6 h y
   no hay otra actualización en curso, arranca «Actualizar precios y publicar» (no lee tiendas: no suma pedidos).

## Auditoría DESPUÉS (misma prueba, mismos datos)

- $1.500.000 → «Con tu presupuesto no alcanza… lo más barato que cumple cuesta $1.726.599» + alternativa realista.
  Correcto: la opción anterior solo «entraba» por la pieza de outlet y la placa madre a precio de RAM.
- Con «Incluir outlet» tildado: mínimo $1.573.485 (sin la placa madre como RAM).
- $1.800.000 → RX 9060 XT + Core i5-14400F, RAM «Puskill 16GB DDR4», gabinete de SCP Hardstore (tienda al día). ~63 FPS (estimado).
- Pruebas: `test_actualizacion_46_confiabilidad` + «act. 46» en `tests/test_js.js` (placa madre, outlet, combo,
  carcasa, tienda vieja, casilla). Todas las pruebas: OK. Control de calidad (HTML, ESLint, axe en 16 páginas claro/oscuro/PC/celular): OK.

## Estado

| Función | Estado |
|---|---|
| Nunca recomendar una pieza de otro tipo | VERIFICADA |
| Outlet / reacondicionados solo si se piden | VERIFICADA |
| Preferir tiendas al día | VERIFICADA |
| Despertador de la actualización | IMPLEMENTADA, NO VERIFICADA (se verifica cuando corra en GitHub) |
