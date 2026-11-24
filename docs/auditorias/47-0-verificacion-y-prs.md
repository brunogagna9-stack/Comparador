# Actualización 47 · Verificación de las etapas anteriores y revisión de los Pull Requests

Fecha: 23/11/2026 · Rama de trabajo: `etapa-3` (nada de esta actualización está publicado).
Estados: **VERIFICADA** (hay evidencia) · **IMPLEMENTADA NO VERIFICADA** · **PENDIENTE** · **BLOQUEADA** · **NO RECOMENDADA**.

## 1. Lo publicado (actualización 46, en `main`)

| Control | Estado | Evidencia |
|---|---|---|
| Lo publicado coincide con el repositorio | VERIFICADA | La publicación de `0e75531` terminó bien; el sitio sirve los archivos de esa versión |
| Datos reales (no de ejemplo) | VERIFICADA | `products.json` publicado: 30.253 productos de 38 lectores; `specs.json`: 1.820 fichas con fuente |
| Armados compartidos se recuperan | VERIFICADA | Prueba en el sitio publicado (celular y computadora): el enlace reconstruye las mismas piezas |
| Comparar con 2, 3 y 4 productos | VERIFICADA | Prueba en el sitio publicado, celular y computadora. (Un primer fallo era de mi prueba: cambiar solo el `#` no recarga la página; se corrigió la prueba, no el sitio) |
| Detección de incompatibilidades | VERIFICADA | Socket y tipo de memoria cruzados marcan el aviso en ambos tamaños de pantalla |
| Celular = computadora | VERIFICADA | `calidad/paridad.js` en verde en la integración continua |
| Pruebas automáticas | VERIFICADA | Pruebas de Python, JS, asistente y calidad en verde (con las versiones nuevas de las herramientas) |
| Paridad contra el sitio **publicado** (no la copia local) | PENDIENTE | El ajuste para apuntar `paridad.js` al sitio publicado no quedó guardado; queda para la próxima tanda |

### A. Despertador (actualizaciones atrasadas)

| Control | Estado | Evidencia |
|---|---|---|
| Detecta precios de más de 6 h | VERIFICADA | Prueba controlada en la rama `prueba-mecanismos` con umbral 0,01 h y modo simulación: «RESULTADO: arrancaria» |
| No arranca si están al día | VERIFICADA | Misma prueba con el umbral real (6 h): «RESULTADO: al-dia» |
| No duplica si ya hay una actualización corriendo | VERIFICADA | Primera corrida de la prueba, con una actualización en curso: «RESULTADO: en-curso» y no lanzó nada |
| No hace pedidos a las tiendas | VERIFICADA | Solo lee `meta.json` del propio sitio y la lista de ejecuciones de GitHub |
| Arranque real de la actualización | IMPLEMENTADA NO VERIFICADA | La simulación no lanza nada a propósito. Falta ver un arranque real en el historial de GitHub |
| Que GitHub lo ejecute solo cada hora | IMPLEMENTADA NO VERIFICADA | Está programado, pero GitHub todavía no lo disparó por su cuenta (pasa lo mismo con la actualización cada 6 h: GitHub no garantiza el horario) |

Cambio en `etapa-3`: la lógica pasó de estar escrita dentro del flujo a `scripts/despertador.sh`. Así se puede probar con
otro umbral y en modo simulación sin tocar la versión publicada.

### B. Reintento de la publicación

| Control | Estado | Evidencia |
|---|---|---|
| Si la publicación falla, reintenta después de esperar | VERIFICADA | Rama `prueba-mecanismos`: un trabajo con falla forzada pasó a «reintento»; uno sin falla lo salteó. Usa exactamente la misma condición que `actualizar.yml`. No se publicó nada defectuoso: es una rama aparte, sin publicación |
| Publicación real con las acciones nuevas | VERIFICADA | La publicación después de aceptar el PR #2 terminó bien |

## 2. Pull Requests (los tres los aceptaste vos; acá está la revisión posterior)

| PR | Qué cambia | Riesgo | Resultado después de aceptarlo |
|---|---|---|---|
| #1 | `rapidfuzz` a 3.14.6 (comparación de nombres entre tiendas) | Bajo: versión menor | Pruebas de cruce entre tiendas en verde |
| #2 | Versiones nuevas de las acciones de GitHub (checkout, Python, subida y publicación) | Medio: tocan la publicación | Publicación real en verde; reintento probado aparte |
| #3 | Herramientas de calidad (eslint, Lighthouse, axe, html-validate) | Bajo: no llegan a la web | Control de calidad y análisis de seguridad en verde |

Para los próximos: Dependabot solo propone, no acepta nada solo. Recomiendo aceptar cuando las pruebas del PR estén en
verde; los que tocan `actualizar.yml` o la publicación, mejor de a uno.
