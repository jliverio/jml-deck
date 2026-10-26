"""Client colours (brand.py, Oct 26 trial). Run: python3 tests/test_brand.py"""
import io, json, os, re, sys, zipfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import brand
results = []
def check(name, ok, detail=None): results.append((name, bool(ok), detail))

# 1. reading colours from CSS: brand red used across buttons, links and a variable; Bootstrap leftovers once each
css = """:root{--brand-primary:#c8102e;--bs-blue:#0d6efd;--bs-green:#198754}
.btn-primary{background-color:#C8102E;border-color:#c8102e}.btn-primary:hover{background:#a00d25}
a{color:#c8102e}h1,h2{color:#1a1a1a}body{color:#333;background:#fff}.footer{background:#1a1a1a;color:#fff}
.badge{background:rgba(200,16,46,1)}.shadow{box-shadow:0 0 4px #0d6efd}.alt{background:#ffb81c}.alt2{color:#ffb81c}
.cta{background:#ffb81c}"""
w, u = {}, {}
brand._weigh(css * 5, w, u)   # a real site repeats its colours across many rules; a second colour needs 10+ uses
r = brand._rank(w, u, None, {})
check("CSS: the most used colourful family is the brand; a shadow colour does not count",
      r["primary"] in ("C8102E", "A00D25") and r["secondary"] == "FFB81C" and "0D6EFD" not in [x["hex"] for x in r["top"] if x["weight"] > 2],
      (r["primary"], r["secondary"], [(x["hex"], x["weight"]) for x in r["top"][:6]]))
w, u = {}, {}
brand._weigh("body{color:#111;background:#fff}h1{color:#000}.nav{background:#222;color:#eee}a{color:#000}", w, u)
r = brand._rank(w, u, None, {})
check("CSS: a black-and-white site gives a dark neutral and says so", r["primary"] in ("111111", "222222", "000000") and "monochrome" in r["note"], r)
check("colour tokens: 3-digit, 8-digit with low alpha, rgb() with alpha",
      brand._hex("#c12") == "CC1122" and brand._hex("#c8102e10") is None and brand._hex("rgba(200,16,46,.3)") is None
      and brand._hex("rgb(200 16 46)") == "C8102E", None)
try:
    brand._public("http://127.0.0.1/")
    check("private addresses are refused", False, "127.0.0.1 accepted")
except brand.PaletteError:
    check("private addresses are refused", True)

# 2. the ramp keeps every step's lightness, so contrast with white is unchanged
m = brand.build_mapping("00843D")
bad = [(k, v) for k, v in m.items() if abs(brand.hex_to_oklch(k)[0] - brand.hex_to_oklch(v)[0]) > 0.01]
check("ramp: each JML blue keeps its lightness in the client's hue", not bad, bad[:3])
check("ramp: white on the darkest step stays readable (contrast >= 12)", brand.contrast(m["051C2C"], "FFFFFF") >= 12, m["051C2C"])
g = brand.build_mapping("1A1A1A")
check("ramp: a near-black brand gives greys", all(brand.hex_to_oklch(v)[1] < 0.02 for v in g.values()), list(g.items())[:3])
check("ramp: the gate yellow changes only for a second colour of another hue",
      "F8BC3B" not in brand.build_mapping("C8102E", "D0152F") and "F8BC3B" in brand.build_mapping("00843D", "FFB81C"), None)

# 3. recolouring a deck rendered through the real /render path
import app
payload = json.load(open(os.path.join(os.path.dirname(__file__), "..", "sample_payload.json"))) if os.path.exists("sample_payload.json") else None
c = app.app.test_client()
os.environ.pop("JML_API_KEY", None)
src = None
for cand in ("tests/metalco_1_4.json", "tests/summary_doc06.json"):
    if os.path.exists(cand):
        src = json.load(open(cand)); break
plain = c.post("/render", data=json.dumps(src))
check("render: a payload without brand renders as before", plain.status_code == 200 and "recoloured" not in plain.headers.get("X-Render-Warnings", ""), plain.status_code)
branded = c.post("/render", data=json.dumps({**src, "brand": {"primary": "00843D"}}))
z = zipfile.ZipFile(io.BytesIO(branded.data))
left = set()
for n in z.namelist():
    if re.match(r"ppt/slides/slide\d+\.xml", n):
        left |= {h.upper() for h in re.findall(r'srgbClr val="([0-9A-Fa-f]{6})"', z.read(n).decode())} & set(brand.JML_BLUES)
theme = z.read("ppt/theme/theme1.xml").decode()
check("render with brand: no JML blue left on any slide, theme accents repainted",
      branded.status_code == 200 and not left and "051C2C" not in theme and "recoloured" in branded.headers.get("X-Render-Warnings", ""),
      (branded.status_code, sorted(left)[:5]))

w, u = {}, {}
brand._weigh(css + ":root{--bs-primary:#0d6efd}.x{background:#0d6efd}", w, u)
check("framework defaults (Bootstrap blue, --bs-* variables) never count", "0D6EFD" not in w, sorted(w)[:8])
r = brand._rank({"B22E46": 6, "000000": 16}, {"B22E46": 3, "000000": 6}, None, {})
check("a colour seen only a few times does not repaint the deck (apply false)", r["apply"] is False, r)

failed = [x for x in results if not x[1]]
for n, ok, d in results:
    print(("PASS " if ok else "FAIL ") + n + ("" if ok else f"  -> {d}"))
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
