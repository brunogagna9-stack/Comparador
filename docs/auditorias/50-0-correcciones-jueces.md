# Actualización 50 · Correcciones a partir de la evaluación de los tres jueces (27/11/2026)

Rama `etapa-6`. Veredicto previo de los tres jueces: «Sí, con reservas». Acá está qué se corrigió y con qué evidencia.

## Críticos

| Hallazgo | Corrección | Evidencia |
|---|---|---|
| El asistente decía «subió 11%» del Ryzen 5 7600 cuando había bajado | El historial usa, cada día, el último precio conocido de CADA tienda que sigue vendiendo el producto, y el de hoy es el de la ficha | Datos publicados: «Desde el 22/10 ($363.650) hasta hoy ($358.600) se mantuvo casi igual · prácticamente en el mínimo». RTX 5060 INNO3D: hoy $949.554 (igual que la ficha). Prueba automática del caso del juez |
| «Placa de video para 1080p con 800 mil» respondía que no había nada | Pregunta por una pieza + presupuesto → placas que entran, ordenadas por rendimiento medido en esa resolución (la más barata de cada modelo) | Datos publicados: Arc B580 $609.368, RX 7600 $598.150, RTX 5050, RX 6600 XT, RTX 3050 |
| «rtx 4060 vs rx 7600» comparaba una PC armada | Si el texto nombra un chip conocido, se compara la placa/procesador suelto de ese chip; «4060» no toma «4060 Ti» | Datos publicados: RTX 4060 (placa) vs RX 7600 (placa), con enlace al comparador |
| «¿Mejor fuente para una RTX 5070?» devolvía PCs | Potencia recomendada por el fabricante + las fuentes 80 Plus más baratas con esa potencia | «NVIDIA recomienda al menos 650 W…» + 4 fuentes |
| «¿Tiene cooler?» / «¿Es compatible con DDR4?» en la ficha del Ryzen 5 7600 | Se responde sobre el producto abierto: cooler según el título; memoria según el fabricante (hardware.json) | «Sí: según el título incluye el cooler» · «No: el Ryzen 5 7600 (AM5) usa DDR5» |
| Fichas que mezclaban DDR4 con DDR5, 8 con 16 GB, B760M D3HP con D2H/DS3H, RTX 3050 6 GB con 8 GB | Después de agrupar, un grupo cuyas ofertas se contradicen en tipo de memoria, capacidad, variante de placa madre o chip/memoria de la placa de video se separa | Reconstrucción con las lecturas reales: 18 grupos DDR mezclados y 5 de capacidad → 0 |
| El «mejor precio» podía ser de una tienda sin stock confirmado (296 fichas) o sin responder (Fullh4rd) | La primera oferta es la más barata CON stock confirmado, de una tienda al día y sin salto sospechoso; una tienda que falla sin fecha de última lectura cuenta como vieja | Reconstrucción: 0 fichas donde gane una sin confirmar habiendo con stock. El monitor AOC G2790VX ya no muestra XT-PC ($196.550, sin stock) como mejor precio |

## Importantes

| Hallazgo | Corrección |
|---|---|
| El mismo modelo en hasta 10 fichas | Se unen fichas de placas de video del mismo modelo exacto (marca, chip, memoria, línea, ventiladores, OC, color) y de procesadores (chip, sufijo, caja/tray). Los ids viejos quedan en `data/alias.json`: enlaces y avisos de precio siguen funcionando (redirección en la ficha; los avisos siguen al producto). 264 alias en la reconstrucción |
| La web prometía «cada 6 horas» y en la práctica son 11–13 | Textos corregidos: «varias veces por día (en general cada 6 a 12 horas)». Para cumplir 6 h de verdad hace falta un disparador externo (ver abajo) |
| Tiendas, Encontrá y Actualizar bajaban el catálogo entero (3,3 MB) | Tiendas usa el conteo de `meta.json`; Actualizar usa `armar.json`; Encontrá usa un catálogo reducido nuevo (`encontra.json`). Si los archivos nuevos no existen, se usa el completo como antes |
| Producto inexistente bajaba 6 MB y Google lo veía como página válida | Si la parte del catálogo existe y no lo tiene, no se baja nada más; la página queda `noindex` |
| «REP is not defined» dejaba Productos vacía a veces | Las librerías se cargan antes del script de la página |
| Encontrá daba una sola notebook vieja para $900.000 | El procesador pesa en el puntaje; Celeron/Athlon quedan fuera para uso general; se leen títulos abreviados («+SSD256G»). Ahora: económica, equilibrada y de mayor rendimiento |
| Filtros activos invisibles en el celular | Chips para todos los filtros (tocar uno lo quita), contador en «Filtros», precio mínimo/máximo y «solo con stock» en la dirección |
| Compufan con el precio etiquetado como lista | Es el de contado (la ficha de la tienda lo aclara) |
| Katech decía «completa» sin productos | Al lado de «completa» se marca «sin datos ahora» cuando la última lectura falló |
| Baterías de 99,9 Wh copiadas de descripciones (MSI oficial: 90 y 55,2 Wh) | Desde una descripción de tienda no se acepta 98,5–100 Wh |
| Cuotas en tiendas sin stock | El asistente no las lista y marca las de stock sin confirmar |

## Menores

XT-PC sin precio de lista dudoso; Logg redondeado al peso; accesorios (bases, soportes, maletines, pasta térmica, contact frame) fuera de notebooks, monitores y procesadores; cambios de menos de 1 % no se anuncian como «bajó/subió» (había ~10.000 «−0,3 %»); página 404 propia; Cuenta no muestra texto de la dirección; los JSON gigantes no se guardan en el teléfono; etiquetas en los campos de precio; verde de «bajó» con contraste AA; Encontrá muestra la batería cuando existe.

## Pendiente / decisiones

- **Frecuencia real de 6 h:** GitHub saltea las ejecuciones programadas. La solución es un disparador externo gratuito (por ejemplo cron-job.org o un Cron Trigger de Cloudflare) que llame al flujo con un token de GitHub de alcance mínimo. Requiere crear la cuenta/token: decisión del dueño.
- **6 tiendas bloquean la lectura** (Fullh4rd, Katech, Venex, Try, The Gamer Shop, HardCore): no se saltean bloqueos.
- **Cabeceras de seguridad (CSP, HSTS):** requieren activar el proxy de Cloudflare; cambia cómo se sirve el sitio, conviene hacerlo aparte.
- **Fragmentación de monitores y fuentes:** no se tocó (el riesgo de unir modelos distintos es mayor sin un identificador claro).
