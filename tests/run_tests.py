import sys
sys.path.insert(0, ".")
import tests.test_all as t
t.test_ars(); t.test_parsers_and_matching(); t.test_history_and_changes(); t.test_servicios(); t.test_hardware_json(); t.test_categorias_pc_armadas(); t.test_hardware_especificaciones()
import shutil, subprocess
if shutil.which("node"):
    subprocess.run([sys.executable, "tests/make_fixture.py"], check=True)
    subprocess.run(["node", "tests/test_js.js"], check=True)   # armado, buscador y comparador
else:
    print("AVISO: node no está instalado; se omiten las pruebas de JavaScript")
print("tests OK")
