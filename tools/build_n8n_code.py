"""Rebuild the Summary Writer chain's n8n Code-node files: shared library + node tail.

  n8n/code/prepare_summary.js = _summary_input.js   + prepare_summary_tail.js
  n8n/code/check_summary.js   = _summary_checker.js + check_summary_tail.js
  n8n/code/final_summary.js   = _summary_values.js  + final_summary_tail.js
  _summary_values.js is extracted from _summary_checker.js (fmtWeeks, buildFallback, toValues).
"""
import os
import re

R = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "n8n", "code")
lib = open(os.path.join(R, "_summary_checker.js")).read()


def grab(name):
    m = re.search(r"^(const %s = .*?;|function %s\(.*?\n\}\n)" % (name, name), lib, re.S | re.M)
    if not m:
        raise SystemExit(f"{name} not found in _summary_checker.js")
    return m.group(1)


open(os.path.join(R, "_summary_values.js"), "w").write(
    "// Code-only slide and slide-4 values (extracted from _summary_checker.js by tools/build_n8n_code.py).\n"
    + grab("fmtWeeks") + "\n\n" + grab("buildFallback") + "\n" + grab("toValues"))
for node, part in [("prepare_summary", "_summary_input.js"), ("check_summary", "_summary_checker.js"),
                   ("final_summary", "_summary_values.js")]:
    body = (f"// --- {part} (shared; edit there, then run tools/build_n8n_code.py) ---\n"
            + open(os.path.join(R, part)).read() + f"// --- end {part} ---\n"
            + open(os.path.join(R, node + "_tail.js")).read())
    open(os.path.join(R, node + ".js"), "w").write(body)
    print("built", node + ".js", len(body), "chars")
