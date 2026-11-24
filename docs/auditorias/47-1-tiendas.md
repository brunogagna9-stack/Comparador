# Actualización 47 · Etapa 3 — Tiendas

Método: diagnóstico ejecutado desde GitHub con el mismo agente que el comparador (`ComparadorARBot`), respetando
robots.txt; sin saltear bloqueos. Script: `scripts/diagnostico_tiendas.py` (rama `prueba-tiendas`); prueba del lector
real en la rama `prueba-quantum`.

## Altas y revisiones de esta etapa

| Tienda | Estado | Detalle |
|---|---|---|
| **Quantum Hardstore** (nueva) | IMPLEMENTADA, lectura VERIFICADA (no publicada) | Tiendanube; robots.txt permite los listados. Lector real en GitHub: 178 productos en 24 s, sin repetidos. Coincide con lo que la tienda dice por categoría (componentes 161 = 161; periféricos 10 = 10; monitores 2 = 2; PC 5 = 5; notebooks 0). Todos con foto, stock y precio contado (−25% por transferencia). **68 de los 178 son «OUTLET»**: quedan separados como usados y no se recomiendan salvo que se pida. Cuotas: la tienda las muestra pero el lector todavía no las reconoce en su tema (quedan sin cuotas, no inventadas) |
| GoldenTech | VERIFICADA (completa) | La tienda informa 1.510 productos y el comparador leyó 1.510 |
| Armytech | parcial (sin cambios) | Sus 12 listados responden y robots.txt los permite (271 productos en la última lectura). No pude comparar contra el total porque la tienda no muestra un contador reconocible: la cobertura queda sin confirmar |
| Compugarden | NO RECOMENDADA por ahora | Responde, pero es una tienda de Mercado Shops: conviene cubrirla con la API oficial de Mercado Libre (etapa 4), no leyendo su sitio |
| Biosistemas | BLOQUEADA | HTTP 403 con desafío de Cloudflare («Just a moment…»). No se intenta saltear |
| Maldito Hard, Mym Computación, Hard Vision | PENDIENTE | Los dominios que probé no respondieron: son dominios supuestos. Hace falta la dirección real de cada tienda para revisarlas |

Corrección honesta: en el avance anterior estimé «~1.186 productos» para Quantum; el lector real y los contadores de
la tienda muestran 178. La estimación estaba mal.

## Registro de estado (42 tiendas, Quantum incluida)

- **Operativas (completa): 28**, Quantum incluida.
- **Parciales: 8** — MEXX (fichas detrás de Cloudflare), Armytech (cobertura sin confirmar), Venex (el listado no
  informa stock), Hardloots, The Gamer Shop (su API corta en 200 por categoría), WIZ TECH, XT-PC y Compufan Store (precio
  sin aclarar medio de pago).
- **Bloqueadas: 6** — Gezatek (429), Fullh4rd (403), Gamer Factory (API privada con detección de bots), IgnaTech
  (robots.txt lo prohíbe), Portal Tech & Gaming (403 + robots.txt), Vertex Retail (ya no vende computación).
- Duplicados: ninguno (cada tienda tiene un lector y una ficha; el test de registro lo controla).

Pendiente de tu lado (opcional): `config.json` es tuyo y no lo toco. Si querés ocultar Quantum o anotar sus cuotas,
se hace ahí.
