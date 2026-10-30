"""Verifier contract check: the authored edge-roll heuristic is informational."""

import json
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import verify_geometry

report_rel = "reports/geometry_profile_acceptance_test.json"
sys.argv = ["verify_geometry.py", "--", "--output-root", str(ROOT),
            "--report", report_rel, "--open-profile-only"]
verify_geometry.main()

report = json.loads((ROOT / report_rel).read_text(encoding="utf-8"))
profile = report["open_profile"]
assert profile["visual_acceptance"] == "pending/R12,R18", profile
source = profile["v13_source_comparison"]
assert source["assessment"] == "informational_only", source
assert abs(source["source_metrics"]["full_open_cup_depth_m"] - 0.1017327905) < 1e-8, source
assert abs(source["source_metrics"]["front_tepal_forward_reach_m"] - 0.2254761010) < 1e-8, source
assert profile["metric_assessment"].endswith("not pass/fail thresholds"), profile
geometry = profile["v13_endpoint_geometry_comparison"]
assert geometry["max_vertex_delta_m"] <= 0.011, geometry
assert len(geometry["mid_row_centerline_samples"]) == 6, geometry
assert not report["failures"], report["failures"]
print(f"PROFILE_ACCEPTANCE_REPORT_TEST PASS v13_delta_max={geometry['max_vertex_delta_m']:.6f}m visual=pending/R12,R18")
