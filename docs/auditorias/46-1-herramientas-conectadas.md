# Actualización 46 · Etapa 1 — Herramientas conectadas (comprar sin saber de hardware)

## Auditoría ANTES

- «Encontrá tu equipo» pedía uso, presupuesto, resolución y juegos y armaba una PC con piezas reales. Pero:
  - había que contestar 6 pantallas para llegar al resultado; el inicio solo tenía un acceso a la herramienta;
  - del resultado solo se podía «agregar las piezas a mi lista»: **no** se podía abrir el armado en «Armalo vos» para
    cambiar una pieza, **no** se podían comparar las alternativas de una pieza y **no** había enlace para compartirlo;
  - no se sabía si convenía comprar todo en una tienda o en varias.
- «Armado de PC» (por placa de video o procesador): mismas limitaciones.
- «Armalo vos»: un enlace de armado reemplazaba sin aviso el armado que la persona venía haciendo.

## Cambios

1. `index.html` — «¿No sabés qué comprar? Te armamos la PC»: uso, monitor (solo si es para jugar o editar video) y
   presupuesto → `encontra.html?uso=…&res=…&b=…&ver=1`, directo a los resultados. Funciona también sin JavaScript (formulario).
2. `encontra.html` — acepta esas respuestas por enlace; la dirección de los resultados se puede compartir
   («🔗 Compartir estas recomendaciones»). Lo que la persona tiene en su PC actual no se pone en el enlace.
3. `js/buildtools.js` (nuevo) — en cada armado de «Encontrá tu equipo» y de «Armado de PC»:
   «🔧 Cambiar piezas en «Armalo vos»» (abre el armado completo con el control de compatibilidad),
   «🔗 Compartir este armado», «🛒 Dónde comprar todo» (pieza por pieza / todo en una tienda / repartido en dos, con
   los precios de hoy de las mismas piezas) y, en cada pieza con alternativas, «⇄ Comparar opciones».
4. `armar.html` — si llegás con un armado por enlace, el tuyo anterior queda guardado: «↩ Volver a mi armado anterior».

## Auditoría DESPUÉS

Recorrido probado en celular (iPhone 13) y computadora (1366×900), sin errores:
inicio → «Jugar (exigentes)», 1440p, $1.800.000 → «Ver mi PC» → RX 9060 XT + Core i5-14400F, $1.726.599 →
«Dónde comprar todo» (7 tiendas pieza por pieza; ninguna tienda tiene todo) → «Comparar opciones» de la placa de video
(abre Comparar con las 3) → «Cambiar piezas en Armalo vos» (8 piezas, todas «✓ compatible») + aviso del armado anterior.

Pruebas: `test_actualizacion_46_conectadas` y «act. 46 (armados conectados…)» en `tests/test_js.js` (formato del
enlace, cálculo de una tienda y de dos tiendas, enlace a Comparar). Control de calidad: HTML, ESLint y axe (16
páginas, claro/oscuro, PC/celular) sin fallas.

| Función | Estado |
|---|---|
| Pregunta rápida en el inicio | VERIFICADA |
| Recomendaciones por enlace / compartir | VERIFICADA |
| Abrir el armado en «Armalo vos» | VERIFICADA |
| Comparar opciones de una pieza | VERIFICADA |
| Dónde comprar todo | VERIFICADA (con datos de prueba y reales) |
| Volver al armado anterior | VERIFICADA |
