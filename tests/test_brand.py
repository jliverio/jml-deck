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

check("rgb(var(--name-2, r, g, b)): a digit in the variable's name is not a channel (IKEA came out cyan)",
      brand._hex("rgb(var(--colour-elevation-2, 255, 255, 255))") == "FFFFFF"
      and brand._hex("rgb(var(--colour-static-ikea-brand-blue, 0, 88, 163))") == "0058A3"
      and brand._hex("rgb(var(--colour-neutral-1))") is None,
      (brand._hex("rgb(var(--colour-elevation-2, 255, 255, 255))"), brand._hex("rgb(var(--colour-neutral-1))")))
w, u = {}, {}
brand._weigh(".alert-danger{color:#a94442;background-color:#f2dede}.alert-success{color:#3c763d}.btn{background:#337ab7}" * 20, w, u)
check("Bootstrap 3 and theme defaults never count (PLMJ's alert colours)", not w, sorted(w))
r = brand._rank({"232F0F": 29, "FFFFFF": 269, "292929": 28, "B3F7E4": 12}, {"232F0F": 10, "FFFFFF": 119, "292929": 10, "B3F7E4": 6}, None, {})
check("medium evidence does not repaint the deck (Feedzai's near-grey olive)", r["confidence"] != "high" and r["apply"] is False, r["confidence"])

logo = zipfile.ZipFile(io.BytesIO(brand.recolor_pptx(open("template.pptx", "rb").read(), "E60000")[0])).read("ppt/slides/slide1.xml").decode().upper()
check("the JML logo keeps its navy and green (only the deck's blues change)", "1E3A5F" in logo and "5DCAA5" in logo, None)

# 4. template 1.5.4, José's own file (23 Nov, plan step 5): the two market research slides, the approach panel,
#    a cover drawn on a transparent ground, a slide of screenshots, and logos read from websites
import base64
import varfill
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
RULES154 = json.load(open(os.path.join(HERE, "..", "variables", "template_variables_1_5_4.json"), encoding="utf8"))
CASE = json.load(open(os.path.join(HERE, "research_cases.json"), encoding="utf8"))["n8n"]
PLAN = json.load(open(os.path.join(HERE, "metalco_1_4.json"), encoding="utf8"))["workplan"]


def _png(color, size=(900, 500), noise=False):
    im = Image.new("RGB", size, color)
    if noise:                                   # noise makes the file large, like a photograph
        px = im.load()
        for y in range(size[1]):
            for x in range(size[0]):
                r, g, b = color
                k = (x * 7919 + y * 104729) % 23
                px[x, y] = (min(255, r + k), min(255, g + k), min(255, b + k))
    buf = io.BytesIO(); im.save(buf, "PNG"); return buf.getvalue()


blue_logo = _png((20, 110, 200), (700, 300))
deck154, _ = varfill.build_deck({**CASE, "footer_01": "n8n | Draft for discussion"}, RULES154, workplan=PLAN, version="1.5.4",
                                last_resort=True, s3={"assumptions": [{"id": "A1", "text": "x", "if_wrong": "y"}]},
                                logos={"competitor_01": base64.b64encode(blue_logo).decode(),
                                       "client": base64.b64encode(blue_logo).decode()})
z0 = zipfile.ZipFile(io.BytesIO(deck154))
red154, _ = brand.recolor_pptx(deck154, "E60000")
z1 = zipfile.ZipFile(io.BytesIO(red154))
slides = [n for n in z1.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)]
left = sorted({(n.split("/")[-1], c.upper()) for n in slides
               for c in re.findall(r'srgbClr val="([0-9A-Fa-f]{6})"', z1.read(n).decode("utf8"))
               if c.upper() in brand.JML_BLUES})
check("1.5.4: no JML blue is left on any slide after the repaint", not left, left[:6])
check("1.5.4: the two bars of the objectives slide are in the ladder", {"1977A2", "93D7EF"} <= set(brand.JML_BLUES), None)
media = [n for n in z0.namelist() if re.match(r"ppt/media/.+\.(png|jpe?g)$", n, re.I)]
changed = [n for n in media if z0.read(n) != z1.read(n)]
photos = [n for n in media if len(z0.read(n)) > 200_000 and brand._blue_photo(Image.open(io.BytesIO(z0.read(n)))) is not None]
check("1.5.4: only the blue photographs are repainted (cover, closing)", changed and sorted(changed) == sorted(photos), (changed, photos))
shots = [n for n in media if len(z0.read(n)) > 200_000 and n not in photos]
check("1.5.4: the screenshots of the experience slide are left as they are", shots and all(z0.read(n) == z1.read(n) for n in shots), shots)
cover = [n for n in changed if Image.open(io.BytesIO(z0.read(n))).mode == "RGBA"]
ok_alpha = bool(cover)
for n in cover:
    a0 = Image.open(io.BytesIO(z0.read(n))).getchannel("A"); im1 = Image.open(io.BytesIO(z1.read(n)))
    ok_alpha = ok_alpha and im1.mode == "RGBA" and im1.size == a0.size and im1.getchannel("A").tobytes() == a0.tobytes()
check("1.5.4: the cover drawing keeps its transparent ground (it came out on black before)", ok_alpha, cover)
logos154 = brand._logo_media(z0)
check("1.5.4: the logo pictures are found by their shape names", len(logos154) >= 1, logos154)
check("1.5.4: logos are never repainted", all(z0.read(n) == z1.read(n) for n in logos154), None)
big_blue = _png((20, 110, 200), (900, 500), noise=True)
check("a blue picture alone would be repainted (so the logo rule is what protects a blue logo)",
      brand._shift_photo(big_blue, "E60000") is not None, len(big_blue))
check("a white screenshot and a red photograph are not ours: left alone",
      brand._shift_photo(_png((250, 250, 250), noise=True), "E60000") is None
      and brand._shift_photo(_png((200, 30, 40), noise=True), "007A33") is None, None)
shifted = Image.open(io.BytesIO(brand._shift_photo(big_blue, "007A33"))).convert("RGB").resize((8, 8)).convert("HSV")
hue = sorted(shifted.tobytes()[0::3])[32] * 360 / 255
want = Image.new("RGB", (1, 1), (0, 0x7A, 0x33)).convert("HSV").getpixel((0, 0))[0] * 360 / 255
check("the photograph lands on the client's hue, measured from the photograph's own blue", abs(hue - want) < 8, (round(hue), round(want)))

# 5. all text stays readable. The deck writes white on the dark and middle steps and dark on the two light steps.
#    White text may lose at most 5% of its contrast; dark text on the light panels at most 10%, and stays above 10:1.
WHEEL = {"red": "E60000", "orange": "F26522", "yellow": "FFD100", "green": "00843D", "teal": "00A0AF",
         "blue": "0058A3", "purple": "5405BD", "magenta": "C6007E", "near-black": "1A1A1A", "pastel": "A8D5BA"}
STEPS = ["051C2C", "062032", "03527B", "1877A2", "22A3DF", "A2D5EC", "E6E9EE"]
worst = []
low_white, low_dark = 1.0, 1.0
for name, c in WHEEL.items():
    m = brand.build_mapping(c)
    for s in STEPS:
        ratio = brand.contrast(m[s], "FFFFFF") / brand.contrast(s, "FFFFFF")
        low_white = min(low_white, ratio)
        if ratio < 0.95:
            worst.append((name, "white on " + s, round(ratio, 3)))
    for light in ("A2D5EC", "E6E9EE"):
        for dark, was in ((m["051C2C"], "051C2C"), ("000000", "000000")):
            now = brand.contrast(dark, m[light])
            ratio = now / brand.contrast(was, light)
            low_dark = min(low_dark, ratio)
            if ratio < 0.90 or now < 10:
                worst.append((name, was + " on " + light, round(ratio, 3), round(now, 1)))
    if brand.contrast(m["051C2C"], "FFFFFF") < 12:
        worst.append((name, "white on the darkest step"))
check("contrast: ten client colours round the wheel keep the deck's text contrast", not worst, worst[:5])
check("contrast: white text loses at most 5%, dark text on light panels at most 10%",
      low_white >= 0.95 and low_dark >= 0.90, (round(low_white, 3), round(low_dark, 3)))
print(f"contrast against the JML deck, worst case: white text {low_white:.3f}, dark text on light panels {low_dark:.3f}")

# 6. /recolor: a deck already sent in JML colours comes back in the client's colour (the reply with a HEX code)
os.environ["JML_API_KEY"] = "test-key"
import importlib
importlib.reload(app)
rc = app.app.test_client()
KEY = {"X-API-Key": "test-key"}
check("/health says this deploy can repaint a deck file", rc.get("/health").get_json().get("recolor") is True, None)
check("/recolor: no key, no service", rc.post("/recolor?primary=E60000", data=deck154).status_code == 401, None)
bad = [rc.post("/recolor?primary=" + h, data=deck154, headers=KEY).status_code for h in ("", "red", "E600", "GGGGGG", "%23E60000FF")]
check("/recolor: anything but six HEX digits is refused", bad == [400] * 5, bad)
check("/recolor: a file that is not a deck is refused", rc.post("/recolor?primary=E60000", data=b"%PDF-1.4", headers=KEY).status_code == 400, None)
rv = rc.post("/recolor?primary=%23e60000&name=n8n proposal draft.pptx", data=deck154, headers=KEY)
got = zipfile.ZipFile(io.BytesIO(rv.data)) if rv.status_code == 200 else None
check("/recolor: the deck comes back as a .pptx, named, with the colour used",
      rv.status_code == 200 and rv.mimetype == app.PPTX and rv.headers.get("X-Primary") == "E60000"
      and "n8n_proposal_draft.pptx" in rv.headers.get("Content-Disposition", ""), (rv.status_code, dict(rv.headers)))
check("/recolor: same slides, same text, no JML blue left",
      got is not None and brand.ladder_uses(rv.data) == 0 and brand.ladder_uses(deck154) > 50
      and [n for n in got.namelist() if "/slides/slide" in n] == [n for n in z0.namelist() if "/slides/slide" in n]
      and all(re.sub(r'srgbClr val="[0-9A-Fa-f]{6}"', "", got.read(n).decode("utf8")) == re.sub(r'srgbClr val="[0-9A-Fa-f]{6}"', "", z0.read(n).decode("utf8"))
              for n in z0.namelist() if re.match(r"ppt/slides/slide\d+\.xml$", n)), None)
check("/recolor: it is the same repaint as at build time", rv.status_code == 200 and all(
    got.read(n) == z1.read(n) for n in z1.namelist() if n.endswith(".xml")), None)
again = rc.post("/recolor?primary=007A33", data=rv.data, headers=KEY)
check("/recolor: a deck that is no longer in JML colours is refused with the reason",
      again.status_code == 422 and "not in JML colours" in (again.get_json() or {}).get("error", ""), again.status_code)

failed = [x for x in results if not x[1]]
for n, ok, d in results:
    print(("PASS " if ok else "FAIL ") + n + ("" if ok else f"  -> {d}"))
print(f"\n{len(results) - len(failed)}/{len(results)} passed")
sys.exit(1 if failed else 0)
