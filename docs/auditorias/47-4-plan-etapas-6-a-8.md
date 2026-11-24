# Actualización 47 · Plan de las etapas 6, 7 y 8 (para decidir; nada implementado)

## Etapa 6 — Asistente con contexto en todas las páginas

Estado actual: el asistente de la web (`js/assistant.js`) **no es una IA generativa**. Responde con reglas sobre los
datos reales del sitio (precios, tiendas, fichas, armado abierto). No inventa ni cuesta nada. No es una demo
simulada, pero tiene límites: no entiende preguntas libres complejas.

| Opción | Calidad | Costo | Seguridad | Recomendación |
|---|---|---|---|---|
| A. Mejorar el asistente actual (más preguntas, presente en todas las páginas, contexto de la página) | Media, sin errores inventados | $0 | Sin claves | **Recomendada como siguiente paso** |
| B. Modelo de IA vía función de Supabase (la clave queda en Supabase, nunca en la web), respondiendo **solo** con datos del sitio que se le pasan | Alta en preguntas libres | Pago por uso: hace falta un tope mensual y límite por usuario | Bueno si hay límites contra abuso | Solo si definís un presupuesto mensual |
| C. Modelo gratuito de terceros | Variable | $0 con cupos bajos | Algunos usan las consultas para entrenar | NO RECOMENDADA |

Decisión que necesito: ¿avanzamos con A y dejamos B para cuando definas presupuesto?

## Etapa 7 — SEO

Ya existe: 14 guías `precios-<categoría>.html` con lista estructurada (ItemList), preguntas frecuentes con FAQPage,
ficha de producto con Product/AggregateOffer, mapas del sitio (páginas, productos y guías) y enlaces canónicos.

| Mejora | Impacto | Estado |
|---|---|---|
| Dominio propio | **El mayor**: hoy robots.txt no cuenta (no está en la raíz del dominio) y el sitio comparte dominio con GitHub | PENDIENTE (lo dejaste en pausa) |
| Alta en Google Search Console y envío del sitemap | Alto, gratis | PENDIENTE: lo tenés que hacer vos con tu cuenta (te guío) |
| Fichas de producto en HTML estático para los ~500 productos más buscados (hoy se arman con JavaScript) | Medio-alto | Propuesta |
| Guías por uso real («notebook para estudiar», «PC para 1440p») con datos del catálogo | Medio | Propuesta, solo si hay datos suficientes por página: no se generan páginas vacías ni repetidas |

## Etapa 8 — Mejoras adicionales detectadas

1. Cuotas de Quantum: la tienda las muestra pero el lector no las reconoce en su tema. Necesita una muestra de su
   HTML para ajustarlo sin inventar.
2. Armytech: confirmar cobertura (no muestra un contador de productos reconocible).
3. Paridad celular/computadora también contra el sitio publicado.
4. Mercado Libre: conectarlo apenas estén las credenciales (etapa 4).
