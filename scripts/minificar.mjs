/* KyraNoHard · actualización 40: achica el JavaScript y el CSS de la COPIA que se publica (nunca los archivos del
   repositorio, que siguen legibles) con esbuild (código abierto, github.com/evanw/esbuild).
   - js/*.js, sw.js y css/*.css: se minifican (sin renombrar nombres globales, que usan las páginas).
   - <script> y <style> dentro de cada página .html: se minifican igual.
   - js/vendor/ ya viene minificado y no se toca.
   Si algún archivo da error, queda el original (nunca se publica algo roto por esto).
   Uso: node scripts/minificar.mjs <carpeta del sitio a publicar>   (necesita esbuild instalado) */
import fs from "fs";
import path from "path";
import { transformSync } from "esbuild";

const dir = path.resolve(process.argv[2] || "");
if (!process.argv[2] || !fs.existsSync(path.join(dir, "index.html"))) { console.error("Uso: node scripts/minificar.mjs <carpeta del sitio>"); process.exit(2); }
const target = "esnext";   // solo achica: no reescribe el código para navegadores viejos (ya funciona como está)
let antes = 0, despues = 0, errores = 0;
const isModule = code => /^\s*(import|export)\s/m.test(code);
// minifySyntax/whitespace siempre; los nombres solo se acortan DENTRO de funciones (los globales se conservan solos en este modo)
const min = (code, loader, mod) => transformSync(code, { loader, minify: true, target, legalComments: "inline", ...(mod ? { format: "esm" } : {}) }).code;

function file(f, loader) {
  const src = fs.readFileSync(f, "utf8");
  try { const out = min(src, loader, loader === "js" && isModule(src)); if (out.length < src.length) { fs.writeFileSync(f, out); antes += src.length; despues += out.length; } }
  catch (e) { errores++; console.log("  (sin cambios)", path.relative(dir, f), "—", e.message.split("\n")[0]); }
}
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === "vendor" || e.name === "data" ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]);
for (const f of walk(dir)) {
  if (f.endsWith(".js")) file(f, "js");
  else if (f.endsWith(".css")) file(f, "css");
  else if (f.endsWith(".html")) {
    const src = fs.readFileSync(f, "utf8");
    let bad = false;
    const out = src
      .replace(/(<script(?![^>]*\bsrc=)(?![^>]*type="(?:application\/(?:ld\+)?json|speculationrules)")([^>]*)>)([\s\S]*?)(<\/script>)/g, (m, open, attrs, code, close) => {
        if (!code.trim()) return m;
        try { let c = min(code, "js", /type="module"/.test(attrs)).trim(); if (/<\/script/i.test(c)) return m; return open + c + close; } catch (e) { bad = true; console.log("  (script sin cambios)", path.relative(dir, f), "—", e.message.split("\n")[0]); return m; }
      })
      .replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, open, css, close) => {
        try { return open + min(css, "css").trim() + close; } catch (e) { bad = true; return m; }
      });
    if (bad) errores++;
    if (out.length < src.length) { fs.writeFileSync(f, out); antes += src.length; despues += out.length; }
  }
}
console.log(`Minificado: ${(antes / 1024).toFixed(0)} KB → ${(despues / 1024).toFixed(0)} KB (${Math.round(100 - despues / antes * 100)} % menos)${errores ? ` · ${errores} archivos quedaron sin cambios` : ""}`);
