// Solo reglas que detectan errores reales (código inalcanzable, claves repetidas, comparaciones imposibles…),
// no de estilo: el sitio usa variables globales compartidas entre archivos (CT, ICONS, REP…).
import globals from "globals";
const bugs = { "no-dupe-keys": "error", "no-dupe-args": "error", "no-dupe-else-if": "error", "no-duplicate-case": "error",
  "no-unreachable": "error", "no-unsafe-finally": "error", "no-unsafe-negation": "error", "no-self-assign": "error",
  "no-func-assign": "error", "no-const-assign": "error", "no-import-assign": "error", "valid-typeof": "error",
  "use-isnan": "error", "no-compare-neg-zero": "error", "no-sparse-arrays": "error", "no-obj-calls": "error",
  "no-loss-of-precision": "error", "no-invalid-regexp": "error", "no-redeclare": "error" };
export default [
  { files: ["**/*.js"], languageOptions: { ecmaVersion: 2023, sourceType: "script", globals: { ...globals.browser } }, rules: bugs },
  { files: ["**/hero3d.js", "**/vendor/addons/**", "**/assistant-proxy.js"], languageOptions: { sourceType: "module" } },
  { ignores: ["**/vendor/*.js"] },
];
