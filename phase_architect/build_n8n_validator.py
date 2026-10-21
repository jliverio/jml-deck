"""Regenerate n8n/code/validate_plan.js from phase_architect/validate_plan_v2.js.

n8n/code/validate_plan.js = header line + validate_plan_v2.js (module.exports line removed) + the n8n wrapper
already in that file (from '// ---------------- n8n wrapper'). Edit validate_plan_v2.js, run this, then paste.
"""
import os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(R, "phase_architect", "validate_plan_v2.js")).read()
dst_path = os.path.join(R, "n8n", "code", "validate_plan.js")
dst = open(dst_path).read()
header = dst.split("\n", 1)[0]
wrapper = dst[dst.index("// ---------------- n8n wrapper"):]
exp = "if (typeof module !== 'undefined') module.exports = { validatePlan, weeksAvailable, parseDeadline, LIM };"
assert src.count(exp) == 1
body = src.replace(exp, "\n")
open(dst_path, "w").write(header + "\n" + body + wrapper)
print("built n8n/code/validate_plan.js", len(header + body + wrapper), "chars")
