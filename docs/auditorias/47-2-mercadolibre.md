# Actualización 47 · Etapa 4 — Mercado Libre por la API oficial

Estado: **BLOQUEADA** hasta que existan las credenciales. El código está preparado y probado sin red
(`scrapers/mercadolibre.py`, test `test_actualizacion_47_mercadolibre_sin_secretos`), pero **no está conectado** al
comparador.

## Qué hacer vos (una sola vez)

1. Entrá con tu cuenta de Mercado Libre a **developers.mercadolibre.com.ar → «Mis aplicaciones» → «Crear aplicación»**
   (DevCenter). Mercado Libre pide que la cuenta tenga los datos del titular validados.
2. Completá:
   - **Nombre / nombre corto / descripción**: «KyraNoHard – comparador de precios de hardware».
   - **URI de redirect**: `https://brunogagna9-stack.github.io/Comparador/` (tiene que ser HTTPS; no hace falta que haga nada).
   - **Permisos (scopes)**: lectura (**read**) y **offline_access** (sin este no entrega el refresh_token y habría que
     autorizar a mano cada pocas horas). **No** marques escritura ni nada de ventas, preguntas o mensajes.
   - Notificaciones / tópicos: ninguno.
3. Al guardar te muestra **App ID** (client_id) y **Clave secreta** (client_secret). **No me los pases por el chat.**
   Cargalos en GitHub → repositorio → Settings → Secrets and variables → Actions → *New repository secret*:
   - `ML_CLIENT_ID` = App ID
   - `ML_CLIENT_SECRET` = Clave secreta
   - `ML_REDIRECT_URI` = la misma URI del paso 2
4. Creá un token personal de GitHub (Settings de tu usuario → Developer settings → Fine-grained tokens) con acceso
   **solo a este repositorio** y el permiso **Secrets: Read and write**. Guardalo como secreto `SECRETOS_PAT`.
   Hace falta porque Mercado Libre entrega un refresh_token nuevo en cada uso y el anterior deja de servir: el
   comparador tiene que poder guardarlo solo.
5. Autorizá la app abriendo (con tu App ID en lugar de `APP_ID`):
   `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=APP_ID&redirect_uri=https://brunogagna9-stack.github.io/Comparador/`
   Después de aceptar, la dirección termina en `?code=TG-…`. Copiá ese código y en GitHub → Actions →
   «Mercado Libre · autorizar (manual)» → *Run workflow*, pegalo. Vence en pocos minutos.
   (Ese flujo está en la rama `etapa-3`; aparece en Actions cuando se publique.)

## Cómo funciona (cuando lo autorices)

- Solo se buscan en Mercado Libre los **modelos que el comparador ya tiene** (tope 300 por corrida, medio segundo entre
  pedidos): `/products/search` (catálogo) y `/products/{id}/items` (publicaciones de ese producto). Se toma la
  publicación **nueva** más barata en pesos.
- Ninguna clave va a la web ni a archivos: solo a secretos de GitHub. El test revisa que no aparezcan claves en `site/`.
- Si faltan secretos, no hace ningún pedido y lo dice. Si Mercado Libre responde 401/403/429, corta y lo informa.
- Riesgos conocidos: Mercado Libre invalida los tokens tras unos 4 meses sin uso; no hay entorno de prueba (se prueba
  con la cuenta real, solo lectura).

## Opcional: afiliados

El programa «Afiliados y Creadores» de Mercado Libre paga comisión por compras desde tus enlaces (requiere mayoría de
edad y cuenta de Mercado Pago). Es independiente de la API; si te interesa, lo vemos aparte.
