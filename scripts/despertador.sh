#!/usr/bin/env bash
# Actualización 47: lógica del despertador (antes dentro de despertador.yml), separada para poder probarla.
# Variables: REPO, GH_TOKEN, URL (meta.json publicado), UMBRAL_HORAS (6 por defecto),
#            SIMULAR=1 → solo informa lo que haría, sin arrancar nada (para pruebas).
set -u
UMBRAL_HORAS="${UMBRAL_HORAS:-6}"
upd=$(curl -sfL "$URL?v=$(date +%s)" | python3 -c "import json,sys;print(json.load(sys.stdin)['updated'])" || echo "")
if [ -z "$upd" ]; then echo "RESULTADO: sin-fecha · No se pudo leer la fecha de los precios publicados: no se hace nada."; exit 0; fi
horas=$(python3 -c "import datetime as d,sys;t=d.datetime.fromisoformat(sys.argv[1].replace('Z','+00:00'));print(round((d.datetime.now(d.timezone.utc)-t).total_seconds()/3600,2))" "$upd")
echo "Precios publicados: $upd (hace $horas h; umbral $UMBRAL_HORAS h)"
en_curso=$(gh run list -R "$REPO" -w actualizar.yml --json status --jq '[.[]|select(.status!="completed")]|length')
if [ "$en_curso" != "0" ]; then echo "RESULTADO: en-curso · Ya hay una actualización en curso: no se arranca otra."; exit 0; fi
if python3 -c "import sys;sys.exit(0 if float(sys.argv[1])>float(sys.argv[2]) else 1)" "$horas" "$UMBRAL_HORAS"; then
  if [ "${SIMULAR:-0}" = "1" ]; then echo "RESULTADO: arrancaria · (simulación) Tienen más de $UMBRAL_HORAS h: acá se arrancaría la actualización."; exit 0; fi
  echo "RESULTADO: arranca · Tienen más de $UMBRAL_HORAS h: arranca la actualización."
  gh workflow run actualizar.yml -R "$REPO" --ref main
else
  echo "RESULTADO: al-dia · Están al día: no hace falta."
fi
