import sys
sys.path.insert(0, ".")
import tests.test_all as t
t.test_ars(); t.test_parsers_and_matching(); print("tests OK")
