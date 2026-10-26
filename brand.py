"""Client colours (Oct 26, trial): read a client's brand colours from its website and repaint a rendered deck in them.

The JML deck uses one ladder of blues (OKLab lightness 0.22 navy -> 0.93 tint) plus a yellow for phase gates. A client
ramp keeps every step's lightness, so contrast (white text on the dark steps, dark text on the light ones) and the spread
between steps stay as designed, and gives each step the client's hue. How colourful a step is follows our ladder,
scaled by how colourful the client's colour is: a near-black brand turns the ladder into greys.

extract_palette(url) reads the home page and its style sheets (no browser) and ranks the colours the site paints with.
recolor_pptx(pptx, primary, accent) swaps the ladder in slides, layouts, masters and theme, and shifts the hue of the
cover photograph. Standard library and Pillow only (Pillow comes with python-pptx).
"""
import io
import ipaddress
import math
import re
import socket
import time
import urllib.parse
import urllib.request
import zipfile

from PIL import Image

# ---------------------------------------------------------------- colour maths (OKLab, Björn Ottosson)

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_to_oklch(h):
    h = h.lstrip("#")
    r, g, b = (_lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = (x ** (1 / 3) for x in (l, m, s))
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), (math.degrees(math.atan2(bb, a)) + 360) % 360


def _oklch_to_rgb(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


def _in_gamut(rgb):
    return all(-1e-4 <= x <= 1 + 1e-4 for x in rgb)


def oklch_to_hex(L, C, H):
    """The colour at this lightness and hue, its chroma reduced until it can be displayed."""
    lo, hi = 0.0, C
    if not _in_gamut(_oklch_to_rgb(L, C, H)):
        for _ in range(30):
            mid = (lo + hi) / 2
            if _in_gamut(_oklch_to_rgb(L, mid, H)):
                lo = mid
            else:
                hi = mid
        C = lo
    rgb = _oklch_to_rgb(L, C, H)
    return "%02X%02X%02X" % tuple(round(255 * min(1, max(0, _gam(min(1, max(0, x)))))) for x in rgb)


def contrast(h1, h2):
    """WCAG contrast ratio of two colours."""
    def lum(h):
        r, g, b = (_lin(int(h.lstrip("#")[i:i + 2], 16) / 255) for i in (0, 2, 4))
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    a, b = sorted((lum(h1), lum(h2)), reverse=True)
    return (a + 0.05) / (b + 0.05)


def hue_gap(h1, h2):
    d = abs(h1 - h2) % 360
    return min(d, 360 - d)

# ---------------------------------------------------------------- the JML palette and the client ramp

# Every blue the renderer and the templates place (slides, layouts, masters, theme), counted on the Banco SP deck.
JML_BLUES = ["051C2C", "061F32", "062032", "142B4C", "00335A", "1E3A5F", "03527B", "1877A2", "2E868C", "22A3DF",
             "A2D5EC", "E6E9EE", "2222F6", "3478AB", "00A9F4", "1F40E6", "AAE6F0", "3C96B4", "AFC3FF", "034B6F",
             "027AB1", "39BDF3", "71D2F1"]
JML_ACCENT = "F8BC3B"                       # phase gates
REF_CHROMA = hex_to_oklch("22A3DF")[1]      # our signature blue; the client's colour takes its place
COVER_HUE = 205.0                           # dominant hue of the cover photograph (HSV degrees)


def build_mapping(primary, accent=None):
    """JML colour -> client colour. Lightness kept, hue from the client, chroma scaled from our ladder."""
    _, Cp, Hp = hex_to_oklch(primary)
    mapping = {}
    for h in JML_BLUES:
        L, C, _ = hex_to_oklch(h)
        mapping[h] = oklch_to_hex(L, Cp * min(1.6, C / REF_CHROMA), Hp)
    if accent:   # the gate colour changes only for a second brand colour of a clearly different hue
        La, Ca, Ha = hex_to_oklch(accent)
        if hue_gap(Ha, Hp) >= 45 and Ca >= 0.06:
            mapping[JML_ACCENT] = oklch_to_hex(max(0.70, min(0.85, La)), Ca, Ha)
    return mapping


def _shift_photo(data, primary):
    """Hue-shift a photograph from our blue to the client's hue; a grey brand gives a grey photograph."""
    _, C, _ = hex_to_oklch(primary)
    r, g, b = (int(primary[i:i + 2], 16) for i in (0, 2, 4))
    target = Image.new("RGB", (1, 1), (r, g, b)).convert("HSV").getpixel((0, 0))[0] * 360 / 255
    im = Image.open(io.BytesIO(data))
    fmt = im.format or "JPEG"
    im.draft("RGB", (2400, 2400))            # decode a large JPEG at reduced size: memory stays small on Render
    im = im.convert("RGB")
    if im.width > 2400:
        im = im.resize((2400, round(im.height * 2400 / im.width)))
    shift = round((target - COVER_HUE) * 255 / 360)
    sat = min(1.0, C / 0.12)
    h, s, v = im.convert("HSV").split()
    h = h.point(lambda x: (x + shift) % 256)
    s = s.point(lambda x: round(x * sat))
    out = Image.merge("HSV", (h, s, v)).convert("RGB")
    buf = io.BytesIO()
    out.save(buf, fmt, quality=88)
    return buf.getvalue()


def recolor_pptx(pptx_bytes, primary, accent=None):
    """Repaint a rendered deck in the client's colours. Returns (pptx bytes, mapping used)."""
    primary = primary.lstrip("#").upper()
    mapping = build_mapping(primary, accent.lstrip("#").upper() if accent else None)
    pat = re.compile(r'(srgbClr val=")(' + "|".join(mapping) + r')(")', re.I)
    zin = zipfile.ZipFile(io.BytesIO(pptx_bytes))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for it in zin.infolist():
            data = zin.read(it.filename)
            if it.filename.startswith("ppt/") and it.filename.endswith(".xml"):
                data = pat.sub(lambda m: m.group(1) + mapping[m.group(2).upper()] + m.group(3),
                               data.decode("utf8")).encode("utf8")
            elif re.match(r"ppt/media/.+\.(jpe?g|png)$", it.filename, re.I) and len(data) > 200_000:
                data = _shift_photo(data, primary)   # the cover and closing photographs, not icons
            zout.writestr(it, data)
    return buf.getvalue(), mapping

# ---------------------------------------------------------------- reading a website's colours

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36")
COLOR = re.compile(r"#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\(\s*[^)]*\)", re.I)
DECL = re.compile(r"([-\w]+)\s*:\s*([^;{}]+)")
BRANDY = re.compile(r"brand|primary|main|accent|theme|corporate|secondary", re.I)
# Default palettes of web frameworks, present on sites that never use them (Oct 26 trial: Bootstrap's blue came out
# as the second colour of Millennium bcp and Novo Banco). Their variables (--bs-*, --wp--preset--*) are skipped too.
FRAMEWORK = {"007BFF", "0D6EFD", "6610F2", "6F42C1", "E83E8C", "D63384", "DC3545", "FD7E14", "FFC107", "28A745",
             "198754", "20C997", "17A2B8", "0DCAF0", "6C757D", "343A40", "F8F9FA", "CF2E2E", "FF6900", "FCB900",
             "7BDCB5", "00D084", "8ED1FC", "0693E3", "9B51E0", "ABB8C3", "F78DA7",
             # Bootstrap 3 (PLMJ's two "brand" colours were its alert red and green), the WordPress editor's blue,
             # and the Divi theme's default accent (Bike.POP)
             "337AB7", "286090", "23527C", "2E6DA4", "204D74", "5CB85C", "449D44", "398439", "5BC0DE", "31B0D5",
             "F0AD4E", "EC971F", "D9534F", "C9302C", "A94442", "3C763D", "31708F", "8A6D3B", "DFF0D8", "D9EDF7",
             "FCF8E3", "F2DEDE", "2B542C", "245269", "66512C", "843534", "66AFE9", "007CBA", "006BA1", "005A87", "2271B1", "135E96", "3858E9", "2EA3F2"}
FRAMEWORK_VAR = re.compile(r"^--(bs-|wp--preset|wp-admin)", re.I)
# Confidence at which a deck is repainted; below it the deck keeps the JML blues. Oct 26 trial on 24 sites: all 9 "high"
# results matched the brand; of 5 "medium", 1 did (Stripe), 2 were a template's default (Odoo's plum) or a near-grey
# (Feedzai), 2 were not checked (Bike.POP, EDP).
APPLY = ("high",)


class PaletteError(Exception):
    pass


def _public(url):
    """Refuse addresses inside private networks (the renderer must not be used to reach them)."""
    host = urllib.parse.urlparse(url).hostname or ""
    try:
        infos = socket.getaddrinfo(host, None)
    except OSError:
        raise PaletteError(f"cannot resolve {host}")
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise PaletteError(f"{host} is not a public address")


def _get(url, limit, timeout):
    _public(url)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*", "Accept-Encoding": "identity"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = r.read(limit + 1)
        final = r.geturl()
    return data[:limit].decode("utf8", "ignore"), final


def _hex(token):
    t = token.strip().lower()
    if t.startswith("#"):
        h = t[1:]
        if len(h) in (3, 4):
            if len(h) == 4 and int(h[3], 16) < 8:
                return None
            h = "".join(c * 2 for c in h[:3])
        elif len(h) == 8:
            if int(h[6:], 16) < 128:
                return None
            h = h[:6]
        return h.upper()
    # rgb(var(--colour-elevation-2, 255, 255, 255)): the digit in the variable's name is not a channel (Oct 26, IKEA
    # came out cyan, 01FFFF, from "elevation-2" read as red = 2... then 1)
    nums = re.findall(r"[\d.]+%?", re.sub(r"--[\w-]+", "", t))
    if len(nums) < 3:
        return None
    def ch(x):
        return round(float(x[:-1]) * 2.55) if x.endswith("%") else round(float(x))
    try:
        r, g, b = (min(255, ch(x)) for x in nums[:3])
        if len(nums) > 3:
            a = float(nums[3][:-1]) / 100 if nums[3].endswith("%") else float(nums[3])
            if a < 0.5:
                return None
    except ValueError:
        return None
    return "%02X%02X%02X" % (r, g, b)


def _weigh(css, weights, uses):
    for prop, value in DECL.findall(css):
        p = prop.lower()
        if FRAMEWORK_VAR.match(p):
            continue
        if p.startswith("--"):
            w = 2 + (3 if BRANDY.search(p) else 0)
        elif "background" in p or p in ("fill", "stop-color"):
            w = 3
        elif p == "color":
            w = 2
        elif "border" in p or "outline" in p:
            w = 1
        else:
            continue   # shadows, filters, masks: not the brand
        for tok in COLOR.findall(value):
            h = _hex(tok)
            if h and h not in FRAMEWORK:
                weights[h] = weights.get(h, 0) + w
                uses[h] = uses.get(h, 0) + 1


def extract_palette(url, budget=20.0):
    """Rank a website's colours. Returns primary/secondary brand colours (or None) and the evidence."""
    t0 = time.time()
    if not re.match(r"https?://", url, re.I):
        url = "https://" + url
    html, final = _get(url, 2_000_000, 10)
    weights, uses = {}, {}
    sources = {"page": final, "stylesheets": [], "inline_styles": 0}
    # inline <style> blocks and style="" attributes
    for block in re.findall(r"<style[^>]*>(.*?)</style>", html, re.I | re.S):
        sources["inline_styles"] += 1
        _weigh(block, weights, uses)
    for attr in re.findall(r'style\s*=\s*"([^"]*)"', html, re.I):
        _weigh(attr, weights, uses)
    # SVG fills written as attributes (logos)
    for tok in re.findall(r'(?:fill|stop-color)\s*=\s*"(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))"', html, re.I):
        h = _hex(tok)
        if h:
            weights[h] = weights.get(h, 0) + 3
            uses[h] = uses.get(h, 0) + 1
    theme = None
    m = re.search(r'<meta[^>]+name=["\']theme-color["\'][^>]*content=["\']([^"\']+)', html, re.I) or \
        re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]*name=["\']theme-color', html, re.I)
    if m:
        theme = _hex(m.group(1))
        if theme:
            weights[theme] = weights.get(theme, 0) + 15
            uses[theme] = uses.get(theme, 0) + 1
    # linked style sheets, in page order
    links = re.findall(r'<link[^>]+rel=["\'][^"\']*stylesheet[^"\']*["\'][^>]*>', html, re.I)
    hrefs = []
    for tag in links:
        hm = re.search(r'href=["\']([^"\']+)', tag, re.I)
        if hm:
            hrefs.append(urllib.parse.urljoin(final, hm.group(1).replace("&amp;", "&")))
    total = 0
    for href in hrefs[:10]:
        if time.time() - t0 > budget or total > 4_000_000:
            break
        try:
            css, _ = _get(href, 1_500_000, 8)
        except Exception as e:   # one unreachable sheet does not stop the reading
            sources["stylesheets"].append({"url": href, "error": type(e).__name__})
            continue
        total += len(css)
        sources["stylesheets"].append({"url": href, "bytes": len(css)})
        _weigh(css, weights, uses)
    return _rank(weights, uses, theme, sources)


def _rank(weights, uses, theme, sources):
    rows = []
    for h, w in weights.items():
        L, C, H = hex_to_oklch(h)
        rows.append({"hex": h, "weight": w, "uses": uses.get(h, 0), "L": round(L, 3), "C": round(C, 3), "H": round(H)})
    total = sum(r["weight"] for r in rows) or 1
    chromatic = [r for r in rows if r["C"] >= 0.05 and 0.2 <= r["L"] <= 0.92]
    # hue families of 20 degrees; the heaviest family is the brand
    fam = {}
    for r in chromatic:
        fam.setdefault(int(r["H"] // 20), []).append(r)
    ranked = sorted(fam.values(), key=lambda rs: -sum(r["weight"] for r in rs))
    chroma_w = sum(r["weight"] for r in chromatic)
    primary = secondary = None
    note = ""
    if ranked and chroma_w >= 0.08 * total:
        top = ranked[0]
        primary = max(top, key=lambda r: (r["weight"], -abs(r["L"] - 0.55)))
        for rs in ranked[1:]:
            cand = max(rs, key=lambda r: r["weight"])
            if (hue_gap(cand["H"], primary["H"]) >= 45 and cand["uses"] >= 10
                    and sum(r["weight"] for r in rs) >= 0.2 * sum(r["weight"] for r in top)):
                secondary = cand
                break
        share = sum(r["weight"] for r in top) / chroma_w
        # enough evidence as well as a clear lead: a colour met a handful of times (a script-built site) is not a brand
        confidence = ("high" if share >= 0.5 and primary["uses"] >= 20 else
                      "medium" if share >= 0.3 and primary["uses"] >= 10 else "low")
    else:
        dark = [r for r in rows if r["L"] < 0.4 and r["C"] < 0.05]
        if dark:   # a black-and-white brand: its darkest neutral leads the ladder, which comes out grey
            primary = max(dark, key=lambda r: r["weight"])
            note = "monochrome site: the deck turns grey"
        confidence = "low"
    top_rows = sorted(rows, key=lambda r: -r["weight"])[:12]
    return {
        "primary": primary["hex"] if primary else None,
        "secondary": secondary["hex"] if secondary else None,
        "theme_color": theme,
        "confidence": confidence,
        "apply": bool(primary) and confidence in APPLY,
        "chromatic_share": round(chroma_w / total, 2),
        "note": note,
        "top": top_rows,
        "sources": sources,
    }
