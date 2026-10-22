import sys
sys.path.insert(0, ".")
import tests.test_all as t
t.test_ars(); t.test_parsers_and_matching(); t.test_history_and_changes(); t.test_servicios(); t.test_hardware_json(); print("tests OK")
