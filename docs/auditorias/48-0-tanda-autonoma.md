# Actualización 48 · Tareas hechas sin intervención (rama `etapa-4`, sin publicar)

| Tarea | Estado | Evidencia |
|---|---|---|
| Despertador ejecutado solo por GitHub | VERIFICADA | Corrida programada del 24/11 07:04 UTC: «al-dia». Corrida programada del 24/11 19:03 UTC: «arranca»; a las 19:04 se lanzó la actualización (`workflow_dispatch`) y terminó bien. GitHub lo dispara menos de lo programado (2 veces en ~19 h), pero cuando corre, funciona |
| Paridad celular/computadora sobre el sitio publicado | VERIFICADA | `BASE=https://brunogagna9-stack.github.io/Comparador/ node calidad/paridad.js`: 6 acciones × 7 tamaños, todas ✓ |
| Cuotas de Quantum | IMPLEMENTADA (lectura VERIFICADA con su página real) | El tema no dibuja las cuotas; vienen en `installments_data`. Página de componentes: 24 de 24 productos con cuotas (p. ej. «12 cuotas sin interés de $ 73.554»: gana el plan sin interés; 18 y 24 tienen interés) |
| Cobertura de Armytech | IMPLEMENTADA (lectura VERIFICADA) | La categoría raíz «Productos» lista 527 productos; los 12 listados que se leían daban 264, todos incluidos en la raíz. Se suman sobre todo periféricos (223). Respaldo automático a los listados viejos si la raíz da menos de 100 |
| Peso y batería del fabricante (Icecat) para notebooks | IMPLEMENTADA NO VERIFICADA en el sitio | Prueba en GitHub con tu usuario de Icecat: de 41 notebooks consultadas, 3 tenían ficha (Lenovo ThinkPad/ThinkBook) con «Peso» (ID 94) y «Capacidad de batería» (ID 8519). Cobertura baja (~7%) pero son datos del fabricante; se suman de a poco por el tope de consultas y la caché |
| Corte de red en Icecat | CORREGIDO | Un «Read timed out» rompía toda la etapa de Icecat y se perdían las fichas ya vinculadas de esa corrida; ahora corta solo la consulta y guarda lo obtenido |
| Dominio propio | PREPARADO en la rama `dominio` | Direcciones canónicas, sitemap, robots, correos y despertador apuntan a https://kyranohard.com.ar/. Se publica cuando el DNS y GitHub Pages estén listos |
