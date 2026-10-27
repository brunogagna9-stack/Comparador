import sys, json
sys.path.insert(0, ".")
import tests.test_all as t
t.test_ars(); t.test_parsers_and_matching(); t.test_history_and_changes(); t.test_servicios(); t.test_hardware_json(); t.test_categorias_pc_armadas(); t.test_hardware_especificaciones()
for _n in ("test_icecat", "test_fichas_desde_descripcion_de_tienda", "test_goldentech_guarda_descripcion_de_perifericos", "test_categoria_por_tipo_al_inicio", "test_fichas_placas_madre", "test_fichas_placas_madre_gigabyte_asus", "test_tiendas_nuevas_actualizacion_15", "test_presupuesto_de_tiempo", "test_xtpc_corta_en_el_relleno", "test_fichas_perifericos", "test_correccion_de_categorias", "test_estructura_del_sitio", "test_datos_danados_no_se_publican", "test_resumen_semanal", "test_katech_parse", "test_tiendas_woocommerce_nuevas", "test_venex_parse", "test_gamingcity_parse", "test_netgaming_parse", "test_tiendas_nuevas_se_cruzan_con_cuidado", "test_imagenes", "test_limpieza_catalogo", "test_cruce_entre_tiendas", "test_aviso_precios_muy_distintos", "test_cruce_no_mezcla_productos_distintos", "test_logg_marcado_actual", "test_precio_inusual", "test_logg_paginacion", "test_procesador_con_graficos_radeon_no_es_placa", "test_goldentech_parse", "test_armytech_parse", "test_tiendas_nuevas_no_cruzan_por_sku_interno", "test_stores_json_reputacion_verificable", "test_specs_normalize_units_and_provenance", "test_specs_variants_and_contradictions", "test_specs_attach_only_exact_sku", "test_specs_cache_ttl_and_blocked_source"):
    getattr(t, _n)()
import shutil, subprocess
from scrapers import specs as _sp   # el JS prueba contra la salida real del módulo de fichas
_items = _sp.build_items(t._CHARS, t._NB, "2026-10-23")
json.dump({"v": 1, "items": _items}, open("tests/fixtures/specs_out.json", "w"), ensure_ascii=False)
if shutil.which("node"):
    subprocess.run([sys.executable, "tests/make_fixture.py"], check=True)
    subprocess.run(["node", "tests/test_js.js"], check=True)   # armado, buscador y comparador
    subprocess.run(["node", "tests/test_assistant.js"], check=True)   # asistente virtual
    subprocess.run(["node", "tests/test_worker.mjs"], check=True)     # proxy opcional de IA
else:
    print("AVISO: node no está instalado; se omiten las pruebas de JavaScript")
print("tests OK")
