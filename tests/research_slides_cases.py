"""Test values for the two market research slides (template 1.5.4): the seven firms of the 12-22 Nov trial,
read from the hand-built Claude Slides version (HTML, one file per slide). Used by tests/test_research_slides.py.

    python tests/research_slides_cases.py <folder with *-profile.html and *-compare.html>  -> tests/research_cases.json
"""
import glob
import html
import json
import os
import re
import sys


def _mark(x):
    x = re.sub(r'<span class="g"><i>(.*?)</i></span>', r"__\1__", x, flags=re.S)
    x = re.sub(r"<b>(.*?)</b>", r"**\1**", x, flags=re.S)
    x = re.sub(r"<br\s*/?>", "\n", x)
    x = re.sub(r"<[^>]+>", "", x)
    return html.unescape(x).strip()


def profile(src):
    v = {"section_02": "Market Research"}
    v["profile_title_01"] = _mark(re.search(r'<h2 class="title"><b>.*?</b>(.*?)</h2>', src, re.S).group(1))
    for i, layer in enumerate(re.findall(r'<div class="layer">(.*?)</div></div>', src, re.S), 1):
        m = re.search(r'<p class="ld( buys)?">(.*?)</p>', layer, re.S)
        v[f"value_layer_{i:02d}"] = "" if not m else (f"__{_mark(m.group(2))}__" if m.group(1) else _mark(m.group(2)))
    for i, (n, d) in enumerate(re.findall(r'<p class="pn">(.*?)</p><p class="pd">(.*?)</p>', src, re.S), 1):
        v[f"product_{i:02d}_name"], v[f"product_{i:02d}_text"] = _mark(n), _mark(d)
    geo = re.search(r'<p class="geo">(.*?)</p>', src, re.S).group(1)
    parts = re.split(r"<br\s*/?>", geo)
    v["details_01"], v["details_02"] = _mark(parts[0]), _mark(parts[1]) if len(parts) > 1 else ""
    v["sources_profile_01"] = re.sub(r"^Sources?:\s*", "", _mark(re.search(r'<p class="src">(.*?)</p>', src, re.S).group(1)))
    return v


def compare(src):
    v = {"compare_title_01": _mark(re.search(r'<h2 class="title"><b>.*?</b>(.*?)</h2>', src, re.S).group(1))}
    v["client_name_01"] = _mark(re.search(r'<div class="co">\s*<h3 class="h">(.*?)</h3>', src, re.S).group(1))
    box = re.search(r'<div class="cbox">(.*?)</div>', src, re.S).group(1)
    for i, li in enumerate(re.findall(r"<li>(.*?)</li>", box, re.S), 1):
        v[f"client_point_{i:02d}"] = _mark(li)
    for i, n in enumerate(re.findall(r'<div class="hd"><p>(.*?)</p></div>', src, re.S), 1):
        v[f"competitor_{i:02d}_name"] = _mark(n)
    for i, cc in enumerate(re.findall(r'<div class="cc[^"]*">(.*?)</div>', src, re.S), 1):
        f = re.search(r'<p class="fact">(.*?)</p>', cc, re.S)
        v[f"competitor_{i:02d}_fact_01"] = _mark(f.group(1)) if f else ""
        for j, li in enumerate(re.findall(r"<li>(.*?)</li>", cc, re.S), 1):
            v[f"competitor_{i:02d}_point_{j:02d}"] = _mark(li)
    v["sources_compare_01"] = re.sub(r"^Sources?:\s*", "", _mark(re.search(r'<p class="src">(.*?)</p>', src, re.S).group(1)))
    return v


if __name__ == "__main__":
    folder = sys.argv[1]
    cases = {}
    for f in sorted(glob.glob(os.path.join(folder, "*-profile.html"))):
        firm = os.path.basename(f)[:-len("-profile.html")]
        v = profile(open(f, encoding="utf8").read())
        c = f.replace("-profile.html", "-compare.html")
        if os.path.exists(c):
            v.update(compare(open(c, encoding="utf8").read()))
        cases[firm] = v
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "research_cases.json")
    json.dump(cases, open(out, "w", encoding="utf8"), ensure_ascii=False, indent=1)
    print("wrote", out, {k: len(v) for k, v in cases.items()})
