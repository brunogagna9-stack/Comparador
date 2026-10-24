/* Proxy OPCIONAL para el asistente de ComparáTech (Cloudflare Workers, nivel gratuito).
   GitHub Pages es estático: una IA externa necesita un intermediario para que la clave NO esté en el JavaScript público.
   Este archivo NO se publica en el sitio (vive en la carpeta worker/). La clave se guarda como secreto del Worker.

   Variables del Worker (Settings → Variables):
     LLM_KEY      (secreto)  clave del proveedor de IA
     LLM_URL      URL de un endpoint compatible con "chat/completions" (OpenAI, Groq, Gemini en modo compatible, etc.)
     LLM_MODEL    nombre del modelo
     ALLOWED_ORIGIN  p. ej. https://brunogagna9-stack.github.io  (solo ese sitio puede llamar)
   Costos: el Worker tiene nivel gratuito con límites; algunos proveedores de IA ofrecen un nivel gratuito con límites propios.
   Verificá las condiciones actuales de cada uno: si se superan, el proveedor puede cobrar o cortar el servicio. */

const SYSTEM = `Sos el asistente de ComparáTech, un comparador de hardware de tiendas argentinas. Respondé en español rioplatense, claro y breve, para gente que recién empieza.
Orden de verdad: 1) el CONTEXTO que te pasan (estado de la página) 2) datos verificados del catálogo incluidos en el contexto 3) conocimiento general, aclarando que es general.
Reglas: no inventes precios, stock, especificaciones, reseñas ni puntuaciones. Si el dato no está en el contexto, decí que no lo tenés y qué se puede hacer para conseguirlo. No des como real la autonomía de batería de marketing. Recordá que precios y stock cambian. No pidas datos personales.`;

const hits = new Map();            // limitador simple por IP (se reinicia cuando se recicla el Worker)
const LIMIT = 20, WINDOW = 10 * 60 * 1000, MAX_BODY = 6000;

export function cors(env, req) {
  const o = req.headers.get("Origin");
  const ok = env.ALLOWED_ORIGIN && o === env.ALLOWED_ORIGIN;
  return { ok, headers: { "Access-Control-Allow-Origin": ok ? o : "null", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" } };
}
const json = (obj, status, h) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...h } });

export async function handle(req, env, fetchImpl = fetch, now = Date.now()) {
  const c = cors(env, req);
  if (req.method === "OPTIONS") return new Response(null, { status: c.ok ? 204 : 403, headers: c.headers });
  if (!c.ok) return json({ error: "origen no permitido" }, 403, c.headers);
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405, c.headers);
  if (!env.LLM_KEY || !env.LLM_URL || !env.LLM_MODEL) return json({ error: "asistente de IA no configurado" }, 503, c.headers);
  const ip = req.headers.get("CF-Connecting-IP") || "anon";
  const rec = (hits.get(ip) || []).filter(t => now - t < WINDOW);
  if (rec.length >= LIMIT) return json({ error: "límite de consultas alcanzado" }, 429, c.headers);
  rec.push(now); hits.set(ip, rec);
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "consulta demasiado larga" }, 413, c.headers);
  let b; try { b = JSON.parse(raw); } catch { return json({ error: "JSON inválido" }, 400, c.headers); }
  const q = String(b.q || "").slice(0, 500).trim();
  if (!q) return json({ error: "falta la pregunta" }, 400, c.headers);
  const ctx = (Array.isArray(b.context) ? b.context : []).slice(0, 12).map(x => String(x).slice(0, 300)).join("\n");
  const hist = (Array.isArray(b.history) ? b.history : []).slice(-4).map(h => ({ role: h.r === "assistant" ? "assistant" : "user", content: String(h.c || "").slice(0, 300) }));
  let r;
  try {
    r = await fetchImpl(env.LLM_URL, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.LLM_KEY },
      body: JSON.stringify({ model: env.LLM_MODEL, max_tokens: 400, temperature: 0.2,
        messages: [{ role: "system", content: SYSTEM + "\n\nCONTEXTO:\n" + ctx }, ...hist, { role: "user", content: q }] }),
    });
  } catch { return json({ error: "no se pudo contactar a la IA" }, 502, c.headers); }
  if (r.status === 429) return json({ error: "límite del proveedor de IA" }, 429, c.headers);
  if (!r.ok) return json({ error: "error del proveedor de IA" }, 502, c.headers);
  const j = await r.json().catch(() => null);
  const answer = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
  if (!answer) return json({ error: "respuesta vacía" }, 502, c.headers);
  return json({ answer: String(answer).slice(0, 2000) }, 200, c.headers);
}

export default { fetch: (req, env) => handle(req, env) };
