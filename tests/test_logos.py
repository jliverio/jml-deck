"""Logos read from a home page (logos.py). No network: the pages and pictures are made here.

    python3 tests/test_logos.py
"""
import base64
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PIL import Image  # noqa: E402

import logos  # noqa: E402

passed = failed = 0


def check(name, ok, detail=""):
    global passed, failed
    if ok:
        passed += 1
    else:
        failed += 1
        print("FAIL", name, str(detail)[:300])


def png(color, size=(300, 90)):
    b = io.BytesIO()
    Image.new("RGBA", size, color).save(b, "PNG")
    return b.getvalue()


def ico():
    b = io.BytesIO()
    Image.new("RGBA", (64, 64), (200, 30, 30, 255)).save(b, "ICO", sizes=[(16, 16), (64, 64)])
    return b.getvalue()


SVG = ('<svg viewBox="0 0 200 60"><rect width="200" height="60" fill="#0a6" />'
       '<path d="M10 10h60v40h-60z" fill="#fff"/></svg>')
WHITE_SVG = '<svg viewBox="0 0 200 60"><path d="M10 10h180v40h-180z" fill="#ffffff"/></svg>'
CURRENT_SVG = '<svg viewBox="0 0 200 60" class="site-logo"><path d="M10 10h180v40h-180z" fill="currentColor"/></svg>'
FILES = {}
PAGES = {}


def fake_fetch(url, limit, timeout):
    if url in PAGES:
        return PAGES[url].encode("utf8"), url, "text/html"
    if url in FILES:
        data, ctype = FILES[url]
        return data, url, ctype
    raise OSError("404 " + url)


logos._fetch = fake_fetch
blue, white, red, green = (20, 60, 200, 255), (255, 255, 255, 255), (220, 30, 30, 255), (10, 160, 90, 255)


def colour(data):
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    return im.getpixel((im.size[0] // 2, im.size[1] // 2))


def site(name, html, files):
    PAGES[f"https://www.{name}.com"] = html
    for path, v in files.items():
        FILES[f"https://www.{name}.com{path}"] = v
    return logos.find(f"https://www.{name}.com")


# 1. the image in the home link wins over a wall of customers' logos and over the icons
data, note = site("acme", """<html><head><link rel="apple-touch-icon" sizes="180x180" href="/touch.png">
<link rel="icon" href="/favicon.ico"></head><body>
<header><a href="/" class="brand"><img src="/img/acme-logo.png" alt="Acme"></a><nav><a href="/pricing">Pricing</a></nav></header>
<section class="customers"><img src="/img/customers/globex-logo.png" alt="Globex logo"><img class="logo" src="/img/initech.png"></section>
</body></html>""", {"/img/acme-logo.png": (png(blue), "image/png"), "/touch.png": (png(red, (180, 180)), "image/png"),
                    "/img/customers/globex-logo.png": (png(green), "image/png"), "/img/initech.png": (png(green), "image/png")})
check("home link image is the logo", data is not None and colour(data) == blue and note == "found: image in the home link", note)

# 2. a white logo made for a dark header is skipped; the dark version is taken
data, note = site("duo", """<header><a href="https://www.duo.com/"><img src="/logo-white.svg" alt="Duo logo">
<img src="/logo-dark.svg" alt="Duo logo"></a></header>""",
                  {"/logo-white.svg": (WHITE_SVG.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"').encode(), "image/svg+xml"),
                   "/logo-dark.svg": (SVG.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"').encode(), "image/svg+xml")})
check("dark version of an SVG logo is taken", data is not None and colour(data)[:3] != (255, 255, 255) and "home link" in note, note)

# 3. only a white logo: falls back on the touch icon
data, note = site("mono", """<head><link rel="apple-touch-icon" href="/apple.png"></head>
<header><a href="/"><img src="/logo.png" alt="Mono logo"></a></header>""",
                  {"/logo.png": (png(white), "image/png"), "/apple.png": (png(red, (180, 180)), "image/png")})
check("white-only logo: the touch icon is used", data is not None and colour(data) == red and note == "found: touch icon", note)

# 4. a logo drawn in the page itself, in the page's text colour
data, note = site("inline", f"""<body><header><a href="/">{CURRENT_SVG}</a></header></body>""", {})
check("inline SVG in the home link is rendered, dark on white", data is not None and sum(colour(data)[:3]) < 120 and note == "found: drawing in the page in the home link", note)

# 5. a header drawn by scripts: nothing in the page, default icon addresses are tried
data, note = site("spa", """<html><head><title>App</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>""",
                  {"/apple-touch-icon.png": (png(green, (180, 180)), "image/png")})
check("no header in the page: /apple-touch-icon.png is tried", data is not None and colour(data) == green and note == "found: touch icon", note)

# 6. .ico: the largest picture inside is used; a 16 px icon alone is refused
data, note = site("old", """<head><link rel="shortcut icon" href="/favicon.ico"></head><body><p>Hello</p></body>""", {"/favicon.ico": (ico(), "image/x-icon")})
check(".ico: the 64 px picture is used", data is not None and Image.open(io.BytesIO(data)).size == (64, 64), note)
b = io.BytesIO(); Image.new("RGBA", (16, 16), red).save(b, "PNG")
data, note = site("tiny", """<head><link rel="icon" href="/f.png"></head>""", {"/f.png": (b.getvalue(), "image/png")})
check("a 16 px icon is not a logo", data is None and "too small" in note, note)

# 7. nothing at all, and a site that cannot be read
data, note = site("bare", "<html><body><p>Hello</p></body></html>", {})
check("no logo: says so", data is None and note.startswith("no usable logo"), note)
data, note = logos.find("https://www.gone-example.com")
check("unreadable site: says so, no error", data is None and "could not be read" in note, note)
data, note = logos.find("")
check("no address", data is None and note == "no address")

# 8. a large logo is scaled down; margins are cropped
big = Image.new("RGBA", (2400, 800), (0, 0, 0, 0))
big.paste(Image.new("RGBA", (1600, 400), blue), (400, 200))
b = io.BytesIO(); big.save(b, "PNG")
data, note = site("big", """<nav><a href="/"><img class="logo" src="/big.png"></a></nav>""", {"/big.png": (b.getvalue(), "image/png")})
im = Image.open(io.BytesIO(data))
check("large logo: margins cropped, scaled to 640 px", im.size == (640, 160) and len(data) < 20000, (im.size, len(data)))

# 9. an SVG that points at other files draws only itself
evil = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><image href="file:///etc/passwd" width="100" height="40"/><image xlink:href="http://10.0.0.1/x.png"/><script>alert(1)</script><rect width="100" height="40" fill="#123456"/></svg>'
clean = logos._clean_svg(evil)
check("SVG: outside references and scripts removed", "passwd" not in clean and "10.0.0.1" not in clean and "<script" not in clean and "#123456" in clean, clean)

# 10. several sites side by side, as the endpoint returns them
got, notes = logos.fetch_all({"client": "https://www.acme.com", "competitor_01": "https://www.bare.com", "competitor_02": "", "competitor_03": "www.mono.com"})
check("fetch_all: logos by key, a note for every site asked", sorted(got) == ["client", "competitor_03"] and set(notes) == {"client", "competitor_01", "competitor_03"}
      and base64.b64decode(got["client"])[:4] == b"\x89PNG", (sorted(got), notes))

# 11. the address names the site
check("site name from the address", logos._token("https://www.equalfood.co/pt") == "equalfood" and logos._token("https://app.n8n.io") == "n8n"
      and logos._token("https://www.bancobpi.pt") == "bancobpi" and logos._token("https://shop.acme.co.uk") == "acme")

# 12. the endpoint
import app as webapp  # noqa: E402
webapp.API_KEY = ""
client = webapp.app.test_client()
r = client.post("/logos", json={"sites": {"client": "https://www.acme.com", "competitor_01": "https://www.bare.com"}})
j = r.get_json()
check("/logos: logos and notes", r.status_code == 200 and list(j["logos"]) == ["client"] and j["notes"]["competitor_01"].startswith("no usable logo"), str(j)[:200])
check("/logos: nothing asked", client.post("/logos", json={}).status_code == 400)
check("/health: says logos are ready", client.get("/health").get_json().get("logos") is True)

print(f"{passed}/{passed + failed} passed")
sys.exit(1 if failed else 0)
